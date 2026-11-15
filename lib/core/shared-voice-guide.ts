import type { Persona, Settings } from './types';
import { STARTER_PERSONAS } from './defaults';

export const SHARED_VOICE_GUIDE_URL = 'https://chatgpt.com/s/t_6af9d35baaa0819195de3c222d7dee26';

/** A user-supplied guide, kept separate from generic defaults and authored samples. */
export const SHARED_ENGINEERING_VOICE: Pick<Persona, 'tone' | 'styleNotes' | 'avoid' | 'bannedWords' | 'styleExamples' | 'voicePreferences'> = {
  tone: 'Direct and practical',
  styleNotes: [
    'Speak as a hands-on engineer talking with another person: direct, curious, practical and honest about uncertainty.',
    'Work from the actual problem, useful context and what you would do. Keep necessary technical terms and explain constraints or trade-offs only when relevant.',
    'Use mostly short and medium sentences, with natural contractions and an occasional longer explanation. Improve readability without sounding like an edited magazine article.',
    'A simple observation or genuine question can be enough. Usually 1–4 sentences; stop when the point is complete. Do not manufacture a lesson or append a question.',
    'Agreement needs a specific reason; disagreement should be respectful. Do not invent an opinion, personal experience or result. Dry humour is occasional, never forced.',
    'Use conversational rhythms flexibly, not repeated opening templates. Preserve spontaneity without reproducing typing mistakes or pretending to be unusually casual.',
    'Before returning a reply, check whether it could be said naturally to another engineer. Prefer practical sense and authenticity to impressive wording.',
  ].join('\n'),
  avoid: 'Corporate marketing, exaggerated enthusiasm, fake personal stories, manufactured vulnerability, clickbait, engagement bait, motivational endings, unnecessary technical detail, emoji clutter, hashtag stuffing and dramatic one-line paragraphs.',
  bannedWords: "game changer, unlock the power, delve into, revolutionary, in today's fast-paced world, couldn't agree more, this is gold, super insightful, let's unpack this, here's the thing, hot take, the future is here, not just X but Y",
  styleExamples: [
    'Sharing business logic with KMP can make sense. I would still look at the team and what needs to be shared before committing to it.',
    'Extra layers need a reason. For a small app, I would keep the structure simple until the complexity calls for more.',
    'What happens if one tool fails halfway through the task? That is the part I would test before relying on the agent.',
  ].join('\n\n'),
  voicePreferences: { register: 'conversational', questions: 'when-needed', contractions: true },
};

/** Applying the preset is deliberate: no silent migration of a user's existing style. */
export function applySharedVoiceGuide(settings: Settings): Settings {
  const existing = settings.personas.find((persona) => persona.id === 'p_default');
  const base = existing ?? { ...STARTER_PERSONAS[0] };
  const mergeText = (current: string, guide: string) => current.includes(guide) ? current : [current.trim(), guide.trim()].filter(Boolean).join('\n');
  const voice: Persona = {
    ...base, ...SHARED_ENGINEERING_VOICE,
    id: 'p_default', name: base.name || 'My voice',
    role: base.role.trim() || 'Mobile/software architect and engineering lead with 8+ years of hands-on software development.',
    niche: base.niche.trim() || 'Android, Kotlin, KMP, Flutter, architecture, fintech, payments, security, AI tools and product engineering',
    audience: base.audience.trim() || 'Engineers, technical leads, architects and people building software products',
    avoid: mergeText(base.avoid, SHARED_ENGINEERING_VOICE.avoid),
    bannedWords: mergeText(base.bannedWords, SHARED_ENGINEERING_VOICE.bannedWords),
    voicePreferences: { ...SHARED_ENGINEERING_VOICE.voicePreferences! },
    samplePosts: base.samplePosts,
  };
  return {
    ...settings,
    personas: existing ? settings.personas.map((persona) => persona.id === 'p_default' ? voice : persona) : [voice, ...settings.personas],
    activePersonaId: 'p_default',
    platformPersona: { linkedin: 'inherit', x: 'inherit', facebook: 'inherit' },
    platformTone: { linkedin: 'inherit', x: 'inherit', facebook: 'inherit' },
    defaults: { ...settings.defaults, angle: 'natural', tone: '' },
    brand: { ...settings.brand, mode: 'relevant',
      positioning: settings.brand.positioning.trim() || 'Practical engineering perspectives grounded in implementation, constraints and product decisions.',
      pillars: settings.brand.pillars.trim() || 'Mobile engineering and architecture\nPayment reliability and application security\nPractical AI tools and engineering workflows\nProduct and technical decisions',
    },
  };
}
