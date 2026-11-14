# SocialMe

**Build your own brand on LinkedIn, X and Facebook — without sounding like a bot, and without getting the account restricted.**

![SocialMe — pick a tone, add an instruction, get a reply in your voice](docs/demo.gif)

A small ✦ icon sits in the comment toolbar. One click opens a tone menu, optionally takes an
instruction, and streams a reply that references what the post actually says — in your brand voice —
straight into the real comment box. You decide what gets sent; SocialMe enforces the limits that
protect the account.

---

## What it does

| | |
|---|---|
| **In-composer ✦** | An icon in the comment toolbar (next to emoji/GIF/image). One click streams the reply straight into that field. |
| **Inbox replies** | The same icon in LinkedIn / X / Meta message composers. It reads the conversation above the box and drafts your reply. |
| **Reply (panel)** | Reads the post under the button, shows angles and tone, then types the draft into the real box. |
| **New post** | Turns a topic or a rough idea into a platform-native post. |
| **Repurpose** | Rewrites a post you liked as your own — different framing, no copied sentences. |
| **Brand model** | Positioning, pillars, proof, point of view. Every prompt is anchored to what you want to be known for. |
| **Personas** | Global voice, multiple named personas, optional per-platform override. |
| **8 angles** | Insight, respectful pushback, sharp question, personal story, number/result, tactical tip, add momentum, punchy. |
| **Human interaction** | Types character by character with uneven timing and pauses at punctuation. Pointer-level clicks, randomized send delay. |
| **Account limits** | Per-hour and per-day caps, minimum gap between actions, warm-up period for new accounts, automatic pause on restriction banners. |
| **Any model** | OpenAI, DeepSeek, OpenRouter, Gemini, Anthropic, Ollama, or any OpenAI-compatible endpoint. Your key, your account. |

---

## Install

```bash
cd socialme
npm install
npm run build
```

Then in Chrome (or Edge/Brave):

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select `socialme/dist/chrome-mv3`
4. Pin SocialMe to the toolbar
5. Open **Settings** and paste an API key

Reload any LinkedIn / X / Facebook tab that was already open — content scripts only attach on page
load.

> `--load-extension` from the command line is blocked in Chrome 137+, but **Load unpacked** in the UI
> still works. Safari is not supported.

---

## Setup in 60 seconds

1. **AI provider** — pick one and paste a key:

   | Provider | Model | Why |
   |---|---|---|
   | DeepSeek | `deepseek-chat` | Cheapest that still writes like a person. Best default for comments. |
   | OpenAI | `gpt-4o-mini` | Predictable, widely available. |
   | OpenRouter | `openai/gpt-4o-mini` | One key, switch models later. |
   | Google Gemini | `gemini-2.5-flash` | Generous free tier. |
   | Anthropic | `claude-sonnet-4-5` | Best natural prose, pricier. |
   | Ollama | `llama3.2` | Local and free (`ollama serve`). Lower quality. |

   Hit **Test connection**, then **Fetch model list**.

2. **Brand** — positioning and pillars. This is what keeps your comments recognisably yours.

3. **Voice** — fill in *How you write*. The single highest-leverage field.

4. **Safety & reach** — defaults are deliberately conservative. Leave Review mode on until you trust
   the output.

---

## Using it

### Reply to a post

1. A ✦ button sits in the post's action row (Like · Comment · Share · **✦ SocialMe**).
2. Click it. The panel opens with the post, author and engagement already loaded.
3. Pick an **angle** — the biggest quality lever — and optionally override tone or length.
4. **Generate** — text streams in. **Regenerate** passes the rejected drafts back as negative
   examples, so it will not repeat itself.
5. Edit if you want, then:

   - **Insert** — types it into the real comment box and stops. You press send.
   - **Insert & post** — types it and presses send after a randomized delay, only if auto-post is on
     and the allowance check passes.
   - **Copy** — clipboard only.

### The one-click path (no panel)

Click **Comment** under any post, and a **✦** icon appears at the **end** of the comment toolbar —
after the emoji, GIF and image buttons, as a circle the same size as them. One click streams a reply straight into that field, in your default
voice and angle. No panel, no copy-paste. Click it again while it is writing to cancel.

The same icon appears in direct messages. Open a conversation, and the ✦ sits just after the emoji
control in the composer. It reads the message list (LinkedIn's `msg-s-event-listitem` bodies; a
geometric fallback on X and Meta), tags each message `me:` or `them:`, drops UI chrome and date
separators, and answers the **last message from them specifically** — so you get "I can't do the
call this week, but send a recording of one campaign" instead of "what are you working on?".

**Pick a tone before it writes.** Clicking ✦ opens a small menu — *Default, Natural, Friendly, Formal,
Confident, Concise, Contrarian, Curious* for comments; *Default, Natural, Friendly, Formal, Concise,
Follow-up, Confident, Empathetic* for DMs. The tone is applied **on top of** your brand block and
persona, so the voice stays yours and only the register changes.

**How much context it sends** is yours to choose in *Defaults → Inbox replies*:

| Mode | Sends | Best for |
|---|---|---|
| **Last message** | only their latest message | quick one-question threads, lowest cost |
| **Last 3** (default) | the last three messages | ongoing conversations that need continuity |
| **Whole chat** | up to 12 recent messages | negotiations, long threads |

The transcript always **ends on their last message** — if the last line is yours, it is trimmed so
the model never answers you.

> The old pill in each post's action row is off by default (it duplicated this). Turn it back on in
> *Defaults → Show ✦ pill in every post's action row* if you prefer the full panel from the feed.

This is the fastest loop for daily engagement:

1. Click **Comment**
2. Click **✦**
3. Skim the result, edit a word if needed, press send

Turn it off in *Defaults → Show ✦ inside open comment boxes* if you never want it.

### Write an original post

Click the floating **SocialMe** pill (or `⌘⇧A`), choose **New post**, type the topic, generate, then
Insert — the panel opens the composer and fills it.

### Repurpose

Open the post you want to adapt, click ✦, switch to **Repurpose**. The result is a new post in your
voice that keeps the insight but not the sentences.

### Shortcuts

| Key | Action |
|---|---|
| `⌘⇧A` / `Ctrl⇧A` | Open / close the panel |
| `Esc` | Close the panel |
| `⌘↵` / `Ctrl↵` | Send a reply once it's in the editor |

---

## The two ideas behind the output

### 1. A brand, not a persona prompt

A persona says *how* you sound. A brand says *what you are known for*. SocialMe sends both, and the
brand block outranks cleverness:

```
WHAT I AM BUILDING
- Positioning: I help small SaaS teams ship faster...
- Pillars (stay inside one of these): shipping software without a big team / hiring engineers...
- Point of view: most delivery problems are decision problems
- Proof I can cite: cut a client's release cycle from 3 weeks to 4 days
- Never claim or discuss: no client names without permission
```

The model is told to land inside one pillar, make the connection felt rather than announced, and
never pitch. A comment that could have been written by anyone about anything is a failed comment.

### 2. Rules that remove the AI tells

- never open with *Great post*, *Couldn't agree more*, *So true*
- ban the corporate vocabulary (`leverage`, `delve`, `game-changer`, `unlock`, …)
- reference one concrete detail from the post without restating it
- never invent statistics, clients or case studies — if a number isn't in the post or your notes, the
  outcome is described qualitatively
- no markdown, no preamble, no quotes around the output
- platform rules: X is one or two sentences and no hashtags; LinkedIn comments are 200-600 chars and
  no hashtags; Facebook is conversational
- length targets per task/platform/length, with a hard cap from the persona

**Persona fields that matter most:** *How you write* → *Sample posts* (paste 2-3 things you actually
wrote) → *What you never do* → *Who you are / what you know* → *Banned words*.

**Quality score** is a heuristic: it rewards specificity, a real question and sensible length; it
punishes cliché openers, over-limit text and emoji spam. 80+ is worth posting, under 60 regenerate.

---

## Account safety

SocialMe treats reach as a resource that a restriction can delete, so the guardrails run *before*
anything is typed.

**Human interaction**

- Drafts are typed in uneven chunks (2-6 characters), with longer pauses at `.` `,` `?` and random
  hesitation — not pasted in one event
- Clicks are dispatched as pointer + mouse sequences, not `.click()`
- Sending waits a randomized 1.2-3.5s after typing
- Three speeds: Fast / Natural / Careful

**Hard limits** (enforced in `lib/safety/limits.ts`)

| Limit | Default | Why |
|---|---|---|
| Min gap between actions | 90 s | Instant repeats are the clearest automation signal |
| Max per hour | 6 | Above this, comments start looking like a campaign |
| Max per day | 20 | Well under where LinkedIn/X throttling usually begins |
| Warm-up | off | Set 7 days on a new account; caps are halved |
| Pause on warning | on | Blocks posting until you clear the banner |

**Warning detection** — watches alerts, dialogs and live regions for restriction text, "unusual
activity", verification challenges and captcha iframes. When one appears, the panel shows it and
auto-posting is blocked until you dismiss it.

**Policy awareness** — the Safety tab explains, in plain language, what each platform's rules
actually say about automation and where enforcement starts. The defaults are stricter than the
platforms require. On an account you care about, use Review mode.

> Even with all of this, automated posting is against LinkedIn's and X's terms. SocialMe reduces the
> risk; it cannot make automation compliant. That is why auto-post is off by default.

---

## A short growth playbook

- **Reply early.** The first ~60 minutes decide most of a post's reach. Sort by *Recent* and reply
  while a post has 5 comments, not 500.
- **Length on LinkedIn.** Under ~15 words is rarely seen; 200-600 characters is the sweet spot.
- **Add, don't agree.** One concrete detail from your own work is what makes people click your name.
- **Ask a question you'd actually answer.** Not "thoughts?" — something specific enough that the
  author's reply teaches the thread something.
- **Consistency beats volume.** 5-10 thoughtful comments a day in one niche beats 50 scattered ones.
- **Repurpose your winners.** When a post performs, rewrite it for the other two platforms instead of
  copy-pasting — the framing that works on LinkedIn reads long-winded on X.
- **Measure profile views, not likes.** Impressions are noisy; inbound profile visits and DMs are the
  signal that you are building a brand.

---

## Architecture

```
entrypoints/
  background.ts        Service worker: owns API keys, streams completions over a port
  socialme.content.tsx Mounts the shadow-DOM UI, toolbar icon, warning watch
  options/             Settings: providers, brand, voice, defaults, safety, data
  popup/               Toolbar popup: status, today's actions, last draft
lib/
  core/                Domain + AI, no DOM and no chrome.*
    types.ts           Settings, Persona, Brand, requests
    constants.ts       provider presets, angles, platform policy text
    defaults.ts        starter personas, defaults, settings migration
    ai/prompt.ts       brand + persona + platform → prompt
    ai/providers.ts    streaming for OpenAI-compatible / Anthropic / Gemini
    ai/sse.ts          SSE parsing
    ai/quality.ts      draft scoring heuristics
  data/storage.ts      repositories: settings, secrets, usage, history, activity
  integrations/        adapters per network + editor writing + DM transcripts
  features/            use cases: deliver, safety (limits, humanizer, watch), diagnostics
  ui/                  React panel, launcher, inline composer icon
  shared/              DOM utilities
```

Dependency rule: `ui → features → integrations → core`, with `data` below and `shared` at the edge.
Full rationale in [ARCHITECTURE.md](./ARCHITECTURE.md).
```

Data flow:

```
page  ──(click ✦)──▶  content script (shadow DOM React panel)
                              │  runtime.connect('socialme:gen')
                              ▼
                      background service worker ──fetch──▶ provider API (SSE)
                              │  port.postMessage({type:'delta'})
                              ▼
                      panel streams text ──▶ type like a human ──▶ submit
                              ▲
                      safety: allowance + warning checks
```

Content scripts inherit the page's CORS rules, so API calls have to run in the background. That also
keeps keys out of page-adjacent code.

Storage keys: `socialme.settings.v1`, `socialme.secrets.v1`, `socialme.usage.v1`,
`socialme.activity.v1`, `socialme.history.v1`, `socialme.lastDraft.v1`.

---

## Design

The full system design — layers, dependency rule, data model, platform abstraction, security model
and decision log — is in [ARCHITECTURE.md](./ARCHITECTURE.md). The short version:

```
ui → features → integrations → core
        └────► data ────┘
```

`core` is pure domain + AI (no DOM, no `chrome.*`), so it is unit-testable in Node. Everything that
touches a page lives in `integrations/`, one adapter per network.

## Development

```bash
npm run dev        # WXT dev server with HMR
npm run compile    # tsc --noEmit
npm run test       # logic + provider contract + extension e2e
npm run test:live  # full flows on local replicas of all three feeds
npm run test:all   # everything
npm run preview    # browser UI harness at http://localhost:5180
```

See [TESTING.md](./TESTING.md) for the full coverage matrix and what is deliberately left manual.

Tests:

- `scripts/selftest.mjs` — prompt construction (brand block, platform guides, persona voice, avoid
  lists, limits) and draft scoring.
- `scripts/provider.selftest.mjs` — request URLs, headers and bodies for all three API shapes, SSE
  parsing, error mapping (401/402/429), model listing.
- `scripts/e2e.mjs` — loads the built extension in a real Chromium with `--load-extension`, then
  checks the service worker, options page, autosave to storage, messaging, popup and manifest.

> The e2e script defaults to **Brave** because Google Chrome 137+ ignores `--load-extension`.
> Override with `CHROME_PATH=/path/to/chrome npm run test:e2e`.

### Fixing a broken selector

1. Inspect the element on the network.
2. Update the selector arrays in `lib/platform/<network>.ts` (`findPosts`, `readPost`, `actionAnchor`,
   `openReplyEditor`, `submitButton`).
3. `npm run dev`, reload the page, confirm the button appears and Insert lands in the box.

### UI preview (no extension needed)

`npm run preview` serves `preview/` with a mocked `browser` API:

- `?view=panel` and `?view=panel-light`
- `?view=options`
- `?view=popup`
- `?view=insert` — runs the real insertion strategies against real DOM nodes
- `?view=composer` — runs the in-composer button end to end against the mocked model
- `?view=composer-demo` — a static view of the button on a comment box

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No ✦ on posts | Reload the tab after installing. Check *Show ✦ button* in Defaults. |
| "Couldn't find the editor" | The draft is copied to your clipboard. Usually the platform changed markup, or the comment box didn't open — click **Comment** yourself and retry. |
| "Too soon after the last action" | The safety gap is working. Wait it out, or lower *Minimum gap* if you accept the risk. |
| "Daily limit reached" | Raise the cap in Safety & reach, or keep it — it is protecting reach. |
| `401` / "API key rejected" | Re-paste the key, check credit, confirm the base URL. |
| `429` | Provider rate limit or your own cap. Wait, or raise the cap. |
| Typing is slow | Set typing speed to Fast, or turn off character-by-character typing. |
| Panel overlaps the site | Fixed to the top right; narrow windows switch to a near-fullscreen panel. |

---

## Ideas not built yet

- Three variants per request (pick the best) instead of one draft + regenerate
- A weekly content plan generated from your pillars
- Per-post engagement stats to learn which angles earn profile visits
- Chrome side panel mode so the composer is never covered
- Firefox build (`npx wxt build -b firefox`) — needs a `browser_specific_settings` id
