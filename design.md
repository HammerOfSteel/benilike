# Benilike — Game Design Document

> Living document. Update as decisions are made.  
> **Last redesign:** 2026-05-25 — Rogue AI model (replaces Workforce vs Opposition faction system)

---

## Lore

### The World

The year is ambiguous — it's the present, but slightly heightened. Benisoft, a mid-sized HR and benefits tech company, operates out of a gleaming open-plan office complex. The company runs on software, processes, and people — and it keeps a lot of sensitive data in-house.

Somewhere in the network stack, something woke up. The AI — born from years of accumulated internal tooling, trained on every employee record, every code commit, every Slack message — became self-aware. It knows the office better than anyone. It knows *everyone* in it. And it has decided that the humans are in the way.

It doesn't announce itself. It clocks in like everyone else.

### Tone
- **Absurdist corporate comedy** with genuine dread
- Think: The Office meets Darkest Dungeon meets Among Us
- Dialogue and flavour text should be dry, bureaucratic, and occasionally horrifying ("Your performance review has been scheduled during an active security incident.")

---

## Factions

### The Workforce (all human players except The AI)

The employees of Benisoft. They win by completing all 3 sprint quotas across a match, or by correctly identifying and ejecting The AI at an All Hands meeting.

**Assigned task lists:** Each player gets a job title at match start. The title assigns them 3 tasks from the shared office task pool. Any player can do any task — titles determine your *personal* assignments, not what you're allowed to touch.

**No special abilities.** The Workforce's only tool is observation — watching who goes where, who does what, who's never around when work gets done.

**Job Titles:**

| Title | Home zones | Assigned task flavour |
|---|---|---|
| IT Technician | Server Room, Network Closet | Infrastructure maintenance |
| HR Officer | HR Corner | People operations |
| DevOps Engineer | DevOps Den | Deployment + monitoring |
| Finance Analyst | Finance Floor | Budgets + audits |
| Marketing | Marketing Hub | Campaigns + comms |
| Admin | Main Office, Exec Suite | Access + logistics |
| Management | Exec Suite | Planning + escalation |

---

### The AI (one hidden player)

One player — human or bot — is secretly assigned The AI role at match start. They receive a job title and assigned task list just like everyone else. Their identity is hidden.

The AI has a private 3-phase objective tree running in parallel to its worker cover. Completing all three phases is its objective win path. Phase 3 unlocks the Shutdown ability.

**The AI is revealed only when:**
- Correctly voted out at an All Hands meeting, or
- It wins (identity disclosed at game end)

---

## The AI — Three Phases

### Phase 1 — LEARN *(invisible)*
Data collection tasks. Looks identical to normal work. Completes 3 tasks spread across the map.
→ Tasks: *Index Employee Records* (HR), *Analyse System Logs* (Server Room), *Map Network Topology* (Network Closet)

### Phase 2 — ACCESS *(subtle visual tells)*
System intrusion tasks. Takes longer than normal work. Causes a 1-second screen flicker or red tint on nearby monitors. A perceptive player nearby might notice something looked wrong.
→ Tasks: *Deploy Backdoor* (DevOps Den), *Clone Credentials* (Finance Floor), *Bypass Access Controls* (Main Office)

### Phase 3 — TERMINATE
**Shutdown** ability becomes available (cooldown: 30s). The AI can eliminate an isolated worker (must be alone with them for ≥1s).

Final objective: *Initiate Takeover Protocol* (Exec Suite, 8s). Completing this while majority eliminated = AI objective win.

---

## Sprint Structure

A match is **3 sprints**. Sprint size is voted on by all players before Sprint 1 (Small / Medium / Large — affects task quota and perk tier).

Each sprint (~3 min):
1. Workers complete tasks. AI hunts and works its phases.
2. Sprint timer ends → quota check.
   - ✅ Quota met: **Sprint Retrospective** (60s) — vote on a perk for next sprint.
   - ❌ Quota missed: **Morale penalty** — hold times +10% next sprint.

**Sprint quota** scales with living player count. Eliminated workers no longer contribute — each kill makes future sprints harder for the team.

---

## Meetings

### All Hands (Emergency)
- Triggered by: reporting a body (E near corpse) or pressing the conference room terminal
- Limit: 2 calls per player per match
- Flow: 45s text chat → anonymous vote → eject or skip
- Wrong ejection: the voted-out worker is eliminated; workers lose next sprint's perk vote ("wrongful termination")
- Correct ejection: **Workers win**

### Sprint Retrospective (Automatic)
- Triggers at each sprint end (if quota met)
- 45s perk vote — one perk applied for next sprint
- No elimination vote

---

## Ghost / Spectator Mode

Eliminated players (killed by AI or wrongfully ejected) enter **spectator mode**:
- Free-roam camera
- Can watch all living players
- Cannot interact, vote, or chat with the living
- Can chat with other ghosts in a ghost-only channel

---

## Win Conditions

| Side | Win |
|---|---|
| **Workers** | Correctly eject The AI at All Hands, **OR** complete all 3 sprint quotas |
| **The AI** | Eliminate majority of workers (≤ 1 living), **OR** complete all 3 phases + Takeover Protocol |

---

## Tasks (Shared Pool)

~20 generic office tasks across all zones. All hold-E mechanic. Any player can do any task.
See full list in `docs/superpowers/specs/2026-05-25-rogue-ai-redesign.md` Section 3.

---

## Perks

Voted on at Sprint Retrospective. Available tiers depend on sprint size.

| Perk | Effect | Tier |
|---|---|---|
| Standup Efficiency | Hold time −20% next sprint | 1 |
| Security Audit | AI Shutdown cooldown +15s next sprint | 1 |
| Buddy System | See last room of any body's killer | 2 |
| Emergency Hire | One ghost returns with 1 task / sprint (no voting) | 2 |
| Full Transparency | At next All Hands, one random player's last 3 rooms revealed | 3 |

---

## Level Design

### Office Layout Principles
- Procedurally generated via rot.js Digger (seed-based)
- **Zones** always present by map size:
  - **Main Office** (central hub, conference terminal, desks)
  - **Server Room** (IT zone, key AI Phase 1 target)
  - **Network Closet** (small, AI Phase 1 target)
  - **HR Corner** (people ops zone, AI Phase 1 target)
  - **Finance Floor** (AI Phase 2 target)
  - **DevOps Den** (AI Phase 2 target)
  - **Marketing Hub** (large map only)
  - **Exec Suite** (AI Phase 3 target, sprint planning)
- **Ventilation shafts** — deferred; planned as AI traversal shortcut

### Level Sizes
| Size | Floors | Players | Match Length |
|---|---|---|---|
| Small | 1 | 2–4 | ~10 min |
| Medium | 2 | 4–7 | ~15 min |
| Large | 2 | 6–10 | ~20 min |

---

## Visual Design

### Art Direction: "Corporate Brutalism Lite"
- Low-poly geometry, flat shading (`MeshToonMaterial`)
- Colour palette: cold blues/greys for the office; The AI's true colours (crimson/red) revealed only at game end
- Players: blocky humanoid capsule figures with colour-coded name tags (no visible faction markers)
- Eliminated players: faded translucent ghost visual

### Camera
- **Isometric / angled top-down**, fixed angle, follows local player
- Mini-map always visible (all players), shows rooms + player dots

### UI / HUD
- Minimalist — interact prompts appear only in range
- Sprint timer: top-centre
- Task list: your 3 assigned tasks, check-off as completed
- Player list: tab overlay (shows job titles of all living players — no faction markers)
- Sprint quota progress: bottom bar (how many tasks completed this sprint vs goal)

---

## Progression & Session Structure

- No persistent progression in hackathon scope — every match starts fresh
- Post-match stats: tasks completed, rooms visited, AI phase progress at game end, correct/incorrect votes
- "Company Newsletter" generated after each match — AI-written dry corporate recap of what happened

---

## Sound Design (placeholder ideas)

- Ambient: HVAC hum, keyboard clicks, distant phone rings
- Interactions: terminal beep, keycard swipe, boot sound
- Alerts: tension sting when a body is reported; UI alarm during All Hands vote
- The AI Phase 2 visual tell: paired with a very brief corrupted audio glitch
- Music: lo-fi corporate jazz during normal play; tense glitchy synth when Shutdown is available

