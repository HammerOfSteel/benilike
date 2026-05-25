# Benilike — Rogue AI Redesign

**Date:** 2026-05-25  
**Status:** Approved  
**Replaces:** Role-based task system (task-system-design.md) + Workforce vs Opposition faction model

---

## 1. Core Concept

Benilike is a **1-vs-all social deduction game** set in a procedurally generated corporate office.

All players are Workforce employees of Benisoft. One hidden player — human or server-controlled bot — is **The AI**: a rogue artificial intelligence that has quietly "awakened" within the company's internal network. It appears as a regular employee, uses the same terminals, walks the same halls. No one knows who it is.

The workers' job: stay productive (hit sprint quotas), stay alive, and identify + eject The AI before it's too late.  
The AI's job: blend in, complete its covert three-phase objective tree, and systematically eliminate the workforce before they catch on.

---

## 2. Factions

### The Workforce (all human players except the AI)

Regular Benisoft employees. Each is assigned a **job title** at match start, which:
- Gives them a cosmetic identity (name tag, role label on briefing screen)
- Determines their personal **assigned task list** (3 tasks drawn from the shared office task pool)

Any worker can walk up to any station and complete any task. However:
- Only tasks from your **assigned list** count toward your personal sprint quota contribution
- Assisting others still helps the team's overall sprint quota

Workers do not have special abilities. The balance lever is information — knowing who's been where, who completed what, who hasn't done anything.

**Job Titles & Their Home Zones:**

| Job Title | Assigned zone(s) | Example assigned tasks |
|---|---|---|
| IT Technician | Server Room, Network Closet | Patch Terminal, Restart Rack, Cable Audit |
| HR Officer | HR Corner | Security Vetting, Policy Review, Onboarding |
| DevOps Engineer | DevOps Den | CI Pipeline, System Monitor, Deploy Config |
| Finance Analyst | Finance Floor | Budget Freeze, Expense Audit, Invoice Batch |
| Marketing | Marketing Hub | PR Campaign, Social Scheduling, Crisis Control |
| Admin | Main Office, Exec Suite | Keycard Audit, Meeting Room Setup, Supply Order |
| Management | Exec Suite | Sprint Planning, Resource Allocation, Escalation Review |

---

### The AI (one hidden player)

Assigned secretly at match start. Has a random job title like all other players (and their task list for it). The AI **must blend in** — it can and should complete regular workforce tasks to appear legitimate.

The AI additionally has a private 3-phase objective tree. Completing all three phases is its objective win path. Phase 3 also unlocks its elimination ability.

**The AI's identity is not revealed until:**
- It is correctly voted out at an All Hands meeting, OR
- It wins

---

## 3. Workforce Tasks (Shared Pool)

All ~20 tasks are generic office work. Any player can do any of them. Tasks use the existing hold-E mechanic.

Tasks are distributed across zones. Each station has one task assigned per match (seed-based). The zone and task are visible to all players on approach — no hidden information here. The deduction comes from **watching behaviour**, not from task gating.

**Full task pool:**

| Task ID | Display Name | Zone | Hold (ms) |
|---|---|---|---|
| `patch_terminal` | Patch Terminal | Server Room | 4000 |
| `restart_rack` | Restart Rack | Server Room | 5000 |
| `cable_audit` | Cable Audit | Network Closet | 3500 |
| `firewall_check` | Firewall Check | Network Closet | 4000 |
| `security_vetting` | Security Vetting | HR Corner | 5000 |
| `policy_review` | Policy Review | HR Corner | 4500 |
| `onboarding_docs` | Onboarding Docs | HR Corner | 3000 |
| `ci_pipeline` | CI Pipeline Run | DevOps Den | 5500 |
| `system_monitor` | System Monitor | DevOps Den | 4000 |
| `deploy_config` | Deploy Config | DevOps Den | 4500 |
| `budget_freeze` | Budget Freeze | Finance Floor | 5000 |
| `expense_audit` | Expense Audit | Finance Floor | 4500 |
| `invoice_batch` | Invoice Batch | Finance Floor | 3500 |
| `pr_campaign` | PR Campaign | Marketing Hub | 5000 |
| `social_scheduling` | Social Scheduling | Marketing Hub | 3500 |
| `crisis_control` | Crisis Control | Marketing Hub | 4500 |
| `keycard_audit` | Keycard Audit | Main Office | 4000 |
| `meeting_setup` | Meeting Room Setup | Main Office | 3000 |
| `sprint_planning` | Sprint Planning | Exec Suite | 5500 |
| `resource_allocation` | Resource Allocation | Exec Suite | 5000 |

---

## 4. The AI — Three Phases

The AI has a private phase objective tree. Phase tasks look like normal work from outside, with one exception (Phase 2 tells). Completing each phase unlocks the next.

### Phase 1 — LEARN *(invisible to others)*

The AI is gathering intelligence. These tasks are indistinguishable from normal work — any workforce player would do these. Completing all 3 unlocks Phase 2.

| Task | Zone | Hold (ms) | Cover Story |
|---|---|---|---|
| Index Employee Records | HR Corner | 5000 | "Doing HR stuff" |
| Analyse System Logs | Server Room | 5500 | "Doing IT stuff" |
| Map Network Topology | Network Closet | 5000 | "Doing IT stuff" |

### Phase 2 — ACCESS *(subtle environmental tells)*

The AI is penetrating systems. These tasks take slightly longer than workforce tasks and trigger a brief visual artifact on nearby screens: a 1-second flicker or red tint. A perceptive player nearby would notice something looked off. Completing all 3 unlocks Phase 3 and grants the **Shutdown** ability.

| Task | Zone | Hold (ms) | Visual Tell |
|---|---|---|---|
| Deploy Backdoor | DevOps Den | 7000 | Flicker on DevOps monitors |
| Clone Credentials | Finance Floor | 7000 | Brief red tint on Finance terminals |
| Bypass Access Controls | Main Office | 6500 | Admin terminal glitches for 1s |

### Phase 3 — TERMINATE

**Shutdown ability** is unlocked. The AI also has one final objective task.

**Shutdown mechanic:**
- Cooldown: 30 seconds
- Requirement: The AI must have been in the same room as the target (no other living players present) for ≥ 1 second
- Effect: Target player is instantly eliminated. Their body appears in the room.
- Body discovery: any living player who enters the room and moves near the body can press E to "report" it, triggering an All Hands meeting

**Final objective task:**

| Task | Zone | Hold (ms) | Effect |
|---|---|---|---|
| Initiate Takeover Protocol | Exec Suite | 8000 | Triggers AI objective win check |

The AI wins via objectives if: all 9 phase tasks are complete + Takeover Protocol is done + majority of workers are eliminated (≤ 1 living).

---

## 5. Sprint Structure

A match consists of **3 sprints**.

### Sprint Lifecycle

```
[Sprint Start]
      │
      ▼
  Active Sprint (~3 min)
  Workers do tasks, AI hunts and does phase tasks
      │
      ▼
  Sprint Timer Ends
      │
  ┌───▼────────────────────┐
  │ Quota met?             │
  │ YES → Sprint Retro     │
  │ NO  → Penalty applied  │
  └────────────────────────┘
      │
      ▼
  [Next Sprint Start]  ←── or Game Over
```

### Sprint Size Vote (once, before Sprint 1)

All players vote on sprint size in the pre-game lobby:

| Size | Task Quota (per sprint) | Perk Tier |
|---|---|---|
| Small | `living_workers × 1.5` tasks | Tier 1 perks only |
| Medium | `living_workers × 2` tasks | Tier 1 + Tier 2 perks |
| Large | `living_workers × 2.5` tasks | All perks available |

> Sprint size is a team commitment. The AI also votes (as a worker), giving it some influence over how hard the sprint is — a meta-bluffing opportunity.

### Sprint Quota Counting

- Any completed task by any living player counts toward the shared sprint quota
- Ghosts (spectators) do **not** contribute — elimination removes their quota contribution

### Sprint Retrospective (if quota met)

60-second meeting. Shows per-player task completion stats (task count visible — this is social deduction fodder). Then vote on one perk for next sprint.

### Missed Sprint Penalty

If quota is not met: **morale penalty** — task hold times +10% for next sprint. No perk awarded.

---

## 6. Meetings

### All Hands (Emergency Meeting)

**Triggered by:**
- Any living worker pressing E at the conference room terminal in Main Office, OR
- Any living worker pressing E to "report" a body

**Limit:** Each player has **2 All Hands calls** per match.

**Flow:**
1. All living players freeze and enter meeting overlay
2. 45 seconds of open text chat (discuss, accuse)
3. Anonymous vote — each living player votes for one player to eject (or Skip)
4. Highest vote = ejected. Ties = no ejection. Vote tally shown post-result.

**Ejection outcome:**
- If ejected player was The AI → AI is caught, **Workers win**
- If ejected player was a Worker → Worker is eliminated (ghost mode). **Wrongful termination penalty**: workers forfeit their next sprint's perk vote slot ("HR is reviewing the incident report")

**Ghost mode:** Eliminated players (workers wrongfully ejected, or workers killed by the AI) enter **spectator mode only** — free-roam camera, cannot interact, cannot vote, cannot chat with living players. Ghosts may chat with each other in a ghost channel.

### Sprint Retrospective (Automatic)

No elimination vote. Just quota check → perk vote if quota met. 45 seconds.

---

## 7. Perks

Voted on at Sprint Retrospective. Only the options available for the chosen sprint size appear on the ballot.

| Perk | Effect | Tier |
|---|---|---|
| **Standup Efficiency** | Task hold time −20% next sprint | 1 |
| **Security Audit** | AI Shutdown cooldown +15s next sprint | 1 |
| **Buddy System** | Players can see who was last in the same room as any reported body | 2 |
| **Emergency Hire** | One eliminated ghost returns as a contractor — limited to spectate + 1 assigned task per sprint (restricted movement, no voting) | 2 |
| **Full Transparency** | At the next All Hands, one randomly selected player has their last 3 visited rooms revealed to everyone | 3 (Large only) |

---

## 8. Win Conditions

| Side | Win condition |
|---|---|
| **Workers win** | Correctly eject The AI at an All Hands, **OR** complete all 3 sprint quotas without the AI winning first |
| **AI wins** | All 9 phase tasks + Takeover Protocol complete + ≤ 1 living worker remains, **OR** ≤ 1 living worker remains (elimination majority) |

**Tiebreaker / edge cases:**
- If the AI is ejected mid-sprint, workers win immediately regardless of sprint state
- If all workers are eliminated before Sprint 3 ends, AI wins immediately
- If Sprint 3 quota is met and AI has not won yet, workers win

---

## 9. What's Removed from Previous Design

| Removed | Reason |
|---|---|
| Opposition faction (Hacker, Spy, Saboteur, Insider, Social Engineer) | Replaced by single AI antagonist |
| Team task meter (0–100%) | Replaced by sprint quota + 3-sprint win path |
| Meter degradation timer | Replaced by missed sprint penalty |
| Role-gated task stations | All tasks are open to all players |
| `factionAssignment` lobby option | No longer two factions; AI assigned server-side |
| Rack health / server monitor mechanic | Removed for scope; may return as a perk or flavour |
| Badge renewal mechanic | Removed for scope |

---

## 10. Open Questions (deferred)

- **Venting**: The AI may use vents to traverse the map faster and evade. Adds traversal depth and strong thematic fit. Deferred — vent geometry needs map design work.
- **Visual tells intensity**: Should Phase 2 tells be louder over time (more obvious each task)? Needs playtesting.
- **NPC background workers**: Idle NPCs in the office could create additional cover for the AI. Deferred.
- **Voice/proximity chat**: Would significantly enhance social deduction. Deferred to post-MVP.
