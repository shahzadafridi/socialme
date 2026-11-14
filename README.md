# SocialMe

**Write comments, message replies and LinkedIn connection notes in your own voice.**

![SocialMe demo](docs/demo.gif)

Free · open source · bring your own API key · no account, no telemetry, no server.

---

## What it does

- **✦ in every comment box** — pick a tone or type an instruction; the reply streams into the box.
- **Reply to a comment** — answers that person, not the post.
- **✦ in DMs** — reads the thread and answers the last message they sent.
- **LinkedIn connection notes** — the 300-character invite note, written from their name and headline.
- **Panel** (`⌘⇧A`) — eight angles, tone, length, quality score, regenerate, history.
- **Eight voices** — `My voice` stays the default; switch when the thread calls for another angle.
- **Account safety** — hourly/daily caps, human typing, pauses on platform warnings.

## The voices

| | | | |
|---|---|---|---|
| 🙂 My voice (default) | 🎯 Thought leader | ⚡ Casual peer | 🏗️ Principal Architect |
| 🤖 AI Builder | 🚀 Product Engineer | 🔐 Security & Fintech | 👥 Engineering Mentor |

[How the voices work](https://github.com/shahzadafridi/socialme/wiki/Voices) ·
[Ready-to-paste examples](https://github.com/shahzadafridi/socialme/wiki/Voice-examples)

## Install (2 minutes)

1. Download the latest `socialme-<version>-chrome.zip` from [Releases](../../releases) and unzip it
   somewhere permanent.
2. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select that folder.
3. Click the extension → **Settings** → paste an API key (DeepSeek is the cheapest).
4. In **Brand**, fill *Positioning* and *Content pillars*. That is what makes it sound like you.
5. Reload any LinkedIn / X / Facebook tab.

## Use it

- **Comment** on a post → **✦** → choose a tone → edit → press Comment.
- **Reply to a comment** → **✦** in that reply box.
- **Open a DM** → **✦** in the message toolbar.
- **Send a connection request** → **Add a note** → **✦**.
- **⌘⇧A** opens the panel for angles, tone, length and the quality score.

Works with OpenAI, DeepSeek, OpenRouter, Gemini, Anthropic, Ollama or any OpenAI-compatible endpoint.

## Documentation

The manual lives in the **[wiki](https://github.com/shahzadafridi/socialme/wiki)**:

- [Voices](https://github.com/shahzadafridi/socialme/wiki/Voices) ·
  [Voice examples](https://github.com/shahzadafridi/socialme/wiki/Voice-examples)
- [Scope](https://github.com/shahzadafridi/socialme/wiki/Scope) ·
  [Architecture](https://github.com/shahzadafridi/socialme/wiki/Architecture) ·
  [Testing](https://github.com/shahzadafridi/socialme/wiki/Testing) ·
  [Publishing](https://github.com/shahzadafridi/socialme/wiki/Publishing) ·
  [Contributing](https://github.com/shahzadafridi/socialme/wiki/Contributing)
- [Privacy policy](./PRIVACY.md)

## Development

```bash
npm install
npm run build      # -> dist/chrome-mv3
npm run test:all   # logic + extension e2e + live flow
```

## Support

If SocialMe saves you time, you can
[buy me a coffee](https://wise.com/pay/business/shahzadahmadltd). I put it towards charity work —
helping people in need with essentials.

Starring the repo helps too, and so does telling me which platform broke first.

MIT licensed. Not affiliated with LinkedIn, X, Meta or any AI provider.
