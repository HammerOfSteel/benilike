# Benilike — Todo

> Tracked by phase. Move items between sections as work progresses.
> Format: `- [ ] task — notes`

---

## Phase 1 — Core Loop ✅ Done

- [x] Set up Colyseus server (`server/`) — Node.js + TypeScript
- [x] Connect client to Colyseus room via WebSocket
- [x] Player controller: WASD movement in 3D space
- [x] Camera: isometric follow camera (fixed-angle, follows local player)
- [x] Spawn bots — configurable count (0–9), server-side AI movement
- [x] Role random assignment (Workforce vs Opposition, per-role label)
- [x] One Workforce role (IT) + terminal repair task (hold E)
- [x] One Opposition role (Hacker) + terminal hack task (hold E)
- [x] Win condition detection on server (terminalProgress 0/100)
- [x] Simple HUD: task progress bar, role indicator, objectives panel
- [x] Lobby: room creation, join by code, bot count slider
- [x] Player list UI
- [x] Win / lose end-game overlay
- [x] Deploy client to Vercel (https://benilike.vercel.app)
- [x] Shared `@shared/types` package

## Phase 2 — Roles & Abilities 🔄 Next

- [ ] **Role ability system** — each role has one active ability (E outside interact zone triggers it, or separate key like Q)
- [ ] **Workforce roles** — unique abilities that support the team (see Role Design below)
- [ ] **Opposition roles** — unique abilities that hinder Workforce (see Role Design below)
- [ ] Ability cooldowns (per-role timers, shown in HUD)
- [ ] Ability effects broadcast from server (authoritative)
- [ ] Faction briefing screen — full-screen role reveal before game starts, hides from other faction
- [ ] Inter-role synergy — abilities that interact across roles (e.g. Spy marks a player → Hacker gets speed boost near them)
- [ ] Faction win condition tuning — balance task tick rates based on player counts

## Phase 3 — Map & Exploration

- [ ] Multiple terminal locations per map (randomised, only one active per round)
- [ ] Locked rooms — Admin can unlock, Opposition must find another way in
- [ ] Basic collision with office furniture (currently walls only)
- [ ] Procedural room generation — BSP or WFC, server-side, seed-based
- [ ] Department zones (server room, HR, finance floor, exec suite)
- [ ] Spawn points per faction (separated start positions)
- [ ] Mini-map (fog of war, reveals explored areas)

## Phase 4 — AI & NPCs

- [ ] NPC background workers (idle at desks, walk between rooms)
- [ ] AI room/desk name generator (flavour text)
- [ ] Post-match "company newsletter" AI summary
- [ ] AI adaptive difficulty

## Phase 5 — Polish

- [ ] Low-poly 3D asset kit (replace box geometry)
- [ ] Player character models (one per role, colour-coded)
- [ ] Sound effects & ambience
- [ ] Walk / interact animations
- [ ] Post-processing: bloom, ambient occlusion
- [ ] Mobile controls (stretch goal)

## Backlog / Ideas

- [ ] Spectator mode
- [ ] Replay / highlight reel
- [ ] Custom office skins
- [ ] Leaderboard / persistent stats
- [ ] Tutorial / onboarding flow
- [ ] Accessibility: colour-blind mode, keyboard remapping

---

## Role Design — Phase 2 Target

### Workforce (Defenders — push terminal to 100%)

| Role | Ability | Synergises with |
|---|---|---|
| **IT Technician** | Passive: fastest repair rate. Active: *Emergency Patch* — burst +20 terminal progress instantly (60s CD) | DevOps (speed boost stacks) |
| **DevOps Engineer** | *Deploy Hotfix* — doubles repair speed for all Workforce at terminal for 8s (45s CD) | IT (multiplies their rate) |
| **HR Officer** | *Background Check* — pings nearest Opposition player's position to all Workforce for 5s (30s CD) | Spy counter; helps Management |
| **Finance Analyst** | *Budget Freeze* — temporarily halves Opposition ability cooldown recovery (slows their kit) for 10s (50s CD) | Counters Saboteur and Hacker burst |
| **Marketing** | *Spin Campaign* — sends a fake "all-clear" that causes Opposition minimap/ping to show wrong terminal location for 8s (40s CD) | Confuses Spy intel |
| **Admin** | *Access Lockdown* — locks the server room entrance for 12s — Opposition must find alternate path (60s CD) | Buys time for IT/DevOps |
| **Management** | *Sprint Initiative* — grants all Workforce a 30% movement speed boost for 10s (50s CD) | Lets HR reposition, lets IT escape |

### Opposition (Attackers — drain terminal to 0%)

| Role | Ability | Synergises with |
|---|---|---|
| **Hacker** | Passive: fastest hack rate. Active: *Zero-Day Exploit* — burst -20 terminal progress instantly (60s CD) | Saboteur (pre-planted trap amplifies burst) |
| **Social Engineer** | *Disguise* — appears as Workforce (blue) on other players' screens for 15s (45s CD) | Lets them walk past HR pings undetected |
| **Spy** | *Surveillance Sweep* — reveals all Workforce positions briefly (3s) to whole Opposition team (35s CD) | Hacker knows when IT is away from terminal |
| **Saboteur** | *Plant Trap* — places a device at terminal that reverses Workforce repair direction for 6s when triggered (50s CD) | Hacker uses it as setup for Zero-Day |
| **Insider Threat** | *Badge Access* — appears as Workforce permanently until ability used; unlocks locked rooms (Admin lockdown bypassed) (once per match) | Counters Admin lockdown hard |

---

## Completed

- [x] Write initial project docs (readme, overview, design, research, todo, brainstorm)
- [x] Phase 0: client scaffold — Vite + React + TS, R3F background scene, main menu
- [x] Phase 1: full core game loop (see Phase 1 section above)
- [x] Phase 1: win/lose overlay, role objectives panel, expanded server room map
