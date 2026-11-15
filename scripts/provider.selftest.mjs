/**
 * Provider request/response contract tests with a stubbed fetch.
 * Run with: rolldown scripts/provider.selftest.mjs --format esm --file .tmp/provider.selftest.mjs
 */
import { AiError, listModels, streamCompletion } from '../lib/core/ai/providers.ts';

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

const encoder = new TextEncoder();

function stubFetch({ status = 200, chunks = [], json, headers = {} }) {
  const captured = { calls: [] };
  globalThis.fetch = async (url, init) => {
    captured.calls.push({ url: String(url), init });
    if (json !== undefined) {
      return new Response(JSON.stringify(json), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(stream, {
      status,
      headers: { 'content-type': headers['content-type'] ?? 'text/event-stream' },
    });
  };
  return captured;
}

const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;

const deepseek = {
  id: 'deepseek',
  enabled: true,
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  temperature: 0.9,
};

const anthropic = {
  id: 'anthropic',
  enabled: true,
  baseUrl: 'https://api.anthropic.com/v1',
  model: 'claude-sonnet-4-5',
  temperature: 0.8,
};

const gemini = {
  id: 'gemini',
  enabled: true,
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-2.5-flash',
  temperature: 0.8,
};

async function collect(provider, key, extra = {}) {
  let out = '';
  for await (const delta of streamCompletion(provider, key, {
    system: 'sys',
    user: 'usr',
    maxTokens: 300,
    ...extra,
  })) {
    out += delta;
  }
  return out;
}

/* --------------------------- openai-compatible --------------------------- */

{
  const captured = stubFetch({
    chunks: [
      sse({ choices: [{ delta: { content: 'Hello' } }] }),
      sse({ choices: [{ delta: { content: ' world' } }] }),
      'data: [DONE]\n\n',
    ],
  });

  const text = await collect(deepseek, 'sk-test');
  const call = captured.calls[0];
  const body = JSON.parse(call.init.body);

  ok('openai: streams deltas in order', text === 'Hello world', text);
  ok('openai: correct endpoint', call.url === 'https://api.deepseek.com/chat/completions', call.url);
  ok('openai: bearer auth header', call.init.headers.Authorization === 'Bearer sk-test');
  ok('openai: model forwarded', body.model === 'deepseek-chat');
  ok('openai: stream requested', body.stream === true);
  ok('openai: system message first', body.messages[0].role === 'system' && body.messages[0].content === 'sys');
  ok('openai: user message second', body.messages[1].role === 'user');
  ok('openai: max tokens forwarded', body.max_tokens === 300);
}

/* ------------------------------- anthropic ------------------------------- */

{
  const captured = stubFetch({
    chunks: [
      sse({ type: 'message_start' }),
      sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Sharp ' } }),
      sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'take.' } }),
    ],
  });

  const text = await collect(anthropic, 'sk-ant');
  const call = captured.calls[0];
  const body = JSON.parse(call.init.body);

  ok('anthropic: streams text deltas', text === 'Sharp take.', text);
  ok('anthropic: messages endpoint', call.url === 'https://api.anthropic.com/v1/messages', call.url);
  ok('anthropic: x-api-key header', call.init.headers['x-api-key'] === 'sk-ant');
  ok('anthropic: browser access header', call.init.headers['anthropic-dangerous-direct-browser-access'] === 'true');
  ok('anthropic: version header', call.init.headers['anthropic-version'] === '2023-06-01');
  ok('anthropic: system is top-level', body.system === 'sys');
  ok('anthropic: max_tokens required', body.max_tokens === 300);
}

/* --------------------------------- gemini -------------------------------- */

{
  const captured = stubFetch({
    chunks: [
      sse({ candidates: [{ content: { parts: [{ text: 'Numbers ' }] } }] }),
      sse({ candidates: [{ content: { parts: [{ text: 'beat vibes.' }] } }] }),
    ],
  });

  const text = await collect(gemini, 'AIza-key');
  const call = captured.calls[0];
  const body = JSON.parse(call.init.body);

  ok('gemini: streams parts', text === 'Numbers beat vibes.', text);
  ok(
    'gemini: streamGenerateContent with key',
    call.url.includes(':streamGenerateContent?alt=sse') && call.url.includes('key=AIza-key'),
    call.url,
  );
  ok('gemini: systemInstruction used', body.systemInstruction.parts[0].text === 'sys');
  ok('gemini: generationConfig temperature', body.generationConfig.temperature === 0.8);
}

/* -------------------------------- failures ------------------------------- */

{
  stubFetch({ status: 401, json: { error: { message: 'Invalid API key' } } });
  let error = null;
  try {
    await collect(deepseek, 'bad');
  } catch (err) {
    error = err;
  }
  ok('auth failure surfaces as AiError', error instanceof AiError && error.code === 'auth', error?.message);
  ok('auth failure keeps the provider detail', error?.message.includes('Invalid API key'), error?.message);

  stubFetch({ status: 429, json: { error: { message: 'slow down' } } });
  error = null;
  try {
    await collect(deepseek, 'k');
  } catch (err) {
    error = err;
  }
  ok('rate limit surfaces as AiError', error?.code === 'rate_limit');

  stubFetch({ status: 402, json: { error: { message: 'no credit' } } });
  error = null;
  try {
    await collect(deepseek, 'k');
  } catch (err) {
    error = err;
  }
  ok('billing failure surfaces as AiError', error?.code === 'billing');

  // A proxy that ignores stream:true
  stubFetch({ json: { choices: [{ message: { content: 'single blob' } }] } });
  const blob = await collect(deepseek, 'k');
  ok('non-streaming response still works', blob === 'single blob', blob);
}

/* -------------------------------- models -------------------------------- */

{
  const captured = stubFetch({
    json: { data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4.1' }, { id: 'o4-mini' }] },
  });
  const models = await listModels(
    { ...deepseek, id: 'openai', baseUrl: 'https://api.openai.com/v1' },
    'sk-x',
  );
  ok('models: openai list parsed', models.length === 3 && models[0] === 'gpt-4.1', JSON.stringify(models));
  ok('models: openai endpoint', captured.calls[0].url === 'https://api.openai.com/v1/models');

  stubFetch({
    json: { models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', supportedGenerationMethods: ['embedContent'] }] },
  });
  const geminiModels = await listModels(gemini, 'AIza');
  ok(
    'models: gemini filters non-chat models',
    geminiModels.length === 1 && geminiModels[0] === 'gemini-2.5-flash',
    JSON.stringify(geminiModels),
  );
}

/* ------------------------------- missing key ------------------------------ */

function stubModelPages(pages) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const page = pages[calls.length - 1];
    if (!page) throw new Error('Unexpected additional page request');
    return new Response(JSON.stringify(page.json), { status: page.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

{
  const calls = stubModelPages([
    { json: { models: [{ name: 'models/text-one', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'cursor / ?' } },
    { json: { models: [{ name: 'models/text-two', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed-only', supportedGenerationMethods: ['embedContent'] }] } },
  ]);
  const models = await listModels(gemini, 'fake-key');
  ok('models: Gemini loads all catalogue pages', models.join(',') === 'text-one,text-two');
  ok('models: Gemini forwards the encoded cursor and keeps authentication', new URL(calls[1].url).searchParams.get('pageToken') === 'cursor / ?' && new URL(calls[1].url).searchParams.get('key') === 'fake-key');
}

{
  const calls = stubModelPages([
    { json: { data: [{ id: 'text-one' }], has_more: true, last_id: 'cursor / ?' } },
    { json: { data: [{ id: 'text-two' }, { id: 'text-one' }], has_more: false } },
  ]);
  const models = await listModels(anthropic, 'fake-key');
  ok('models: Anthropic loads all pages and removes duplicates', models.join(',') === 'text-one,text-two');
  ok('models: Anthropic uses after_id without changing the endpoint', new URL(calls[1].url).searchParams.get('after_id') === 'cursor / ?' && new URL(calls[1].url).origin === 'https://api.anthropic.com');
  ok('models: Anthropic authenticates every page', calls.every((call) => call.init.headers['x-api-key'] === 'fake-key'));
}

{
  stubModelPages([
    { json: { data: [{ id: 'text-one' }], has_more: true, last_id: 'same-cursor' } },
    { json: { data: [{ id: 'text-one' }], has_more: true, last_id: 'same-cursor' } },
  ]);
  let error;
  try { await listModels(anthropic, 'fake-key'); } catch (err) { error = err; }
  ok('models: repeated pagination cursors fail instead of looping', error?.code === 'format');
}

{
  const calls = stubModelPages([
    { status: 404, json: { error: 'not found' } },
    { json: { models: [{ name: 'local-one:latest' }, { model: 'local-two:small' }] } },
  ]);
  const models = await listModels({ ...deepseek, id: 'ollama', baseUrl: 'http://localhost:11434/v1' }, '');
  ok('models: Ollama falls back to the installed-model catalogue', models.join(',') === 'local-one:latest,local-two:small');
  ok('models: Ollama uses the native tags endpoint after a 404', calls[0].url === 'http://localhost:11434/v1/models' && calls[1].url === 'http://localhost:11434/api/tags');
}

{
  const calls = stubModelPages([{ json: { data: [{ id: 'provider-live-model' }, { id: 'provider-live-model' }, { id: '' }, {}, 'other-live-model'] } }]);
  const models = await listModels({ ...deepseek, id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' }, 'fake-key');
  ok('models: OpenRouter displays actual returned IDs, not preset suggestions', models.join(',') === 'other-live-model,provider-live-model');
  ok('models: OpenRouter uses its own catalogue and key', calls[0].url === 'https://openrouter.ai/api/v1/models' && calls[0].init.headers.Authorization === 'Bearer fake-key');
}

{
  const calls = stubModelPages([{ json: { data: [{ id: 'custom-live-model' }] } }]);
  const models = await listModels({ ...deepseek, id: 'custom', baseUrl: 'https://proxy.example/my-prefix/v1/' }, 'fake-key');
  ok('models: custom providers preserve the configured base path', calls[0].url === 'https://proxy.example/my-prefix/v1/models' && models[0] === 'custom-live-model');
}

{
  stubModelPages([{ json: { data: [] } }]);
  ok('models: an empty catalogue stays empty rather than inventing choices', (await listModels(deepseek, 'fake-key')).length === 0);
  stubModelPages([{ json: { unexpected: [] } }]);
  let error;
  try { await listModels(deepseek, 'fake-key'); } catch (err) { error = err; }
  ok('models: malformed catalogues explain manual entry instead of claiming success', error?.code === 'format');
}

{
  const calls = stubModelPages([{ json: { data: [{ id: 'unused' }] } }]);
  const controller = new AbortController(); controller.abort();
  let error;
  try { await listModels(deepseek, 'fake-key', controller.signal); } catch (err) { error = err; }
  ok('models: cancelled requests do not fetch or return obsolete choices', calls.length === 0 && error?.code === 'aborted');
}

{
  stubFetch({ chunks: [] });
  let error = null;
  try {
    await collect({ ...deepseek, id: 'openai' }, '');
  } catch (err) {
    error = err;
  }
  ok('missing key fails fast with no_key', error?.code === 'no_key', error?.message);
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
