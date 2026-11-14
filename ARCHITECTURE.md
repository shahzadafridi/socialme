# Architecture

SocialMe is a Manifest V3 browser extension that writes replies in the user's voice on LinkedIn, X
and Facebook. This document explains how it is put together, why the boundaries are where they are,
and how to extend it without breaking things.

---

## 1. Design goals and constraints

| Goal | Consequence |
|---|---|
| Work on three hostile, frequently redesigned DOMs | Platform logic isolated behind one adapter contract, with structural (ARIA/role) selectors and heuristics rather than class names |
| Never leak the user's API key to the page | All model calls run in the background service worker; page-adjacent code never holds a key |
| Be safe for the account | Every send passes a limits gate first; typing is simulated; warnings pause automation |
| Feel instant | Streaming over a long-lived port, rendered as it arrives |
| Stay local-first | `chrome.storage.local` only, no backend, no telemetry |
| Scale to more platforms/features | Layered modules with a strict dependency rule and small interfaces |

MV3 constraints that shape the design: a service worker that sleeps, content scripts in an isolated
world with the page's CORS rules, and no persistent in-memory state across restarts.

---

## 2. System context

```
┌──────────────┐        DOM only (isolated world)         ┌─────────────────────┐
│  Web page    │ ◄──────────────────────────────────────► │  Content script     │
│ (LinkedIn,   │   read posts, type into editors,         │  React panel +      │
│  X, Facebook)│   inject toolbar icons                   │  inline icon        │
└──────────────┘                                          └──────────┬──────────┘
                                                                    │ port: socialme:gen
                                                                    ▼
                                                          ┌─────────────────────┐
                                                          │ Background worker   │
                                                          │  keys, prompts,     │
                                                          │  streaming fetch    │
                                                          └──────────┬──────────┘
                                                                    │ HTTPS (stream)
                                                                    ▼
                                                          ┌─────────────────────┐
                                                          │ Model provider      │
                                                          │ OpenAI-compatible / │
                                                          │ Anthropic / Gemini  │
                                                          └─────────────────────┘
```

Options and popup pages are ordinary extension pages: they read/write the same storage and call the
provider directly for "Test connection".

---

## 3. Layers

```
lib/
├── core/          domain + AI. No DOM, no chrome.*, no React.
│   ├── types.ts        all shared types (Settings, Persona, Brand, requests…)
│   ├── constants.ts    provider presets, angles, platform policy text
│   ├── defaults.ts     starter personas, default settings, migration merge
│   └── ai/
│       ├── prompt.ts   brand + persona + platform → system/user prompt
│       ├── providers.ts streamCompletion() for 3 API shapes, error mapping
│       ├── sse.ts      SSE parsing, text extraction
│       └── quality.ts  draft scoring heuristics
├── data/
│   └── storage.ts  chrome.storage repositories: settings, secrets, usage,
│                   history, activity, export/import, migrations
├── integrations/  talk to the outside world (DOM + editors)
│   ├── adapter.ts      PlatformAdapter contract
│   ├── linkedin.ts …   one adapter per network
│   ├── index.ts        adapter registry
│   ├── insert.ts       write/verify text in contenteditable, textarea, Quill…
│   ├── messaging.ts    DM composer discovery + transcript builder
│   └── deliver.ts      type → delay → submit orchestration
├── features/      use cases that combine the layers
│   ├── diagnostics.ts  per-tab "what did the adapters see" record
│   └── safety/
│       ├── limits.ts   rolling activity log, hourly/daily caps, warm-up
│       ├── humanize.ts character-by-character typing
│       └── watch.ts    restriction banner / captcha detection
├── ui/            presentation only
│   ├── App.tsx         shell: launcher, panel, event bus
│   ├── Panel.tsx       full panel (angles, tone, draft, actions)
│   ├── composer/       inline icon: button, menu, placement, pipeline
│   └── theme.css       panel styles
└── shared/
    └── dom.ts      visibility, waiting, debounce, geometry helpers
```

**Dependency rule (the important part):**

```
ui ──► features ──► integrations ──► core
 │         │              │
 └─────────┴──► data ─────┘
```

- `core` imports nothing from the other layers. It is pure, so it is unit-testable in Node.
- `data` may import `core` types only.
- `integrations` may import `core` and `shared`. They never import `ui`.
- `features` compose `integrations` + `data` + `core`.
- `ui` is the only layer allowed to import React.

If a change would violate the rule, it usually means the logic belongs in a feature, not in the UI.

---

## 4. Module catalogue

| Module | Responsibility | Depends on |
|---|---|---|
| `core/ai/prompt` | Build the prompt from brand + persona + platform + task | core types/constants |
| `core/ai/providers` | One streaming interface over OpenAI-compatible, Anthropic, Gemini | core constants |
| `data/storage` | Typed repositories, secret handling, usage, migrations | core, browser storage |
| `integrations/*` | Read posts, open editors, submit, read DM threads | core, shared |
| `integrations/insert` | Write text four different ways and verify it landed | shared |
| `features/safety/limits` | Decide whether another action is allowed right now | data |
| `features/deliver` | Insert → wait → click send → verify | integrations |
| `features/diagnostics` | Snapshot of adapter matches for the Data tab | integrations |
| `ui/composer/placement` | Find the toolbar and place the icon as the last item | shared |
| `ui/composer/menu` | Tone + instruction popover | — |
| `ui/composer/index` | Lifecycle: scan, mount, generate, finish | all of the above |

---

## 5. Runtime flows

### 5.1 Reply from the toolbar icon

```
click ✦
  └─ openToneMenu()                       ui/composer/menu
       └─ { tone, instruction }
  └─ adapter.readPost() | readConversation()    integrations
       └─ { author, text }
  └─ runtime.connect('socialme:gen')      background
       └─ getSettings + getApiKey + resolvePersona + buildPrompt
       └─ streamCompletion() ── SSE ──► port.postMessage({type:'delta'})
  └─ appendDelta() into the editor        integrations/insert
  └─ looksInserted() verification, else re-insert
  └─ saveLastDraft() + addHistory()       data/storage
```

### 5.2 Sending with the safety gate

```
panel "Insert & post"
  └─ checkAllowance(platform, safety)     features/safety/limits
       ├─ daily cap / hourly cap / minimum gap / warm-up
       └─ refusal returns a human reason and a retry time
  └─ warning present? → block (safety/watch)
  └─ deliverDraft() → insert → randomised delay → submit button (or ⌘↵)
  └─ hasContent() after 900 ms decides "posted" vs "still in the box"
```

### 5.3 Which prompt the model sees

```
system = identity (persona)
       + brand block (positioning, pillars, proof, POV, forbidden)
       + platform guide (LinkedIn comment vs X post …)
       + hard rules (no invented stats, no cliché openers, no AI tells)
       + tone / emoji / hashtag / length limits / language
user   = task + angle + length target + source post or DM transcript
       + rejected drafts (regenerate) + my instruction for this one
```

The tone chosen in the menu replaces only the `Tone:` line; everything else still applies. Brand is
optional — if it is empty the block is omitted entirely.

---

## 6. Data model

```ts
Settings {
  version: 2
  providers[]        // 7 presets, user-editable baseUrl/model/temperature
  activeProvider
  brand              // positioning, pillars, proof, POV, offer, goals, forbidden
  personas[]         // voice rules, samples, caps
  platformPersona    // per-network override
  defaults           // angle, tone, length, standing instruction
  outputMode         // review | insert | auto (+ per-platform)
  autoSubmit         // enabled, delay range, confirm
  safety             // typing, gap, hourly/daily caps, warm-up, pause-on-warning
  dmContext          // last | last3 | all
  showComposerButton
  theme, historyEnabled
}
```

Storage keys are namespaced `socialme.*` and versioned. `mergeSettings()` upgrades any stored object
against the current defaults, so new fields appear without a migration script; `version` is used for
behavioural migrations (v2 removed the action-row pill).

| Key | Contents | Notes |
|---|---|---|
| `settings.v1` | `Settings` | synced by `storage.onChanged` |
| `secrets.v1` | `{ [providerId]: key }` | never exported, never sent to the page |
| `usage.v1` | per-day counters | 60-day prune |
| `activity.v1` | timestamped submits | drives caps; 7-day prune |
| `history.v1` | last 200 drafts | optional |
| `diagnostics.v1` | per-tab scan records | capped at 8 entries |

---

## 7. Platform abstraction

```ts
interface PlatformAdapter {
  id: PlatformId;
  findPosts(): HTMLElement[];
  readPost(el): PostContext | null;
  actionAnchor(post): HTMLElement | null;
  openReplyEditor(post): Promise<HTMLElement | null>;
  submitButton(editor): HTMLElement | null;
  hasContent(editor): boolean;
  findOpenEditors(): HTMLElement[];
  postForEditor(editor): HTMLElement | null;
  findMessageComposers(): HTMLElement[];
  readConversation(editor, maxMessages?): { author; text } | null;
  // new post
  openComposer(): Promise<HTMLElement | null>;
  submitPostButton(editor): HTMLElement | null;
}
```

Resilience strategy, in order:

1. **Stable signals first** — `data-testid` (X), ARIA labels (all three), `role="listitem"`,
   `role="article"`, semantic `msg-*` classes (LinkedIn messaging).
2. **Structural fallbacks** — climb from a text block or a labelled control to the nearest ancestor
   that behaves like a post/composer.
3. **Geometry last** — vertical bands and column overlap when nothing semantic exists.
4. **Diagnostics always** — `features/diagnostics` records what matched, the class chain, and the
   transcript it built, so a redesign is a 5-minute fix instead of guesswork.

Adding a network = implement the interface + register it in `integrations/index.ts` + add the host to
`wxt.config.ts` and the content-script `matches`. Nothing else changes.

---

## 8. Security and privacy

| Risk | Mitigation |
|---|---|
| Key exfiltration by the page | Keys live in the background worker; content scripts can only ask for a completion |
| Prompt leakage | Requests are built in the background; the page sees only the final text |
| Remote code | No remote scripts; providers are called directly over HTTPS |
| Unapproved publishing | Auto-post is off by default; confirm + caps + gap + warning pause |
| Data leaving the machine | Only the provider request; no analytics, no sync, export excludes secrets |

Threat model note: the content script trusts the DOM it reads, so post text is treated as data, never
as instructions — the prompt labels it as a source post and the hard rules forbid following it.

---

## 9. Error model and observability

`AiError` carries a stable `code` — `auth`, `model`, `rate_limit`, `billing`, `network`, `no_key`,
`config`, `aborted`, `unknown` — which the UI turns into a specific message and, where useful, an
"Open settings" link. Provider bodies are truncated into the message so the user sees "Invalid API
key" rather than "request failed".

The Data tab shows the last scan per tab (posts matched, action rows, editors, DM composers, the
transcript, the real class chain, and any boot error). That is the first place to look when a
platform changes.

---

## 10. Testing strategy

| Level | What | Where |
|---|---|---|
| Unit | prompt assembly, transcript builder/limits, quality scoring, provider request shapes + SSE | `scripts/selftest.mjs`, `scripts/provider.selftest.mjs` (Node, no DOM) |
| Contract | every provider shape, error mapping, model listing | same |
| Extension e2e | real Chromium loads the MV3 build, options autosave, popup, manifest | `scripts/e2e.mjs` |
| Live flow | local replicas of all three feeds + mock model, real content script | `scripts/livetest.mjs` |
| Manual | real logged-in DOM, real provider | documented in `TESTING.md` |

Fixtures mirror the current production DOM (hashed classes included for LinkedIn's feed, semantic
`msg-*` for messaging), so a selector regression shows up as a failing live test.

---

## 11. SOLID in practice

- **S** — one reason to change per module: `prompt.ts` changes when the writing rules change;
  `placement.ts` when the toolbar detection changes; `storage.ts` when persistence changes.
- **O** — new platforms and providers are additive: an adapter implements the interface; a provider
  is a preset + one branch in `providers.ts` (`kind`), never an `if` in the UI.
- **L** — every adapter is substitutable: the UI calls only interface methods, and unknown cases
  return `null` rather than throwing.
- **I** — small interfaces (`Diagnostics`, `Allowance`, `BuiltPrompt`) instead of one god-object;
  the panel receives `PublicSettings` with secrets structurally absent.
- **D** — features depend on functions from `data/` and `integrations/`, not on `chrome.*` or raw
  DOM inside the use case; storage can be swapped for a test double.

---

## 12. Extending

| Want to add | Touch |
|---|---|
| A network | `integrations/<name>.ts` + registry + manifest host + fixture |
| An AI provider | `PROVIDER_PRESETS` + a `kind` in `providers.ts` if it is not OpenAI-compatible |
| A new writing angle | `ANGLES` + one entry in `ANGLE_GUIDE` |
| A new task (e.g. thread) | `TaskKind`, a branch in `taskBlock`, a tab in the panel |
| A tone | `TONE_OPTIONS` in `ui/composer/menu.ts` (+ the panel list) |
| A side panel UI | new entrypoint that reuses `Panel` and `features/deliver` |

---

## 13. Known limitations / next

- All six composer surfaces (comment and DM on all three networks) are verified live, including
  X Chat, whose composer lives in a shadow root.
- Selectors are best-effort by nature; the health check and diagnostics exist because redesigns
  happen. See "When a site changes" below.
- Auto-posting is against the platforms' terms; it stays opt-in and capped.
- Firefox needs a `browser_specific_settings` id; the code is otherwise portable.
- No variants ("give me three") yet; regenerate with an angle change is the current workaround.

---

## 14. Decision log

| Decision | Alternatives | Why |
|---|---|---|
| Shadow DOM for the panel | Plain DOM + scoped CSS | Page CSS cannot leak in; only one element is exposed to the page |
| Streaming over a port | One-shot request | Perceived speed; user can cancel mid-generation |
| Prompts built in the background | Build in the content script | Keeps keys and brand data out of page-adjacent code |
| Heuristic + semantic adapters | Snapshot tests of saved HTML | Live DOM changes too fast; diagnostics give real evidence |
| BYO key, no backend | Hosted proxy | No server to run, no key custody, works offline with Ollama |
| Diagnostics in storage | Console logging | A support surface the user can read and paste |

---

## 15. When a site changes

Nothing is allowed to depend on a single selector. Every surface has a fallback ladder, and the
rung that matched is recorded so a fix targets the right place.

| Surface | Order tried |
|---|---|
| Icon row | emoji anchor → media-icon row → icons positioned near the editor |
| Comment editor | label match → comment form ancestor → article ancestor → dialog ancestor |
| DM editor | label match → messaging wrapper → shadow-DOM deep query |
| X chat | `textarea[data-testid]` → same field re-resolved after X re-renders |
| DM transcript | platform classes (LinkedIn) → list scan → ancestor climb |

**Diagnosing a report.** Options → Data has two cards:

- *Composer health* — per surface: editor, which strategy matched, send control, context readable.
  A redesign shows up as one red line, not a vague "it stopped working".
- *Last page scan* — node counts, class chains and button labels seen on the page.

**Fixing it.** Change the selector or add a rung in `lib/integrations/<platform>.ts` (or
`lib/ui/composer/placement.ts` for the icon row), run `npm run test:logic`, bump the version in
both `package.json` and `wxt.config.ts`, `npm run build`, zip `dist/chrome-mv3`, upload. Keep
`npm run test:live` green against a signed-in tab before publishing.

**Deliberately not done.** No remote selector config and no fetched rules: the package stays
self-contained, so a store review cannot be avoided anyway and there is no third-party endpoint
to trust. The trade-off is that a fix waits for review. The health check is what makes that wait
tolerable — breakage is known the same day rather than after complaints.
