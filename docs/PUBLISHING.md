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
I built SocialMe because I was spending ten minutes on every comment and still writing "Great post!" most of the time.

It adds a small star icon to the comment box. Click it, pick a tone, and it writes a reply that refers to what the post actually says. You can add an instruction first ("mention the 2-week launch"), or just press Generate. The text lands in the box, you edit if you want, and you press Comment yourself.

The same works in direct messages: open a conversation, click the star, and it answers the last message the other person sent you.

There is a full panel too, with angles such as a sharp question, a personal story or respectful disagreement, plus tone, length and a rough quality score. New post and repurpose are there when you want to write your own content.

What makes it sound like you is Brand and Voice: your positioning, the topics you want to be known for, the things you never say, and two or three posts you actually wrote.

On safety: it types at a human pace, keeps hourly and daily caps, and stops itself if the platform shows a warning. Auto-posting is off by default.

You connect your own AI account with an API key and pay that provider directly. Your key stays in your browser, and there is no account, no analytics and no server of mine.

If a platform changes its layout and something stops working, tell me and I will fix it.

Not affiliated with LinkedIn, X or Meta.
```

> **Do not list AI provider names in the description.** v0.5.0 was rejected under "Yellow Argon"
> (keyword spam) for the line `OpenAI, DeepSeek, OpenRouter, Google Gemini, Claude, or a local model`.
> The listing must describe what the extension does, not enumerate brands. Provider names belong in
> the settings UI and the README, not in store metadata.

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
