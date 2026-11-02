---
name: multiplayer-sync
description: Implement or review CineVerse Socket.io membership, atomic seat claims, authorization, host transfer and reconnect recovery.
---

# CineVerse multiplayer

Read shared event types, `apps/server/src/room-state.ts` and `realtime.ts` before changing events.

- Authenticate sessions at connection and invalidate actions after logout/expiry. Socket IDs are transport IDs; use user/session identity for occupancy.
- Serialize room mutations, including operations that await database work. Competing claims must have one winner. Failed switches preserve the old seat; successful switches release it atomically.
- Check invite permission and limits on the server. Replacing a socket must not let its delayed disconnect release the new connection's state.
- Reconnect keeps a seat for the configured grace period (currently 30 seconds). Cancel stale cleanup timers, send a fresh snapshot and rebuild voice connections.
- Define host transfer and empty-room cleanup. Disclose server-restart behavior when room state is in memory.
- Validate payloads, cap signaling size/rate and forward voice signals only within the joined room.
- Test competing claims, cross-room signaling rejection, unauthorized actions, replacement sockets and short disconnect recovery.
