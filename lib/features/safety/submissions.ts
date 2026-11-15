import { browser } from 'wxt/browser';
import type { PlatformId } from '@/lib/core/types';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import { editorText } from '@/lib/integrations/insert';
import { confirmSubmit } from './service';

const drafts = new Map<HTMLElement, { platform: PlatformId; id: string }>();

export function trackManualDraft(editor: HTMLElement, platform: PlatformId): void {
  drafts.set(editor, { platform, id: crypto.randomUUID() });
}

/** Observe user sends of assisted drafts; this does not intercept or block manual sending. */
export function installSubmissionWatch(adapter: PlatformAdapter): () => void {
  const observe = (event: Event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    for (const [editor, draft] of drafts) {
      if (!editor.isConnected) { drafts.delete(editor); continue; }
      if (draft.platform !== adapter.id || !editorText(editor).trim()) continue;
      let sending = false;
      if (event instanceof MouseEvent) {
        const button = adapter.submitButton(editor);
        sending = Boolean(button && (button === event.target || button.contains(event.target)));
      } else if (event instanceof KeyboardEvent) {
        // Plain Enter can insert a newline depending on platform preferences; only
        // recognize the explicit send shortcut here, or observe the send button.
        sending = editor.contains(event.target) && event.key === 'Enter' && (event.metaKey || event.ctrlKey);
      }
      if (!sending) continue;
      drafts.delete(editor);
      void browser.runtime.sendMessage({ type: 'socialme:observe-submit', platform: draft.platform, id: draft.id })
        .then(() => window.setTimeout(() => {
          if (editor.isConnected && !adapter.hasContent(editor)) void confirmSubmit(draft.id).catch(() => undefined);
        }, 1200))
        .catch(() => undefined);
      break;
    }
  };
  document.addEventListener('click', observe, true);
  document.addEventListener('keydown', observe, true);
  return () => {
    document.removeEventListener('click', observe, true);
    document.removeEventListener('keydown', observe, true);
    drafts.clear();
  };
}
