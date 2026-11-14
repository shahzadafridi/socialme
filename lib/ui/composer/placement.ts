import { isVisible } from '@/lib/shared/dom';
import type { Entry } from '@/lib/ui/composer/button';

function isIconButton(node: HTMLElement): boolean {
  if (!node.matches('button, [role="button"], [aria-haspopup], [aria-label]')) return false;
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  if (rect.width > 60 || rect.height > 60) return false;
  const text = (node.innerText ?? '').trim();
  if (text.length === 0) return true;
  return text.length <= 2 && /\p{Emoji}/u.test(text);
}

function labelOf(node: HTMLElement): string {
  return `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''}`.toLowerCase();
}

const MEDIA_ICON = /emoji|gif|photo|image|attach|file|sticker|media/;

function iconsIn(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
  ).filter(isIconButton);
}

/** Nearest ancestor that owns the editor and its submit control. */
function findCommentContainer(editor: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = editor.parentElement;
  let withIcons: HTMLElement | null = null;

  for (let depth = 0; node && depth < 14; depth += 1) {
    const buttons = Array.from(node.querySelectorAll<HTMLElement>('button, [role="button"]'));
    const hasSubmit = buttons.some((btn) =>
      /^(comment|post|reply|send)$/i.test(
        (btn.getAttribute('aria-label') ?? btn.innerText ?? '').trim(),
      ),
    );
    if (hasSubmit) return node;
    if (!withIcons && buttons.some((btn) => isIconButton(btn))) withIcons = node;
    node = node.parentElement;
  }

  return withIcons ?? editor.parentElement;
}

/**
 * The media toolbar of a comment box or message composer. Anchors on the emoji
 * control, then takes the right-most icon so our button lands last in the row.
 */
function findToolbar(editor: HTMLElement): { row: HTMLElement; anchor: HTMLElement } | null {
  const editorRect = editor.getBoundingClientRect();
  const emoji = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-label*="emoji" i], [title*="emoji" i]'),
  )
    .filter(isVisible)
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => Math.abs(rect.top - editorRect.top) < 220)
    .sort(
      (a, b) => Math.abs(a.rect.top - editorRect.top) - Math.abs(b.rect.top - editorRect.top),
    )[0];

  if (emoji?.node.parentElement) {
    const row = emoji.node.parentElement;
    const icons = Array.from(
      row.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
    )
      .filter(isIconButton)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return { row, anchor: icons[icons.length - 1] ?? emoji.node };
  }

  const container = findCommentContainer(editor) ?? editor.parentElement;
  let icons = container ? iconsIn(container) : [];

  if (icons.filter((node) => MEDIA_ICON.test(labelOf(node))).length < 2) {
    const near = iconsIn(document).filter((node) => {
      const rect = node.getBoundingClientRect();
      return (
        Math.abs(rect.top - editorRect.top) < 110 && Math.abs(rect.bottom - editorRect.bottom) < 160
      );
    });
    if (near.length >= 2) icons = near;
  }

  if (icons.length < 2) return null;

  const media = icons.filter((node) => MEDIA_ICON.test(labelOf(node)));
  const pool = media.length >= 2 ? media : icons;
  pool.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

  const last = pool[pool.length - 1];
  const row = last.parentElement ?? container ?? editor.parentElement;
  if (!row) return null;
  return { row, anchor: last };
}

export function insertButton(entry: Entry): boolean {
  const toolbar = findToolbar(entry.editor);
  if (toolbar) {
    let wrapper: HTMLElement = toolbar.anchor;
    while (wrapper.parentElement && wrapper.parentElement !== toolbar.row) {
      wrapper = wrapper.parentElement;
    }

    // Square box so it reads as a circle, sized like the neighbouring icons.
    const box = Math.min(
      40,
      Math.max(
        24,
        Math.round(Math.min(toolbar.anchor.offsetWidth || 24, toolbar.anchor.offsetHeight || 24)),
      ),
    );
    entry.button.style.width = `${box}px`;
    entry.button.style.height = `${box}px`;
    entry.button.style.padding = '0';
    entry.button.style.margin = '0';
    entry.button.style.alignSelf = 'center';
    entry.button.style.borderRadius = '50%';
    entry.button.style.lineHeight = '0';

    wrapper.after(entry.button);

    const align = () => {
      if (!entry.button.isConnected) return;
      entry.button.style.transform = 'none';
      const anchorRect = toolbar.anchor.getBoundingClientRect();
      const ours = entry.button.getBoundingClientRect();
      const delta = anchorRect.top + anchorRect.height / 2 - (ours.top + ours.height / 2);
      if (Number.isFinite(delta) && Math.abs(delta) > 0.5) {
        entry.button.style.transform = `translateY(${delta}px)`;
      }
    };
    window.requestAnimationFrame(align);

    return entry.button.isConnected;
  }

  if (entry.mode === 'dm') {
    const parent = entry.editor.parentElement;
    if (!parent) return false;
    parent.insertBefore(entry.button, entry.editor);
    return entry.button.isConnected;
  }

  const container = findCommentContainer(entry.editor);
  if (!container) return false;
  container.appendChild(entry.button);
  return entry.button.isConnected;
}
