# CineVerse

Private virtual cinema for 2–3 people with persistent game-like characters. Requirements: `virtual_cinema_architecture_ux_spec.md`. Current implementation is a local prototype; do not describe planned features as complete.

## Repository and commands

- `apps/web`: React/Vite, Three.js via React Three Fiber. Lazy-load 3D and room modules.
- `apps/server`: Express, Socket.io, PostgreSQL via Prisma. Listen on loopback by default.
- `packages/shared`: payload schemas, event contracts, deterministic layouts.
- `prisma`: schema and versioned migrations. Keep migrations additive for existing data.
- `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.
- Primary target: mobile phones. Verify portrait/touch usability before desktop polish. `npm run dev:lan` exposes only the Vite web port on LAN with explicit detected origins; API/DB stay loopback. HTTPS/certificate and Windows firewall setup: `docs/mobile-lan.md`.
- `npm run db:generate`, `npm run db:setup`. Database URL is server-only in ignored `.env`.
- `npm run test:integration`: runner forces the separate local `cineverse_test` database, applies migrations/seeds and creates disposable QA users/rooms. Cleanup removes only generated IDs in that database. Never point integration mutations at the application database.

## Task-specific skills

Read relevant skills before changing the corresponding subsystem; do not load the whole catalog.

- `.agents/skills/frontend-design/SKILL.md`: new interface composition.
- `.agents/skills/react-best-practices/SKILL.md`: React performance; apply SPA-relevant rules.
- `.agents/skills/web-design-guidelines/SKILL.md`: UI accessibility/interaction review.
- `.agents/skills/cinema-room-generator/SKILL.md`: layout, seat groups and slots.
- `.agents/skills/multiplayer-sync/SKILL.md`: authoritative room state, sessions and reconnect.
- `.agents/skills/watch-party-sync/SKILL.md`: video timeline and client drift correction.
- `.agents/skills/cinema-ux-review/SKILL.md`: room camera, HUD and mobile review.
- Imported Three.js skills: choose only the relevant topic from `.agents/skills/`.
- Imported Playwright guidance is available for compatible environments. This host requires browser interactions through `cua_repl`; do not launch a separate browser automation channel to bypass that requirement.

## Invariants

Server owns host rights, seat allocation, inventory ownership and playback revision. Clients send requests. Separate `capacity`, `maxParticipants`, seat groups and seat slots. User/session identity must survive socket replacement. PostgreSQL persists characters/configuration/history; transient movement stays in memory. Video travels over HTTP, voice over WebRTC. Never commit `.env`, database dumps, session cookies or invite secrets. Preserve Vietnamese UI text and maintain a usable 2D fallback.
