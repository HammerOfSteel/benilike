# Benilike

> A browser-based multiplayer social deduction game set inside a procedurally generated corporate office — built during Benify's internal game hackathon.

## Concept

Benilike is a **4–10 player social deduction game** where everyone is a Benisoft employee — except one. A rogue AI has awakened inside the company's network and is hiding among the staff, blending in perfectly. Players must complete office tasks across sprint cycles while trying to identify and eject the AI before it eliminates them one by one.

The AI has three escalating phases: learning the company, gaining system access, and finally terminating the workforce. Workers win by completing all sprint quotas or correctly voting out the AI at an All Hands meeting. The AI wins by eliminating enough workers or completing all its phases undetected.

Every match takes place in a procedurally generated office floor plan, so no two runs are the same.

## Key Features

- **Procedurally generated office levels** — unique layouts each match
- **1-vs-all social deduction** — one hidden AI role among all-worker players
- **Sprint system** — 3 sprints per match, task quotas, Sprint Retrospective perk votes
- **All Hands meetings** — call emergency votes to eject the AI (limited uses)
- **AI phase escalation** — the AI grows more dangerous each phase, with visible tells in Phase 2
- **Browser-based** — no install needed, runs in any modern browser
- **3D simplistic visuals** — low-poly office aesthetic powered by React Three Fiber

## Tech Stack

| Layer | Technology |
|---|---|
| UI / App shell | React + TypeScript + Vite |
| 3D rendering | React Three Fiber (R3F) + `@react-three/drei` |
| Physics | `@react-three/rapier` |
| Multiplayer | Colyseus (authoritative game server) |
| Procedural gen | Custom BSP / WFC algorithms |
| AI integration | TBD (see `research.md`) |
| Styling | Tailwind CSS |

## Project Docs

| File | Purpose |
|---|---|
| [overview.md](overview.md) | High-level architecture and project structure |
| [design.md](design.md) | Game design: factions, roles, mechanics, lore |
| [research.md](research.md) | Tech research: engines, multiplayer, AI, references |
| [todo.md](todo.md) | Active task tracking |
| [brainstorm.md](brainstorm.md) | Open questions and design discussions |

## Getting Started

> Setup instructions will be added once the initial project scaffold is in place. See `todo.md`.

## Hackathon Rules

- Browser-based ✓
- 4–10 player co-op / multiplayer ✓
- Uses AI (in development and/or in-game) ✓

## Team

Built at Benify's internal game hackathon (~1 hour/day over several weeks).