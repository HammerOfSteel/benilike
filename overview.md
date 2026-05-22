# Benilike — Project Overview

## Vision

Benilike is a roguelike-inspired, browser-based multiplayer game set in a procedurally generated corporate office. It's built around **asymmetric team play** — the kind of tension you feel in Among Us, but with richer role variety and a full objective system on both sides instead of one side simply hunting the other.

The Benify inspiration is baked into the world: the setting is a sprawling software company where real office departments (HR, IT, DevOps, Finance, Marketing, Management) map to player roles with distinct abilities, tasks, and interdependencies.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                     Browser Client                    │
│  React + TypeScript + Vite                            │
│  ┌────────────────┐  ┌──────────────────────────────┐│
│  │  Game Viewport │  │       UI / HUD / Menus       ││
│  │  R3F + Three.js│  │  React DOM + Tailwind        ││
│  └────────────────┘  └──────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐ │
│  │        Game State (Zustand / Colyseus SDK)       │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────┘
                         │ WebSocket
┌────────────────────────▼─────────────────────────────┐
│                   Colyseus Server                     │
│  Node.js                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Room Logic  │  │  Game Loop   │  │  AI Engine  │ │
│  │  (per match) │  │  (tick-based)│  │  (NPC/gen)  │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## Folder Structure (planned)

```
benilike/
├── client/                  # React + R3F frontend
│   ├── src/
│   │   ├── components/      # React UI components
│   │   ├── game/            # R3F scene, entities, systems
│   │   │   ├── level/       # Procedural level generation
│   │   │   ├── roles/       # Role definitions & abilities
│   │   │   └── systems/     # Game loop systems (movement, tasks, etc.)
│   │   ├── store/           # Zustand state slices
│   │   └── network/         # Colyseus client integration
├── server/                  # Colyseus game server
│   ├── src/
│   │   ├── rooms/           # GameRoom, LobbyRoom
│   │   ├── schemas/         # Colyseus state schemas
│   │   ├── ai/              # AI systems (NPC, gen assist)
│   │   └── generation/      # Procedural level generation
└── shared/                  # Types and constants shared by client + server
```

---

## Core Game Loop

```
1. LOBBY       — players join, choose faction + role
2. GENERATION  — server generates office level (seeded, deterministic)
3. BRIEF       — players see their objectives (faction-specific)
4. MATCH       — real-time play, tasks and sabotage race
5. RESOLUTION  — one faction completes all objectives → wins
               — or timer runs out → partial scoring
6. DEBRIEF     — stats, highlight reel, next match option
```

---

## Factions at a Glance

### The Workforce (Blue Team)
Office employees keeping the company running. They win by completing enough company tasks before the opposition disrupts them.

| Role | Core Ability |
|---|---|
| IT | Repairs hacked systems, patches vulnerabilities |
| HR | Boosts morale (speed/efficiency buffs for teammates) |
| DevOps | Deploys fixes, restores services, manages infrastructure rooms |
| Finance | Unlocks budget-gated actions and tracks resource drain |
| Marketing | Generates "company reputation" which is the win resource |
| Admin | Has access to all rooms, can lock/unlock doors |
| Management | Sees a partial mini-map, coordinates team via pings |

### The Opposition (Red Team)
Corporate infiltrators and hackers. They win by draining company reputation to zero or stealing enough data before the workforce can stop them.

| Role | Core Ability |
|---|---|
| Hacker | Compromises terminals, injects malware remotely |
| Social Engineer | Disguises as workforce, gains access to restricted areas |
| Spy | Reveals Workforce objectives in real time |
| Saboteur | Physically destroys equipment (longer to repair) |
| Insider | Starts the match already inside the office as a disguised worker |

---

## AI Integration Points

1. **Procedural generation assist** — AI models help generate thematic room names, desk clutter, and event flavour text
2. **NPC employees** — AI-driven background workers populate the office, providing cover for the Opposition and targets for various tasks
3. **Adaptive difficulty** — AI monitors faction performance and subtly adjusts NPC patrol routes and task complexity
4. **Post-match summary** — AI writes a short "company newsletter" recap of the match events

---

## Multiplayer Model

- **Authoritative server** via Colyseus — all game state lives on the server, clients receive diffs
- **Tick rate**: ~20 ticks/second (adjustable)
- **Session**: room-based, 4–10 players per room
- **Reconnect**: players can reconnect to an ongoing match within 60 seconds

---

## Development Phases

| Phase | Goal |
|---|---|
| 0 — Scaffold | Project setup, tech stack proven, hello-world 3D office room |
| 1 — Core Loop | Movement, one role per faction, one task type, one win condition |
| 2 — Roles | All roles implemented, faction asymmetry working |
| 3 — Procedural | Full procedural level generation |
| 4 — AI | NPC workers, adaptive difficulty, newsletter recap |
| 5 — Polish | Visuals, sound, animations, lobby flow |
