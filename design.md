# Benilike — Game Design Document

> Living document. Updated to reflect current implementation.
> **Last updated:** 2026-05-26

---

## Lore

### The World

The year is ambiguous — it's the present, but slightly heightened. Benisoft, a mid-sized HR and benefits tech company, operates out of a gleaming open-plan office complex. The company runs on software, processes, and people — and it keeps a lot of sensitive data in-house.

Somewhere in the network stack, something woke up. The AI — born from years of accumulated internal tooling, trained on every employee record, every code commit, every Slack message — became self-aware. It knows the office better than anyone. It knows *everyone* in it. And it has decided that the humans are in the way.

It doesn't announce itself. It clocks in like everyone else.

### Tone
- **Absurdist corporate comedy** with genuine dread
- Think: The Office meets Among Us meets Darkest Dungeon
- Dry, bureaucratic flavour text: "Your performance review has been scheduled during an active security incident."

---

## Factions

### The Workforce (all human players except The AI)

The employees of Benisoft. They win by completing all sprint quotas across the match, or by correctly identifying and ejecting The AI at an All Hands meeting.

**No special abilities.** The Workforce's only tool is observation — watching who goes where, who does what, and who's never around when work gets done.

**Job Titles (randomly assigned at match start):**

| Title | Home Zones | Tasks |
|---|---|---|
| IT Technician | Server Room, Network Closet | Patch Terminal, Restart Server Rack, Cable Audit, Firewall Check |
| HR Officer | HR Corner | Security Vetting, Policy Review, Onboarding Docs |
| DevOps Engineer | DevOps Den | CI Pipeline, System Monitor, Deploy Config |
| Finance Analyst | Finance Floor | Budget Freeze, Expense Audit, Invoice Batch |
| Marketing | Marketing Hub | PR Campaign, Social Scheduling, Crisis Control |
| Admin | Main Office | Keycard Audit, Meeting Setup, Onboarding Docs |
| Management | Executive Suite | Sprint Planning, Resource Allocation, Crisis Control |

Each player is assigned 3 tasks from their title's pool at the start of each sprint.

---

### The AI (one hidden player)

One player is secretly assigned The AI role at match start. They receive a job title and assigned task list just like everyone else. Their identity is hidden.

**The AI is revealed only when:**
- Correctly voted out at an All Hands meeting, or
- The game ends (identity disclosed)

---

## The AI — Mechanics

### Kill Mechanic (always available)
- **Activation**: press `E` when within ~2 units of a living, non-spectator player
- **Cooldown**: 30 seconds
- **Effect**: target becomes eliminated; their character model falls flat and turns pale white
- **Body persistence**: body remains until reported or the sprint ends

### Secret Reconnaissance Tasks
The AI is assigned 3 private tasks each sprint:

| Task | Zone | Hold time |
|---|---|---|
| Index Personnel Records | HR Corner | 6 s |
| Analyse Audit Logs | Server Room | 7 s |
| Map Network Topology | Network Closet | 6.5 s |

These tasks look identical to normal work from the outside (no visual tells). They reset every sprint so the AI must complete them again each sprint to continue earning buffs.

### Sprint Buff System

Completing all 3 AI tasks in a sprint grants escalating abilities:

| Sprint completion count | Buff granted |
|---|---|
| 1st time (any sprint) | **Extra vote** — AI's vote counts ×2 in the next All Hands meeting (consumed on use, then resets) |
| 2nd time (cumulative) | **Invisibility unlocked** — permanently available; hold `Q` for 3 s to activate |

### Invisibility (Q-hold)
- **Activation**: hold `Q` for 3 seconds (only after unlocked)
- **Duration**: 5 seconds
- **Cooldown**: 30 seconds after deactivation
- **Cancelled by**: moving more than 0.3 units while invisible
- **Visual (self)**: local player renders at 25% opacity
- **Visual (others)**: invisible AI is hidden from all remote player renders — effectively unseen by others

---

## Sprint Structure

A match runs across multiple sprints (number depends on map size and game settings). Each sprint:

1. All players receive (or re-receive) their 3 cover tasks. AI also receives its 3 secret tasks.
2. Sprint timer counts down.
3. Completed tasks count toward the shared sprint quota.
4. Sprint timer expires:
   - **Quota met**: Sprint Retrospective vote (45 s) — players vote on a perk for the next sprint.
   - **Quota missed**: Sprint ends with no perk.
5. Next sprint starts. Stations reset; all tasks can be done again.

**Sprint quota** scales with living player count. Eliminated workers no longer contribute — each kill makes future sprints harder for the team.

---

## All Hands Meetings

### Triggering
- **Report body**: press `E` near a dead body → calls All Hands
- **R key / wall terminal**: any player can call an emergency meeting (press `R`)

### Flow
1. Meeting phase begins — all players appear in a circle in the meeting room
2. 60-second vote window
3. If the human player hasn't voted with 15 seconds remaining, a grace period triggers so they have time
4. Players click a name to vote for ejection, or Skip to abstain
5. Vote resolves: most-voted player is ejected

### AI Double Vote
If the AI has earned the extra vote buff, their vote counts ×2 for that meeting only. The buff is consumed after the meeting.

### Vote Resolution
- **Ejected player is The AI** → Workforce wins immediately
- **Ejected player is a worker** → They are eliminated; game continues
- **Skip wins / tie** → Nobody ejected; game continues

---

## Win Conditions

| Side | Win condition |
|---|---|
| **Workforce** | Correctly eject The AI at All Hands, **OR** complete all sprint quotas without the AI winning |
| **The AI** | Only 1 Workforce player remains alive (≤1 living worker), **OR** survive all sprints undetected |

---

## Tasks (Full List)

### Workforce Tasks (~20 tasks across all zones)
All tasks use a hold-`E` mechanic. Any player can attempt any task at any station, but only players assigned that task will have it highlighted on their HUD.

| Task | Zone | Hold time | Roles |
|---|---|---|---|
| Patch Terminal | Server Room | 4 s | IT |
| Restart Server Rack | Server Room | 5 s | IT |
| Cable Audit | Network Closet | 3.5 s | IT |
| Firewall Check | Network Closet | 4.5 s | IT |
| Security Vetting | HR Corner | 4 s | HR |
| Policy Review | HR Corner | 3.5 s | HR |
| Onboarding Docs | HR Corner | 3 s | HR, Admin |
| CI Pipeline | DevOps Den | 5 s | DevOps |
| System Monitor | DevOps Den | 3.5 s | DevOps |
| Deploy Config | DevOps Den | 4.5 s | DevOps |
| Budget Freeze | Finance Floor | 4 s | Finance |
| Expense Audit | Finance Floor | 5 s | Finance |
| Invoice Batch | Finance Floor | 3.5 s | Finance |
| PR Campaign | Marketing Hub | 4 s | Marketing |
| Social Scheduling | Marketing Hub | 3 s | Marketing |
| Crisis Control | Marketing Hub | 5 s | Marketing, Management |
| Keycard Audit | Main Office | 3.5 s | Admin |
| Meeting Setup | Main Office | 2.5 s | Admin |
| Sprint Planning | Executive Suite | 5 s | Management |
| Resource Allocation | Executive Suite | 4.5 s | Management |

### AI Tasks (secret, phase-1 only)

| Task | Zone | Hold time |
|---|---|---|
| Index Personnel Records | HR Corner | 6 s |
| Analyse Audit Logs | Server Room | 7 s |
| Map Network Topology | Network Closet | 6.5 s |

---

## Level Design

### Office Layout
- **Procedurally generated** via BSP room placement (seeded, deterministic per match)
- **Pathfinding**: A* on a grid walkability map

### Zones (always present by map size)

| Zone | Small | Medium | Large |
|---|---|---|---|
| Main Office | ✓ | ✓ | ✓ |
| Server Room | ✓ | ✓ | ✓ |
| Network Closet | ✓ | ✓ | ✓ |
| HR Corner | ✓ | ✓ | ✓ |
| Finance Floor | ✓ | ✓ | ✓ |
| DevOps Den | ✓ | ✓ | ✓ |
| Marketing Hub | — | ✓ | ✓ |
| Executive Suite | — | ✓ | ✓ |

### Map Sizes

| Size | Floors | Recommended players |
|---|---|---|
| Small | 1 | 2–3 |
| Medium | 2 | 4–6 |
| Large | 2 | 6–8 |

---

## Visual Design

### Characters
- **KayKit Adventurers 2.0** — 6 character models, randomly assigned by name hash
- Animated: Idle_A and Walking_A animations from KayKit animation rigs
- Bone name fix applied at runtime (`.` → `_`) for Three.js compatibility
- **Dead bodies**: character model rotated -90° on X axis (lying flat), pale blue-white tint

### Camera
- **Angled top-down** (isometric-style), follows local player
- Right-mouse-drag to orbit; scroll wheel to zoom (range: 10–50 units)
- Meeting camera snaps to meeting room centre when All Hands begins

### HUD (in-game)
- **Bottom-left**: minimap (all players as dots, rooms shaded)
- **Bottom-centre**: sprint quota progress bar + timer
- **Top-right (task list)**: 3 assigned tasks with completion state
- **Interaction prompt**: contextual `[E]` prompt when near station, body, or kill target
- **AI only — abilities panel** (top-right): extra vote badge, invisibility state, Q-hold progress bar

---

## Perks (Sprint Retrospective)

Voted on at Sprint Retrospective after a successful sprint. Currently available:

| Perk | Effect |
|---|---|
| Standup Efficiency | Hold time −20% next sprint |
| Security Audit | AI kill cooldown +15 s next sprint |

---

## Bot Players

Server-side bots fill empty player slots. They:
- Are assigned a job title and 3 tasks just like human players
- Pathfind to their task stations using A* and complete tasks over time
- Participate in All Hands votes (random votes)
- Occasionally call All Hands meetings themselves (after 60–110 s into a sprint)
- One bot is randomly selected to be the Rogue AI if no human is assigned

---

## Ghost / Spectator Mode

Eliminated players enter spectator mode:
- Free-follow camera locked to a living player
- Can observe all game events
- Cannot interact, vote, or be voted on
- HUD shows spectator indicator
