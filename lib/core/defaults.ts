import { PROVIDER_PRESETS } from '@/lib/core/constants';
import type { Brand, Persona, ProviderId, SafetySettings, Settings } from '@/lib/core/types';

export function newId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function persona(overrides: Partial<Persona> & { id: string; name: string }): Persona {
  return {
    emoji: '',
    role: '',
    niche: '',
    audience: '',
    tone: 'Direct and practical',
    styleNotes: '',
    avoid: '',
    bannedWords: '',
    samplePosts: '',
    emojiLevel: 'none',
    hashtagLevel: 'light',
    cta: '',
    replyMaxChars: 700,
    postMaxChars: 1800,
    signOff: '',
    language: 'auto',
    ...overrides,
  };
}

export const STARTER_PERSONAS: Persona[] = [
  persona({
    id: 'p_default',
    name: 'My voice',
    emoji: '🙂',
    tone: 'Direct and practical',
    styleNotes:
      'Short sentences. Concrete examples over abstractions. Admit uncertainty when it exists. Never pitch in comments.',
    avoid: 'Hype, corporate jargon, motivational fluff, emoji spam.',
    bannedWords: 'game-changer, synergy, leverage, delve',
    replyMaxChars: 500,
    postMaxChars: 1400,
    hashtagLevel: 'light',
  }),
  persona({
    id: 'p_expert',
    name: 'Thought leader',
    emoji: '🧠',
    role: 'Operator with 8 years of hands-on experience',
    tone: 'Analytical and precise',
    niche: 'Product, growth and building software teams',
    audience: 'Founders, product leads and engineers',
    styleNotes:
      'Lead with the claim, then the evidence, then the implication. Use one specific number when possible. Sound like someone who has shipped, not someone who has read about it.',
    avoid: 'Generic advice, hedging, listicles in comments.',
    replyMaxChars: 700,
    postMaxChars: 1800,
    hashtagLevel: 'light',
  }),
  persona({
    id: 'p_casual',
    name: 'Casual peer',
    emoji: '⚡',
    tone: 'Warm and conversational',
    styleNotes:
      'Talk like a friend in a group chat. One idea per message. Lowercase is fine. Never more than 3 sentences.',
    avoid: 'Long paragraphs, formal transitions, buzzwords.',
    replyMaxChars: 300,
    postMaxChars: 900,
    emojiLevel: 'light',
    hashtagLevel: 'none',
  }),
];

export function makeProvider(id: ProviderId, overrides: Partial<Settings['providers'][number]> = {}) {
  const preset = PROVIDER_PRESETS[id];
  return {
    id,
    enabled: overrides.enabled ?? true,
    baseUrl: overrides.baseUrl ?? preset.baseUrl,
    model: overrides.model ?? preset.defaultModel,
    temperature: overrides.temperature ?? (preset.kind === 'anthropic' ? 0.8 : 0.85),
  };
}

export const DEFAULT_BRAND: Brand = {
  name: '',
  positioning: '',
  pillars: '',
  proof: '',
  pov: '',
  offer: '',
  stories: '',
  goals: '',
  forbidden: '',
};

export const DEFAULT_SAFETY: SafetySettings = {
  humanTyping: true,
  typingSpeed: 'natural',
  minActionGapSec: 90,
  maxActionsPerHour: 6,
  maxActionsPerDay: 20,
  pauseOnWarning: true,
  warmupDays: 0,
};

export function defaultSettings(): Settings {
  return {
    version: 2,
    onboarded: false,
    providers: [
      makeProvider('deepseek'),
      makeProvider('openai'),
      makeProvider('openrouter'),
      makeProvider('gemini'),
      makeProvider('anthropic'),
      makeProvider('ollama'),
      makeProvider('custom'),
    ],
    activeProvider: 'deepseek',
    brand: { ...DEFAULT_BRAND },
    personas: STARTER_PERSONAS,
    activePersonaId: 'p_default',
    platformPersona: {
      linkedin: 'inherit',
      x: 'inherit',
      facebook: 'inherit',
    },
    defaults: {
      angle: 'insight',
      tone: '',
      replyLength: 'medium',
      postLength: 'medium',
      extraInstruction: '',
    },
    outputMode: 'review',
    platformOutputMode: {
      linkedin: 'inherit',
      x: 'inherit',
      facebook: 'inherit',
    },
    autoSubmit: {
      enabled: false,
      minDelayMs: 1200,
      maxDelayMs: 3500,
      requireConfirm: true,
    },
    safety: { ...DEFAULT_SAFETY },
    dmContext: 'last3',
    showComposerButton: true,
    theme: 'dark',
    historyEnabled: true,
    telemetry: false,
  };
}

/** Merge stored settings over current defaults so new fields appear after upgrades. */
export function mergeSettings(stored: unknown): Settings {
  const base = defaultSettings();
  if (!stored || typeof stored !== 'object') return base;
  const input = stored as Partial<Settings>;

  const providers = base.providers.map((p) => {
    const found = input.providers?.find((x) => x?.id === p.id);
    return found ? { ...p, ...found } : p;
  });
  // Keep any custom provider entries the user added beyond the presets.
  for (const extra of input.providers ?? []) {
    if (extra?.id && !providers.some((p) => p.id === extra.id)) {
      providers.push({ ...makeProvider('custom'), ...extra });
    }
  }

  const migrated = input.version === undefined || input.version < 2;

  return {
    ...base,
    ...input,
    version: 2,
    providers,
    brand: { ...base.brand, ...(input.brand ?? {}) },
    personas: input.personas?.length ? input.personas : base.personas,
    defaults: { ...base.defaults, ...(input.defaults ?? {}) },
    platformPersona: { ...base.platformPersona, ...(input.platformPersona ?? {}) },
    platformOutputMode: { ...base.platformOutputMode, ...(input.platformOutputMode ?? {}) },
    autoSubmit: { ...base.autoSubmit, ...(input.autoSubmit ?? {}) },
    safety: { ...base.safety, ...(input.safety ?? {}) },
  };
}
