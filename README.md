# Tanmaysarkar2002.github.io

A hand-drawn detour sign that points visitors to my portfolio, **[tanmaysarkar.dev](https://tanmaysarkar.dev)** ([source](https://github.com/Tanmaysarkar2002/Tanmay_potfolio)).

The page shows the animated rider from my profile README, then kick-starts the ride after 8 seconds. Visitors can follow the links or "park" to stop the countdown. `404.html` is the same page, so old deep links land here too.

## `video/` — a chat with Claude, made entirely in code

`video/index.html` draws a short vertical (1080×1920) chat between me and Claude. Open it in a browser to watch it play, or render it to an MP4 for Reels/Shorts:

```sh
npm i playwright && npx playwright install chromium   # once
node video/render.js                                  # -> video/claude-chat.mp4 (needs ffmpeg)
```

To make a new video, edit the `SCRIPT` array at the top of the `<script>` in `video/index.html` and render again. The typing, keyboard clicks and pop sounds are all generated from the script.
