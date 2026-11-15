import { browser } from 'wxt/browser';
import {
  editorText,
  insertIntoEditor,
  looksInserted,
} from '@/lib/integrations/insert';
import { contextLimit } from '@/lib/integrations/messaging';
import { readCommentBeingRepliedTo, type PlatformAdapter } from '@/lib/integrations/adapter';
import { typeLikeHuman } from '@/lib/features/safety/humanize';
import { NOTE_LIMIT } from '@/lib/core/constants';
import { addHistory, getSettings, resolvePersona, saveLastDraft } from '@/lib/data/storage';
import { resolveTone } from '@/lib/core/defaults';
import type { Channel, GenerateRequest, PortMessage, Settings } from '@/lib/core/types';
import type { Mode } from '@/lib/ui/composer/types';
import { type Entry, setState, styleButton } from '@/lib/ui/composer/button';
import { insertButton, isUsableButton, needsReplacing } from '@/lib/ui/composer/placement';
import { openToneMenu } from '@/lib/ui/composer/menu';
import { offerUndo, reviewReplacement } from '@/lib/ui/composer/review';
import { trackManualDraft } from '@/lib/features/safety/submissions';

const BUTTON_CLASS = 'socialme-quick';

const CHANNEL_OF: Record<Mode, Channel> = {
  comment: 'comment',
  dm: 'dm',
  note: 'note',
};

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

export async function applyComposerDraft(
  entry: Entry,
  text: string,
  settings: Settings,
  adapter: PlatformAdapter,
  postText: string,
  previous: string,
  personaId: string,
  signal: AbortSignal,
  isCurrentContext: () => boolean = () => true,
): Promise<void> {
  if (signal.aborted) return;
  const clean = entry.mode === 'note' ? fitNote(text.trim()) : text.trim();
  if (!clean) {
    setState(entry, 'error', 'The model returned nothing');
    return;
  }

  await saveLastDraft(clean);
  if (settings.historyEnabled) {
    await addHistory({
      platform: adapter.id,
      channel: CHANNEL_OF[entry.mode],
      personaId,
      angle: settings.defaults.angle,
      postExcerpt: postText,
      draft: clean,
      submitted: false,
    });
  }
  const target = entry.editor;
  if (!target.isConnected || signal.aborted) return;
  if (!isCurrentContext()) {
    setState(entry, 'error', 'The conversation changed. Generated reply saved locally; open SocialMe again.');
    return;
  }
  const current = editorText(target);
  if (current.trim() || current !== previous) {
    const replace = await reviewReplacement(entry.button, clean, signal);
    if (signal.aborted || !target.isConnected) return;
    if (!replace) { setState(entry, 'idle'); return; }
    if (editorText(target) !== current || !isCurrentContext()) {
      setState(entry, 'error', 'Your draft changed again. Kept your text; generated draft saved locally.');
      return;
    }
  }
  if (!looksInserted(target, clean)) {
    const typed = settings.safety.humanTyping
      ? await typeLikeHuman(target, clean, settings.safety.typingSpeed, signal)
      : await insertIntoEditor(target, clean);
    if (!typed) {
      setState(entry, 'error', 'The editor rejected the text');
      return;
    }
    // Frameworks sometimes replay their own empty state right after our write.
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!looksInserted(target, clean)) {
      setState(entry, 'error', 'The editor changed. Generated draft saved; review the box before retrying.');
      return;
    }
  }

  offerUndo(target, current, clean);
  trackManualDraft(target, adapter.id);
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
    entry.controller?.abort();
    try {
      entry.port?.postMessage({ type: 'cancel' });
      entry.port?.disconnect();
    } catch {
      // ignore
    }
    entry.button.remove();
    entries.delete(editor);
  };

  const place = (entry: Entry): boolean => {
    const ok = insertButton(entry);
    if (ok) entry.placedParent = entry.button.parentElement;
    return ok;
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
      // Neutral hover: a coloured badge made the icon read as a different
      // control next to Facebook's outline icons.
      button.style.background = 'rgba(0,0,0,0.06)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '';
    });

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (entry.busy) {
        entry.controller?.abort();
        entry.port?.disconnect();
        entry.port = null;
        entry.busy = false;
        setState(entry, 'idle');
        return;
      }

      const settings = await getSettings();
      const platformPersona = resolvePersona(settings, adapter.id);
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

      const sourceStillCurrent = () => {
        if (!editor.isConnected || !isEnabled()) return false;
        if (mode === 'dm') {
          const current = adapter.readConversation(editor, contextLimit(settings.dmContext));
          return current?.author === context?.author && current?.text === context?.text;
        }
        if (mode === 'note') {
          const current = adapter.readNoteRecipient?.(editor);
          return current?.name === recipient?.name && current?.headline === recipient?.headline;
        }
        const root = adapter.postForEditor(editor);
        const current = root ? adapter.readPost(root) : null;
        const reply = readCommentBeingRepliedTo(editor);
        return current?.author === context?.author && current?.text === context?.text
          && reply?.text === replyingTo?.text && reply?.author === replyingTo?.author;
      };
      const choice = await openToneMenu(entry, {
        personas: settings.personas,
        personaId: platformPersona.id,
        tone: resolveTone(settings, adapter.id),
        draft: editorText(editor),
        exampleContext: { platform: adapter.id, channel, source: replyingTo?.text || context?.text || [recipient?.name, recipient?.headline].filter(Boolean).join('\n') },
        context: mode === 'note'
          ? [recipient?.name, recipient?.headline].filter(Boolean).join('\n')
          : [context?.author, context?.text.slice(0, mode === 'dm' ? 3000 : 6000),
            replyingTo ? `Answering ${replyingTo.author || 'this comment'}: ${replyingTo.text.slice(0, 2000)}` : ''].filter(Boolean).join('\n\n'),
      });
      if (!choice || !editor.isConnected || !isEnabled()) return;
      if (!sourceStillCurrent()) {
        setState(entry, 'error', 'The conversation changed. Open SocialMe again for the new context.');
        return;
      }
      const tone = choice.tone === 'Default' ? undefined : choice.tone;
      const persona = resolvePersona(settings, adapter.id, choice.personaId);
      const previous = editorText(editor);
      const generationController = new AbortController();
      entry.controller = generationController;
      entry.text = '';
      entry.busy = true;
      setState(entry, 'busy');

      const request: GenerateRequest = {
        roughThought: choice.roughThought,
        platform: adapter.id,
        channel,
        post: context
          ? { author: context.author, text: context.text, meta: context.meta }
          : undefined,
        replyingTo,
        recipient,
        personaId: persona.id,
        angle: settings.defaults.angle,
        tone,
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

      let completed = false;
      const fail = (message: string) => {
        if (entry.port !== port) return;
        entry.port = null;
        entry.busy = false;
        port.disconnect();
        setState(entry, 'error', message);
      };

      port.onMessage.addListener((message: PortMessage) => {
        if (entry.port !== port || entry.controller?.signal.aborted) return;
        if (message.type === 'delta') {
          entry.text += message.text;
        } else if (message.type === 'done') {
          completed = true;
          port.disconnect();
          void applyComposerDraft(entry, message.text, settings, adapter, excerpt, previous, persona.id, generationController.signal, sourceStillCurrent)
            .catch((error) => { if (!generationController.signal.aborted) setState(entry, 'error', error.message); })
            .finally(() => {
              if (entry.port === port) { entry.busy = false; entry.port = null; }
            });
        } else if (message.type === 'error') {
          fail(message.error);
        }
      });

      port.onDisconnect.addListener(() => {
        if (!completed) fail('Generation interrupted. Your original draft is unchanged.');
      });

      port.postMessage({ type: 'start', request });
    });

    entries.set(editor, entry);
    if (!place(entry)) entries.delete(editor);
  };

  const scan = () => {
    if (stopped) return;
    if (!isEnabled()) {
      for (const editor of [...entries.keys()]) remove(editor);
      return;
    }
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
      // The platform may re-render the toolbar, or a row may hide the icon.
      // Put it back, and remount when the current spot is no longer usable.
      if (!entry.button.isConnected) {
        place(entry);
      } else if (
        !isUsableButton(entry.button) ||
        // A platform re-render can wrap the icon in another control's element,
        // or add icons after it. Re-place so it settles back in the row.
        needsReplacing(entry)
      ) {
        entry.button.remove();
        place(entry);
      }
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
