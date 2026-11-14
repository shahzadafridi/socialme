/**
 * Records the inline reply flow from the preview harness into docs/demo.gif.
 *
 *   npm run preview            # in one terminal
 *   node scripts/make-demo-gif.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME_PATH ??
  (existsSync('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
    ? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const PORT = 9800 + Math.floor(Math.random() * 100);
const OUT_DIR = '/tmp/socialme-demo';
const FINAL = join(process.cwd(), 'docs', 'demo.gif');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(process.cwd(), 'docs'), { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/socialme-demo-profile-${PORT}`,
  '--window-size=920,640',
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

  const { targetId } = await send('Target.createTarget', {
    url: 'http://localhost:5180/?view=composer-demo',
  });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);

  const evaluate = async (expression) => {
    const result = await send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    return result.result?.value;
  };

  // wait for the widget
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`Boolean(document.querySelector('.socialme-quick'))`)) break;
    await sleep(150);
  }

  const frames = [];
  const capture = async (index) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const file = join(OUT_DIR, `frame-${String(index).padStart(3, '0')}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    frames.push(file);
  };

  const fps = 8;
  const interval = 1000 / fps;
  const started = Date.now();
  let frame = 0;
  const actions = [
    { at: 1000, run: () => evaluate(`document.querySelector('.socialme-quick').click(); true`) },
    {
      at: 1800,
      run: () =>
        evaluate(`(() => {
          const input = document.querySelector('.socialme-tone-input');
          if (!input) return false;
          input.value = 'mention the 2-week launch';
          return true;
        })()`),
    },
    {
      at: 2700,
      run: () =>
        evaluate(`(() => {
          const row = Array.from(document.querySelectorAll('.socialme-tone-menu button'))
            .find((b) => b.textContent.trim() === 'Friendly');
          if (!row) return false;
          row.click();
          return true;
        })()`),
    },
  ];

  while (Date.now() - started < 8200) {
    const elapsed = Date.now() - started;
    for (const action of actions) {
      if (!action.done && elapsed >= action.at) {
        action.done = true;
        await action.run();
      }
    }
    await capture(frame);
    frame += 1;
    const drift = elapsed + interval - (Date.now() - started);
    await sleep(Math.max(0, interval - (Date.now() - started - elapsed)));
  }

  console.log(`captured ${frames.length} frames`);

  await new Promise((done, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      join(OUT_DIR, 'frame-%03d.png'),
      '-vf',
      'scale=920:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer',
      '-loop',
      '0',
      FINAL,
    ]);
    ff.on('close', (code) => (code === 0 ? done() : reject(new Error(`ffmpeg ${code}`))));
    ff.on('error', reject);
  });

  console.log('wrote', FINAL);
} catch (error) {
  console.error('demo gif failed:', error.message);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {}
  chrome.kill('SIGKILL');
  rmSync(OUT_DIR, { recursive: true, force: true });
}
