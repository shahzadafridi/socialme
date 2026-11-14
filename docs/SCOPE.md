# Scope

SocialMe does one job: help you write replies that start real conversations, on the platforms you
already use. This page records what is in scope, what is deliberately out, and where the feature set
came from.

---

## In scope

| Surface | What it does |
|---|---|
| Comment under a post | Reads the post (author, headline, text, counts) and writes one comment in your voice |
| Reply to a comment | Reads the comment you are answering and replies to that person, not the post |
| Direct message | Reads the last 1, 3 or 12 messages and answers the most recent one |
| LinkedIn connection note | Writes the 300-character note attached to an invitation, from their name and headline |
| Voice | Persona + brand rules: positioning, pillars, proof, POV, banned words, samples |
| Guardrails | Quality score, cliché/banned-opener detection, hourly and daily caps, human typing, warning pause |

Every draft lands in the platform's own editor. Sending stays manual by default.

---

## Out of scope (for now)

| Not doing | Why |
|---|---|
| Original posts, carousels, repurposing | Different product; the engagement loop is the point here |
| Scheduling and content calendars | Requires a backend or a queue, and does not improve replies |
| Bulk/auto-commenting, auto-connect, auto-DM | The fastest path to a restricted account, and it produces the AI-slop comments readers block |
| Engagement pods or lists of strangers to comment on | Inflates reach without conversations |
| Analytics dashboards | Interesting later; the platform already shows the counts that matter now |

The post/repurpose tabs that shipped in 0.5 were removed in 0.6. Older drafts of those kinds are
dropped when history is read, so the panel never offers text it cannot insert.

---

## What we borrowed, and from where

The comment-tool market was surveyed in November 2026 (Engage AI, Commenter.ai, Supergrow Engage,
Taplio, LinkAssist, AuthoredUp, MagicPost). The useful parts:

| Feature seen elsewhere | Adopted as | Notes |
|---|---|---|
| Inline comment drafts in the feed (Engage AI, Commenter.ai) | The ✦ button in every comment box | Kept manual: no queue, no automation |
| Tone presets per draft (Engage AI) | Tone menu + 8 angles in the panel | Angles are comment-specific (pushback, question, tip…) |
| Voice/persona training (Supergrow "Content DNA", LinkAssist "User DNA") | Persona + Brand tabs and writing samples | Local only, no account or upload |
| Keyboard-first commenting (Supergrow Focus Mode) | `⌘⇧A` panel and one-click ✦ | No list of targets, no bulk pass |
| Reply-to-comment context | `readCommentBeingRepliedTo()` + a dedicated prompt block | The differentiator for threads: answer the person, not the post |
| Connection-request notes (several outreach tools) | LinkedIn invite-note detection and prompt | 300-character cap enforced in code and prompt |
| Draft quality feedback (AuthoredUp readability, others) | Local quality score and cliché flags | Cheap heuristics, no extra API call |

Deliberately rejected: anything that sends without a human click, follows/likes in bulk, scrapes
profiles, or comments on a schedule. Those are the features that get accounts restricted — and they
are exactly what the "AI slop" detection on LinkedIn is trained to catch.

---

## Next candidates

Ordered by how much they improve a real conversation per unit of risk:

1. **First message after connecting** — after an invitation is accepted, draft the opening message
   from the person's headline and the note that was sent.
2. **Reply variants** — two or three short alternatives for the same comment, so choosing is faster
   than regenerating.
3. **Conversation inbox for your own posts** — collect new comments on posts you wrote and reply
   from one place (still one send per click).
4. **Thread summariser** — when a comment thread is long, condense the last N comments before
   drafting, so the reply answers the current point rather than the original post.
