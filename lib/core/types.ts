/** Shared domain types for the SocialMe extension. */

export type PlatformId = 'linkedin' | 'x' | 'facebook';

/**
 * SocialMe only writes replies. Every draft is one of:
 * - `comment`: a public comment under a post, or a reply to another comment;
 * - `dm`: a reply inside a direct-message thread;
 * - `note`: the note attached to a LinkedIn connection request.
 */
export type Channel = 'comment' | 'dm' | 'note';

/** How a generated draft reaches the platform. */
export type OutputMode = 'review' | 'insert' | 'auto';

export type TypingSpeed = 'fast' | 'natural' | 'careful';

/** How much of a DM thread is sent as context. */
export type DmContext = 'last' | 'last3' | 'all';

export type Angle =
  | 'natural'
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
  replyExamples?: ApprovedReplyExample[];
  /** Illustrative starter text; never evidence of the user's experience. */
  styleExamples?: string;
  voiceFeedback?: string[];
  voicePreferences?: {
    register: 'conversational' | 'balanced' | 'formal';
    questions: 'when-needed' | 'rare' | 'never';
    contractions: boolean;
  };
  /* Mechanics */
  emojiLevel: 'none' | 'light' | 'moderate';
  hashtagLevel: 'none' | 'light' | 'heavy';
  cta: string;
  /** Hard cap for this voice's drafts. */
  replyMaxChars: number;
  /** Preferred length for a new draft; the user can still change it per reply. */
  length: Length;
  signOff: string;
  language: string;
}

/** Saved only after explicit approval. Examples demonstrate response style, not facts. */
export interface ApprovedReplyExample {
  id: string;
  platform: PlatformId;
  channel: Channel;
  source: string;
  reply: string;
  savedAt: number;
}

export interface Defaults {
  angle: Angle;
  tone: string;
  replyLength: Length;
  extraInstruction: string;
}

/** Who you are building, as opposed to how you write. Shared by every persona. */
export interface Brand {
  mode?: 'relevant' | 'strict' | 'off';
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
  id?: string;
  confirmed?: boolean;
}

export interface Settings {
  version: 3;
  onboarded: boolean;
  providers: ProviderSettings[];
  activeProvider: ProviderId;
  brand: Brand;
  personas: Persona[];
  activePersonaId: string;
  /** Per-platform persona override, 'inherit' uses activePersonaId. */
  platformPersona: Record<PlatformId, string>;
  /** Per-platform tone override, 'inherit' uses defaults.tone. */
  platformTone: Record<PlatformId, string | 'inherit'>;
  defaults: Defaults;
  /** Which built-in persona seed generation the stored voices came from. */
  personaSeedVersion: number;
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
  channel: Channel;
  personaId: string;
  angle: Angle;
  postExcerpt: string;
  draft: string;
  submitted: boolean;
}

/** Redacted settings snapshot handed to content scripts. */
export interface PublicSettings {
  topics?: string;
  evidence?: string;
  activeProvider: ProviderId;
  providerLabel: string;
  model: string;
  personas: Persona[];
  activePersonaId: string;
  platformPersona: Record<PlatformId, string>;
  platformTone: Record<PlatformId, string | 'inherit'>;
  defaults: Defaults;
  outputMode: OutputMode;
  platformOutputMode: Record<PlatformId, OutputMode | 'inherit'>;
  autoSubmit: AutoSubmitSettings;
  safety: SafetySettings;
  theme: Settings['theme'];
  historyEnabled: boolean;
}

/** The post, comment or thread a draft answers. */
export interface PostContext {
  platform: PlatformId;
  url: string;
  author: string;
  authorHeadline?: string;
  text: string;
  meta?: string;
}

/** The specific comment being answered inside a post's comment thread. */
export interface ReplyTarget {
  author?: string;
  text: string;
}

/** The person a connection note is addressed to. */
export interface RecipientContext {
  name?: string;
  headline?: string;
  meta?: string;
}

/* ------------------------------------------------------------------ */
/* Messaging                                                           */
/* ------------------------------------------------------------------ */

export interface GenerateRequest {
  /** The user's own point to express; not a request to invent an opinion. */
  roughThought?: string;
  revision?: { text: string; instruction: string };
  platform: PlatformId;
  channel: Channel;
  /** The post (comment channel), transcript (dm) or profile (note). */
  post?: { author?: string; authorHeadline?: string; text: string; meta?: string };
  /** Nested comment replies: the comment this one answers, not the post. */
  replyingTo?: ReplyTarget;
  /** Connection notes: who the invite goes to. */
  recipient?: RecipientContext;
  /** Actual invitation editor limit; some LinkedIn accounts allow only 200. */
  noteMaxChars?: number;
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
  channel: Channel;
  personaId: string;
  angle: Angle;
  postExcerpt: string;
  draft: string;
  submitted: boolean;
}
