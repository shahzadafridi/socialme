import { browser } from 'wxt/browser';
import {
  clearEditor,
  freshestEditor,
  insertIntoEditor,
  looksInserted,
  placeCaretAtEnd,
} from '@/lib/integrations/insert';
import { contextLimit } from '@/lib/integrations/messaging';
import { readCommentBeingRepliedTo, type PlatformAdapter } from '@/lib/integrations/adapter';
import { typeLikeHuman } from '@/lib/features/safety/humanize';
import { NOTE_LIMIT } from '@/lib/core/constants';
import { addHistory, getSettings, resolvePersona, saveLastDraft } from '@/lib/data/storage';
import type { Channel, GenerateRequest, PortMessage, Settings } from '@/lib/core/types';
import type { Mode } from '@/lib/ui/composer/types';
import { type Entry, setState, styleButton } from '@/lib/ui/composer/button';
import { insertButton } from '@/lib/ui/composer/placement';
import { openToneMenu } from '@/lib/ui/composer/menu';

const BUTTON_CLASS = 'socialme-quick';

const CHANNEL_OF: Record<Mode, Channel> = {
  comment: 'comment',
  dm: 'dm',
  note: 'note',
};

function appendDelta(editor: HTMLElement, delta: string): void {
  if (!delta) return;
  editor.focus();
  placeCaretAtEnd(editor);
  let ok = false;
  try {
    ok = document.execCommand('insertText', false, delta);
  } catch {
    ok = false;
  }
  if (!ok) {
    editor.appendChild(document.createTextNode(delta));
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: delta, inputType: 'insertText' }),
    );
  }
}

/**
 * LinkedIn rejects an invitation note over 300 characters and its textarea refuses
 * the extra keystrokes, so cut on a word boundary before writing. The prompt already
 * aims below the cap; this only catches models that overshoot.
 */
function fitNote(text: string): string {
  if (text.length <= NOTE_LIMIT) return text;
  const cut = text.slice(0, NOTE_LIMIT);
  const space = cut.lastIndexOf(' ');
  return (space > NOTE_LIMIT * 0.75 ? cut.slice(0, space) : cut).trimEnd();
}

async function finish(
  entry: Entry,
  text: string,
  settings: Settings,
  adapter: PlatformAdapter,
  postText: string,
): Promise<void> {
  const clean = entry.mode === 'note' ? fitNote(text.trim()) : text.trim();
  entry.busy = false;
  entry.port = null;
  if (!clean) {
    setState(entry, 'error', 'The model returned nothing');
    return;
  }

  if (!looksInserted(entry.editor, clean)) {
    const target = freshestEditor(entry.editor);
    clearEditor(target);
    const typed = settings.safety.humanTyping
      ? await typeLikeHuman(target, clean, settings.safety.typingSpeed)
      : await insertIntoEditor(target, clean);
    if (!typed) {
      setState(entry, 'error', 'The editor rejected the text');
      return;
    }
    // Frameworks sometimes replay their own empty state right after our write.
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!looksInserted(target, clean)) await insertIntoEditor(freshestEditor(target), clean);
  }

  await saveLastDraft(clean);
  if (settings.historyEnabled) {
    void addHistory({
      platform: adapter.id,
      channel: CHANNEL_OF[entry.mode],
      personaId: resolvePersona(settings, adapter.id).id,
      angle: settings.defaults.angle,
      postExcerpt: postText,
      draft: clean,
      submitted: false,
    });
  }
  setState(entry, 'done');
}

/** Adds an icon button to every open comment box, DM composer and invite note. */
export function installComposerButtons(
  adapter: PlatformAdapter,
  isEnabled: () => boolean,
): () => void {
  const entries = new Map<HTMLElement, Entry>();
  let stopped = false;

  const remove = (editor: HTMLElement) => {
    const entry = entries.get(editor);
    if (!entry) return;
    try {
      entry.port?.postMessage({ type: 'cancel' });
      entry.port?.disconnect();
    } catch {
      // ignore
    }
    entry.button.remove();
    entries.delete(editor);
  };

  const mount = (editor: HTMLElement, mode: Mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.setAttribute(
      'aria-label',
      mode === 'dm'
        ? 'SocialMe: draft a message reply'
        : mode === 'note'
          ? 'SocialMe: write this connection note'
          : 'SocialMe: write this comment',
    );
    styleButton(button);

    const entry: Entry = { editor, button, busy: false, port: null, text: '', mode };
    setState(entry, 'idle');

    button.addEventListener('mousedown', (event) => {
      // Keep focus in the editor: some comment boxes collapse on blur.
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener(
      'pointerdown',
      (event) => {
        // X re-renders its toolbar on pointer events; keep ours out of that path.
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(124,108,255,0.12)';
      button.style.color = '#5b4bdb';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '';
      button.style.color = '';
    });

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (entry.busy) {
        entry.port?.postMessage({ type: 'cancel' });
        return;
      }

      const choice = await openToneMenu(entry);
      if (!choice) return;
      const tone = choice.tone === 'Default' ? undefined : choice.tone;

      const settings = await getSettings();
      const channel = CHANNEL_OF[mode];

      let context: { author: string; text: string; meta?: string } | null = null;
      let replyingTo: { author?: string; text: string } | undefined;
      let recipient: { name?: string; headline?: string } | undefined;
      let excerpt = '';

      if (mode === 'dm') {
        const thread = adapter.readConversation(editor, contextLimit(settings.dmContext));
        context = thread ? { author: thread.author, text: thread.text } : null;
        if (!context) {
          setState(entry, 'error', 'Could not read this conversation');
          return;
        }
        excerpt = thread?.text ?? '';
      } else if (mode === 'note') {
        recipient = adapter.readNoteRecipient?.(editor) ?? undefined;
        excerpt = [recipient?.name, recipient?.headline].filter(Boolean).join(' · ');
      } else {
        const postEl = adapter.postForEditor(editor);
        const post = postEl ? adapter.readPost(postEl) : null;
        context = post
          ? {
              author: post.author,
              text: post.text,
              meta: post.meta,
            }
          : null;
        if (!context || (!context.text && !context.author)) {
          setState(entry, 'error', 'Could not read the post above this box');
          return;
        }
        // A reply box under a comment answers that person, not the post author.
        replyingTo = readCommentBeingRepliedTo(editor) ?? undefined;
        excerpt = replyingTo?.text ?? context.text;
      }

      const persona = resolvePersona(settings, adapter.id);

      if (!(editor instanceof HTMLTextAreaElement)) clearEditor(editor);
      entry.text = '';
      entry.busy = true;
      setState(entry, 'busy');

      const request: GenerateRequest = {
        platform: adapter.id,
        channel,
        post: context
          ? { author: context.author, text: context.text, meta: context.meta }
          : undefined,
        replyingTo,
        recipient,
        personaId: persona.id,
        angle: settings.defaults.angle,
        tone: tone ?? (settings.defaults.tone || undefined),
        length: persona.length ?? settings.defaults.replyLength,
        language: persona.language,
        extra:
          [settings.defaults.extraInstruction, choice.instruction].filter(Boolean).join('; ') ||
          undefined,
      };

      let port: any;
      try {
        port = browser.runtime.connect({ name: 'socialme:gen' });
      } catch {
        setState(entry, 'error', 'Extension background unavailable — reload the page');
        entry.busy = false;
        return;
      }
      entry.port = port;

      // Textarea composers (X chat, invite notes) are framework-owned: stream into
      // our own buffer and write once, so a single input event carries the draft.
      const buffered = editor instanceof HTMLTextAreaElement;

      port.onMessage.addListener((message: PortMessage) => {
        if (message.type === 'delta') {
          entry.text += message.text;
          if (!buffered) appendDelta(editor, message.text);
        } else if (message.type === 'done') {
          void finish(entry, message.text, settings, adapter, excerpt);
        } else if (message.type === 'error') {
          entry.busy = false;
          entry.port = null;
          if (message.code === 'aborted') setState(entry, 'idle');
          else setState(entry, 'error', message.error);
        }
      });

      port.onDisconnect.addListener(() => {
        if (entry.busy && entry.text) void finish(entry, entry.text, settings, adapter, excerpt);
      });

      port.postMessage({ type: 'start', request });
    });

    entries.set(editor, entry);
    if (!insertButton(entry)) entries.delete(editor);
  };

  const scan = () => {
    if (stopped || !isEnabled()) return;
    let commentEditors: HTMLElement[] = [];
    let messageEditors: HTMLElement[] = [];
    let noteEditors: HTMLElement[] = [];
    try {
      commentEditors = adapter.findOpenEditors();
    } catch {
      commentEditors = [];
    }
    try {
      messageEditors = adapter.findMessageComposers();
    } catch {
      messageEditors = [];
    }
    try {
      noteEditors = adapter.findNoteEditors?.() ?? [];
    } catch {
      noteEditors = [];
    }

    for (const editor of commentEditors) if (!entries.has(editor)) mount(editor, 'comment');
    for (const editor of messageEditors) if (!entries.has(editor)) mount(editor, 'dm');
    for (const editor of noteEditors) if (!entries.has(editor)) mount(editor, 'note');

    for (const [editor, entry] of entries) {
      if (!editor.isConnected) {
        remove(editor);
        continue;
      }
      // The platform may re-render the toolbar; put the icon back.
      if (!entry.button.isConnected) insertButton(entry);
    }
  };

  const interval = window.setInterval(scan, 1200);
  const onFocus = () => window.setTimeout(scan, 60);
  window.addEventListener('focusin', onFocus, true);
  window.addEventListener('click', onFocus, true);

  // React-based timelines re-render often; put the icon back as soon as it goes.
  let pending = 0;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      scan();
    }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scan();

  return () => {
    stopped = true;
    observer.disconnect();
    if (pending) window.clearTimeout(pending);
    window.clearInterval(interval);
    window.removeEventListener('focusin', onFocus, true);
    window.removeEventListener('click', onFocus, true);
    for (const editor of [...entries.keys()]) remove(editor);
  };
}
