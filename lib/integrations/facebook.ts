import { closestWithChildren, dropNested, findByText, isVisible, waitFor } from '@/lib/shared/dom';
import { humanClick } from '@/lib/integrations/insert';
import { findMessageComposers, readThread } from '@/lib/integrations/messaging';
import { normalizeText, type PlatformAdapter } from '@/lib/integrations/adapter';

function actionButton(post: HTMLElement, labels: RegExp): HTMLElement | null {
  const buttons = Array.from(post.querySelectorAll<HTMLElement>('[role="button"], button'));
  return (
    buttons.find((btn) => {
      const hay = `${btn.getAttribute('aria-label') ?? ''} ${btn.innerText ?? ''}`;
      return labels.test(hay) && isVisible(btn);
    }) ?? null
  );
}

function readAuthor(post: HTMLElement): { name: string; headline: string } {
  const heading =
    post.querySelector<HTMLElement>('h2 a span[dir="auto"], h3 a span[dir="auto"], h4 a span[dir="auto"]') ??
    post.querySelector<HTMLElement>('h2 a, h3 a, h4 a') ??
    post.querySelector<HTMLElement>('strong a span[dir="auto"]') ??
    post.querySelector<HTMLElement>('a[role="link"] strong span');
  const name = normalizeText(heading?.innerText);
  const headline = normalizeText(
    post.querySelector<HTMLElement>('[data-ad-rendering-role="profile_name"] + div')?.innerText,
  );
  return { name, headline };
}

function longestTextBlock(post: HTMLElement): string {
  const blocks = Array.from(post.querySelectorAll<HTMLElement>('div[dir="auto"], span[dir="auto"]'))
    .filter(isVisible)
    .map((node) => normalizeText(node.innerText))
    .filter((text) => text.length > 40);
  blocks.sort((a, b) => b.length - a.length);
  return blocks[0] ?? '';
}

function readCounts(post: HTMLElement): string {
  const like = post
    .querySelector('[aria-label*="reaction"], [aria-label*="Like"]')
    ?.getAttribute('aria-label');
  return like ?? '';
}

/** Nearest ancestor that owns both a Like and a Comment control. */
function postAncestor(from: HTMLElement): HTMLElement | null {
  let node = from.parentElement;
  for (let depth = 0; node && depth < 14; depth += 1) {
    const hasLike = Boolean(node.querySelector('[aria-label*="Like" i]'));
    const hasComment = Boolean(node.querySelector('[aria-label*="Comment" i]'));
    if (hasLike && hasComment) {
      const posts = node.querySelectorAll('[role="article"]').length;
      if (posts <= 1) return node;
      return null;
    }
    node = node.parentElement;
  }
  return null;
}

export const facebookAdapter: PlatformAdapter = {
  id: 'facebook',

  isSupportedPage() {
    return /(^|\.)facebook\.com$/.test(location.hostname);
  },

  findPosts() {
    const found = new Set<HTMLElement>();

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('div[role="article"]'))) {
      if (!isVisible(el)) continue;
      if (
        el.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]') ||
        (el.querySelector('[aria-label*="omment"], [aria-label*="ike"]') &&
          longestTextBlock(el).length > 80)
      ) {
        found.add(el);
      }
    }

    // Fallback: climb from the post message when the article wrapper changes.
    for (const message of Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-ad-preview="message"], [data-ad-comet-preview="message"]',
      ),
    )) {
      if (!isVisible(message)) continue;
      const article = message.closest<HTMLElement>('[role="article"]');
      const post = article ?? postAncestor(message);
      if (post) found.add(post);
    }

    return dropNested(Array.from(found));
  },

  readPost(el) {
    const messageEl = el.querySelector<HTMLElement>(
      '[data-ad-preview="message"], [data-ad-comet-preview="message"]',
    );
    const text = normalizeText(messageEl?.innerText) || longestTextBlock(el);
    const { name, headline } = readAuthor(el);
    if (!text && !name) return null;

    return {
      platform: 'facebook',
      url: location.href,
      author: name || 'Facebook user',
      authorHeadline: headline,
      text,
      meta: readCounts(el),
    };
  },

  actionAnchor(post) {
    const comment = actionButton(post, /comment|reply/i);
    if (comment) return closestWithChildren(comment, 3, 4);
    return null;
  },

  async openReplyEditor(post) {
    const existing = Array.from(
      post.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]'),
    ).find((editor) => {
      if (!isVisible(editor)) return false;
      const label = editor.getAttribute('aria-label') ?? '';
      return /comment|reply|write a comment/i.test(label);
    });
    if (existing) return existing;

    const comment = actionButton(post, /comment|reply/i);
    if (!comment) return null;
    humanClick(comment);

    return waitFor(
      () =>
        Array.from(
          post.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]'),
        ).find(isVisible) ?? null,
      { timeout: 6000 },
    );
  },

  submitButton(editor) {
    const form = editor.closest('form');
    const container = form ?? editor.parentElement?.parentElement?.parentElement?.parentElement ?? null;
    const scope: ParentNode = container ?? document;

    const buttons = Array.from(scope.querySelectorAll<HTMLElement>('[role="button"], button'));
    return (
      buttons.find((btn) => {
        const label = btn.getAttribute('aria-label') ?? '';
        const text = btn.innerText ?? '';
        const enabled = btn.getAttribute('aria-disabled') !== 'true';
        return enabled && isVisible(btn) && (/^comment$/i.test(label) || /comment|reply/i.test(text));
      }) ?? null
    );
  },

  async openComposer() {
    const trigger =
      findByText(
        document,
        /what'?s on your mind|create post|write something/i,
        'div[role="button"], button',
      ) ?? document.querySelector<HTMLElement>('[aria-label="Create post"]');
    if (!trigger) return null;
    humanClick(trigger);

    return waitFor(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] [contenteditable="true"][role="textbox"]',
          ),
        ).find(isVisible) ?? null,
      { timeout: 8000 },
    );
  },

  submitPostButton(editor) {
    const dialog = editor.closest('[role="dialog"]') ?? document;
    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('[role="button"], button'));
    return (
      buttons.find((btn) => {
        const label = btn.getAttribute('aria-label') ?? '';
        const enabled = btn.getAttribute('aria-disabled') !== 'true';
        return enabled && isVisible(btn) && /^post$/i.test(label);
      }) ?? null
    );
  },

  hasContent(editor) {
    return editor.isConnected && normalizeText(editor.innerText).length > 0;
  },

  findOpenEditors() {
    return Array.from(
      document.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]'),
    ).filter((editor) => {
      if (!isVisible(editor)) return false;
      if (editor.closest('[role="dialog"]')) return false;
      const label = editor.getAttribute('aria-label') ?? '';
      if (/comment|reply|write a comment/i.test(label)) return true;
      return Boolean(editor.closest('form') && editor.closest('[role="article"]'));
    });
  },

  findMessageComposers() {
    return findMessageComposers();
  },

  readConversation(editor, maxMessages) {
    return readThread(editor, maxMessages);
  },

  postForEditor(editor) {
    let node = editor.closest<HTMLElement>('[role="article"]');
    let outermost = node;
    while (node) {
      const parent = node.parentElement?.closest<HTMLElement>('[role="article"]');
      if (!parent) break;
      outermost = parent;
      node = parent;
    }
    return outermost;
  },
};
