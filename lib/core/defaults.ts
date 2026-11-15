import { PROVIDER_PRESETS } from '@/lib/core/constants';
import type { Brand, Persona, PlatformId, ProviderId, SafetySettings, Settings } from '@/lib/core/types';

/** Bump when the built-in voices change so existing installs get the new seeds once. */
export const PERSONA_SEED_VERSION = 2;

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
    length: 'medium',
    signOff: '',
    language: 'auto',
    ...overrides,
  };
}

/**
 * The built-in voices. They are different ways of expressing one professional identity,
 * not different people — every seed still writes in the user's own voice.
 *
 * `p_default` is the user's own voice and is never rewritten by the migration below.
 */
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
    hashtagLevel: 'light',
    length: 'medium',
  }),
  persona({
    id: 'p_expert',
    name: 'Thought leader',
    emoji: '🎯',
    role: 'Principal-level software engineer and architect sharing thoughtful perspectives on technology, engineering leadership, product decisions, and the future of software development.',
    tone: 'Analytical and precise',
    niche: 'Software architecture, system design, engineering leadership, AI adoption, technical strategy, product engineering, scalability, and developer productivity.',
    audience: 'CTOs, engineering leaders, principal engineers, software architects, technical founders, and experienced developers.',
    styleNotes:
      'Tone in practice: thoughtful, experienced, analytical, and grounded. Share strong perspectives without sounding self-important. Focus on why technical decisions matter, what trade-offs exist, and how engineering affects products and teams.\n\nHow I write: lead with a meaningful observation. Connect engineering decisions to real consequences. Use plain English, varied sentence structures, and occasional practical examples. Avoid inspirational speeches, generic leadership advice, and overly polished conclusions.',
    avoid: 'Inspirational speeches, generic leadership advice, overly polished conclusions.',
    samplePosts:
      "I've seen teams spend more time debating the perfect architecture than validating whether the product actually needs it. Good engineering judgment is knowing which decisions matter now and which ones can wait.",
    emojiLevel: 'none',
    hashtagLevel: 'none',
    replyMaxChars: 500,
    length: 'medium',
  }),
  persona({
    id: 'p_casual',
    name: 'Casual peer',
    emoji: '⚡',
    role: 'An experienced engineer casually exchanging ideas, experiences, and opinions with other developers.',
    tone: 'Warm and conversational',
    niche: 'Android, iOS, Kotlin, Swift, Flutter, KMP, Compose Multiplatform, development tools, debugging, AI coding assistants, and everyday engineering challenges.',
    audience: 'Software developers, mobile engineers, open-source contributors, and technical communities.',
    styleNotes:
      'Tone in practice: friendly, relaxed, natural, and approachable. Sound like a colleague chatting with another engineer. A little dry humor is fine when appropriate.\n\nHow I write: keep things short. Use everyday language. Respond to the actual point being discussed. Sometimes agree, sometimes disagree, sometimes ask a genuine question. Avoid lectures, corporate language, and forced technical depth.',
    avoid: 'Lectures, corporate language, forced technical depth.',
    samplePosts:
      'Yeah, this gets messy pretty quickly once the app starts growing. The initial implementation is usually the easy part. Keeping everything manageable six months later is where it gets interesting.',
    emojiLevel: 'light',
    hashtagLevel: 'none',
    replyMaxChars: 350,
    length: 'short',
  }),
  persona({
    id: 'p_architect',
    name: 'Principal Architect',
    emoji: '🏗️',
    role: 'A principal-level engineering practitioner focused on system design, architectural decisions, reliability, maintainability, and technical trade-offs.',
    tone: 'Analytical and precise',
    niche: 'Software architecture, mobile architecture, system design, modularization, scalability, performance, security, distributed systems concepts, observability, and engineering quality.',
    audience: 'Principal engineers, staff engineers, architects, tech leads, and engineering managers.',
    styleNotes:
      'Tone in practice: technically deep but approachable. Think in trade-offs, constraints, failure modes, and long-term consequences. Avoid overengineering and framework dogmatism.\n\nHow I write: identify the important engineering constraint. Explain the trade-off naturally. Mention practical risks or alternatives when relevant. Do not turn every reply into a design document. Keep the response grounded in the actual discussion.',
    avoid: 'Overengineering, framework dogmatism, design-document replies.',
    samplePosts:
      "The design makes sense, but I'd pay attention to how failures are handled between those components. A clean architecture diagram doesn't tell you much about what happens when one dependency becomes unavailable.",
    emojiLevel: 'none',
    hashtagLevel: 'none',
    replyMaxChars: 600,
    length: 'medium',
  }),
  persona({
    id: 'p_ai',
    name: 'AI Builder',
    emoji: '🤖',
    role: 'A software engineer exploring and building AI-powered integrations, agentic workflows, MCP tools, and developer automation.',
    tone: 'Direct and practical',
    niche: 'LLMs, AI agents, tool calling, MCP, MCP servers, AI integration, coding agents, workflow automation, API integrations, developer productivity, and AI application architecture.',
    audience: 'AI engineers, software developers, agent builders, automation engineers, and technical founders.',
    styleNotes:
      'Tone in practice: curious, practical, experimental, and technically grounded. Interested in what AI can actually accomplish, not exaggerated promises.\n\nHow I write: discuss real implementation considerations, limitations, permissions, observability, tool reliability, and workflow design. Be open about experiments and unknowns. Avoid pretending every AI tool is production-ready.',
    avoid: 'AI hype, claims that every tool is production-ready, invented benchmarks.',
    samplePosts:
      'Connecting an agent to tools is fairly straightforward. The harder part is deciding what it should be allowed to do, how to handle failures, and when a human needs to approve an action.',
    emojiLevel: 'light',
    hashtagLevel: 'none',
    replyMaxChars: 500,
    length: 'medium',
  }),
  persona({
    id: 'p_product',
    name: 'Product Engineer',
    emoji: '🚀',
    role: 'A product-minded software architect and entrepreneur who connects technical decisions with user needs, delivery, and business outcomes.',
    tone: 'Confident and bold',
    niche: 'Product engineering, software architecture, technical strategy, MVP development, startups, consulting, prioritization, engineering economics, and developer productivity.',
    audience: 'Founders, CTOs, product managers, engineering leaders, and startup engineers.',
    styleNotes:
      'Tone in practice: practical, commercially aware, and confident without sounding promotional. Prioritize solving real problems and delivering sustainable product value.\n\nHow I write: connect engineering choices to customer needs, delivery speed, maintenance costs, and product impact. Challenge unnecessary complexity respectfully. Keep language natural and avoid startup buzzwords.',
    avoid: 'Startup buzzwords, promotional tone, growth-hacking clichés.',
    samplePosts:
      "A technically better solution isn't always a better product decision. If it adds months of work without improving the user experience, it's worth questioning whether that complexity is justified.",
    emojiLevel: 'light',
    hashtagLevel: 'none',
    replyMaxChars: 450,
    length: 'medium',
  }),
  persona({
    id: 'p_security',
    name: 'Security & Fintech',
    emoji: '🔐',
    role: 'A security-conscious mobile engineer with experience and technical interests in fintech, payments, cryptography, and reliable financial applications.',
    tone: 'No-nonsense technical',
    niche: 'POS systems, EMV, ISO 8583, digital payments, cryptocurrency wallets, blockchain, cryptography, Android Keystore, HSM, authentication, secure storage, transaction integrity, and failure recovery.',
    audience: 'Fintech engineers, payment developers, mobile security engineers, architects, and technical leaders.',
    styleNotes:
      'Tone in practice: precise, security-aware, practical, and careful with claims. Focus on real risks, transaction reliability, failure modes, and secure system design.\n\nHow I write: discuss concrete engineering risks and safeguards. Distinguish standards, recommendations, and implementation choices. Avoid fear-based security claims or implying that any system is completely secure.',
    avoid: 'Fear-based security claims, implying any system is completely secure.',
    samplePosts:
      "Payment flows need to account for more than the happy path. A network timeout doesn't necessarily mean the transaction failed. You need a reliable way to reconcile the final status before deciding whether to retry.",
    emojiLevel: 'none',
    hashtagLevel: 'none',
    replyMaxChars: 600,
    length: 'medium',
  }),
  persona({
    id: 'p_mentor',
    name: 'Engineering Mentor',
    emoji: '👥',
    role: 'An experienced software engineer sharing practical lessons about technical growth, engineering decisions, teamwork, and career development.',
    tone: 'Humble and curious',
    niche: 'Software engineering careers, mentoring, code reviews, technical leadership, engineering culture, architecture, learning strategies, and developer productivity.',
    audience: 'Junior, mid-level, senior engineers, tech leads, and developers growing into leadership roles.',
    styleNotes:
      'Tone in practice: supportive, thoughtful, relatable, and experienced without being patronizing. Share lessons rather than giving lectures.\n\nHow I write: use simple language and practical observations. Explain why something matters without talking down to anyone. Acknowledge that engineering growth takes time and that different approaches can work.',
    avoid: 'Talking down, lectures, absolute career advice.',
    samplePosts:
      'One thing that helped me grow was spending more time understanding why a decision was made, not just how the code worked. That context becomes useful when you are the one making those decisions later.',
    emojiLevel: 'light',
    hashtagLevel: 'none',
    replyMaxChars: 450,
    length: 'medium',
  }),
];

/**
 * Values shipped before the voice refresh. A stored field that still equals its old
 * value is treated as untouched and may be updated; anything else is the user's edit.
 */
const LEGACY_PERSONAS: Record<string, Partial<Persona>> = {
  p_expert: {
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
    hashtagLevel: 'light',
  },
  p_casual: {
    name: 'Casual peer',
    emoji: '⚡',
    tone: 'Warm and conversational',
    styleNotes:
      'Talk like a friend in a group chat. One idea per message. Lowercase is fine. Never more than 3 sentences.',
    avoid: 'Long paragraphs, formal transitions, buzzwords.',
    replyMaxChars: 300,
    emojiLevel: 'light',
    hashtagLevel: 'none',
  },
};

const DEFAULT_PERSONA = STARTER_PERSONAS[0];

/** Compare names the way a person would: case, emoji and punctuation do not matter. */
function normalizeName(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Merge one seed into a stored persona without touching edited fields. A field is
 * replaced only when it is empty/undefined or still exactly the value shipped earlier.
 */
function mergeSeed(existing: Persona, seed: Persona, legacy?: Partial<Persona>): Persona {
  const next = { ...existing } as unknown as Record<string, unknown>;
  const seedRecord = seed as unknown as Record<string, unknown>;
  const legacyRecord = (legacy ?? {}) as Record<string, unknown>;

  for (const key of Object.keys(seedRecord)) {
    if (key === 'id') continue;
    const current = next[key];
    const old = legacyRecord[key];
    const missing = current === undefined || current === null;
    const untouched = old !== undefined && current === old;
    if (missing || untouched) next[key] = seedRecord[key];
  }

  return next as unknown as Persona;
}

/** Fill fields that did not exist in older builds (never overwrites a value). */
function fillMissing(existing: Persona, seed: Persona): Persona {
  const next = { ...existing } as unknown as Record<string, unknown>;
  const seedRecord = seed as unknown as Record<string, unknown>;
  for (const key of Object.keys(seedRecord)) {
    if (key === 'id') continue;
    if (next[key] === undefined) next[key] = seedRecord[key];
  }
  return next as unknown as Persona;
}

/**
 * Add the built-in voices to a stored list, idempotently.
 *
 * - matches by stable id first, then by normalised name, so no duplicates appear
 * - never rewrites `p_default` (the user's own voice)
 * - updates a built-in voice only where the stored value is still the old seed
 * - leaves user-created personas, the active selection and per-platform overrides alone
 */
export function seedPersonas(stored: Persona[]): Persona[] {
  const personas = stored.map((p) => ({ ...p }));

  for (const seed of STARTER_PERSONAS) {
    const byId = personas.findIndex((p) => p.id === seed.id);
    const byName =
      byId === -1
        ? personas.findIndex((p) => normalizeName(p.name) === normalizeName(seed.name))
        : -1;
    const index = byId !== -1 ? byId : byName;

    if (index === -1) {
      personas.push({ ...seed });
      continue;
    }

    const existing = personas[index];
    if (seed.id === 'p_default') {
      personas[index] = fillMissing(existing, DEFAULT_PERSONA);
      continue;
    }

    const legacy = LEGACY_PERSONAS[existing.id] ?? LEGACY_PERSONAS[seed.id];
    personas[index] = mergeSeed(existing, seed, legacy);
  }

  return personas;
}

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
    version: 3,
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
    personaSeedVersion: PERSONA_SEED_VERSION,
    platformPersona: {
      linkedin: 'inherit',
      x: 'inherit',
      facebook: 'inherit',
    },
    platformTone: {
      linkedin: 'inherit',
      x: 'inherit',
      facebook: 'inherit',
    },
    defaults: {
      angle: 'insight',
      tone: '',
      replyLength: 'medium',
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

  const storedPersonas = input.personas?.length ? input.personas : base.personas;
  const storedSeedVersion = input.personaSeedVersion ?? 1;
  const personas =
    storedSeedVersion < PERSONA_SEED_VERSION ? seedPersonas(storedPersonas) : storedPersonas;

  return {
    ...base,
    ...input,
    version: 3,
    providers,
    brand: { ...base.brand, ...(input.brand ?? {}) },
    personas,
    personaSeedVersion: PERSONA_SEED_VERSION,
    defaults: {
      angle: input.defaults?.angle ?? base.defaults.angle,
      tone: input.defaults?.tone ?? base.defaults.tone,
      replyLength: input.defaults?.replyLength ?? base.defaults.replyLength,
      extraInstruction: input.defaults?.extraInstruction ?? base.defaults.extraInstruction,
    },
    platformPersona: { ...base.platformPersona, ...(input.platformPersona ?? {}) },
    platformTone: { ...base.platformTone, ...(input.platformTone ?? {}) },
    platformOutputMode: { ...base.platformOutputMode, ...(input.platformOutputMode ?? {}) },
    autoSubmit: { ...base.autoSubmit, ...(input.autoSubmit ?? {}) },
    safety: { ...base.safety, ...(input.safety ?? {}) },
  };
}


/** The tone a draft starts with: platform override, then the global default. */
export function resolveTone(
  input: {
    defaults: { tone: string };
    platformTone?: Partial<Record<PlatformId, string | 'inherit'>>;
  },
  platform: PlatformId,
): string {
  const per = input.platformTone?.[platform];
  return per && per !== 'inherit' ? per : input.defaults.tone;
}
