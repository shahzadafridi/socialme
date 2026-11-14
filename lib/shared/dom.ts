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
  if (!el || !(el instanceof HTMLElement)) return false;
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
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
