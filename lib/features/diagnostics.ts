import { browser } from 'wxt/browser';
import type { PlatformAdapter } from '@/lib/integrations/adapter';

export const DIAGNOSTICS_KEY = 'socialme.diagnostics.v1';

/** One entry per tab, so several feeds/inboxes cannot overwrite each other. */
const TAB_KEY = Math.random().toString(36).slice(2, 8);

export interface Diagnostics {
  platform: string;
  url: string;
  ts: number;
  build: string;
  boot?: string[];
  error?: string;
  counts: {
    posts: number;
    anchors: number;
    editors: number;
    commentButtons: number;
    messageComposers?: number;
  };
  probes: Record<string, number>;
  extra?: Record<string, unknown>;
  samples: {
    post: string[];
    actionButton: string[];
    editor: string[];
    actionLabels: string[];
  };
}

function describeChain(el: Element | null, depth = 6): string[] {
  const out: string[] = [];
  let node: Element | null = el;
  for (let i = 0; node && i < depth; i += 1) {
    const classes = Array.from(node.classList).slice(0, 4).join('.');
    const attrs = ['data-urn', 'data-id', 'data-testid', 'role']
      .map((name) => {
        const value = node?.getAttribute(name);
        return value ? `[${name}=${value.slice(0, 28)}]` : '';
      })
      .join('');
    out.push(`${node.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${attrs}`);
    node = node.parentElement;
  }
  return out;
}

function actionButtonsOnPage(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(
    (btn) => {
      const hay = `${btn.getAttribute('aria-label') ?? ''} ${btn.textContent ?? ''}`.trim();
      return /^(like|comment|repost|send|reply)\b/i.test(hay);
    },
  );
}

/**
 * Records what the adapters actually see on the page, including the real class
 * chain of the elements they need. When a platform redesigns, this is the evidence.
 */
export async function collectDiagnostics(
  adapter: PlatformAdapter,
  boot: string[] = [],
): Promise<void> {
  let payload: Diagnostics | null = null;

  try {
    let posts: HTMLElement[] = [];
    let anchors: HTMLElement[] = [];
    let editors: HTMLElement[] = [];
    let messageEditors: HTMLElement[] = [];
    let failure = '';

    try {
      posts = adapter.findPosts();
      anchors = posts.filter((post) => {
        try {
          return Boolean(adapter.actionAnchor(post));
        } catch {
          return false;
        }
      });
      editors = adapter.findOpenEditors();
      try {
        messageEditors = adapter.findMessageComposers();
      } catch {
        messageEditors = [];
      }
    } catch (error) {
      failure = (error as Error)?.message ?? String(error);
    }

    const buttons = actionButtonsOnPage();
    const first = buttons[0] ?? null;
    const item = first?.closest('[role="listitem"]') ?? null;

    const textBlocks = item
      ? Array.from(item.querySelectorAll<HTMLElement>('[dir="auto"], span, p'))
          .map((node) => (node.innerText ?? '').trim())
          .filter((text) => text.length > 60)
          .sort((a, b) => b.length - a.length)
      : [];

    const authorLink = item?.querySelector<HTMLElement>('a[href*="/in/"], a[href*="/company/"]');
    const editable = Array.from(
      document.querySelectorAll<HTMLElement>('[contenteditable="true"], textarea'),
    ).find((node) => node.getBoundingClientRect().height > 0);

    payload = {
      platform: adapter.id,
      url: location.href.slice(0, 160),
      ts: Date.now(),
      build: browser.runtime.getManifest().version,
      boot,
      error: failure || undefined,
      counts: {
        posts: posts.length,
        anchors: anchors.length,
        editors: editors.length,
        commentButtons: buttons.length,
        messageComposers: messageEditors.length,
      },
      probes: {
        feedSharedUpdate: document.querySelectorAll('div.feed-shared-update-v2').length,
        dataUrn: document.querySelectorAll('[data-urn]').length,
        dataTestId: document.querySelectorAll('[data-testid]').length,
        updateComponentsText: document.querySelectorAll('[class*="update-components-text"]').length,
        socialAction: document.querySelectorAll('[class*="social-action"]').length,
        commentButtonClass: document.querySelectorAll('[class*="comment-button"]').length,
        articles: document.querySelectorAll('article').length,
        quill: document.querySelectorAll('.ql-editor').length,
        listItems: document.querySelectorAll('[role="listitem"]').length,
        lists: document.querySelectorAll('[role="list"]').length,
        contentEditables: document.querySelectorAll('[contenteditable="true"]').length,
        textboxes: document.querySelectorAll('[role="textbox"]').length,
        textareas: document.querySelectorAll('textarea').length,
        dirAuto: document.querySelectorAll('[dir="auto"]').length,
        profileLinks: document.querySelectorAll('a[href*="/in/"]').length,
        ariaLabeled: document.querySelectorAll('[aria-label]').length,
        quickButtons: document.querySelectorAll('.socialme-quick').length,
        quickRect: (() => {
          const button = document.querySelector<HTMLElement>('.socialme-quick');
          if (!button) return 0;
          const rect = button.getBoundingClientRect();
          return Math.round(rect.width * 1000 + rect.height);
        })(),
      },
      extra: {
        itemTag: item ? item.tagName.toLowerCase() : '',
        itemClasses: item ? Array.from(item.classList).slice(0, 6).join('.') : '',
        textSample: (textBlocks[0] ?? '').slice(0, 160),
        textBlockCount: textBlocks.length,
        authorSample: (authorLink?.innerText ?? '').trim().slice(0, 60),
        editableChain: editable ? describeChain(editable, 4) : [],
        editableLabel: editable?.getAttribute('aria-label') ?? '',
        dmLayout: (() => {
          const editor = messageEditors[0];
          if (!editor) return '';
          const rows: string[] = [];
          let node: HTMLElement | null = editor.parentElement;
          for (let i = 0; node && i < 12; i += 1) {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            rows.push(
              `${i}:${node.tagName.toLowerCase()}.${Array.from(node.classList).slice(0, 2).join('.')}` +
                ` oy=${style.overflowY} sh=${node.scrollHeight} ch=${node.clientHeight}` +
                ` h=${Math.round(rect.height)} txt=${(node.innerText ?? '').length}`,
            );
            node = node.parentElement;
          }
          return rows.join(' | ');
        })(),
        dmTranscript: (() => {
          const editor = messageEditors[0];
          if (!editor) return '';
          try {
            const thread = adapter.readConversation(editor);
            return thread ? `${thread.author} || ${thread.text.slice(-260)}` : 'none';
          } catch (error) {
            return `error: ${(error as Error)?.message ?? String(error)}`;
          }
        })(),
        quickInfo: (() => {
          const button = document.querySelector<HTMLElement>('.socialme-quick');
          if (!button) return '';
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return `${Math.round(rect.width)}x${Math.round(rect.height)} @${Math.round(rect.left)},${Math.round(rect.top)} display=${style.display} opacity=${style.opacity} parent=${button.parentElement?.tagName ?? '?'} mode=${button.getAttribute('aria-label') ?? ''}`;
        })(),
        messageEditor: messageEditors[0] ? describeChain(messageEditors[0], 5) : [],
        messageEditorLabel: messageEditors[0]
          ? `${messageEditors[0].tagName.toLowerCase()} | ${messageEditors[0].getAttribute('aria-label') ?? ''} | ${messageEditors[0].getAttribute('placeholder') ?? ''} | h=${Math.round(messageEditors[0].getBoundingClientRect().height)}`
          : '',
        editableTag: editable ? editable.tagName.toLowerCase() : '',
        labels: buttons.slice(0, 8).map((btn) => btn.getAttribute('aria-label') ?? ''),
      },
      samples: {
        post: item
          ? describeChain(item, 5)
          : posts[0]
            ? describeChain(posts[0], 3)
            : [],
        actionButton: first ? describeChain(first, 7) : [],
        editor: editors[0] ? describeChain(editors[0], 5) : [],
        actionLabels: buttons.slice(0, 8).map((btn) => {
          const label = btn.getAttribute('aria-label') ?? '';
          const text = (btn.textContent ?? '').trim().slice(0, 18);
          return `${label} | ${text}`;
        }),
      },
    };
  } catch (error) {
    payload = {
      platform: adapter.id,
      url: location.href.slice(0, 160),
      ts: Date.now(),
      build: browser.runtime.getManifest().version,
      boot,
      counts: { posts: -1, anchors: -1, editors: -1, commentButtons: -1 },
      probes: {},
      samples: { post: [], actionButton: [], editor: [], actionLabels: [] },
      error: (error as Error)?.message ?? String(error),
    };
  }

  try {
    // Keyed per tab so several open networks do not overwrite each other.
    const stored = await browser.storage.local.get(DIAGNOSTICS_KEY);
    const map = (stored[DIAGNOSTICS_KEY] as Record<string, Diagnostics> | undefined) ?? {};
    const key = `${adapter.id}:${location.pathname.slice(0, 60)}:${TAB_KEY}`;
    map[key] = payload;

    // keep the map small
    const entries = Object.entries(map).sort((a, b) => (b[1].ts ?? 0) - (a[1].ts ?? 0));
    const trimmed = Object.fromEntries(entries.slice(0, 8));
    await browser.storage.local.set({ [DIAGNOSTICS_KEY]: trimmed });
  } catch {
    // diagnostics must never break the page
  }
}

export async function readDiagnostics(): Promise<Diagnostics | null> {
  const result = await browser.storage.local.get(DIAGNOSTICS_KEY);
  const value = result[DIAGNOSTICS_KEY];
  if (!value) return null;
  if (typeof value === 'object' && !('platform' in (value as object))) {
    const entries = Object.values(value as Record<string, Diagnostics>);
    entries.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    return entries[0] ?? null;
  }
  return value as Diagnostics;
}
