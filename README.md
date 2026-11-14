# SocialMe

**Build your brand on LinkedIn, X and Facebook — replies in your own voice, in one click.**

![SocialMe demo](docs/demo.gif)

Free · open source · no account · your own API key.

---

## What it does

- **✦ in the comment toolbar** — pick a tone (or type an instruction) and the reply streams into the box.
- **✦ in DMs** — reads the thread and answers their last message.
- **✦ when you reply to a comment** — answers that person, not the post, so threads actually continue.
- **Panel** (`⌘⇧A`) — 8 angles, tone, length, quality score, regenerate, history.
- **Connection notes** — the 300-character note on a LinkedIn invite, written from their headline.
- **Brand + persona** — positioning, pillars, proof, voice, banned words. It sounds like you.
- **Account safety** — hourly/daily caps, human typing, pauses on platform warnings.

## Why you want it

| | |
|---|---|
| **10 minutes saved per reply** | Read, tone, done — without lowering the bar |
| **Replies that get replies** | Specific to the post, never "Great post!" |
| **Your account stays safe** | Nothing sends without your click; auto-send is opt-in and capped |
| **Your voice, not AI voice** | Brand rules + anti-AI rules in every prompt |
| **No subscription** | Bring your own key — a reply costs a fraction of a cent |

---

## Install (2 minutes)

1. Download the latest `socialme-<version>-chrome.zip` from [Releases](../../releases) and unzip it somewhere permanent.
2. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select that folder.
3. Click the extension → **Settings** → paste an API key (DeepSeek is the cheapest, ~$0.0002 per reply) → **Test connection**.
4. In **Brand**, fill *Positioning* and *Content pillars*. That is what makes it sound like you.
5. Reload any LinkedIn / X / Facebook tab.

## Use it

- **Comment** on a post → click **✦** → choose a tone → edit if you like → press Comment.
- **Reply to a comment** → click **✦** in that reply box → it answers the commenter, not the post.
- **Open a DM** → click **✦** in the message toolbar → it answers their last message.
- **Send a connection request** → **Add a note** → click **✦** → a 300-character note in your voice.
- **⌘⇧A** opens the full panel for angles, tone, length and the quality score.

Works with OpenAI, DeepSeek, OpenRouter, Gemini, Anthropic, Ollama or any OpenAI-compatible endpoint.

---

## Support

If SocialMe saves you time, you can [buy me a coffee](https://wise.com/pay/business/shahzadahmadltd). I put it
towards charity work — helping people in need with essentials.

Starring the repo helps too, and so does telling me which platform broke first.

## Docs

[Scope](./docs/SCOPE.md) · [Architecture](./ARCHITECTURE.md) · [Contributing](./CONTRIBUTING.md) · [Privacy](./PRIVACY.md) · [Testing](./TESTING.md) · [Publishing](./docs/PUBLISHING.md)

## Development

```bash
npm install
npm run build      # -> dist/chrome-mv3
npm run test:all   # logic + extension e2e + live flow
```

MIT licensed. Not affiliated with LinkedIn, X, Meta or any AI provider.
