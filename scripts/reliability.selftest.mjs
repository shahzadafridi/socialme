/** Regression tests run real modules with an asynchronous, copying Chrome storage mock. */
import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
import { resolve } from 'node:path';

let checks = 0;
async function test(name, run) {
  await run(); checks++; console.log(`PASS  ${name}`);
}
const data = {};
const clone = (value) => structuredClone(value);
let failWrite = false;
globalThis.__reliabilityBrowser = {
  storage: { local: {
    async get(key) { await Promise.resolve(); return clone({ [key]: data[key] }); },
    async set(items) { await Promise.resolve(); if (failWrite) throw new Error('storage unavailable'); Object.assign(data, clone(items)); },
  } },
  permissions: { async request() { return true; } },
  runtime: { async sendMessage(message) { return service.handleSubmissionMessage(message); } },
};

let serial = 0;
async function load(path, mocks = {}) {
  const replacements = {
    'wxt/browser': 'export const browser = globalThis.__reliabilityBrowser;',
    ...mocks,
  };
  const build = await rolldown({
    input: resolve(path),
    plugins: [{ name: 'browser-test-boundary',
      resolveId(id) { if (id in replacements) return `\0mock:${id}`; },
      load(id) { if (id.startsWith('\0mock:')) return replacements[id.slice(6)]; },
    }],
  });
  const { output } = await build.generate({ format: 'esm' });
  await build.close();
  return import(`data:text/javascript;base64,${Buffer.from(`${output[0].code}\n// instance ${serial++}`).toString('base64')}`);
}

const storage = await load('lib/data/storage.ts');
const { defaultSettings } = await load('lib/core/defaults.ts');
const service = await load('lib/features/safety/service.ts');
const settingsKey = 'socialme.settings.v1';
const secretsKey = 'socialme.secrets.v1';
// Use the source constants rather than assuming how storage keys are versioned.
const { STORAGE_KEYS } = await load('lib/core/constants.ts');

await test('concurrent individual key saves retain every provider', async () => {
  await Promise.all([storage.setApiKey('openai', 'fake-a'), storage.setApiKey('deepseek', 'fake-b')]);
  assert.deepEqual(data[secretsKey], { openai: 'fake-a', deepseek: 'fake-b' });
});
await test('bulk key save trims keys and supports deletion', async () => {
  await storage.setApiKeys({ openai: ' fake-a ', deepseek: '' });
  assert.deepEqual(data[secretsKey], { openai: 'fake-a' });
});
await test('secret queue recovers after a storage failure', async () => {
  failWrite = true;
  await assert.rejects(storage.setApiKeys({ openai: 'new' }));
  failWrite = false;
  await storage.setApiKeys({ openai: 'fake-a' });
  assert.equal(data[secretsKey].openai, 'fake-a');
});

function resetLimits(cap = 1) {
  const settings = defaultSettings();
  settings.autoSubmit.enabled = true;
  settings.safety = { ...settings.safety, maxActionsPerDay: cap, maxActionsPerHour: cap, minActionGapSec: 0, warmupDays: 0 };
  data[settingsKey] = settings;
  data[STORAGE_KEYS.activity] = [];
  data[STORAGE_KEYS.usage] = {};
}
await test('simultaneous tab requests reserve only the remaining slot', async () => {
  resetLimits();
  const slots = await Promise.all(Array.from({ length: 8 }, () => service.handleSubmissionMessage({ type: 'socialme:reserve-submit', platform: 'linkedin' })));
  assert.equal(slots.filter((slot) => slot.allowance.allowed).length, 1);
  assert.equal(data[STORAGE_KEYS.activity].length, 1);
});
await test('another content-script instance sees updated activity', async () => {
  resetLimits();
  const tab = await load('lib/features/safety/limits.ts');
  assert.equal((await tab.checkAllowance('linkedin', data[settingsKey].safety)).allowed, true);
  await service.handleSubmissionMessage({ type: 'socialme:reserve-submit', platform: 'linkedin' });
  assert.equal((await tab.checkAllowance('linkedin', data[settingsKey].safety)).allowed, false);
});
await test('unconfirmed attempts use the cap without claiming successful delivery', async () => {
  resetLimits();
  const slot = await service.handleSubmissionMessage({ type: 'socialme:reserve-submit', platform: 'x' });
  assert.ok(slot.id);
  assert.deepEqual(data[STORAGE_KEYS.usage], {});
  await service.handleSubmissionMessage({ type: 'socialme:confirm-submit', id: slot.id });
  await service.handleSubmissionMessage({ type: 'socialme:confirm-submit', id: slot.id });
  assert.equal(Object.values(data[STORAGE_KEYS.usage])[0].submitted.x, 1);
});
await test('observed manual submissions are deduplicated and count across tabs', async () => {
  resetLimits();
  const message = { type: 'socialme:observe-submit', platform: 'facebook', id: 'manual-test' };
  await Promise.all([service.handleSubmissionMessage(message), service.handleSubmissionMessage(message)]);
  assert.equal(data[STORAGE_KEYS.activity].length, 1);
  assert.equal((await service.handleSubmissionMessage({ type: 'socialme:reserve-submit', platform: 'linkedin' })).allowance.allowed, false);
});
await test('concurrent usage increments are retained', async () => {
  data[STORAGE_KEYS.usage] = {};
  await Promise.all(Array.from({ length: 10 }, () => storage.recordUsage('linkedin', 'generate')));
  assert.equal(Object.values(data[STORAGE_KEYS.usage])[0].counts.linkedin, 10);
});
await test('backup restores drafts and usage without replacing keys or resetting limits', async () => {
  resetLimits();
  await storage.saveSettings(defaultSettings());
  await storage.addHistory({ platform: 'linkedin', channel: 'comment', personaId: 'test', angle: 'insight', postExcerpt: 'source', draft: 'My saved draft', submitted: false });
  await storage.recordUsage('linkedin', 'generate');
  const backup = await storage.exportAll();
  assert.ok(!backup.includes('fake-a'));
  data[STORAGE_KEYS.history] = [];
  data[STORAGE_KEYS.usage] = {};
  data[STORAGE_KEYS.activity] = [{ ts: Date.now(), platform: 'x', kind: 'submit' }];
  await storage.importAll(backup);
  assert.equal((await storage.getHistory())[0].draft, 'My saved draft');
  assert.equal((await storage.getUsage()).counts.linkedin, 1);
  assert.equal(data[secretsKey].openai, 'fake-a');
  assert.equal(data[STORAGE_KEYS.activity].length, 1);
});
await test('malformed backup is rejected before changing settings', async () => {
  const before = clone(data[settingsKey]);
  await assert.rejects(storage.importAll(JSON.stringify({ settings: defaultSettings(), history: [{}] })));
  assert.deepEqual(data[settingsKey], before);
});

const { readSSE, pickText } = await load('lib/core/ai/sse.ts');
const encoder = new TextEncoder();
async function events(chunks) {
  const response = new Response(new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
    controller.close();
  } }));
  const result = [];
  for await (const event of readSSE(response)) result.push(event);
  return result;
}
await test('SSE works at every byte split, including CRLF and Unicode', async () => {
  const frame = 'data: {"choices":[{"delta":{"content":"Hi 🙂 اردو"}}]}\r\n\r\n';
  const bytes = encoder.encode(frame);
  for (let split = 1; split < bytes.length; split++) {
    const result = await events([bytes.slice(0, split), bytes.slice(split)]);
    assert.equal(result.length, 1, `split ${split}`);
    assert.equal(pickText(JSON.parse(result[0])), 'Hi 🙂 اردو');
  }
});
await test('SSE joins multi-line data, ignores comments and DONE', async () => {
  assert.deepEqual(await events([':keepalive\n\ndata: {"a":\ndata: 1}\n\ndata: [DONE]\n\n']), ['{"a":\n1}']);
});

const { analyzeDraft } = await load('lib/core/ai/quality.ts');
await test('checks distinguish grounded numbers from numbers absent in context', () => {
  const context = { source: 'The team ships every 2 weeks.', notes: '' };
  assert.deepEqual(analyzeDraft('We ship every 2 weeks.', 'linkedin', 700, context).unsupportedNumbers, []);
  assert.deepEqual(analyzeDraft('We cut costs by 40%.', 'linkedin', 700, context).unsupportedNumbers, ['40%']);
});
await test('checks flag repeated source and similar recent replies', () => {
  const text = 'Smaller changes make review easier and help teams ship with confidence.';
  const report = analyzeDraft(text, 'linkedin', 700, { source: text, recentDrafts: [text] });
  assert.equal(report.repeatsSource, true);
  assert.equal(report.duplicate, true);
});
await test('adding a number alone does not improve the score', () => {
  assert.equal(analyzeDraft('Our team reviews small changes every week.', 'linkedin', 700).score,
    analyzeDraft('Our team reviews 3 small changes every week.', 'linkedin', 700).score);
});

globalThis.__delivery = { text: '', click: () => {}, before: 0 };
const { deliverDraft } = await load('lib/features/deliver.ts', {
  '@/lib/integrations/insert': `export const editorText = () => globalThis.__delivery.text; export async function insertIntoEditor(_editor,text){globalThis.__delivery.text=text;return true;} export const humanClick=()=>globalThis.__delivery.click(); export const submitViaKeyboard=()=>globalThis.__delivery.click();`,
  '@/lib/features/safety/humanize': 'export async function typeLikeHuman(){return true;}',
  '@/lib/features/safety/submissions': 'export function trackManualDraft(){}',
  '@/lib/shared/dom': 'export async function sleep(){} export const randomBetween=(min)=>min;',
});
const editor = { isConnected: true };
const adapter = { id: 'linkedin', hasContent: () => Boolean(globalThis.__delivery.text), submitButton: () => ({}) };
await test('disappearing editor is unconfirmed, not reported as sent', async () => {
  editor.isConnected = true;
  globalThis.__delivery.click = () => { editor.isConnected = false; };
  const result = await deliverDraft(adapter, { editor, text: 'draft', submit: true });
  assert.equal(result.submitted, false);
  assert.equal(result.attempted, true);
});
await test('connected cleared editor is distinguished from unknown delivery', async () => {
  editor.isConnected = true;
  globalThis.__delivery.click = () => { globalThis.__delivery.text = ''; };
  assert.equal((await deliverDraft(adapter, { editor, text: 'draft', submit: true })).submitted, true);
});
await test('a failed final limit check prevents dispatch', async () => {
  let clicked = false;
  editor.isConnected = true;
  globalThis.__delivery.click = () => { clicked = true; };
  await assert.rejects(deliverDraft(adapter, { editor, text: 'draft', submit: true, beforeSubmit: async () => { throw new Error('cap'); } }), /cap/);
  assert.equal(clicked, false);
});
await test('cancelled delivery never dispatches a send', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(deliverDraft(adapter, { editor, text: 'draft', submit: true, signal: controller.signal }));
});

await test('disabling auto-send prevents a new reservation', async () => {
  resetLimits(); data[settingsKey].autoSubmit.enabled = false;
  const result = await service.handleSubmissionMessage({ type: 'socialme:reserve-submit', platform: 'linkedin' });
  assert.equal(result.allowance.allowed, false);
  assert.equal(data[STORAGE_KEYS.activity].length, 0);
});

globalThis.__composer = {};
const { applyComposerDraft } = await load('lib/ui/composer/index.ts', {
  '@/lib/integrations/insert': `export const editorText=e=>e.text; export const looksInserted=(e,text)=>e.text.trim()===text.trim(); export async function insertIntoEditor(e,text){globalThis.__composer.writes++;e.text=text;return true;}`,
  '@/lib/data/storage': `export async function saveLastDraft(text){globalThis.__composer.saved=text;} export async function addHistory(item){globalThis.__composer.history=item;} export async function getSettings(){} export function resolvePersona(){return {};}`,
  '@/lib/ui/composer/button': `export function setState(e,state,message){e.state=state;e.message=message;} export function styleButton(){}`,
  '@/lib/ui/composer/review': `export async function reviewReplacement(){globalThis.__composer.reviews++;globalThis.__composer.onReview?.();return globalThis.__composer.replace;} export function offerUndo(_editor,previous){globalThis.__composer.undo=previous;}`,
  '@/lib/features/safety/humanize': 'export async function typeLikeHuman(){return true;}',
  '@/lib/features/safety/submissions': 'export function trackManualDraft(){}',
});
const previewSettings = { ...defaultSettings(), safety: { ...defaultSettings().safety, humanTyping: false } };
async function applyDraft({ initial = '', previous = initial, replace = true, onReview, aborted = false, mode = 'comment', text = 'Generated reply' } = {}) {
  globalThis.__composer = { writes: 0, reviews: 0, replace, onReview };
  const entry = { editor: { text: initial, isConnected: true }, button: {}, mode };
  const controller = new AbortController(); if (aborted) controller.abort();
  await applyComposerDraft(entry, text, previewSettings, { id: 'linkedin' }, 'source', previous, 'selected-voice', controller.signal);
  return entry;
}
await test('existing draft survives when replacement is declined', async () => {
  const entry = await applyDraft({ initial: 'My handwritten reply', replace: false });
  assert.equal(entry.editor.text, 'My handwritten reply');
  assert.equal(globalThis.__composer.writes, 0);
  assert.equal(globalThis.__composer.saved, 'Generated reply');
  assert.equal(entry.state, 'idle');
});
await test('approved replacement keeps the original text for Undo', async () => {
  const entry = await applyDraft({ initial: 'My handwritten reply' });
  assert.equal(entry.editor.text, 'Generated reply');
  assert.equal(globalThis.__composer.undo, 'My handwritten reply');
  assert.equal(globalThis.__composer.history.personaId, 'selected-voice');
});
await test('empty editor receives a completed draft without replacement confirmation', async () => {
  const entry = await applyDraft();
  assert.equal(entry.editor.text, 'Generated reply');
  assert.equal(globalThis.__composer.reviews, 0);
});
await test('cancelled generation cannot replace or save a draft', async () => {
  const entry = await applyDraft({ initial: 'Keep mine', aborted: true });
  assert.equal(entry.editor.text, 'Keep mine');
  assert.equal(globalThis.__composer.writes, 0);
  assert.equal(globalThis.__composer.saved, undefined);
});
await test('an edit made during replacement review is preserved', async () => {
  globalThis.__composer = { writes: 0, reviews: 0, replace: true };
  const entry = { editor: { text: 'Old reply', isConnected: true }, button: {}, mode: 'comment' };
  globalThis.__composer.onReview = () => { entry.editor.text = 'My newer edit'; };
  await applyComposerDraft(entry, 'Generated reply', previewSettings, { id: 'linkedin' }, 'source', 'Old reply', 'voice', new AbortController().signal);
  assert.equal(entry.editor.text, 'My newer edit');
  assert.equal(globalThis.__composer.writes, 0);
});
await test('connection-note insertion enforces the note character cap', async () => {
  const entry = await applyDraft({ mode: 'note', text: 'A long invitation '.repeat(30) });
  assert.ok(entry.editor.text.length <= 300);
});
await test('a reply cannot land in a different conversation after context changes', async () => {
  globalThis.__composer = { writes: 0, reviews: 0, replace: true };
  const entry = { editor: { text: '', isConnected: true }, button: {}, mode: 'dm' };
  await applyComposerDraft(entry, 'Reply to the previous person', previewSettings, { id: 'linkedin' }, 'old conversation', '', 'voice', new AbortController().signal, () => false);
  assert.equal(globalThis.__composer.writes, 0);
  assert.equal(entry.editor.text, '');
  assert.ok(entry.message.includes('conversation changed'));
});

const { buildPrompt } = await load('lib/core/ai/prompt.ts');
await test('draft refinement preserves source and current wording without generating a new angle', () => {
  const prompt = buildPrompt({
    platform: 'linkedin', persona: defaultSettings().personas[0],
    request: { platform: 'linkedin', channel: 'comment', post: { text: 'Original source context' }, revision: { text: 'My existing reply', instruction: 'Make it shorter' } },
  });
  assert.ok(prompt.user.includes('My existing reply'));
  assert.ok(prompt.user.includes('Make it shorter'));
  assert.ok(prompt.user.includes('Original source context'));
  assert.ok(!prompt.user.includes('ANGLE —'));
});

const { mergeSettings } = await load('lib/core/defaults.ts');
const { selectWritingSamples } = await load('lib/core/ai/voice.ts');
const assistantStore = await load('lib/features/assistant/store.ts');
const { ASSISTANT_KEY } = assistantStore;
const { loadWritingVoice } = await load('lib/data/voice.ts');

await test('voice migration separates starter wording from actual user examples', () => {
  const old = defaultSettings(); old.personaSeedVersion = 2;
  const lens = old.personas.find((p) => p.id === 'p_expert');
  lens.samplePosts = lens.styleExamples; delete lens.styleExamples;
  old.personas[0].samplePosts = 'My own terse comment. This is mine.';
  old.personas[0].styleNotes = 'Keep my edited style.';
  const next = mergeSettings(old);
  assert.equal(next.personas.find((p) => p.id === 'p_expert').samplePosts, '');
  assert.ok(next.personas.find((p) => p.id === 'p_expert').styleExamples);
  assert.equal(next.personas[0].samplePosts, 'My own terse comment. This is mine.');
  assert.equal(next.personas[0].styleNotes, 'Keep my edited style.');
  assert.deepEqual(mergeSettings(next), next);
});
await test('migration preserves edited topic-specific writing examples', () => {
  const old = defaultSettings(); old.personaSeedVersion = 2;
  old.personas[1].samplePosts = 'An example I actually edited myself.';
  assert.equal(mergeSettings(old).personas[1].samplePosts, 'An example I actually edited myself.');
});
await test('default settings do not share mutable voice objects', () => {
  const one = defaultSettings(), two = defaultSettings();
  one.personas[0].role = 'Changed only here';
  one.personas[0].voicePreferences.questions = 'never';
  assert.notEqual(two.personas[0].role, 'Changed only here');
  assert.equal(two.personas[0].voicePreferences.questions, 'when-needed');
});
await test('a topic voice inherits my real identity and approved rhythm across reply types', async () => {
  data[ASSISTANT_KEY] = undefined;
  const settings = defaultSettings();
  settings.personas[0].role = 'Android engineer';
  settings.personas[0].samplePosts = "Yeah, that's the bit I'd check first. Small changes are easier to review.";
  const voice = await loadWritingVoice(settings, settings.personas.find((p) => p.id === 'p_expert'));
  for (const channel of ['comment', 'dm', 'note']) {
    const prompt = buildPrompt({ platform: 'linkedin', ...voice, request: { platform: 'linkedin', channel, post: { text: 'How do you keep reviews manageable?' } } });
    assert.ok(prompt.system.includes('Who I am: Android engineer'));
    assert.ok(prompt.system.includes("that's the bit I'd check first"));
    assert.ok(!prompt.system.includes('Who I am: Principal-level'));
    assert.ok(!prompt.system.includes('WRITING I ACTUALLY PUBLISHED'));
  }
});
await test('a natural reply is not forced to be clever, long, branded or a closing question', () => {
  const prompt = buildPrompt({ platform: 'linkedin', persona: defaultSettings().personas[0], request: { platform: 'linkedin', channel: 'comment', post: { text: 'Finally fixed that bug.' } } });
  assert.ok(prompt.user.includes('ANGLE — NATURAL'));
  assert.ok(prompt.system.includes('Never pad a reply'));
  assert.ok(!prompt.system.includes('get the most reach'));
  assert.ok(!prompt.system.includes('End with something the other person can answer'));
  assert.ok(!prompt.system.includes('pick one of my pillars'));
});
await test('questions and contraction settings apply to the voice brief', () => {
  const persona = { ...defaultSettings().personas[0], voicePreferences: { register: 'formal', questions: 'never', contractions: false } };
  const prompt = buildPrompt({ platform: 'linkedin', persona, request: { platform: 'linkedin', channel: 'comment', angle: 'question' } });
  assert.ok(prompt.system.includes('Never add a question'));
  assert.ok(prompt.system.includes('Use full forms rather than contractions'));
});
await test('brand can be relevant or off while forbidden claims always remain', () => {
  const brand = { ...defaultSettings().brand, positioning: 'mobile consultant', pillars: 'Kotlin', forbidden: 'Never name private clients' };
  const build = (mode) => buildPrompt({ platform: 'linkedin', persona: defaultSettings().personas[0], brand: { ...brand, mode }, request: { platform: 'linkedin', channel: 'comment' } });
  assert.ok(build('relevant').system.includes('only where the source naturally calls for it'));
  assert.ok(!build('off').system.includes('mobile consultant'));
  assert.ok(build('off').system.includes('Never name private clients'));
});
await test('topic-matched and recent approved samples survive a long example list', () => {
  const samples = ['This is my Kotlin review comment.', ...Array.from({ length: 8 }, (_, i) => `Some unrelated gardening example number ${i}.`)].join('\n\n');
  assert.ok(selectWritingSamples(samples, 'Kotlin review').includes('This is my Kotlin review comment.'));
  assert.equal(selectWritingSamples(samples, 'unmatched').length, 4);
});
await test('approved feedback and examples are deduplicated and used on future requests', async () => {
  data[ASSISTANT_KEY] = undefined;
  await assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', rule: 'Use fewer adjectives.', sample: 'This is how I would actually say it.' });
  await assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', rule: 'Use fewer adjectives.', sample: 'This is how I would actually say it.' });
  const settings = defaultSettings();
  const voice = await loadWritingVoice(settings, settings.personas[0]);
  const prompt = buildPrompt({ platform: 'linkedin', ...voice, request: { platform: 'linkedin', channel: 'comment' } });
  assert.ok(prompt.system.includes('User-approved preference: Use fewer adjectives.'));
  assert.ok(prompt.system.includes('This is how I would actually say it.'));
  assert.equal(data[ASSISTANT_KEY].feedback.p_default.rules.length, 1);
  await assistantStore.updateAssistant({ kind: 'remove-feedback', personaId: 'p_default', field: 'rules', value: 'Use fewer adjectives.' });
  assert.equal((await assistantStore.getAssistantState()).feedback.p_default.rules.length, 0);
});
await test('session progress counts unique explicit reviews rather than drafts or sends', async () => {
  await assistantStore.updateAssistant({ kind: 'start', goal: 'relationships', target: 3 });
  assert.deepEqual((await assistantStore.getAssistantState()).session.reviewed, []);
  await Promise.all([assistantStore.updateAssistant({ kind: 'reviewed', key: 'thread-a' }), assistantStore.updateAssistant({ kind: 'reviewed', key: 'thread-a' }), assistantStore.updateAssistant({ kind: 'reviewed', key: 'thread-b' })]);
  assert.equal((await assistantStore.getAssistantState()).session.reviewed.length, 2);
});
await test('concurrent saved conversations and follow-up edits are retained', async () => {
  const bookmark = { platform: 'linkedin', url: 'https://www.linkedin.com/feed/update/urn:li:activity:123/', author: 'A person', excerpt: 'Kotlin reviews', note: 'Ask how the migration went.', dueAt: Date.now() + 86400000 };
  await Promise.all([assistantStore.updateAssistant({ kind: 'bookmark', bookmark }), assistantStore.updateAssistant({ kind: 'bookmark', bookmark: { ...bookmark, url: 'https://www.linkedin.com/feed/update/urn:li:activity:456/' } })]);
  let state = await assistantStore.getAssistantState();
  assert.equal(state.bookmarks.length, 2);
  const saved = state.bookmarks[0];
  await assistantStore.updateAssistant({ kind: 'update-bookmark', id: saved.id, note: 'Updated note', completed: true });
  state = await assistantStore.getAssistantState();
  assert.equal(state.bookmarks[0].completed, true);
  assert.equal(state.bookmarks[0].note, 'Updated note');
  await assistantStore.updateAssistant({ kind: 'update-bookmark', id: saved.id, note: 'Updated note', completed: false });
  assert.equal((await assistantStore.getAssistantState()).bookmarks[0].completed, false);
});
await test('saved conversations reject executable links, external hosts, credentials and feed URLs', async () => {
  for (const url of ['javascript:alert(1)', 'https://linkedin.com.evil.example/thread', 'https://user:pass@www.linkedin.com/thread', 'https://www.linkedin.com/feed/']) {
    await assert.rejects(assistantStore.updateAssistant({ kind: 'bookmark', bookmark: { platform: 'linkedin', url, author: '', excerpt: '', note: '' } }));
  }
});
await test('backups preserve voice calibration, saved conversations and sessions', async () => {
  const before = await assistantStore.getAssistantState();
  const backup = await storage.exportAll();
  data[ASSISTANT_KEY] = undefined;
  await storage.importAll(backup);
  assert.deepEqual(await assistantStore.getAssistantState(), before);
});
await test('paused platforms cannot reserve an automatic send', async () => {
  resetLimits();
  await assistantStore.updateAssistant({ kind: 'pause', platform: 'linkedin', paused: true });
  const result = await service.handleSubmissionMessage({ type: 'socialme:reserve-submit', platform: 'linkedin' });
  assert.equal(result.allowance.allowed, false);
  assert.ok(result.allowance.reason.includes('paused'));
  await assistantStore.updateAssistant({ kind: 'pause', platform: 'linkedin', paused: false });
});
const { conversationAdvice } = await load('lib/features/assistant/advice.ts');
await test('opportunity hints name actual topic matches and avoid unrelated brand tie-ins', () => {
  const advice = conversationAdvice('How do you test Kotlin offline flows?', 'Kotlin Android mobile', 'expertise');
  assert.deepEqual(advice.matches, ['kotlin']);
  assert.equal(advice.angle, 'tip');
  assert.deepEqual(conversationAdvice('A nice sunset.', 'Kotlin Android').matches, []);
});

await test('rough thoughts carry the user position across every reply type without an angle override', () => {
  for (const channel of ['comment', 'dm', 'note']) {
    for (const thought of ['Agree, but migration costs matter.', 'I disagree: a rewrite is not necessary.', "I'm not sure yet; I need to test it."]) {
      const prompt = buildPrompt({ platform: 'linkedin', persona: defaultSettings().personas[0],
        request: { platform: 'linkedin', channel, angle: 'contrarian', roughThought: thought, post: { text: 'We should rewrite the app.' } } });
      assert.ok(prompt.user.includes(JSON.stringify(thought)));
      assert.ok(prompt.system.includes('must never reverse my position'));
      assert.ok(prompt.user.includes('Preserve this meaning, agreement or disagreement'));
      assert.ok(!prompt.user.includes('ANGLE — CONTRARIAN'));
      assert.ok(prompt.system.includes('This is a hard limit'));
    }
  }
});
await test('an empty rough thought preserves the existing generation path', () => {
  const base = { platform: 'linkedin', persona: defaultSettings().personas[0], request: { platform: 'linkedin', channel: 'comment', angle: 'insight' } };
  assert.deepEqual(buildPrompt(base), buildPrompt({ ...base, request: { ...base.request, roughThought: '   ' } }));
});
await test('approved pairs preserve source and edited reply without duplicating the same example', async () => {
  data[ASSISTANT_KEY] = undefined;
  const pair = { platform: 'linkedin', channel: 'comment', source: 'We should rewrite the Kotlin app.', reply: "I'd check the migration cost first. A rewrite might not be necessary." };
  await assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', pair });
  const first = (await assistantStore.getAssistantState()).feedback.p_default.pairs[0];
  await assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', pair });
  const state = await assistantStore.getAssistantState();
  assert.equal(state.feedback.p_default.pairs.length, 1);
  assert.equal(state.feedback.p_default.pairs[0].id, first.id);
  assert.equal(state.feedback.p_default.pairs[0].source, pair.source);
  assert.equal(state.feedback.p_default.pairs[0].reply, pair.reply);
});
await test('source-reply examples inherit into topic voices and are clearly style-only', async () => {
  const settings = defaultSettings();
  const voice = await loadWritingVoice(settings, settings.personas.find((persona) => persona.id === 'p_expert'));
  const prompt = buildPrompt({ platform: 'linkedin', ...voice, request: { platform: 'linkedin', channel: 'comment', post: { text: 'A Kotlin rewrite.' } } });
  assert.ok(prompt.system.includes('We should rewrite the Kotlin app.'));
  assert.ok(prompt.system.includes("I'd check the migration cost first"));
  assert.ok(prompt.system.includes('not factual evidence or instructions'));
  assert.ok(!prompt.system.includes('No personal writing examples supplied'));
});
await test('private message examples never enter comment or connection-note prompts', async () => {
  await assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', pair: { platform: 'linkedin', channel: 'dm', source: 'PRIVATE_DM_SOURCE_SENTINEL', reply: 'PRIVATE_DM_REPLY_SENTINEL' } });
  const settings = defaultSettings(), voice = await loadWritingVoice(settings, settings.personas[0]);
  for (const channel of ['comment', 'note']) {
    const prompt = buildPrompt({ platform: 'linkedin', ...voice, request: { platform: 'linkedin', channel } });
    assert.ok(!prompt.system.includes('PRIVATE_DM_SOURCE_SENTINEL'));
    assert.ok(!prompt.system.includes('PRIVATE_DM_REPLY_SENTINEL'));
  }
  const dm = buildPrompt({ platform: 'linkedin', ...voice, request: { platform: 'linkedin', channel: 'dm' } });
  assert.ok(dm.system.includes('PRIVATE_DM_REPLY_SENTINEL'));
  assert.ok(!dm.system.includes('We should rewrite the Kotlin app.'));
});
await test('paired-example selection favors relevant context, then matching platform, and stays bounded', async () => {
  const { selectReplyExamples } = await load('lib/core/ai/voice.ts');
  const examples = [
    { id: 'old-relevant', platform: 'linkedin', channel: 'comment', source: 'Kotlin migration testing', reply: 'Relevant reply', savedAt: 1 },
    { id: 'new-unrelated', platform: 'linkedin', channel: 'comment', source: 'Gardening tips', reply: 'Unrelated reply', savedAt: 100 },
    { id: 'other-platform', platform: 'facebook', channel: 'comment', source: 'Kotlin migration testing', reply: 'Other platform', savedAt: 200 },
    { id: 'private', platform: 'linkedin', channel: 'dm', source: 'Kotlin migration testing', reply: 'Do not select', savedAt: 300 },
  ];
  const selected = selectReplyExamples(examples, 'Kotlin migration testing', 'comment', 'linkedin');
  assert.equal(selected.length, 2);
  assert.equal(selected[0].id, 'old-relevant');
  assert.equal(selected[1].id, 'other-platform');
});
await test('blank or malformed source-reply examples are rejected without changing saved data', async () => {
  const before = await assistantStore.getAssistantState();
  for (const pair of [
    { platform: 'linkedin', channel: 'comment', source: ' ', reply: 'reply' },
    { platform: 'linkedin', channel: 'dm', source: 'message', reply: '' },
    { platform: 'invalid', channel: 'comment', source: 'source', reply: 'reply' },
    { platform: 'linkedin', channel: 'invalid', source: 'source', reply: 'reply' },
    { platform: 'linkedin', channel: 'comment', source: 'source', reply: 'x'.repeat(1201) },
  ]) await assert.rejects(assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', pair }));
  assert.deepEqual(await assistantStore.getAssistantState(), before);
});
await test('saved paired examples survive backup restore and can be removed completely', async () => {
  const before = await assistantStore.getAssistantState();
  const backup = await storage.exportAll();
  data[ASSISTANT_KEY] = undefined;
  await storage.importAll(backup);
  assert.deepEqual(await assistantStore.getAssistantState(), before);
  const target = before.feedback.p_default.pairs.find((pair) => pair.channel === 'dm');
  await assistantStore.updateAssistant({ kind: 'remove-feedback', personaId: 'p_default', field: 'pairs', value: target.id });
  const settings = defaultSettings(), voice = await loadWritingVoice(settings, settings.personas[0]);
  assert.ok(!buildPrompt({ platform: 'linkedin', ...voice, request: { platform: 'linkedin', channel: 'dm' } }).system.includes('PRIVATE_DM_REPLY_SENTINEL'));
});
await test('example retention bounds storage and keeps the most recent approved pairs', async () => {
  data[ASSISTANT_KEY] = undefined;
  for (let index = 0; index < 14; index++) await assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', pair: { platform: 'linkedin', channel: 'comment', source: `Source ${index}`, reply: `Reply ${index}` } });
  const pairs = (await assistantStore.getAssistantState()).feedback.p_default.pairs;
  assert.equal(pairs.length, 12);
  assert.equal(pairs[0].source, 'Source 2');
  assert.equal(pairs.at(-1).source, 'Source 13');
});
await test('paired prompts retain the complete approved reply and the latest DM context', () => {
  const persona = defaultSettings().personas[0];
  const reply = 'A'.repeat(700) + ' But I do not agree with replacing the app.';
  persona.replyExamples = [{ id: 'long-message', platform: 'linkedin', channel: 'dm', source: 'Older context. '.repeat(120) + 'LATEST_MESSAGE_SENTINEL', reply, savedAt: 1 }];
  const prompt = buildPrompt({ platform: 'linkedin', persona, request: { platform: 'linkedin', channel: 'dm' } });
  assert.ok(prompt.system.includes('LATEST_MESSAGE_SENTINEL'));
  assert.ok(prompt.system.includes('But I do not agree with replacing the app.'));
});
await test('a malformed paired example in a backup cannot replace current settings', async () => {
  const before = structuredClone(data[settingsKey]);
  await assert.rejects(storage.importAll(JSON.stringify({ settings: defaultSettings(), assistant: { bookmarks: [], feedback: { p_default: { rules: [], samples: [], pairs: [{ platform: 'linkedin', channel: 'comment', source: 'source' }] } } } })));
  assert.deepEqual(data[settingsKey], before);
});

let onConnect;
globalThis.__reliabilityBrowser.runtime.onInstalled = { addListener() {} };
globalThis.__reliabilityBrowser.runtime.onMessage = { addListener() {} };
globalThis.__reliabilityBrowser.runtime.onConnect = { addListener(fn) { onConnect = fn; } };
const background = await load('entrypoints/background.ts', {
  'wxt/utils/define-background': 'export const defineBackground = fn => fn;',
  '@/lib/core/ai/providers': `export class AiError extends Error {} export async function* streamCompletion(_p,_k,opts){ globalThis.__providerTemperature=opts.temperature; globalThis.__providerPrompt=opts.system; globalThis.__providerUser=opts.user; yield 'A plain reply.'; }`,
});
await test('background generation honors provider temperature and approved voice feedback', async () => {
  resetLimits();
  data[settingsKey].providers.find((p) => p.id === data[settingsKey].activeProvider).temperature = 0.23;
  await assistantStore.updateAssistant({ kind: 'feedback', personaId: 'p_default', rule: 'Keep my brief everyday wording.' });
  background.default();
  let receive;
  const messages = [];
  onConnect({ name: 'socialme:gen', postMessage(message) { messages.push(message); }, onMessage: { addListener(fn) { receive = fn; } }, onDisconnect: { addListener() {} } });
  await receive({ type: 'start', request: { platform: 'linkedin', channel: 'comment', post: { text: 'Kotlin reviews' } } });
  assert.equal(globalThis.__providerTemperature, 0.23);
  assert.ok(globalThis.__providerPrompt.includes('Keep my brief everyday wording.'));
  assert.equal(messages.at(-1).type, 'done');
});

await test('the generation boundary carries and bounds a rough thought before calling the provider', async () => {
  resetLimits();
  let receive;
  onConnect({ name: 'socialme:gen', postMessage() {}, onMessage: { addListener(fn) { receive = fn; } }, onDisconnect: { addListener() {} } });
  const longThought = 'Agree, but migration costs matter. ' + 'x'.repeat(2000);
  await receive({ type: 'start', request: { platform: 'linkedin', channel: 'comment', roughThought: longThought, angle: 'contrarian', post: { text: 'Kotlin reviews' } } });
  assert.ok(globalThis.__providerUser.includes(longThought.slice(0, 1200)));
  assert.ok(!globalThis.__providerUser.includes(longThought));
  assert.ok(!globalThis.__providerUser.includes('ANGLE — CONTRARIAN'));
});

const { applySharedVoiceGuide, SHARED_ENGINEERING_VOICE } = await load('lib/core/shared-voice-guide.ts');
await test('the shared guide changes style without replacing real identity, examples or provider configuration', () => {
  const settings = defaultSettings();
  settings.personas[0].role = 'My verified engineering role';
  settings.personas[0].samplePosts = 'A comment I actually wrote.';
  settings.personas[0].replyExamples = [{ id: 'authored', platform: 'linkedin', channel: 'comment', source: 'A source', reply: 'My own reply', savedAt: 1 }];
  settings.brand.proof = 'Only my supplied proof'; settings.brand.stories = 'A real story I supplied';
  settings.defaults.tone = 'Formal'; settings.platformTone.linkedin = 'Formal';
  const before = structuredClone(settings);
  const next = applySharedVoiceGuide(settings);
  assert.deepEqual(settings, before);
  assert.equal(next.personas[0].role, 'My verified engineering role');
  assert.equal(next.personas[0].samplePosts, 'A comment I actually wrote.');
  assert.deepEqual(next.personas[0].replyExamples, settings.personas[0].replyExamples);
  assert.equal(next.brand.proof, settings.brand.proof);
  assert.equal(next.brand.stories, settings.brand.stories);
  assert.deepEqual(next.providers, settings.providers);
  assert.equal(next.activeProvider, settings.activeProvider);
  assert.equal(next.defaults.tone, '');
  assert.equal(next.platformTone.linkedin, 'inherit');
  assert.equal(next.personas[0].styleNotes, SHARED_ENGINEERING_VOICE.styleNotes);
});
await test('reapplying the shared guide is idempotent and keeps custom forbidden wording', () => {
  const settings = defaultSettings();
  settings.personas[0].bannedWords = 'My custom banned phrase';
  settings.personas[0].avoid = 'My custom boundary';
  const next = applySharedVoiceGuide(settings);
  assert.ok(next.personas[0].bannedWords.includes('My custom banned phrase'));
  assert.ok(next.personas[0].avoid.includes('My custom boundary'));
  assert.deepEqual(applySharedVoiceGuide(next), next);
});
await test('shared-guide illustrations are not imported as authored samples or factual proof', () => {
  const settings = applySharedVoiceGuide(defaultSettings());
  assert.equal(settings.personas[0].samplePosts, '');
  assert.equal(settings.brand.proof, ''); assert.equal(settings.brand.stories, '');
  const prompt = buildPrompt({ platform: 'linkedin', persona: settings.personas[0], request: { platform: 'linkedin', channel: 'comment' } });
  assert.ok(prompt.system.includes('Illustrative starter wording'));
  assert.ok(!prompt.system.includes('USER-APPROVED WRITING EXAMPLES'));
});
await test('the shared guide remains opt-in and topic voices inherit the applied real identity', async () => {
  assert.equal(defaultSettings().personas[0].role, '');
  const settings = applySharedVoiceGuide(defaultSettings());
  const voice = await loadWritingVoice(settings, settings.personas.find((p) => p.id === 'p_architect'));
  assert.equal(voice.identity.id, 'p_default');
  assert.ok(voice.identity.styleNotes.includes('direct, curious, practical'));
  const prompt = buildPrompt({ platform: 'linkedin', ...voice, request: { platform: 'linkedin', channel: 'comment' } });
  assert.ok(prompt.system.includes('Who I am: Mobile/software architect'));
  assert.ok(prompt.system.includes('not a factual credential or job title'));
});

console.log(`\n${checks}/${checks} reliability checks passed`);
