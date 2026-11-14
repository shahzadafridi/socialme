import { dropNested, isVisible, waitFor } from '@/lib/shared/dom';
import { humanClick } from '@/lib/integrations/insert';
import { findMessageComposers, readThread } from '@/lib/integrations/messaging';
import { normalizeText, type PlatformAdapter } from '@/lib/integrations/adapter';

/**
 * LinkedIn replaced its entire class vocabulary with hashed CSS-module names and
 * dropped data-urn, so this adapter is built on ARIA labels and document structure:
 *
 *   post      -> [role="listitem"] that owns a control labelled "Comment"
 *   action row-> nearest ancestor holding the Like/Comment/Repost controls
 *   body text -> visible text blocks above the action row, in DOM order
 */
const ACTION_LABEL = /^(like|comment|repost|send|reply|share)\b/i;

function controls(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(
    (node) => isVisible(node) && Boolean(node.getAttribute('aria-label') || node.textContent?.trim()),
  );
}

function controlNamed(root: ParentNode, name: RegExp): HTMLElement | null {
  return (
    controls(root).find((node) => name.test((node.getAttribute('aria-label') ?? '').trim())) ?? null
  );
}

function isCommentControl(node: HTMLElement): boolean {
  const label = (node.getAttribute('aria-label') ?? '').trim();
  if (/^comment$/i.test(label)) return true;
  // Fallback for localised builds: a short button whose text is a number next to a reply icon.
  const text = (node.textContent ?? '').trim();
  return /^comment/i.test(text) && text.length < 24;
}

function postRoots(): HTMLElement[] {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[role="listitem"]')).filter(
    isVisible,
  );
  return items.filter((item) => Array.from(item.querySelectorAll<HTMLElement>('button')).some(isCommentControl));
}

function actionRow(post: HTMLElement): HTMLElement | null {
  const comment =
    Array.from(post.querySelectorAll<HTMLElement>('button')).find(isCommentControl) ?? null;
  if (!comment) return null;

  let node: HTMLElement | null = comment.parentElement;
  for (let depth = 0; node && depth < 6; depth += 1) {
    const labels = Array.from(node.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .map((btn) => (btn.getAttribute('aria-label') ?? '').trim())
      .filter(Boolean);
    if (labels.filter((label) => ACTION_LABEL.test(label)).length >= 2) return node;
    node = node.parentElement;
  }
  return comment.parentElement;
}

function rowTop(post: HTMLElement): number {
  const row = actionRow(post);
  if (!row) return Number.POSITIVE_INFINITY;
  const rect = row.getBoundingClientRect();
  return rect.height > 0 ? rect.top : Number.POSITIVE_INFINITY;
}

/** Visible text blocks above the action row, de-duplicated and in reading order. */
function bodyBlocks(post: HTMLElement): HTMLElement[] {
  const limit = rowTop(post);
  const candidates = Array.from(post.querySelectorAll<HTMLElement>('span, p'))
    .filter((node) => {
      const text = normalizeText(node.innerText);
      if (text.length < 40 || text.length > 4000) return false;
      if (!isVisible(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.top < limit;
    });

  const leaves = candidates.filter(
    (node) => !candidates.some((other) => other !== node && node.contains(other)),
  );

  leaves.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

  const seen = new Set<string>();
  return leaves.filter((node) => {
    const text = normalizeText(node.innerText);
    if (seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

function readBodyText(post: HTMLElement): string {
  const blocks = bodyBlocks(post).map((node) => normalizeText(node.innerText));
  return blocks.join('\n').slice(0, 4000);
}

function readAuthor(post: HTMLElement): { name: string; headline: string } {
  const limit = rowTop(post);
  const links = Array.from(
    post.querySelectorAll<HTMLElement>('a[href*="/in/"], a[href*="/company/"], a[href*="/showcase/"]'),
  ).filter((link) => {
    const rect = link.getBoundingClientRect();
    return isVisible(link) && rect.top < limit;
  });

  for (const link of links) {
    const lines = (link.innerText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const name = lines[0] ?? '';
    if (name && name.length < 80) {
      return { name, headline: lines[1] ?? '' };
    }
  }
  return { name: '', headline: '' };
}

function readCounts(post: HTMLElement): string {
  const labels = Array.from(post.querySelectorAll<HTMLElement>('button, [role="button"]'))
    .map((btn) => (btn.textContent ?? '').trim())
    .filter((text) => /^\d[\d,.]*[KMB]?$/.test(text));
  return labels.slice(0, 3).join(' · ');
}

function editorCandidates(post: HTMLElement): HTMLElement[] {
  return Array.from(
    post.querySelectorAll<HTMLElement>('[contenteditable="true"], textarea, [role="textbox"]'),
  ).filter((node) => isVisible(node) && node.getBoundingClientRect().height > 0);
}

export const linkedinAdapter: PlatformAdapter = {
  id: 'linkedin',

  isSupportedPage() {
    return /(^|\.)linkedin\.com$/.test(location.hostname);
  },

  findPosts() {
    const structural = postRoots();

    // Older / alternate layouts still expose these; keep them as a fast path.
    const legacy = Array.from(
      document.querySelectorAll<HTMLElement>(
        'div.feed-shared-update-v2, [data-urn^="urn:li:activity"], [data-urn^="urn:li:share"]',
      ),
    ).filter((el) => isVisible(el));

    const all = [...structural, ...legacy];
    return dropNested(all).filter((post) => Boolean(readAuthor(post).name || readBodyText(post)));
  },

  readPost(el) {
    const text = readBodyText(el);
    const { name, headline } = readAuthor(el);
    if (!text && !name) return null;

    const urn =
      el.getAttribute('data-urn') ??
      el.getAttribute('data-id') ??
      el.querySelector('[data-urn]')?.getAttribute('data-urn') ??
      '';
    const url = urn ? `https://www.linkedin.com/feed/update/${urn}/` : location.href;

    return {
      platform: 'linkedin',
      url,
      author: name || 'LinkedIn member',
      authorHeadline: headline,
      text,
      meta: readCounts(el),
    };
  },

  actionAnchor(post) {
    return actionRow(post);
  },

  async openReplyEditor(post) {
    const existing = editorCandidates(post)[0];
    if (existing) return existing;

    const comment = Array.from(post.querySelectorAll<HTMLElement>('button')).find(isCommentControl);
    if (!comment) return null;
    humanClick(comment);

    return waitFor(() => editorCandidates(post)[0] ?? null, { timeout: 6000 });
  },

  submitButton(editor) {
    let node: HTMLElement | null = editor.parentElement;
    for (let depth = 0; node && depth < 8; depth += 1) {
      const buttons = Array.from(node.querySelectorAll<HTMLElement>('button, [role="button"]'));
      for (const btn of buttons) {
        if (!isVisible(btn)) continue;
        if (btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled')) continue;
        const label = (btn.getAttribute('aria-label') ?? '').trim();
        const text = (btn.innerText ?? '').trim();
        if (/^(comment|post|reply)$/i.test(label) || /^(comment|post|reply)$/i.test(text)) {
          return btn;
        }
      }
      node = node.parentElement;
    }
    return null;
  },

  async openComposer() {
    const trigger =
      document.querySelector<HTMLElement>('button.share-box-feed-entry__trigger') ??
      document.querySelector<HTMLElement>('[aria-label*="Start a post"]') ??
      Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button')).find((node) =>
        /start a post|create a post/i.test(
          `${node.getAttribute('aria-label') ?? ''} ${node.innerText ?? ''}`,
        ),
      ) ??
      null;
    if (!trigger) return null;
    humanClick(trigger);

    return waitFor(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] [contenteditable="true"], [role="dialog"] textarea',
          ),
        ).find(isVisible) ?? null,
      { timeout: 8000 },
    );
  },

  submitPostButton(editor) {
    const dialog = editor.closest('[role="dialog"]') ?? document;
    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button, [role="button"]'));
    return (
      buttons.find((btn) => {
        if (!isVisible(btn)) return false;
        if (btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled')) return false;
        const label = (btn.getAttribute('aria-label') ?? '').trim();
        return /^(post|share)$/i.test(label) || /^post$/i.test((btn.innerText ?? '').trim());
      }) ?? null
    );
  },

  hasContent(editor) {
    if (!editor.isConnected) return false;
    const value =
      editor instanceof HTMLTextAreaElement ? editor.value : (editor.innerText ?? '');
    return normalizeText(value).length > 0;
  },

  findOpenEditors() {
    const editors = new Set<HTMLElement>();

    // An editor inside a post is a comment box, not the share composer.
    for (const item of Array.from(document.querySelectorAll<HTMLElement>('[role="listitem"]'))) {
      for (const editor of editorCandidates(item)) editors.add(editor);
    }

    // Editors that expose a comment hint.
    for (const node of Array.from(
      document.querySelectorAll<HTMLElement>('[contenteditable="true"], textarea'),
    )) {
      if (!isVisible(node)) continue;
      if (node.closest('[role="dialog"]')) continue;
      const hint = `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('placeholder') ?? ''} ${node.getAttribute('data-placeholder') ?? ''}`;
      if (/comment|reply/i.test(hint)) editors.add(node);
    }

    return Array.from(editors);
  },

  findMessageComposers() {
    return findMessageComposers();
  },

  readConversation(editor, maxMessages) {
    return readThread(editor, maxMessages);
  },

  postForEditor(editor) {
    return editor.closest<HTMLElement>('[role="listitem"]');
  },
};
