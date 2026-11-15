# SocialMe product walkthrough

A 104-second animated explainer in 1920×1080 and 1080×1920. The interfaces are simplified illustrations based on the implemented extension, with fictional conversations. This is a feature overview, not footage of a live browser test. No accounts, API keys or private messages are included.

The film covers provider/model selection, identity and authored examples, brand context, rough thoughts, draft refinement, review and Undo, explicit voice feedback and example approval, engagement sessions, bookmarks and local follow-ups, message replies, connection notes, platform pause, limits, diagnostics and backup. It makes no reach or growth claims.

Narrator: Daniel — Instructional Narrator, generated with ElevenLabs. The quiet electronic music is synthesized by `build.py`; there is no third-party music recording. Captions are aligned from the selected narration take. An MP4 cannot contain clickable UI; the cursor and controls are animated.

## Rebuild on macOS

Requires Swift/AppKit, Python 3 and ffmpeg/ffprobe. The source archive provides `narration.mp3`, `narration.txt`, `words.json` and `public/icon/96.png`. Run from the source archive root (or this repository, supplying those narration assets in WORK_DIR):

```sh
mkdir -p WORK_DIR/scenes
swift -module-cache-path /tmp/socialme-swift-cache scripts/product-video/render.swift WORK_DIR/scenes
python3 scripts/product-video/build.py WORK_DIR OUTPUT_DIR
```

To change the narration, supply matching word timestamps and adjust scene boundaries in `build.py`. To change the illustrated UI or copy, edit `render.swift`. Public model IDs shown in the film are illustrative; the extension loads actual catalogues from each provider.

A short vertical cut can be rebuilt from the finished vertical film:

```sh
python3 scripts/product-video/teaser.py OUTPUT_DIR/SocialMe-Product-Walkthrough-Vertical.mp4 OUTPUT_DIR/SocialMe-Social-Teaser-Vertical.mp4
```
