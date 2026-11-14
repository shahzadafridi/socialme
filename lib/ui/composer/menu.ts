import type { MenuChoice, Mode } from '@/lib/ui/composer/types';
import type { Entry } from '@/lib/ui/composer/button';

const TONE_OPTIONS: Record<Mode, string[]> = {
  comment: ['Default', 'Natural', 'Friendly', 'Formal', 'Confident', 'Concise', 'Contrarian', 'Curious'],
  dm: ['Default', 'Natural', 'Friendly', 'Formal', 'Concise', 'Follow-up', 'Confident', 'Empathetic'],
  note: ['Default', 'Warm', 'Direct', 'Curious', 'Professional', 'Concise', 'Confident'],
};

const MODE_TITLE: Record<Mode, string> = {
  comment: 'Comment',
  dm: 'Reply',
  note: 'Connection note',
};

/**
 * Popover anchored to the icon: optional instruction + tone, then generate.
 * Clicking a tone starts generation; Enter in the instruction box does too.
 */
export function openToneMenu(entry: Entry): Promise<MenuChoice | null> {
  return new Promise((resolve) => {
    const options = TONE_OPTIONS[entry.mode] ?? TONE_OPTIONS.comment;
    const menu = document.createElement('div');
    menu.className = 'socialme-tone-menu';
    menu.setAttribute('role', 'menu');
    menu.style.cssText = [
      'position: fixed',
      'z-index: 2147483002',
      'width: 236px',
      'max-height: calc(100vh - 24px)',
      'overflow-y: auto',
      'overscroll-behavior: contain',
      'background: #14171f',
      'color: #e9ecf3',
      'border: 1px solid #2a2f3a',
      'border-radius: 12px',
      'padding: 6px',
      'box-shadow: 0 16px 40px rgba(0,0,0,.55)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
      'font-size: 12.5px',
      'line-height: 1.2',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = MODE_TITLE[entry.mode] ?? 'Comment';
    title.style.cssText =
      'padding:6px 8px 5px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c8598';
    menu.appendChild(title);

    const input = document.createElement('input');
    input.className = 'socialme-tone-input';
    input.type = 'text';
    input.placeholder = 'Add an instruction (optional)';
    input.setAttribute('aria-label', 'Custom instruction for this reply');
    input.style.cssText = [
      'all: unset',
      'box-sizing: border-box',
      'display: block',
      'width: 100%',
      'padding: 7px 9px',
      'border-radius: 8px',
      'background: #1b1f29',
      'border: 1px solid #2a2f3a',
      'color: #e9ecf3',
      'font: inherit',
      'font-size: 12.5px',
    ].join(';');
    menu.appendChild(input);

    const hint = document.createElement('div');
    hint.textContent =
      entry.mode === 'note'
        ? 'e.g. we met at the Berlin meetup, keep it short'
        : 'e.g. mention my portfolio, keep it under 2 lines';
    hint.style.cssText = 'padding:4px 9px 6px;font-size:10.5px;color:#5f6879';
    menu.appendChild(hint);

    let settled = false;
    const close = (value: MenuChoice | null) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      menu.remove();
      resolve(value);
    };

    const pick = (tone: string) => {
      const instruction = input.value.trim();
      close({ tone, instruction });
    };

    for (const option of options) {
      const row = document.createElement('button');
      row.type = 'button';
      row.setAttribute('role', 'menuitem');
      row.textContent = option;
      row.style.cssText = [
        'all: unset',
        'display:block',
        'width:100%',
        'box-sizing:border-box',
        'padding:6px 9px',
        'border-radius:7px',
        'cursor:pointer',
        'color:#e9ecf3',
        'font:inherit',
      ].join(';');
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(124,108,255,.18)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });
      row.addEventListener('mousedown', (event) => event.preventDefault());
      row.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        pick(option);
      });
      menu.appendChild(row);
    }

    const footer = document.createElement('button');
    footer.type = 'button';
    footer.className = 'socialme-tone-generate';
    footer.textContent = 'Generate';
    footer.style.cssText = [
      'all: unset',
      'box-sizing: border-box',
      'display: block',
      'width: 100%',
      'margin-top: 6px',
      'padding: 8px 10px',
      'border-radius: 8px',
      'text-align: center',
      'font: inherit',
      'font-weight: 650',
      'color: #fff',
      'background: linear-gradient(135deg,#7c6cff,#5c4fe0)',
      'cursor: pointer',
    ].join(';');
    footer.addEventListener('mousedown', (event) => event.preventDefault());
    footer.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pick('Default');
    });
    menu.appendChild(footer);

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        pick('Default');
      }
    });

    const rect = entry.button.getBoundingClientRect();
    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(window.innerWidth - menuRect.width - 8, rect.right - menuRect.width),
    );
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceAbove > menuRect.height + 12 || spaceAbove > spaceBelow;
    const top = placeAbove
      ? Math.max(8, rect.top - menuRect.height - 8)
      : Math.min(window.innerHeight - menuRect.height - 8, rect.bottom + 8);

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(Math.max(8, top))}px`;

    const onOutside = (event: MouseEvent) => {
      if (!menu.contains(event.target as Node) && event.target !== entry.button) close(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(null);
    };
    // No scroll-close: pages fire background scroll events while the menu is open.
    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
  });
}
