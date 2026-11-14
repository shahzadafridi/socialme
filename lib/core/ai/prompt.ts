import { BANNED_OPENERS, CLICHE_WORDS, NOTE_LIMIT, PLATFORMS } from '@/lib/core/constants';
import type {
  Angle,
  Brand,
  Channel,
  GenerateRequest,
  Length,
  Persona,
  PlatformId,
  ReplyTarget,
} from '@/lib/core/types';

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

const PLATFORM_GUIDE: Record<PlatformId, { name: string; comment: string }> = {
  linkedin: {
    name: 'LinkedIn',
    comment: `Replies on LinkedIn are comments under someone else's post.
- 1-2 short paragraphs. No greeting, no sign-off, no "Great post".
- Comments between 200 and 600 characters get the most reach. Never exceed the hard limit.
- No hashtags in comments. No links unless the persona explicitly asks.
- Professional does not mean stiff: write like a senior person talking to a peer.
- End with something the other person can answer, but never "what do you think?".`,
  },
  x: {
    name: 'X (Twitter)',
    comment: `Replies on X.
- One or two sentences. 60-240 characters is the sweet spot.
- No hashtags. No "thread 🧵". No engagement bait ("follow for more").
- Be specific and slightly surprising. A reply that adds a fact or a sharper framing wins.
- Lowercase is acceptable if the persona is casual.`,
  },
  facebook: {
    name: 'Facebook',
    comment: `Facebook comments.
- Conversational, 1-2 sentences, 80-350 characters.
- Warm but not gushing. No hashtags in comments.
- Emoji: at most one, only if the persona uses emoji.`,
  },
};

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

const LENGTH_TARGET: Record<Channel, Record<PlatformId, Record<Length, string>>> = {
  comment: {
    linkedin: { short: '120-260 characters', medium: '260-520 characters', long: '520-850 characters' },
    x: { short: '60-120 characters', medium: '120-230 characters', long: '230-400 characters' },
    facebook: { short: '80-160 characters', medium: '160-350 characters', long: '350-600 characters' },
  },
  dm: {
    linkedin: { short: '1 sentence', medium: '2-3 sentences', long: '3-4 sentences' },
    x: { short: '1 sentence', medium: '2 sentences', long: '3 sentences' },
    facebook: { short: '1 sentence', medium: '2-3 sentences', long: '3-4 sentences' },
  },
  note: {
    linkedin: { short: '120-190 characters', medium: '190-250 characters', long: '250-295 characters' },
    x: { short: '1 sentence', medium: '2 sentences', long: '3 sentences' },
    facebook: { short: '1 sentence', medium: '2-3 sentences', long: '3-4 sentences' },
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
- The job is to start a real conversation with the person in front of me — never to pitch, collect a follow, or flatter.
- It must read as recognisably mine: pick one of my pillars and make the connection felt, not announced.`;

const DM_GUIDE = `DIRECT MESSAGES
- You are replying inside a private conversation. Write only the message body.
- Answer what they actually asked first, then add one useful thing.
- 1-3 short sentences. Up to 5 only if the question is technical or detailed.
- No greeting clichés ("Hope you're well"), no sign-off unless my persona uses one.
- No hashtags. No emoji unless my persona allows them. No links unless the thread asks for one.
- Never pitch, never upsell, never quote a price unless they asked about it.
- Match their register: if they wrote two lines, do not write a page.`;

const NOTE_GUIDE = `CONNECTION-REQUEST NOTES
- This is the short note attached to a LinkedIn invitation to connect. Write only the note.
- Hard limit: ${NOTE_LIMIT} characters. Aim for 200-280 so nothing gets cut off.
- One real reason to connect, grounded in their headline, their post or what I am working on.
- Optional opener: "Hi {first name}," then the reason. No other greeting and no sign-off.
- No pitch, no price, no links, no hashtags, no emoji, no attaching a resume.
- Never say "I'd love to pick your brain", "I am reaching out because", or "I came across your profile".
- Do not invent anything about them. If there is little context, keep it about why their work is relevant to mine.`;

function taskBlock(channel: Channel, platform: PlatformId, replyTo?: ReplyTarget): string {
  const guide = PLATFORM_GUIDE[platform];
  if (channel === 'note') {
    return `TASK
Write the note that goes with my LinkedIn connection request.

${NOTE_GUIDE}`;
  }
  if (channel === 'dm') {
    return `TASK
Write ONE reply to the last message in this conversation.`;
  }
  if (replyTo) {
    return `TASK
Write ONE reply to a comment in the thread on ${guide.name}.
- I am answering ${replyTo.author ? replyTo.author : 'the commenter'}, not the post author and not the whole audience.
- Respond to the specific thing they said; the post is background, not the subject.

${guide.comment}`;
  }
  return `TASK
Write ONE comment replying to the source post on ${guide.name}.

${guide.comment}`;
}

export function buildPrompt(ctx: BuildContext): BuiltPrompt {
  const { request, persona, platform, brand } = ctx;
  const channel = request.channel;
  const angle: Angle = request.angle ?? 'insight';
  const length: Length = request.length ?? 'medium';
  const tone = request.tone?.trim() || persona.tone;
  const language = languageOf(persona, request);
  const guide = PLATFORM_GUIDE[platform];
  const platformCap =
    channel === 'note' ? NOTE_LIMIT : channel === 'dm' ? 1200 : PLATFORMS[platform].commentLimit;
  const limit = Math.min(persona.replyMaxChars, platformCap);
  const brandLines = brand ? brandBlock(brand) : '';
  const replyTo = request.replyingTo;

  const audience =
    channel === 'dm'
      ? 'direct messages'
      : channel === 'note'
        ? 'connection-request notes'
        : 'social media comments';

  const system = `You are the ghostwriter for one specific person. You write ${audience} in their voice. You are not an assistant and you never talk about yourself.

WHO I AM
${voiceBlock({ ...persona, tone }) || '- A thoughtful practitioner in my field.'}
${
  brandLines
    ? `\nWHAT I AM BUILDING (this is why every word exists)\n${brandLines}\n`
    : ''
}
${channel === 'dm' ? DM_GUIDE : channel === 'note' ? NOTE_GUIDE : guide.comment}

${HARD_RULES}
- ${emojiRule(persona)}
- ${channel === 'comment' ? 'No hashtags in comments.' : channel === 'note' ? 'No hashtags in a connection note.' : 'No hashtags.'}
- Length must not exceed ${limit} characters. This is a hard limit.
- Language: ${language === 'auto' ? 'match the language of the source' : language}.
- Specificity beats cleverness. A reader should learn one thing or feel one thing.`;

  const avoid =
    request.avoid && request.avoid.length
      ? `\n\nDRAFTS I ALREADY REJECTED (do not reuse their phrasing, structure or opening):\n${request.avoid
          .map((d, i) => `${i + 1}. ${d.slice(0, 600)}`)
          .join('\n')}`
      : '';

  const samples = persona.samplePosts?.trim()
    ? `\n\nWRITING I ACTUALLY PUBLISHED (match the rhythm and vocabulary, never copy content):\n"""\n${persona.samplePosts.trim().slice(0, 2500)}\n"""`
    : '';

  const source = request.post
    ? `\n\nSOURCE POST${request.post.author ? ` by ${request.post.author}` : ''}${
        request.post.authorHeadline ? ` (${request.post.authorHeadline})` : ''
      }${request.post.meta ? ` (${request.post.meta})` : ''}:\n"""\n${request.post.text.trim().slice(0, 6000)}\n"""`
    : '';

  const replyToBlock = replyTo
    ? `\n\nTHE COMMENT I AM ANSWERING${replyTo.author ? ` (${replyTo.author})` : ''}:\n"""\n${replyTo.text.trim().slice(0, 2000)}\n"""\n- Reply to this comment, not to the post. Use one concrete detail from it.\n- Never restate the post or repeat their sentence back to them.`
    : '';

  const recipient = request.recipient;
  const recipientBlock =
    channel === 'note'
      ? `\n\nWHO I AM INVITING${
          recipient?.name ? `\n- Name: ${recipient.name}` : ''
        }${recipient?.headline ? `\n- Their headline: ${recipient.headline}` : ''}${
          recipient?.meta ? `\n- What I can see: ${recipient.meta}` : ''
        }\n- If the name is missing, do not invent one; write without an opener.`
      : '';

  const extra = request.extra?.trim()
    ? `\n\nMY INSTRUCTION FOR THIS ONE (follow it, it overrides style defaults): ${request.extra.trim()}`
    : '';

  if (channel === 'dm') {
    const transcript = (request.post?.text ?? '').trim().slice(0, 3000);
    const cap = Math.min(persona.replyMaxChars, 1200);
    const who = request.post?.author ?? 'them';
    const user = `${DM_GUIDE}

CONVERSATION WITH ${who} (oldest first, "me" is me)
"""
${transcript}
"""

RULES FOR THIS REPLY
- The LAST line above is the message I am answering. Respond to its actual content and question.
- Do not ask what they need or what they are working on if they already told me.
- If they asked something, answer it. If they shared something, react to the specific thing they said.
- Never open with a generic question about their goals.

LENGTH
${LENGTH_TARGET.dm[platform][length]} is ideal. Hard max ${cap} characters.${extra}

Write the reply to the last message now.`;

    return {
      system,
      user,
      maxTokens: 420,
      temperature: 0.85,
    };
  }

  if (channel === 'note') {
    const user = `${taskBlock('note', platform)}

LENGTH
Target ${LENGTH_TARGET.note[platform][length]}. Hard max ${Math.min(limit, NOTE_LIMIT)} characters.
${recipientBlock}${source}${extra}${avoid}${samples}

QUALITY BAR
They should be able to tell in one line why I chose them specifically, and the note should not read like a template sent to fifty people.
No filler. If a word can be deleted, delete it.

Write the final note now.`;

    return {
      system,
      user,
      maxTokens: 320,
      temperature: 0.8,
    };
  }

  const user = `${taskBlock(channel, platform, replyTo)}

ANGLE — ${angle.toUpperCase()}
${ANGLE_GUIDE[angle]}

LENGTH
Target ${LENGTH_TARGET.comment[platform][length]}. Hard max ${limit} characters.

QUALITY BAR
The person I am answering should want to reply back. Reference one concrete detail without restating it.${source}${replyToBlock}${extra}${avoid}${samples}

Write the final text now.`;

  const maxTokens = Math.min(1600, Math.ceil(Math.min(limit, 900) / 2.2) + 160);

  return {
    system,
    user,
    maxTokens,
    temperature: 0.9,
  };
}

/** Short human-readable summary used in the panel. */
export function describeRequest(request: GenerateRequest): string {
  const label =
    request.channel === 'comment' ? 'Reply' : request.channel === 'dm' ? 'Message' : 'Note';
  const bits: string[] = [label];
  if (request.channel === 'comment' && request.replyingTo) bits.push('to a comment');
  if (request.angle && request.channel === 'comment') bits.push(request.angle);
  if (request.length) bits.push(request.length);
  return bits.join(' · ');
}
