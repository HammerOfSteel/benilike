# Benilike — Todo

> Tracked by phase. Move items between sections as work progresses.
> Format: `- [ ] task — notes`

---

## Phase 0 — Scaffold

- [x] Decide on final folder structure — monorepo, `client/` + `server/` + `shared/`
- [x] Initialize Vite + React + TypeScript client (`client/`)
- [x] Install and configure React Three Fiber + Drei (`@react-three/fiber`, `@react-three/drei`, `three`)
- [x] Design + build main menu — roguelike terminal aesthetic, Benifex palette, keyboard nav, R3F background scene, live incident status board
- [ ] Set up Colyseus server (`server/`) — Node.js + TypeScript
- [ ] Connect client to Colyseus room via WebSocket (lobby screen)
- [ ] Render a walkable static 3D office room (proof of concept for Phase 1)
- [ ] Deploy dev environment somewhere shareable (Vercel client / Railway server)
- [ ] Set up `shared/` types package

## Phase 1 — Core Loop

- [ ] Player controller: keyboard movement in 3D space
- [ ] Camera: isometric or third-person follow (decide in brainstorm)
- [ ] Basic collision with office walls/furniture
- [ ] One Workforce role (IT) + one task (fix terminal)
- [ ] One Opposition role (Hacker) + one task (hack terminal)
- [ ] Win condition detection on server
- [ ] Simple HUD: task progress bars, role indicator
- [ ] Lobby: room creation, join by code
- [ ] Player list UI

## Phase 2 — Roles & Factions

- [ ] All Workforce roles implemented (IT, HR, DevOps, Finance, Marketing, Admin, Management)
- [ ] All Opposition roles implemented (Hacker, Social Engineer, Spy, Saboteur, Insider)
- [ ] Role random assignments
- [ ] Role abilities + cooldowns
- [ ] Inter-role dependencies (e.g. Finance must approve before Marketing can run campaign)
- [ ] Faction win conditions balanced
- [ ] Faction briefing screen (shows objectives, hides from other faction)

## Phase 3 — Procedural Generation

- [ ] Research and decide on algorithm (BSP tree vs WFC vs hybrid)
- [ ] Generate room grid with correct department zones (server-side)
- [ ] Place furniture and interactable objects
- [ ] Seed-based determinism (same seed → same map, for replay)
- [ ] Level size parameter (small / medium / large)
- [ ] Spawn points per faction
- [ ] Mini-map generation

## Phase 4 — AI

- [ ] NPC background workers (pathfinding, idle tasks)
- [ ] AI room/desk name generator (flavour text)
- [ ] AI adaptive difficulty (monitor faction performance, tune NPC behaviour)
- [ ] Post-match "company newsletter" AI summary
- [ ] Decide on AI provider / local model (see research.md)

## Phase 5 — Polish

- [ ] Low-poly 3D asset kit (office furniture, computers, desks, meeting rooms)
- [ ] Player character models (one per role, colour-coded by faction)
- [ ] Sound effects (keyboard typing, phone ringing, door beeps)
- [ ] Background ambience (office hum)
- [ ] Animations: walk, interact, ability use
- [ ] Post-processing: subtle bloom, ambient occlusion
- [ ] Match end screen with stats
- [ ] Mobile-friendly controls (stretch goal)

## Backlog / Ideas

- [ ] Spectator mode
- [ ] Replay / highlight reel
- [ ] Custom office skins (Benify-themed, generic corp, startup)
- [ ] Seasonal events (e.g. "All-Hands Meeting" mode)
- [ ] Leaderboard / persistent stats
- [ ] Tutorial / onboarding flow
- [ ] Accessibility: colour-blind mode, keyboard remapping

---

## Completed

<!-- Move items here when done -->
- [x] Write initial project docs (readme, overview, design, research, todo, brainstorm)
- [x] Phase 0: client scaffold — Vite + React + TS, R3F background scene, main menu with full roguelike/Benifex theme
