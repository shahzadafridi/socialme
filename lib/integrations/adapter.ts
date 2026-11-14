import type { PlatformId, PostContext, RecipientContext, ReplyTarget } from '@/lib/core/types';

export interface PlatformAdapter {
  id: PlatformId;
  isSupportedPage(): boolean;
  /** All candidate post containers currently in the DOM. */
  findPosts(): HTMLElement[];
  /** Best-effort read of a post's author, text and metrics. */
  readPost(el: HTMLElement): PostContext | null;
  /** Element where the inline "SocialMe" button should be appended. */
  actionAnchor(post: HTMLElement): HTMLElement | null;
  /** Open (or reuse) the reply editor for a post. */
  openReplyEditor(post: HTMLElement): Promise<HTMLElement | null>;
  /** Blue "Comment"/"Reply"/"Send" button for the given editor. */
  submitButton(editor: HTMLElement): HTMLElement | null;
  /** Whether the editor still has content (used to detect successful submit). */
  hasContent(editor: HTMLElement): boolean;
  /** Comment/reply editors currently open on the page. */
  findOpenEditors(): HTMLElement[];
  /** The post a given editor belongs to, for in-place generation. */
  postForEditor(editor: HTMLElement): HTMLElement | null;
  /** Open direct-message composers (inbox / chat overlay). */
  findMessageComposers(): HTMLElement[];
  /** Recent messages above a DM composer (maxMessages = how many to include). */
  readConversation(
    editor: HTMLElement,
    maxMessages?: number,
  ): { author: string; text: string } | null;
  /** Connection-request note boxes, where the platform has them (LinkedIn). */
  findNoteEditors?(): HTMLElement[];
  /** Who a connection note is addressed to, from the dialog or profile around it. */
  readNoteRecipient?(editor: HTMLElement): RecipientContext | null;
}

export type { PostContext };

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function firstText(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    const text = normalizeText(el?.innerText);
    if (text) return text;
  }
  return '';
}

const REPLY_HINT = /\breply\b/i;
const AUTHOR_LINK = 'a[href*="/in/"], a[href*="/company/"]';

function authorNameNear(node: HTMLElement): string {
  const link = Array.from(node.querySelectorAll<HTMLElement>(AUTHOR_LINK)).find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!link) return '';
  const name = (link.innerText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return name && name.length < 80 ? name : '';
}

/** The closest readable text block that sits above the editor inside `node`. */
function textAbove(node: HTMLElement, editor: HTMLElement): string {
  const editorTop = editor.getBoundingClientRect().top;
  const candidates = Array.from(node.querySelectorAll<HTMLElement>('span, p, div'))
    .filter((candidate) => {
      if (candidate === editor || candidate.contains(editor) || editor.contains(candidate)) {
        return false;
      }
      const rect = candidate.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      if (rect.bottom > editorTop + 4) return false;
      // Skip wrappers: only take blocks whose children are not also text blocks.
      const children = Array.from(candidate.children) as HTMLElement[];
      if (children.some((child) => normalizeText(child.innerText).length >= 20)) return false;
      return true;
    })
    .map((candidate) => ({
      text: normalizeText(candidate.innerText),
      bottom: candidate.getBoundingClientRect().bottom,
    }))
    .filter((entry) => entry.text.length >= 20 && entry.text.length <= 1400);

  candidates.sort((a, b) => b.bottom - a.bottom);
  return candidates[0]?.text ?? '';
}

/**
 * When the editor is a nested reply box ("Reply"), the comment it answers is the
 * closest block above it — not the post the whole thread belongs to. Returns null
 * for a top-level comment box, where the post itself is the subject.
 */
export function readCommentBeingRepliedTo(editor: HTMLElement): ReplyTarget | null {
  const label = `${editor.getAttribute('aria-label') ?? ''} ${editor.getAttribute('placeholder') ?? ''}`;
  if (!REPLY_HINT.test(label)) return null;

  const boundary = editor.closest<HTMLElement>(
    'article, [role="article"], [role="listitem"]',
  );

  let node: HTMLElement | null = editor.parentElement;
  for (let depth = 0; node && depth < 14; depth += 1) {
    if (boundary && node === boundary) break;
    const author = authorNameNear(node);
    const text = textAbove(node, editor);
    if (text) return { author: author || undefined, text };
    node = node.parentElement;
  }
  return null;
}
