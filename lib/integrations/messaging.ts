import { deepQueryAll, isVisible, rootOf } from '@/lib/shared/dom';
import { normalizeText } from '@/lib/integrations/adapter';

const MESSAGE_HINT = /message|messenger|chat|dm\b|reply to/i;

/** Chrome/UI noise that is never part of the conversation. */
const NOISE =
  /^(\d{1,2}:\d{2}\s?(am|pm)?|today|yesterday|active now|active \d+.*ago|last seen.*|status is .*|reachable|\d+(st|nd|rd|th) degree connection|view .* profile|edited|send|message|reply|attach.*|open .*|you are on the messaging overlay.*|\.\.\.|·)$/i;

/** Header/date separators that look like messages but are not. */
const CHROME_TEXT =
  /(sent the following messages|open the options list|is typing|start of (your )?conversation|message requests?)/i;

function labelOf(node: HTMLElement): string {
  return `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('placeholder') ?? ''} ${
    node.getAttribute('data-placeholder') ?? ''
  }`;
}

/**
 * Facebook's thread composer has no label of its own; its wrapper carries one
 * ("Thread composer"). Walk up a few levels looking for that hint.
 */
function inMessagingContainer(node: HTMLElement): boolean {
  let parent = node.parentElement;
  for (let depth = 0; parent && depth < 8; depth += 1) {
    const label = `${parent.getAttribute('aria-label') ?? ''} ${parent.getAttribute('role') ?? ''}`;
    if (/thread composer|conversation|messaging|chat/i.test(label)) return true;
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Message composers across the three networks. Comment boxes are excluded by
 * their "comment" label, so the same page can host both.
 */
export function findMessageComposers(): HTMLElement[] {
  return deepQueryAll<HTMLElement>('[contenteditable="true"], textarea').filter((node) => {
    if (!isVisible(node)) return false;
    const label = labelOf(node);
    if (/comment/i.test(label)) return false;
    if (!MESSAGE_HINT.test(label) && !inMessagingContainer(node)) return false;
    if (node.closest('[role="dialog"]')?.querySelector('article[data-testid="tweet"]')) {
      // X reply dialog, not a DM
      return false;
    }
    return true;
  });
}

/** The composer box: editor plus its send control. Never part of the transcript. */
function composerRoot(editor: HTMLElement): HTMLElement {
  let node: HTMLElement | null = editor.parentElement;
  for (let depth = 0; node && depth < 10; depth += 1) {
    const buttons = Array.from(node.querySelectorAll<HTMLElement>('button, [role="button"]'));
    const hasSend = buttons.some((button) =>
      /send/i.test(`${labelOf(button)} ${button.textContent ?? ''}`),
    );
    if (hasSend) return node;
    node = node.parentElement;
  }
  return editor.parentElement ?? editor;
}

interface Bubble {
  text: string;
  top: number;
  bottom: number;
  left: number;
  width: number;
}

function bubblesIn(scope: HTMLElement, editor: HTMLElement, composer: HTMLElement): Bubble[] {
  const composerBox = composer.getBoundingClientRect();
  const composerTop = composerBox.top;

  const nodes = Array.from(scope.querySelectorAll<HTMLElement>('span, p, div'))
    .filter((node) => {
      if (node === editor || node.contains(editor) || editor.contains(node)) return false;
      if (composer.contains(node)) return false;
      if (!isVisible(node)) return false;

      const text = normalizeText(node.innerText);
      if (text.length < 2 || text.length > 900) return false;
      if (NOISE.test(text)) return false;
      if (CHROME_TEXT.test(text)) return false;
      if (text === normalizeText(labelOf(node))) return false;

      // Leaf-ish text only; a wrapper containing everything is not a message.
      const children = Array.from(node.children) as HTMLElement[];
      if (children.some((child) => normalizeText(child.innerText).length >= 12)) return false;

      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      // Messages sit above the composer, in the same column (not the conversation list).
      const overlapsColumn = rect.right > composerBox.left - 10 && rect.left < composerBox.right + 10;
      return overlapsColumn && rect.bottom <= composerTop + 8;
    })
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        text: normalizeText(node.innerText),
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      };
    });

  const seen = new Set<string>();
  const unique = nodes.filter((bubble) => {
    if (seen.has(bubble.text)) return false;
    seen.add(bubble.text);
    return true;
  });
  unique.sort((a, b) => a.top - b.top);

  // Drop fragments that are contained in a neighbouring bubble ("anks" from "Thanks…").
  return unique.filter(
    (bubble) =>
      !unique.some(
        (other) =>
          other !== bubble &&
          other.text !== bubble.text &&
          other.text.length > bubble.text.length &&
          other.text.includes(bubble.text) &&
          Math.abs(other.top - bubble.top) < 40,
      ),
  );
}

const GENERIC_HEADINGS =
  /^(messaging|inbox|conversation list|linkedin|search|feed|notifications|my network)$/i;

function headingNearComposer(composer: HTMLElement): string {
  const composerRect = composer.getBoundingClientRect();
  let node: HTMLElement | null = composer.parentElement;

  for (let depth = 0; node && depth < 12; depth += 1) {
    const headings = Array.from(node.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'))
      .filter((heading) => {
        const rect = heading.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.top < composerRect.top &&
          Math.abs(rect.left + rect.width / 2 - (composerRect.left + composerRect.width / 2)) <
            Math.max(300, composerRect.width / 2)
        );
      })
      .map((heading) => normalizeText(heading.innerText))
      .filter(
        (text) => text.length > 1 && text.length < 60 && !NOISE.test(text) && !GENERIC_HEADINGS.test(text),
      );
    if (headings.length) return headings[0];
    node = node.parentElement;
  }
  return '';
}

function threadAuthor(scope: HTMLElement): string {
  const heading = Array.from(
    scope.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'),
  )
    .map((node) => normalizeText(node.innerText))
    .find(
      (text) =>
        text.length > 1 && text.length < 60 && !NOISE.test(text) && !GENERIC_HEADINGS.test(text),
    );
  if (heading) return heading;

  const first = Array.from(scope.querySelectorAll<HTMLElement>('span'))
    .map((node) => normalizeText(node.innerText))
    .find((text) => /^[\p{L}][\p{L}.'-]+( [\p{L}][\p{L}.'-]+){1,3}$/u.test(text));
  return first ?? '';
}

/**
 * Reads the messages above a composer, marked as mine or theirs by which side
 * of the column they sit on, plus who the conversation is with.
 */

export interface TranscriptBubble {
  text: string;
  top: number;
  left?: number;
  width?: number;
  /** true when the message is mine; inferred from position when omitted. */
  self?: boolean;
}

/** How many messages to send for a given preference. */
export function contextLimit(mode: 'last' | 'last3' | 'all'): number {
  return mode === 'last' ? 1 : mode === 'last3' ? 3 : 12;
}

/**
 * Pure transcript builder.
 *
 * - labels each message `me:` or `them:`
 * - drops fragments of neighbouring bubbles
 * - trims so the transcript ENDS on their last message (never on mine)
 * - keeps at most `limit` messages
 */
export function buildTranscript(
  bubbles: TranscriptBubble[],
  bounds: { left: number; width: number },
  author = '',
  limit = 12,
): string {
  if (!bubbles.length) return '';
  const midpoint = bounds.left + bounds.width / 2;

  const rows = bubbles
    .map((bubble) => ({
      ...bubble,
      self:
        bubble.self ??
        (bubble.left !== undefined && bubble.width !== undefined
          ? bubble.left + bubble.width / 2 > midpoint + bounds.width * 0.06
          : false),
    }))
    .filter(
      (row) =>
        !bubbles.some(
          (other) =>
            other !== row &&
            other.text.length > row.text.length &&
            other.text.includes(row.text) &&
            Math.abs(other.top - row.top) < 40,
        ),
    )
    .sort((a, b) => a.top - b.top);

  // Anchor on their most recent message.
  const lastTheirs = rows.map((row) => row.self).lastIndexOf(false);
  const scoped = lastTheirs >= 0 ? rows.slice(0, lastTheirs + 1) : rows;

  return scoped
    .slice(-Math.max(1, limit))
    .map((row) => `${row.self ? 'me' : 'them'}: ${row.text}`)
    .filter((line) => (author ? line.replace(/^(me|them): /, '').trim() !== author : true))
    .join('\n')
    .slice(-2400);
}

/**
 * LinkedIn keeps semantic `msg-*` classes for messaging (unlike the feed),
 * so read the message list directly and fall back to geometry if they move.
 */
function linkedinThread(maxMessages: number): { author: string; text: string } | null {
  if (!/(^|\.)linkedin\.com$/.test(location.hostname)) return null;

  const bodies = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.msg-s-event-listitem__body, .msg-s-event-listitem__message-bubble',
    ),
  ).filter((node) => isVisible(node) && normalizeText(node.innerText).length > 0);

  if (bodies.length < 2) return null;

  const rows = bodies
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const self = Boolean(
        node.closest(
          '.msg-s-message-group--is-self, .msg-s-event-listitem--is-self, [class*="is-self"]',
        ),
      );
      return { text: normalizeText(node.innerText), top: rect.top, self };
    })
    .filter((row) => row.text);

  const rects = bodies.map((node) => node.getBoundingClientRect());
  const bounds = {
    left: Math.min(...rects.map((rect) => rect.left)),
    width: Math.max(1, Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left))),
  };
  const text = buildTranscript(rows, bounds, '', maxMessages);

  if (text.length < 6) return null;

  const rawAuthor = normalizeText(
    document.querySelector<HTMLElement>(
      '.msg-entity-lockup__entity-title, .msg-thread__link-to-profile, .msg-overlay-bubble-header__title',
    )?.innerText,
  );
  // The header often carries presence text next to the name.
  const author =
    rawAuthor.split(/\b(status is|active now|last seen|reachable)\b/i)[0].trim() || 'them';

  return { author, text };
}

function messageList(composer: HTMLElement, editor: HTMLElement): HTMLElement | null {
  const scope = rootOf(composer);
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>('div, section, ul, main'))
    .filter((node) => {
      // Ancestors are allowed: the composer lives *inside* the thread wrapper,
      // and bubblesIn() already excludes the composer subtree.
      if (node === editor) return false;
      const rect = node.getBoundingClientRect();
      return isVisible(node) && rect.height >= 120 && rect.width >= 200;
    })
    .map((node) => ({ node, count: bubblesIn(node, editor, composer).length }))
    .filter((candidate) => candidate.count >= 2)
    .sort((a, b) => b.count - a.count);

  return candidates[0]?.node ?? null;
}

export function readThread(
  editor: HTMLElement,
  maxMessages = 12,
): { author: string; text: string } | null {
  const limit = Math.max(1, maxMessages);
  const precise = linkedinThread(limit);
  if (precise) return precise;

  const composer = composerRoot(editor);

  const list = messageList(composer, editor);
  if (list) {
    const bubbles = bubblesIn(list, editor, composer);
    if (bubbles.length >= 2) {
      const rect = list.getBoundingClientRect();
      const author = headingNearComposer(composer) || threadAuthor(list) || 'them';
      const text = buildTranscript(bubbles, rect, author, limit);
      if (text.length >= 6) {
        return { author, text };
      }
    }
  }

  let scope: HTMLElement | null = composer.parentElement;
  let bubbles: Bubble[] = [];

  for (let depth = 0; scope && depth < 14; depth += 1) {
    const found = bubblesIn(scope, editor, composer);
    if (found.length >= 3) {
      bubbles = found;
      break;
    }
    if (found.length > bubbles.length) bubbles = found;
    scope = scope.parentElement;
  }

  if (!bubbles.length) return null;

  const container = (scope ?? composer.parentElement)!.getBoundingClientRect();
  const midpoint = container.left + container.width / 2;
  const recent = bubbles.slice(-12);

  const lines = recent.map((bubble) => {
    const center = bubble.left + bubble.width / 2;
    return `${center > midpoint + container.width * 0.06 ? 'me' : 'them'}: ${bubble.text}`;
  });

  // Never hand the model the placeholder line.
  const transcript = lines
    .join('\n')
    .split('\n')
    .filter((line) => !/^them: (write a message|add a comment)/i.test(line))
    .join('\n')
    .slice(-2400);

  if (transcript.length < 6) return null;

  const author =
    headingNearComposer(composer) || threadAuthor(scope ?? composer.parentElement!) || 'them';

  // A bubble that is just the person's name is a header, not a message.
  const cleaned = transcript
    .split('\n')
    .filter((line) => !author || line.replace(/^(me|them): /, '').trim() !== author)
    .join('\n');

  return { author, text: cleaned };
}
