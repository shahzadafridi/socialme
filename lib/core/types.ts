/** Shared domain types for the SocialMe extension. */

export type PlatformId = 'linkedin' | 'x' | 'facebook';

export type TaskKind = 'reply' | 'post' | 'repurpose';

/** How a generated draft reaches the platform. */
export type OutputMode = 'review' | 'insert' | 'auto';

export type TypingSpeed = 'fast' | 'natural' | 'careful';

/** How much of a DM thread is sent as context. */
export type DmContext = 'last' | 'last3' | 'all';


export type Angle =
  | 'insight'
  | 'contrarian'
  | 'question'
  | 'story'
  | 'data'
  | 'tip'
  | 'support'
  | 'punchy';

export type Length = 'short' | 'medium' | 'long';

export type ProviderId =
  | 'openai'
  | 'deepseek'
  | 'openrouter'
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'custom';

export type ProviderKind = 'openai' | 'anthropic' | 'gemini';

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  defaultModel: string;
  suggestedModels: string[];
  keyUrl?: string;
  /** Providers that work without an API key (local runtime). */
  keyless?: boolean;
  hint?: string;
}

export interface ProviderSettings {
  id: ProviderId;
  enabled: boolean;
  baseUrl: string;
  model: string;
  temperature: number;
  /** Only present in the background context / options page. Stripped for UI snapshots. */
  apiKey?: string;
}

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  role: string;
  niche: string;
  audience: string;
  /* Voice */
  tone: string;
  styleNotes: string;
  avoid: string;
  bannedWords: string;
  samplePosts: string;
  /* Mechanics */
  emojiLevel: 'none' | 'light' | 'moderate';
  hashtagLevel: 'none' | 'light' | 'heavy';
  cta: string;
  replyMaxChars: number;
  postMaxChars: number;
  signOff: string;
  language: string;
}

export interface Defaults {
  angle: Angle;
  tone: string;
  replyLength: Length;
  postLength: Length;
  extraInstruction: string;
}

/** Who you are building, as opposed to how you write. Shared by every persona. */
export interface Brand {
  name: string;
  positioning: string;
  pillars: string;
  proof: string;
  pov: string;
  offer: string;
  stories: string;
  goals: string;
  forbidden: string;
}

export interface AutoSubmitSettings {
  enabled: boolean;
  minDelayMs: number;
  maxDelayMs: number;
  requireConfirm: boolean;
}

/**
 * Account-protection limits. These are enforced before anything is typed or sent,
 * because a restricted account has no reach at all.
 */
export interface SafetySettings {
  humanTyping: boolean;
  typingSpeed: TypingSpeed;
  minActionGapSec: number;
  maxActionsPerHour: number;
  maxActionsPerDay: number;
  pauseOnWarning: boolean;
  warmupDays: number;
}

export interface ActivityEvent {
  ts: number;
  platform: PlatformId;
  kind: 'generate' | 'submit';
}

export interface Settings {
  version: 2;
  onboarded: boolean;
  providers: ProviderSettings[];
  activeProvider: ProviderId;
  brand: Brand;
  personas: Persona[];
  activePersonaId: string;
  /** Per-platform persona override, 'inherit' uses activePersonaId. */
  platformPersona: Record<PlatformId, string>;
  defaults: Defaults;
  /** Platform-agnostic default output mode. */
  outputMode: OutputMode;
  platformOutputMode: Record<PlatformId, OutputMode | 'inherit'>;
  autoSubmit: AutoSubmitSettings;
  safety: SafetySettings;
  dmContext: DmContext;
  showComposerButton: boolean;
  theme: 'dark' | 'light' | 'system';
  historyEnabled: boolean;
  telemetry: false;
}

export interface UsageDay {
  date: string;
  counts: Partial<Record<PlatformId, number>>;
  submitted: Partial<Record<PlatformId, number>>;
}

export interface HistoryItem {
  id: string;
  ts: number;
  platform: PlatformId;
  task: TaskKind;
  personaId: string;
  angle: Angle;
  postExcerpt: string;
  draft: string;
  submitted: boolean;
}

/** Redacted settings snapshot handed to content scripts. */
export interface PublicSettings {
  activeProvider: ProviderId;
  providerLabel: string;
  model: string;
  personas: Persona[];
  activePersonaId: string;
  platformPersona: Record<PlatformId, string>;
  defaults: Defaults;
  outputMode: OutputMode;
  platformOutputMode: Record<PlatformId, OutputMode | 'inherit'>;
  autoSubmit: AutoSubmitSettings;
  safety: SafetySettings;
  theme: Settings['theme'];
  historyEnabled: boolean;
}

export interface PostContext {
  platform: PlatformId;
  url: string;
  author: string;
  authorHeadline?: string;
  text: string;
  meta?: string;
}

/* ------------------------------------------------------------------ */
/* Messaging                                                           */
/* ------------------------------------------------------------------ */

export interface GenerateRequest {
  task: TaskKind;
  platform: PlatformId;
  /** 'post' = public comment/post, 'dm' = direct message thread. */
  channel?: 'post' | 'dm';
  post?: { author?: string; text: string; meta?: string };
  personaId?: string;
  angle?: Angle;
  tone?: string;
  length?: Length;
  language?: string;
  extra?: string;
  avoid?: string[];
}

export type PortMessage =
  | { type: 'start'; request: GenerateRequest }
  | { type: 'cancel' }
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string }
  | { type: 'error'; error: string; code?: string };

export interface DraftActionPayload {
  platform: PlatformId;
  task: TaskKind;
  personaId: string;
  angle: Angle;
  postExcerpt: string;
  draft: string;
  submitted: boolean;
}
