import type { PlatformAdapter } from '@/lib/integrations/adapter';
import { editorText, humanClick, insertIntoEditor, submitViaKeyboard } from '@/lib/integrations/insert';
import { trackManualDraft } from '@/lib/features/safety/submissions';
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
  beforeSubmit?: () => Promise<void>;
  signal?: AbortSignal;
}

export interface DeliverResult {
  inserted: boolean;
  submitted: boolean;
  attempted?: boolean;
  reason?: string;
}

/**
 * Put the draft into the platform's editor and optionally submit it.
 * Submission prefers the real button, then falls back to Cmd/Ctrl+Enter.
 */
export async function deliverDraft(
  adapter: PlatformAdapter,
  { editor, text, submit, delayMs = 0, humanTyping = false, typingSpeed = 'natural', beforeSubmit, signal }: DeliverOptions,
): Promise<DeliverResult> {
  signal?.throwIfAborted();
  const inserted = humanTyping
    ? await typeLikeHuman(editor, text, typingSpeed, signal)
    : await insertIntoEditor(editor, text);
  if (!inserted) {
    return { inserted: false, submitted: false, reason: "The editor didn't accept the text." };
  }
  if (!submit) {
    trackManualDraft(editor, adapter.id);
    return { inserted: true, submitted: false };
  }

  if (delayMs > 0) await sleep(delayMs);

  signal?.throwIfAborted();
  if (!editor.isConnected || editorText(editor).trim() !== text.trim()) {
    return { inserted: true, submitted: false, reason: 'The editor changed before sending. Review it and send manually.' };
  }

  const button = adapter.submitButton(editor);
  await beforeSubmit?.();
  signal?.throwIfAborted();
  if (!editor.isConnected || editorText(editor).trim() !== text.trim()) {
    return { inserted: true, submitted: false, reason: 'The editor changed before sending. Review it and send manually.' };
  }
  if (button) {
    humanClick(button);
  } else {
    submitViaKeyboard(editor);
  }

  await sleep(900);
  const confirmed = editor.isConnected && !adapter.hasContent(editor);
  return {
    inserted: true,
    submitted: confirmed,
    attempted: true,
    reason: !editor.isConnected
      ? 'Send attempted, but the editor disappeared. Check the conversation before retrying.'
      : !confirmed ? 'Send attempted; delivery is unconfirmed. Check the page before retrying.' : undefined,
  };
}

export function autoDelay(min: number, max: number): number {
  return randomBetween(min, max);
}
