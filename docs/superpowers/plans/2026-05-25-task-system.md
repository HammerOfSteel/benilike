# Task System Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the single-terminal repair/hack system and Q ability system with a role-based task system — each role has 2 tasks at workstations across zones; first team to 100% task meter wins.

**Architecture:** Seed-based station assignment at `start_game`. Players hold E at stations in their assigned zone; server validates and applies effects on completion. Team meters replace `terminalProgress`. Small map MVP (1 floor: Main Office, Server Room, Network Closet).

**Tech Stack:** Colyseus 0.15 (server), React 18 + R3F v8 (client), Zustand v5, TypeScript 5.6, `@colyseus/schema` v2.

**Spec:** `docs/superpowers/specs/2026-05-25-task-system-design.md`

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `shared/src/types.ts` | Remove ability constants; add task/zone/station/message types |
| Create | `shared/src/tasks.ts` | All 14 task definitions, zone list, station positions, seed assignment fn |
| Modify | `server/src/rooms/GameState.ts` | Replace `terminalProgress`/trap/lockdown with meters + rack health |
| Modify | `server/src/rooms/GameRoom.ts` | Full rewrite of game logic — station hold, completion effects, meter tick |
| Modify | `client/src/store/useGameRoom.ts` | Replace terminal progress + ability state with meters + station state |
| Modify | `client/src/game/useKeyboard.ts` | Remove `KeyQ` from BLOCKED |
| Modify | `client/src/game/GameWorld.tsx` | Workstations + hold-E + ghost camera; remove Q ability |
| Modify | `client/src/components/screens/GameScreen.tsx` | Team meters + task checklist + toasts; remove ability HUD |
| Modify | `client/src/components/screens/BriefingScreen.tsx` | Show task list instead of Q ability |
| Modify | `client/src/components/screens/screens.module.css` | New meter + task checklist styles; remove ability styles |

---

## Task 1: Shared types — remove ability system, add task/zone/station types

**Files:**
- Modify: `shared/src/types.ts`
- Create: `shared/src/tasks.ts`

- [ ] **Step 1.1 — Replace `shared/src/types.ts`**

Replace the entire file with:

```ts
// ── Factions & Roles ─────────────────────────────────────────────────────────

export type Faction = 'workforce' | 'opposition'

export type WorkforceRole =
  | 'it' | 'hr' | 'devops' | 'finance' | 'marketing' | 'admin' | 'management'

export type OppositionRole =
  | 'hacker' | 'social_engineer' | 'spy' | 'saboteur' | 'insider'

export type PlayerRole = WorkforceRole | OppositionRole

// ── Room options ──────────────────────────────────────────────────────────────

export interface RoomOptions {
  roomName:          string
  mapSize:           'small' | 'medium' | 'large'
  maxPlayers:        number
  factionAssignment: 'random' | 'manual' | 'balanced'
  botCount:          number
}

// ── Task & Zone types ─────────────────────────────────────────────────────────

export type ZoneId =
  | 'main_office' | 'server_room' | 'network_closet'    // small
  | 'hr_corner' | 'finance_floor' | 'devops_den'        // medium adds
  | 'marketing_hub' | 'exec_suite' | 'opposition_den'   // large adds

export type TaskId =
  // Workforce
  | 'it_repair_terminal' | 'it_fix_server'
  | 'devops_ci_pipeline' | 'devops_system_monitor'
  | 'hr_security_vetting' | 'hr_policy_update'
  | 'finance_budget_freeze' | 'finance_audit_trail'
  | 'marketing_pr_campaign' | 'marketing_crisis_control'
  | 'admin_lockdown' | 'admin_keycard_audit'
  | 'mgmt_sprint_planning' | 'mgmt_resource_allocation'
  // Opposition
  | 'hacker_zero_day' | 'hacker_network_attack'
  | 'se_phishing' | 'se_impersonation'
  | 'spy_intercept' | 'spy_surveillance'
  | 'saboteur_server_logs' | 'saboteur_power_cut'
  | 'insider_leak_docs' | 'insider_corrupt_backups'

export interface TaskDef {
  id:          TaskId
  role:        PlayerRole
  name:        string
  zone:        ZoneId          // preferred zone (may fall back on small map)
  holdMs:      number          // milliseconds to hold E
  meterGain:   number          // % added to team meter on completion (0 if effect-only)
  effectDesc:  string          // human-readable effect description
}

export interface StationInfo {
  stationId:   string          // e.g. 'server_room_0'
  zone:        ZoneId
  x:           number
  z:           number
  taskId:      TaskId | null   // null = generic, no task assigned here
}

// ── Client → Server messages ──────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'move';             x: number; z: number; facing?: number }
  | { type: 'task_hold_start';  stationId: string }
  | { type: 'task_hold_cancel' }
  | { type: 'badge_renewal_done' }
  | { type: 'chat';             text: string }

// ── Server → Client messages ──────────────────────────────────────────────────

export type EffectUpdate = {
  workforceSpeedActive:  boolean
  lockdownActive:        boolean
  workforceHoldSlow:     boolean   // saboteur power cut
  oppositionHoldSlow:    boolean   // HR policy update
  hackerCorruption:      boolean   // hacker zero-day slows IT terminal task
  ciPipelineActive:      boolean   // DevOps CI pipeline halves IT hold time
  badgeRenewalRequired:  boolean   // HR security vetting — local player must renew
}

export type ServerMessage =
  | { type: 'role_assigned';    role: PlayerRole; faction: Faction }
  | { type: 'incident';         message: string; severity: 'info' | 'warn' | 'danger'; time: string }
  | { type: 'game_start';       seed: string; mapSize: RoomOptions['mapSize'] }
  | { type: 'game_end';         winner: Faction; reason: string }
  | { type: 'station_list';     stations: StationInfo[] }
  | { type: 'task_complete';    taskId: TaskId; role: PlayerRole; effectDesc: string; meterGain: number }
  | { type: 'meter_update';     workforce: number; opposition: number }
  | { type: 'badge_renewal_required' }
  | { type: 'monitor_snapshot'; rackA: number; rackB: number; rackC: number }
  | { type: 'keycard_log';      entry: string }
  | { type: 'ghost_camera';     targetX: number; targetZ: number; duration: number }
  | { type: 'effect_update' } & EffectUpdate

// ── Shared constants ──────────────────────────────────────────────────────────

export const WORKFORCE_ROLES: WorkforceRole[] = [
  'it', 'hr', 'devops', 'finance', 'marketing', 'admin', 'management',
]

export const OPPOSITION_ROLES: OppositionRole[] = [
  'hacker', 'social_engineer', 'spy', 'saboteur', 'insider',
]

export const ROLE_LABELS: Record<PlayerRole, string> = {
  it:              'IT Technician',
  hr:              'HR Officer',
  devops:          'DevOps Engineer',
  finance:         'Finance Analyst',
  marketing:       'Marketing',
  admin:           'Admin',
  management:      'Management',
  hacker:          'Hacker',
  social_engineer: 'Social Engineer',
  spy:             'Spy',
  saboteur:        'Saboteur',
  insider:         'Insider Threat',
}

export const DEFAULT_REPUTATION = 100
export const SERVER_PORT        = 2567

// Meter gain per task completion (all roles contribute equally)
export const TASK_METER_GAIN = 14   // 7 tasks × 14 = 98% + instant boosts push past 100
export const METER_DEGRADE_INTERVAL_MS  = 45_000
export const RACK_DEGRADE_INTERVAL_MS   = 30_000
```

- [ ] **Step 1.2 — Create `shared/src/tasks.ts`**

```ts
import type { TaskDef, ZoneId } from './types'

// ── Zone definitions ──────────────────────────────────────────────────────────

export interface ZoneDef {
  id:           ZoneId
  displayName:  string
  // Station slot world positions within this zone
  stations:     Array<{ x: number; z: number }>
  // Which map sizes include this zone
  mapSizes:     Array<'small' | 'medium' | 'large'>
}

export const ZONES: ZoneDef[] = [
  {
    id: 'main_office', displayName: 'Main Office',
    stations: [
      { x: -6, z: -4 }, { x: -2, z: -4 }, { x: 2, z: -4 }, { x: 6, z: -4 },
      { x: -6, z:  0 }, { x: -2, z:  0 }, { x: 2, z:  0 }, { x: 6, z:  0 },
    ],
    mapSizes: ['small', 'medium', 'large'],
  },
  {
    id: 'server_room', displayName: 'Server Room',
    stations: [
      { x:  0,   z: -11.5 },  // main terminal
      { x: -5,   z: -14   },  // rack A
      { x:  5,   z: -14   },  // rack B
    ],
    mapSizes: ['small', 'medium', 'large'],
  },
  {
    id: 'network_closet', displayName: 'Network Closet',
    stations: [
      { x: -10, z: -2 },
      { x: -10, z: -4 },
    ],
    mapSizes: ['small', 'medium', 'large'],
  },
  {
    id: 'hr_corner', displayName: 'HR Corner',
    stations: [
      { x: -7, z: 3 }, { x: -5, z: 3 }, { x: -6, z: 5 },
    ],
    mapSizes: ['medium', 'large'],
  },
  {
    id: 'finance_floor', displayName: 'Finance Floor',
    stations: [
      { x: 5, z: 3 }, { x: 7, z: 3 }, { x: 6, z: 5 },
    ],
    mapSizes: ['medium', 'large'],
  },
  {
    id: 'devops_den', displayName: 'DevOps Den',
    stations: [
      { x: -2, z: -5 }, { x: 0, z: -5 }, { x: 2, z: -5 },
    ],
    mapSizes: ['medium', 'large'],
  },
  {
    id: 'marketing_hub', displayName: 'Marketing Hub',
    stations: [
      { x: -7, z: -3 }, { x: -5, z: -3 }, { x: -6, z: -5 },
    ],
    mapSizes: ['large'],
  },
  {
    id: 'exec_suite', displayName: 'Exec Suite',
    stations: [
      { x: 5, z: -3 }, { x: 7, z: -3 }, { x: 6, z: -5 },
    ],
    mapSizes: ['large'],
  },
]

// ── Task definitions ──────────────────────────────────────────────────────────

export const TASK_DEFS: TaskDef[] = [
  // IT
  { id: 'it_repair_terminal',   role: 'it',      name: 'Repair Terminal',    zone: 'server_room',    holdMs: 5000, meterGain: 14, effectDesc: 'Removes hacker corruption' },
  { id: 'it_fix_server',        role: 'it',      name: 'Fix Server Rack',    zone: 'server_room',    holdMs: 5000, meterGain: 14, effectDesc: 'Pauses rack degradation 3 min' },
  // DevOps
  { id: 'devops_ci_pipeline',   role: 'devops',  name: 'CI Pipeline',        zone: 'devops_den',     holdMs: 4000, meterGain: 14, effectDesc: 'IT task speed ×2 for 90s' },
  { id: 'devops_system_monitor',role: 'devops',  name: 'System Monitor',     zone: 'devops_den',     holdMs: 4000, meterGain: 14, effectDesc: 'Admin gets server health snapshot' },
  // HR
  { id: 'hr_security_vetting',  role: 'hr',      name: 'Security Vetting',   zone: 'hr_corner',      holdMs: 4000, meterGain: 14, effectDesc: 'Opposition task speed ×2 for 90s' },
  { id: 'hr_policy_update',     role: 'hr',      name: 'Policy Update',      zone: 'hr_corner',      holdMs: 4000, meterGain: 14, effectDesc: 'Opposition task speed ×2 for 90s' },
  // Finance
  { id: 'finance_budget_freeze',role: 'finance', name: 'Budget Freeze',      zone: 'finance_floor',  holdMs: 4000, meterGain: 14, effectDesc: 'Opposition meter degrades faster 2 min' },
  { id: 'finance_audit_trail',  role: 'finance', name: 'Audit Trail',        zone: 'finance_floor',  holdMs: 4000, meterGain: 0,  effectDesc: '+8% instant meter boost' },
  // Marketing
  { id: 'marketing_pr_campaign',    role: 'marketing', name: 'PR Campaign',    zone: 'marketing_hub', holdMs: 4000, meterGain: 14, effectDesc: 'Opposition meter gains -25% for 90s' },
  { id: 'marketing_crisis_control', role: 'marketing', name: 'Crisis Control', zone: 'marketing_hub', holdMs: 4000, meterGain: 14, effectDesc: 'Removes one opposition debuff' },
  // Admin
  { id: 'admin_lockdown',       role: 'admin',   name: 'Server Room Lockdown', zone: 'server_room',  holdMs: 5000, meterGain: 14, effectDesc: 'Blocks opposition from Server Room 90s' },
  { id: 'admin_keycard_audit',  role: 'admin',   name: 'Keycard Audit',      zone: 'exec_suite',     holdMs: 4000, meterGain: 14, effectDesc: 'Vague intel on last opposition activity' },
  // Management
  { id: 'mgmt_sprint_planning',     role: 'management', name: 'Sprint Planning',     zone: 'exec_suite', holdMs: 4000, meterGain: 14, effectDesc: 'Workforce move 30% faster 90s' },
  { id: 'mgmt_resource_allocation', role: 'management', name: 'Resource Allocation', zone: 'exec_suite', holdMs: 4000, meterGain: 0,  effectDesc: '+10% instant meter boost' },
  // Hacker
  { id: 'hacker_zero_day',      role: 'hacker',  name: 'Zero-Day Exploit',   zone: 'server_room',    holdMs: 5000, meterGain: 14, effectDesc: 'Corrupts IT terminal task 60s' },
  { id: 'hacker_network_attack',role: 'hacker',  name: 'Network Attack',     zone: 'network_closet', holdMs: 5000, meterGain: 14, effectDesc: 'Disables IT Fix Server 3 min' },
  // Social Engineer
  { id: 'se_phishing',          role: 'social_engineer', name: 'Phishing Campaign', zone: 'main_office', holdMs: 4000, meterGain: 14, effectDesc: 'Random workforce player slowed 60s' },
  { id: 'se_impersonation',     role: 'social_engineer', name: 'Impersonation',     zone: 'hr_corner',   holdMs: 4000, meterGain: 14, effectDesc: 'Appear as workforce for 3 min' },
  // Spy
  { id: 'spy_intercept',        role: 'spy',     name: 'Intercept Comms',    zone: 'main_office',    holdMs: 4000, meterGain: 14, effectDesc: 'Reveals zone of last workforce task' },
  { id: 'spy_surveillance',     role: 'spy',     name: 'Surveillance',       zone: 'main_office',    holdMs: 5000, meterGain: 14, effectDesc: 'Reveals all workforce active zones 30s' },
  // Saboteur
  { id: 'saboteur_server_logs', role: 'saboteur',name: 'Read Server Logs',   zone: 'server_room',    holdMs: 4000, meterGain: 14, effectDesc: 'See all rack health values' },
  { id: 'saboteur_power_cut',   role: 'saboteur',name: 'Power Cut',          zone: 'network_closet', holdMs: 5000, meterGain: 14, effectDesc: 'Workforce task hold time ×2 for 90s' },
  // Insider
  { id: 'insider_leak_docs',    role: 'insider', name: 'Leak Documents',     zone: 'finance_floor',  holdMs: 4000, meterGain: 14, effectDesc: 'Workforce meter -8%' },
  { id: 'insider_corrupt_backups', role: 'insider', name: 'Corrupt Backups', zone: 'devops_den',     holdMs: 4000, meterGain: 14, effectDesc: 'Disables DevOps CI Pipeline' },
]

// ── Seed-based station assignment ─────────────────────────────────────────────

/** Fisher-Yates shuffle seeded by a string */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) | 0
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * For each task whose preferred zone is available, assign it to a shuffled slot
 * in that zone. Falls back to main_office for zones not on this map size.
 * Returns a flat list of StationInfo for all slots across all zones.
 */
export function assignStations(
  seed: string,
  mapSize: 'small' | 'medium' | 'large',
  tasks: TaskDef[],
): import('./types').StationInfo[] {
  const availableZoneIds = new Set(
    ZONES.filter(z => z.mapSizes.includes(mapSize)).map(z => z.id)
  )

  const stations: import('./types').StationInfo[] = []

  for (const zone of ZONES) {
    if (!zone.mapSizes.includes(mapSize)) continue

    // Tasks assigned to this zone (prefer zone, else main_office fallback tasks)
    const zoneTasks = tasks.filter(t =>
      (t.zone === zone.id) ||
      (t.zone === zone.id) // exact match only — fallbacks handled below
    )
    const shuffledSlots = seededShuffle([...zone.stations], seed + zone.id)

    shuffledSlots.forEach((pos, i) => {
      stations.push({
        stationId: `${zone.id}_${i}`,
        zone: zone.id,
        x: pos.x,
        z: pos.z,
        taskId: null,  // assigned below
      })
    })
  }

  // Assign tasks to station slots
  const stationsByZone = new Map<ZoneId, typeof stations>()
  for (const s of stations) {
    if (!stationsByZone.has(s.zone)) stationsByZone.set(s.zone, [])
    stationsByZone.get(s.zone)!.push(s)
  }

  for (const task of tasks) {
    const targetZone = (availableZoneIds.has(task.zone) ? task.zone : 'main_office') as ZoneId
    const slots = stationsByZone.get(targetZone) ?? []
    const freeSlot = slots.find(s => s.taskId === null)
    if (freeSlot) freeSlot.taskId = task.id
  }

  return stations
}
```

- [ ] **Step 1.3 — Verify TypeScript compiles**

```bash
cd /Users/terrygoleman/Documents/dev/games/benilike
npx tsc --noEmit -p shared/tsconfig.json 2>&1 | head -30
```

Expected: no errors (or only pre-existing rootDir warnings).

- [ ] **Step 1.4 — Commit**

```bash
git add shared/src/types.ts shared/src/tasks.ts
git commit -m "feat(tasks): shared task/zone/station types, remove ability system"
```

---

## Task 2: Server GameState schema

**Files:**
- Modify: `server/src/rooms/GameState.ts`

- [ ] **Step 2.1 — Replace `GameState.ts`**

```ts
import 'reflect-metadata'
import { Schema, type, MapSchema } from '@colyseus/schema'

export class Player extends Schema {
  @type('string')  sessionId: string  = ''
  @type('string')  name: string       = ''
  @type('string')  role: string       = ''
  @type('string')  faction: string    = ''
  @type('float32') x: number          = 0
  @type('float32') z: number          = 0
  @type('float32') facing: number     = 0
  @type('boolean') connected: boolean = true
  @type('boolean') isBot: boolean     = false
  @type('boolean') disguised: boolean = false   // Social Engineer impersonation task
  @type('boolean') slowed: boolean    = false   // Phishing campaign effect
}

export class GameState extends Schema {
  @type({ map: Player }) players    = new MapSchema<Player>()
  @type('string')        phase      = 'waiting'   // waiting | playing | ended
  @type('string')        mapSeed    = ''
  @type('string')        mapSize    = 'medium'
  @type('string')        winner     = ''
  @type('float32')       workforceMeter:  number = 0
  @type('float32')       oppositionMeter: number = 0
  @type('float32')       rackHealthA:     number = 100
  @type('float32')       rackHealthB:     number = 100
  @type('float32')       rackHealthC:     number = 100
  @type('boolean')       lockdownActive:  boolean = false
}
```

- [ ] **Step 2.2 — Verify**

```bash
cd /Users/terrygoleman/Documents/dev/games/benilike
npx tsc --noEmit -p server/tsconfig.json 2>&1 | head -30
```

Expected: errors only from GameRoom.ts (which we haven't updated yet) — that's fine.

- [ ] **Step 2.3 — Commit**

```bash
git add server/src/rooms/GameState.ts
git commit -m "feat(tasks): server GameState — team meters + rack health, remove old progress"
```

---

## Task 3: Server GameRoom — station assignment + hold mechanic

**Files:**
- Modify: `server/src/rooms/GameRoom.ts`

This is the largest change. Replace the entire file.

- [ ] **Step 3.1 — Replace `GameRoom.ts`**

```ts
import { Room, Client } from 'colyseus'
import { GameState, Player } from './GameState'
import {
  WORKFORCE_ROLES,
  OPPOSITION_ROLES,
  TASK_METER_GAIN,
  METER_DEGRADE_INTERVAL_MS,
  RACK_DEGRADE_INTERVAL_MS,
  type PlayerRole,
  type RoomOptions,
  type TaskId,
  type StationInfo,
  type ZoneId,
} from '../../../shared/src/types'
import { TASK_DEFS, assignStations, ZONES } from '../../../shared/src/tasks'

const OPPOSITION_RATIO = 0.25
const INTERACT_R       = 2.5   // must match client

const BOT_NAMES = [
  'AGENT-7', 'UNIT-X', 'PROTO-9', 'GHOST-3', 'SIGMA-1',
  'DELTA-4', 'ECHO-2', 'ZETA-6', 'OMEGA-8', 'KILO-5',
]

interface ActiveEffects {
  // Workforce buffs
  workforceSpeedUntil:      number   // management sprint planning
  lockdownUntil:            number   // admin lockdown
  rackDegradePausedUntil:   number   // IT fix server
  ciPipelineUntil:          number   // devops CI (halves IT hold time)
  ciPipelineDisabled:       boolean  // insider corrupt backups

  // Debuffs applied to workforce
  workforceHoldSlowUntil:   number   // saboteur power cut (×2 hold time)
  hackerCorruptionUntil:    number   // hacker zero-day (IT terminal task ×2 hold)

  // Debuffs applied to opposition
  oppositionHoldSlowUntil:  number   // HR security vetting / policy update (×2)
  extraOppDegradeUntil:     number   // finance budget freeze

  // Opposition gain penalty
  oppMeterGainMultUntil:    number   // marketing PR campaign
  oppMeterGainMult:         number   // 0.75 when active
}

interface StationState {
  info:          StationInfo
  disabledUntil: number
  completedBy:   string | null   // sessionId
}

interface HoldState {
  stationId:  string
  startedAt:  number
  holdMs:     number
}

export class GameRoom extends Room<GameState> {
  maxClients = 10
  private botCleanup: (() => void) | null = null
  private botAI = new Map<string, { mode: 'wander' | 'work'; workUntil: number; targetStation: string | null }>()
  private stations  = new Map<string, StationState>()
  private holdState = new Map<string, HoldState>()    // sessionId → current hold
  private effects: ActiveEffects = {
    workforceSpeedUntil:     0,
    lockdownUntil:           0,
    rackDegradePausedUntil:  0,
    ciPipelineUntil:         0,
    ciPipelineDisabled:      false,
    workforceHoldSlowUntil:  0,
    hackerCorruptionUntil:   0,
    oppositionHoldSlowUntil: 0,
    extraOppDegradeUntil:    0,
    oppMeterGainMultUntil:   0,
    oppMeterGainMult:        1.0,
  }

  onCreate(options: Partial<RoomOptions>) {
    this.setState(new GameState())
    this.state.mapSize = options.mapSize ?? 'medium'
    this.state.mapSeed = Math.random().toString(36).slice(2, 8).toUpperCase()

    // ── Message handlers ─────────────────────────────────────────────────────

    this.onMessage('move', (client: Client, data: { x: number; z: number; facing?: number }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return
      player.x = data.x
      player.z = data.z
      player.facing = data.facing ?? player.facing

      // Cancel hold if player moves too far from station
      const hold = this.holdState.get(client.sessionId)
      if (hold) {
        const station = this.stations.get(hold.stationId)
        if (station) {
          const dx = data.x - station.info.x
          const dz = data.z - station.info.z
          if (Math.sqrt(dx * dx + dz * dz) > INTERACT_R) {
            this.holdState.delete(client.sessionId)
            client.send('incident', { message: 'Task interrupted', severity: 'info', time: timestamp() })
          }
        }
      }
    })

    this.onMessage('start_game', (client: Client) => {
      const players = Array.from(this.state.players.values())
      const host = players.find(p => !p.isBot)
      if (host?.sessionId !== client.sessionId) return
      if (this.state.phase !== 'waiting') return

      this.state.phase = 'playing'

      // Assign stations
      const mapSize = this.state.mapSize as 'small' | 'medium' | 'large'
      const stationList = assignStations(this.state.mapSeed, mapSize, TASK_DEFS)
      for (const info of stationList) {
        this.stations.set(info.stationId, { info, disabledUntil: 0, completedBy: null })
      }

      // Insiders start disguised
      this.state.players.forEach(p => { if (p.role === 'insider') p.disguised = true })

      // Broadcast station list to all clients
      this.broadcast('game_start', { seed: this.state.mapSeed, mapSize })
      this.broadcast('station_list', { stations: stationList })
      this.broadcastEffects()
      console.log(`[GameRoom] Game started · ${stationList.length} stations assigned`)
    })

    this.onMessage('task_hold_start', (client: Client, data: { stationId: string }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || this.state.phase !== 'playing') return

      const station = this.stations.get(data.stationId)
      if (!station) return

      // Already completed?
      if (station.completedBy) return

      // Disabled?
      if (station.disabledUntil > this.clock.currentTime) {
        client.send('incident', { message: 'Station offline', severity: 'warn', time: timestamp() })
        return
      }

      // Admin lockdown — opposition can't enter server room
      if (player.faction === 'opposition' && station.info.zone === 'server_room' &&
          this.effects.lockdownUntil > this.clock.currentTime) {
        client.send('incident', { message: 'SERVER ROOM LOCKED', severity: 'danger', time: timestamp() })
        return
      }

      // Does this player have a task at this station?
      const taskDef = station.info.taskId ? TASK_DEFS.find(t => t.id === station.info.taskId) : null
      if (!taskDef || taskDef.role !== player.role) return

      // Badge renewal lockout
      if ((player as any).badgeLockout) return

      // Calculate hold time with multipliers
      let holdMs = taskDef.holdMs
      const now = this.clock.currentTime

      if (player.faction === 'workforce') {
        if (this.effects.workforceHoldSlowUntil > now) holdMs *= 2
        // CI Pipeline halves IT terminal task
        if (taskDef.id === 'it_repair_terminal' && this.effects.ciPipelineUntil > now && !this.effects.ciPipelineDisabled) holdMs = Math.ceil(holdMs / 2)
        // Hacker corruption slows IT terminal task
        if (taskDef.id === 'it_repair_terminal' && this.effects.hackerCorruptionUntil > now) holdMs *= 2
      } else {
        if (this.effects.oppositionHoldSlowUntil > now) holdMs *= 2
      }

      this.holdState.set(client.sessionId, {
        stationId: data.stationId,
        startedAt: now,
        holdMs,
      })
    })

    this.onMessage('task_hold_cancel', (client: Client) => {
      this.holdState.delete(client.sessionId)
    })

    this.onMessage('badge_renewal_done', (client: Client) => {
      const player = this.state.players.get(client.sessionId) as any
      if (player) {
        player.badgeLockout = false
        player.badgeLockoutUntil = 0
      }
    })

    // ── Hold progress tick (200ms) ───────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      const now = this.clock.currentTime

      for (const [sessionId, hold] of this.holdState) {
        if (now - hold.startedAt >= hold.holdMs) {
          this.holdState.delete(sessionId)
          this.completeTask(sessionId, hold.stationId)
        }
      }
    }, 200)

    // ── Meter degradation tick ───────────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      const now = this.clock.currentTime

      // Both meters degrade
      this.state.workforceMeter  = Math.max(0, this.state.workforceMeter  - 1)
      this.state.oppositionMeter = Math.max(0, this.state.oppositionMeter - 1)

      // Finance budget freeze: extra opposition degradation
      if (this.effects.extraOppDegradeUntil > now) {
        this.state.oppositionMeter = Math.max(0, this.state.oppositionMeter - 1)
      }

      this.broadcast('meter_update', {
        workforce:  this.state.workforceMeter,
        opposition: this.state.oppositionMeter,
      })
    }, METER_DEGRADE_INTERVAL_MS)

    // ── Rack degradation tick ────────────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      if (this.effects.rackDegradePausedUntil > this.clock.currentTime) return

      this.state.rackHealthA = Math.max(0, this.state.rackHealthA - 1)
      this.state.rackHealthB = Math.max(0, this.state.rackHealthB - 1)
      this.state.rackHealthC = Math.max(0, this.state.rackHealthC - 1)
    }, RACK_DEGRADE_INTERVAL_MS)

    // ── Lockdown sync ────────────────────────────────────────────────────────
    this.clock.setInterval(() => {
      const locked = this.effects.lockdownUntil > this.clock.currentTime
      if (this.state.lockdownActive !== locked) {
        this.state.lockdownActive = locked
        if (!locked) this.broadcastEffects()
      }
    }, 1_000)

    const botCount = Math.min(Math.max(0, options.botCount ?? 0), 9)
    if (botCount > 0) this.spawnBots(botCount)

    console.log(`[GameRoom] Created · seed ${this.state.mapSeed} · bots ${botCount}`)
  }

  // ── Task completion ───────────────────────────────────────────────────────

  private completeTask(sessionId: string, stationId: string) {
    const station = this.stations.get(stationId)
    const player  = this.state.players.get(sessionId)
    if (!station || !player) return
    if (station.completedBy) return

    station.completedBy = sessionId

    const taskDef = station.info.taskId ? TASK_DEFS.find(t => t.id === station.info.taskId) : null
    if (!taskDef) return

    const now = this.clock.currentTime

    // Add base meter gain
    if (taskDef.meterGain > 0) {
      if (player.faction === 'workforce') {
        this.state.workforceMeter = Math.min(100, this.state.workforceMeter + taskDef.meterGain)
      } else {
        const gain = taskDef.meterGain * (this.effects.oppMeterGainMultUntil > now ? this.effects.oppMeterGainMult : 1.0)
        this.state.oppositionMeter = Math.min(100, this.state.oppositionMeter + gain)
      }
    }

    // Apply task-specific effects
    this.applyTaskEffect(taskDef.id as TaskId, sessionId, player)

    // Broadcast
    this.broadcast('task_complete', {
      taskId: taskDef.id,
      role: player.role,
      effectDesc: taskDef.effectDesc,
      meterGain: taskDef.meterGain,
    })
    this.broadcast('meter_update', {
      workforce:  this.state.workforceMeter,
      opposition: this.state.oppositionMeter,
    })
    this.broadcastEffects()
    this.checkEndConditions()

    console.log(`[GameRoom] ${player.name} (${player.role}) completed task: ${taskDef.id}`)
  }

  private applyTaskEffect(taskId: TaskId, sessionId: string, player: Player) {
    const now = this.clock.currentTime

    switch (taskId) {

      // ── Workforce ──────────────────────────────────────────────────────────

      case 'it_repair_terminal':
        this.effects.hackerCorruptionUntil = 0
        break

      case 'it_fix_server':
        this.state.rackHealthA = Math.min(100, this.state.rackHealthA + 40)
        this.effects.rackDegradePausedUntil = now + 180_000
        break

      case 'devops_ci_pipeline':
        if (!this.effects.ciPipelineDisabled) {
          this.effects.ciPipelineUntil = now + 90_000
          this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        }
        break

      case 'devops_system_monitor':
        // Send Admin the monitoring snapshot
        this.state.players.forEach((p, sid) => {
          if (p.role === 'admin' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('monitor_snapshot', {
              rackA: this.state.rackHealthA,
              rackB: this.state.rackHealthB,
              rackC: this.state.rackHealthC,
            })
          }
        })
        break

      case 'hr_security_vetting':
      case 'hr_policy_update':
        this.effects.oppositionHoldSlowUntil = now + 90_000
        this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        break

      case 'finance_budget_freeze':
        this.effects.extraOppDegradeUntil = now + 120_000
        break

      case 'finance_audit_trail':
        this.state.workforceMeter = Math.min(100, this.state.workforceMeter + 8)
        break

      case 'marketing_pr_campaign':
        this.effects.oppMeterGainMult     = 0.75
        this.effects.oppMeterGainMultUntil = now + 90_000
        this.clock.setTimeout(() => {
          this.effects.oppMeterGainMult = 1.0
          this.broadcastEffects()
        }, 90_000)
        break

      case 'marketing_crisis_control':
        // Remove the longest-running active opposition debuff
        if (this.effects.workforceHoldSlowUntil > now) this.effects.workforceHoldSlowUntil = 0
        else if (this.effects.hackerCorruptionUntil > now) this.effects.hackerCorruptionUntil = 0
        break

      case 'admin_lockdown':
        this.effects.lockdownUntil = now + 90_000
        this.state.lockdownActive  = true
        this.clock.setTimeout(() => {
          this.state.lockdownActive = false
          this.broadcastEffects()
        }, 90_000)
        break

      case 'admin_keycard_audit': {
        // Find most recently active opposition player
        let lastOpp: Player | null = null
        for (const p of this.state.players.values()) {
          if (p.faction === 'opposition' && !lastOpp) lastOpp = p
        }
        const entry = lastOpp
          ? `Badge activity detected — zone unknown — ${new Date().toLocaleTimeString()}`
          : 'No recent badge activity'
        this.state.players.forEach((p, sid) => {
          if (p.role === 'admin' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('keycard_log', { entry })
          }
        })
        break
      }

      case 'mgmt_sprint_planning':
        this.effects.workforceSpeedUntil = now + 90_000
        this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        break

      case 'mgmt_resource_allocation':
        this.state.workforceMeter = Math.min(100, this.state.workforceMeter + 10)
        break

      // ── Opposition ─────────────────────────────────────────────────────────

      case 'hacker_zero_day':
        this.effects.hackerCorruptionUntil = now + 60_000
        this.clock.setTimeout(() => this.broadcastEffects(), 60_000)
        break

      case 'hacker_network_attack': {
        // Disable IT fix server station
        for (const [, st] of this.stations) {
          if (st.info.taskId === 'it_fix_server') {
            st.disabledUntil = now + 180_000
          }
        }
        break
      }

      case 'se_phishing': {
        // Slow a random workforce player
        const wfPlayers = Array.from(this.state.players.values())
          .filter(p => p.faction === 'workforce' && p.connected)
        if (wfPlayers.length > 0) {
          const target = wfPlayers[Math.floor(Math.random() * wfPlayers.length)]
          target.slowed = true
          this.clock.setTimeout(() => { target.slowed = false }, 60_000)
        }
        break
      }

      case 'se_impersonation':
        player.disguised = true
        this.clock.setTimeout(() => { player.disguised = false }, 180_000)
        break

      case 'spy_intercept': {
        // Tell all opposition the zone of the last completed workforce task
        let lastZone: string = 'unknown'
        for (const [, st] of this.stations) {
          if (st.completedBy) {
            const completer = this.state.players.get(st.completedBy)
            if (completer?.faction === 'workforce') lastZone = st.info.zone
          }
        }
        this.state.players.forEach((p, sid) => {
          if (p.faction === 'opposition' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('incident', {
              message: `Intel: Last workforce task in ${lastZone.replace('_', ' ')}`,
              severity: 'info',
              time: timestamp(),
            })
          }
        })
        break
      }

      case 'spy_surveillance': {
        // Send ghost_camera: target = last active workforce player position
        let target: { x: number; z: number } | null = null
        for (const p of this.state.players.values()) {
          if (p.faction === 'workforce') { target = { x: p.x, z: p.z }; break }
        }
        if (target) {
          const c = this.clients.find(cl => cl.sessionId === sessionId)
          c?.send('ghost_camera', { targetX: target.x, targetZ: target.z, duration: 30_000 })
        }
        break
      }

      case 'saboteur_server_logs': {
        const c = this.clients.find(cl => cl.sessionId === sessionId)
        c?.send('monitor_snapshot', {
          rackA: this.state.rackHealthA,
          rackB: this.state.rackHealthB,
          rackC: this.state.rackHealthC,
        })
        break
      }

      case 'saboteur_power_cut':
        this.effects.workforceHoldSlowUntil = now + 90_000
        this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        break

      case 'insider_leak_docs':
        this.state.workforceMeter = Math.max(0, this.state.workforceMeter - 8)
        break

      case 'insider_corrupt_backups':
        this.effects.ciPipelineDisabled = true
        this.effects.ciPipelineUntil    = 0
        break
    }
  }

  private broadcastEffects() {
    const now = this.clock.currentTime
    this.broadcast('effect_update', {
      workforceSpeedActive: this.effects.workforceSpeedUntil > now,
      lockdownActive:       this.effects.lockdownUntil > now,
      workforceHoldSlow:    this.effects.workforceHoldSlowUntil > now,
      oppositionHoldSlow:   this.effects.oppositionHoldSlowUntil > now,
      hackerCorruption:     this.effects.hackerCorruptionUntil > now,
      ciPipelineActive:     !this.effects.ciPipelineDisabled && this.effects.ciPipelineUntil > now,
      badgeRenewalRequired: false,
    })
  }

  // ── Bot spawning ──────────────────────────────────────────────────────────

  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const bot        = new Player()
      bot.sessionId    = `bot_${i}`
      bot.name         = BOT_NAMES[i] ?? `BOT-${i}`
      bot.isBot        = true
      bot.connected    = true
      bot.x            = (Math.random() - 0.5) * 16
      bot.z            = (Math.random() - 0.5) * 12
      bot.facing       = Math.random() * Math.PI * 2
      this.state.players.set(bot.sessionId, bot)
      this.assignRole(bot)
      this.broadcast('incident', {
        message: `${bot.name} connected — ${bot.role}/${bot.faction} [BOT]`,
        severity: 'info', time: timestamp(),
      })
    }

    const interval = this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') {
        this.state.players.forEach(p => {
          if (!p.isBot) return
          p.x = Math.max(-11.5, Math.min(11.5, p.x + (Math.random() - 0.5) * 3))
          p.z = Math.max(-15.5, Math.min(9.0,  p.z + (Math.random() - 0.5) * 3))
          p.facing = Math.random() * Math.PI * 2
        })
        return
      }

      this.state.players.forEach(p => {
        if (!p.isBot) return
        let ai = this.botAI.get(p.sessionId) ?? { mode: 'wander' as const, workUntil: 0, targetStation: null }
        const now = this.clock.currentTime

        if (ai.mode === 'work' && ai.targetStation) {
          const st = this.stations.get(ai.targetStation)
          if (!st || st.completedBy || now > ai.workUntil) {
            ai = { mode: 'wander', workUntil: 0, targetStation: null }
            this.holdState.delete(p.sessionId)
          } else {
            const dx = st.info.x - p.x
            const dz = st.info.z - p.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist > INTERACT_R) {
              const speed = 2.5
              p.x = Math.max(-11.5, Math.min(11.5, p.x + (dx / dist) * speed))
              p.z = Math.max(-15.5, Math.min(9.0,  p.z + (dz / dist) * speed))
              p.facing = Math.atan2(dx, dz)
            } else {
              // At station — simulate hold
              if (!this.holdState.has(p.sessionId)) {
                this.holdState.set(p.sessionId, {
                  stationId: ai.targetStation,
                  startedAt: now,
                  holdMs: 4000,
                })
              }
            }
          }
        } else {
          if (Math.random() < 0.25 && this.stations.size > 0) {
            // Find an incomplete station for this bot's role
            const myTasks = TASK_DEFS.filter(t => t.role === (p.role as PlayerRole))
            const candidate = Array.from(this.stations.values()).find(st =>
              !st.completedBy &&
              myTasks.some(t => t.id === st.info.taskId) &&
              st.disabledUntil <= now
            )
            if (candidate) {
              ai = { mode: 'work', workUntil: now + 15_000, targetStation: candidate.info.stationId }
            }
          } else {
            p.x = Math.max(-11.5, Math.min(11.5, p.x + (Math.random() - 0.5) * 3))
            p.z = Math.max(-15.5, Math.min(9.0,  p.z + (Math.random() - 0.5) * 3))
            p.facing = Math.random() * Math.PI * 2
          }
        }

        this.botAI.set(p.sessionId, ai)
      })
    }, 2000)

    this.botCleanup = () => interval.clear()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onJoin(client: Client, options: { name?: string }) {
    const player = new Player()
    player.sessionId = client.sessionId
    player.name = (options.name ?? `Operative-${client.sessionId.slice(0, 4)}`).slice(0, 20)
    this.state.players.set(client.sessionId, player)
    this.assignRole(player)
    client.send('role_assigned', { role: player.role, faction: player.faction })
    this.broadcast('incident', {
      message: `${player.name} connected — ${player.role}/${player.faction}`,
      severity: 'info', time: timestamp(),
    })
    console.log(`[GameRoom] ${player.name} joined as ${player.role} (${player.faction})`)
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId)
    if (!player) return
    player.connected = false
    this.holdState.delete(client.sessionId)
    if (!consented) {
      try {
        await this.allowReconnection(client, 10)
        player.connected = true
        return
      } catch { /* expired */ }
    }
    this.broadcast('incident', { message: `${player.name} disconnected`, severity: 'warn', time: timestamp() })
    this.state.players.delete(client.sessionId)
    this.checkEndConditions()
  }

  onDispose() {
    if (this.botCleanup) this.botCleanup()
    console.log(`[GameRoom] ${this.roomId} disposed`)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private assignRole(player: Player) {
    const all             = Array.from(this.state.players.values())
    const oppositionCount = all.filter(p => p.faction === 'opposition').length
    const total           = all.length
    const assignOpposition = total > 2 && oppositionCount / total < OPPOSITION_RATIO
    if (assignOpposition) {
      player.faction = 'opposition'
      player.role    = OPPOSITION_ROLES[Math.floor(Math.random() * OPPOSITION_ROLES.length)]
    } else {
      player.faction = 'workforce'
      player.role    = WORKFORCE_ROLES[Math.floor(Math.random() * WORKFORCE_ROLES.length)]
    }
  }

  private checkEndConditions() {
    if (this.state.phase !== 'playing') return
    if (this.state.workforceMeter >= 100) this.endGame('workforce', 'All workforce tasks complete')
    if (this.state.oppositionMeter >= 100) this.endGame('opposition', 'All opposition tasks complete')
  }

  private endGame(winner: string, reason: string) {
    this.state.phase  = 'ended'
    this.state.winner = winner
    this.broadcast('game_end', { winner, reason })
    console.log(`[GameRoom] Game ended — ${winner} wins: ${reason}`)
    this.clock.setTimeout(() => this.disconnect(), 30_000)
  }
}

function timestamp() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}
```

- [ ] **Step 3.2 — Verify server TypeScript**

```bash
cd /Users/terrygoleman/Documents/dev/games/benilike
npx tsc --noEmit -p server/tsconfig.json 2>&1 | head -40
```

Expected: only pre-existing rootDir warning, no new errors.

- [ ] **Step 3.3 — Commit**

```bash
git add server/src/rooms/GameRoom.ts server/src/rooms/GameState.ts shared/src/tasks.ts shared/src/types.ts
git commit -m "feat(tasks): server station assignment, hold mechanic, task effects, team meters"
```

---

## Task 4: Client store

**Files:**
- Modify: `client/src/store/useGameRoom.ts`
- Modify: `client/src/game/useKeyboard.ts`

- [ ] **Step 4.1 — Replace `useGameRoom.ts`**

```ts
import { create } from 'zustand'
import type { Room } from 'colyseus.js'
import type { PlayerRole, Faction, EffectUpdate, StationInfo, TaskId } from '@shared/types'

export interface LobbyPlayer {
  sessionId: string
  name:      string
  x:         number
  z:         number
  facing:    number
  faction:   string
  role:      string
  connected: boolean
  isBot:     boolean
  disguised: boolean
  slowed:    boolean
}

export interface TaskToast {
  id:         string
  role:       string
  effectDesc: string
  meterGain:  number
  expiresAt:  number
}

export type ActiveEffects = EffectUpdate

const DEFAULT_EFFECTS: ActiveEffects = {
  workforceSpeedActive: false,
  lockdownActive:       false,
  workforceHoldSlow:    false,
  oppositionHoldSlow:   false,
  hackerCorruption:     false,
  ciPipelineActive:     false,
  badgeRenewalRequired: false,
}

interface GameRoomStore {
  room:             Room | null
  myRole:           PlayerRole | null
  myFaction:        Faction | null
  players:          LobbyPlayer[]
  incidents:        { text: string; type: 'info' | 'warn' | 'danger' | 'success'; time: string }[]
  workforceMeter:   number
  oppositionMeter:  number
  gameEnd:          { winner: string; reason: string } | null
  activeEffects:    ActiveEffects
  stations:         StationInfo[]
  completedTasks:   Set<TaskId>
  holdingStationId: string | null
  holdStartedAt:    number
  toasts:           TaskToast[]
  monitorSnapshot:  { rackA: number; rackB: number; rackC: number } | null

  setRoom:              (room: Room) => void
  setRole:              (role: PlayerRole, faction: Faction) => void
  setPlayers:           (players: LobbyPlayer[]) => void
  addIncident:          (text: string, type?: GameRoomStore['incidents'][0]['type'], time?: string) => void
  setMeters:            (workforce: number, opposition: number) => void
  setGameEnd:           (winner: string, reason: string) => void
  setActiveEffects:     (e: ActiveEffects) => void
  setStations:          (stations: StationInfo[]) => void
  completeTask:         (taskId: TaskId) => void
  setHolding:           (stationId: string | null) => void
  addToast:             (toast: Omit<TaskToast, 'id'>) => void
  clearExpiredToasts:   () => void
  setMonitorSnapshot:   (s: { rackA: number; rackB: number; rackC: number } | null) => void
  clearRoom:            () => void
}

export const useGameRoom = create<GameRoomStore>((set) => ({
  room:             null,
  myRole:           null,
  myFaction:        null,
  players:          [],
  incidents:        [],
  workforceMeter:   0,
  oppositionMeter:  0,
  gameEnd:          null,
  activeEffects:    DEFAULT_EFFECTS,
  stations:         [],
  completedTasks:   new Set(),
  holdingStationId: null,
  holdStartedAt:    0,
  toasts:           [],
  monitorSnapshot:  null,

  setRoom:          (room) => set({ room }),
  setRole:          (myRole, myFaction) => set({ myRole, myFaction }),
  setPlayers:       (players) => set({ players }),
  addIncident:      (text, type = 'info', time = '') =>
    set(s => ({ incidents: [...s.incidents.slice(-49), { text, type, time }] })),
  setMeters:        (workforceMeter, oppositionMeter) => set({ workforceMeter, oppositionMeter }),
  setGameEnd:       (winner, reason) => set({ gameEnd: { winner, reason } }),
  setActiveEffects: (activeEffects) => set({ activeEffects }),
  setStations:      (stations) => set({ stations }),
  completeTask:     (taskId) => set(s => ({ completedTasks: new Set([...s.completedTasks, taskId]) })),
  setHolding:       (holdingStationId) => set({ holdingStationId, holdStartedAt: holdingStationId ? Date.now() : 0 }),
  addToast:         (toast) => set(s => ({
    toasts: [...s.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
  })),
  clearExpiredToasts: () => set(s => ({ toasts: s.toasts.filter(t => t.expiresAt > Date.now()) })),
  setMonitorSnapshot: (monitorSnapshot) => set({ monitorSnapshot }),
  clearRoom:        () => set({
    room: null, myRole: null, myFaction: null, players: [], incidents: [],
    workforceMeter: 0, oppositionMeter: 0, gameEnd: null,
    activeEffects: DEFAULT_EFFECTS, stations: [], completedTasks: new Set(),
    holdingStationId: null, holdStartedAt: 0, toasts: [], monitorSnapshot: null,
  }),
}))
```

- [ ] **Step 4.2 — Remove Q from `useKeyboard.ts`**

In `client/src/game/useKeyboard.ts`, change:
```ts
const BLOCKED = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ']
```
to:
```ts
const BLOCKED = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE']
```

- [ ] **Step 4.3 — Verify client TypeScript**

```bash
cd /Users/terrygoleman/Documents/dev/games/benilike
npx tsc --noEmit -p client/tsconfig.json 2>&1 | head -30
```

Expected: errors in GameWorld and GameScreen (not yet updated) — that is fine at this stage.

- [ ] **Step 4.4 — Commit**

```bash
git add client/src/store/useGameRoom.ts client/src/game/useKeyboard.ts
git commit -m "feat(tasks): client store — team meters, stations, task completion, toasts"
```

---

## Task 5: Client GameWorld — workstations + hold-E

**Files:**
- Modify: `client/src/game/GameWorld.tsx`

- [ ] **Step 5.1 — Add station/zone imports and workstation mesh**

At top of `GameWorld.tsx`, add to imports:
```ts
import { useGameRoom } from '../store/useGameRoom'
import { TASK_DEFS } from '@shared/tasks'
import type { StationInfo, TaskId } from '@shared/types'
```

Add `@shared/tasks` alias to `client/vite.config.ts`:
```ts
'@shared/tasks': path.resolve(__dirname, '../shared/src/tasks.ts'),
```

- [ ] **Step 5.2 — Add `Workstation` mesh component**

After the existing `Desk` component:

```tsx
// Glowing workstation — lights up when local player has a task here
function Workstation({ station, hasMyTask, isHolding, isComplete }: {
  station: StationInfo
  hasMyTask: boolean
  isHolding: boolean
  isComplete: boolean
}) {
  const color = isComplete ? '#4ade80' : hasMyTask ? '#f59e0b' : '#3a3a52'
  const emissive = isComplete ? '#4ade80' : hasMyTask ? '#f59e0b' : '#1a1a2e'
  const emissiveInt = isHolding ? 2.0 : hasMyTask ? 0.6 : 0.1

  return (
    <group position={[station.x, 0, station.z]}>
      {/* Desk surface */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveInt} />
      </mesh>
      {/* Legs */}
      {[[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.2, lz]}>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshStandardMaterial color="#2a2a3e" />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 0.72, -0.28]}>
        <boxGeometry args={[0.7, 0.45, 0.04]} />
        <meshStandardMaterial color="#0f0f23" emissive={emissive} emissiveIntensity={emissiveInt * 0.5} />
      </mesh>
      {/* Task glow ring when player has task here */}
      {hasMyTask && !isComplete && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.3, 32]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={isHolding ? 3 : 1} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}
```

- [ ] **Step 5.3 — Update `NetworkCloset` room**

Add a small Network Closet room to `OfficeDungeon`. After the existing server room walls, add:

```tsx
{/* Network Closet — west alcove (x: -12 to -8, z: -1 to -5) */}
<Wall pos={[-10, 1.5, -5.25]} sz={[4, 3, 0.5]} />   {/* North wall */}
<Wall pos={[-10, 1.5, -1]}    sz={[4, 3, 0.5]} />    {/* South wall */}
<Wall pos={[-12, 1.5, -3]}    sz={[0.5, 3, 4.5]} />  {/* Far west */}
{/* Opening in west main wall at z: -2 to -4 is already open (gap in Wall west main) */}
```

(The main west wall `<Wall pos={[-12, 1.5, 1.0]} sz={[0.5, 3, 16.5]} />` needs splitting to create a gap for the Network Closet entrance at z: -1 to -5. Replace that wall with two segments.)

Replace:
```tsx
<Wall pos={[-12, 1.5,  1.0]}  sz={[0.5, 3, 16.5]} /> {/* West main */}
```
with:
```tsx
<Wall pos={[-12, 1.5,  5.5]}  sz={[0.5, 3,  7.5]} /> {/* West main north segment */}
<Wall pos={[-12, 1.5, -1.0]}  sz={[0.5, 3,  2.0]} /> {/* West main south segment — gap for closet */}
```
Then add closet interior walls (north, south, far west — door opening at x=-8.5, z=-3):
```tsx
{/* Network Closet interior walls */}
<Wall pos={[-10, 1.5, -5.5]} sz={[4, 3, 0.5]} />
<Wall pos={[-10, 1.5,  0.5]} sz={[4, 3, 0.5]} />
```

- [ ] **Step 5.4 — Update `LocalPlayerController` — replace Q ability with station hold**

Remove `qWasDown` ref and Q-key block. Add station hold logic:

```tsx
// Near-station detection (runs in useFrame after movement):
const nearStation = useGameRoom.getState().stations.find(st => {
  const dx = localPos.x - st.x
  const dz = localPos.z - st.z
  return Math.sqrt(dx * dx + dz * dz) < INTERACT_R && st.taskId !== null
})
onNearStation(nearStation ?? null)

const wantsHold = nearStation && !!k['KeyE']
const gs = useGameRoom.getState()
const currentlyHolding = gs.holdingStationId === nearStation?.stationId

if (wantsHold && nearStation && !currentlyHolding) {
  gs.setHolding(nearStation.stationId)
  gs.room?.send('task_hold_start', { stationId: nearStation.stationId })
} else if (!wantsHold && gs.holdingStationId) {
  gs.setHolding(null)
  gs.room?.send('task_hold_cancel', {})
}
```

Remove the old `wantsInteract` / `task_start` / `task_stop` / `onInteracting` block.

- [ ] **Step 5.5 — Update `Scene` — render workstations, handle new messages**

In the `Scene` `useEffect`, replace old message handlers with:

```ts
room.onMessage('station_list', (data: { stations: StationInfo[] }) => {
  useGameRoom.getState().setStations(data.stations)
})
room.onMessage('task_complete', (data: { taskId: TaskId; role: string; effectDesc: string; meterGain: number }) => {
  useGameRoom.getState().completeTask(data.taskId)
  useGameRoom.getState().addToast({ role: data.role, effectDesc: data.effectDesc, meterGain: data.meterGain, expiresAt: Date.now() + 4000 })
})
room.onMessage('meter_update', (data: { workforce: number; opposition: number }) => {
  useGameRoom.getState().setMeters(data.workforce, data.opposition)
})
room.onMessage('monitor_snapshot', (data: { rackA: number; rackB: number; rackC: number }) => {
  useGameRoom.getState().setMonitorSnapshot(data)
})
room.onMessage('effect_update', (data: EffectUpdate) => {
  useGameRoom.getState().setActiveEffects(data)
})
room.onMessage('ghost_camera', () => { /* handled in FollowCamera */ })
room.onMessage('game_end', (data: { winner: string; reason: string }) => {
  useGameRoom.getState().setGameEnd(data.winner, data.reason)
})
```

In the JSX, replace `<OfficeDungeon progress={terminalProgress} />` with `<OfficeDungeon />` (no progress prop) and render workstations:

```tsx
{stations.map(st => {
  const myTaskDef = myRole ? TASK_DEFS.find(t => t.id === st.taskId && t.role === myRole) : null
  return (
    <Workstation
      key={st.stationId}
      station={st}
      hasMyTask={!!myTaskDef}
      isHolding={holdingStationId === st.stationId}
      isComplete={completedTasks.has(st.taskId as TaskId)}
    />
  )
})}
```

- [ ] **Step 5.6 — Commit**

```bash
git add client/src/game/GameWorld.tsx client/vite.config.ts
git commit -m "feat(tasks): workstations, hold-E station interaction, network closet room"
```

---

## Task 6: Client HUD — team meters, task checklist, toasts

**Files:**
- Modify: `client/src/components/screens/GameScreen.tsx`
- Modify: `client/src/components/screens/screens.module.css`

- [ ] **Step 6.1 — Replace `GameScreen.tsx`**

```tsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import { TASK_DEFS } from '@shared/tasks'
import GameWorld from '../../game/GameWorld'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const ZONE_LABELS: Record<string, string> = {
  main_office: 'Main Office', server_room: 'Server Room',
  network_closet: 'Network Closet', hr_corner: 'HR Corner',
  finance_floor: 'Finance Floor', devops_den: 'DevOps Den',
  marketing_hub: 'Marketing Hub', exec_suite: 'Exec Suite',
}

interface Props { onNavigate: (s: Screen) => void }

export default function GameScreen({ onNavigate }: Props) {
  const {
    room, myRole, myFaction, players, workforceMeter, oppositionMeter,
    gameEnd, activeEffects, stations, completedTasks, holdingStationId,
    holdStartedAt, toasts, monitorSnapshot, clearRoom,
  } = useGameRoom()
  const [nearStation, setNearStation] = useState<import('@shared/types').StationInfo | null>(null)
  const toastRaf = useRef<number>(0)

  const handleLeave = () => {
    room?.send('task_hold_cancel', {})
    room?.leave()
    clearRoom()
    onNavigate('main-menu')
  }

  const handleNearStation = useCallback((st: import('@shared/types').StationInfo | null) => setNearStation(st), [])

  // Clear expired toasts
  useEffect(() => {
    const tick = () => {
      useGameRoom.getState().clearExpiredToasts()
      toastRaf.current = requestAnimationFrame(tick)
    }
    toastRaf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(toastRaf.current)
  }, [])

  // My tasks
  const myTasks = myRole ? TASK_DEFS.filter(t => t.role === myRole) : []

  const isWorkforce  = myFaction === 'workforce'
  const myMeter      = isWorkforce ? workforceMeter : oppositionMeter
  const oppMeterHint = isWorkforce ? oppositionMeter : workforceMeter
  const oppHint      = oppMeterHint < 34 ? 'LOW' : oppMeterHint < 67 ? 'MED' : 'HIGH'
  const roleLabel    = myRole ? ROLE_LABELS[myRole] : '—'

  // Hold progress for current station
  const holdMs = nearStation && holdingStationId === nearStation.stationId
    ? (TASK_DEFS.find(t => t.id === nearStation.taskId)?.holdMs ?? 4000)
    : 4000
  const holdPct = holdingStationId && holdStartedAt
    ? Math.min(1, (Date.now() - holdStartedAt) / holdMs)
    : 0

  // Show end overlay
  if (gameEnd) {
    const won = gameEnd.winner === myFaction
    return (
      <div className={styles.endOverlay}>
        <div className={styles.endCard}>
          <div className={won ? styles.endFactionWon : styles.endFactionLost}>
            {won ? '✓ MISSION COMPLETE' : '✗ MISSION FAILED'}
          </div>
          <div className={styles.endHeadline}>{gameEnd.reason}</div>
          <div className={styles.endStats}>
            <div className={styles.endStat}>Role: {roleLabel}</div>
            <div className={styles.endStat}>
              Tasks done: {myTasks.filter(t => stations.some(s => s.taskId === t.id && completedTasks.has(t.id as any))).length}/{myTasks.length}
            </div>
          </div>
          <button className={styles.endBtn} onClick={handleLeave}>RETURN TO MENU</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GameWorld onNearStation={handleNearStation} />

      {/* ── Team meters (bottom centre) ── */}
      <div className={styles.hudMeters}>
        <div className={styles.hudMeterRow}>
          <span className={styles.hudMeterLabel}>{isWorkforce ? 'WORKFORCE' : 'OPPOSITION'}</span>
          <div className={styles.hudMeterBar}>
            <div
              className={styles.hudMeterFill}
              style={{
                width: `${myMeter}%`,
                background: isWorkforce ? 'var(--color-terminal)' : '#ef4444',
              }}
            />
          </div>
          <span className={styles.hudMeterPct}>{Math.round(myMeter)}%</span>
        </div>
        <div className={styles.hudMeterRow} style={{ opacity: 0.45 }}>
          <span className={styles.hudMeterLabel}>ENEMY</span>
          <div className={styles.hudMeterBar}>
            <div className={styles.hudMeterFill} style={{ width: '100%', background: '#555' }} />
          </div>
          <span className={styles.hudMeterPct}>{oppHint}</span>
        </div>
      </div>

      {/* ── Task checklist (top right) ── */}
      <div className={styles.hudTaskList}>
        <div className={styles.hudTaskListHeader}>{roleLabel}</div>
        {myTasks.map(task => {
          const done    = completedTasks.has(task.id as any)
          const stLocal = stations.find(s => s.taskId === task.id)
          const zone    = stLocal ? (ZONE_LABELS[stLocal.zone] ?? stLocal.zone) : task.zone.replace('_', ' ')
          return (
            <div key={task.id} className={`${styles.hudTask} ${done ? styles.hudTaskDone : ''}`}>
              <span className={styles.hudTaskCheck}>{done ? '✓' : '○'}</span>
              <span className={styles.hudTaskName}>{task.name}</span>
              {!done && <span className={styles.hudTaskZone}>{zone}</span>}
            </div>
          )
        })}
      </div>

      {/* ── Hold-E progress bar (centre) ── */}
      {holdingStationId && (
        <div className={styles.hudHoldBar}>
          <div className={styles.hudHoldFill} style={{ width: `${holdPct * 100}%` }} />
          <span className={styles.hudHoldLabel}>
            {TASK_DEFS.find(t => t.id === nearStation?.taskId)?.name ?? 'Working...'}
          </span>
        </div>
      )}

      {/* ── Interact prompt ── */}
      {nearStation && !holdingStationId && (() => {
        const taskDef = TASK_DEFS.find(t => t.id === nearStation.taskId && t.role === myRole)
        if (!taskDef) return null
        const done = completedTasks.has(taskDef.id as any)
        if (done) return null
        return (
          <div className={styles.hudInteract}>
            [E] {taskDef.name}
          </div>
        )
      })()}

      {/* ── Task completion toasts ── */}
      <div className={styles.hudToasts}>
        {toasts.filter(t => t.expiresAt > Date.now()).map(t => (
          <div key={t.id} className={styles.hudToast}>
            <span className={styles.hudToastRole}>{t.role.replace('_', ' ')}</span>
            {' — '}{t.effectDesc}
          </div>
        ))}
      </div>

      {/* ── Monitor snapshot modal ── */}
      {monitorSnapshot && (
        <div className={styles.monitorModal}>
          <div className={styles.monitorCard}>
            <div className={styles.monitorTitle}>SERVER HEALTH MONITOR</div>
            {(['A', 'B', 'C'] as const).map(rack => {
              const health = monitorSnapshot[`rack${rack}` as 'rackA']
              return (
                <div key={rack} className={styles.monitorRack}>
                  <span>RACK {rack}</span>
                  <div className={styles.monitorRackBar}>
                    <div className={styles.monitorRackFill} style={{
                      width: `${health}%`,
                      background: health > 60 ? '#4ade80' : health > 30 ? '#f59e0b' : '#ef4444',
                    }} />
                  </div>
                  <span>{Math.round(health)}%</span>
                </div>
              )
            })}
            <button className={styles.monitorClose}
              onClick={() => useGameRoom.getState().setMonitorSnapshot(null)}>
              CLOSE [ESC]
            </button>
          </div>
        </div>
      )}

      {/* ── Corner info ── */}
      <div className={styles.hudCornerTL}>
        <div className={styles.hudRoleTag}>{roleLabel}</div>
        <div className={styles.hudFactionTag} style={{ color: isWorkforce ? '#a78bfa' : '#f87171' }}>
          {isWorkforce ? '▲ WORKFORCE' : '▼ OPPOSITION'}
        </div>
      </div>

      <div className={styles.hudCornerBR}>
        <div className={styles.hudControls}>WASD · MOVE &nbsp;&nbsp; E · INTERACT</div>
      </div>

      {/* Active effect warnings */}
      {activeEffects.workforceHoldSlow && isWorkforce && (
        <div className={styles.hudWarnBanner}>⚡ POWER CUT — tasks taking 2× longer</div>
      )}
      {activeEffects.hackerCorruption && isWorkforce && (
        <div className={styles.hudWarnBanner}>☠ HACKER CORRUPTION — terminal task slowed</div>
      )}
      {activeEffects.workforceSpeedActive && isWorkforce && (
        <div className={styles.hudWarnBanner} style={{ color: '#4ade80' }}>🏃 SPRINT — movement speed +30%</div>
      )}
    </div>
  )
}
```

- [ ] **Step 6.2 — Update `GameScreen.tsx` props to `GameWorld`**

`GameWorld` needs a new `onNearStation` prop. Update the `GameWorld` exported component signature:
```tsx
interface GameWorldProps {
  onNearStation: (st: StationInfo | null) => void
}
export default function GameWorld({ onNearStation }: GameWorldProps)
```
And pass it through to `LocalPlayerController`.

- [ ] **Step 6.3 — Add new CSS to `screens.module.css`**

Append after existing styles:

```css
/* ── Team meters ─────────────────────────────────────────────────────── */
.hudMeters {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 280px;
  pointer-events: none;
  font-family: var(--font-mono);
}
.hudMeterRow {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.hudMeterLabel {
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  opacity: 0.7;
  width: 5.5rem;
  text-align: right;
}
.hudMeterBar {
  flex: 1;
  height: 8px;
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
}
.hudMeterFill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.hudMeterPct {
  font-size: 0.72rem;
  width: 2.8rem;
}

/* ── Task checklist ──────────────────────────────────────────────────── */
.hudTaskList {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-family: var(--font-mono);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  pointer-events: none;
}
.hudTaskListHeader {
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  opacity: 0.5;
  margin-bottom: 0.2rem;
}
.hudTask {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}
.hudTaskDone { opacity: 0.4; }
.hudTaskCheck { width: 0.8rem; color: #4ade80; }
.hudTaskName { }
.hudTaskZone {
  font-size: 0.65rem;
  opacity: 0.5;
  font-style: italic;
}

/* ── Hold-E progress bar ─────────────────────────────────────────────── */
.hudHoldBar {
  position: absolute;
  bottom: 5.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  height: 28px;
  background: rgba(5,5,14,0.8);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--radius-sm);
  overflow: hidden;
  pointer-events: none;
}
.hudHoldFill {
  height: 100%;
  background: var(--color-terminal);
  transition: width 0.1s linear;
}
.hudHoldLabel {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  mix-blend-mode: difference;
}

/* ── Interact prompt ─────────────────────────────────────────────────── */
.hudInteract {
  position: absolute;
  bottom: 5.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  padding: 0.35rem 0.9rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--radius-sm);
  background: rgba(5,5,14,0.75);
  pointer-events: none;
}

/* ── Toasts ──────────────────────────────────────────────────────────── */
.hudToasts {
  position: absolute;
  bottom: 3.5rem;
  left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  pointer-events: none;
}
.hudToast {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.25rem 0.7rem;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--radius-sm);
  background: rgba(5,5,14,0.8);
  animation: fadeIn 0.2s ease;
}
.hudToastRole { opacity: 0.6; text-transform: capitalize; }

/* ── Monitor snapshot modal ──────────────────────────────────────────── */
.monitorModal {
  position: fixed;
  inset: 0;
  background: rgba(5,5,14,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.monitorCard {
  font-family: var(--font-mono);
  padding: 2rem 2.5rem;
  border: 1px solid #4ade80;
  border-radius: var(--radius-md);
  background: rgba(5,5,14,0.95);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 320px;
  box-shadow: 0 0 24px rgba(74,222,128,0.2);
}
.monitorTitle {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  color: #4ade80;
}
.monitorRack {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.8rem;
}
.monitorRackBar {
  flex: 1;
  height: 10px;
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
}
.monitorRackFill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}
.monitorClose {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.4rem 1rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  cursor: pointer;
  align-self: flex-end;
  letter-spacing: 0.1em;
}

/* ── Warning banner ──────────────────────────────────────────────────── */
.hudWarnBanner {
  position: absolute;
  top: 3.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  padding: 0.3rem 1rem;
  border: 1px solid #ef4444;
  border-radius: var(--radius-sm);
  background: rgba(239,68,68,0.12);
  color: #f87171;
  pointer-events: none;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 6.4 — Commit**

```bash
git add client/src/components/screens/GameScreen.tsx client/src/components/screens/screens.module.css
git commit -m "feat(tasks): HUD — team meters, task checklist, hold bar, toasts, monitor modal"
```

---

## Task 7: Briefing screen — show tasks instead of ability

**Files:**
- Modify: `client/src/components/screens/BriefingScreen.tsx`

- [ ] **Step 7.1 — Update `BriefingScreen.tsx`**

Replace the ability section with the task list:

```tsx
import { useEffect, useState } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import { TASK_DEFS, ZONES } from '@shared/tasks'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const ZONE_LABELS: Record<string, string> = {
  main_office: 'Main Office', server_room: 'Server Room',
  network_closet: 'Network Closet', hr_corner: 'HR Corner',
  finance_floor: 'Finance Floor', devops_den: 'DevOps Den',
  marketing_hub: 'Marketing Hub', exec_suite: 'Exec Suite',
}

const COUNTDOWN = 10
interface Props { onNavigate: (s: Screen) => void }

export default function BriefingScreen({ onNavigate }: Props) {
  const { myRole, myFaction } = useGameRoom()
  const [seconds, setSeconds] = useState(COUNTDOWN)

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(id); onNavigate('game'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [onNavigate])

  const isWorkforce  = myFaction === 'workforce'
  const roleLabel    = myRole ? (ROLE_LABELS[myRole] ?? myRole) : '—'
  const myTasks      = myRole ? TASK_DEFS.filter(t => t.role === myRole) : []
  const cardClass    = `${styles.briefingCard} ${isWorkforce ? styles.briefingWorkforce : styles.briefingOpposition}`

  return (
    <div className={styles.briefingOverlay}>
      <div className={cardClass}>
        <div className={styles.briefingFaction}>
          {isWorkforce ? '▲ WORKFORCE' : '▼ OPPOSITION'}
        </div>
        <div className={styles.briefingRole}>{roleLabel}</div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>YOUR TASKS</div>
          {myTasks.map((task, i) => (
            <div key={task.id} className={styles.briefingTask}>
              <span className={styles.briefingTaskNum}>{i + 1}.</span>
              <div>
                <div className={styles.briefingTaskName}>{task.name}</div>
                <div className={styles.briefingTaskZone}>
                  Zone: {ZONE_LABELS[task.zone] ?? task.zone.replace('_', ' ')} · {task.effectDesc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>HOW TO WIN</div>
          <div className={styles.briefingObjective}>
            {isWorkforce
              ? 'Complete your tasks to push the Workforce meter to 100%'
              : 'Complete your tasks to push the Opposition meter to 100%'}
          </div>
          <div className={styles.briefingObjective} style={{ opacity: 0.6, fontSize: '0.8rem' }}>
            Meters degrade over time — keep working.
          </div>
        </div>

        <div className={styles.briefingControls}>
          WASD · MOVE &nbsp;·&nbsp; E · HOLD AT STATION TO WORK
        </div>

        <button className={styles.briefingBtn} onClick={() => onNavigate('game')}>
          LET'S GO — {seconds}s
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2 — Add briefing task CSS (append to screens.module.css)**

```css
/* ── Briefing task list ──────────────────────────────────────────────── */
.briefingTask {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  font-size: 0.85rem;
}
.briefingTaskNum {
  opacity: 0.4;
  width: 1rem;
  flex-shrink: 0;
}
.briefingTaskName {
  font-weight: 600;
  color: var(--color-terminal);
}
.briefingTaskZone {
  font-size: 0.72rem;
  opacity: 0.6;
  margin-top: 0.1rem;
}
```

- [ ] **Step 7.3 — Commit**

```bash
git add client/src/components/screens/BriefingScreen.tsx client/src/components/screens/screens.module.css
git commit -m "feat(tasks): briefing screen shows task list + win condition"
```

---

## Task 8: Final wiring + verification

**Files:**
- All modified files

- [ ] **Step 8.1 — Run full TypeScript check**

```bash
cd /Users/terrygoleman/Documents/dev/games/benilike
npx tsc --noEmit -p client/tsconfig.json 2>&1 | head -50
npx tsc --noEmit -p server/tsconfig.json 2>&1 | head -20
```

Expected: zero client errors; server only pre-existing rootDir warning.

- [ ] **Step 8.2 — Smoke test**

Start dev server:
```bash
npm run dev
```

1. Open `http://localhost:3000`
2. Create game (small, 3 bots)
3. Start game → Briefing screen shows 2 tasks with zone hints
4. Enter game → workstations glow amber where your tasks are
5. Hold E at amber station → hold bar fills, completes
6. Task checklist shows ✓
7. Team meter increases
8. Bot moves toward a station and completes it (meter goes up)
9. Win condition triggers at 100%

- [ ] **Step 8.3 — Final commit + push**

```bash
git add -A
git commit -m "feat(phase3): complete task system — zone tasks, team meters, win condition"
git push
```
