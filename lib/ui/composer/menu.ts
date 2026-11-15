import type { MenuChoice, Mode } from '@/lib/ui/composer/types';
import type { Entry } from '@/lib/ui/composer/button';
import { assistantAction } from '@/lib/features/assistant/store';
import type { Channel, PlatformId } from '@/lib/core/types';

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

export interface ToneMenuOptions {
  personas: Array<{ id: string; name: string; emoji: string }>;
  personaId: string;
  /** Effective tone for this platform; empty means the persona's own tone. */
  tone: string;
  context?: string;
  draft?: string;
  exampleContext?: { platform: PlatformId; channel: Channel; source: string };
}

function sectionLabel(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText =
    'margin:9px 2px 5px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c8598';
  return el;
}

/**
 * Popover anchored to the icon: voice, tone, optional instruction, then Generate.
 * Clicking a tone highlights it; Generate (or Enter in the instruction) sends it.
 */
export function openToneMenu(entry: Entry, options: ToneMenuOptions): Promise<MenuChoice | null> {
  return new Promise((resolve) => {
    const menu = document.createElement('div');
    menu.className = 'socialme-tone-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute(
      'aria-label',
      entry.mode === 'note' ? 'Connection note options' : entry.mode === 'dm' ? 'Message options' : 'Comment options',
    );
    menu.style.cssText = [
      'position: fixed',
      'z-index: 2147483002',
      'width: 288px',
      'max-height: calc(100vh - 24px)',
      'overflow-y: auto',
      'overscroll-behavior: contain',
      'background: #14171f',
      'color: #e9ecf3',
      'border: 1px solid #2a2f3a',
      'border-radius: 14px',
      'padding: 10px',
      'box-shadow: 0 18px 44px rgba(0,0,0,.55)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
      'font-size: 12.5px',
      'line-height: 1.2',
      'outline: none',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = MODE_TITLE[entry.mode] ?? 'Comment';
    title.style.cssText =
      'padding:2px 2px 1px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a93a6';
    menu.appendChild(title);

    const context = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Source context';
    const source = document.createElement('div');
    source.textContent = options.context || 'No profile details available.';
    source.style.cssText = 'white-space:pre-wrap;max-height:180px;overflow:auto;padding-top:8px';
    context.style.cssText = 'margin:8px 2px;color:#b7bfd0;font-size:11px;line-height:1.5';
    context.append(summary, source);
    menu.appendChild(context);

    // --- Voice -------------------------------------------------------------
    menu.appendChild(sectionLabel('Voice'));
    const voice = document.createElement('select');
    voice.className = 'socialme-voice-select';
    voice.setAttribute('aria-label', 'Voice for this reply');
    voice.style.cssText = [
      'all: unset',
      'box-sizing: border-box',
      'display: block',
      'width: 100%',
      'padding: 8px 10px',
      'border-radius: 9px',
      'background: #1b1f29',
      'border: 1px solid #2a2f3a',
      'color: #e9ecf3',
      'font: inherit',
      'font-size: 12.5px',
      'cursor: pointer',
    ].join(';');
    for (const persona of options.personas) {
      const option = document.createElement('option');
      option.value = persona.id;
      option.textContent = `${persona.emoji ? `${persona.emoji} ` : ''}${persona.name}`;
      voice.appendChild(option);
    }
    voice.value = options.personaId;
    let personaId = options.personaId;
    voice.addEventListener('change', () => {
      personaId = voice.value;
    });
    menu.appendChild(voice);
    if (options.draft?.trim()) {
      const sample = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Teach my voice from this reply';
      const preview = document.createElement('p');
      preview.textContent = options.draft;
      preview.style.cssText = 'white-space:pre-wrap;max-height:130px;overflow:auto';
      const save = document.createElement('button');
      save.type = 'button';
      const includeContext = document.createElement('input');
      includeContext.type = 'checkbox';
      includeContext.checked = Boolean(options.exampleContext?.source.trim());
      const includeLabel = document.createElement('label');
      includeLabel.style.cssText = 'display:flex;gap:6px;margin:8px 0;line-height:1.5';
      includeLabel.append(includeContext, document.createTextNode('Include the source and my reply as a pair'));
      const paintSave = () => { save.textContent = includeContext.checked ? 'Save source + reply example' : 'Save reply as a style example'; };
      includeContext.addEventListener('change', paintSave);
      paintSave();
      save.style.cssText = 'padding:7px;border:1px solid #596175;border-radius:6px;background:#252b3b;color:#fff;cursor:pointer';
      save.addEventListener('click', () => {
        save.disabled = true;
        void assistantAction({ kind: 'feedback', personaId,
          sample: includeContext.checked && options.exampleContext ? undefined : options.draft,
          pair: includeContext.checked && options.exampleContext ? { ...options.exampleContext, reply: options.draft! } : undefined })
          .then(() => { save.textContent = 'Saved for the selected voice'; })
          .catch((error) => { save.textContent = error.message; save.disabled = false; });
      });
      sample.style.cssText = 'margin:8px 2px;font-size:11px;line-height:1.5;color:#b7bfd0';
      sample.append(summary, preview);
      if (options.exampleContext?.source.trim()) {
        const original = document.createElement('p');
        original.textContent = `Source: ${options.exampleContext.source}`;
        original.style.cssText = 'white-space:pre-wrap;max-height:130px;overflow:auto';
        sample.append(original, includeLabel);
      }
      sample.append(save);
      menu.append(sample);
    }

    // --- Tone --------------------------------------------------------------
    menu.appendChild(sectionLabel('Tone'));
    const selectedTone = options.tone || 'Default';
    const toneList = TONE_OPTIONS[entry.mode] ?? TONE_OPTIONS.comment;
    const tones = Array.from(new Set(['Default', ...toneList]));
    if (!tones.includes(selectedTone)) tones.push(selectedTone);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:5px';

    let tone = selectedTone;
    const chips = new Map<string, HTMLButtonElement>();

    const paint = () => {
      for (const [label, chip] of chips) {
        const active = label === tone;
        chip.dataset.active = String(active);
        chip.style.background = active ? 'rgba(124,108,255,.22)' : 'transparent';
        chip.style.borderColor = active ? 'rgba(124,108,255,.65)' : 'rgba(255,255,255,.09)';
        chip.style.color = active ? '#ffffff' : '#e9ecf3';
      }
    };

    for (const label of tones) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'socialme-tone-chip';
      chip.textContent = label;
      chip.style.cssText = [
        'all: unset',
        'box-sizing: border-box',
        'padding: 7px 9px',
        'border-radius: 8px',
        'border: 1px solid rgba(255,255,255,.09)',
        'background: transparent',
        'color: #e9ecf3',
        'font: inherit',
        'font-size: 12px',
        'text-align: left',
        'cursor: pointer',
      ].join(';');
      chip.addEventListener('mousedown', (event) => event.preventDefault());
      chip.addEventListener('mouseenter', () => {
        if (label !== tone) chip.style.background = 'rgba(255,255,255,.05)';
      });
      chip.addEventListener('mouseleave', () => {
        if (label !== tone) chip.style.background = 'transparent';
      });
      chip.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        tone = label;
        paint();
      });
      chips.set(label, chip);
      grid.appendChild(chip);
    }
    paint();
    menu.appendChild(grid);

    menu.appendChild(sectionLabel('My rough thought (optional)'));
    const thought = document.createElement('textarea');
    thought.className = 'socialme-rough-thought';
    thought.setAttribute('aria-label', 'My rough thought');
    thought.placeholder = 'e.g. Agree, but migration costs matter';
    thought.maxLength = 1200;
    thought.rows = 2;
    thought.style.cssText = 'box-sizing:border-box;display:block;width:100%;padding:8px 10px;border-radius:9px;background:#1b1f29;border:1px solid #2a2f3a;color:#e9ecf3;font:inherit;line-height:1.5;resize:vertical';
    menu.append(thought);
    if (options.draft?.trim()) {
      const useDraft = document.createElement('button');
      useDraft.type = 'button';
      useDraft.textContent = 'Use my existing reply as the rough thought';
      useDraft.style.cssText = 'border:0;background:transparent;color:#b7bfd0;font:inherit;font-size:11px;padding:6px 0;cursor:pointer';
      useDraft.onclick = () => { thought.value = options.draft!.trim().slice(0, 1200); thought.focus(); };
      menu.append(useDraft);
    }

    // --- Instruction -------------------------------------------------------
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
      'margin-top: 10px',
      'padding: 8px 10px',
      'border-radius: 9px',
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
    hint.style.cssText = 'padding:5px 2px 8px;font-size:10.5px;color:#5f6879';
    menu.appendChild(hint);

    // --- Generate ----------------------------------------------------------
    const footer = document.createElement('button');
    footer.type = 'button';
    footer.className = 'socialme-tone-generate';
    footer.textContent = 'Generate';
    footer.style.cssText = [
      'all: unset',
      'box-sizing: border-box',
      'display: block',
      'width: 100%',
      'padding: 9px 10px',
      'border-radius: 9px',
      'text-align: center',
      'font: inherit',
      'font-weight: 650',
      'color: #fff',
      'background: linear-gradient(135deg,#7c6cff,#5c4fe0)',
      'cursor: pointer',
    ].join(';');
    footer.addEventListener('mousedown', (event) => event.preventDefault());

    let settled = false;
    const close = (value: MenuChoice | null) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      menu.remove();
      resolve(value);
    };

    const generate = () => {
      close({ tone, instruction: input.value.trim(), personaId, roughThought: thought.value.trim() || undefined });
    };

    footer.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      generate();
    });
    menu.appendChild(footer);

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        generate();
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

    input.focus({ preventScroll: true });
  });
}
