# Benilike

> A browser-based multiplayer roguelike set inside a procedurally generated corporate office — built during Benify's internal game hackathon.

## Concept

Benilike is a **4–10 player asymmetric multiplayer game** where two factions race to complete their objectives inside an ever-changing office building. One faction plays as **The Workforce** — a team of office employees (HR, IT, DevOps, Finance, Marketing, Admin, Management) who must keep the company running. The other faction plays as **The Opposition** — a rival team of corporate infiltrators and hackers trying to sabotage, steal data, and cause chaos.

Every match takes place in a procedurally generated office floor plan, so no two runs are the same.

## Key Features

- **Procedurally generated office levels** — unique layouts each match
- **Asymmetric factions** — Workforce vs Opposition, each with unique role kits
- **Role-based co-op** — players must combine their abilities to succeed
- **Browser-based** — no install needed, runs in any modern browser
- **3D simplistic visuals** — low-poly office aesthetic powered by React Three Fiber
- **AI-driven** — AI assists procedural generation, NPC behaviour, and difficulty scaling

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