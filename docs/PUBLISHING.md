# Publishing to the Chrome Web Store

Everything an upload needs is prepared here. What only you can do is marked **You**.

---

## 0. What is already prepared

| Item | Where / status |
|---|---|
| Uploadable package | `dist/socialme-0.5.0-chrome.zip` (Manifest V3) |
| Store icon 128×128 | baked into the package (`icon/128.png`) |
| Screenshots 1280×800 ×3 | `docs/store/screenshot-1.png` … `-3.png` |
| Promo tile 440×280 | `docs/store/promo-440x280.png` |
| Privacy policy | `PRIVACY.md` (publish as a URL, see §4) |
| Listing copy | §5 of this file, ready to paste |
| Permission justifications | §6 |
| Privacy questionnaire answers | §7 |

**You:** create the developer account (§1) — it needs your identity and a payment method.

---

## 1. One-time account setup (You)

1. Go to <https://chrome.google.com/webstore/devconsole>.
2. Sign in with the Google account that should own the item.
3. Pay the **one-time US$5** developer registration fee.
4. Verify your identity (Google asks for name/address; some accounts need ID verification).
5. Turn on **2-Step Verification** for that Google account — publishing is blocked without it.

Expect the verification to take from a few minutes to a day.

---

## 2. Build the package

```bash
npm install
npm run build
npm run zip
```

Output: `dist/socialme-0.5.0-chrome.zip`. Upload **the zip**, not the folder.

Check before uploading:

- `manifest.json` name, version and permissions look right.
- `npm run test:all` is green.
- The zip contains `manifest.json` at its root (not nested in a folder).

---

## 3. Create the item (You)

1. Dashboard → **New item**.
2. Upload `dist/socialme-0.5.0-chrome.zip`.
3. Fill the tabs below, then **Submit for review**.

Review usually takes from a few hours to three working days. A rejection names the policy and lets
you fix and resubmit without paying again.

---

## 4. Store listing tab

**Name** (45 chars max):

```
SocialMe — AI replies for LinkedIn, X
```

**Short description** (132 chars max):

```
Write sharp, on-brand replies on LinkedIn, X and Facebook. Human-paced and account-safe, with your own API key.
```

**Detailed description** (paste as-is):

```
SocialMe helps you reply to posts and messages in your own voice — on LinkedIn, X and Facebook — without sounding like a template.

WHY IT EXISTS
Good comments take ten minutes each. Most people give up and write "Great post!", which nobody reads. SocialMe reads the post, writes a specific reply that fits the conversation, and types it into the real comment box. You stay the author.

WHAT IT DOES
• A ✦ icon in the comment toolbar. Pick a tone, optionally add an instruction ("mention the 2-week launch"), and the reply streams straight into the field.
• The same icon in DM composers. It reads the thread and answers the last message from the other person.
• A full panel with eight angles (insight, respectful pushback, sharp question, personal story, number/result, tactical tip, add momentum, punchy), tone, length and a quality score.
• New post and repurpose modes for your own content.
• A brand model — positioning, pillars, proof, point of view — applied to every draft, so the writing sounds like you and not like a generic assistant.

ACCOUNT SAFETY
• Off by default: nothing is published without your click.
• Hourly and daily caps, a minimum gap between actions, and a warm-up period for new accounts.
• Character-by-character typing and human-paced clicking.
• Automatic pause when the platform shows a restriction banner or a verification challenge.

BRING YOUR OWN KEY
Works with OpenAI, DeepSeek, OpenRouter, Google Gemini, Anthropic, Ollama (local) or any OpenAI-compatible endpoint. Your key stays in your browser and is sent only to the provider you chose.

PRIVACY
No accounts, no telemetry, no SocialMe server. Settings, keys and drafts live in your browser. The only network request is the one to your AI provider.

Not affiliated with LinkedIn, X or Meta.
```

**Category:** Productivity
**Language:** English

**Graphics** (upload the files in `docs/store/`):

| Asset | Size | File |
|---|---|---|
| Screenshot 1 | 1280×800 | `screenshot-1.png` (reply in the toolbar) |
| Screenshot 2 | 1280×800 | `screenshot-2.png` (tone menu) |
| Screenshot 3 | 1280×800 | `screenshot-3.png` (brand settings) |
| Small promo tile | 440×280 | `promo-440x280.png` |
| Store icon | 128×128 | already in the package |

**Privacy policy URL** — publish `PRIVACY.md` somewhere public, for example:

- GitHub blob: `https://github.com/shahzadafridi/socialme/blob/main/PRIVACY.md`
- or GitHub Pages: enable Pages from `main` / `/docs`, then
  `https://shahzadafridi.github.io/socialme/PRIVACY.html`

The dashboard only checks that the URL loads.

---

## 5. Permission justifications (paste per field)

**`storage`**

```
Saves the user's own settings, personas, API key and draft history locally in the browser. Nothing is synced or uploaded.
```

**Host permission — `linkedin.com`, `x.com`, `facebook.com`**

```
Required for the content script that places the reply icon in posts and message composers the user is already viewing, and reads the post being replied to. It does not run on any other site.
```

**Host permissions — `api.openai.com`, `api.deepseek.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `openrouter.ai`, `localhost`**

```
The extension sends the reply request to the AI provider the user configured with their own API key. No other domains are contacted.
```

**Remote code**

```
No. The extension does not load or execute remote code. All JavaScript is bundled in the package.
```

---

## 6. Privacy practices tab

- **Single purpose:** "Write social media replies and posts in the user's own voice."
- **Data usage:** state honestly that post text and the user's writing preferences are transmitted
  to the AI provider the user selects, and that the developer receives nothing.
- Tick the certifications: no sale of data, no use unrelated to the single purpose, no credit checks.
- **Data types:** "Website content" may be selected, because the post being replied to is sent to the
  provider. Everything else is not collected.

---

## 7. Distribution tab

- **Visibility:** Public (or Unlisted while you test).
- **Regions:** all.
- **Pricing:** free.
- **Payments:** none.

---

## 8. Review expectations

Chrome reviewers look for:

| Risk | How this package handles it |
|---|---|
| Remote code | None; everything is bundled |
| Broad host access | Only three social hosts + provider APIs |
| Hidden data collection | Privacy policy + questionnaire; no telemetry in code |
| Deceptive behaviour | Auto-posting is off by default and clearly labelled |
| Unrequested UI | The icon only appears in comment/DM toolbars |

If a reviewer asks for a demo account: describe the bring-your-own-key model — no account exists.
That is normally accepted.

---

## 9. Updating a published item (You)

1. Bump `version` in `wxt.config.ts` **and** `package.json`.
2. `npm run build && npm run zip`.
3. Dashboard → your item → **Package** → upload the new zip.
4. Add release notes, submit.

Keep the version monotonic: Chrome refuses a lower version than the published one.

---

## 10. Checklist

- [ ] `npm run test:all` green
- [ ] Version bumped in both files
- [ ] Zip built from a clean `npm run build`
- [ ] Screenshots and promo tile uploaded
- [ ] Listing copy pasted
- [ ] Permission justifications pasted
- [ ] Privacy policy URL live
- [ ] Privacy questionnaire completed
- [ ] Visibility and regions set
- [ ] Submitted
