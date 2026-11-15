import { browser } from 'wxt/browser';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import { findToolbar } from '@/lib/ui/composer/placement';

export const HEALTH_KEY = 'socialme.health.v1';

export type SurfaceMode = 'comment' | 'dm' | 'note';

export interface SurfaceHealth {
  mode: SurfaceMode;
  editors: number;
  /** Where the reply text goes. */
  editor: string;
  /** Icon row located for the inline button. */
  toolbar: boolean;
  strategy: string;
  /** Send/Comment control found next to the editor. */
  submit: boolean;
  /** The post or thread above the box could be read. */
  context: boolean;
  /** Where the inline ✦ actually landed (size, position, parent). */
  button: string;
  /** False when the button is missing, hidden, zero-sized or clipped away. */
  buttonVisible: boolean;
  ok: boolean;
}

export interface PlatformHealth {
  platform: string;
  url: string;
  version: string;
  ts: number;
  surfaces: SurfaceHealth[];
  problems: string[];
  /** True when every surface that should be present works. */
  ok: boolean;
}

function describeEditor(editor: HTMLElement): string {
  const tag = editor.tagName.toLowerCase();
  const id =
    editor.getAttribute('data-testid') ??
    editor.getAttribute('aria-label') ??
    editor.getAttribute('placeholder') ??
    '';
  const root = editor.getRootNode();
  const shadow = root instanceof ShadowRoot ? ' (shadow)' : '';
  return `${tag}${id ? `[${id.slice(0, 40)}]` : ''}${shadow}`;
}

function describeQuickButton(): string {
  const button = document.querySelector<HTMLElement>('.socialme-quick');
  if (!button) return 'missing';
  const rect = button.getBoundingClientRect();
  const parent = button.parentElement;
  const cls = String(parent?.className ?? '')
    .split(/\s+/)
    .slice(0, 2)
    .join('.');
  return `${Math.round(rect.width)}x${Math.round(rect.height)} @${Math.round(rect.left)},${Math.round(rect.top)} in ${parent?.tagName ?? '?'}${cls ? `.${cls}` : ''}`;
}

function submitNear(editor: HTMLElement): boolean {
  const rows = new Set<HTMLElement>();

  const found = findToolbar(editor)?.row;
  if (found) rows.add(found);
  if (editor.parentElement) rows.add(editor.parentElement);

  return Array.from(rows).some((row) =>
    Array.from(row.querySelectorAll<HTMLElement>('button, [role="button"]')).some((node) =>
      /^(send|comment|post|reply|share)/i.test(
        `${node.getAttribute('aria-label') ?? ''} ${node.innerText ?? ''}`.trim(),
      ),
    ),
  );
}

function inspect(
  adapter: PlatformAdapter,
  editor: HTMLElement,
  mode: SurfaceMode,
): SurfaceHealth {
  const toolbar = findToolbar(editor);
  const strategy = editor.tagName === 'TEXTAREA' ? 'textarea-field' : (toolbar?.strategy ?? 'none');

  let context = false;
  try {
    if (mode === 'dm') {
      context = Boolean(adapter.readConversation(editor, 1)?.text);
    } else if (mode === 'note') {
      const recipient = adapter.readNoteRecipient?.(editor);
      context = Boolean(recipient?.name || recipient?.headline);
    } else {
      const postEl = adapter.postForEditor(editor);
      const post = postEl ? adapter.readPost(postEl) : null;
      context = Boolean(post && (post.text || post.author));
    }
  } catch {
    context = false;
  }

  const submit = Boolean(adapter.submitButton(editor)) || submitNear(editor);

  return {
    mode,
    editors: 1,
    editor: describeEditor(editor),
    toolbar: Boolean(toolbar) || editor.tagName === 'TEXTAREA',
    strategy,
    submit,
    context,
    button: describeQuickButton(),
    buttonVisible: (() => {
      const button = document.querySelector<HTMLElement>('.socialme-quick');
      if (!button || !button.isConnected) return false;
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 8 &&
        rect.height > 8
      );
    })(),
    ok: (Boolean(toolbar) || editor.tagName === 'TEXTAREA') && context,
  };
}

/**
 * What the adapters can actually reach right now. A platform redesign shows up
 * here as a failed surface long before a user writes in.
 */
export function checkPlatformHealth(adapter: PlatformAdapter): PlatformHealth {
  const surfaces: SurfaceHealth[] = [];
  const problems: string[] = [];

  try {
    const editors = adapter.findOpenEditors();
    for (const editor of editors.slice(0, 2)) {
      surfaces.push(inspect(adapter, editor, 'comment'));
    }
  } catch (error) {
    problems.push(`comment editors: ${(error as Error)?.message ?? error}`);
  }

  try {
    const composers = adapter.findMessageComposers();
    for (const editor of composers.slice(0, 2)) {
      surfaces.push(inspect(adapter, editor, 'dm'));
    }
  } catch (error) {
    problems.push(`message composers: ${(error as Error)?.message ?? error}`);
  }

  try {
    const notes = adapter.findNoteEditors?.() ?? [];
    for (const editor of notes.slice(0, 2)) {
      surfaces.push(inspect(adapter, editor, 'note'));
    }
  } catch (error) {
    problems.push(`connection notes: ${(error as Error)?.message ?? error}`);
  }

  for (const surface of surfaces) {
    if (!surface.toolbar) problems.push(`${surface.mode}: icon row not found`);
    if (!surface.context) {
      const subject =
        surface.mode === 'dm' ? 'thread' : surface.mode === 'note' ? 'recipient' : 'post';
      problems.push(`${surface.mode}: ${subject} not readable`);
    }
    if (!surface.submit) problems.push(`${surface.mode}: send control not found`);
    if (!surface.buttonVisible) problems.push(`${surface.mode}: ✦ button missing or hidden`);
  }

  return {
    platform: adapter.id,
    url: location.href.slice(0, 180),
    version: browser.runtime.getManifest().version,
    ts: Date.now(),
    surfaces,
    problems,
    ok: problems.length === 0,
  };
}

/** Persist the newest snapshot per platform so the options page can show it. */
export async function saveHealth(health: PlatformHealth): Promise<void> {
  try {
    const stored = await browser.storage.local.get(HEALTH_KEY);
    const map = (stored[HEALTH_KEY] as Record<string, PlatformHealth> | undefined) ?? {};
    map[health.platform] = health;
    await browser.storage.local.set({ [HEALTH_KEY]: map });
  } catch {
    // Storage is best-effort; never break the page over diagnostics.
  }
}

export async function readHealth(): Promise<Record<string, PlatformHealth>> {
  const stored = await browser.storage.local.get(HEALTH_KEY);
  return (stored[HEALTH_KEY] as Record<string, PlatformHealth> | undefined) ?? {};
}
