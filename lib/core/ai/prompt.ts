import { BANNED_OPENERS, CLICHE_WORDS } from '@/lib/core/constants';
import type { Angle, Brand, GenerateRequest, Length, Persona, PlatformId, TaskKind } from '@/lib/core/types';

export interface BuiltPrompt {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}

export interface BuildContext {
  request: GenerateRequest;
  persona: Persona;
  platform: PlatformId;
  brand?: Brand;
}

const PLATFORM_GUIDE: Record<
  PlatformId,
  { name: string; reply: string; post: string }
> = {
  linkedin: {
    name: 'LinkedIn',
    reply: `Replies on LinkedIn are comments under someone else's post.
- 1-2 short paragraphs. No greeting, no sign-off, no "Great post".
- Comments between 200 and 600 characters get the most reach. Never exceed the hard limit.
- No hashtags in comments. No links unless the persona explicitly asks.
- Professional does not mean stiff: write like a senior person talking to a peer.`,
    post: `Original LinkedIn posts.
- Hook in the first line (it is the only line shown before "see more"). It must work standalone.
- Short lines. White space between ideas. No emoji bullets unless the persona allows them.
- No more than 3 hashtags, at the end, lowercase, only if the persona uses hashtags.`,
  },
  x: {
    name: 'X (Twitter)',
    reply: `Replies on X.
- One or two sentences. 60-240 characters is the sweet spot.
- No hashtags. No "thread 🧵". No engagement bait ("follow for more").
- Be specific and slightly surprising. A reply that adds a fact or a sharper framing wins.
- Lowercase is acceptable if the persona is casual.`,
    post: post_guide_x(),
  },
  facebook: {
    name: 'Facebook',
    reply: `Facebook comments.
- Conversational, 1-2 sentences, 80-350 characters.
- Warm but not gushing. No hashtags in comments.
- Emoji: at most one, only if the persona uses emoji.`,
    post: `Facebook posts.
- First sentence must earn the "see more" tap.
- Conversational. Short paragraphs. No hashtags unless the persona uses them.
- Ask nothing at the end unless the persona wants engagement bait.`,
  },
};

function post_guide_x() {
  return `Original posts on X.
- A single post must be under 260 characters including spaces.
- The hook is the whole post: first 6-8 words decide everything.
- No hashtags. No "a thread 🧵". No emoji unless the persona uses them.`;
}

const ANGLE_GUIDE: Record<Angle, string> = {
  insight:
    'Add one specific thing the author did not say. Extend their thinking with an observation from your own experience. Do not summarise their post back to them.',
  contrarian:
    'Respectfully disagree with ONE specific claim. Give the condition or counter-example where it fails. Never attack the person, never say "I disagree" as the first words.',
  question:
    'Ask one question that only someone with real experience would ask. It should make the author stop and think. Never ask "what do you think?" or "curious to hear your thoughts?".',
  story:
    'Use a 1-2 sentence first-person anecdote with one concrete detail (a number, a tool, a moment) that proves or complicates the post. Do not invent dramatic outcomes.',
  data:
    'Anchor your reply with one concrete number, timeframe or measurable outcome. Only use a number grounded in the source post or the persona notes. If you have no real number, describe the outcome precisely instead of inventing a statistic.',
  tip:
    'Give one tactical step the reader could do this week. Name the specific action or tool. No generic advice like "be consistent".',
  support:
    'Add momentum. Name the specific reason this matters and who it matters for. Do not just praise.',
  punchy:
    'One or two sentences. Maximum signal per word. No hedging, no qualifiers, no extra context.',
};

const LENGTH_TARGET: Record<TaskKind, Record<PlatformId, Record<Length, string>>> = {
  reply: {
    linkedin: { short: '120-260 characters', medium: '260-520 characters', long: '520-850 characters' },
    x: { short: '60-120 characters', medium: '120-230 characters', long: '230-400 characters' },
    facebook: { short: '80-160 characters', medium: '160-350 characters', long: '350-600 characters' },
  },
  post: {
    linkedin: { short: '300-600 characters', medium: '600-1200 characters', long: '1200-2000 characters' },
    x: { short: '80-140 characters', medium: '140-250 characters', long: '250-270 characters' },
    facebook: { short: '150-350 characters', medium: '350-750 characters', long: '750-1300 characters' },
  },
  repurpose: {
    linkedin: { short: '400-700 characters', medium: '700-1300 characters', long: '1300-2200 characters' },
    x: { short: '90-150 characters', medium: '150-250 characters', long: '250-270 characters' },
    facebook: { short: '200-400 characters', medium: '400-800 characters', long: '800-1400 characters' },
  },
};

function voiceBlock(persona: Persona): string {
  const lines: string[] = [];
  if (persona.role) lines.push(`- Who I am: ${persona.role}`);
  if (persona.niche) lines.push(`- What I know: ${persona.niche}`);
  if (persona.audience) lines.push(`- Who I am talking to: ${persona.audience}`);
  if (persona.tone) lines.push(`- Tone: ${persona.tone}`);
  if (persona.styleNotes) lines.push(`- How I write: ${persona.styleNotes}`);
  if (persona.avoid) lines.push(`- What I never do: ${persona.avoid}`);
  if (persona.bannedWords) lines.push(`- Words I never use: ${persona.bannedWords}`);
  if (persona.signOff) lines.push(`- Optional sign-off: ${persona.signOff}`);
  return lines.join('\n');
}

function languageOf(persona: Persona, request: GenerateRequest): string {
  const requested = request.language?.trim();
  if (requested && requested !== 'auto') return requested;
  return persona.language && persona.language !== 'auto' ? persona.language : 'auto';
}

function hashtagRule(persona: Persona, task: TaskKind): string {
  if (persona.hashtagLevel === 'none') return 'No hashtags at all.';
  if (task === 'reply') return 'No hashtags in comments.';
  if (persona.hashtagLevel === 'light') return 'At most 2 hashtags, at the end, lowercase.';
  return 'Up to 5 hashtags at the end.';
}

function emojiRule(persona: Persona): string {
  if (persona.emojiLevel === 'none') return 'No emoji.';
  if (persona.emojiLevel === 'light') return 'At most one emoji, only if it genuinely fits.';
  return 'Emoji are allowed but never more than three, and never as bullet points.';
}

function brandBlock(brand: Brand): string {
  const lines: string[] = [];
  if (brand.name) lines.push(`- Name: ${brand.name}`);
  if (brand.positioning) lines.push(`- Positioning: ${brand.positioning}`);
  if (brand.pillars) lines.push(`- Pillars (stay inside one of these): ${brand.pillars}`);
  if (brand.pov) lines.push(`- Point of view I am known for: ${brand.pov}`);
  if (brand.proof) lines.push(`- Proof I can cite: ${brand.proof}`);
  if (brand.stories) lines.push(`- Signature stories: ${brand.stories}`);
  if (brand.offer) lines.push(`- What I want inbound for (never pitch it directly): ${brand.offer}`);
  if (brand.goals) lines.push(`- What this presence is for: ${brand.goals}`);
  if (brand.forbidden) lines.push(`- Never claim or discuss: ${brand.forbidden}`);
  return lines.join('\n');
}

const HARD_RULES = `NON-NEGOTIABLE RULES
- Output only the text that will be published. No preamble, no quotes around it, no labels, no markdown, no explanation.
- Never mention being an AI, a model, an assistant, or that this is generated.
- Never reference "the post" or "your post" as an object. Just talk about the idea.
- Never invent statistics, client names, revenue numbers, or case studies. If a number is not given to you or in my notes, describe the result qualitatively instead.
- Do not start with: ${BANNED_OPENERS.slice(0, 6).join(', ')}.
- Do not use these words: ${CLICHE_WORDS.slice(0, 12).join(', ')}.
- Avoid em dashes. Avoid the "It's not X, it's Y" construction. Avoid three-item lists that exist only to sound complete.
- Vary sentence length. One idea per sentence. Concrete nouns beat abstractions.
- Sound like a specific human writing quickly on their phone, not like marketing copy.
- The job is to make the right stranger click my profile. Earn that with one useful idea or one sharp observation — never with a pitch, a call to action, or follow-bait.
- It must read as recognisably mine: pick one of my pillars and make the connection felt, not announced.`;

const DM_GUIDE = `DIRECT MESSAGES
- You are replying inside a private conversation. Write only the message body.
- Answer what they actually asked first, then add one useful thing.
- 1-3 short sentences. Up to 5 only if the question is technical or detailed.
- No greeting clichés ("Hope you're well"), no sign-off unless my persona uses one.
- No hashtags. No emoji unless my persona allows them. No links unless the thread asks for one.
- Never pitch, never upsell, never quote a price unless they asked about it.
- Match their register: if they wrote two lines, do not write a page.`;

function taskBlock(task: TaskKind, platform: PlatformId, persona: Persona): string {
  const guide = PLATFORM_GUIDE[platform];
  if (task === 'reply') {
    return `TASK
Write ONE comment replying to the source post on ${guide.name}.

${guide.reply}`;
  }
  if (task === 'post') {
    return `TASK
Write ONE original post for ${guide.name}.

${guide.post}`;
  }
  return `TASK
Rewrite the source post as MY OWN original post for ${guide.name}.
- Keep the core insight.
- Change the framing, the opening and the structure.
- Add my own angle or example. Do not copy any sentence, phrase or list from the source.
- Do not credit the author unless my notes tell me to.

${guide.post}`;
}

export function buildPrompt(ctx: BuildContext): BuiltPrompt {
  const { request, persona, platform, brand } = ctx;
  const task = request.task;
  const angle: Angle = request.angle ?? 'insight';
  const length: Length = request.length ?? (task === 'reply' ? 'medium' : 'medium');
  const tone = request.tone?.trim() || persona.tone;
  const language = languageOf(persona, request);
  const panel = PLATFORM_GUIDE[platform];
  const limit = task === 'reply' ? persona.replyMaxChars : persona.postMaxChars;
  const brandLines = brand ? brandBlock(brand) : '';

  const isDm = request.channel === 'dm';

  const system = `You are the ghostwriter for one specific person. You write ${
    isDm ? 'direct messages' : task === 'reply' ? 'social media comments' : 'social media posts'
  } in their voice. You are not an assistant and you never talk about yourself.

WHO I AM
${voiceBlock({ ...persona, tone }) || '- A thoughtful practitioner in my field.'}
${
  brandLines
    ? `\nWHAT I AM BUILDING (this is why every word exists)\n${brandLines}\n`
    : ''
}
${isDm ? DM_GUIDE : task === 'reply' ? panel.reply : panel.post}

${HARD_RULES}
- ${emojiRule(persona)}
- ${hashtagRule(persona, task)}
- Length must not exceed ${limit} characters. This is a hard limit.
- Language: ${language === 'auto' ? 'match the language of the source post' : language}.
- Specificity beats cleverness. A reader should learn one thing or feel one thing.`;

  const avoid =
    request.avoid && request.avoid.length
      ? `\n\nDRAFTS I ALREADY REJECTED (do not reuse their phrasing, structure or opening):\n${request.avoid
          .map((d, i) => `${i + 1}. ${d.slice(0, 600)}`)
          .join('\n')}`
      : '';

  const samples = persona.samplePosts?.trim()
    ? `\n\nPOSTS I ACTUALLY WROTE (match the rhythm and vocabulary, never copy content):\n"""\n${persona.samplePosts.trim().slice(0, 2500)}\n"""`
    : '';

  const source = request.post
    ? `\n\nSOURCE POST${request.post.author ? ` by ${request.post.author}` : ''}${
        request.post.meta ? ` (${request.post.meta})` : ''
      }:\n"""\n${request.post.text.trim().slice(0, 6000)}\n"""`
    : '';

  const extra = request.extra?.trim()
    ? `\n\nMY INSTRUCTION FOR THIS ONE (follow it, it overrides style defaults): ${request.extra.trim()}`
    : '';

  if (isDm) {
    const transcript = (request.post?.text ?? '').trim().slice(0, 3000);
    const cap = Math.min(persona.replyMaxChars, 1200);
    const user = `${DM_GUIDE}

CONVERSATION WITH ${request.post?.author ?? 'them'} (oldest first, "me" is me)
"""
${transcript}
"""

RULES FOR THIS REPLY
- The LAST line above is the message I am answering. Respond to its actual content and question.
- Do not ask what they need or what they are working on if they already told me.
- If they asked something, answer it. If they shared something, react to the specific thing they said.
- Never open with a generic question about their goals.

LENGTH
1-3 sentences is ideal. Hard max ${cap} characters.${extra}

Write the reply to the last message now.`;

    return {
      system,
      user,
      maxTokens: 420,
      temperature: 0.85,
    };
  }

  const user = `${taskBlock(task, platform, persona)}

ANGLE — ${angle.toUpperCase()}
${ANGLE_GUIDE[angle]}

LENGTH
Target ${LENGTH_TARGET[task][platform][length]}. Hard max ${limit} characters.

QUALITY BAR
${
  task === 'reply'
    ? 'The author should want to reply back to this comment. It must reference one concrete detail from the post without restating it.'
    : 'The first line must be able to stand alone as the reason someone stops scrolling.'
}
No filler. If a sentence could be deleted without losing meaning, delete it.${source}${extra}${avoid}${samples}

Write the final text now.`;

  const maxChars = Math.min(limit, task === 'reply' ? 900 : 2400);
  const maxTokens = Math.min(1600, Math.ceil(maxChars / 2.2) + 160);

  return {
    system,
    user,
    maxTokens,
    temperature: task === 'reply' ? 0.9 : 0.85,
  };
}

/** Short human-readable summary used in the panel. */
export function describeRequest(request: GenerateRequest): string {
  const bits: string[] = [];
  bits.push(request.task === 'reply' ? 'Reply' : request.task === 'post' ? 'New post' : 'Repurpose');
  if (request.angle) bits.push(request.angle);
  if (request.length) bits.push(request.length);
  return bits.join(' · ');
}
