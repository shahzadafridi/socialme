/**
 * Pure-logic self test: prompt construction and draft scoring.
 * Run with: node scripts/selftest.mjs
 */
import { buildPrompt } from '../lib/core/ai/prompt.ts';
import { buildTranscript } from '../lib/integrations/messaging.ts';
import { analyzeDraft } from '../lib/core/ai/quality.ts';
import {
  mergeSettings,
  seedPersonas,
  resolveTone,
  PERSONA_SEED_VERSION,
} from '../lib/core/defaults.ts';

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? `  → ${detail}` : ''}`);
  }
}

const persona = {
  id: 'p',
  name: 'Test',
  emoji: '',
  role: 'Founder of a dev studio',
  niche: 'Product and growth',
  audience: 'founders',
  tone: 'Direct and practical',
  styleNotes: 'Short sentences.',
  avoid: 'Hype.',
  bannedWords: 'synergy',
  samplePosts: 'We shipped a rewrite last month.',
  emojiLevel: 'none',
  hashtagLevel: 'light',
  cta: '',
  replyMaxChars: 700,
  length: 'medium',
  signOff: '',
  language: 'auto',
};

const post = {
  author: 'Maya Chen',
  authorHeadline: 'VP Product at Northwind · ex-Stripe',
  text: 'We stopped doing quarterly roadmaps last year. Cycle time dropped 34%.',
  meta: '1,284 reactions',
};

/* ------------------------------ replies ------------------------------ */

const reply = buildPrompt({
  request: { channel: 'comment', platform: 'linkedin', post, angle: 'insight', length: 'medium' },
  persona,
  platform: 'linkedin',
});

ok('reply: system mentions the author voice', reply.system.includes('Founder of a dev studio'));
ok('reply: system includes banned words', reply.system.includes('synergy'));
ok(
  'reply: uses the reply guide, not the post guide',
  reply.system.includes("Replies on LinkedIn are comments under someone else's post"),
);
ok('reply: does not leak the post guide', !reply.system.includes('Hook in the first line'));
ok('reply: includes the source post', reply.user.includes('We stopped doing quarterly roadmaps'));
ok('reply: includes the author', reply.user.includes('Maya Chen'));
ok('reply: includes the author headline', reply.user.includes('VP Product at Northwind'));
ok('reply: includes the hard character limit', reply.user.includes('Hard max 700 characters'));
ok('reply: no hashtags rule for comments', reply.system.includes('No hashtags in comments'));
ok('reply: angle instruction present', reply.user.includes('Add one specific thing the author did not say'));
ok(
  'reply: forbids invented statistics',
  reply.system.includes('Never invent statistics'),
);
ok('reply: temperature high enough to avoid boilerplate', reply.temperature >= 0.8);
ok('reply: token budget is bounded', reply.maxTokens > 100 && reply.maxTokens <= 1600);

const replyX = buildPrompt({
  request: { channel: 'comment', platform: 'x', post, angle: 'punchy', length: 'short' },
  persona,
  platform: 'x',
});
ok('x reply: shorter target than linkedin', replyX.user.includes('60-120 characters'));
ok('x reply: mentions X reply etiquette', replyX.system.includes('Replies on X'));

/* --------------------------- nested replies --------------------------- */

const nested = buildPrompt({
  request: {
    channel: 'comment',
    platform: 'linkedin',
    post,
    replyingTo: {
      author: 'Sam Okafor',
      text: 'The 34% is doing a lot of work there — was that cycle time or review time?',
    },
    angle: 'insight',
    length: 'short',
  },
  persona,
  platform: 'linkedin',
});

ok('nested: names the commenter in the task', nested.user.includes('I am answering Sam Okafor'));
ok('nested: carries the comment text', nested.user.includes('was that cycle time or review time'));
ok('nested: labels the comment block', nested.user.includes('THE COMMENT I AM ANSWERING'));
ok('nested: tells the model not to restate the post', /not to the post/i.test(nested.user));
ok('nested: keeps the post as background', nested.user.includes('SOURCE POST'));

/* -------------------------- connection notes -------------------------- */

const note = buildPrompt({
  request: {
    channel: 'note',
    platform: 'linkedin',
    recipient: { name: 'Maya Chen', headline: 'VP Product at Northwind · ex-Stripe' },
    extra: 'We met at the Berlin product meetup.',
  },
  persona,
  platform: 'linkedin',
});

ok('note: uses the connection-note guide', note.system.includes('CONNECTION-REQUEST NOTES'));
ok('note: no comment guide', !note.system.includes('Replies on LinkedIn'));
ok('note: names the recipient', note.user.includes('Maya Chen') && note.user.includes('Northwind'));
ok('note: hard 300 character cap', note.user.includes('Hard max 300 characters'));
ok('note: forbids links and pitches', /No pitch, no price, no links/i.test(note.system));
ok('note: carries the instruction', note.user.includes('Berlin product meetup'));
ok('note: bounded token budget', note.maxTokens > 100 && note.maxTokens <= 500);
ok('note: never invents a name', note.user.includes('do not invent one'));

/* --------------------------- avoid / extra --------------------------- */

const regenerated = buildPrompt({
  request: {
    channel: 'comment',
    platform: 'linkedin',
    post,
    avoid: ['Great post! This is so true.', 'Another rejected draft.'],
    extra: 'Mention the 3-week launch.',
  },
  persona,
  platform: 'linkedin',
});
ok('regenerate: rejected drafts included', regenerated.user.includes('Another rejected draft.'));
ok('regenerate: extra instruction included', regenerated.user.includes('Mention the 3-week launch.'));
ok('regenerate: labels the rejection block', regenerated.user.includes('DRAFTS I ALREADY REJECTED'));

/* ------------------------------- brand ------------------------------- */

const brand = {
  name: 'Shahzad — independent product engineer',
  positioning: 'I help small SaaS teams ship faster by fixing delivery.',
  pillars: 'Shipping software without a big team\nHiring engineers',
  pov: 'Most delivery problems are decision problems.',
  proof: 'Cut a release cycle from 3 weeks to 4 days.',
  stories: 'The staging-branch deletion.',
  offer: 'Fractional engineering leadership',
  goals: 'Be the person founders think of when delivery stalls',
  forbidden: 'Never name clients without permission.',
};

const branded = buildPrompt({
  request: { channel: 'comment', platform: 'linkedin', post, angle: 'insight', length: 'medium' },
  persona,
  platform: 'linkedin',
  brand,
});

ok('brand: block included in the system prompt', branded.system.includes('WHAT I AM BUILDING'));
ok('brand: positioning present', branded.system.includes('fixing delivery'));
ok('brand: pillars present', branded.system.includes('Shipping software without a big team'));
ok('brand: proof present', branded.system.includes('3 weeks to 4 days'));
ok('brand: forbidden claims present', branded.system.includes('Never name clients'));
ok('brand: objective is a real conversation', branded.system.includes('start a real conversation'));
ok('brand: omitted when empty', !reply.system.includes('WHAT I AM BUILDING'));

const emptyBrand = buildPrompt({
  request: { channel: 'comment', platform: 'linkedin', post },
  persona,
  platform: 'linkedin',
  brand: { name: '', positioning: '', pillars: '', pov: '', proof: '', stories: '', offer: '', goals: '', forbidden: '' },
});
ok('brand: empty brand adds nothing', !emptyBrand.system.includes('WHAT I AM BUILDING'));

/* --------------------------- DM transcript --------------------------- */

const bounds = { left: 600, width: 600 };
const bubbles = [
  { text: 'Mohammad Soleymani Far', top: 10, left: 640, width: 120 },
  { text: 'anks', top: 30, left: 640, width: 60 },
  { text: 'Thanks for connecting! I noticed your background in fintech payments.', top: 32, left: 640, width: 380 },
  { text: 'Thanks for getting back to me.', top: 60, left: 1080, width: 220 },
  { text: 'Are you open to hearing about the role?', top: 90, left: 640, width: 300 },
];

const transcript = buildTranscript(bubbles, bounds, 'Mohammad Soleymani Far');
ok('transcript: drops the name-only line', !transcript.startsWith('Mohammad Soleymani Far'));
ok('transcript: keeps the real messages', transcript.includes('fintech payments'));
ok('transcript: labels incoming as them', transcript.includes('them: Are you open'));
ok('transcript: labels outgoing as me', transcript.includes('me: Thanks for getting back'));
ok('transcript: removes clipped fragments', !transcript.includes('anks\n'));
ok('transcript: ends on their last message', transcript.trim().endsWith('them: Are you open to hearing about the role?'));

ok(
  'transcript: last-message mode sends one message',
  buildTranscript(bubbles, bounds, '', 1).split('\n').length === 1,
);
ok(
  'transcript: last-3 mode keeps the run-up',
  buildTranscript(bubbles, bounds, '', 3).includes('fintech payments'),
);
ok(
  'transcript: whole-chat mode keeps my earlier message',
  buildTranscript(bubbles, bounds, '', 12).includes('me: Thanks for getting back'),
);

const single = buildTranscript([{ text: 'Ping', top: 0, left: 640, width: 40 }], bounds, 'X');
ok('transcript: handles a single message', single === 'them: Ping');

/* -------------------------------- DMs -------------------------------- */

const dm = buildPrompt({
  request: {
    platform: 'linkedin',
    channel: 'dm',
    post: { author: 'Mohammad', text: 'them: We are hiring for a fintech payments team in Dubai.\nthem: Are you open to hearing about it?' },
  },
  persona,
  platform: 'linkedin',
  brand,
});

ok('dm: uses the direct-message guide', dm.system.includes('DIRECT MESSAGES'));
ok('dm: no hashtags/engagement-bait rules', !dm.system.includes('Replies on LinkedIn'));
ok('dm: includes the conversation', dm.user.includes('fintech payments team in Dubai'));
ok('dm: labels the participants', dm.user.includes('CONVERSATION WITH'));
ok('dm: forces an answer to the last line', /LAST line/i.test(dm.user));
ok('dm: warns against generic questions', /generic question/i.test(dm.user));
ok('dm: smaller token budget', dm.maxTokens <= 500);
ok('dm: keeps brand context', dm.system.includes('WHAT I AM BUILDING'));

/* ---------------------------- persona voice --------------------------- */

const shortPersona = { ...persona, length: 'short' };
const shortReply = buildPrompt({
  request: { channel: 'comment', platform: 'linkedin', post },
  persona: shortPersona,
  platform: 'linkedin',
});
ok(
  'persona: preferred length is used when the request omits one',
  shortReply.user.includes('120-260 characters'),
);

const ctaPersona = { ...persona, cta: 'Ask what they tried' };
const ctaReply = buildPrompt({
  request: { channel: 'comment', platform: 'linkedin', post },
  persona: ctaPersona,
  platform: 'linkedin',
});
ok('persona: optional CTA reaches the prompt', ctaReply.system.includes('Ask what they tried'));
ok('persona: no CTA line when unset', !reply.system.includes('Optional call to action'));

ok(
  'banned: new phrases reach the prompt',
  reply.system.includes('paradigm shift') && reply.system.includes('nailed it'),
);
const bannedDraft = analyzeDraft('Nailed it. Absolutely a paradigm shift.', 'linkedin', 700);
ok('banned: quality flags the new opener', bannedDraft.bannedOpener === 'nailed it');
ok('banned: quality flags the new cliche', bannedDraft.cliches.includes('paradigm shift'));

/* ------------------------- persona migration -------------------------- */

const legacyPersonas = [
  {
    ...persona,
    id: 'p_default',
    name: 'My voice',
    emoji: '🙂',
    styleNotes: 'My custom voice.',
    replyMaxChars: 420,
  },
  {
    ...persona,
    id: 'p_expert',
    name: 'Thought leader',
    emoji: '🧠',
    role: 'Operator with 8 years of hands-on experience',
    tone: 'Analytical and precise',
    niche: 'Product, growth and building software teams',
    audience: 'Founders, product leads and engineers',
    styleNotes: 'My custom thought-leader style.',
    avoid: 'Generic advice, hedging, listicles in comments.',
    replyMaxChars: 700,
    hashtagLevel: 'light',
  },
  { ...persona, id: 'p_custom', name: 'Mine', role: 'Custom role' },
];

const storedLegacy = {
  version: 2,
  activePersonaId: 'p_default',
  personas: legacyPersonas,
  platformPersona: { linkedin: 'p_custom', x: 'inherit', facebook: 'inherit' },
  platformTone: { linkedin: 'Witty, dry humour', x: 'inherit', facebook: 'inherit' },
};

const migrated = mergeSettings(storedLegacy);
const byId = (list, id) => list.find((p) => p.id === id);

ok(
  'migration: My voice keeps the user values',
  byId(migrated.personas, 'p_default')?.styleNotes === 'My custom voice.' &&
    byId(migrated.personas, 'p_default')?.replyMaxChars === 420,
);
ok(
  'migration: seeded fields update when untouched',
  byId(migrated.personas, 'p_expert')?.emoji === '🎯' &&
    byId(migrated.personas, 'p_expert')?.replyMaxChars === 500,
);
ok(
  'migration: edited fields are preserved',
  byId(migrated.personas, 'p_expert')?.styleNotes === 'My custom thought-leader style.',
);
ok(
  'migration: missing built-in voices are added',
  ['p_casual', 'p_architect', 'p_ai', 'p_product', 'p_security', 'p_mentor'].every((id) =>
    Boolean(byId(migrated.personas, id)),
  ),
);
ok(
  'migration: user personas survive',
  byId(migrated.personas, 'p_custom')?.role === 'Custom role',
);
ok(
  'migration: no duplicate ids',
  new Set(migrated.personas.map((p) => p.id)).size === migrated.personas.length,
);
ok('migration: active voice unchanged', migrated.activePersonaId === 'p_default');
ok('migration: per-platform voice override unchanged', migrated.platformPersona.linkedin === 'p_custom');
ok('migration: per-platform tone override preserved', migrated.platformTone.linkedin === 'Witty, dry humour');
ok('migration: seed version recorded', migrated.personaSeedVersion === PERSONA_SEED_VERSION);

const twice = seedPersonas(migrated.personas);
ok(
  'migration: idempotent',
  twice.length === migrated.personas.length &&
    twice.every((p, i) => p.id === migrated.personas[i].id),
);

/* -------------------------------- tones -------------------------------- */

ok(
  'tone: platform override wins',
  resolveTone({ defaults: { tone: 'Direct' }, platformTone: { linkedin: 'Witty' } }, 'linkedin') ===
    'Witty',
);
ok(
  'tone: inherit uses the global default',
  resolveTone({ defaults: { tone: 'Direct' }, platformTone: { x: 'inherit' } }, 'x') === 'Direct',
);
ok(
  'tone: missing platform override falls back',
  resolveTone({ defaults: { tone: 'Direct' } }, 'facebook') === 'Direct',
);

/* ------------------------------ quality ------------------------------ */

const weak = analyzeDraft('Great post! This is so true.', 'linkedin', 700);
ok('quality: flags a banned opener', Boolean(weak.bannedOpener), JSON.stringify(weak.bannedOpener));
ok('quality: weak verdict for a cliché opener', weak.score < 60, `score=${weak.score}`);

const strong = analyzeDraft(
  'We ran the same experiment across 14 client sites last quarter. The pattern held: teams that shipped weekly cut review time by 40%, not because they reviewed less, but because the diffs stayed small.',
  'linkedin',
  700,
);
ok('quality: rewards specificity', strong.hasNumber && strong.score > weak.score + 20, `score=${strong.score}`);
ok('quality: not over limit', !strong.overLimit);

const tooLong = analyzeDraft('x'.repeat(750), 'linkedin', 700);
ok('quality: detects over-limit', tooLong.overLimit);
ok('quality: penalises over-limit', tooLong.score < 78, `score=${tooLong.score}`);

const question = analyzeDraft('What changed for you when the diffs got smaller?', 'linkedin', 700);
ok('quality: detects a question', question.hasQuestion);
ok('quality: emoji counted', analyzeDraft('Solid ⚡', 'x', 280).emojiCount === 1);

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
