/**
 * Headless screenshot helper (Brave/Chromium via CDP).
 * Usage: node scripts/shoot.mjs <url> <out.png> [selector] [width] [height]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [url, out, selector = 'body', width = '1200', height = '860'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/shoot.mjs <url> <out.png> [selector] [w] [h]');
  process.exit(1);
}

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const PORT = 9400 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/socialme-shot-${PORT}`,
  `--window-size=${width},${height}`,
  'about:blank',
]);

let ws;
try {
  let version = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      version = await res.json();
      break;
    } catch {
      await sleep(150);
    }
  }
  if (!version) throw new Error('browser did not start');

  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((ok, err) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', err, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: done, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else done(message.result);
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
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false },
    sessionId,
  );

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise },
      sessionId,
    );
    return result.result?.value;
  };

  for (let i = 0; i < 60; i++) {
    const found = await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (found) break;
    await sleep(150);
  }

  await evaluate('document.fonts.ready.then(() => true)', true).catch(() => undefined);
  await sleep(500); // let entry animations settle

  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const file = resolve(out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('wrote', file);
} catch (error) {
  console.error('screenshot failed:', error.message);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {}
  chrome.kill('SIGKILL');
}
