import { isVisible, dropNested, waitFor } from '@/lib/shared/dom';
import { humanClick } from '@/lib/integrations/insert';
import { findMessageComposers, readThread } from '@/lib/integrations/messaging';
import { normalizeText, type PlatformAdapter } from '@/lib/integrations/adapter';

function statusLink(el: HTMLElement): string {
  const anchor = el.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
  return anchor?.href ?? location.href;
}

function readMeta(el: HTMLElement): string {
  const parts: string[] = [];
  const reply = el.querySelector('[data-testid="reply"]')?.getAttribute('aria-label');
  const like = el.querySelector('[data-testid="like"], [data-testid="unlike"]')?.getAttribute('aria-label');
  const clean = (value: string | null | undefined) => {
    const match = (value ?? '').match(/^([\d.,]+[KMB]?)/i);
    return match ? match[1] : '';
  };
  const replies = clean(reply);
  const likes = clean(like);
  if (replies) parts.push(`${replies} replies`);
  if (likes) parts.push(`${likes} likes`);
  return parts.join(' · ');
}

const EDITOR_SELECTOR =
  '[data-testid^="tweetTextarea"][contenteditable="true"], div[contenteditable="true"][role="textbox"]';

function editorInNewScope(before: Set<Element>): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(
    (d) => !before.has(d),
  );
  const scopes: ParentNode[] = dialogs.length ? dialogs : [document];
  for (const scope of scopes) {
    const editor = Array.from(scope.querySelectorAll<HTMLElement>(EDITOR_SELECTOR)).find(isVisible);
    if (editor) return editor;
  }
  return null;
}

export const xAdapter: PlatformAdapter = {
  id: 'x',

  isSupportedPage() {
    return /(^|\.)(x|twitter)\.com$/.test(location.hostname);
  },

  findPosts() {
    const found = new Set<HTMLElement>();
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]'),
    )) {
      if (isVisible(el)) found.add(el);
    }
    // Fallback: any article that clearly holds a tweet body.
    for (const text of Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'),
    )) {
      const article = text.closest<HTMLElement>('article');
      if (article && isVisible(article)) found.add(article);
    }
    return dropNested(Array.from(found));
  },

  readPost(el) {
    const textEl = el.querySelector<HTMLElement>('[data-testid="tweetText"]');
    const text = normalizeText(textEl?.innerText);
    const userEl = el.querySelector<HTMLElement>('[data-testid="User-Name"]');
    const lines = (userEl?.innerText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const handle = lines.find((line) => line.startsWith('@')) ?? '';
    const author = lines.find((line) => !line.startsWith('@') && !/^[·\d]/.test(line)) ?? '';

    if (!text && !author) return null;

    return {
      platform: 'x',
      url: statusLink(el),
      author: author || handle || 'X user',
      authorHeadline: handle,
      text,
      meta: readMeta(el),
    };
  },

  actionAnchor(post) {
    return post.querySelector<HTMLElement>('[role="group"]');
  },

  async openReplyEditor(post) {
    const existing = Array.from(
      document.querySelectorAll<HTMLElement>(`[role="dialog"] ${EDITOR_SELECTOR}`),
    ).find(isVisible);
    if (existing) return existing;

    const replyBtn =
      post.querySelector<HTMLElement>('[data-testid="reply"]') ??
      post.querySelector<HTMLElement>('[aria-label*="Reply"]');
    if (!replyBtn) return null;

    const before = new Set(Array.from(document.querySelectorAll('[role="dialog"]')));
    humanClick(replyBtn);
    return waitFor(() => editorInNewScope(before), { timeout: 7000 });
  },

  submitButton(editor) {
    const dialog = editor.closest('[role="dialog"]');
    const scope: ParentNode = dialog ?? document;
    const buttons = Array.from(
      scope.querySelectorAll<HTMLElement>(
        '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]',
      ),
    );
    return buttons.find((b) => b.getAttribute('aria-disabled') !== 'true' && isVisible(b)) ?? null;
  },

  async openComposer() {
    const before = new Set(Array.from(document.querySelectorAll('[role="dialog"]')));
    const trigger =
      document.querySelector<HTMLElement>('[data-testid="SideNav_NewTweet_Button"]') ??
      document.querySelector<HTMLElement>('a[href="/compose/post"]') ??
      document.querySelector<HTMLElement>('[aria-label="Post"]');
    if (!trigger) return null;
    humanClick(trigger);
    return waitFor(() => editorInNewScope(before), { timeout: 7000 });
  },

  submitPostButton(editor) {
    return this.submitButton(editor);
  },

  hasContent(editor) {
    return editor.isConnected && normalizeText(editor.innerText).length > 0;
  },

  findOpenEditors() {
    // With a dialog open, only its composer matters; the page behind it is inert.
    const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
      (node) => node.querySelector(EDITOR_SELECTOR),
    );
    const scope: ParentNode = dialog ?? document;
    return Array.from(scope.querySelectorAll<HTMLElement>(EDITOR_SELECTOR)).filter((editor) => {
      if (!isVisible(editor)) return false;
      const owner = editor.closest('[role="dialog"]');
      // The new-post dialog has no post to reply to; the panel handles posting.
      if (owner) return Boolean(owner.querySelector('article[data-testid="tweet"]'));
      return Boolean(editor.hasAttribute('data-testid') || editor.closest('article'));
    });
  },

  findMessageComposers() {
    return findMessageComposers();
  },

  readConversation(editor, maxMessages) {
    return readThread(editor, maxMessages);
  },

  postForEditor(editor) {
    const dialog = editor.closest('[role="dialog"]');
    if (dialog) {
      const article = dialog.querySelector<HTMLElement>('article[data-testid="tweet"]');
      if (article) return article;
      return null;
    }
    const own = editor.closest<HTMLElement>('article[data-testid="tweet"]');
    if (own) return own;
    // Inline "Post your reply" box on a status page: the post is the one above it.
    return document.querySelector<HTMLElement>('article[data-testid="tweet"]');
  },
};
