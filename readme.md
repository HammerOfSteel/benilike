# Benilike

> A browser-based multiplayer social deduction game set inside a procedurally generated corporate office — built during Benify's internal game hackathon.

## Concept

Benilike is a **3–8 player 1-vs-all social deduction game** set in a Benisoft office. Everyone is an employee trying to hit their sprint quota — except one. A **Rogue AI** has woken up inside the network, clocked in like everyone else, and is quietly eliminating the workforce one by one.

The Workforce wins by correctly voting out the AI at an All Hands meeting, or by completing all sprint quotas. The Rogue AI wins by eliminating enough workers or surviving to the end undetected.

Every match takes place in a procedurally generated office floor plan, so no two runs are the same.

## How It Works

### The Sprint System
Each match runs across multiple timed sprints. Every player has a job title (IT Technician, HR Officer, DevOps Engineer, Finance Analyst, Marketing, Admin, Management) that assigns them 3 tasks. Completing tasks at their stations contributes to the shared sprint quota. If the quota is met, players vote on a perk for the next sprint.

### The Rogue AI
One player is randomly assigned the Rogue AI role at match start. They receive a normal job title and task list — indistinguishable from any worker. In parallel, they run 3 secret reconnaissance tasks hidden to everyone else. Completing all 3 in a sprint unlocks escalating abilities:

- **Sprint 1 complete** → Vote counts ×2 in the next All Hands
- **Sprint 2 complete** → Invisibility unlocked (hold Q 3 s → 5 s invisible, 30 s cooldown)

The AI can **eliminate workers at any time** (press E near a player, 30 s cooldown). Dead bodies appear as pale, fallen characters. Anyone who finds a body can report it (E near corpse) to call an emergency All Hands meeting.

### All Hands Meetings
Called by reporting a body or pressing R at a wall terminal. Players vote to eject someone. If the AI is ejected — Workforce wins. Wrong ejection eliminates an innocent worker and the game continues.

## Key Features

- **Procedurally generated office** — unique layouts every match (1–2 floors, up to 8 rooms)
- **1-vs-all social deduction** — one hidden Rogue AI among all worker players
- **Sprint task system** — hold-E interactions, quotas, perk votes at sprint retros
- **All Hands meetings** — emergency votes triggered by body reports or wall terminals
- **AI escalation** — reconnaissance tasks unlock vote weight and invisibility buffs
- **Kill mechanic** — AI eliminates players; bodies must be found and reported
- **Invisibility** — Q-hold ability unlocked after 2 sprint completions
- **Bot players** — server-side AI bots fill empty slots, complete tasks, call meetings
- **Spectator mode** — eliminated players can watch the rest of the match
- **3D office visuals** — KayKit Adventurers characters, procedural rooms, animated

## Tech Stack

| Layer | Technology |
|---|---|
| UI / App shell | React 18 + TypeScript 5.6 + Vite 6.4 |
| 3D rendering | React Three Fiber v8 + `@react-three/drei` v9 |
| 3D models | KayKit Adventurers 2.0 (6 character GLBs + animation rigs) |
| Multiplayer | Colyseus 0.15 (authoritative WebSocket server, port 2567) |
| Procedural gen | Custom BSP room placement + A* pathfinding |
| State management | Zustand |
| Styling | CSS Modules |

## Project Docs

| File | Purpose |
|---|---|
| [overview.md](overview.md) | Architecture, folder structure, and technical overview |
| [design.md](design.md) | Game design: mechanics, tasks, win conditions, AI abilities |
| [todo.md](todo.md) | Active task tracking |
| [brainstorm.md](brainstorm.md) | Open questions and design discussions |

## Getting Started

```bash
# Install dependencies (root + client + server)
npm install
cd client && npm install
cd ../server && npm install

# Start both client and server in dev mode
cd ..
npm run dev        # starts Vite client on :3000
npm run server     # starts Colyseus server on :2567

# Quick test: start a game with bots
npm run show -- --bots 7 --size medium --duration 300
```

## Hackathon Context

Built at Benify's internal game hackathon (~1 hour/day over several weeks).

- Browser-based ✓
- 3–8 player multiplayer ✓
- Procedurally generated levels ✓
- Social deduction / hidden role ✓

## Branch

Active development: `phase-3-assets`
