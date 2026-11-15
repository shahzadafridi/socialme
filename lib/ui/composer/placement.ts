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

/** Overflow menus belong in the composer, but not at the end of the icon row. */
const OVERFLOW_ICON = /^(more|more actions|more options|open options|options|menu|overflow|settings)\b/i;

function isOverflowControl(node: HTMLElement): boolean {
  return OVERFLOW_ICON.test(labelOf(node)) || OVERFLOW_ICON.test((node.innerText ?? '').trim());
}

/** Media controls can start with "Share" too ("Share photo"); they are not submits. */
const MEDIA_ACTION = /\b(photo|image|gif|emoji|video|poll|location|document|media)\b/i;

function isSubmitControl(node: HTMLElement): boolean {
  const label = (node.getAttribute('aria-label') ?? '').trim();
  const text = (node.innerText ?? '').trim();
  if (MEDIA_ACTION.test(label) || MEDIA_ACTION.test(text)) return false;
  // "Send", "Send message", "Post comment" — but not a button that merely
  // contains the word (e.g. a menu item called "Schedule send").
  return /^(send|comment|post|reply|share)\b/i.test(label) || /^(send|comment|post|reply|share)$/i.test(text);
}

function iconsIn(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
  )
    .filter((node) => !node.classList.contains('socialme-quick'))
    .filter(isIconButton)
    .filter((node) => !isSubmitControl(node))
    .filter((node) => !isOverflowControl(node));
}

/** Direct child of `row` that contains `node`, so the icon can sit beside it. */
function childOfRow(row: HTMLElement, node: HTMLElement): HTMLElement | null {
  let el: HTMLElement = node;
  while (el.parentElement && el.parentElement !== row) el = el.parentElement;
  return el.parentElement === row ? el : null;
}

/** Square size that matches the icons actually in the row. */
function matchIconSize(nodes: HTMLElement[], fallback?: HTMLElement | null): number {
  const sizes = nodes
    .map((node) => node.getBoundingClientRect())
    .filter((rect) => rect.width >= 16 && rect.height >= 16 && rect.width <= 48 && rect.height <= 48)
    .map((rect) => Math.round(Math.min(rect.width, rect.height)))
    .sort((a, b) => a - b);

  if (sizes.length) {
    return Math.max(22, Math.min(38, sizes[Math.floor(sizes.length / 2)]));
  }

  const rect = fallback?.getBoundingClientRect();
  const base = rect ? Math.min(rect.width, rect.height) : 28;
  return Math.max(24, Math.min(38, Math.round(base || 28)));
}

/** Is the injected button actually usable on screen? */
export function isUsableButton(button: HTMLElement): boolean {
  if (!button.isConnected) return false;
  const style = getComputedStyle(button);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const rect = button.getBoundingClientRect();
  return rect.width > 8 && rect.height > 8 && rect.right > 0 && rect.left < window.innerWidth;
}

/** Nearest X control with this accessible label, closest to the editor first. */
function xControlNear(editor: HTMLElement, pattern: RegExp): HTMLElement | null {
  const editorRect = visualRect(editor);
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, [role="button"], [aria-label], [title]',
      ),
    )
      .filter(isVisible)
      .filter((node) => pattern.test(labelOf(node)) || pattern.test(node.innerText ?? ''))
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.top > editorRect.top - 360 && rect.bottom < editorRect.bottom + 360,
      )
      .sort((a, b) => {
        const distance = (rect: DOMRect) =>
          Math.min(
            Math.abs(rect.top - editorRect.bottom),
            Math.abs(rect.bottom - editorRect.top),
          );
        return distance(a.rect) - distance(b.rect);
      })[0]?.node ?? null
  );
}

/**
 * X's icon row is a horizontal scroller. Inserting inside the emoji's own
 * wrapper drops the icon onto a second line inside that wrapper; inserting into
 * the scroller itself keeps it inline like a native icon.
 */
function xIconRow(icon: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = icon.parentElement;
  for (let depth = 0; node && depth < 8; depth += 1) {
    if (node === document.body) return null;
    const overflowX = getComputedStyle(node).overflowX;
    if (overflowX !== 'visible' && node.parentElement) return node;
    node = node.parentElement;
  }
  return icon.parentElement;
}

/** Put the X icon at the end of the toolbar's icon row, next to the emoji. */
function placeAtXEmoji(entry: Entry): boolean {
  const emoji = xControlNear(entry.editor, /emoji/i);
  const row = emoji ? xIconRow(emoji) : null;
  if (!emoji || !row) return false;

  const taken = row.querySelector<HTMLElement>('.socialme-quick');
  if (taken && taken !== entry.button) return false;

  const icons = iconsIn(row);
  sizeForRow(entry.button, icons.length ? matchIconSize(icons, emoji) : 36);
  // X's own icons are ~20px glyphs in 36px hit areas; a filled ✦ at 22 reads
  // heavier than its outline siblings.
  const svg = entry.button.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.style.width = '20px';
    svg.style.height = '20px';
  }
  entry.button.style.alignSelf = 'center';

  // Sit after the emoji's direct child wrapper, so X's own flex gap applies.
  // If an earlier scan parked the icon inside that wrapper, move it back out.
  const wrapper = childOfRow(row, emoji);
  if (wrapper) wrapper.after(entry.button);
  else emoji.after(entry.button);
  return entry.button.isConnected;
}

/**
 * True when the ✦ is no longer where the last placement put it: its row was
 * replaced, it got wrapped inside another control, or a new icon appeared to
 * its right (LinkedIn adds the photo control after the first keystroke).
 */
export function needsReplacing(entry: Entry): boolean {
  const { button } = entry;
  const parent = button.parentElement;
  if (!parent) return true;
  if (entry.placedParent && parent !== entry.placedParent) return true;

  const xPage = /(^|\.)(x|twitter)\.com$/.test(location.hostname);
  // X's ✦ sits right after the emoji by design, not at the end of the row.
  if (xPage) return false;

  const rect = button.getBoundingClientRect();
  const centre = rect.top + rect.height / 2;
  return Array.from(
    parent.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
  )
    .filter((node) => node !== button && isVisible(node))
    .filter((node) => !isSubmitControl(node) && isIconButton(node))
    .some((node) => {
      const other = node.getBoundingClientRect();
      const sameLine = Math.abs(other.top + other.height / 2 - centre) < 24;
      return sameLine && other.left > rect.right - 2;
    });
}

/** Size the button and its glyph so it reads as one of the row's icons. */
function sizeForRow(button: HTMLButtonElement, size: number): void {
  // Facebook's toolbar icons are outline glyphs on a 30-32px hit area. A big
  // 38px star with a coloured circle reads as a different kind of control.
  const facebook = /(^|\.)facebook\.com$/.test(location.hostname);
  const box = facebook ? Math.min(30, Math.max(24, size)) : size;

  button.style.width = `${box}px`;
  button.style.height = `${box}px`;
  button.style.padding = '0';
  button.style.margin = '0 2px';
  button.style.borderRadius = '50%';
  button.style.boxSizing = 'border-box';
  button.style.flex = '0 0 auto';
  button.style.alignSelf = 'center';
  button.style.lineHeight = '0';

  const glyph = facebook
    ? Math.min(20, Math.max(15, Math.round(box * 0.64)))
    : Math.min(22, Math.max(16, Math.round(size * 0.8)));
  const svg = button.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', String(glyph));
    svg.setAttribute('height', String(glyph));
    svg.style.width = `${glyph}px`;
    svg.style.height = `${glyph}px`;
    svg.style.display = 'block';
    svg.style.flex = 'none';
  }
}

/**
 * The composer row that owns the Send/Comment/Reply control. This is the most
 * reliable anchor: LinkedIn's messaging footer is a sibling of the editor, and
 * the conversation header has its own icons that an emoji search can borrow.
 */
function rowFromSubmit(editor: HTMLElement): Toolbar | null {
  const editorRect = visualRect(editor);
  const submit = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
  )
    .filter((node) => isVisible(node) && isSubmitControl(node))
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(
      ({ rect }) =>
        rect.top >= editorRect.bottom - 12 &&
        rect.top <= editorRect.bottom + 170 &&
        rect.right > editorRect.left - 20 &&
        rect.left < editorRect.right + 140,
    )
    .sort(
      (a, b) =>
        Math.abs(a.rect.top - editorRect.bottom) - Math.abs(b.rect.top - editorRect.bottom),
    )[0]?.node;

  if (!submit) return null;
  const submitRect = submit.getBoundingClientRect();

  // The icons usually sit in their own group to the left of Send. Find the
  // right-most real icon in that band, so the ✦ lands at the end of the group
  // rather than next to Send across the flexible gap.
  const icons = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
  )
    .filter((node) => {
      if (node === submit || !isVisible(node)) return false;
      if (isSubmitControl(node) || isOverflowControl(node)) return false;
      if (!isIconButton(node)) return false;
      const rect = node.getBoundingClientRect();
      const sameLine = Math.abs(
        rect.top + rect.height / 2 - (submitRect.top + submitRect.height / 2),
      ) < 28;
      const toTheLeft = rect.right <= submitRect.left + 6;
      const close = rect.left >= submitRect.left - 800;
      return sameLine && toTheLeft && close;
    })
    .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

  if (icons.length) {
    const anchor = icons[icons.length - 1];
    let row = anchor.parentElement;
    // Climb until the row groups at least two icons (LinkedIn wraps each one).
    for (let depth = 0; row && depth < 4 && iconsIn(row).length < 2; depth += 1) {
      row = row.parentElement;
    }
    if (row) return { row, anchor, strategy: 'near-editor' };
  }

  // The media/emoji control is the safest anchor when the icon buttons do not
  // expose a usable role or size. Pick the one on the Send line, left of Send.
  const emoji = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-label*="emoji" i], [title*="emoji" i]'),
  )
    .filter(isVisible)
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(
      ({ rect }) =>
        Math.abs(rect.top + rect.height / 2 - (submitRect.top + submitRect.height / 2)) < 30 &&
        rect.right <= submitRect.left + 6 &&
        rect.left >= submitRect.left - 420,
    )
    .sort((a, b) => b.rect.left - a.rect.left)[0]?.node;

  if (emoji) {
    let row = emoji.parentElement;
    for (let depth = 0; row && depth < 4 && iconsIn(row).length < 2; depth += 1) {
      row = row.parentElement;
    }
    if (row) return { row, anchor: emoji, strategy: 'near-editor' };
  }

  const row = submit.parentElement;
  if (!row) return null;
  return { row, anchor: submit, strategy: 'near-editor' };
}

/**
 * The tight icon group around the anchor. Inserting after the group itself
 * (rather than inside it) leaves the ✦ floating in the composer's flex gap.
 */
function groupAround(anchor: HTMLElement, editor: HTMLElement, mode: 'comment' | 'dm' | 'note'): Toolbar | null {
  const editorRect = visualRect(editor);
  const rect = anchor.getBoundingClientRect();
  // Never borrow an icon far above the editor (conversation header, page chrome).
  // A comment box's media toolbar can sit level with the editor's top edge, but
  // a DM toolbar is always below it — above that is a message reaction.
  if (mode === 'dm' && rect.top < editorRect.bottom - 12) return null;
  if (rect.top < editorRect.top - 120) return null;
  if (rect.top > editorRect.bottom + 240) return null;

  const hasSubmit = (node: HTMLElement) =>
    Array.from(
      node.querySelectorAll<HTMLElement>('button, [role="button"], [aria-label]'),
    ).some((control) => isVisible(control) && isSubmitControl(control));

  let best: HTMLElement | null = null;
  let node: HTMLElement | null = anchor.parentElement;

  for (let depth = 0; node && depth < 6; depth += 1) {
    const hasIcons = iconsIn(node).length >= 2;
    if (hasIcons && !best) best = node;
    // Stop at the footer/message row, but keep the tighter group found inside it.
    if (hasSubmit(node)) {
      if (!best && hasIcons) best = node;
      break;
    }
    node = node.parentElement;
  }

  return best ? { row: best, anchor, strategy: 'near-editor' } : null;
}

/**
 * Fallback: small icon controls just below the editor and aligned with it.
 */
function toolbarBelowEditor(editor: HTMLElement): Toolbar | null {
  const editorRect = visualRect(editor);
  if (editorRect.width === 0) return null;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
  ).filter((node) => {
    if (!isVisible(node)) return false;
    if (isSubmitControl(node) || isOverflowControl(node)) return false;
    if (!isIconButton(node)) return false;
    const rect = node.getBoundingClientRect();
    const below = rect.top >= editorRect.bottom - 6 && rect.top <= editorRect.bottom + 130;
    const aligned = rect.right > editorRect.left - 40 && rect.left < editorRect.right + 40;
    return below && aligned;
  });

  if (!candidates.length) return null;

  const groups = new Map<HTMLElement, HTMLElement[]>();
  for (const node of candidates) {
    const row = node.parentElement;
    if (!row) continue;
    const list = groups.get(row) ?? [];
    list.push(node);
    groups.set(row, list);
  }

  let best: { row: HTMLElement; icons: HTMLElement[] } | null = null;
  for (const [row, icons] of groups) {
    if (!best || icons.length > best.icons.length) best = { row, icons };
  }
  if (!best) return null;

  best.icons.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const anchor = best.icons[best.icons.length - 1];
  return { row: best.row, anchor, strategy: 'near-editor' };
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
export interface Toolbar {
  row: HTMLElement;
  anchor: HTMLElement;
  /** Which detection path matched — surfaced by the health check. */
  strategy: 'emoji-row' | 'icon-row' | 'near-editor';
}

/**
 * Some platforms put the contenteditable inside a zero-sized wrapper; measure the
 * visible composer box instead so geometry looks at the right place on screen.
 */
function visualRect(el: HTMLElement): DOMRect {
  const rect = el.getBoundingClientRect();
  if (rect.width > 80 && rect.height > 16) return rect;
  const parent = el.parentElement?.getBoundingClientRect();
  return parent && parent.width > 80 && parent.height > 16 ? parent : rect;
}

export function findToolbar(editor: HTMLElement): Toolbar | null {
  const editorRect = visualRect(editor);
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
      return { row, anchor: icons[icons.length - 1] ?? emoji.node, strategy: 'emoji-row' };
    }
  }

  const container = findCommentContainer(editor) ?? editor.parentElement;
  let icons = container ? iconsIn(container) : [];

  let strategy: Toolbar['strategy'] = 'icon-row';
  if (icons.filter((node) => MEDIA_ICON.test(labelOf(node))).length < 2) {
    const near = iconsIn(scope).filter((node) => {
      const rect = node.getBoundingClientRect();
      return (
        Math.abs(rect.top - editorRect.top) < 110 && Math.abs(rect.bottom - editorRect.bottom) < 160
      );
    });
    if (near.length >= 2) {
      icons = near;
      strategy = 'near-editor';
    }
  }

  if (icons.length < 2) return null;

  const media = icons.filter((node) => MEDIA_ICON.test(labelOf(node)));
  const pool = media.length >= 2 ? media : icons;
  pool.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

  const last = pool[pool.length - 1];
  const row = last.parentElement ?? container ?? editor.parentElement;
  if (!row) return null;
  return { row, anchor: last, strategy };
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

  const isXPage = /(^|\.)(x|twitter)\.com$/.test(location.hostname);
  if (isXPage) {
    // X renders its icon row only once the composer is focused. Until then,
    // return false so the next scan retries; any generic fallback would park
    // the ✦ above the editor instead of in that row.
    return placeAtXEmoji(entry);
  }

  const found = findToolbar(entry.editor);
  const grouped = found ? groupAround(found.anchor, entry.editor, entry.mode) : null;

  const facebook = /(^|\.)facebook\.com$/.test(location.hostname);

  // Facebook's comment composer lives in a modal (often with shadow content).
  // Its media row is the reliable anchor; climbing to a submit ancestor can
  // land in the page-level container, behind the modal.
  const toolbar = facebook
    ? found ?? toolbarBelowEditor(entry.editor) ?? grouped ?? rowFromSubmit(entry.editor)
    : grouped ?? toolbarBelowEditor(entry.editor) ?? rowFromSubmit(entry.editor) ?? found;
  if (toolbar) {
    // One icon per toolbar, even if two editors map onto the same row.
    const taken = toolbar.row.querySelector<HTMLElement>('.socialme-quick');
    if (taken && taken !== entry.button) return false;

    const controls = Array.from(
      toolbar.row.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup], [aria-label]'),
    ).filter(isVisible);
    const submit = controls.find(isSubmitControl) ?? null;
    const icons = controls.filter(
      (node) =>
        node !== entry.button && node !== submit && !isOverflowControl(node) && isIconButton(node),
    );
    const anchor = icons[icons.length - 1] ?? toolbar.anchor;
    const size = icons.length ? matchIconSize(icons, anchor) : 26;
    sizeForRow(entry.button, size);

    // X's toolbar is a horizontal scroller: anything appended inside it gets
    // clipped. Sit just after the scroller so we stay on the same row.
    if (toolbar.row.getAttribute('data-testid') === 'ScrollSnap-List') {
      const scroller = toolbar.row.parentElement ?? toolbar.row;
      const host = scroller.parentElement ?? scroller;
      host.insertBefore(entry.button, scroller.nextSibling);
    } else {
      // End of the icon group: immediately after the right-most real icon.
      // When the icon already sits in a group (the common case), insert beside
      // it so the group's own gap and padding apply; otherwise step out to the
      // icon's wrapper inside the row. Only fall back to Send when no icon exists.
      const submitWrapper = submit ? childOfRow(toolbar.row, submit) : null;
      const anchorWrapper = childOfRow(toolbar.row, anchor);
      if (anchor !== submit) {
        // Sit at the row's own level, after the wrapper that holds the last icon.
        // Inserting *inside* that wrapper lets a platform re-render wrap the ✦
        // together with the icon (LinkedIn's GIF control), stacking the two.
        if (anchorWrapper) anchorWrapper.after(entry.button);
        else anchor.after(entry.button);
      } else if (submitWrapper) {
        toolbar.row.insertBefore(entry.button, submitWrapper);
      } else {
        toolbar.row.appendChild(entry.button);
      }
    }

    // If the row itself has no room after the last icon the ✦ can be clipped.
    // Compare against the row's own box, not the editor: a toolbar can sit
    // beside the editor (Facebook's inline comment box) and still have room.
    const rowBox = toolbar.row.getBoundingClientRect();
    const placed = entry.button.getBoundingClientRect();
    if (
      placed.width > 0 &&
      icons.length >= 2 &&
      (placed.right > rowBox.right + 1 || placed.left < rowBox.left - 1)
    ) {
      icons.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const first = icons[0];
      const firstWrapper = childOfRow(toolbar.row, first);
      if (firstWrapper) toolbar.row.insertBefore(entry.button, firstWrapper);
      else first.parentElement?.insertBefore(entry.button, first);
    }

    const align = () => {
      if (!entry.button.isConnected) return;
      entry.button.style.transform = 'none';
      const anchorRect = anchor.getBoundingClientRect();
      const ours = entry.button.getBoundingClientRect();
      const delta = anchorRect.top + anchorRect.height / 2 - (ours.top + ours.height / 2);
      if (Number.isFinite(delta) && Math.abs(delta) > 0.5) {
        entry.button.style.transform = `translateY(${delta}px)`;
      }
    };
    window.requestAnimationFrame(() => {
      align();
      // Self-heal: if the row hid or clipped the button, put it next to the
      // editor instead of leaving the composer without a ✦.
      if (!isUsableButton(entry.button)) {
        const parent = entry.editor.parentElement;
        if (parent) {
          sizeForRow(entry.button, 26);
          parent.insertBefore(entry.button, entry.editor);
        }
      }
    });

    return entry.button.isConnected;
  }

  if (entry.mode === 'dm') {
    const parent = entry.editor.parentElement;
    if (!parent) return false;
    sizeForRow(entry.button, 28);
    parent.insertBefore(entry.button, entry.editor);
    return entry.button.isConnected;
  }

  const container = findCommentContainer(entry.editor);
  if (!container) return false;
  container.appendChild(entry.button);
  return entry.button.isConnected;
}
