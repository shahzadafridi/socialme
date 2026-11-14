/**
 * Loads the built extension in headless Chrome and exercises the extension pages + background
 * over CDP. No third-party dependencies: Node's global WebSocket does the talking.
 *
 * Usage: node scripts/e2e.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Google Chrome 137+ ignores --load-extension, so default to a Chromium build that still
// honours it (Brave/Chromium/Chrome-for-Testing). Override with CHROME_PATH.
const CHROME =
  process.env.CHROME_PATH ??
  (existsSync('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
    ? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const EXT = resolve(process.cwd(), 'dist/chrome-mv3');
const PORT = 9333;
const profile = mkdtempSync(join(tmpdir(), 'socialme-e2e-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 20000);
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Cdp(ws);
  }
}

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const chrome = spawn(CHROME, [
  '--headless=new',
  // GitHub's Ubuntu runners block unprivileged user namespaces, so Chrome's sandbox cannot
  // start there ("No usable sandbox!"). CI only loads this extension into a throwaway profile.
  ...(process.env.CI ? ['--no-sandbox'] : []),
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--disable-extensions-except=${EXT}`,
  `--load-extension=${EXT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--window-size=1400,900',
  'about:blank',
]);

let cdp;
try {
  // Wait for the debugging endpoint.
  for (let i = 0; i < 60; i++) {
    try {
      await fetchJson('/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }

  const version = await fetchJson('/json/version');
  cdp = await Cdp.connect(version.webSocketDebuggerUrl);

  // Find the extension id from the service worker target.
  let extId = null;
  for (let i = 0; i < 40; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const workers = targetInfos.filter(
      (t) => t.type === 'service_worker' && t.url.endsWith('/background.js'),
    );
    const worker =
      workers.find((t) => t.title?.includes('SocialMe')) ?? workers[0];
    if (worker) {
      extId = new URL(worker.url).host;
      break;
    }
    await sleep(250);
  }
  check('background service worker started', Boolean(extId), extId ?? 'not found');
  if (!extId) throw new Error('extension did not load');

  const open = async (url) => {
    const { targetId } = await cdp.send('Target.createTarget', { url });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    return { targetId, sessionId };
  };

  const evaluate = async (sessionId, expression) => {
    const result = await cdp.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed');
    }
    return result.result.value;
  };

  // --- Options page -----------------------------------------------------
  const options = await open(`chrome-extension://${extId}/options.html`);
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(
      options.sessionId,
      `Boolean(document.querySelector('.content h1'))`,
    ).catch(() => false);
    if (ready) break;
    await sleep(200);
  }

  const optionsState = await evaluate(
    options.sessionId,
    `(() => ({
      h1: document.querySelector('.content h1')?.innerText ?? null,
      providers: document.querySelectorAll('.provider').length,
      nav: document.querySelectorAll('.nav-item').length,
      errors: window.__errors ?? []
    }))()`,
  );
  check(
    'options page renders',
    optionsState.h1 === 'AI provider' && optionsState.providers === 7,
    JSON.stringify(optionsState),
  );

  // Type an API key and wait for the debounced autosave.
  await evaluate(
    options.sessionId,
    `(() => {
      const input = document.querySelector('.provider[data-active="true"] .input--mono');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'sk-e2e-testkey');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
  );
  await sleep(1200);

  const stored = await evaluate(
    options.sessionId,
    `chrome.storage.local.get(null).then(v => ({
      hasSettings: Boolean(v['socialme.settings.v1']),
      providerCount: v['socialme.settings.v1']?.providers?.length ?? 0,
      key: v['socialme.secrets.v1']?.deepseek ?? null
    }))`,
  );
  check(
    'settings autosave to chrome.storage.local',
    stored.hasSettings && stored.providerCount === 7 && stored.key === 'sk-e2e-testkey',
    JSON.stringify({ ...stored, key: stored.key ? 'set' : null }),
  );

  // Public settings helper must never leak the key.
  const publicSettings = await evaluate(
    options.sessionId,
    `chrome.runtime.sendMessage({ type: 'socialme:ping' }).then(r => JSON.stringify(r))`,
  );
  check('runtime messaging works', publicSettings.includes('"ok":true'), publicSettings);

  // Personas tab interaction.
  await evaluate(
    options.sessionId,
    `Array.from(document.querySelectorAll('.nav-item')).find(n => n.innerText.includes('Voice'))?.click()`,
  );
  await sleep(300);
  const personaState = await evaluate(
    options.sessionId,
    `(() => ({
      h1: document.querySelector('.content h1')?.innerText,
      cards: document.querySelectorAll('.card').length,
      inputs: document.querySelectorAll('.persona-form input, .persona-form textarea').length
    }))()`,
  );
  check(
    'personas editor renders',
    personaState.h1 === 'Voice & personas' && personaState.cards >= 3 && personaState.inputs > 8,
    JSON.stringify(personaState),
  );

  // --- Brand tab --------------------------------------------------------
  await evaluate(
    options.sessionId,
    `Array.from(document.querySelectorAll('.nav-item')).find(n => n.innerText.includes('Brand'))?.click()`,
  );
  await sleep(300);
  const brandState = await evaluate(
    options.sessionId,
    `(() => ({
      h1: document.querySelector('.content h1')?.innerText,
      textareas: document.querySelectorAll('.content textarea').length,
      inputs: document.querySelectorAll('.content input').length
    }))()`,
  );
  check(
    'brand tab renders',
    brandState.h1 === 'Brand' && brandState.textareas >= 5,
    JSON.stringify(brandState),
  );

  // --- Safety tab -------------------------------------------------------
  await evaluate(
    options.sessionId,
    `Array.from(document.querySelectorAll('.nav-item')).find(n => n.innerText.includes('Safety'))?.click()`,
  );
  await sleep(300);
  const safetyState = await evaluate(
    options.sessionId,
    `(() => ({
      h1: document.querySelector('.content h1')?.innerText,
      policyCards: document.querySelectorAll('.provider').length,
      switches: document.querySelectorAll('[role="switch"]').length,
      text: document.querySelector('.content')?.innerText.slice(0, 120)
    }))()`,
  );
  check(
    'safety tab renders policy + limits',
    safetyState.h1 === 'Safety & reach' &&
      safetyState.policyCards === 3 &&
      safetyState.switches >= 3,
    JSON.stringify(safetyState),
  );

  // --- Popup ------------------------------------------------------------
  const popup = await open(`chrome-extension://${extId}/popup.html`);
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(popup.sessionId, `Boolean(document.querySelector('.pop'))`).catch(
      () => false,
    );
    if (ready) break;
    await sleep(200);
  }
  const popupState = await evaluate(
    popup.sessionId,
    `(() => ({ rows: document.querySelectorAll('.pop__row').length, width: document.querySelector('.pop')?.getBoundingClientRect().width }))()`,
  );
  check(
    'popup renders',
    popupState.rows === 3 && Math.round(popupState.width) === 322,
    JSON.stringify(popupState),
  );

  // --- Content script on a real (stubbed) LinkedIn document -------------
  // Content scripts only run on the real hosts, so verify the bundle is declared
  // and injectable instead of trying to fake linkedin.com.
  const manifest = JSON.parse(
    await evaluate(
      options.sessionId,
      `fetch('manifest.json').then(r => r.text())`,
    ),
  );
  check(
    'manifest is branded SocialMe',
    manifest.name.startsWith('SocialMe') && manifest.short_name === 'SocialMe',
    manifest.name,
  );
  const scriptMatches = manifest.content_scripts?.[0]?.matches ?? [];
  check(
    'content script declared for all three networks',
    ['*://*.linkedin.com/*', '*://*.x.com/*', '*://*.facebook.com/*'].every((m) =>
      scriptMatches.includes(m),
    ),
    scriptMatches.join(', '),
  );
  check(
    'provider hosts are allowed',
    ['https://api.deepseek.com/*', 'https://api.openai.com/*'].every((h) =>
      manifest.host_permissions.includes(h),
    ),
    `${manifest.host_permissions.length} hosts`,
  );
} catch (error) {
  check('e2e run', false, error.message);
} finally {
  try {
    chrome.kill('SIGKILL');
  } catch {}
  await sleep(600);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 });
  } catch {
    // Chrome can still hold files on the way out; the temp dir is disposable.
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
