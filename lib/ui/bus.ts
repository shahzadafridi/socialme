/**
 * Bridge between page-level UI (inline ✦ buttons injected into the feed) and the React panel.
 * Uses DOM events rather than module state so it cannot break if the bundle is split.
 */

export type OpenPayload = { el: HTMLElement | null };

export const OPEN_EVENT = 'socialme:open';
export const TOGGLE_EVENT = 'socialme:toggle';

export function requestOpen(payload: OpenPayload): void {
  document.dispatchEvent(new CustomEvent<OpenPayload>(OPEN_EVENT, { detail: payload }));
}

export function requestToggle(): void {
  document.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
}
