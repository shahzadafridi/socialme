import { clearEditor, editorText, insertIntoEditor } from '@/lib/integrations/insert';

/** Review replacements without ever clearing the user's existing draft first. */
export function reviewReplacement(button: HTMLElement, draft: string, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'socialme-draft-review';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Review replacement draft');
    box.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483003;width:min(340px,calc(100vw - 40px));padding:14px;background:#14171f;color:#e9ecf3;border:1px solid #596175;border-radius:12px;font:13px/1.5 system-ui;box-shadow:0 8px 32px #0008';
    const title = document.createElement('strong');
    title.textContent = 'Your existing draft is preserved';
    const text = document.createElement('p');
    text.textContent = draft;
    text.style.cssText = 'white-space:pre-wrap;max-height:220px;overflow:auto';
    box.append(title, text);
    const close = (replace: boolean) => {
      box.remove();
      document.removeEventListener('keydown', escape);
      signal?.removeEventListener('abort', cancel);
      if (button.isConnected && !signal?.aborted) button.focus();
      resolve(replace);
    };
    const cancel = () => close(false);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(false); };
    for (const [label, replace] of [['Replace draft', true], ['Keep mine', false]] as const) {
      const action = document.createElement('button');
      action.type = 'button'; action.textContent = label;
      action.style.cssText = 'padding:7px 10px;margin:0 6px 0 0;border-radius:7px;border:1px solid #596175;background:#252b3b;color:#fff;cursor:pointer';
      action.onclick = () => close(replace);
      box.append(action);
    }
    document.body.append(box);
    document.addEventListener('keydown', escape);
    signal?.addEventListener('abort', cancel, { once: true });
    box.querySelector('button')?.focus();
  });
}

export function offerUndo(editor: HTMLElement, previous: string, generated: string): void {
  document.querySelectorAll('.socialme-draft-undo').forEach((button) => button.remove());
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'socialme-draft-undo';
  undo.textContent = 'Draft inserted · Undo';
  undo.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483003;padding:10px 16px;border-radius:9px;border:1px solid #596175;background:#14171f;color:#fff;font:13px system-ui;cursor:pointer';
  const timer = window.setTimeout(() => undo.remove(), 15000);
  undo.onclick = async () => {
    window.clearTimeout(timer);
    if (editor.isConnected && editorText(editor).trim() === generated.trim()) {
      if (previous) await insertIntoEditor(editor, previous);
      else {
        clearEditor(editor);
      }
    }
    undo.remove();
  };
  document.body.append(undo);
}
