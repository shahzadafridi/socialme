import { dropNested, isVisible, waitFor } from '@/lib/shared/dom';
import { humanClick } from '@/lib/integrations/insert';
import { findMessageComposers, readThread } from '@/lib/integrations/messaging';
import { firstText, normalizeText, type PlatformAdapter } from '@/lib/integrations/adapter';

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

/**
 * The note attached to a connection request. LinkedIn caps it at 300 characters
 * and labels the box "Add a note", so either signal identifies it; comment boxes
 * inside the feed are excluded.
 */
function noteEditors(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'textarea, [contenteditable="true"], [role="textbox"]',
    ),
  ).filter((node) => {
    if (!isVisible(node)) return false;
    if (node.closest('[role="listitem"]')) return false;
    const hint = `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('placeholder') ?? ''} ${node.getAttribute('data-placeholder') ?? ''}`;
    const maxLength = node instanceof HTMLTextAreaElement ? node.maxLength : -1;
    return (
      /note|invitation/i.test(hint) ||
      (Boolean(node.closest('[role="dialog"]')) && maxLength === 300)
    );
  });
}

const GENERIC_INVITE_HEADING =
  /^(add a note|add a note to (your|the) invitation|invite|invitation|connect|grow your network|my network|sent invitations?|invitations?|people you may know)$/i;

function personFromInvite(scope: ParentNode): { name: string; headline: string } {
  const link = Array.from(scope.querySelectorAll<HTMLElement>('a[href*="/in/"]')).find((node) =>
    isVisible(node),
  );
  if (!link) return { name: '', headline: '' };

  const own = (link.innerText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  let name = own[0] ?? '';
  let headline = own[1] ?? '';

  // The headline usually sits next to the name link, not inside it.
  let node = link.parentElement;
  for (let depth = 0; !headline && node && depth < 3; depth += 1) {
    const lines = (node.innerText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!name && lines[0]) name = lines[0];
    headline =
      lines.find(
        (line) =>
          line !== name &&
          line.length > 8 &&
          line.length < 160 &&
          !/connect|invite|add a note/i.test(line),
      ) ?? '';
    node = node.parentElement;
  }

  return { name, headline };
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

  findNoteEditors() {
    return noteEditors();
  },

  readNoteRecipient(editor) {
    const dialog = editor.closest('[role="dialog"]');
    const scope: ParentNode = dialog ?? document;
    let { name, headline } = personFromInvite(scope);

    if (!name) {
      const value =
        editor instanceof HTMLTextAreaElement ? editor.value : (editor.innerText ?? '');
      const match = value.match(
        /^\s*(?:hi|hello|hey)[ ,]+([\p{L}][\p{L}.'-]*(?:\s+[\p{L}][\p{L}.'-]*){0,2})/iu,
      );
      if (match) name = match[1].trim();
    }

    if (!name && /^\/in\//.test(location.pathname)) {
      const main = document.querySelector('main') ?? document.body;
      name = normalizeText(main.querySelector<HTMLElement>('h1')?.innerText).slice(0, 80);
      if (!headline) {
        headline = firstText(main, [
          'h1 + div',
          '.text-body-medium',
          '[class*="text-body-medium"]',
          '[class*="pv-text-details__left-panel"]',
        ]).slice(0, 160);
      }
    }

    if (!name) {
      name =
        Array.from(scope.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'))
          .map((node) => normalizeText(node.innerText))
          .find(
            (text) =>
              text.length > 1 &&
              text.length < 60 &&
              !GENERIC_INVITE_HEADING.test(text) &&
              !/^(invite|add a note)\b/i.test(text),
          ) ?? '';
    }

    headline = headline.trim().slice(0, 160);
    return name || headline ? { name: name || undefined, headline: headline || undefined } : null;
  },

  postForEditor(editor) {
    return editor.closest<HTMLElement>('[role="listitem"]');
  },
};
