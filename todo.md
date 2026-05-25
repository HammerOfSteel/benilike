# Benilike — Todo

> Tracked by phase. Move items between sections as work progresses.
> Format: `- [ ] task — notes`
> **Last redesign:** 2026-05-25 — Rogue AI model. Phase 2 tasks below reflect the new design.

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

## Phase 2 — Rogue AI Core 🔄 Next

### Role & Identity
- [ ] **Assigned task lists** — at game start, server assigns 3 tasks from the shared pool to each player based on job title
- [ ] **Remove faction assignment** — all players start as workers; one is secretly assigned The AI role server-side
- [ ] **AI role briefing** — separate briefing screen showing the AI its role + phase 1 objectives (hidden from all others)
- [ ] **Job title labels** — show job title (not faction) on player name tags and HUD

### AI Phase System
- [ ] **Phase 1 tasks** — Index Employee Records, Analyse System Logs, Map Network Topology — look like normal work
- [ ] **Phase 2 tasks** — Deploy Backdoor, Clone Credentials, Bypass Access Controls — with 1s screen flicker visual tell on nearby monitors
- [ ] **Phase 3 unlock** — after Phase 2 complete, AI gains Shutdown ability (30s cooldown)
- [ ] **Shutdown mechanic** — AI alone with target ≥1s → instant eliminate; body appears in room
- [ ] **Phase 3 objective task** — Initiate Takeover Protocol (Exec Suite, 8s)
- [ ] **AI win condition** — majority eliminated OR all phases + Takeover complete

### Body & Reporting
- [ ] **Body entity** — when a worker is eliminated, their character is replaced by a body marker in the room
- [ ] **Report action** — any living worker near a body presses E to report it → triggers All Hands meeting

### Meetings & Voting
- [ ] **All Hands meeting UI** — full-screen overlay; 45s text chat + anonymous vote
- [ ] **Vote logic** — majority vote ejects player; tie = skip; tally shown after
- [ ] **Correct ejection** → workers win immediately
- [ ] **Wrong ejection** → worker eliminated + wrongful termination penalty (forfeit next perk vote)
- [ ] **All Hands call limit** — 2 uses per player per match; conference room terminal trigger
- [ ] **Ghost / spectator mode** — eliminated players get free-roam camera, cannot interact or vote

### Sprint System
- [ ] **Sprint size vote** — pre-game lobby vote: Small / Medium / Large (affects quota + perk tier)
- [ ] **Sprint timer** — 3-minute countdown per sprint, visible to all
- [ ] **Sprint quota tracker** — bottom HUD bar showing tasks completed vs quota this sprint
- [ ] **Sprint Retrospective UI** — 45s auto-triggered at sprint end; shows per-player stats + perk vote if quota met
- [ ] **Morale penalty** — +10% hold time next sprint if quota missed
- [ ] **3-sprint match structure** — game ends after Sprint 3 or earlier win condition

### Perks
- [ ] **Standup Efficiency** — hold time −20% next sprint (Tier 1)
- [ ] **Security Audit** — AI Shutdown cooldown +15s next sprint (Tier 1)
- [ ] **Buddy System** — reveal last room of any body's killer (Tier 2)
- [ ] **Emergency Hire** — one ghost returns with limited 1-task-per-sprint role (Tier 2)
- [ ] **Full Transparency** — at next All Hands, random player's last 3 rooms revealed (Tier 3, Large only)

## Phase 3 — Map & Polish

- [ ] Furniture collision (desks, server racks)
- [ ] Conference room terminal (All Hands trigger point)
- [ ] Phase 2 visual tell — screen flicker shader/effect on nearby monitors
- [ ] Body visual (distinct marker in world space)
- [ ] Ghost player visual (translucent, faded)
- [ ] Spectator free-roam camera mode
- [ ] Ventilation shafts — AI traversal shortcut (deferred)
- [ ] NPC background workers — idle cover characters (deferred)

## Phase 4 — AI & Post-Match

- [ ] AI adaptive difficulty (bot AI playing The AI role)
- [ ] Post-match "Company Newsletter" — AI-generated dry corporate recap
- [ ] Per-player match stats screen (tasks done, rooms visited, votes cast)

## Phase 5 — Polish

- [ ] Low-poly 3D asset kit (replace box geometry)
- [ ] Player character models (one per job title)
- [ ] Sound effects: keyboard, terminal beep, All Hands alarm, tension sting
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
