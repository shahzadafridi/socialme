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
