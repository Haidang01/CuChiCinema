---
name: watch-party-sync
description: Implement or review CineVerse video timeline revisions, host control, clock offset, drift correction and late joining.
---

# CineVerse watch-party timeline

Use the shared playback contract and server state as truth. HTTP delivers video; Socket.io carries timeline/control; WebRTC carries voice.

- Anchor position in seconds to a server timestamp in milliseconds, playing flag, source and monotonic revision. Advance only while playing.
- Verify host rights for every command. Reject non-finite/out-of-range positions and non-HTTP(S) sources. A source change starts a new watch session.
- Estimate clock offset from server time and midpoint RTT. Ignore older revisions. Join/reconnect obtains a fresh sample and snapshot.
- Correct small drift with bounded playback rate and large drift with seek. Wait for metadata, bound seeks by duration and reset rate on pause/unmount.
- Autoplay unlock, buffering and volume are local concerns. Remote state changes must not echo commands. Pause locally while disconnected until a fresh snapshot arrives.
- Keep HTML video fallback for WebGL/CORS failure. Do not assume streaming-platform URLs are playable or bypass DRM/CORS.
- Persist progress at modest intervals and explicit checkpoints. Test pause stability, ordering, unauthorized control, late join and reconnect. Test actual media separately from pure timeline logic.
