---
name: cinema-room-generator
description: Create or modify CineVerse room presets, seat layouts, slot validation and matching 2D/3D geometry.
---

# CineVerse room generator

Use `packages/shared/src/index.ts` as the layout contract. Read the room-generation section of `virtual_cinema_architecture_ux_spec.md` before changing layout semantics.

- `capacity` counts independently claimable slots; `maxParticipants` limits admitted identities; `groupId` identifies physical furniture. Never substitute one for another.
- A loveseat has at most two slots. For odd capacity, produce one final single seat without silently adding an empty slot beyond capacity.
- Keep stable slot IDs and deterministic positions. Server validation, seat map, collision bounds and 3D renderer consume the same layout.
- Preserve a walkable aisle and an approach point for each seat. When introducing navigation, expose bounds/waypoints in the shared layout rather than reverse-engineering meshes.
- Validate presets and dimensions at the boundary. Do not clamp layouts differently on client and server.
- Verify exact capacity, unique IDs/positions, group size, odd capacities and rendering/selection consistency. Document visual-only presets until their physical furniture differs.
