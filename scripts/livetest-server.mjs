/**
 * Live-test server.
 *
 *   HTTPS (platform replicas)  -> served on www.linkedin.com / x.com / www.facebook.com
 *                                 via --host-resolver-rules, so the real content script attaches.
 *   HTTP  (mock model API)     -> OpenAI-compatible streaming endpoint on 127.0.0.1
 *
 * Everything the extension can do is exercised against these pages:
 * inline button, panel, generation, insert, submit, composer button, limits, warnings.
 */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DRAFT =
  'The part nobody mentions: approvals cost more than code. We cut ours from five to one and shipping stopped feeling like a project.';

const now = () => Date.now();

/* ------------------------------------------------------------------ */
/* Shared page behaviour                                              */
/* ------------------------------------------------------------------ */

const HELPERS = `
  window.__posted = [];
  window.__log = [];
  function submitText(editor, platform) {
    const text = (editor.innerText || '').trim();
    window.__posted.push({ platform, text });
    window.__log.push('submit ' + platform + ': ' + text.slice(0, 40));
    editor.innerHTML = '';
  }
`;

/* ------------------------------- LinkedIn ------------------------------- */

const LINKEDIN = `<!doctype html><html><head><meta charset="utf-8"><title>Feed | LinkedIn</title>
<style>
 body{font-family:-apple-system,Helvetica,sans-serif;background:#f4f2ee;margin:0;padding:24px}
 .feed{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
 [role=listitem]{background:#fff;border:1px solid #e0dfdc;border-radius:8px;padding:14px}
 .actor a{font-weight:600;text-decoration:none;color:#111}
 .headline{color:#666;font-size:12px}
 .body{margin:10px 0;line-height:1.5}
 .row{display:flex;align-items:center;gap:10px;border-top:1px solid #eee;padding-top:8px}
 .row button{border:0;background:transparent;font:inherit;color:#555;cursor:pointer;padding:4px 8px}
 .counts{color:#666;font-size:12px}
 .comment-box{display:flex;gap:8px;margin-top:10px;align-items:flex-start;flex-wrap:wrap}
 .comment-toolbar{display:flex;gap:6px;margin-left:auto;align-items:center}
 .comment-toolbar button{border:0;background:transparent;width:24px;height:24px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer}
 .editor{flex:1;min-height:38px;border:1px solid #ccc;border-radius:18px;padding:8px 12px;outline:none}
 .send{border:0;background:#0a66c2;color:#fff;border-radius:16px;padding:8px 14px;cursor:pointer}
 .comment{padding:10px 0 0;border-top:1px solid #eee;margin-top:10px}
 .comment .body{margin:4px 0}
 .invite{background:#fff;border:1px solid #e0dfdc;border-radius:8px;padding:14px;display:flex;align-items:center;gap:12px}
 .invite button{margin-left:auto;border:1px solid #0a66c2;background:#fff;color:#0a66c2;border-radius:16px;padding:6px 14px;cursor:pointer}
 #connect-dialog{position:fixed;inset:0;margin:auto;width:360px;height:max-content;background:#fff;border:1px solid #ccc;border-radius:8px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
 #connect-dialog textarea{width:100%;height:90px;box-sizing:border-box;margin-top:8px}
</style></head><body>
<div class="feed" role="list">
  <div role="listitem">
    <div class="actor">
      <a href="https://www.linkedin.com/in/maya-chen/"><span>Maya Chen</span></a>
      <div class="headline"><span>VP Product at Northwind</span></div>
    </div>
    <div class="body"><p><span>We stopped doing quarterly roadmaps last year. Cycle time dropped 34%, and nobody asks "when is it done" in week one anymore.</span></p></div>
    <div class="row">
      <button aria-label="Like">Like</button>
      <span class="counts">1,284 reactions</span>
      <button aria-label="Comment" onclick="openComment(this)">Comment</button>
      <button aria-label="Repost">Repost</button>
      <a href="#" aria-label="Send">Send</a>
    </div>
    <div class="comments">
      <div class="comment" id="comment-sam">
        <div class="actor">
          <a href="https://www.linkedin.com/in/sam-okafor/"><span>Sam Okafor</span></a>
          <div class="headline"><span>Engineering lead at Helio</span></div>
        </div>
        <div class="body"><p><span>The 34% is doing a lot of work there — was that cycle time or review time?</span></p></div>
        <div class="row">
          <button aria-label="Like">Like</button>
          <button aria-label="Reply" onclick="openReply(this)">Reply</button>
        </div>
      </div>
    </div>
  </div>
  <div class="invite">
    <div>
      <div class="actor"><a href="https://www.linkedin.com/in/maya-chen/"><span>Maya Chen</span></a></div>
      <div class="headline">VP Product at Northwind</div>
    </div>
    <button aria-label="Invite Maya Chen to connect" onclick="openConnect(this)">Connect</button>
  </div>
  <div class="share-box"><button class="share-box-feed-entry__trigger" onclick="openComposer()">Start a post</button></div>
</div>
<script>
${HELPERS}
function openComposer() {
  if (document.querySelector('.share-creation-state')) return;
  const dialog = document.createElement('div');
  dialog.className = 'share-creation-state';
  dialog.setAttribute('role', 'dialog');
  const ed = document.createElement('div');
  ed.className = 'editor';
  ed.setAttribute('contenteditable', 'true');
  ed.setAttribute('role', 'textbox');
  const send = document.createElement('button');
  send.textContent = 'Post';
  send.setAttribute('aria-label', 'Post');
  send.onclick = () => { submitText(ed, 'linkedin-post'); dialog.remove(); };
  dialog.append(ed, send);
  document.body.appendChild(dialog);
  ed.focus();
}
function openReply(btn) {
  const comment = btn.closest('.comment');
  if (comment.querySelector('.reply-box')) return;
  const box = document.createElement('div');
  box.className = 'comment-box reply-box';
  const ed = document.createElement('div');
  ed.className = 'editor';
  ed.setAttribute('contenteditable', 'true');
  ed.setAttribute('role', 'textbox');
  ed.setAttribute('aria-label', "Reply to Sam Okafor's comment");
  const send = document.createElement('button');
  send.className = 'send';
  send.setAttribute('aria-label', 'Reply');
  send.textContent = 'Reply';
  send.onclick = () => { submitText(ed, 'linkedin-reply'); box.remove(); };
  box.append(ed, send);
  comment.appendChild(box);
  ed.focus();
}
function openConnect(btn) {
  if (document.querySelector('#connect-dialog')) return;
  const dialog = document.createElement('div');
  dialog.id = 'connect-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Invite Maya Chen to connect');
  dialog.innerHTML =
    '<div class="actor"><a href="https://www.linkedin.com/in/maya-chen/"><span>Maya Chen</span></a></div>' +
    '<div class="headline">VP Product at Northwind</div>' +
    '<label for="invite-note">Add a note to your invitation</label>' +
    '<textarea id="invite-note" aria-label="Add a note" maxlength="300"></textarea>' +
    '<button aria-label="Send invitation">Send</button>';
  const note = dialog.querySelector('textarea');
  dialog.querySelector('button').onclick = () => {
    window.__posted.push({ platform: 'linkedin-note', text: note.value });
    dialog.remove();
  };
  document.body.appendChild(dialog);
  note.focus();
}
function openComment(btn) {
  const post = btn.closest('[role=listitem]');
  if (post.querySelector('.comment-box')) return;
  const box = document.createElement('div');
  box.className = 'comment-box';
  const ed = document.createElement('div');
  ed.className = 'editor';
  ed.setAttribute('contenteditable', 'true');
  ed.setAttribute('role', 'textbox');
  ed.setAttribute('aria-label', 'Text editor for creating comment');
  const send = document.createElement('button');
  send.className = 'send';
  send.setAttribute('aria-label', 'Comment');
  send.textContent = 'Comment';
  send.onclick = () => { submitText(ed, 'linkedin'); box.remove(); };
  const toolbar = document.createElement('div');
  toolbar.className = 'comment-toolbar';
  for (const [label, glyph] of [
    ['Open emoji keyboard', '😊'],
    ['Add a GIF', 'GIF'],
    ['Add an image', '🖼'],
  ]) {
    const button = document.createElement('button');
    button.setAttribute('aria-label', label);
    button.textContent = glyph;
    toolbar.appendChild(button);
  }
  box.append(ed, toolbar, send);
  post.querySelector('.comments').appendChild(box);
  ed.focus();
}
</script></body></html>`;

/* ---------------------------------- X ---------------------------------- */

const X = `<!doctype html><html><head><meta charset="utf-8"><title>Home / X</title>
<style>
 body{font-family:-apple-system,Helvetica,sans-serif;margin:0;padding:24px;background:#fff}
 .feed{max-width:560px;margin:0 auto}
 article[data-testid=tweet]{border:1px solid #e1e8ed;border-radius:12px;padding:14px;margin-bottom:14px}
 [data-testid=User-Name]{font-weight:600;font-size:14px}
 [data-testid=tweetText]{margin:8px 0;line-height:1.45}
 [role=group]{display:flex;gap:18px;color:#536471;font-size:13px}
 [role=group] button{border:0;background:none;font:inherit;color:inherit;cursor:pointer}
 [role=dialog]{position:fixed;inset:10% 20%;background:#fff;border:1px solid #ccc;border-radius:14px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.2)}
 [data-testid=tweetTextarea_0]{min-height:70px;border-bottom:1px solid #eee;padding:8px;outline:none}
 [data-testid=tweetButtonInline]{float:right;margin-top:8px;background:#1d9bf0;color:#fff;border:0;border-radius:20px;padding:8px 16px;cursor:pointer}
</style></head><body>
<div class="feed">
  <article data-testid="tweet">
    <div data-testid="User-Name"><span>Maya Chen</span><span>@mayachen</span></div>
    <div data-testid="tweetText">Shipping weekly beats shipping big. Our cycle time dropped 34%.</div>
    <a href="/mayachen/status/1700000000000000001">2h</a>
    <div role="group">
      <button data-testid="reply" aria-label="12 replies. Reply" onclick="openReply()">12</button>
      <button data-testid="like" aria-label="248 likes. Like">248</button>
      <button data-testid="retweet" aria-label="31 reposts. Repost">31</button>
    </div>
  </article>
  <a href="#" data-testid="SideNav_NewTweet_Button" onclick="event.preventDefault(); openComposer()">Post</a>
</div>
<script>
${HELPERS}
function openComposer() {
  if (document.querySelector('[data-testid=composerDialog]')) return;
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('data-testid', 'composerDialog');
  const ed = document.createElement('div');
  ed.setAttribute('data-testid', 'tweetTextarea_0');
  ed.setAttribute('contenteditable', 'true');
  const send = document.createElement('button');
  send.setAttribute('data-testid', 'tweetButton');
  send.textContent = 'Post';
  send.onclick = () => { submitText(ed, 'x-post'); dialog.remove(); };
  dialog.append(ed, send);
  document.body.appendChild(dialog);
  ed.focus();
}
function openReply() {
  if (document.querySelector('[role=dialog]')) return;
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.innerHTML = '<article data-testid="tweet"><div data-testid="User-Name"><span>Maya Chen</span><span>@mayachen</span></div><div data-testid="tweetText">Shipping weekly beats shipping big.</div></article>';
  const ed = document.createElement('div');
  ed.setAttribute('data-testid', 'tweetTextarea_0');
  ed.setAttribute('contenteditable', 'true');
  ed.setAttribute('role', 'textbox');
  const send = document.createElement('button');
  send.setAttribute('data-testid', 'tweetButtonInline');
  send.textContent = 'Reply';
  send.onclick = () => { submitText(ed, 'x'); dialog.remove(); };
  dialog.append(ed, send);
  document.body.appendChild(dialog);
  ed.focus();
}
</script></body></html>`;

/* ------------------------------- Facebook ------------------------------- */

const FACEBOOK = `<!doctype html><html><head><meta charset="utf-8"><title>Facebook</title>
<style>
 body{font-family:-apple-system,Helvetica,sans-serif;margin:0;padding:24px;background:#f0f2f5}
 .feed{max-width:560px;margin:0 auto}
 div[role=article]{background:#fff;border-radius:8px;padding:14px;margin-bottom:16px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
 h2{font-size:14px;margin:0 0 2px}
 .sub{color:#65676b;font-size:12px;margin-bottom:8px}
 [data-ad-preview=message]{line-height:1.5;margin-bottom:10px}
 .actions{display:flex;gap:8px;border-top:1px solid #e4e6eb;padding-top:6px}
 .actions [role=button]{padding:6px 10px;color:#65676b;cursor:pointer;border-radius:6px}
 .actions [role=button]:hover{background:#f0f2f5}
 form{display:flex;gap:8px;margin-top:10px;align-items:flex-start;flex-wrap:wrap}
 form [role=textbox]{flex:1;min-height:34px;border:1px solid #ccd0d5;border-radius:18px;padding:8px 12px;outline:none}
 .comment-toolbar{display:flex;gap:6px;align-items:center;margin-left:auto}
 .comment-toolbar [role=button]{width:24px;height:24px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:transparent;color:#65676b}
 form [role=button].send{background:#1877f2;color:#fff;border-radius:16px;padding:8px 14px;cursor:pointer}
</style></head><body>
<div class="feed">
  <div role="article">
    <h2><a href="/maya"><span dir="auto">Maya Chen</span></a></h2>
    <div class="sub">VP Product at Northwind</div>
    <div data-ad-preview="message">We stopped doing quarterly roadmaps last year. Cycle time dropped 34%, and nobody asks "when is it done" anymore.</div>
    <div aria-label="1.2K reactions">1.2K</div>
    <div role="button" tabindex="0" onclick="openComposer()">What's on your mind, Maya?</div>
    <div class="actions">
      <div role="button" aria-label="Like" tabindex="0">Like</div>
      <div role="button" aria-label="Comment" tabindex="0" onclick="openComment(this)">Comment</div>
      <div role="button" aria-label="Share" tabindex="0">Share</div>
    </div>
    <div class="comments"></div>
  </div>
</div>
<script>
${HELPERS}
function openComposer() {
  if (document.querySelector('[data-testid=fbComposer]')) return;
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('data-testid', 'fbComposer');
  const ed = document.createElement('div');
  ed.setAttribute('role', 'textbox');
  ed.setAttribute('contenteditable', 'true');
  ed.setAttribute('aria-label', 'Write something...');
  const send = document.createElement('div');
  send.setAttribute('role', 'button');
  send.setAttribute('aria-label', 'Post');
  send.setAttribute('tabindex', '0');
  send.textContent = 'Post';
  send.onclick = () => { submitText(ed, 'facebook-post'); dialog.remove(); };
  dialog.append(ed, send);
  document.body.appendChild(dialog);
  ed.focus();
}
function openComment(btn) {
  const post = btn.closest('[role=article]');
  if (post.querySelector('form')) return;
  const form = document.createElement('form');
  form.onsubmit = (e) => e.preventDefault();
  const ed = document.createElement('div');
  ed.setAttribute('role', 'textbox');
  ed.setAttribute('contenteditable', 'true');
  ed.setAttribute('aria-label', 'Write a comment…');
  const send = document.createElement('div');
  send.setAttribute('role', 'button');
  send.setAttribute('aria-label', 'Comment');
  send.setAttribute('tabindex', '0');
  send.className = 'send';
  send.textContent = 'Comment';
  send.onclick = () => { submitText(ed, 'facebook'); form.remove(); };
  const toolbar = document.createElement('div');
  toolbar.className = 'comment-toolbar';
  for (const [label, glyph] of [
    ['Choose an emoji', '😊'],
    ['Attach a photo', '📷'],
    ['Add a GIF', 'GIF'],
    ['Choose a sticker', '🩹'],
  ]) {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', label);
    button.textContent = glyph;
    toolbar.appendChild(button);
  }
  form.append(ed, toolbar, send);
  post.querySelector('.comments').appendChild(form);
  ed.focus();
}
</script></body></html>`;

const LINKEDIN_DM = `<!doctype html><html><head><meta charset="utf-8"><title>Messaging | LinkedIn</title>
<style>
 body{font-family:-apple-system,Helvetica,sans-serif;margin:0;display:flex;height:100vh;background:#fff}
 aside{width:260px;border-right:1px solid #eee;padding:12px;color:#555;font-size:13px}
 section{flex:1;display:flex;flex-direction:column;min-width:0}
 header{padding:12px 16px;border-bottom:1px solid #eee;font-weight:600}
 #list{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
 .bubble{max-width:70%;padding:10px 12px;border-radius:12px;background:#f2f3f5;font-size:13px;line-height:1.45}
 .me{align-self:flex-end;background:#e7f3ff}
 .composer{border-top:1px solid #eee;padding:10px 12px}
 [contenteditable]{min-height:56px;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:13px;outline:none}
 .row{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
 .actions,.right{display:flex;align-items:center;gap:6px}
 .row button{border:0;background:transparent;font-size:16px;cursor:pointer;width:24px;height:24px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%}
 .send{width:auto;height:auto;background:#1d64d8;color:#fff;border-radius:16px;padding:6px 16px}
</style></head><body>
<aside>Noman Nazir<br>Fatima<br>Mohammad Soleymani Far</aside>
<section>
  <header>Mohammad Soleymani Far</header>
  <div id="list">
    <div class="bubble">Hi Shahzad, thanks for connecting!</div>
    <div class="bubble">I noticed you have extensive experience as a Senior Mobile Engineer.</div>
    <div class="bubble">We are hiring for a fintech payments team in Dubai. Are you open to hearing about it?</div>
    <div class="bubble me">Thanks for reaching out.</div>
  </div>
  <div class="composer">
    <div contenteditable="true" role="textbox" aria-label="Write a message…"></div>
    <div class="row">
      <div class="actions">
        <button aria-label="Open Emoji Keyboard">😊</button>
        <button aria-label="Attach an image">🖼</button>
      </div>
      <div class="right">
        <button class="send" aria-label="Send">Send</button>
        <button aria-label="More actions">…</button>
      </div>
    </div>
  </div>
</section>
<script>
${HELPERS}
</script></body></html>`;

const PAGES = {
  '/mock/linkedin': LINKEDIN,
  '/mock/x': X,
  '/mock/facebook': FACEBOOK,
  '/mock/linkedin-dm': LINKEDIN_DM,
};

/* ------------------------------------------------------------------ */
/* Servers                                                            */
/* ------------------------------------------------------------------ */

function makeCert() {
  const dir = mkdtempSync(join(tmpdir(), 'socialme-cert-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    key,
    '-out',
    cert,
    '-days',
    '2',
    '-subj',
    '/CN=www.linkedin.com',
  ]);
  const result = { key: readFileSync(key), cert: readFileSync(cert) };
  rmSync(dir, { recursive: true, force: true });
  return result;
}

export function startServers() {
  const stats = { requests: [], completions: 0 };

  /* --- model API (OpenAI compatible, HTTP) --- */
  const api = createHttpServer((req, res) => {
    const url = req.url ?? '';
    stats.requests.push({ url, method: req.method });

    if (req.method === 'GET' && url.startsWith('/v1/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
      return;
    }

    if (req.method === 'POST' && url.startsWith('/v1/chat/completions')) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(body);
        } catch {}
        stats.completions += 1;
        stats.lastPrompt = parsed?.messages?.map((m) => m.content).join('\n') ?? '';

        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        const chunks = DRAFT.match(/.{1,18}/g) ?? [DRAFT];
        let i = 0;
        const timer = setInterval(() => {
          if (i >= chunks.length) {
            clearInterval(timer);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i] } }] })}\n\n`);
          i += 1;
        }, 18);
      });
      return;
    }

    if (url.startsWith('/fail')) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
      return;
    }

    res.writeHead(404).end('not found');
  });

  /* --- platform replicas (HTTPS) --- */
  const tls = makeCert();
  const pages = createHttpsServer(tls, (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    const html = PAGES[path];
    if (!html) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  return new Promise((resolve) => {
    pages.listen(0, '127.0.0.1', () => {
      api.listen(0, '127.0.0.1', () => {
        resolve({
          stats,
          pagePort: pages.address().port,
          apiPort: api.address().port,
          close: () =>
            new Promise((done) => {
              pages.close(() => api.close(() => done()));
            }),
        });
      });
    });
  });
}
