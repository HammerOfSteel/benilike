# Benilike — Todo

> Tracked by phase. Move items between sections as work progresses.
> Format: `- [ ] task — notes`
> **Last redesign:** 2026-05-25 — Rogue AI model. Phase 2 tasks below reflect the new design.
> **Last updated:** 2026-05-26

---

## Phase 1 — Core Loop ✅ Done

- [x] Set up Colyseus server (`server/`) — Node.js + TypeScript
- [x] Connect client to Colyseus room via WebSocket
- [x] Player controller: WASD movement in 3D space
- [x] Camera: isometric follow camera (fixed-angle, follows local player)
- [x] Spawn bots — configurable count (0–9), server-side AI movement
- [x] Role random assignment (per-role label, briefing screen)
- [x] Hold-E interaction at workstations
- [x] Win condition detection on server
- [x] Simple HUD: task progress bar, role indicator, objectives panel
- [x] Lobby: room creation, join by code, bot count slider
- [x] Player list UI
- [x] Win / lose end-game overlay
- [x] Deploy client to Vercel (https://benilike.vercel.app)
- [x] Shared `@shared/types` package
- [x] Minimap (canvas RAF loop, rooms + players)
- [x] Bot AI: nearest-station targeting, 500ms tick

## Phase 2 — Rogue AI Core ✅ Done (core loop implemented)

### Role & Identity
- [x] **Assigned task lists** — server assigns tasks per-bot based on role at game start
- [x] **AI role (Rogue AI)** — one bot secretly assigned; has its own AI_TASK_DEFS (sabotage tasks)
- [x] **AI role briefing** — revealed to spectator via `ai_revealed` message
- [x] **Spectator mode** — full spectator view with player list, follow camera, chat feed, vote indicators

### Bot AI
- [x] **A* pathfinding** — custom implementation on existing grid, 8-directional with no-corner-cutting rule
- [x] **Among Us-style spawn** — all bots spawn at `startX/startZ` (main_office center), fan out with delays
- [x] **Bot-triggered meetings** — paranoid/conspiracy/methodical bots call all-hands 60–110s into sprint
- [x] **Retro banter** — bots discuss sprint stats (MVP, slacker) during 45s retro window
- [x] **Inter-bot dialogue** — `{other}` template variable; bots reference each other by name in banter
- [x] **Bot personality banter** — corporate_drone, paranoid, gossip, and others have unique voice lines

### Meetings & Voting
- [x] **All Hands meeting** — triggered by bots or human report; 45s timeout
- [x] **Named votes** — `namedVotes` object in `vote_result`
- [x] **Vote indicator animation** — R3F Billboard component with fade-in/hold/fade-out per vote
- [x] **Vote phase transition** — switches to voting phase on first `vote_cast`

### UI & Spectator
- [x] **Spectator chat** — side panel + bottom feed, correct padding/position
- [x] **Game-end overlay** — shows winner, reason, "BACK TO MENU" button

## Phase 3 — Assets & Visual Polish 🔄 Next

### Asset Integration (assets available in `/assets_from_itch/`)
- [ ] **Extract & convert assets** — unzip VNB Office Sets, convert FBX → GLTF/GLB via Blender or `fbx2gltf`
  - `VNB Low Poly Office Set V1.1.0.zip` — desks, chairs, monitors, server racks, etc.
  - `VNB Low Poly Office Set 2 (2025.06.27-1).zip` — lamps, book piles, extra furniture
  - `_VoxelCharacters.zip` — voxel character OBJ+PNG (Char01–Char04)
  - `allpeople.zip` — low-poly human OBJ+PNG (human.001–human.004)
- [ ] **Player character models** — replace capsule geometry with character models from `allpeople` or `_VoxelCharacters`
- [ ] **Office furniture models** — replace box geometry for desks, monitors, server racks with VNB Office Set pieces
- [ ] **Workstation visual** — distinct model for interactive task stations (computer terminal)
- [ ] **Body visual** — distinct marker in world space when a worker is eliminated
- [ ] **Ghost player visual** — translucent/faded appearance for eliminated spectators

### Map & Environment
- [ ] Furniture collision (desks, server racks block movement)
- [ ] Conference room terminal (All Hands trigger point in world)
- [ ] Phase 2 visual tell — screen flicker shader/effect on nearby monitors during AI sabotage tasks

### Audio
- [ ] Sound effects: keyboard click, terminal beep, All Hands alarm, tension sting

## Phase 4 — Game Mechanics & Sprint System

- [ ] **Sprint size vote** — pre-game lobby: Small / Medium / Large (affects quota + perk tier)
- [ ] **Sprint quota tracker** — bottom HUD bar showing tasks completed vs quota
- [ ] **Morale penalty** — +10% hold time next sprint if quota missed
- [ ] **3-sprint match structure** — game ends after Sprint 3 or earlier win condition
- [ ] **Perks vote** — Standup Efficiency, Security Audit, Buddy System, Emergency Hire, Full Transparency

## Phase 5 — AI Elimination & Bodies

- [ ] **Shutdown mechanic** — Rogue AI alone with target ≥1s → instant eliminate; body appears
- [ ] **Body entity** — body marker replaces character in room
- [ ] **Report action** — worker near body presses E → triggers All Hands
- [ ] **Correct ejection** → workers win immediately
- [ ] **Wrong ejection** → worker eliminated + penalty
- [ ] **All Hands call limit** — 2 uses per player; conference room terminal trigger

## Phase 6 — Post-Match & Meta

- [ ] AI adaptive difficulty (bot playing Rogue AI role)
- [ ] Post-match "Company Newsletter" — AI-generated dry corporate recap
- [ ] Per-player match stats screen (tasks done, rooms visited, votes cast)
- [ ] Replay / highlight reel

## Phase 7 — Polish & Stretch Goals

- [ ] Post-processing: bloom, ambient occlusion
- [ ] Walk / interact animations
- [ ] Mobile controls (stretch goal)
- [ ] Ventilation shafts — AI traversal shortcut (deferred)
- [ ] NPC background workers — idle cover characters (deferred)
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
- [x] Phase 2: Rogue AI role, AI task stations, bot A* pathfinding, Among Us-style spawn
- [x] Phase 2: bot-triggered meetings, retro banter, inter-bot dialogue, vote animations
- [x] Phase 2: spectator mode, game-end overlay, vote indicator fade, chat feed
