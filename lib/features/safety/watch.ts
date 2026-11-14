import { WARNING_PATTERNS } from '@/lib/core/constants';
import { debounce } from '@/lib/shared/dom';

let warning: string | null = null;
let dismissed = false;
const listeners = new Set<(message: string | null) => void>();

function notify(): void {
  for (const listener of listeners) listener(dismissed ? null : warning);
}

export function getWarning(): string | null {
  return dismissed ? null : warning;
}

export function subscribeWarning(listener: (message: string | null) => void): () => void {
  listeners.add(listener);
  listener(getWarning());
  return () => listeners.delete(listener);
}

export function dismissWarning(): void {
  dismissed = true;
  notify();
}

export function clearWarning(): void {
  warning = null;
  dismissed = false;
  notify();
}

function hasCaptcha(): boolean {
  return Boolean(
    document.querySelector(
      'iframe[src*="captcha" i], iframe[title*="captcha" i], [id*="captcha" i], [class*="captcha" i]',
    ),
  );
}

/**
 * Looks only at small, high-signal regions (alerts, dialogs, live regions) instead of
 * the whole feed, so this stays cheap on a busy timeline.
 */
export function scanForWarnings(): string | null {
  if (document.hidden) return warning;

  if (hasCaptcha()) {
    warning =
      'A verification challenge is on the page. Solve it manually and let the account rest before continuing.';
    dismissed = false;
    notify();
    return warning;
  }

  const nodes = document.querySelectorAll<HTMLElement>(
    '[role="alert"], [role="dialog"], [aria-live="polite"], [aria-live="assertive"]',
  );

  for (const node of Array.from(nodes).slice(0, 12)) {
    const text = (node.innerText ?? '').slice(0, 600);
    if (!text) continue;
    const hit = WARNING_PATTERNS.find((pattern) => pattern.test(text));
    if (hit) {
      warning = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 2).join(' ');
      dismissed = false;
      notify();
      return warning;
    }
  }

  return warning;
}

/** Watches the page for restriction banners for as long as the tab is open. */
export function startWarningWatch(): () => void {
  const scan = debounce(scanForWarnings, 1200);
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const interval = window.setInterval(scanForWarnings, 20_000);
  scanForWarnings();

  return () => {
    observer.disconnect();
    window.clearInterval(interval);
  };
}
