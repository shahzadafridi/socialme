# Test coverage

Three layers, each answering a different question.

| Layer | Command | Question it answers |
|---|---|---|
| Logic | `npm run test:logic` | Does the prompt contain the right rules? Does the scoring work? |
| Provider contract | part of `test:logic` | Are the API requests correct for every provider shape? |
| Extension e2e | `npm run test:e2e` | Does the built MV3 extension load, persist settings, and render its pages? |
| **Live flow** | `npm run test:live` | **Does the real content script work on a real feed?** |
| Manual | — | Real LinkedIn/X/Facebook markup and a real API key |

---

## What `npm run test:live` does

It launches a throwaway Brave/Chromium with the built extension and serves **local replicas of all
three feeds** on their real hostnames using `--host-resolver-rules`:

```
https://www.linkedin.com:<port>/mock/linkedin
https://x.com:<port>/mock/x
https://www.facebook.com:<port>/mock/facebook
```

Because the hostname matches, the **real content script attaches** — the same bundle that ships.
A second server implements an OpenAI-compatible streaming endpoint, so generation, the shadow-DOM
panel and the insert/submit pipeline all run for real.

### Matrix

| Area | Case | what is asserted |
|---|---|---|
| Mount | content script attaches | `#socialme-shadow-host`, launcher reads "SocialMe" |
| Mount | action row injection | `[data-socialme-btn]` exists **inside** the post's action row, correct label per platform |
| Panel | open from inline button | panel renders author, post text and the reply mode |
| Panel | generation | draft equals the model's streamed text, character for character |
| Panel | prompt | the request contains the hard rules and the brand objective ("click my profile") |
| Panel | insert | draft lands in the platform editor (`.ql-editor`, `tweetTextarea`, FB textbox) |
| Panel | insert & send | the platform's own send button fires, the draft is recorded, panel says "Sent" |
| Composer ✦ | mount | `.socialme-quick` appears in the comment box toolbar after it opens (inline, not floating) |
| Composer ✦ | fill | clicking it streams the draft straight into that box, state ends on ✓ |
| Reply to a comment | context | the prompt carries the comment being answered, not just the post |
| Connection note | note | the icon appears in the LinkedIn invite note, the prompt carries the recipient and the 300-character cap |
| Inbox ✦ | mount + fill | the icon appears in a DM composer and writes a reply into it (prompt uses the DM rules) |
| Inbox ✦ | transcript | prompt contains the real last message, `me:`/`them:` labels, no composer labels, no date/presence chrome |
| Inbox ✦ | context mode | with **Last message** selected, only the final message reaches the prompt |
| Unpacked | diagnostics | per-tab scan record: what the adapters matched, the transcript they built, and any boot error |
| Safety | daily cap | with the cap reached, "Insert & send" is refused with a limit message, nothing is sent |
| Safety | warning banner | an injected "temporarily restricted" alert shows in the panel and disables sending |
| Errors | 401 | the panel shows the provider error and the "Open settings" link |

Every case runs on **all three platforms** unless the section says otherwise (safety and error cases
run on LinkedIn, since they are platform-independent).

### Interactive variants

The same flows are available in the preview harness without an extension build:

```
npm run preview
```

- `?view=insert` — editor insertion strategies against real DOM
- `?view=composer` — the in-composer button end to end
- `?view=composer-demo` — visual check of the button placement
- `?view=panel`, `?view=options`, `?view=brand`, `?view=safety`, `?view=popup`

---

## What is **not** automated, and why

| Gap | Reason | How to check by hand |
|---|---|---|
| The real LinkedIn/X/Facebook DOM | Needs logged-in accounts. The LinkedIn fixture mirrors the 2026 DOM (`[role="listitem"]` + ARIA labels, hashed classes), so it exercises the same code path as production | Open a feed, confirm ✦ appears, click it, confirm the draft lands |
| Selector drift after a redesign | Cannot be predicted | Options → Data → **Last page scan** shows what the extension actually sees: post count, action rows, the real class chain, and a text sample |
| A real model response | Needs your API key and spends your credit | Settings → Test connection, then generate one draft |
| Rate-limit / captcha flows | Cannot be produced without a real throttled account | If it happens, the banner should appear and posting should disable |
| Auto-send against a live account | Irreversible and against the platforms' terms | Leave it off, or test on a throwaway account |

If a selector ever misses, the fix is the selector array in `lib/platform/<network>.ts`; the test
fixtures are in `scripts/livetest-server.mjs`, so adding a regression case is a matter of copying the
real markup into the fixture.
