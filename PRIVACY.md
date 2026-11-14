# Privacy policy

Last updated: 14 November 2026

SocialMe is a browser extension that writes social media replies using an AI model that **you**
choose and pay for. It is local-first: there is no SocialMe server, no account, and no analytics.

## What is stored on your device

Stored in `chrome.storage.local` and never synced:

| Data | Why |
|---|---|
| Your API key(s) | To call the provider you selected |
| Settings, brand notes, personas | To write in your voice |
| Recent drafts and usage counters | History and account-safety limits |
| A per-tab diagnostics record | So a broken selector can be diagnosed |

You can delete all of it at any time: *Settings → Data → Clear history*, or by removing the
extension (which deletes its storage).

## What leaves your device

Only requests to the AI provider **you configured**. A request contains:

- the post or direct-message text you are replying to,
- your persona/brand notes and the tone/instruction you chose for this reply,
- your API key, as the authentication header.

Nothing else. There is no telemetry, no crash reporting, no remote configuration, and no SocialMe
backend. If you use a local model (Ollama), no data leaves your machine at all.

The provider's own privacy policy governs what they do with those requests.

## What the page can see

SocialMe runs in an isolated content script. The web page cannot read your API key, your settings,
or your draft history. It can only see the text that SocialMe types into the editor, exactly as if
you had typed it yourself.

## Permissions we ask for and why

| Permission | Reason |
|---|---|
| `storage` | Save settings, keys, drafts and usage counters locally |
| Host access to `linkedin.com`, `x.com`, `facebook.com` | Show the ✦ icon and read the post you are replying to |
| Host access to provider API domains (`api.openai.com`, `api.deepseek.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `openrouter.ai`, `localhost`) | Make the model request you initiated |

We do not request `tabs`, `history`, `cookies`, or `<all_urls>`.

## Data we never collect

Identity, location, browsing history, contacts, keystrokes, page content beyond the post being
replied to, and any analytics identifiers.

## Children

The extension is not directed at children under 13 and collects no personal data.

## Changes

Material changes to this policy will be noted in the release notes and in this file.

## Contact

Open an issue at <https://github.com/shahzadafridi/socialme/issues>.
