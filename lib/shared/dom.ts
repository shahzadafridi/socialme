export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  }) as T;
}

export function isVisible(el: Element | null | undefined): boolean {
  // LinkedIn adopts its invitation form from a same-origin iframe. Its nodes
  // keep that iframe's prototypes even after ownerDocument becomes this page.
  if (!el || el.nodeType !== 1) return false;
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

export function isTextArea(el: Element | null | undefined): el is HTMLTextAreaElement {
  return el?.tagName === 'TEXTAREA';
}

export function isTextControl(el: Element | null | undefined): el is HTMLTextAreaElement | HTMLInputElement {
  return isTextArea(el) || el?.tagName === 'INPUT';
}

/** Use the field's real limit, including LinkedIn's nearby 0/200 counter. */
export function editorCharacterLimit(editor: HTMLElement, fallback: number): number {
  const attribute = Number(editor.getAttribute?.('maxlength'));
  if (Number.isFinite(attribute) && attribute > 0) return Math.min(fallback, Math.floor(attribute));
  let parent = editor.parentElement;
  for (let depth = 0; parent && depth < 2; depth += 1, parent = parent.parentElement) {
    const matches = [...(parent.innerText ?? '').matchAll(/(?:^|\n)\s*\d+\s*\/\s*(\d+)\s*(?=\n|$)/g)];
    if (matches.length === 1) {
      const limit = Number(matches[0][1]);
      if (limit > 0 && Number.isFinite(limit)) return Math.min(fallback, limit);
    }
  }
  return fallback;
}

const OWN_HOST = 'socialme-shadow-host';

/**
 * Walk component roots, including LinkedIn's closed invitation component when
 * Chrome exposes its documented extension-only DOM API. No extra permissions.
 */
export function deepQueryAll<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  const found: T[] = [];
  const extensionDom = (globalThis as { chrome?: { dom?: {
    openOrClosedShadowRoot?: (element: HTMLElement) => ShadowRoot | null;
  } } }).chrome?.dom;
  const walk = (node: ParentNode) => {
    found.push(...Array.from(node.querySelectorAll<T>(selector)));
    for (const el of Array.from(node.querySelectorAll<HTMLElement>('*'))) {
      if (el.id === OWN_HOST) continue;
      let shadow = el.shadowRoot;
      if (!shadow) {
        try { shadow = extensionDom?.openOrClosedShadowRoot?.(el) ?? null; }
        catch { /* Other browsers and non-HTML hosts keep the normal path. */ }
      }
      if (shadow) walk(shadow as unknown as ParentNode);
    }
  };
  walk(root);
  return found;
}

/** The tree a node really lives in (its shadow root, or the document). */
export function rootOf(node: Node): ParentNode {
  const root = node.getRootNode();
  return ((root as ShadowRoot).host ? root : document) as ParentNode;
}

export async function waitFor<T>(
  probe: () => T | null | undefined,
  { timeout = 6000, interval = 120 }: { timeout?: number; interval?: number } = {},
): Promise<T | null> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = probe();
    if (value) return value;
    await sleep(interval);
  }
  return probe() ?? null;
}

export function findByLabel(
  root: ParentNode,
  labels: RegExp,
  selector = 'button, [role="button"], a',
): HTMLElement | null {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return (
    nodes.find((node) => {
      const hay = `${node.getAttribute('aria-label') ?? ''} ${node.innerText ?? ''}`;
      return labels.test(hay) && isVisible(node);
    }) ?? null
  );
}

export function findByText(
  root: ParentNode,
  text: RegExp,
  selector = 'button, [role="button"], [role="link"], a, div[tabindex]',
): HTMLElement | null {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return nodes.find((node) => text.test(node.innerText ?? '') && isVisible(node)) ?? null;
}

/** Walk up until the ancestor has at least `count` interactive children. */
export function closestWithChildren(
  el: HTMLElement | null,
  count: number,
  maxDepth = 5,
): HTMLElement | null {
  let node: HTMLElement | null = el;
  let depth = 0;
  while (node && depth < maxDepth) {
    const interactive = node.querySelectorAll('[role="button"], button').length;
    if (interactive >= count) return node;
    node = node.parentElement;
    depth += 1;
  }
  return el?.parentElement ?? null;
}

export function textLength(el: HTMLElement | null): number {
  return (el?.innerText ?? '').trim().length;
}

/** Remove elements from a list that are nested inside another element in the list. */
export function dropNested<T extends HTMLElement>(nodes: T[]): T[] {
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)));
}

export function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * Math.max(0, max - min));
}
