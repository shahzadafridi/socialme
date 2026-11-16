import type { TypingSpeed } from '@/lib/core/types';
import { actualEditable, editorText, insertIntoEditor, looksInserted } from '@/lib/integrations/insert';
import { sleep, isTextControl } from '@/lib/shared/dom';

interface TypingProfile {
  chunk: [number, number];
  delay: [number, number];
  punctuationPause: [number, number];
  startDelay: [number, number];
  thinkChance: number;
}

const PROFILES: Record<TypingSpeed, TypingProfile> = {
  fast: {
    chunk: [3, 6],
    delay: [10, 22],
    punctuationPause: [40, 90],
    startDelay: [120, 300],
    thinkChance: 0.03,
  },
  natural: {
    chunk: [2, 4],
    delay: [18, 45],
    punctuationPause: [90, 220],
    startDelay: [250, 650],
    thinkChance: 0.06,
  },
  careful: {
    chunk: [1, 2],
    delay: [35, 85],
    punctuationPause: [180, 380],
    startDelay: [450, 900],
    thinkChance: 0.1,
  },
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function pickChunk(text: string, index: number, profile: TypingProfile): number {
  const size = Math.round(rand(profile.chunk[0], profile.chunk[1]));
  // Prefer to break on word boundaries so the result never looks machine-chunked.
  let end = Math.min(text.length, index + size);
  if (end < text.length && /\S/.test(text[end] ?? '')) {
    const space = text.indexOf(' ', end);
    if (space !== -1 && space - index <= size + 4) end = space;
  }
  return end - index;
}

function clearEditor(editor: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand('delete');
}

/**
 * Types text the way a person does: variable chunks, hesitation, longer pauses
 * after punctuation. Falls back to instant insertion if the editor rejects it.
 */
export async function typeLikeHuman(
  editor: HTMLElement,
  text: string,
  speed: TypingSpeed = 'natural',
  signal?: AbortSignal,
): Promise<boolean> {
  signal?.throwIfAborted();
  if (isTextControl(editor)) {
    return insertIntoEditor(editor, text);
  }
  if (!editor.isContentEditable && !editor.getAttribute('contenteditable')) return false;

  const target = actualEditable(editor);
  const profile = PROFILES[speed] ?? PROFILES.natural;
  const previous = editorText(target);
  target.focus();
  await sleep(Math.round(rand(profile.startDelay[0], profile.startDelay[1])));
  signal?.throwIfAborted();
  const ownsFocus = () => (target.getRootNode() as Document | ShadowRoot).activeElement === target;
  if (!target.isConnected || !ownsFocus() || editorText(target) !== previous) return false;
  clearEditor(target);

  let index = 0;
  let guard = 0;
  while (index < text.length && guard < 4000) {
    signal?.throwIfAborted();
    if (!target.isConnected || !ownsFocus()) return false;
    if (index > 0 && !looksInserted(target, text.slice(0, index))) return false;
    guard += 1;
    const size = pickChunk(text, index, profile);
    const chunk = text.slice(index, index + size);
    const inserted = document.execCommand('insertText', false, chunk);
    if (!inserted) break;
    index += size;

    const last = chunk.trim().slice(-1);
    if (/[.!?]/.test(last)) {
      await sleep(Math.round(rand(profile.punctuationPause[0], profile.punctuationPause[1])));
    } else if (/[,;:]/.test(last)) {
      await sleep(Math.round(rand(profile.punctuationPause[0] / 2, profile.punctuationPause[1] / 2)));
    } else {
      if (Math.random() < profile.thinkChance) {
        await sleep(Math.round(rand(220, 700)));
      }
      await sleep(Math.round(rand(profile.delay[0], profile.delay[1])));
    }
  }

  if (index >= text.length && looksInserted(target, text)) return true;

  // Something rejected the simulated typing — clear the partial text, then
  // use the instant path (which handles Lexical via beforeinput).
  clearEditor(target);
  return insertIntoEditor(editor, text);
}
