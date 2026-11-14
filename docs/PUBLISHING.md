# Publishing to the Chrome Web Store

Everything an upload needs is prepared here. What only you can do is marked **You**.

---

## 0. What is already prepared

| Item | Where / status |
|---|---|
| Uploadable package | `dist/socialme-<version>-chrome.zip` (Manifest V3, `npm run zip`) |
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

Output: `dist/socialme-<version>-chrome.zip`. Upload **the zip**, not the folder. The version comes
from `package.json`; do not set it in `wxt.config.ts`.

Check before uploading:

- `manifest.json` name, version and permissions look right.
- `npm run test:all` is green.
- The zip contains `manifest.json` at its root (not nested in a folder).

---

## 3. Create the item (You)

1. Dashboard → **New item**.
2. Upload `dist/socialme-<version>-chrome.zip`.
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

There is a full panel too, with angles such as a sharp question, a personal story or respectful disagreement, plus tone, length and a rough quality score. When you reply to someone else's comment it answers that person, not the post, and on LinkedIn it writes the 300-character note that goes with a connection request.

What makes it sound like you is Brand and Voice: your positioning, the topics you want to be known for, the things you never say, and two or three posts you actually wrote.

On safety: it types at a human pace, keeps hourly and daily caps, and stops itself if the platform shows a warning. Automatic sending is off by default.

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

- **Single purpose:** "Write social media comments, message replies and connection notes in the user's own voice."
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
| Deceptive behaviour | Automatic sending is off by default and clearly labelled |
| Unrequested UI | The icon only appears in comment/DM toolbars |

If a reviewer asks for a demo account: describe the bring-your-own-key model — no account exists.
That is normally accepted.

---

## 9. Releases (automated)

Once the item exists (§3), publishing is handled by GitHub Actions — no dashboard upload.

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | every push to `main`, every PR | typecheck, logic tests, extension e2e, builds and uploads the zip |
| `release.yml` | a `v*` tag, or manual dispatch | re-runs `ci.yml`, builds the zip, uploads it to the Chrome Web Store and submits it for review, then creates the GitHub release |

### One-time setup (You)

1. **Chrome Web Store API access.** In the Google Cloud console create (or pick) a project, enable
   the **Chrome Web Store API**, then create a **service account** and a **JSON key**.
2. **Give the service account publishing rights.** In the
   [developer dashboard](https://chrome.google.com/webstore/devconsole), open the publisher settings
   and add the service account email (`…@….iam.gserviceaccount.com`) as a user who can publish the
   item.
3. **Collect the IDs.** The extension ID is in the item's dashboard URL; the publisher ID is on the
   publisher settings page.
4. **Store the values in the repository.** Settings → Secrets and variables → Actions:

   | Kind | Name | Value |
   |---|---|---|
   | Variable | `CWS_EXTENSION_ID` | the 32-character item ID |
   | Variable | `CWS_PUBLISHER_ID` | the publisher ID |
   | Secret | `CWS_SERVICE_ACCOUNT_CLIENT_EMAIL` | `client_email` from the JSON key |
   | Secret | `CWS_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` from the JSON key, **including** the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines and their newlines |

   A private key pasted with literal `\n` escapes fails with `DECODER routines::unsupported`; paste
   it multiline instead.
5. **Create the environment.** Settings → Environments → **New environment** →
   `chrome-web-store`. Add yourself as a required reviewer if you want a manual gate before each
   store upload (recommended for the first few releases).

### Cutting a release

```bash
npm version patch          # or minor / major — bumps package.json and creates the v<version> tag
git push --follow-tags
```

The tag must match `package.json`; the workflow refuses to publish otherwise. Chrome also refuses a
version lower than the published one, so never reuse or rewind a version.

Watch the run under **Actions → Release**. On success you get:

- the zip uploaded to the Chrome Web Store and submitted for review,
- a GitHub release for the tag with the zip attached and generated notes.

### Manual runs

**Actions → Release → Run workflow** lets you:

- **dry_run** — authenticate with the store API and validate the package without uploading.
- **submit_for_review** — uncheck it to upload the package but leave it in the dashboard as a draft.

### Manual fallback (no CI)

1. Bump `version` in `package.json` only.
2. `npm run build && npm run zip`.
3. Dashboard → your item → **Package** → upload the new zip.
4. Add release notes, submit.

Keep the version monotonic: Chrome refuses a lower version than the published one.

---

## 10. Checklist

- [ ] `npm run test:all` green
- [ ] `version` bumped in `package.json` (nowhere else)
- [ ] Working tree clean, tag pushed
- [ ] Screenshots and promo tile uploaded
- [ ] Listing copy pasted
- [ ] Permission justifications pasted
- [ ] Privacy policy URL live
- [ ] Privacy questionnaire completed
- [ ] Visibility and regions set
- [ ] Release run green
