# Benilike — Task System Design

**Date:** 2026-05-25  
**Status:** Approved  
**Replaces:** Single-terminal repair/hack system + Q ability system

---

## 1. Overview

Replace the single-terminal binary win condition and Q ability system with a **role-based task system** inspired by Among Us. Each role has 2 tasks at specific workstations scattered around the map. Completing a task pushes your team's meter up and may apply a buff/debuff. The first team to reach **100% on their Task Meter** wins.

---

## 2. Win Condition

### Team Task Meter
- Each team (`workforce`, `opposition`) has an independent meter: `0–100%`
- **Win condition:** meter reaches 100%
- **Meter starts at 0** for both teams
- **Natural degradation:** -1% every 45 seconds (server decay) — teams must keep pace
- Each task completion contributes **+14%** base (7 tasks per team × 14% ≈ 98%, final task pushes over 100%)
- Some tasks grant **instant meter boosts** on top (+8%, +10%)
- Some opposition tasks **drain the workforce meter** (-8%)
- Some workforce tasks **slow opposition meter gains** (debuffs)

### Removed
- `terminalProgress` (0–100 repair/hack bar) — removed entirely
- Q ability key — removed
- `task_start` / `task_stop` (terminal hold) — replaced by station interaction

---

## 3. Map Zones

### Floor counts by map size
| `mapSize` | Floors | Zones available |
|---|---|---|
| `small` | 1 | Main Office · Server Room · Network Closet |
| `medium` | 2 | + HR Corner · Finance Floor · DevOps Den |
| `large` | 3 | + Marketing Hub · Exec Suite · Opposition Den |

### Zone definitions (with world positions, medium map)
| Zone ID | Display Name | Floor | World centre (x, z) | Notes |
|---|---|---|---|---|
| `main_office` | Main Office | 0 | (0, 0) | Large open area, many desks |
| `server_room` | Server Room | 0 | (0, -11.5) | Existing server room |
| `network_closet` | Network Closet | 0 | (-9, -4) | Small room, west side |
| `hr_corner` | HR Corner | 1 | (-7, 4) | Medium floor 2 |
| `finance_floor` | Finance Floor | 1 | (7, 4) | Medium floor 2 |
| `devops_den` | DevOps Den | 1 | (0, -4) | Medium floor 2 |
| `marketing_hub` | Marketing Hub | 2 | (-7, -4) | Large floor 3 |
| `exec_suite` | Exec Suite | 2 | (7, -4) | Large floor 3 |
| `opposition_den` | Opposition Den | 2 | (0, 4) | Large floor 3, opp spawn |

### Station assignment (seed-based)
At `start_game`, the server uses `mapSeed` to deterministically assign task IDs to station indices within each zone. Each zone has **3 generic stations** (desks/terminals). A task is assigned to station index 0, 1, or 2 within its zone. Players only see the zone — not the index.

---

## 4. Monitoring Console

A **shared physical terminal** in the Server Room showing server health. This is the one unique interactable in the Server Room that everyone can _see_ (though most can't read it).

### Server racks
3 server racks in the Server Room, each with independent health (0–100):
- `rack_a`, `rack_b`, `rack_c`
- Rack health degrades by 1% every 30s naturally
- IT "Fix Server Rack" task targets one rack, restoring it to 100%
- Saboteur "Read Server Logs" sees all 3 rack health values
- DevOps "System Monitor" task triggers Admin's console to refresh with current values
- Keycard Audit (Admin task) appends a vague intel entry to the console log

### Console access
- Admin can always interact with the monitoring console (hold E)
- Saboteur gains temporary read access after completing "Read Server Logs"
- Console shows: rack health bars, last log entry (vague intel if Keycard Audit done)

---

## 5. Task Tables

### 5.1 Workforce Tasks

#### IT Technician — Server Room
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `it_repair_terminal` | Terminal | 5s | +14% workforce meter, removes active `hacker_corruption` debuff |
| 2 | `it_fix_server` | Server Rack | 5s | Restores targeted rack to 100%, pauses all rack degradation for 3 min |

#### DevOps Engineer — DevOps Den
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `devops_ci_pipeline` | Desk terminal | 4s | IT task hold time halved (×0.5) for 90s |
| 2 | `devops_system_monitor` | Monitor desk | 4s | Admin's monitoring console refreshes with latest server health snapshot |

#### HR Officer — HR Corner
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `hr_security_vetting` | HR desk | 4s | All opposition players receive a **Badge Renewal interrupt** — must complete a short 3s task at any desk within 90s or be locked out of all stations |
| 2 | `hr_policy_update` | HR desk | 4s | Opposition task hold time ×2 for 90s |

#### Finance Analyst — Finance Floor
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `finance_budget_freeze` | Finance desk | 4s | Opposition meter degrades +1% extra every 45s for 2 min |
| 2 | `finance_audit_trail` | Finance desk | 4s | +8% instant boost to workforce meter |

#### Marketing — Marketing Hub
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `marketing_pr_campaign` | Marketing desk | 4s | Opposition meter gains reduced 25% for 90s |
| 2 | `marketing_crisis_control` | Marketing desk | 4s | Removes one active opposition debuff from workforce |

#### Admin — Server Room entrance / Exec Suite
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `admin_lockdown` | Door panel | 5s | Opposition blocked from entering Server Room zone for 90s |
| 2 | `admin_keycard_audit` | Exec terminal | 4s | Monitoring console appends: last zone visited by most recently active opposition player (vague: "Badge activity in HR Corner 2 min ago") |

#### Management — Exec Suite
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `mgmt_sprint_planning` | Exec desk | 4s | All workforce move 30% faster for 90s |
| 2 | `mgmt_resource_allocation` | Exec desk | 4s | +10% instant boost to workforce meter |

---

### 5.2 Opposition Tasks

#### Hacker — Server Room
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `hacker_zero_day` | Terminal | 5s | +14% opposition meter, applies `hacker_corruption` debuff (slows IT terminal task for 60s) |
| 2 | `hacker_network_attack` | Network Closet router | 5s | Disables IT "Fix Server Rack" station for 3 min |

#### Social Engineer — Main Office / HR Corner
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `se_phishing` | Main Office desk | 4s | One random workforce player slowed 50% for 60s |
| 2 | `se_impersonation` | HR Corner desk | 4s | Social Engineer rendered as workforce colour/label for all other clients for 3 min |

#### Spy — Main Office
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `spy_intercept` | Main Office desk | 4s | Server sends opposition the zone name of the **last workforce task completed** |
| 2 | `spy_surveillance` | Main Office desk | 5s | Spy client enters 30s **ghost-camera mode** — camera orbits the last-active workforce player's position at isometric view |

#### Saboteur — Server Room / Network Closet
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `saboteur_server_logs` | Server Room monitor | 4s | Saboteur's client receives a monitoring console snapshot showing all 3 rack health values |
| 2 | `saboteur_power_cut` | Network Closet | 5s | All workforce task hold times ×2 for 90s |

#### Insider — Finance Floor / DevOps Den
| # | Task ID | Station type | Hold time | Effect on complete |
|---|---|---|---|---|
| 1 | `insider_leak_docs` | Finance Floor desk | 4s | Workforce meter -8% |
| 2 | `insider_corrupt_backups` | DevOps Den desk | 4s | Disables DevOps CI Pipeline speed bonus for remainder of match |

---

## 6. Station Interaction Flow

```
Player approaches station within INTERACT_R (2.5 units)
  → Server checks: does this player have an incomplete task at this station?
  → Yes: client shows "[E] — <task name>" prompt
  → Player holds E: client sends task_hold_start { stationId }
  → Server starts 4s (or 5s) countdown
  → If player walks away: task_hold_cancel → progress resets
  → If countdown completes: task_complete { stationId } → effect applied, meter updated
  → Task marked done (can't be repeated by same player this match)

Badge Renewal interrupt (HR Security Vetting):
  → Server broadcasts badge_renewal_required to all opposition clients
  → 90s timer starts
  → Each opposition player must: approach any desk + hold E for 3s
  → If timer expires without completion: player locked out of all stations until they complete it
  → Lockout lifted immediately on completing the badge renewal
```

---

## 7. Server State Changes

### GameState schema additions
```ts
// Replace:
terminalProgress: float32  // REMOVED

// Add:
workforceMeter:   float32  // 0–100
oppositionMeter:  float32  // 0–100
rackHealthA:      float32  // 0–100
rackHealthB:      float32  // 0–100
rackHealthC:      float32  // 0–100
```

### Player schema additions
```ts
// Keep (still used by Impersonation task effect):
disguised: boolean

// Add:
badgeRenewalRequired: boolean  // HR Security Vetting triggered
badgeRenewalDeadline: number   // clock time when lockout begins
```

### TaskStation schema (new, server-only — not synced)
```ts
interface TaskStation {
  stationId:    string          // e.g. 'server_room_0'
  zone:         string          // 'server_room'
  position:     { x: number; z: number }
  taskId:       string | null   // assigned at start_game, null if unoccupied zone
  completedBy:  string | null   // sessionId, or null
  disabledUntil: number         // clock time when station re-enables
}
```

### Messages — new/changed

#### Client → Server
```ts
| { type: 'task_hold_start';   stationId: string }
| { type: 'task_hold_cancel' }
| { type: 'badge_renewal_done' }
```

#### Server → Client
```ts
| { type: 'station_list';    stations: StationInfo[] }    // sent on game_start
| { type: 'task_complete';   taskId: string; role: string; effect: string }
| { type: 'meter_update';    workforce: number; opposition: number }
| { type: 'badge_renewal_required' }                      // HR triggers
| { type: 'badge_renewal_expired'; sessionId: string }    // lockout applied
| { type: 'monitor_snapshot'; rackA: number; rackB: number; rackC: number }  // DevOps/Saboteur
| { type: 'keycard_log';     entry: string }              // Admin keycard audit
| { type: 'ghost_camera';    targetX: number; targetZ: number; duration: number }  // Spy
| { type: 'effect_update' } & EffectUpdate                // existing, extended
```

### Removed messages
- `use_ability` (client → server)
- `ability_used` (server → client)
- `hr_ping`, `spy_sweep` (replaced by task effects)
- `task_start`, `task_stop` (replaced by `task_hold_start` / `task_hold_cancel`)

---

## 8. Active Effects (server-side)

Replace the existing `ActiveEffects` interface with:

```ts
interface ActiveEffects {
  // Workforce buffs (timed)
  itSpeedBoostUntil:       number   // devops CI pipeline
  workforceSpeedUntil:     number   // management sprint planning
  lockdownUntil:           number   // admin lockdown (blocks opp from server room)
  rackDegradePausedUntil:  number   // IT fix server

  // Hold-time multipliers (applied per-tick when player holds E at a station)
  workforceHoldMult:       number   // 1.0 normally; 2.0 during saboteur power cut
  oppositionHoldMult:      number   // 1.0 normally; 2.0 during HR policy update
  workforceHoldMultUntil:  number
  oppositionHoldMultUntil: number

  // Meter-gain multipliers (applied when a task completion adds % to meter)
  // workforce meter gain is unaffected by default
  // opposition meter gain: ×0.75 during marketing PR campaign
  oppositionMeterGainMult:       number   // 1.0 normally; 0.75 during marketing PR campaign
  oppositionMeterGainMultUntil:  number

  // Extra degradation rate (stacks on top of base -1%/45s)
  extraOppDegradeUntil:    number   // finance budget freeze: opp meter loses extra 1%/45s

  // One-shot flags
  hackerCorruptionUntil:   number   // hacker zero-day: IT terminal task hold time doubled
  ciPipelineDisabled:      boolean  // insider corrupt backups: DevOps CI buff blocked forever

  // Flags
  ciPipelineActive:        boolean  // devops task 1 done — halves IT hold time
  ciPipelineDisabled:      boolean  // insider corrupt backups
  badgeRenewalActive:      Set<string>  // sessionIds that must renew badge
  slowedPlayers:           Map<string, number>  // sessionId → slowed until (phishing)
}
```

---

## 9. HUD Changes (client)

### Remove
- Terminal progress bar
- Q key ability slot
- Effect banners (replaced by task completion toasts)

### Add
- **Team task meter** (prominent, bottom-centre): your team's %, animated fill
- **Opponent meter hint** (small, greyed): shows LOW (0-33) / MED (34-66) / HIGH (67-100)
- **Task checklist** (top-right panel): 2 entries — task name · zone hint · hold bar · ✓
- **Badge renewal urgent banner** (if triggered): countdown + "Find a desk [E]"
- **Task completion toast** (bottom-left): "DevOps: CI Pipeline — IT speed boosted 90s"
- **Natural degradation warning** at <20% meter: red pulsing border

### Monitoring console (Admin / Saboteur in-game UI)
- Triggered by reading the console station in Server Room
- Modal overlay showing 3 rack health bars
- Last intel log entry (if Admin keycard audit done)
- Closes on press E or Esc

---

## 10. Ghost Camera (Spy Surveillance)

When `ghost_camera` message received:
- Save current camera state
- Move camera to `{ targetX, targetZ }` (last-active workforce player position)
- Apply same isometric offset (8, 14, 8) relative to target
- Camera follows that position for `duration` ms
- Overlay: "SURVEILLANCE ACTIVE — 30s" countdown
- After duration: restore own camera
- Implementation: `ghostTarget = useRef<{ x: number, z: number } | null>(null)` in FollowCamera, overrides normal tracking when set

---

## 11. MVP Scope (Small map, hackathon)

For the hackathon, implement **Small map only** (1 floor):
- Zones: Main Office, Server Room, Network Closet
- Roles with zones on small map: IT, Hacker, Saboteur, Spy (intercept only), Social Engineer (phishing), Insider (needs Finance/DevOps — defer or reassign zones)
- For roles whose zones don't exist on small map, assign tasks to closest available zone

**Defer to post-hackathon:**
- Medium/Large map floors and staircase
- Spy `ghost_camera` — on small map, Spy Surveillance instead reveals the zone name of every workforce player currently at a station (sent as `incident` message)
- Badge renewal interrupt — on small map, HR Security Vetting simply applies `oppositionHoldMult = 2.0` for 90s (no badge renewal task required)
- Monitoring console physical UI — on small map, DevOps System Monitor and Saboteur Server Logs send their data as a `monitor_snapshot` message that pops up as an overlay modal; no interactive console object in-world needed

**Small map zone fallback for roles without their zone:**
Roles whose designated zone doesn't exist on small map use Main Office as a fallback.
| Role | Affected task | Fallback zone |
|---|---|---|
| DevOps | Both | Main Office |
| HR | Both | Main Office |
| Finance | Both | Main Office |
| Marketing | Both | Main Office |
| Admin | Task 2 (Keycard Audit) | Main Office |
| Management | Both | Main Office |
| Insider | Both | Main Office |

---

## 12. Implementation Order

1. **Shared types** — task IDs, zone IDs, new message types, remove old ability types
2. **Server GameState** — replace `terminalProgress` with meters + rack health
3. **Server GameRoom** — station assignment at start, hold mechanic, task completion effects, meter tick (degradation)
4. **Client store** — replace terminal progress with meters, add station list, task completion state
5. **Client GameWorld** — workstation meshes with glow when player has task there, hold-E progress bar
6. **Client GameScreen HUD** — team meters, task checklist, toast notifications
7. **Client BriefingScreen** — update to show task list instead of ability
8. **Bot AI** — update to navigate to and complete their role's task stations

---

## 13. Non-Goals

- Mini-games on tasks (hold E is sufficient for hackathon)
- Voting / ejection system
- Procedural room generation
- NPC background workers
- Third floor
