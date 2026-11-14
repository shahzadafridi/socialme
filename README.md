# SocialMe

**Build your own brand on LinkedIn, X and Facebook — without sounding like a bot, and without getting the account restricted.**

![SocialMe — pick a tone, add an instruction, get a reply in your voice](docs/demo.gif)

Version **0.5.0** · Chrome / Edge / Brave (Manifest V3) · Bring your own API key · Local-first

---

## The problem it solves

Growing on social means commenting. Commenting well takes 10–15 minutes per reply if you actually
read the post, and most people give up and post "Great insight!" instead — which the algorithm
ignores and humans scroll past.

SocialMe reads the post, writes a specific reply in **your** voice, and types it into the real
comment box. You stay the author; the account stays safe.

| | |
|---|---|
| **Time** | One click instead of ten minutes of drafting |
| **Relevance** | It references the actual post, not a generic template |
| **Voice** | Your brand positioning, pillars and personas — not "AI tone" |
| **Safety** | Human-paced typing, hourly/daily caps, pauses on account warnings |

---

## Features

| | |
|---|---|
| **Reply from the comment box** | A ✦ icon in the toolbar. Pick a tone, optionally add an instruction, and the reply streams straight into the field. |
| **Inbox replies** | The same icon in DM composers. Reads the thread (`me:` / `them:`) and answers their last message. |
| **Full panel** | 8 angles, tone, length, language, quality score, regenerate, history. |
| **New post** | Topic → platform-native post, filled into the composer. |
| **Repurpose** | Rewrite a post you liked as your own — different framing, no copied sentences. |
| **Brand model** | Positioning, pillars, proof, point of view, forbidden claims. Applied to every draft. |
| **Personas** | Multiple voices, one per platform if you want. |
| **Account safety** | Caps per hour/day, minimum gap, warm-up for new accounts, restriction-banner detection. |
| **Human interaction** | Character-by-character typing, pointer-level clicks, randomised send delay. |
| **Any model** | OpenAI, DeepSeek, OpenRouter, Gemini, Anthropic, Ollama, any OpenAI-compatible endpoint. |

---

## Install

### Option A — from the release zip (recommended)

1. Download `socialme-0.5.0-chrome.zip` from [Releases](../../releases).
2. Unzip it somewhere permanent (e.g. `~/Applications/socialme`).
3. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select the unzipped folder.
6. Pin SocialMe to the toolbar.

> The folder must stay where you put it — Chrome loads unpacked extensions from that path. Moving or
> deleting it removes the extension.

### Option B — from source

```bash
git clone https://github.com/shahzadafridi/socialme.git
cd socialme
npm install
npm run build
```

Then load `socialme/dist/chrome-mv3` with **Load unpacked** as above.

> Chrome 137+ blocks `--load-extension` from the command line; **Load unpacked** in the UI still
> works. Safari is not supported.

---

## First-run setup (about 3 minutes)

Open the extension's settings (gear icon in the panel, or the toolbar popup → *Settings*).

1. **AI provider** — pick one and paste an API key, then hit *Test connection*.

   | Provider | Model | Note |
   |---|---|---|
   | DeepSeek | `deepseek-chat` | Cheapest option that still writes well. Good default. |
   | OpenAI | `gpt-4o-mini` | Predictable, widely available. |
   | OpenRouter | `openai/gpt-4o-mini` | One key for many models. |
   | Google Gemini | `gemini-2.5-flash` | Generous free tier. |
   | Anthropic | `claude-sonnet-4-5` | Best prose, pricier. |
   | Ollama | `llama3.2` | Local and free (`ollama serve`). |

2. **Brand** — fill *Positioning* and *Content pillars*. This is what makes the output yours rather
   than generically clever.
3. **Voice** — fill *How you write*; paste 2–3 posts you actually wrote into *Sample posts*.
4. **Defaults** — choose the default angle, reply length and inbox context.
5. **Safety & reach** — leave the defaults until you trust the output. Review mode means nothing is
   ever posted without your click.

---

## How to use

### Reply to a post

1. Click **Comment** under any post.
2. Click the **✦** icon at the end of the comment toolbar.
3. Choose a tone — *Default, Natural, Friendly, Formal, Confident, Concise, Contrarian, Curious* — or
   type an instruction first, e.g. *"mention the 2-week launch"*.
4. The reply streams into the box. Edit it if you like, then press **Comment** yourself.

### Reply to a DM

Open a conversation. The ✦ sits in the message toolbar. Choose a tone (*… Follow-up, Empathetic* for
DMs) and it answers the last message from the other person.

*Settings → Defaults → Inbox replies* controls how much thread is sent: last message, last 3, or the
whole chat.

### Write a new post or repurpose

Click the floating **SocialMe** pill (or `⌘⇧A`), pick **New post** or **Repurpose**, add a topic,
generate, then **Insert** — the composer opens and the text is typed in.

### Shortcuts

| Key | Action |
|---|---|
| `⌘⇧A` / `Ctrl⇧A` | Open / close the panel |
| `Esc` | Close the panel or the tone menu |
| `⌘↵` / `Ctrl↵` | Send once the draft is in the editor |

---

## Settings reference

| Tab | What it does |
|---|---|
| **AI provider** | Keys, models, base URLs, temperature, test connection |
| **Brand** | Positioning, pillars, POV, proof, stories, goal, forbidden claims |
| **Voice** | Personas, tone, writing rules, banned words, samples, length caps |
| **Defaults** | Angle, length, inbox context, per-platform persona, theme |
| **Safety & reach** | Output mode, typing speed, caps, warm-up, warning pause, auto-post |
| **Data** | Export/import (keys excluded), history, diagnostics, shortcuts |

---

## Privacy

Everything stays on your machine:

- Your API key is stored in `chrome.storage.local`, never synced, never included in exports.
- Requests are made from the extension's background worker — the page you are on never sees the key.
- The only network call is the one to the provider you chose.
- No analytics, no telemetry, no accounts.

Full statement: [PRIVACY.md](./PRIVACY.md).

---

## Safety and the platforms' terms

Automated posting is against LinkedIn's and X's terms, and Meta restricts automated engagement. That
is why auto-posting is **off by default** and every send passes rate limits first.

SocialMe reduces the risk — human pacing, caps, no duplicate text, warning detection — but it cannot
make automation compliant. On an account you care about, use **Review** mode and press send yourself.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No ✦ on comments | Reload the tab after installing or updating the extension. |
| Panel but no icon | The comment box may use a layout without a toolbar; use the panel from the launcher. |
| "Couldn't find the editor" | The draft is copied to your clipboard. This usually means the platform changed its markup — check *Data → Last page scan*. |
| `401` / "API key rejected" | Re-paste the key, check credit, confirm the base URL. |
| `429` | Provider rate limit or your own daily cap. |
| Typing feels slow | *Safety & reach → typing speed: Fast*, or turn off character-by-character typing. |

If something looks broken after a platform redesign, open **Settings → Data → Last page scan**: it
shows exactly which posts matched, the transcript sent, and any error, which makes a selector fix a
five-minute job.

---

## Development

```bash
npm run dev        # WXT dev server with HMR
npm run compile    # tsc --noEmit
npm run test       # logic + provider contract + extension e2e
npm run test:live  # full flows on local replicas of all three feeds
npm run test:all   # everything
npm run preview    # UI harness at http://localhost:5180
```

Architecture and the dependency rule: [ARCHITECTURE.md](./ARCHITECTURE.md).
Test matrix and what is deliberately manual: [TESTING.md](./TESTING.md).

---

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the setup, the
code conventions, and the checks a PR must pass. Good first issues are labelled `good first issue`.

---

## Support

If SocialMe saves you time, you can buy me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat-square)](https://buymeacoffee.com/shahzadafridi)

Or simply star the repo and tell me which platform broke first — that is genuinely useful.

---

## Licence

MIT — see [LICENSE](./LICENSE).

Not affiliated with LinkedIn, X, Meta, or any AI provider.
