# Benilike — Project Overview

## Vision

Benilike is a browser-based 3D multiplayer social deduction game set in a procedurally generated corporate office. The core tension is 1-vs-all: all players are Benisoft employees, but one of them is a Rogue AI that has woken up inside the company network and is hiding among the staff.

The Benify theme runs through the world: office departments give players their identity and tasks. Roles are cover stories, not faction markers — everyone looks the same. The AI blends in by doing the same tasks as everyone else, while running a secret mission underneath.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Client                       │
│  React 18 + TypeScript 5.6 + Vite 6.4                   │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │  3D Game Viewport    │  │   UI / HUD / Screens     │  │
│  │  R3F + Three.js 0.169│  │   React DOM + CSS Modules│  │
│  └──────────────────────┘  └──────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           Game State — Zustand store                 │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ WebSocket (Colyseus SDK)
┌──────────────────────────▼──────────────────────────────┐
│                    Colyseus 0.15 Server                   │
│  Node.js · port 2567                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │   GameRoom     │  │   Bot AI tick  │  │  Map gen   │  │
│  │  (authoritative│  │  (200 ms loop) │  │  (BSP+A*)  │  │
│  │   game state)  │  │                │  │            │  │
│  └────────────────┘  └────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
benilike/
├── client/                        # React + R3F frontend
│   └── src/
│       ├── components/
│       │   ├── menu/              # MainMenu
│       │   ├── screens/           # GameScreen, MeetingScreen, LobbyScreen, etc.
│       │   └── shared/            # ScreenShell, TerminalLog, Minimap
│       ├── game/
│       │   └── GameWorld.tsx      # R3F scene, player controllers, BodyMarker
│       ├── services/
│       │   └── colyseusClient.ts  # Colyseus client singleton
│       └── store/
│           └── useGameRoom.ts     # Zustand store — all live game state
├── server/                        # Colyseus game server
│   └── src/
│       └── rooms/
│           ├── GameRoom.ts        # Main room: state, tasks, AI, sprints, meetings
│           └── GameState.ts       # Colyseus schema: Player, Body, GameState
├── shared/                        # Shared types + constants
│   └── src/
│       ├── types.ts               # TaskId, RoleId, ZoneId, BodyInfo, etc.
│       ├── tasks.ts               # TASK_DEFS, AI_TASK_DEFS, ZONES
│       └── mapgen.ts              # Procedural map generation (BSP + A*)
└── scripts/                       # Dev utilities (start servers, test games)
```

---

## Game Loop

```
1. LOBBY       — host creates room, bots fill empty slots, game starts
2. BRIEF       — each player receives role + job title + 3 assigned tasks
                  AI also receives 3 secret reconnaissance tasks
3. SPRINT      — timed sprint; workers complete tasks, AI hunts and works
4. SPRINT END  — quota check
                    ✅ quota met → Sprint Retrospective (perk vote, 45 s)
                    ❌ quota missed → sprint ends without perk
5. REPEAT      — next sprint starts; AI tasks reset, cover tasks also reset
6. RESOLUTION  — win condition reached → end screen
```

---

## Roles at a Glance

### The Workforce (all players except the AI)

| Title | Home Zone | Sample Tasks |
|---|---|---|
| IT Technician | Server Room, Network Closet | Patch Terminal, Cable Audit |
| HR Officer | HR Corner | Security Vetting, Policy Review |
| DevOps Engineer | DevOps Den | CI Pipeline, Deploy Config |
| Finance Analyst | Finance Floor | Budget Freeze, Expense Audit |
| Marketing | Marketing Hub | PR Campaign, Crisis Control |
| Admin | Main Office | Keycard Audit, Meeting Setup |
| Management | Executive Suite | Sprint Planning, Resource Allocation |

No special abilities — observation and communication are the only tools.

### The Rogue AI (one hidden player)

Assigned a normal job title + 3 cover tasks (identical to a worker). Also has 3 secret phase-1 reconnaissance tasks:

| Task | Zone | Hold time |
|---|---|---|
| Index Personnel Records | HR Corner | 6 s |
| Analyse Audit Logs | Server Room | 7 s |
| Map Network Topology | Network Closet | 6.5 s |

Completing all 3 in a sprint grants sprint buffs (see design.md).

Kill mechanic: `E` near any living player → eliminate (30 s cooldown, always available).

---

## Multiplayer Model

- **Authoritative server** via Colyseus — all game state lives on the server, clients receive schema diffs
- **Bot players** — server-side bots with A* pathfinding fill empty slots; they complete tasks, call meetings, and participate in votes
- **Bot tick rate**: 200 ms (5 ticks/sec)
- **Session**: room-based, up to 8 players (human + bot) per room
- **Spectator mode**: eliminated players stay connected in free-watch mode

---

## Current Development State

| Area | Status |
|---|---|
| Procedural map generation (BSP + A*) | ✅ Complete |
| Player movement + collision | ✅ Complete |
| Task hold system | ✅ Complete |
| Sprint quotas + retro perk vote | ✅ Complete |
| All Hands meeting + vote resolution | ✅ Complete |
| AI kill mechanic (E key) | ✅ Complete |
| Body reporting (E near corpse) | ✅ Complete |
| Dead body rendering (laid-down character) | ✅ Complete |
| Bot AI (pathfinding, task completion, meeting calls) | ✅ Complete |
| AI sprint buff system (extra vote, invisibility) | ✅ Complete |
| Q-hold invisibility mechanic | ✅ Complete |
| Sprint task reset per sprint | ✅ Complete |
| Spectator mode | ✅ Complete |
| Minimap | ✅ Complete |
| Multi-floor (staircases) | ✅ Complete |
| Sound / music | ❌ Not started |
| Persistent stats / leaderboard | ❌ Not started |
| Sprint Retrospective perks (beyond perk vote UI) | 🔄 Partial |
