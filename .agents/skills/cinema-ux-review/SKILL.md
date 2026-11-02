---
name: cinema-ux-review
description: Review CineVerse seating, viewing camera, movie HUD, mobile interaction and media/connection fallbacks.
---

# CineVerse cinema UX review

Review the actual join, seat, watch and leave journey. Use supported host browser tools. Inspect desktop and narrow mobile breakpoints when changing layout.

- Keep movie controls, mic state, connection status and exit discoverable. Explain restricted host controls without implying a broken player.
- Distinguish a 3D seat-map preview from a complete explorable theater. Do not label static placement as walking/navigation.
- Camera transitions retain an immediate 2D focus escape and respect reduced motion. Avoid forced shaking or long travel before playback.
- Keep touch targets usable and the screen unobstructed. Collapsed controls return with touch, pointer or keyboard and preserve focus.
- Check loading, denied mic, blocked autoplay, invalid movie URL, reconnect and unsupported WebGL. Explain the next action in Vietnamese.
- Account restoration and saving must be observable. Never show fake online users/history or successful-save messages before persistence succeeds.
- Report verified behavior separately from unfinished navigation, spatial audio, TURN/network testing and asset polish.
