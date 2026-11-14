/**
 * Live end-to-end test for the built extension.
 *
 * Loads the real extension in Brave, points it at local replicas of LinkedIn / X / Facebook
 * (served on their real hostnames via --host-resolver-rules) and at a mock model API, then
 * drives every user flow through the real content script.
 *
 *   node scripts/livetest.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DRAFT, startServers } from './livetest-server.mjs';

const CHROME =
  process.env.CHROME_PATH ??
  (existsSync('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
    ? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const EXT = resolve(process.cwd(), 'dist/chrome-mv3');
const PORT = 9500 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------- assertions ------------------------------- */

const results = [];
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log(`\n── ${name} ─────────────────────────────`);
}

function record(name, ok, detail) {
  results.push({ section: currentSection, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  · ${detail}` : ''}`);
}

async function test(name, fn) {
  try {
    const detail = await fn();
    record(name, true, typeof detail === 'string' ? detail : '');
    return true;
  } catch (error) {
    record(name, false, error.message);
    return false;
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/* --------------------------------- CDP ---------------------------------- */

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.exceptions = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params?.exceptionDetails;
        this.exceptions.push(
          details?.exception?.description ?? details?.text ?? 'unknown exception',
        );
        if (this.exceptions.length > 20) this.exceptions.shift();
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: done, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else done(msg.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((done, reject) => {
      this.pending.set(id, { resolve: done, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 30000);
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((done, reject) => {
      ws.addEventListener('open', done, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Cdp(ws);
  }
}

const PRELUDE = `
  const host = document.querySelector('#socialme-shadow-host');
  const root = host && host.shadowRoot;
  const $ = (s) => (root ? root.querySelector(s) : null);
  const $$ = (s) => (root ? Array.from(root.querySelectorAll(s)) : []);
  const byText = (s, t) => $$(s).find((el) => (el.textContent || '').trim().toLowerCase().includes(t.toLowerCase()));
`;

/* --------------------------------- main --------------------------------- */

const servers = await startServers();
const profile = mkdtempSync(join(tmpdir(), 'socialme-live-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--ignore-certificate-errors',
  '--window-size=1300,900',
  '--host-resolver-rules=MAP www.linkedin.com 127.0.0.1,MAP x.com 127.0.0.1,MAP www.facebook.com 127.0.0.1',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--disable-extensions-except=${EXT}`,
  `--load-extension=${EXT}`,
  'about:blank',
]);

let cdp;
try {
  let version = null;
  for (let i = 0; i < 120; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(150);
    }
  }
  if (!version) throw new Error('browser did not start');
  cdp = await Cdp.connect(version.webSocketDebuggerUrl);

  let extId = null;
  for (let i = 0; i < 60; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const worker = targetInfos.find(
      (t) => t.type === 'service_worker' && t.url.endsWith('/background.js'),
    );
    if (worker) {
      extId = new URL(worker.url).host;
      break;
    }
    await sleep(200);
  }
  if (!extId) throw new Error('extension did not load');

  const open = async (url) => {
    const { targetId } = await cdp.send('Target.createTarget', { url });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    return sessionId;
  };

  const evaluate = async (sessionId, expression) => {
    const result = await cdp.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          'evaluate failed',
      );
    }
    return result.result.value;
  };

  const uiEval = (sessionId, body) => evaluate(sessionId, `(() => { ${PRELUDE} ${body} })()`);

  /** Trusted click, like a user: scroll into view then dispatch real mouse events. */
  const realClick = async (sessionId, selector) => {
    const point = await uiEval(
      sessionId,
      `const el = document.querySelector(${JSON.stringify(selector)});
       if (!el) return null;
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`,
    );
    if (!point) throw new Error(`element not found: ${selector}`);
    await cdp.send(
      'Input.dispatchMouseEvent',
      { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' },
      sessionId,
    );
    await cdp.send(
      'Input.dispatchMouseEvent',
      { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 },
      sessionId,
    );
    await cdp.send(
      'Input.dispatchMouseEvent',
      { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 },
      sessionId,
    );
  };

  const waitFor = async (sessionId, expression, { timeout = 15000, label = 'condition' } = {}) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const value = await uiEval(sessionId, expression).catch(() => false);
      if (value) return value;
      await sleep(120);
    }
    throw new Error(`timed out waiting for ${label}`);
  };

  /* --------------------------- settings seeding --------------------------- */

  const settingsPage = await open(`chrome-extension://${extId}/options.html`);
  for (let i = 0; i < 50; i++) {
    const ready = await evaluate(settingsPage, `Boolean(document.querySelector('.content'))`).catch(
      () => false,
    );
    if (ready) break;
    await sleep(150);
  }

  const baseSettings = {
    version: 1,
    onboarded: true,
    activeProvider: 'custom',
    providers: [
      {
        id: 'custom',
        enabled: true,
        baseUrl: `http://127.0.0.1:${servers.apiPort}/v1`,
        model: 'mock-model',
        temperature: 0.8,
      },
    ],
    outputMode: 'review',
    autoSubmit: { enabled: true, minDelayMs: 30, maxDelayMs: 90, requireConfirm: false },
    safety: {
      humanTyping: false,
      typingSpeed: 'fast',
      minActionGapSec: 0,
      maxActionsPerHour: 50,
      maxActionsPerDay: 50,
      pauseOnWarning: true,
      warmupDays: 0,
    },
    dmContext: 'last3',
    showComposerButton: true,
    theme: 'dark',
  };

  const seed = async (patch = {}) => {
    const merged = { ...baseSettings, ...patch };
    await evaluate(
      settingsPage,
      `Promise.all([
        chrome.storage.local.set({ 'socialme.settings.v1': ${JSON.stringify(merged)} }),
        chrome.storage.local.set({ 'socialme.secrets.v1': { custom: 'test-key' } }),
        chrome.storage.local.set({ 'socialme.activity.v1': [] }),
        chrome.storage.local.set({ 'socialme.history.v1': [] })
      ]).then(() => true)`,
    );
    await sleep(250);
  };
  await seed();

  const platformUrl = (platform) =>
    `https://${
      platform.startsWith('linkedin')
        ? 'www.linkedin.com'
        : platform === 'x'
          ? 'x.com'
          : 'www.facebook.com'
    }:${servers.pagePort}/mock/${platform}`;

  const load = async (platform) => {
    const session = await open('about:blank');
    await cdp.send('Page.navigate', { url: platformUrl(platform) }, session);
    return session;
  };

  const reload = async (session, platform) => {
    await cdp.send('Page.navigate', { url: platformUrl(platform) }, session);
  };

  /** The icon opens a tone menu first; pick an option by label. */
  const chooseTone = async (session, label = 'Default', instruction = '') => {
    await waitFor(
      session,
      `return Boolean(document.querySelector('.socialme-tone-menu'));`,
      { timeout: 5000, label: 'tone menu' },
    );
    if (instruction) {
      await uiEval(
        session,
        `const input = document.querySelector('.socialme-tone-input');
         if (!input) return false;
         const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
         setter.call(input, ${JSON.stringify(instruction)});
         input.dispatchEvent(new Event('input', { bubbles: true }));
         return true;`,
      );
    }
    await uiEval(
      session,
      `const row = Array.from(document.querySelectorAll('.socialme-tone-menu button'))
         .find((b) => b.textContent.trim() === ${JSON.stringify(label)});
       if (!row) return false;
       row.click();
       return true;`,
    );
    await sleep(250);
  };

  const posted = async (session) =>
    uiEval(session, `return window.__posted || [];`).catch(() => []);

  /* ------------------------------ per platform ---------------------------- */

  const INLINE_LABEL = { linkedin: 'SocialMe', x: '✦', facebook: 'SocialMe' };
  const AUTHOR = 'Maya Chen';
  const POST_SNIPPET = 'quarterly roadmaps';

  for (const platform of ['linkedin', 'x', 'facebook']) {
    const session = await load(platform);

    section(`${platform}: mount`);
    await test('content script mounts and injects the launcher', async () => {
      await waitFor(session, `return Boolean($('.ap-launcher'));`, { label: 'launcher' });
      const label = await uiEval(session, `return $('.ap-launcher').textContent.trim();`);
      expect(label.includes('SocialMe'), `launcher label was "${label}"`);
      return label;
    });

    section(`${platform}: in-composer button`);
    await reload(session, platform);
    await waitFor(session, `return Boolean($('.ap-launcher'));`, { label: 'reload' });

    await test('✦ appears inside the opened comment box and fills it', async () => {
      await uiEval(
        session,
        `const target =
           document.querySelector('.comment-button') ||
           document.querySelector('button[aria-label="Comment"]') ||
           document.querySelector('[data-testid="reply"]') ||
           Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => /comment/i.test(b.getAttribute('aria-label') || ''));
         if (!target) return false;
         target.click();
         return true;`,
      );
      await waitFor(session, `return Boolean(document.querySelector('.socialme-quick'));`, {
        timeout: 10000,
        label: 'quick button',
      });
      const anchored = await uiEval(
        session,
        `const b = document.querySelector('.socialme-quick');
         return {
           text: b.textContent,
           label: b.getAttribute('aria-label') || '',
           display: getComputedStyle(b).display,
           inToolbar: Boolean(b.closest('[role="listitem"], form, .actions, .row, body')),
         };`,
      );
      expect(
        /write this comment/i.test(anchored.label ?? ''),
        `button label "${anchored.label}"`,
      );
      expect(anchored.display !== 'none', 'button hidden');

      await evaluate(
        session,
        `document.querySelector('.socialme-quick').click(); true`,
      );
      await chooseTone(session, 'Friendly', 'mention the 3-week launch');

      const text = await waitFor(
        session,
        `const ed = document.querySelector('.ql-editor, [data-testid^="tweetTextarea"], [contenteditable="true"][role="textbox"]');
         return ed && (ed.innerText || '').trim().length > 40 ? ed.innerText.trim() : '';`,
        { timeout: 20000, label: 'typed draft' },
      );
      expect(text.includes('The part nobody mentions'), `editor had "${text.slice(0, 50)}"`);
      expect(
        (servers.stats.lastPrompt ?? '').toLowerCase().includes('friendly'),
        'the chosen tone did not reach the prompt',
      );
      expect(
        (servers.stats.lastPrompt ?? '').includes('mention the 3-week launch'),
        'the custom instruction did not reach the prompt',
      );
      const state = await waitFor(
        session,
        `const b = document.querySelector('.socialme-quick');
         return b && b.textContent === '✓' ? '✓' : '';`,
        { timeout: 15000, label: 'quick button done state' },
      );
      expect(state === '✓', `button state "${state}"`);
      return 'streamed straight into the comment field';
    });

    section(`${platform}: new post`);
    await reload(session, platform);
    await waitFor(session, `return Boolean($('.ap-launcher'));`, { label: 'reload' });

    await test('compose a post into the platform composer', async () => {
      await uiEval(session, `$('.ap-launcher').click(); return true;`);
      await waitFor(session, `return Boolean($('.ap-panel'));`, { label: 'panel' });

      await uiEval(
        session,
        `const tab = $$('.ap-tab').find((t) => t.textContent.trim() === 'New post');
         tab.click(); return true;`,
      );
      await sleep(200);
      await uiEval(
        session,
        `const input = $$('.ap-input').find((i) => i.placeholder && /what I learned|mention|topic/i.test(i.placeholder)) || $('.ap-input');
         const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
         setter.call(input, 'What I learned shipping v1 in six weeks');
         input.dispatchEvent(new Event('input', { bubbles: true }));
         return true;`,
      );
      await uiEval(
        session,
        `const b = $$('.ap-foot .ap-btn').find((x) => /Generate/.test(x.textContent));
         b.click(); return true;`,
      );
      await waitFor(
        session,
        `const t = $('.ap-draft'); return Boolean(t && !t.readOnly && t.value.trim().length > 40);`,
        { timeout: 20000, label: 'post draft' },
      );
      await uiEval(
        session,
        `const b = $$('.ap-foot .ap-btn').find((x) => x.textContent.trim() === 'Insert');
         b.click(); return true;`,
      );
      let text = '';
      try {
        text = await waitFor(
          session,
          `const ed = document.querySelector('.share-creation-state .ql-editor, [role="dialog"] [data-testid^="tweetTextarea"], [role="dialog"] [contenteditable="true"][role="textbox"]');
           return ed && (ed.innerText || '').trim().length > 40 ? ed.innerText.trim() : '';`,
          { timeout: 20000, label: 'composer text' },
        );
      } catch (err) {
        const debug = await uiEval(
          session,
          `return {
             status: $('.ap-status')?.textContent?.trim() || '',
             error: $('.ap-error')?.textContent?.trim() || '',
             draft: ($('.ap-draft')?.value || '').slice(0, 40),
             dialogs: document.querySelectorAll('[role="dialog"]').length,
             editors: document.querySelectorAll('.ql-editor, [contenteditable="true"]').length
           };`,
        );
        throw new Error(`composer not filled — ${JSON.stringify(debug)}`);
      }
      expect(text.includes('The part nobody mentions'), `composer had "${text.slice(0, 50)}"`);
      return 'post composed';
    });
  }

  section('linkedin: inbox reply');
  await seed({ dmContext: 'last' });
  const dmSession = await load('linkedin-dm');

  await test('inbox icon reads the last message and answers it', async () => {
    await waitFor(dmSession, `return Boolean(document.querySelector('.socialme-quick'));`, {
      timeout: 12000,
      label: 'inbox icon',
    });
    await realClick(dmSession, '.socialme-quick');
    await chooseTone(dmSession, 'Default');

    const text = await waitFor(
      dmSession,
      `const ed = document.querySelector('[aria-label="Write a message…"]');
       return ed && (ed.innerText || '').trim().length > 20 ? ed.innerText.trim() : '';`,
      { timeout: 20000, label: 'message draft' },
    );

    const prompt = servers.stats.lastPrompt ?? '';
    expect(prompt.includes('fintech payments'), 'conversation was not included in the prompt');
    expect(
      !prompt.includes('thanks for connecting'),
      'last-message mode sent more than the final message',
    );
    expect(prompt.includes('them:'), 'sender sides were not labelled');
    expect(!/Open Emoji Keyboard|Attach an image|Write a message/.test(prompt), 'composer UI leaked into the transcript');
    expect(/last line/i.test(prompt), 'prompt does not force an answer to the last message');
    expect(text.length > 20, 'no draft written into the composer');
    return text.slice(0, 60);
  });

  /* -------------------------------- safety -------------------------------- */

  section('safety: limits and warnings');
  const safetySession = await load('linkedin');
  await waitFor(safetySession, `return Boolean($('.ap-launcher'));`, { label: 'linkedin' });

  await test('daily cap blocks further posts', async () => {
    await seed({
      safety: { ...baseSettings.safety, maxActionsPerDay: 1 },
    });
    await evaluate(
      settingsPage,
      `chrome.storage.local.set({ 'socialme.activity.v1': [
         { ts: Date.now() - 1000, platform: 'linkedin', kind: 'submit' }
       ] }).then(() => true)`,
    );
    await reload(safetySession, 'linkedin');
    await waitFor(safetySession, `return Boolean($('.ap-launcher'));`, {
      label: 'reload',
    });
    await uiEval(safetySession, `$('.ap-launcher').click(); return true;`);
    await waitFor(safetySession, `return Boolean($('.ap-panel'));`, { label: 'panel' });
    await uiEval(
      safetySession,
      `const input = $$('.ap-input')[0];
       if (input) {
         const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
         setter.call(input, 'shipping fast without a big team');
         input.dispatchEvent(new Event('input', { bubbles: true }));
       }
       const b = $$('.ap-foot .ap-btn').find((x) => /Generate|Regenerate/.test(x.textContent));
       b.click(); return true;`,
    );
    await waitFor(
      safetySession,
      `const t = $('.ap-draft'); return Boolean(t && !t.readOnly && t.value.trim().length > 40);`,
      { timeout: 20000, label: 'draft' },
    );
    await uiEval(
      safetySession,
      `const b = $$('.ap-foot .ap-btn').find((x) => x.textContent.includes('Insert & post'));
       b.click(); return true;`,
    );
    const status = await waitFor(
      safetySession,
      `const s = $('.ap-status')?.textContent || ''; return /limit/i.test(s) ? s.trim() : '';`,
      { timeout: 8000, label: 'limit message' },
    );
    expect(/Daily limit|limit/i.test(status), status);
    return status.slice(0, 60);
  });

  await test('restriction banner blocks auto-posting', async () => {
    await seed({ safety: { ...baseSettings.safety, maxActionsPerDay: 50 } });
    await reload(safetySession, 'linkedin');
    await waitFor(safetySession, `return Boolean($('.ap-launcher'));`, {
      label: 'reload',
    });
    await evaluate(
      safetySession,
      `(() => {
         const banner = document.createElement('div');
         banner.setAttribute('role', 'alert');
         banner.textContent = "You're temporarily restricted from commenting.";
         document.body.prepend(banner);
         return true;
       })()`,
    );
    await sleep(2200);
    await uiEval(safetySession, `$('.ap-launcher').click(); return true;`);
    await waitFor(safetySession, `return Boolean($('.ap-panel'));`, { label: 'panel' });
    await uiEval(
      safetySession,
      `const input = $$('.ap-input')[0];
       if (input) {
         const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
         setter.call(input, 'shipping fast without a big team');
         input.dispatchEvent(new Event('input', { bubbles: true }));
       }
       const b = $$('.ap-foot .ap-btn').find((x) => /Generate|Regenerate/.test(x.textContent));
       b.click(); return true;`,
    );
    await waitFor(
      safetySession,
      `const t = $('.ap-draft'); return Boolean(t && !t.readOnly && t.value.trim().length > 40);`,
      { timeout: 20000, label: 'draft before warning check' },
    );
    const info = await uiEval(
      safetySession,
      `const warn = $('.ap-warnbox');
       const btn = $$('.ap-foot .ap-btn').find((x) => x.textContent.includes('Insert & post'));
       return { warn: warn ? warn.textContent.trim().slice(0, 60) : '', disabled: btn ? btn.disabled : null, draft: ($('.ap-draft')?.value || '').length };`,
    );
    expect(info.warn.length > 0, 'no warning banner in the panel');
    expect(info.draft > 40, 'draft did not generate, cannot prove the block');
    expect(info.disabled === true, 'posting was not disabled despite the warning');
    return info.warn;
  });

  await test('API errors surface with a settings link', async () => {
    const failSettings = {
      ...baseSettings,
      providers: [
        {
          id: 'custom',
          enabled: true,
          baseUrl: `http://127.0.0.1:${servers.apiPort}/fail`,
          model: 'mock-model',
          temperature: 0.8,
        },
      ],
    };
    await evaluate(
      settingsPage,
      `chrome.storage.local.set({ 'socialme.settings.v1': ${JSON.stringify(failSettings)} }).then(() => true)`,
    );
    await sleep(250);
    await reload(safetySession, 'linkedin');
    await waitFor(safetySession, `return Boolean($('.ap-launcher'));`, {
      label: 'reload',
    });
    await uiEval(safetySession, `$('.ap-launcher').click(); return true;`);
    await waitFor(safetySession, `return Boolean($('.ap-panel'));`, { label: 'panel' });
    await uiEval(
      safetySession,
      `const input = $$('.ap-input')[0];
       if (input) {
         const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
         setter.call(input, 'shipping fast without a big team');
         input.dispatchEvent(new Event('input', { bubbles: true }));
       }
       const b = $$('.ap-foot .ap-btn').find((x) => /Generate|Regenerate/.test(x.textContent));
       b.click(); return true;`,
    );
    const error = await waitFor(
      safetySession,
      `const e = $('.ap-error'); return e ? e.textContent.trim() : '';`,
      { timeout: 15000, label: 'error box' },
    );
    expect(/rejected|Invalid API key/i.test(error), error);
    const hasLink = await uiEval(
      safetySession,
      `return Boolean($('.ap-error a'));`,
    );
    expect(hasLink, 'missing "Open settings" link');
    return error.slice(0, 60);
  });

  /* -------------------------------- summary ------------------------------- */

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  ${f.section} → ${f.name}: ${f.detail}`);
  }
  console.log(`model calls: ${servers.stats.completions}`);
  process.exitCode = failed.length ? 1 : 0;
} catch (error) {
  console.error('live test crashed:', error);
  process.exitCode = 1;
} finally {
  try {
    chrome.kill('SIGKILL');
  } catch {}
  await sleep(500);
  await servers.close().catch(() => undefined);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 });
  } catch {}
}
