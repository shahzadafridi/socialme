/**
 * Pure-logic self test: prompt construction and draft scoring.
 * Run with: node scripts/selftest.mjs
 */
import { buildPrompt } from '../lib/core/ai/prompt.ts';
import { buildTranscript } from '../lib/integrations/messaging.ts';
import { analyzeDraft } from '../lib/core/ai/quality.ts';

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
  postMaxChars: 1800,
  signOff: '',
  language: 'auto',
};

const post = {
  author: 'Maya Chen',
  text: 'We stopped doing quarterly roadmaps last year. Cycle time dropped 34%.',
  meta: '1,284 reactions',
};

/* ------------------------------ replies ------------------------------ */

const reply = buildPrompt({
  request: { task: 'reply', platform: 'linkedin', post, angle: 'insight', length: 'medium' },
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
  request: { task: 'reply', platform: 'x', post, angle: 'punchy', length: 'short' },
  persona,
  platform: 'x',
});
ok('x reply: shorter target than linkedin', replyX.user.includes('60-120 characters'));
ok('x reply: mentions X reply etiquette', replyX.system.includes('Replies on X'));

/* ------------------------------- posts ------------------------------- */

const postPrompt = buildPrompt({
  request: { task: 'post', platform: 'linkedin', angle: 'story', length: 'long' },
  persona,
  platform: 'linkedin',
});
ok('post: uses the post guide', postPrompt.system.includes('Hook in the first line'));
ok('post: does not use the comment guide', !postPrompt.system.includes('Replies on LinkedIn'));
ok('post: long length target', postPrompt.user.includes('1200-2000 characters'));
ok('post: no source post block', !postPrompt.user.includes('SOURCE POST'));

const repurpose = buildPrompt({
  request: { task: 'repurpose', platform: 'facebook', post, angle: 'insight', length: 'medium' },
  persona,
  platform: 'facebook',
});
ok('repurpose: instructs a rewrite', repurpose.user.includes('Rewrite the source post as MY OWN'));
ok('repurpose: forbids copying sentences', repurpose.user.includes('Do not copy any sentence'));

/* --------------------------- avoid / extra --------------------------- */

const regenerated = buildPrompt({
  request: {
    task: 'reply',
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
  request: { task: 'reply', platform: 'linkedin', post, angle: 'insight', length: 'medium' },
  persona,
  platform: 'linkedin',
  brand,
});

ok('brand: block included in the system prompt', branded.system.includes('WHAT I AM BUILDING'));
ok('brand: positioning present', branded.system.includes('fixing delivery'));
ok('brand: pillars present', branded.system.includes('Shipping software without a big team'));
ok('brand: proof present', branded.system.includes('3 weeks to 4 days'));
ok('brand: forbidden claims present', branded.system.includes('Never name clients'));
ok('brand: objective is profile clicks', branded.system.includes('click my profile'));
ok('brand: omitted when empty', !reply.system.includes('WHAT I AM BUILDING'));

const emptyBrand = buildPrompt({
  request: { task: 'reply', platform: 'linkedin', post },
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
    task: 'reply',
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
