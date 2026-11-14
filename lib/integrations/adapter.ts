import type { PlatformId, PostContext } from '@/lib/core/types';

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
  /** Blue "Post"/"Comment" button for the given editor. */
  submitButton(editor: HTMLElement): HTMLElement | null;
  /** Open the global composer (new post). */
  openComposer(): Promise<HTMLElement | null>;
  /** Submit button for the global composer. */
  submitPostButton(editor: HTMLElement): HTMLElement | null;
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
