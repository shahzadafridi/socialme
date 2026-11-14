import { isMac } from '@/lib/shared/dom';

const normalize = (value: string): string =>
  value
    .replace(/[\u200b\u200e\u200f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Compare what we asked for with what the editor actually holds. */
export function looksInserted(editor: HTMLElement, expected: string): boolean {
  const actual = normalize(editor.innerText || editor.textContent || '');
  const want = normalize(expected);
  if (!actual) return false;
  if (want.length < 12) return actual.includes(want);
  const head = want.slice(0, Math.min(28, want.length));
  const tail = want.slice(-Math.min(14, want.length));
  return actual.includes(head) && actual.includes(tail);
}

function selectAllContent(editor: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(editor);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function placeCaretAtEnd(editor: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Remove everything an editor currently holds, keeping its model in sync. */
export function clearEditor(editor: HTMLElement): void {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    const proto =
      editor instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(editor, '');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  editor.focus();
  selectAllContent(editor);
  try {
    document.execCommand('delete');
  } catch {
    // ignore
  }
  if ((editor.innerText ?? '').trim().length > 0) editor.textContent = '';
}

function insertIntoInput(el: HTMLInputElement | HTMLTextAreaElement, text: string): boolean {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, text);
  else el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value.includes(normalize(text).slice(0, 20));
}

function insertWithExecCommand(editor: HTMLElement, text: string): boolean {
  selectAllContent(editor);
  try {
    return document.execCommand('insertText', false, text);
  } catch {
    return false;
  }
}

/** Paragraph-by-paragraph insertion: more faithful line breaks in Lexical / Draft / Quill. */
function insertLineByLine(editor: HTMLElement, text: string): boolean {
  selectAllContent(editor);
  const lines = text.split(/\n/);
  try {
    lines.forEach((line, index) => {
      if (line) document.execCommand('insertText', false, line);
      if (index < lines.length - 1) {
        document.execCommand('insertParagraph');
        document.execCommand('insertText', false, '\u200b');
        // remove the zero-width placeholder so there is no stray character
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          selection.getRangeAt(0).deleteContents();
        }
      }
    });
    return true;
  } catch {
    return false;
  }
}

function insertViaPaste(editor: HTMLElement, text: string): boolean {
  selectAllContent(editor);
  try {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    const event = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(event);
    return looksInserted(editor, text);
  } catch {
    return false;
  }
}

function insertViaDom(editor: HTMLElement, text: string): boolean {
  editor.textContent = text;
  editor.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType: 'insertText',
      data: text,
    }),
  );
  return looksInserted(editor, text);
}

/**
 * Write text into any editor (contenteditable, textarea, input) and verify it landed.
 * Tries multiple strategies because the three platforms use three different editors.
 */
export async function insertIntoEditor(editor: HTMLElement, text: string): Promise<boolean> {
  if (!editor.isConnected) return false;
  editor.focus();

  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return insertIntoInput(editor, text);
  }

  if (!editor.isContentEditable && !editor.getAttribute('contenteditable')) {
    return false;
  }

  // 1. Native execCommand — lets Lexical / Draft.js / Quill update their models.
  insertWithExecCommand(editor, text);
  if (looksInserted(editor, text)) {
    placeCaretAtEnd(editor);
    return true;
  }

  // 2. Line-by-line, for editors that swallow inline newlines.
  if (text.includes('\n')) {
    insertLineByLine(editor, text);
    if (looksInserted(editor, text)) return true;
  }

  // 3. Synthetic paste.
  insertViaPaste(editor, text);
  if (looksInserted(editor, text)) return true;

  // 4. Direct DOM write. Works for simple contenteditables, may not sync rich editors.
  insertViaDom(editor, text);
  if (looksInserted(editor, text)) return true;

  return false;
}

/** Submit a reply/post with Cmd/Ctrl+Enter — supported by all three platforms. */
export function submitViaKeyboard(editor: HTMLElement): boolean {
  const mac = isMac();
  const base = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true,
    metaKey: mac,
    ctrlKey: !mac,
  };
  editor.focus();
  editor.dispatchEvent(new KeyboardEvent('keydown', base));
  editor.dispatchEvent(new KeyboardEvent('keyup', base));
  return true;
}

/** Click a button the way a user would, including the pointer events React relies on. */
export function humanClick(target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  const options = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    view: window,
  };
  target.dispatchEvent(new PointerEvent('pointerdown', options));
  target.dispatchEvent(new MouseEvent('mousedown', options));
  target.dispatchEvent(new PointerEvent('pointerup', options));
  target.dispatchEvent(new MouseEvent('mouseup', options));
  target.click();
}
