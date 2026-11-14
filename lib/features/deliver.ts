import type { PlatformAdapter } from '@/lib/integrations/adapter';
import { humanClick, insertIntoEditor, submitViaKeyboard } from '@/lib/integrations/insert';
import { typeLikeHuman } from '@/lib/features/safety/humanize';
import { sleep } from '@/lib/shared/dom';
import { randomBetween } from '@/lib/shared/dom';
import type { TypingSpeed } from '@/lib/core/types';

export interface DeliverOptions {
  editor: HTMLElement;
  text: string;
  submit: boolean;
  delayMs?: number;
  humanTyping?: boolean;
  typingSpeed?: TypingSpeed;
}

export interface DeliverResult {
  inserted: boolean;
  submitted: boolean;
  reason?: string;
}

/**
 * Put the draft into the platform's editor and optionally submit it.
 * Submission prefers the real button, then falls back to Cmd/Ctrl+Enter.
 */
export async function deliverDraft(
  adapter: PlatformAdapter,
  { editor, text, submit, delayMs = 0, humanTyping = false, typingSpeed = 'natural' }: DeliverOptions,
): Promise<DeliverResult> {
  const inserted = humanTyping
    ? await typeLikeHuman(editor, text, typingSpeed)
    : await insertIntoEditor(editor, text);
  if (!inserted) {
    return { inserted: false, submitted: false, reason: "The editor didn't accept the text." };
  }
  if (!submit) return { inserted: true, submitted: false };

  if (delayMs > 0) await sleep(delayMs);

  if (!adapter.hasContent(editor)) {
    // Some editors reset between typing and submitting; re-insert once.
    const retried = humanTyping
      ? await typeLikeHuman(editor, text, typingSpeed)
      : await insertIntoEditor(editor, text);
    if (!retried) {
      return { inserted: false, submitted: false, reason: 'The draft disappeared before posting.' };
    }
    await sleep(randomBetween(250, 700));
  }

  const button = adapter.submitButton(editor);
  if (button) {
    humanClick(button);
  } else {
    submitViaKeyboard(editor);
  }

  await sleep(900);
  const stillThere = editor.isConnected && adapter.hasContent(editor);
  return {
    inserted: true,
    submitted: !stillThere,
    reason: stillThere ? 'Text is still in the box — press the send button yourself.' : undefined,
  };
}

export function autoDelay(min: number, max: number): number {
  return randomBetween(min, max);
}
