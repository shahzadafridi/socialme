import type { TypingSpeed } from '@/lib/core/types';
import { insertIntoEditor, looksInserted } from '@/lib/integrations/insert';
import { sleep } from '@/lib/shared/dom';

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
): Promise<boolean> {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return insertIntoEditor(editor, text);
  }
  if (!editor.isContentEditable && !editor.getAttribute('contenteditable')) return false;

  const profile = PROFILES[speed] ?? PROFILES.natural;
  editor.focus();
  await sleep(Math.round(rand(profile.startDelay[0], profile.startDelay[1])));
  clearEditor(editor);

  let index = 0;
  let guard = 0;
  while (index < text.length && guard < 4000) {
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

  if (index >= text.length && looksInserted(editor, text)) return true;

  // Something rejected the simulated typing — fall back to the instant path.
  return insertIntoEditor(editor, text);
}
