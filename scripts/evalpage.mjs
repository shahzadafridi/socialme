/**
 * Evaluates an expression on a page in headless Brave/Chromium.
 * Usage: node scripts/evalpage.mjs <url> "<expression>" [timeoutMs]
 * Prints the JSON result. Useful for the preview harness checks.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const [url, expression, timeout = '20000'] = process.argv.slice(2);
if (!url || !expression) {
  console.error('usage: node scripts/evalpage.mjs <url> "<expression>" [timeoutMs]');
  process.exit(2);
}

const CHROME =
  process.env.CHROME_PATH ??
  (existsSync('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
    ? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const PORT = 9700 + Math.floor(Math.random() * 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/socialme-eval-${PORT}`,
  '--window-size=1200,900',
  'about:blank',
]);

let ws;
try {
  let version = null;
  for (let i = 0; i < 80; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(150);
    }
  }
  if (!version) throw new Error('browser did not start');

  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    ws.addEventListener('open', done, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });
  const send = (method, params = {}, sessionId) => {
    const messageId = ++id;
    const payload = { id: messageId, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((done, reject) => {
      pending.set(messageId, { resolve: done, reject });
      setTimeout(() => {
        if (pending.has(messageId)) {
          pending.delete(messageId);
          reject(new Error(`timeout ${method}`));
        }
      }, 20000);
    });
  };

  const { targetId } = await send('Target.createTarget', { url });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);

  const started = Date.now();
  let value;
  while (Date.now() - started < Number(timeout)) {
    const result = await send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'error',
      );
    }
    value = result.result?.value;
    if (value) break;
    await sleep(300);
  }

  console.log(JSON.stringify(value ?? null, null, 2));
} catch (error) {
  console.error('eval failed:', error.message);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {}
  chrome.kill('SIGKILL');
}
