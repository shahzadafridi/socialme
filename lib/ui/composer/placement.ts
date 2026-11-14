import { deepQueryAll, isVisible, rootOf } from '@/lib/shared/dom';
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

const SUBMIT_LABEL = /^(send|comment|post|reply|share)$/i;

function isSubmitControl(node: HTMLElement): boolean {
  const hay = `${node.getAttribute('aria-label') ?? ''} ${node.innerText ?? ''}`.trim();
  return SUBMIT_LABEL.test(hay);
}

function iconsIn(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
  )
    .filter(isIconButton)
    .filter((node) => !isSubmitControl(node));
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
  const editorDialog = editor.closest('[role="dialog"]');
  const scope = rootOf(editor);
  const emoji = deepQueryAll<HTMLElement>(
    '[aria-label*="emoji" i], [title*="emoji" i]',
    scope,
  )
    .filter(isVisible)
    // Never borrow an icon from another composer (e.g. a dialog above this one).
    .filter((node) => node.closest('[role="dialog"]') === editorDialog)
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => Math.abs(rect.top - editorRect.top) < 220)
    .sort(
      (a, b) => Math.abs(a.rect.top - editorRect.top) - Math.abs(b.rect.top - editorRect.top),
    )[0];

  if (emoji?.node.parentElement) {
    // The emoji may sit in its own wrapper; climb until we reach the real toolbar row.
    let row: HTMLElement | null = emoji.node.parentElement;
    for (let depth = 0; row && depth < 6; depth += 1) {
      if (iconsIn(row).length >= 2) break;
      row = row.parentElement;
    }
    if (row) {
      const icons = iconsIn(row).sort(
        (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      );
      return { row, anchor: icons[icons.length - 1] ?? emoji.node };
    }
  }

  const container = findCommentContainer(editor) ?? editor.parentElement;
  let icons = container ? iconsIn(container) : [];

  if (icons.filter((node) => MEDIA_ICON.test(labelOf(node))).length < 2) {
    const near = iconsIn(scope).filter((node) => {
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
  // Textarea composers (X chat) keep their icon row to the left of the field:
  // sit immediately before the field so the icon reads as the last one.
  if (entry.editor.tagName === 'TEXTAREA' && entry.editor.parentElement) {
    // Climb to the row that also holds the icon buttons, then sit just before
    // the field's box so the icon reads as the last one before the message.
    let box: HTMLElement = entry.editor;
    let parent = box.parentElement;
    for (let depth = 0; parent && depth < 3; depth += 1) {
      // Stop at the field's own wrapper: adding a row child can break X's
      // grid layout, but a child of the field keeps the composer intact.
      if (parent.querySelector('button, [role="button"]')) break;
      box = parent;
      parent = parent.parentElement;
    }
    if (parent) {
      const sibling = parent.querySelector<HTMLElement>('button, [role="button"]');
      const size = Math.min(40, Math.max(24, Math.round(sibling?.offsetWidth || 32)));
      entry.button.style.width = `${size}px`;
      entry.button.style.height = `${size}px`;
      entry.button.style.margin = '0 2px';
      entry.button.style.alignSelf = 'center';
      entry.button.style.borderRadius = '50%';
      entry.button.style.flex = 'none';
      parent.insertBefore(entry.button, box);
      return entry.button.isConnected;
    }
  }

  const toolbar = findToolbar(entry.editor);
  if (toolbar) {
    // One icon per toolbar, even if two editors map onto the same row.
    const taken = toolbar.row.querySelector<HTMLElement>('.socialme-quick');
    if (taken && taken !== entry.button) return false;

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

    // If the right-most control is the send/submit action itself, land just
    // before it; otherwise land after the last real icon.
    const isSubmit = /^(send|comment|post|reply|share)\b/i.test(labelOf(toolbar.anchor));
    if (isSubmit) wrapper.before(entry.button);
    else if (toolbar.row.getAttribute('data-testid') === 'ScrollSnap-List') {
      // X's toolbar is a horizontal scroller: anything appended inside it gets
      // clipped. Sit just after the scroller so we stay on the same row.
      const scroller = toolbar.row.parentElement ?? toolbar.row;
      const host = scroller.parentElement ?? scroller;
      host.insertBefore(entry.button, scroller.nextSibling);
    } else wrapper.after(entry.button);

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
