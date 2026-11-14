import type {
  Angle,
  Length,
  PlatformId,
  ProviderId,
  ProviderPreset,
  TaskKind,
} from '@/lib/core/types';

export const APP_NAME = 'SocialMe';

export const PLATFORMS: Record<
  PlatformId,
  { id: PlatformId; label: string; color: string; glyph: string; postLimit: number }
> = {
  linkedin: { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', glyph: 'in', postLimit: 3000 },
  x: { id: 'x', label: 'X', color: '#e7e9ea', glyph: '𝕏', postLimit: 280 },
  facebook: { id: 'facebook', label: 'Facebook', color: '#1877F2', glyph: 'f', postLimit: 63206 },
};

export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    hint: 'Cheapest option that still writes well. Great default for comments.',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    suggestedModels: [
      'openai/gpt-4o-mini',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat',
    ],
    keyUrl: 'https://openrouter.ai/keys',
    hint: 'One key for most models. Good if you want to switch models per task.',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    suggestedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    keyUrl: 'https://aistudio.google.com/apikey',
    hint: 'Generous free tier.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    suggestedModels: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    hint: 'Best natural-sounding writing, slightly pricier.',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    suggestedModels: ['llama3.2', 'qwen2.5', 'mistral'],
    keyless: true,
    hint: 'Runs on your machine. Free and private, needs `ollama serve`.',
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    kind: 'openai',
    baseUrl: 'http://localhost:8080/v1',
    defaultModel: '',
    suggestedModels: [],
    hint: 'Any endpoint that speaks the OpenAI chat completions API.',
  },
};

export const ANGLES: Array<{ id: Angle; label: string; hint: string }> = [
  { id: 'insight', label: 'Add insight', hint: 'Extend the idea with something the author missed' },
  { id: 'contrarian', label: 'Respectful pushback', hint: 'Disagree with one specific point, politely' },
  { id: 'question', label: 'Sharp question', hint: 'Ask something that shows real experience' },
  { id: 'story', label: 'Personal story', hint: 'A 1-2 sentence anecdote that proves the point' },
  { id: 'data', label: 'Number / result', hint: 'Anchor it with a concrete metric or outcome' },
  { id: 'tip', label: 'Tactical tip', hint: 'One thing the reader can do today' },
  { id: 'support', label: 'Add momentum', hint: 'Build on the point and say why it matters' },
  { id: 'punchy', label: 'Punchy one-liner', hint: 'Maximum 1-2 sentences, high signal' },
];

export const LENGTHS: Array<{ id: Length; label: string }> = [
  { id: 'short', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'long', label: 'Long' },
];

export const TONES = [
  'Direct and practical',
  'Warm and conversational',
  'Witty, dry humour',
  'Analytical and precise',
  'Confident and bold',
  'Humble and curious',
  'Story-driven',
  'No-nonsense technical',
];

export const TASKS: Record<TaskKind, { label: string; verb: string }> = {
  reply: { label: 'Reply', verb: 'Write a comment' },
  post: { label: 'New post', verb: 'Write a post' },
  repurpose: { label: 'Repurpose', verb: 'Rewrite as my post' },
};

/** Openers that kill engagement because every bot uses them. */
export const BANNED_OPENERS = [
  'great post',
  'couldn\u2019t agree more',
  'could not agree more',
  'this is so true',
  'so true',
  'love this',
  'well said',
  'spot on',
  'absolutely',
  'this resonates',
  'thanks for sharing',
];

export const CLICHE_WORDS = [
  'delve',
  'leverage',
  'landscape',
  'game-changer',
  'game changer',
  'unlock',
  'elevate',
  'furthermore',
  'moreover',
  'in today\u2019s fast-paced',
  'in today\u2019s world',
  'revolutionize',
  'synergy',
  'paradigm',
  'seamless',
  'cutting-edge',
  'robust',
  'dive deep',
  'navigate',
];

export const STORAGE_KEYS = {
  settings: 'socialme.settings.v1',
  secrets: 'socialme.secrets.v1',
  history: 'socialme.history.v1',
  usage: 'socialme.usage.v1',
  activity: 'socialme.activity.v1',
  lastDraft: 'socialme.lastDraft.v1',
} as const;

export const MAX_HISTORY = 200;

/**
 * Plain-language summary of what each platform actually forbids.
 * SocialMe enforces the stricter version of these by default.
 */
export const PLATFORM_POLICY: Record<
  PlatformId,
  {
    label: string;
    termsUrl: string;
    automated: string;
    limits: string;
    safe: string[];
  }
> = {
  linkedin: {
    label: 'LinkedIn',
    termsUrl: 'https://www.linkedin.com/legal/user-agreement',
    automated:
      'The User Agreement bans bots, scrapers and automated activity, including automated commenting. Enforcement is behavioural: bursts of similar comments, identical phrasing, or new accounts commenting quickly are the usual triggers.',
    limits:
      'No published rate limit. In practice, sustained commenting faster than roughly one every few minutes, or dozens per day, is where restrictions start.',
    safe: [
      'Keep comments specific to the post — templated text is the fastest way to get flagged',
      'Vary length and structure instead of repeating a formula',
      'Do not comment on the same people repeatedly in a short window',
      'Prefer manual send on an account you care about',
    ],
  },
  x: {
    label: 'X',
    termsUrl: 'https://help.x.com/en/rules-and-policies/x-automation',
    automated:
      'The Automation Rules require automated replies and mentions to be approved and non-spammy. Bulk, duplicate or unsolicited automated replies are treated as platform manipulation.',
    limits:
      'Per-account posting caps exist but are not published. New accounts and low-trust accounts hit them far sooner.',
    safe: [
      'Never send the same reply twice',
      'Avoid replying to many accounts within minutes',
      'Keep replies short and conversational — link-heavy replies look like spam',
      'Do not automate follows, likes or DMs',
    ],
  },
  facebook: {
    label: 'Facebook',
    termsUrl: 'https://www.facebook.com/legal/terms',
    automated:
      'Meta\'s terms prohibit automated collection of data and unauthorised automation of engagement. Comment spam and repetitive posting are removed under the spam policy.',
    limits:
      'No published limit. Repeated identical comments, link drops and fast successive comments trigger spam detection.',
    safe: [
      'Comment on people you actually follow',
      'Avoid links in comments unless they add real value',
      'Do not post the same comment on multiple posts',
      'Space activity out; Facebook weights recency and relationship',
    ],
  },
};

/** Text that indicates the platform has already throttled or challenged the account. */
export const WARNING_PATTERNS: RegExp[] = [
  /temporarily (restricted|blocked|limited|unable)/i,
  /we(?:'ve| have) (restricted|limited|suspended)/i,
  /unusual activity/i,
  /suspicious activity/i,
  /you(?:'ve| have) reached (?:a|the) (?:limit|daily limit)/i,
  /your account (?:has been|is) (?:restricted|limited)/i,
  /action (?:is )?required to (?:continue|post|comment)/i,
  /verify (?:it'?s|that it'?s) you/i,
  /try again in \d+ (?:minutes?|hours?|days?)/i,
];
