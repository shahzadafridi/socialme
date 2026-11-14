import type { Mode } from '@/lib/ui/composer/types';

export interface Entry {
  editor: HTMLElement;
  button: HTMLButtonElement;
  busy: boolean;
  port: any;
  text: string;
  mode: Mode;
  resetTimer?: number;
}


export const SPARKLE = `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true" style="display:block">
  <path d="M8 1.4l1.5 4.5 4.5 1.5-4.5 1.5L8 13.4 6.5 8.9 2 7.4l4.5-1.5L8 1.4z"
        fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.1"
        stroke-linejoin="round"/>
</svg>`;

export function styleButton(button: HTMLButtonElement): void {
  button.style.cssText = [
    'all: unset',
    'box-sizing: border-box',
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'width: 32px',
    'height: 32px',
    'border-radius: 50%',
    'color: var(--socialme-glyph, #5b5b5b)',
    'cursor: pointer',
    'flex: none',
    'margin: 0',
    'line-height: 0',
    'transition: background .14s ease, color .14s ease',
  ].join(';');
  button.innerHTML = SPARKLE;
}

export function setState(entry: Entry, state: 'idle' | 'busy' | 'done' | 'error', message?: string): void {
  const { button } = entry;
  if (entry.resetTimer) window.clearTimeout(entry.resetTimer);
  button.style.opacity = '1';

  if (state === 'idle') {
    button.innerHTML = SPARKLE;
    button.title =
      entry.mode === 'dm'
        ? 'SocialMe — draft a reply to this conversation'
        : 'SocialMe — write this comment in your voice';
    button.setAttribute(
      'aria-label',
      entry.mode === 'dm' ? 'SocialMe: draft a message reply' : 'SocialMe: write this comment',
    );
  } else if (state === 'busy') {
    button.textContent = '···';
    button.title = 'Writing… click to stop';
    button.style.opacity = '0.75';
  } else if (state === 'done') {
    button.textContent = '✓';
    button.title = 'Draft ready — edit it, then send';
    button.style.color = '#0f9d63';
    entry.resetTimer = window.setTimeout(() => {
      button.style.color = '';
      setState(entry, 'idle');
    }, 1600);
  } else {
    button.textContent = '!';
    button.title = message ?? 'Something went wrong';
    button.style.color = '#d64545';
    entry.resetTimer = window.setTimeout(() => {
      button.style.color = '';
      setState(entry, 'idle');
    }, 3000);
  }
}
