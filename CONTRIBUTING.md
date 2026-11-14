# Contributing

Thanks for wanting to help. This is a small, deliberately boring codebase: read the architecture
first, keep changes narrow, and make the tests prove it.

By participating you agree to be decent to other people. Harassment or dismissiveness gets you
removed from the project.

---

## Setup

Requirements: Node **20+**, npm, and a Chromium browser (Chrome, Brave or Edge).

```bash
git clone https://github.com/shahzadafridi/socialme.git
cd socialme
npm install
npm run dev
```

`npm run dev` builds to `.output/chrome-mv3-dev` and reloads on save. Load that folder once with
**Load unpacked** in `chrome://extensions`; after that, changes hot-reload.

You will need your own API key to test generation end to end. DeepSeek is the cheapest option.

---

## Before you change code

Read [ARCHITECTURE.md](./ARCHITECTURE.md). The one rule that matters:

```
ui  →  features  →  integrations  →  core
              └──►  data  ────┘
```

- `lib/core` must not import DOM, `chrome.*`, or React. If it does, it is not core.
- Only `lib/ui` may import React.
- Secrets are only read in `entrypoints/background.ts`.
- A platform detail (selector, editor quirks, submit button) belongs in `lib/integrations`.

If your change does not fit, open an issue first — a five-line design discussion beats a rejected
500-line PR.

---

## Style

- TypeScript strict; no `any` unless the provider payload forces it (then keep it local).
- Prefer small functions with obvious names over comments explaining a long one.
- Errors: throw `AiError` with a stable `code` in the AI layer; adapters return `null` instead of
  throwing when they cannot match a page.
- No `console.log` in shipped code. The diagnostics module exists for observability.
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

---

## Checks a PR must pass

```bash
npm run compile      # types
npm run test         # logic + provider contract + extension e2e
npm run test:live    # full flows on local replicas of the three feeds
```

`test:live` needs a Chromium that still honours `--load-extension` (Brave works; Chrome 137+ does
not). Override with `CHROME_PATH=/path/to/chrome npm run test:live`.

If you touch a selector, add or update the matching fixture in `scripts/livetest-server.mjs` so the
regression is covered.

---

## Adding a platform

1. Implement `PlatformAdapter` in `lib/integrations/<network>.ts`
   (`findPosts`, `readPost`, `actionAnchor`, `openReplyEditor`, `submitButton`, `findOpenEditors`,
   `postForEditor`, `findMessageComposers`, `readConversation`, `findNoteEditors`, `readNoteRecipient`,
   `hasContent`).
2. Register it in `lib/integrations/index.ts`.
3. Add the host to `wxt.config.ts` (content-script matches + provider host permissions if needed).
4. Add a fixture page to `scripts/livetest-server.mjs` and a case to `scripts/livetest.mjs`.
5. Run `test:live`; confirm the ✦ appears, inserts, submits, and that `Data → Last page scan`
   reports sensible values on the real site.

Prefer stable signals in this order: `data-testid` → ARIA labels/roles → semantic class names →
geometry. Never key off hashed class names.

---

## Adding an AI provider

- If it speaks the OpenAI chat-completions API: add a preset to `PROVIDER_PRESETS` in
  `lib/core/constants.ts` and one entry in `makeProvider`.
- Otherwise: add a `kind` to `ProviderKind`, a branch in `lib/core/ai/providers.ts`, and tests in
  `scripts/provider.selftest.mjs` for URL, headers, body and SSE shape.

---

## Reporting a bug

Include:

1. Platform and what you clicked (comment, DM, new post).
2. **Settings → Data → Last page scan** (expanded text).
3. The error text from the panel, if any.
4. Whether it worked before an update.

That is usually enough to fix a selector in one pass.

---

## What gets merged

- Fixes that come with a test.
- Selector fixes with the real class chain from the diagnostics panel.
- Prompt improvements with a before/after example.
- Accessibility and performance work.

Not merged: telemetry, hosted backends, anything that hides the account-safety limits, or features
that automate actions the platforms prohibit by default.
