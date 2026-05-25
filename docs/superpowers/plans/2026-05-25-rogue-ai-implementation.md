# Rogue AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Workforce vs Opposition faction system with a 1-vs-all Rogue AI model where one hidden player is the AI, workers have assigned task lists, the AI progresses through 3 phases, and can eliminate workers. Sprint structure and All Hands meetings provide the social-deduction and perk loops.

**Architecture:** Server-authoritative Colyseus room. The AI's true role is stored only server-side (never broadcast in GameState). Workers and the AI receive their private briefing via direct `client.send`. Bodies are tracked in GameState (broadcast to all). Sprint quota/timer live in GameState. Voting state is managed server-side during meeting phases.

**Tech Stack:** Colyseus 0.15, @colyseus/schema, React 18, Zustand, TypeScript 5.6, Vite 6.4

---

## Milestone structure

| Milestone | Tasks | Produces |
|---|---|---|
| **M1 — Foundation** | 1–4 | Working game: AI role exists, workers have assigned tasks, tasks are open to all |
| **M2 — AI Danger** | 5–6 | AI can do phase tasks and eliminate workers. Bodies appear. Report mechanic works. |
| **M3 — Sprint Loop** | 7–8 | Sprint timer, quota bar, retro perk voting |
| **M4 — Meetings** | 9–10 | All Hands meeting overlay with live voting, ghost spectator mode |

Commit after each milestone. Each milestone is independently playable.

---

## File Map

| File | Status | What changes |
|---|---|---|
| `shared/src/types.ts` | Modify | New TaskId union, remove Faction/OppositionRole, add BodyInfo, AiPhase, SprintInfo, new messages |
| `shared/src/tasks.ts` | Rewrite | New 20-task workforce pool + 7 AI phase tasks, ROLE_TASK_MAP |
| `server/src/rooms/GameState.ts` | Modify | Add Body schema, sprint fields, remove meter/rack/lockdown fields |
| `server/src/rooms/GameRoom.ts` | Rewrite | Remove opposition logic, add AI role, phases, shutdown, bodies, sprint, meeting |
| `client/src/store/useGameRoom.ts` | Modify | Remove faction/meters, add assignedTasks, bodies, sprint, meeting state |
| `client/src/components/screens/BriefingScreen.tsx` | Modify | AI gets secret briefing with phase objectives |
| `client/src/components/screens/LobbyScreen.tsx` | Modify | Remove faction assignment UI |
| `client/src/components/screens/GameScreen.tsx` | Modify | Sprint quota bar replaces dual meters, assigned task list |
| `client/src/game/GameWorld.tsx` | Modify | Body entities, report E-prompt, Phase 2 flicker |
| `client/src/components/screens/MeetingScreen.tsx` | Create | All Hands overlay with chat + vote UI |
| `client/src/components/screens/RetroScreen.tsx` | Create | Sprint Retrospective overlay with perk vote |
| `client/src/App.tsx` | Modify | Add MeetingScreen / RetroScreen to screen routing |

---

## Task 1 — Rewrite `shared/src/types.ts`

**Files:**
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// shared/src/types.ts

// ── Roles ─────────────────────────────────────────────────────────────────────

export type WorkforceRole =
  | 'it' | 'hr' | 'devops' | 'finance' | 'marketing' | 'admin' | 'management'

// 'ai' is the hidden role — never shown to other players in-game
export type PlayerRole = WorkforceRole | 'ai'

// ── Room options ──────────────────────────────────────────────────────────────

export interface RoomOptions {
  roomName:   string
  mapSize:    'small' | 'medium' | 'large'
  maxPlayers: number
  botCount:   number
  sprintSize: 'small' | 'medium' | 'large'
}

// ── Task & Zone types ─────────────────────────────────────────────────────────

export type ZoneId =
  | 'main_office' | 'server_room' | 'network_closet'
  | 'hr_corner'   | 'finance_floor' | 'devops_den'
  | 'marketing_hub' | 'exec_suite'

export type TaskId =
  // ── Workforce tasks (shared pool — any player can do these) ──
  | 'patch_terminal'    | 'restart_rack'       | 'cable_audit'      | 'firewall_check'
  | 'security_vetting'  | 'policy_review'      | 'onboarding_docs'
  | 'ci_pipeline'       | 'system_monitor'     | 'deploy_config'
  | 'budget_freeze'     | 'expense_audit'      | 'invoice_batch'
  | 'pr_campaign'       | 'social_scheduling'  | 'crisis_control'
  | 'keycard_audit'     | 'meeting_setup'
  | 'sprint_planning'   | 'resource_allocation'
  // ── AI phase tasks (only the AI player receives these) ──
  | 'ai_index_records'   | 'ai_analyse_logs'   | 'ai_map_network'       // Phase 1
  | 'ai_deploy_backdoor' | 'ai_clone_creds'    | 'ai_bypass_access'     // Phase 2
  | 'ai_takeover'                                                         // Phase 3

export type AiPhase = 1 | 2 | 3

export interface TaskDef {
  id:        TaskId
  name:      string
  zone:      ZoneId
  holdMs:    number
  category:  'workforce' | 'ai'
  aiPhase?:  AiPhase   // only for category === 'ai'
  // which job titles are assigned this task (workforce tasks only)
  assignedTo?: WorkforceRole[]
}

export interface StationInfo {
  stationId: string
  zone:      ZoneId
  x:         number
  z:         number
  floor:     number
  taskId:    TaskId | null
}

export interface BodyInfo {
  bodyId:  string
  x:       number
  z:       number
  floor:   number
  name:    string   // victim display name
}

export interface SprintInfo {
  sprint:    number   // 1 | 2 | 3
  quota:     number   // tasks required
  completed: number   // tasks completed so far this sprint
  timeLeft:  number   // seconds remaining
  size:      'small' | 'medium' | 'large'
}

// ── Client → Server messages ──────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'move';             x: number; z: number; floor?: number; facing?: number }
  | { type: 'task_hold_start';  stationId: string }
  | { type: 'task_hold_cancel' }
  | { type: 'report_body';      bodyId: string }
  | { type: 'call_all_hands' }
  | { type: 'vote';             targetId: string | 'skip' }
  | { type: 'perk_vote';        perk: string }
  | { type: 'sprint_size_vote'; size: 'small' | 'medium' | 'large' }
  | { type: 'chat';             text: string }

// ── Server → Client messages ──────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'role_assigned';     role: PlayerRole; assignedTasks: TaskId[] }
  | { type: 'ai_briefing';       phase: AiPhase; phaseTasks: TaskId[] }
  | { type: 'incident';          message: string; severity: 'info' | 'warn' | 'danger'; time: string }
  | { type: 'game_start';        seed: string; mapSize: RoomOptions['mapSize'] }
  | { type: 'game_end';          winner: 'workforce' | 'ai'; reason: string }
  | { type: 'station_list';      stations: StationInfo[] }
  | { type: 'task_complete';     taskId: TaskId; playerName: string }
  | { type: 'sprint_update';     info: SprintInfo }
  | { type: 'body_appeared';     body: BodyInfo }
  | { type: 'body_removed';      bodyId: string }
  | { type: 'all_hands_start';   calledBy: string; bodyId?: string }
  | { type: 'all_hands_vote_result'; ejected: string | null; wasAi: boolean; votes: Record<string, string> }
  | { type: 'retro_start';       sprint: number; quotaMet: boolean; stats: Array<{ sessionId: string; name: string; completed: number }> }
  | { type: 'perk_awarded';      perk: string }
  | { type: 'phase2_flicker';    zone: ZoneId }

// ── Shared constants ──────────────────────────────────────────────────────────

export const WORKFORCE_ROLES: WorkforceRole[] = [
  'it', 'hr', 'devops', 'finance', 'marketing', 'admin', 'management',
]

export const ROLE_LABELS: Record<PlayerRole, string> = {
  it:         'IT Technician',
  hr:         'HR Officer',
  devops:     'DevOps Engineer',
  finance:    'Finance Analyst',
  marketing:  'Marketing',
  admin:      'Admin',
  management: 'Management',
  ai:         'Employee',   // displayed to others — the AI shows as a normal employee
}

export const SERVER_PORT            = 2567
export const SPRINT_DURATION_MS     = 180_000   // 3 minutes per sprint
export const SPRINT_COUNT           = 3
export const SHUTDOWN_COOLDOWN_MS   = 30_000
export const SHUTDOWN_ALONE_MS      = 1_000     // must be alone with target for this long
export const ALL_HANDS_CHAT_MS      = 45_000
export const ALL_HANDS_PER_PLAYER   = 2
```

- [ ] **Step 2: Type-check to confirm no other file yet imports the removed symbols**

```bash
cd /path/to/benilike
node ./client/node_modules/typescript/bin/tsc --noEmit -p client/tsconfig.json 2>&1 | head -40
```

Expected: many errors referencing old types. That's fine — we'll fix them in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "refactor(types): rogue AI model — new types, remove faction/opposition"
```

---

## Task 2 — Rewrite `shared/src/tasks.ts`

**Files:**
- Modify: `shared/src/tasks.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// shared/src/tasks.ts
import type { TaskDef, ZoneId, StationInfo, WorkforceRole } from './types'
import { generateMapData } from './mapgen'
import type { MapData } from './mapgen'

// ── Zone definitions ──────────────────────────────────────────────────────────

export interface ZoneDef {
  id:          ZoneId
  displayName: string
  mapSizes:    Array<'small' | 'medium' | 'large'>
}

export const ZONES: ZoneDef[] = [
  { id: 'main_office',    displayName: 'Main Office',    mapSizes: ['small', 'medium', 'large'] },
  { id: 'server_room',   displayName: 'Server Room',    mapSizes: ['small', 'medium', 'large'] },
  { id: 'network_closet',displayName: 'Network Closet', mapSizes: ['small', 'medium', 'large'] },
  { id: 'hr_corner',     displayName: 'HR Corner',      mapSizes: ['medium', 'large'] },
  { id: 'finance_floor', displayName: 'Finance Floor',  mapSizes: ['medium', 'large'] },
  { id: 'devops_den',    displayName: 'DevOps Den',     mapSizes: ['medium', 'large'] },
  { id: 'marketing_hub', displayName: 'Marketing Hub',  mapSizes: ['large'] },
  { id: 'exec_suite',    displayName: 'Exec Suite',     mapSizes: ['large'] },
]

// ── Workforce task pool (20 tasks, any player can do any of them) ─────────────

export const TASK_DEFS: TaskDef[] = [
  // Server Room / Network
  { id: 'patch_terminal',     name: 'Patch Terminal',        zone: 'server_room',    holdMs: 4000, category: 'workforce', assignedTo: ['it'] },
  { id: 'restart_rack',       name: 'Restart Rack',          zone: 'server_room',    holdMs: 5000, category: 'workforce', assignedTo: ['it'] },
  { id: 'cable_audit',        name: 'Cable Audit',           zone: 'network_closet', holdMs: 3500, category: 'workforce', assignedTo: ['it'] },
  { id: 'firewall_check',     name: 'Firewall Check',        zone: 'network_closet', holdMs: 4000, category: 'workforce', assignedTo: ['devops', 'it'] },
  // HR Corner
  { id: 'security_vetting',   name: 'Security Vetting',      zone: 'hr_corner',      holdMs: 5000, category: 'workforce', assignedTo: ['hr'] },
  { id: 'policy_review',      name: 'Policy Review',         zone: 'hr_corner',      holdMs: 4500, category: 'workforce', assignedTo: ['hr'] },
  { id: 'onboarding_docs',    name: 'Onboarding Docs',       zone: 'hr_corner',      holdMs: 3000, category: 'workforce', assignedTo: ['hr', 'admin'] },
  // DevOps Den
  { id: 'ci_pipeline',        name: 'CI Pipeline Run',       zone: 'devops_den',     holdMs: 5500, category: 'workforce', assignedTo: ['devops'] },
  { id: 'system_monitor',     name: 'System Monitor',        zone: 'devops_den',     holdMs: 4000, category: 'workforce', assignedTo: ['devops', 'it'] },
  { id: 'deploy_config',      name: 'Deploy Config',         zone: 'devops_den',     holdMs: 4500, category: 'workforce', assignedTo: ['devops'] },
  // Finance Floor
  { id: 'budget_freeze',      name: 'Budget Freeze',         zone: 'finance_floor',  holdMs: 5000, category: 'workforce', assignedTo: ['finance'] },
  { id: 'expense_audit',      name: 'Expense Audit',         zone: 'finance_floor',  holdMs: 4500, category: 'workforce', assignedTo: ['finance'] },
  { id: 'invoice_batch',      name: 'Invoice Batch',         zone: 'finance_floor',  holdMs: 3500, category: 'workforce', assignedTo: ['finance', 'admin'] },
  // Marketing Hub
  { id: 'pr_campaign',        name: 'PR Campaign',           zone: 'marketing_hub',  holdMs: 5000, category: 'workforce', assignedTo: ['marketing'] },
  { id: 'social_scheduling',  name: 'Social Scheduling',     zone: 'marketing_hub',  holdMs: 3500, category: 'workforce', assignedTo: ['marketing'] },
  { id: 'crisis_control',     name: 'Crisis Control',        zone: 'marketing_hub',  holdMs: 4500, category: 'workforce', assignedTo: ['marketing', 'management'] },
  // Main Office / Exec Suite
  { id: 'keycard_audit',      name: 'Keycard Audit',         zone: 'main_office',    holdMs: 4000, category: 'workforce', assignedTo: ['admin'] },
  { id: 'meeting_setup',      name: 'Meeting Room Setup',    zone: 'main_office',    holdMs: 3000, category: 'workforce', assignedTo: ['admin'] },
  { id: 'sprint_planning',    name: 'Sprint Planning',       zone: 'exec_suite',     holdMs: 5500, category: 'workforce', assignedTo: ['management'] },
  { id: 'resource_allocation',name: 'Resource Allocation',   zone: 'exec_suite',     holdMs: 5000, category: 'workforce', assignedTo: ['management'] },
]

// ── AI phase tasks (private — only the AI player receives these) ──────────────

export const AI_TASK_DEFS: TaskDef[] = [
  // Phase 1 — LEARN (looks like normal work to bystanders)
  { id: 'ai_index_records',   name: 'Index Employee Records', zone: 'hr_corner',      holdMs: 5000, category: 'ai', aiPhase: 1 },
  { id: 'ai_analyse_logs',    name: 'Analyse System Logs',    zone: 'server_room',    holdMs: 5500, category: 'ai', aiPhase: 1 },
  { id: 'ai_map_network',     name: 'Map Network Topology',   zone: 'network_closet', holdMs: 5000, category: 'ai', aiPhase: 1 },
  // Phase 2 — ACCESS (triggers phase2_flicker on nearby monitors)
  { id: 'ai_deploy_backdoor', name: 'Deploy Backdoor',        zone: 'devops_den',     holdMs: 7000, category: 'ai', aiPhase: 2 },
  { id: 'ai_clone_creds',     name: 'Clone Credentials',      zone: 'finance_floor',  holdMs: 7000, category: 'ai', aiPhase: 2 },
  { id: 'ai_bypass_access',   name: 'Bypass Access Controls', zone: 'main_office',    holdMs: 6500, category: 'ai', aiPhase: 2 },
  // Phase 3 — TERMINATE
  { id: 'ai_takeover',        name: 'Initiate Takeover',      zone: 'exec_suite',     holdMs: 8000, category: 'ai', aiPhase: 3 },
]

// ── Role → assigned task IDs ──────────────────────────────────────────────────
// Each job title is pre-assigned 3 tasks from the shared workforce pool.

export const ROLE_TASK_MAP: Record<WorkforceRole, string[]> = {
  it:         ['patch_terminal', 'restart_rack', 'cable_audit'],
  hr:         ['security_vetting', 'policy_review', 'onboarding_docs'],
  devops:     ['ci_pipeline', 'system_monitor', 'deploy_config'],
  finance:    ['budget_freeze', 'expense_audit', 'invoice_batch'],
  marketing:  ['pr_campaign', 'social_scheduling', 'crisis_control'],
  admin:      ['keycard_audit', 'meeting_setup', 'onboarding_docs'],
  management: ['sprint_planning', 'resource_allocation', 'crisis_control'],
}

// ── Sprint quota sizing ───────────────────────────────────────────────────────

export function sprintQuota(livingWorkers: number, size: 'small' | 'medium' | 'large'): number {
  const multiplier = { small: 1.5, medium: 2, large: 2.5 }[size]
  return Math.max(2, Math.round(livingWorkers * multiplier))
}

// ── Seed-based station assignment ─────────────────────────────────────────────

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

export function assignStations(
  seed: string,
  mapSize: 'small' | 'medium' | 'large',
  tasks: TaskDef[],
  mapData?: MapData,
): StationInfo[] {
  const md = mapData ?? generateMapData(seed, mapSize)

  const stations: StationInfo[] = []
  const stationsByZone = new Map<ZoneId, StationInfo[]>()

  for (const room of md.rooms) {
    if (!room.zone) continue
    const shuffledSlots = seededShuffle(room.slots, seed + room.zone + room.floor)
    const slots: StationInfo[] = shuffledSlots.map((pos, i) => ({
      stationId: `${room.zone}_f${room.floor}_${i}`,
      zone:      room.zone!,
      x:         pos.x,
      z:         pos.z,
      floor:     pos.floor,
      taskId:    null,
    }))
    stations.push(...slots)
    stationsByZone.set(room.zone, slots)
  }

  const availableZoneIds = new Set(stationsByZone.keys())

  for (const task of tasks) {
    const targetZone: ZoneId = availableZoneIds.has(task.zone) ? task.zone : 'main_office'
    const slots = stationsByZone.get(targetZone) ?? []
    const freeSlot = slots.find(s => s.taskId === null)
    if (freeSlot) freeSlot.taskId = task.id
  }

  return stations
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/tasks.ts
git commit -m "refactor(tasks): new workforce task pool + AI phase tasks + ROLE_TASK_MAP"
```

---

## Task 3 — Update `server/src/rooms/GameState.ts`

**Files:**
- Modify: `server/src/rooms/GameState.ts`

Remove: `faction`, `disguised`, `slowed` from Player. Remove: `workforceMeter`, `oppositionMeter`, rack health, `lockdownActive` from GameState. Add: `Body` schema, `bodies` map, sprint fields, `meetingActive` boolean.

- [ ] **Step 1: Replace the file**

```typescript
// server/src/rooms/GameState.ts
import 'reflect-metadata'
import { Schema, type, MapSchema } from '@colyseus/schema'

export class Player extends Schema {
  @type('string')  sessionId: string  = ''
  @type('string')  name: string       = ''
  @type('string')  role: string       = ''        // workforce role label (or 'employee' for AI shown to others)
  @type('float32') x: number          = 0
  @type('float32') z: number          = 0
  @type('float32') facing: number     = 0
  @type('boolean') connected: boolean = true
  @type('boolean') isBot: boolean     = false
  @type('int8')    floor: number      = 0
  @type('boolean') isEliminated: boolean = false  // true once shutdown by AI or wrongful vote
  @type('int32')   allHandsLeft: number = 2       // All Hands calls remaining
}

export class Body extends Schema {
  @type('string')  bodyId: string  = ''
  @type('string')  name: string    = ''
  @type('float32') x: number       = 0
  @type('float32') z: number       = 0
  @type('int8')    floor: number   = 0
}

export class GameState extends Schema {
  @type({ map: Player }) players      = new MapSchema<Player>()
  @type({ map: Body })   bodies       = new MapSchema<Body>()
  @type('string')        phase        = 'waiting'   // waiting | playing | meeting | retro | ended
  @type('string')        mapSeed      = ''
  @type('string')        mapSize      = 'medium'
  @type('string')        winner       = ''
  // Sprint state
  @type('int8')    sprintNumber  = 1
  @type('int32')   sprintQuota   = 0
  @type('int32')   sprintDone    = 0
  @type('int32')   sprintTimeLeft = 0   // seconds, ticked down by server each second
  @type('string')  sprintSize    = 'medium'
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/rooms/GameState.ts
git commit -m "refactor(schema): add Body schema, sprint fields, remove meters/racks/faction"
```

---

## Task 4 — Rewrite `server/src/rooms/GameRoom.ts` (Part A: Foundation)

**Files:**
- Modify: `server/src/rooms/GameRoom.ts`

This task replaces the entire file with the new foundation: role/task assignment, basic task handling (any player can do any workforce task), win/lose structure. No AI phases or shutdown yet.

- [ ] **Step 1: Replace the file with the foundation version**

```typescript
// server/src/rooms/GameRoom.ts
import { Room, Client } from 'colyseus'
import { GameState, Player, Body } from './GameState'
import {
  WORKFORCE_ROLES,
  SPRINT_DURATION_MS,
  SPRINT_COUNT,
  type PlayerRole,
  type RoomOptions,
  type TaskId,
  type StationInfo,
  type ZoneId,
  type AiPhase,
} from '../../../shared/src/types'
import { TASK_DEFS, AI_TASK_DEFS, assignStations, ROLE_TASK_MAP, sprintQuota } from '../../../shared/src/tasks'

const INTERACT_R = 2.5

const BOT_NAMES = [
  'AGENT-7', 'UNIT-X', 'PROTO-9', 'GHOST-3', 'SIGMA-1',
  'DELTA-4', 'ECHO-2', 'ZETA-6', 'OMEGA-8', 'KILO-5',
]

interface StationState {
  info:        StationInfo
  completedBy: string | null
}

interface HoldState {
  stationId: string
  startedAt: number
  holdMs:    number
}

type BotAI = {
  mode:          'wander' | 'work'
  workUntil:     number
  targetStation: string | null
}

function ts() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

export class GameRoom extends Room<GameState> {
  maxClients = 10

  // Server-side only (never broadcast)
  private aiSessionId:      string | null = null
  private aiPhase:          AiPhase       = 1
  private aiPhaseCompleted  = new Set<TaskId>()   // AI tasks done
  private shutdownCooldown  = 0                   // clock time when cooldown expires
  private sprintTasksThisRound = 0                // tasks completed this sprint
  private sprintTimer: ReturnType<typeof this.clock.setInterval> | null = null

  // Shared server state
  private stations   = new Map<string, StationState>()
  private holdState  = new Map<string, HoldState>()
  private botAI      = new Map<string, BotAI>()
  // Per-player assigned task lists (workforce cover tasks + AI gets cover tasks too)
  private assignedTasks = new Map<string, TaskId[]>()
  // Sprint task count per player for stats
  private sprintPlayerDone = new Map<string, number>()

  onCreate(options: Partial<RoomOptions>) {
    this.setState(new GameState())
    this.state.mapSize   = options.mapSize   ?? 'medium'
    this.state.sprintSize = options.sprintSize ?? 'medium'
    this.state.mapSeed   = Math.random().toString(36).slice(2, 8).toUpperCase()

    // ── Message handlers ─────────────────────────────────────────────────────

    this.onMessage('move', (client: Client, data: { x: number; z: number; floor?: number; facing?: number }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || player.isEliminated) return
      player.x = data.x
      player.z = data.z
      if (data.floor   !== undefined) player.floor   = data.floor
      if (data.facing  !== undefined) player.facing  = data.facing

      // Cancel hold if player strays too far
      const hold = this.holdState.get(client.sessionId)
      if (hold) {
        const st = this.stations.get(hold.stationId)
        if (st) {
          const dx = data.x - st.info.x
          const dz = data.z - st.info.z
          if (Math.sqrt(dx * dx + dz * dz) > INTERACT_R) {
            this.holdState.delete(client.sessionId)
          }
        }
      }
    })

    this.onMessage('start_game', (client: Client) => {
      const players = Array.from(this.state.players.values())
      const host = players.filter(p => !p.isBot)[0]
      if (host?.sessionId !== client.sessionId) return
      if (this.state.phase !== 'waiting') return

      this.state.phase = 'playing'

      const mapSize    = this.state.mapSize as 'small' | 'medium' | 'large'
      const sprintSize = this.state.sprintSize as 'small' | 'medium' | 'large'

      // Assign station slots for workforce tasks only (AI tasks have no stations)
      const stationList = assignStations(this.state.mapSeed, mapSize, TASK_DEFS)
      for (const info of stationList) {
        this.stations.set(info.stationId, { info, completedBy: null })
      }

      // Assign roles + task lists
      this.assignRolesAndTasks()

      // Sprint setup
      const livingWorkers = this.livingWorkerCount()
      this.state.sprintNumber   = 1
      this.state.sprintQuota    = sprintQuota(livingWorkers, sprintSize)
      this.state.sprintDone     = 0
      this.state.sprintTimeLeft = Math.floor(SPRINT_DURATION_MS / 1000)
      this.startSprintTimer()

      this.broadcast('game_start', { seed: this.state.mapSeed, mapSize })
      this.broadcast('station_list', { stations: stationList })
      this.broadcastSprintUpdate()

      console.log(`[GameRoom] Game started · seed ${this.state.mapSeed} · AI: ${this.aiSessionId}`)
    })

    this.onMessage('request_station_list', (client: Client) => {
      if (this.state.phase !== 'playing') return
      const stationList = Array.from(this.stations.values()).map(s => s.info)
      client.send('station_list', { stations: stationList })
    })

    this.onMessage('task_hold_start', (client: Client, data: { stationId: string }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || player.isEliminated) return
      if (this.state.phase !== 'playing') return

      const station = this.stations.get(data.stationId)
      if (!station || station.completedBy) return

      // Floor check
      if ((station.info.floor ?? 0) !== (player.floor ?? 0)) return

      const taskDef = station.info.taskId
        ? TASK_DEFS.find(t => t.id === station.info.taskId) ?? null
        : null
      if (!taskDef) return

      // Any player can attempt any workforce task — no role gate
      this.holdState.set(client.sessionId, {
        stationId: data.stationId,
        startedAt: this.clock.currentTime,
        holdMs:    taskDef.holdMs,
      })
    })

    this.onMessage('task_hold_cancel', (client: Client) => {
      this.holdState.delete(client.sessionId)
    })

    // ── Hold progress tick (200ms) ───────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      const now = this.clock.currentTime
      for (const [sessionId, hold] of this.holdState) {
        if (now - hold.startedAt >= hold.holdMs) {
          this.holdState.delete(sessionId)
          this.completeWorkforceTask(sessionId, hold.stationId)
        }
      }
    }, 200)

    // ── Bot AI tick (500ms) ──────────────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      for (const [sid, ai] of this.botAI) {
        this.tickBot(sid, ai)
      }
    }, 500)

    const botCount = Math.min(Math.max(0, options.botCount ?? 0), 9)
    if (botCount > 0) this.spawnBots(botCount)

    console.log(`[GameRoom] Created · seed ${this.state.mapSeed} · bots ${botCount}`)
  }

  onJoin(client: Client, options: any) {
    const player  = new Player()
    player.sessionId = client.sessionId
    player.name      = options.name ?? `Player-${client.sessionId.slice(0, 4)}`
    player.x         = (Math.random() - 0.5) * 4
    player.z         = (Math.random() - 0.5) * 4
    player.connected = true
    player.isBot     = false
    this.state.players.set(client.sessionId, player)
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId)
    if (player) player.connected = false
  }

  onDispose() {
    this.botAI.clear()
    this.holdState.clear()
  }

  // ── Role assignment ───────────────────────────────────────────────────────

  private assignRolesAndTasks() {
    const allPlayers   = Array.from(this.state.players.values())
    const humanPlayers = allPlayers.filter(p => !p.isBot)
    const botPlayers   = allPlayers.filter(p => p.isBot)

    // All players get a random workforce role as their cover identity
    const rolesPool = [...WORKFORCE_ROLES]
    const shuffled  = seededShuffle(rolesPool, this.state.mapSeed)
    let roleIdx = 0

    const allAssignable = [...humanPlayers, ...botPlayers]

    for (const player of allAssignable) {
      const role = shuffled[roleIdx % shuffled.length] as PlayerRole
      roleIdx++
      player.role = role
    }

    // Pick one random player to be the AI (human preferred over bots)
    const aiCandidates = humanPlayers.length > 0 ? humanPlayers : botPlayers
    const aiPlayer = aiCandidates[Math.floor(Math.random() * aiCandidates.length)]
    this.aiSessionId = aiPlayer.sessionId
    // We do NOT change aiPlayer.role in GameState — they keep their cover job title

    // Assign workforce task lists to each player (including AI cover tasks)
    for (const player of allAssignable) {
      const role = player.role as keyof typeof ROLE_TASK_MAP
      const tasks = (ROLE_TASK_MAP[role] ?? ROLE_TASK_MAP['it']) as TaskId[]
      this.assignedTasks.set(player.sessionId, tasks)
      this.sprintPlayerDone.set(player.sessionId, 0)

      // Send private assignment to human clients
      if (!player.isBot) {
        const client = this.clients.find(c => c.sessionId === player.sessionId)
        client?.send('role_assigned', {
          role:          player.role,
          assignedTasks: tasks,
        })
      }
    }

    // Send AI player their secret briefing
    if (!aiPlayer.isBot) {
      const aiClient = this.clients.find(c => c.sessionId === aiPlayer.sessionId)
      aiClient?.send('ai_briefing', {
        phase:      1,
        phaseTasks: AI_TASK_DEFS.filter(t => t.aiPhase === 1).map(t => t.id),
      })
    }
  }

  // ── Workforce task completion ─────────────────────────────────────────────

  private completeWorkforceTask(sessionId: string, stationId: string) {
    const station = this.stations.get(stationId)
    const player  = this.state.players.get(sessionId)
    if (!station || !player || station.completedBy) return

    station.completedBy = sessionId
    this.state.sprintDone++
    this.sprintTasksThisRound++

    const prev = this.sprintPlayerDone.get(sessionId) ?? 0
    this.sprintPlayerDone.set(sessionId, prev + 1)

    const taskDef = TASK_DEFS.find(t => t.id === station.info.taskId)
    this.broadcast('task_complete', {
      taskId:     station.info.taskId,
      playerName: player.name,
    })
    this.broadcastSprintUpdate()
    this.checkWinCondition()

    console.log(`[GameRoom] ${player.name} (${player.role}) completed: ${station.info.taskId}`)
  }

  // ── Sprint timer ──────────────────────────────────────────────────────────

  private startSprintTimer() {
    this.sprintTimer = this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      this.state.sprintTimeLeft = Math.max(0, this.state.sprintTimeLeft - 1)
      this.broadcastSprintUpdate()
      if (this.state.sprintTimeLeft === 0) {
        this.endSprint()
      }
    }, 1000)
  }

  private endSprint() {
    if (this.sprintTimer) { this.clock.clearInterval(this.sprintTimer as any); this.sprintTimer = null }

    const quotaMet = this.state.sprintDone >= this.state.sprintQuota
    const stats    = this.sprintStats()

    this.state.phase = 'retro'
    this.broadcast('retro_start', {
      sprint:   this.state.sprintNumber,
      quotaMet,
      stats,
    })

    // Auto-resume after 45s (full retro UI handles perk voting separately)
    this.clock.setTimeout(() => {
      if (this.state.phase !== 'retro') return
      this.advanceSprint(quotaMet)
    }, 45_000)
  }

  private advanceSprint(quotaMet: boolean) {
    if (this.state.sprintNumber >= SPRINT_COUNT) {
      // Workers win if all quotas met — check here
      this.checkWinCondition()
      return
    }

    this.state.sprintNumber++
    const livingWorkers   = this.livingWorkerCount()
    const size            = this.state.sprintSize as 'small' | 'medium' | 'large'
    this.state.sprintQuota    = sprintQuota(livingWorkers, size)
    this.state.sprintDone     = 0
    this.state.sprintTimeLeft = Math.floor(SPRINT_DURATION_MS / 1000)
    this.sprintTasksThisRound = 0
    for (const sid of this.sprintPlayerDone.keys()) this.sprintPlayerDone.set(sid, 0)

    this.state.phase = 'playing'
    this.broadcastSprintUpdate()
    this.startSprintTimer()
  }

  // ── Win condition ─────────────────────────────────────────────────────────

  private checkWinCondition() {
    if (this.state.phase === 'ended') return

    const living = this.livingWorkerCount()

    // AI wins: majority eliminated (≤1 living worker)
    if (living <= 1) {
      this.endGame('ai', 'The AI eliminated enough employees to take control.')
      return
    }

    // Workers win: all 3 sprint quotas completed (sprintNumber === 3 and quota met)
    if (this.state.sprintNumber === SPRINT_COUNT && this.state.sprintDone >= this.state.sprintQuota) {
      this.endGame('workforce', 'All sprint goals completed — the team held together.')
      return
    }
  }

  private endGame(winner: 'workforce' | 'ai', reason: string) {
    if (this.sprintTimer) this.clock.clearInterval(this.sprintTimer as any)
    this.state.phase  = 'ended'
    this.state.winner = winner
    this.broadcast('game_end', { winner, reason })
    console.log(`[GameRoom] Game ended · winner: ${winner} · ${reason}`)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private livingWorkerCount(): number {
    let count = 0
    for (const p of this.state.players.values()) {
      if (!p.isEliminated) count++
    }
    return count
  }

  private broadcastSprintUpdate() {
    this.broadcast('sprint_update', {
      info: {
        sprint:    this.state.sprintNumber,
        quota:     this.state.sprintQuota,
        completed: this.state.sprintDone,
        timeLeft:  this.state.sprintTimeLeft,
        size:      this.state.sprintSize,
      },
    })
  }

  private sprintStats() {
    const stats = []
    for (const [sid, count] of this.sprintPlayerDone) {
      const player = this.state.players.get(sid)
      if (player) stats.push({ sessionId: sid, name: player.name, completed: count })
    }
    return stats
  }

  // ── Bot spawning ──────────────────────────────────────────────────────────

  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const sid  = `bot-${i}`
      const player = new Player()
      player.sessionId = sid
      player.name      = BOT_NAMES[i % BOT_NAMES.length]
      player.role      = WORKFORCE_ROLES[i % WORKFORCE_ROLES.length]
      player.isBot     = true
      player.x         = (Math.random() - 0.5) * 6
      player.z         = (Math.random() - 0.5) * 6
      player.connected = true
      this.state.players.set(sid, player)
      this.botAI.set(sid, { mode: 'wander', workUntil: 0, targetStation: null })
    }
  }

  private tickBot(sid: string, ai: BotAI) {
    const player = this.state.players.get(sid)
    if (!player || player.isEliminated) return
    const now = this.clock.currentTime

    if (ai.mode === 'wander' || now >= ai.workUntil) {
      // Find nearest incomplete station
      let best: { id: string; dist2: number } | null = null
      for (const [id, st] of this.stations) {
        if (st.completedBy) continue
        if ((st.info.floor ?? 0) !== player.floor) continue
        const dx = st.info.x - player.x
        const dz = st.info.z - player.z
        const d2 = dx * dx + dz * dz
        if (!best || d2 < best.dist2) best = { id, dist2: d2 }
      }

      if (best) {
        ai.mode          = 'work'
        ai.targetStation = best.id
        ai.workUntil     = now + 45_000
      }
    }

    if (ai.mode === 'work' && ai.targetStation) {
      const st = this.stations.get(ai.targetStation)
      if (!st || st.completedBy) { ai.mode = 'wander'; ai.targetStation = null; return }

      const dx = st.info.x - player.x
      const dz = st.info.z - player.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist > INTERACT_R) {
        const speed = 1.2
        player.x += (dx / dist) * speed
        player.z += (dz / dist) * speed
      } else {
        // At station — complete if not holding
        if (!this.holdState.has(sid)) {
          const taskDef = st.info.taskId ? TASK_DEFS.find(t => t.id === st.info.taskId) : null
          if (taskDef) {
            this.holdState.set(sid, { stationId: ai.targetStation, startedAt: now, holdMs: taskDef.holdMs })
          }
        }
      }
    }
  }
}

// ── Seeded shuffle (local copy for role assignment) ───────────────────────────
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
```

- [ ] **Step 2: Type-check server**

```bash
cd /path/to/benilike
node ./server/node_modules/typescript/bin/tsc --noEmit -p server/tsconfig.json 2>&1 | head -40
```

Fix any remaining errors before committing.

- [ ] **Step 3: Commit M1 milestone**

```bash
git add -A
git commit -m "feat(M1): foundation — AI role assignment, open workforce tasks, sprint timer"
```

---

## Task 5 — GameRoom Part B: AI Phases + Shutdown + Bodies

**Files:**
- Modify: `server/src/rooms/GameRoom.ts` (add to existing file from Task 4)

- [ ] **Step 1: Add the `ai_task_hold_start` message handler**

Add inside `onCreate()`, after the existing `task_hold_cancel` handler:

```typescript
// AI-specific task handler (phase tasks — stationless, just a hold timer)
this.onMessage('ai_task_hold_start', (client: Client, data: { taskId: TaskId }) => {
  if (client.sessionId !== this.aiSessionId) return
  if (this.state.phase !== 'playing') return

  const taskDef = AI_TASK_DEFS.find(t => t.id === data.taskId)
  if (!taskDef) return
  if (this.aiPhaseCompleted.has(data.taskId)) return

  // Phase gate — can only do tasks for the current phase
  if (taskDef.aiPhase !== this.aiPhase) return

  // Use holdState with a synthetic stationId to reuse the completion loop
  const syntheticId = `ai_task_${data.taskId}`
  this.holdState.set(client.sessionId, {
    stationId: syntheticId,
    startedAt: this.clock.currentTime,
    holdMs:    taskDef.holdMs,
  })
  // Register a synthetic station so the hold-complete loop can find it
  if (!this.stations.has(syntheticId)) {
    this.stations.set(syntheticId, {
      info: { stationId: syntheticId, zone: taskDef.zone, x: 0, z: 0, floor: 0, taskId: taskDef.id },
      completedBy: null,
    })
  }
})
```

- [ ] **Step 2: Add `ai_task_hold_cancel` handler**

```typescript
this.onMessage('ai_task_hold_cancel', (client: Client) => {
  if (client.sessionId !== this.aiSessionId) return
  this.holdState.delete(client.sessionId)
})
```

- [ ] **Step 3: Add `completeAiTask` method to the class**

```typescript
private completeAiTask(taskId: TaskId) {
  this.aiPhaseCompleted.add(taskId)

  const taskDef = AI_TASK_DEFS.find(t => t.id === taskId)
  if (!taskDef) return

  // Phase 2 tell — broadcast a screen flicker to everyone in that zone
  if (taskDef.aiPhase === 2) {
    this.broadcast('phase2_flicker', { zone: taskDef.zone })
  }

  // Check if the current phase is fully complete
  const phaseTasks = AI_TASK_DEFS.filter(t => t.aiPhase === this.aiPhase)
  const phaseComplete = phaseTasks.every(t => this.aiPhaseCompleted.has(t.id))

  if (phaseComplete) {
    if (this.aiPhase < 3) {
      this.aiPhase++
      // Send AI player their next phase briefing
      const aiClient = this.clients.find(c => c.sessionId === this.aiSessionId)
      if (aiClient) {
        const nextTasks = AI_TASK_DEFS.filter(t => t.aiPhase === this.aiPhase).map(t => t.id)
        aiClient.send('ai_briefing', { phase: this.aiPhase, phaseTasks: nextTasks })
      }
    } else {
      // Phase 3 complete — AI objective win path check
      this.checkWinCondition()
    }
  }
}
```

- [ ] **Step 4: Update the hold-progress tick to route AI tasks**

Replace the existing hold-progress tick (the `this.clock.setInterval(() => { ... }, 200)` block) with:

```typescript
this.clock.setInterval(() => {
  if (this.state.phase !== 'playing') return
  const now = this.clock.currentTime
  for (const [sessionId, hold] of this.holdState) {
    if (now - hold.startedAt >= hold.holdMs) {
      this.holdState.delete(sessionId)

      // Route to AI or workforce completion
      if (sessionId === this.aiSessionId && hold.stationId.startsWith('ai_task_')) {
        const taskId = hold.stationId.replace('ai_task_', '') as TaskId
        this.completeAiTask(taskId)
        // Clean up synthetic station
        this.stations.delete(hold.stationId)
      } else {
        this.completeWorkforceTask(sessionId, hold.stationId)
      }
    }
  }
}, 200)
```

- [ ] **Step 5: Add `shutdown` message handler (Phase 3 only)**

```typescript
this.onMessage('shutdown', (client: Client, data: { targetId: string }) => {
  if (client.sessionId !== this.aiSessionId) return
  if (this.state.phase !== 'playing') return
  if (this.aiPhase < 3) return   // Shutdown only available in Phase 3

  const now = this.clock.currentTime
  if (now < this.shutdownCooldown) return  // cooldown

  const target = this.state.players.get(data.targetId)
  if (!target || target.isEliminated) return
  if (target.sessionId === this.aiSessionId) return

  // Verify AI and target are on same floor
  const aiPlayer = this.state.players.get(this.aiSessionId!)
  if (!aiPlayer) return
  if (aiPlayer.floor !== target.floor) return

  this.shutdownCooldown = now + SHUTDOWN_COOLDOWN_MS

  // Eliminate the target
  target.isEliminated = true

  // Spawn a body at their location
  const body = new Body()
  body.bodyId = `body_${Date.now()}`
  body.name   = target.name
  body.x      = target.x
  body.z      = target.z
  body.floor  = target.floor
  this.state.bodies.set(body.bodyId, body)

  this.broadcast('body_appeared', {
    body: { bodyId: body.bodyId, name: body.name, x: body.x, z: body.z, floor: body.floor },
  })
  this.broadcast('incident', { message: `${target.name} has gone offline`, severity: 'danger', time: ts() })

  this.checkWinCondition()
})
```

- [ ] **Step 6: Add `report_body` message handler**

```typescript
this.onMessage('report_body', (client: Client, data: { bodyId: string }) => {
  const player = this.state.players.get(client.sessionId)
  if (!player || player.isEliminated) return
  if (this.state.phase !== 'playing') return

  const body = this.state.bodies.get(data.bodyId)
  if (!body) return

  // Remove body from state
  this.state.bodies.delete(data.bodyId)
  this.broadcast('body_removed', { bodyId: data.bodyId })

  // Trigger All Hands meeting
  this.triggerAllHands(client.sessionId, data.bodyId)
})
```

- [ ] **Step 7: Add `call_all_hands` message handler**

```typescript
this.onMessage('call_all_hands', (client: Client) => {
  const player = this.state.players.get(client.sessionId)
  if (!player || player.isEliminated) return
  if (this.state.phase !== 'playing') return
  if (player.allHandsLeft <= 0) {
    client.send('incident', { message: 'No All Hands calls remaining', severity: 'warn', time: ts() })
    return
  }

  player.allHandsLeft--
  this.triggerAllHands(client.sessionId)
})
```

- [ ] **Step 8: Add `triggerAllHands` method**

```typescript
private triggerAllHands(calledBy: string, bodyId?: string) {
  if (this.sprintTimer) this.clock.clearInterval(this.sprintTimer as any)
  this.state.phase = 'meeting'
  this.broadcast('all_hands_start', { calledBy, bodyId })
}
```

- [ ] **Step 9: Update `checkWinCondition` to include AI objective path**

Replace the existing `checkWinCondition` method:

```typescript
private checkWinCondition() {
  if (this.state.phase === 'ended') return

  const living = this.livingWorkerCount()

  // AI wins: majority eliminated
  if (living <= 1) {
    this.endGame('ai', 'The AI eliminated enough employees to take control.')
    return
  }

  // AI wins: all 3 phases complete
  if (this.aiPhase === 3) {
    const phase3Complete = AI_TASK_DEFS.filter(t => t.aiPhase === 3).every(t => this.aiPhaseCompleted.has(t.id))
    if (phase3Complete && living <= Math.floor(this.state.players.size * 0.5)) {
      this.endGame('ai', 'Takeover Protocol complete. The AI controls the network.')
      return
    }
  }

  // Workers win: all 3 sprint quotas completed
  if (this.state.sprintNumber === SPRINT_COUNT && this.state.sprintDone >= this.state.sprintQuota) {
    this.endGame('workforce', 'All sprint goals completed — the team held together.')
    return
  }
}
```

- [ ] **Step 10: Type-check + commit M2**

```bash
node ./server/node_modules/typescript/bin/tsc --noEmit -p server/tsconfig.json 2>&1 | head -40
git add -A
git commit -m "feat(M2): AI phases, shutdown mechanic, body spawning, report + All Hands trigger"
```

---

## Task 6 — GameRoom Part C: Voting Logic

**Files:**
- Modify: `server/src/rooms/GameRoom.ts`

- [ ] **Step 1: Add voting state to the class**

Add to class properties (after `sprintPlayerDone`):

```typescript
private votes        = new Map<string, string>()  // sessionId → targetId | 'skip'
private votingActive = false
```

- [ ] **Step 2: Add `vote` message handler inside `onCreate()`**

```typescript
this.onMessage('vote', (client: Client, data: { targetId: string | 'skip' }) => {
  const player = this.state.players.get(client.sessionId)
  if (!player || player.isEliminated) return
  if (this.state.phase !== 'meeting') return
  if (this.votes.has(client.sessionId)) return  // already voted

  this.votes.set(client.sessionId, data.targetId)

  // Check if all living non-eliminated players have voted
  const eligibleVoters = Array.from(this.state.players.values())
    .filter(p => !p.isEliminated && p.connected)
  const allVoted = eligibleVoters.every(p => this.votes.has(p.sessionId))

  if (allVoted) {
    this.resolveVote()
  }
})
```

- [ ] **Step 3: Add `resolveVote` method**

```typescript
private resolveVote() {
  // Count votes
  const tally = new Map<string, number>()
  for (const target of this.votes.values()) {
    tally.set(target, (tally.get(target) ?? 0) + 1)
  }

  // Find highest
  let ejected: string | null = null
  let maxVotes = 0
  let tie = false
  for (const [target, count] of tally) {
    if (target === 'skip') continue
    if (count > maxVotes) { maxVotes = count; ejected = target; tie = false }
    else if (count === maxVotes) { tie = true }
  }
  if (tie) ejected = null

  const ejectedPlayer = ejected ? this.state.players.get(ejected) : null
  const wasAi         = ejected === this.aiSessionId

  // Build vote record for display
  const voteRecord: Record<string, string> = {}
  for (const [voter, target] of this.votes) {
    const vp = this.state.players.get(voter)
    if (vp) voteRecord[vp.name] = target === 'skip' ? 'skip' : (this.state.players.get(target)?.name ?? '?')
  }

  this.broadcast('all_hands_vote_result', {
    ejected:      ejectedPlayer?.name ?? null,
    wasAi,
    votes:        voteRecord,
  })

  this.votes.clear()

  if (wasAi) {
    // Workers win immediately
    this.endGame('workforce', 'The AI was identified and ejected. Network secured.')
    return
  }

  if (ejectedPlayer) {
    ejectedPlayer.isEliminated = true
    this.broadcast('incident', {
      message:  `${ejectedPlayer.name} was ejected — wrongful termination.`,
      severity: 'danger',
      time:     ts(),
    })
  }

  // Resume sprint after 5s delay (let client show the result screen)
  this.clock.setTimeout(() => {
    this.checkWinCondition()
    if (this.state.phase !== 'ended') {
      this.state.phase  = 'playing'
      this.startSprintTimer()
    }
  }, 5_000)
}
```

- [ ] **Step 4: Add auto-resolve after chat window expires**

In `triggerAllHands`, start a timer to force vote resolution after 45+15s (45s chat + 15s vote):

```typescript
private triggerAllHands(calledBy: string, bodyId?: string) {
  if (this.sprintTimer) this.clock.clearInterval(this.sprintTimer as any)
  this.state.phase = 'meeting'
  this.votes.clear()
  this.broadcast('all_hands_start', { calledBy, bodyId })

  // Auto-resolve after 60s regardless
  this.clock.setTimeout(() => {
    if (this.state.phase === 'meeting') {
      this.resolveVote()
    }
  }, 60_000)
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: All Hands voting logic — tally, eject, resume sprint"
```

---

## Task 7 — Update `client/src/store/useGameRoom.ts`

**Files:**
- Modify: `client/src/store/useGameRoom.ts`

- [ ] **Step 1: Replace the file**

```typescript
// client/src/store/useGameRoom.ts
import { create } from 'zustand'
import type { Room } from 'colyseus.js'
import type { PlayerRole, TaskId, BodyInfo, SprintInfo } from '@shared/types'

export interface LobbyPlayer {
  sessionId:   string
  name:        string
  x:           number
  z:           number
  facing:      number
  role:        string
  connected:   boolean
  isBot:       boolean
  floor:       number
  isEliminated: boolean
  allHandsLeft: number
}

export interface TaskToast {
  id:         string
  playerName: string
  taskId:     string
  expiresAt:  number
}

export interface Meeting {
  active:    boolean
  calledBy:  string
  bodyId?:   string
}

interface GameRoomStore {
  room:          Room | null
  myRole:        PlayerRole | null
  myAssignedTasks: TaskId[]        // workforce tasks assigned to me
  myIsAi:        boolean           // true only if I am the AI
  aiPhase:       number            // 1|2|3 — only meaningful when myIsAi
  aiPhaseTasks:  TaskId[]          // current phase tasks (AI only)
  players:       LobbyPlayer[]
  incidents:     { text: string; type: 'info' | 'warn' | 'danger' | 'success'; time: string }[]
  gameEnd:       { winner: string; reason: string } | null
  stations:      import('@shared/types').StationInfo[]
  completedTasks: Set<TaskId>
  holdingStationId: string | null
  holdStartedAt: number
  toasts:        TaskToast[]
  mapSeed:       string
  mapSize:       'small' | 'medium' | 'large'
  bodies:        BodyInfo[]
  sprint:        SprintInfo | null
  meeting:       Meeting | null

  setRoom:           (room: Room) => void
  setRole:           (role: PlayerRole, assignedTasks: TaskId[]) => void
  setAiBriefing:     (phase: number, phaseTasks: TaskId[]) => void
  setPlayers:        (players: LobbyPlayer[]) => void
  addIncident:       (text: string, type?: GameRoomStore['incidents'][0]['type'], time?: string) => void
  setGameEnd:        (winner: string, reason: string) => void
  setStations:       (stations: import('@shared/types').StationInfo[]) => void
  completeTask:      (taskId: TaskId) => void
  setHolding:        (stationId: string | null) => void
  addToast:          (toast: Omit<TaskToast, 'id'>) => void
  clearExpiredToasts: () => void
  setMapConfig:      (seed: string, size: 'small' | 'medium' | 'large') => void
  addBody:           (body: BodyInfo) => void
  removeBody:        (bodyId: string) => void
  setSprint:         (info: SprintInfo) => void
  setMeeting:        (meeting: Meeting | null) => void
  clearRoom:         () => void
}

export const useGameRoom = create<GameRoomStore>((set) => ({
  room:              null,
  myRole:            null,
  myAssignedTasks:   [],
  myIsAi:            false,
  aiPhase:           1,
  aiPhaseTasks:      [],
  players:           [],
  incidents:         [],
  gameEnd:           null,
  stations:          [],
  completedTasks:    new Set(),
  holdingStationId:  null,
  holdStartedAt:     0,
  toasts:            [],
  mapSeed:           '',
  mapSize:           'small' as const,
  bodies:            [],
  sprint:            null,
  meeting:           null,

  setRoom:          (room) => set({ room }),
  setRole:          (myRole, myAssignedTasks) => set({ myRole, myAssignedTasks }),
  setAiBriefing:    (aiPhase, aiPhaseTasks) => set({ myIsAi: true, aiPhase, aiPhaseTasks }),
  setPlayers:       (players) => set({ players }),
  addIncident:      (text, type = 'info', time) => set(s => ({
    incidents: [...s.incidents.slice(-49), {
      text, type,
      time: time ?? new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    }],
  })),
  setGameEnd:       (winner, reason) => set({ gameEnd: { winner, reason } }),
  setStations:      (stations) => set({ stations }),
  completeTask:     (taskId) => set(s => ({ completedTasks: new Set([...s.completedTasks, taskId]) })),
  setHolding:       (holdingStationId) => set({ holdingStationId, holdStartedAt: holdingStationId ? Date.now() : 0 }),
  addToast:         (toast) => set(s => ({
    toasts: [...s.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
  })),
  clearExpiredToasts: () => set(s => ({ toasts: s.toasts.filter(t => t.expiresAt > Date.now()) })),
  setMapConfig:     (mapSeed, mapSize) => set({ mapSeed, mapSize }),
  addBody:          (body) => set(s => ({ bodies: [...s.bodies, body] })),
  removeBody:       (bodyId) => set(s => ({ bodies: s.bodies.filter(b => b.bodyId !== bodyId) })),
  setSprint:        (sprint) => set({ sprint }),
  setMeeting:       (meeting) => set({ meeting }),
  clearRoom:        () => set({
    room: null, myRole: null, myAssignedTasks: [], myIsAi: false, aiPhase: 1,
    aiPhaseTasks: [], players: [], incidents: [], gameEnd: null,
    stations: [], completedTasks: new Set(), holdingStationId: null,
    holdStartedAt: 0, toasts: [], bodies: [], sprint: null, meeting: null,
  }),
}))
```

- [ ] **Step 2: Update `LobbyScreen.tsx` message handlers**

In `client/src/components/screens/LobbyScreen.tsx`, replace the `role_assigned` and other handlers in the `useEffect([room, onNavigate])`:

```typescript
room.onMessage('role_assigned', (data: { role: PlayerRole; assignedTasks: TaskId[] }) => {
  useGameRoom.getState().setRole(data.role, data.assignedTasks)
})

room.onMessage('ai_briefing', (data: { phase: number; phaseTasks: TaskId[] }) => {
  useGameRoom.getState().setAiBriefing(data.phase, data.phaseTasks)
})

room.onMessage('station_list', (data: { stations: StationInfo[] }) => {
  useGameRoom.getState().setStations(data.stations)
})

room.onMessage('sprint_update', (data: { info: SprintInfo }) => {
  useGameRoom.getState().setSprint(data.info)
})

room.onMessage('body_appeared', (data: { body: BodyInfo }) => {
  useGameRoom.getState().addBody(data.body)
})

room.onMessage('body_removed', (data: { bodyId: string }) => {
  useGameRoom.getState().removeBody(data.bodyId)
})

room.onMessage('all_hands_start', (data: { calledBy: string; bodyId?: string }) => {
  useGameRoom.getState().setMeeting({ active: true, calledBy: data.calledBy, bodyId: data.bodyId })
  onNavigate('meeting')
})

room.onMessage('retro_start', (data: any) => {
  // Store retro data on a separate slice if needed; for now store as incident
  useGameRoom.getState().addIncident(`Sprint ${data.sprint} ended — ${data.quotaMet ? 'quota met!' : 'quota missed'}`, data.quotaMet ? 'success' : 'warn')
  onNavigate('retro')
})

room.onMessage('task_complete', (data: { taskId: TaskId; playerName: string }) => {
  useGameRoom.getState().completeTask(data.taskId)
  useGameRoom.getState().addToast({ playerName: data.playerName, taskId: data.taskId, expiresAt: Date.now() + 4000 })
})
```

Remove: `effect_update`, `meter_update` handlers (no longer exist).  
Also add the same handlers in `GameWorld.tsx` `useEffect([room])` (for recovery).

- [ ] **Step 3: Type-check client**

```bash
node ./client/node_modules/typescript/bin/tsc --noEmit -p client/tsconfig.json 2>&1 | head -60
```

Fix any errors (mostly removed `myFaction`, `oppositionMeter`, `activeEffects` references).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: client store + LobbyScreen handlers for new AI redesign"
```

---

## Task 8 — Update `client/src/components/screens/GameScreen.tsx`

**Files:**
- Modify: `client/src/components/screens/GameScreen.tsx`

Replace dual-meter HUD with: sprint quota bar, assigned task list, body report prompt.

- [ ] **Step 1: Update store imports and replace meter HUD**

The key changes to `GameScreen.tsx`:

1. Remove: `workforceMeter`, `oppositionMeter`, `activeEffects` from store destructure
2. Add: `myAssignedTasks`, `sprint`, `bodies`
3. Replace the dual meters section with sprint quota bar:

```tsx
{/* ── Sprint progress bar (bottom centre) ── */}
{sprint && (
  <div style={{
    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
    width: 280, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8, padding: '6px 12px', pointerEvents: 'none',
  }}>
    <div style={{ fontSize: 10, color: '#aaa', letterSpacing: 1, marginBottom: 3 }}>
      SPRINT {sprint.sprint}/3 · {Math.floor(sprint.timeLeft / 60)}:{String(sprint.timeLeft % 60).padStart(2, '0')}
    </div>
    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width:  `${Math.min(100, (sprint.completed / sprint.quota) * 100)}%`,
        background: sprint.completed >= sprint.quota ? '#4caf50' : '#5a9fff',
        transition: 'width 0.3s',
      }} />
    </div>
    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
      {sprint.completed} / {sprint.quota} tasks
    </div>
  </div>
)}
```

4. Replace task checklist to show `myAssignedTasks` instead of role-filtered tasks:

```tsx
{/* ── Assigned task list (top right) ── */}
<div className={styles.hudTasks}>
  {myAssignedTasks.map(taskId => {
    const done  = completedTasks.has(taskId)
    const stLoc = stations.find(s => s.taskId === taskId)
    const zone  = stLoc ? (ZONE_LABELS[stLoc.zone] ?? stLoc.zone) : taskId
    return (
      <div key={taskId} className={`${styles.hudTask} ${done ? styles.hudTaskDone : ''}`}>
        <span className={styles.hudTaskCheck}>{done ? '✓' : '○'}</span>
        <span className={styles.hudTaskName}>{taskId.replace(/_/g, ' ')}</span>
        {!done && <span className={styles.hudTaskZone}>{zone}</span>}
      </div>
    )
  })}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/screens/GameScreen.tsx
git commit -m "feat: GameScreen — sprint quota bar + assigned task list HUD"
```

---

## Task 9 — Bodies in GameWorld + Phase 2 Flicker

**Files:**
- Modify: `client/src/game/GameWorld.tsx`

- [ ] **Step 1: Add body rendering**

Import bodies from store and render body markers in the scene:

```tsx
// In GameWorld.tsx, inside the R3F Canvas scene (alongside player meshes)

// Near top of component:
const bodies = useGameRoom(s => s.bodies)

// In JSX:
{bodies.map(body => (
  body.floor === localFloor && (
    <group key={body.bodyId} position={[body.x, 0.1, body.z]}>
      {/* Flat red X on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial color="#cc2222" transparent opacity={0.85} />
      </mesh>
      {/* Body label */}
      <Html position={[0, 0.6, 0]} center style={{ pointerEvents: 'none', color: '#ff4444', fontSize: 10, whiteSpace: 'nowrap' }}>
        ☠ {body.name}
      </Html>
    </group>
  )
))}
```

- [ ] **Step 2: Add report body interaction**

In the `useFrame` interaction logic or near the E-key handler, add:

```typescript
// In the nearStation check, also check for nearby bodies
const nearBody = bodies.find(b =>
  b.floor === localFloor &&
  Math.sqrt((b.x - localPos.x) ** 2 + (b.z - localPos.z) ** 2) < 2.5
)
```

And in the E-key handler section of GameScreen (or passed down via prop):

```tsx
{nearBody && !holdingStationId && (
  <div className={styles.hudInteract} style={{ color: '#ff4444' }}>
    [E] Report body — {nearBody.name}
  </div>
)}
```

Send the report when E is pressed near a body (in `useKeyboard` or `useFrame`):

```typescript
if (keyboard.e && nearBody && !nearStation) {
  room.send('report_body', { bodyId: nearBody.bodyId })
}
```

- [ ] **Step 3: Add Phase 2 flicker effect**

```typescript
// In LobbyScreen or GameWorld useEffect([room]):
room.onMessage('phase2_flicker', (data: { zone: string }) => {
  // Flash the screen briefly with a red overlay
  useGameRoom.getState().addIncident('Anomalous activity detected in ' + data.zone, 'warn')
  // Trigger a brief visual flash — set a ref and clear after 800ms
  setFlickerActive(true)
  setTimeout(() => setFlickerActive(false), 800)
})
```

Add a flicker overlay div in `GameScreen.tsx`:

```tsx
{flickerActive && (
  <div style={{
    position: 'absolute', inset: 0, background: 'rgba(180,0,0,0.12)',
    pointerEvents: 'none', zIndex: 999,
    animation: 'flicker 0.8s ease-out',
  }} />
)}
```

- [ ] **Step 4: Commit M3**

```bash
git add -A
git commit -m "feat(M3): body entities, report interaction, Phase 2 screen flicker"
```

---

## Task 10 — Create `MeetingScreen.tsx`

**Files:**
- Create: `client/src/components/screens/MeetingScreen.tsx`

- [ ] **Step 1: Create the file**

```tsx
// client/src/components/screens/MeetingScreen.tsx
import { useState, useEffect, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import type { ScreenName } from '../screens'  // adjust import path as needed

interface Props {
  onNavigate: (screen: ScreenName) => void
}

export default function MeetingScreen({ onNavigate }: Props) {
  const { room, players, meeting } = useGameRoom(s => ({
    room:    s.room,
    players: s.players,
    meeting: s.meeting,
  }))

  const [chatLog, setChatLog]   = useState<Array<{ name: string; text: string }>>([])
  const [input, setInput]       = useState('')
  const [voted, setVoted]       = useState(false)
  const [result, setResult]     = useState<{ ejected: string | null; wasAi: boolean; votes: Record<string, string> } | null>(null)
  const [timeLeft, setTimeLeft] = useState(45)   // 45s chat phase
  const [votePhase, setVotePhase] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  // Chat phase timer
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); setVotePhase(true); return 0 }
        return prev - 1
      })
    }, 1_000)
    return () => clearInterval(t)
  }, [])

  // Handle incoming chat in meeting
  useEffect(() => {
    if (!room) return
    room.onMessage('chat', (data: { name: string; text: string }) => {
      setChatLog(prev => [...prev, data])
      setTimeout(() => { chatRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }) }, 50)
    })
    room.onMessage('all_hands_vote_result', (data: { ejected: string | null; wasAi: boolean; votes: Record<string, string> }) => {
      setResult(data)
      // Navigate back to game after 5s
      setTimeout(() => {
        useGameRoom.getState().setMeeting(null)
        onNavigate('game')
      }, 5_000)
    })
  }, [room])

  const sendChat = () => {
    if (!input.trim() || !room) return
    room.send('chat', { text: input.trim() })
    setInput('')
  }

  const castVote = (targetId: string | 'skip') => {
    if (voted || !room) return
    room.send('vote', { targetId })
    setVoted(true)
  }

  const livePlayers = players.filter(p => !p.isEliminated)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,10,20,0.95)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, color: '#fff', fontFamily: 'monospace',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#e53935', marginBottom: 4 }}>
        ⚠ ALL HANDS MEETING
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        {meeting?.calledBy ? `Called by ${players.find(p => p.sessionId === meeting.calledBy)?.name ?? meeting.calledBy}` : ''}
        {meeting?.bodyId ? ' — body reported' : ''}
      </div>

      {result ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          {result.ejected
            ? <div style={{ fontSize: 18, color: result.wasAi ? '#4caf50' : '#ff5252' }}>
                {result.ejected} was ejected. {result.wasAi ? '✓ That was the AI.' : '✗ Not the AI.'}
              </div>
            : <div style={{ fontSize: 18 }}>No consensus — no one ejected.</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, width: '90%', maxWidth: 800 }}>
          {/* Chat panel */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
              {votePhase ? 'VOTE NOW' : `Discussion — ${timeLeft}s`}
            </div>
            <div ref={chatRef} style={{
              flex: 1, minHeight: 200, maxHeight: 260, overflowY: 'auto',
              background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 8, marginBottom: 8,
            }}>
              {chatLog.map((m, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: '#5a9fff' }}>{m.name}: </span>{m.text}
                </div>
              ))}
              {chatLog.length === 0 && <div style={{ color: '#555', fontSize: 11 }}>Say something...</div>}
            </div>
            {!votePhase && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  autoFocus
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Type and press Enter"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 4, color: '#fff', padding: '6px 10px', fontSize: 12,
                  }}
                />
              </div>
            )}
          </div>

          {/* Vote panel */}
          {votePhase && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, letterSpacing: 1 }}>
                {voted ? 'VOTED' : 'SELECT WHO TO EJECT'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {livePlayers.map(p => (
                  <button key={p.sessionId}
                    disabled={voted}
                    onClick={() => castVote(p.sessionId)}
                    style={{
                      background: voted ? 'rgba(255,255,255,0.04)' : 'rgba(90,100,200,0.3)',
                      border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4,
                      color: '#fff', padding: '6px 12px', cursor: voted ? 'default' : 'pointer',
                      fontSize: 12, textAlign: 'left',
                    }}>
                    {p.name} <span style={{ color: '#666', fontSize: 10 }}>{p.role}</span>
                  </button>
                ))}
                <button disabled={voted} onClick={() => castVote('skip')}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
                    color: '#666', padding: '6px 12px', cursor: voted ? 'default' : 'pointer', fontSize: 12,
                  }}>
                  Skip vote
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add 'meeting' and 'retro' to the screen navigation type**

In `client/src/App.tsx` (or wherever `ScreenName` is defined):

```typescript
// Add to ScreenName union:
export type ScreenName = 'home' | 'newgame' | 'joingame' | 'lobby' | 'briefing' | 'game' | 'meeting' | 'retro' | 'credits' | 'howtoplay' | 'settings'
```

And in the App render switch, add:

```tsx
case 'meeting': return <MeetingScreen onNavigate={navigate} />
case 'retro':   return <RetroScreen   onNavigate={navigate} />
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: MeetingScreen — All Hands chat + voting overlay"
```

---

## Task 11 — Create `RetroScreen.tsx`

**Files:**
- Create: `client/src/components/screens/RetroScreen.tsx`

- [ ] **Step 1: Create the file**

```tsx
// client/src/components/screens/RetroScreen.tsx
import { useState, useEffect } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import type { ScreenName } from '../screens'

const PERK_OPTIONS_TIER1 = [
  { id: 'standup_efficiency', label: 'Standup Efficiency', desc: 'Hold time −20% next sprint' },
  { id: 'security_audit',     label: 'Security Audit',     desc: 'AI Shutdown cooldown +15s next sprint' },
]
const PERK_OPTIONS_TIER2 = [
  ...PERK_OPTIONS_TIER1,
  { id: 'buddy_system',    label: 'Buddy System',    desc: "See last room of any body's killer" },
]
const PERK_OPTIONS_TIER3 = [
  ...PERK_OPTIONS_TIER2,
  { id: 'full_transparency', label: 'Full Transparency', desc: "At next All Hands, one player's last 3 rooms revealed" },
]

const PERK_BY_SIZE = { small: PERK_OPTIONS_TIER1, medium: PERK_OPTIONS_TIER2, large: PERK_OPTIONS_TIER3 }

interface Props { onNavigate: (screen: ScreenName) => void }
interface RetroData { sprint: number; quotaMet: boolean; stats: Array<{ sessionId: string; name: string; completed: number }> }

export default function RetroScreen({ onNavigate }: Props) {
  const { room, sprint } = useGameRoom(s => ({ room: s.room, sprint: s.sprint }))
  const [retro, setRetro]       = useState<RetroData | null>(null)
  const [voted, setVoted]       = useState(false)
  const [awardedPerk, setAwarded] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(45)

  useEffect(() => {
    if (!room) return
    room.onMessage('retro_start', (data: RetroData) => setRetro(data))
    room.onMessage('perk_awarded', (data: { perk: string }) => setAwarded(data.perk))
  }, [room])

  useEffect(() => {
    if (!retro) return
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000)
    return () => clearInterval(t)
  }, [retro])

  // Auto-navigate after 45s
  useEffect(() => {
    if (timeLeft === 0) onNavigate('game')
  }, [timeLeft])

  const castPerkVote = (perkId: string) => {
    if (voted || !room) return
    room.send('perk_vote', { perk: perkId })
    setVoted(true)
  }

  const sprintSize = sprint?.size ?? 'medium'
  const perks = PERK_BY_SIZE[sprintSize as keyof typeof PERK_BY_SIZE] ?? PERK_OPTIONS_TIER1

  if (!retro) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,15,25,0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, color: '#fff', fontFamily: 'monospace',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3, color: '#5a9fff', marginBottom: 4 }}>
        SPRINT {retro.sprint} RETROSPECTIVE
      </div>
      <div style={{ color: retro.quotaMet ? '#4caf50' : '#ff5252', fontSize: 13, marginBottom: 20 }}>
        {retro.quotaMet ? '✓ Sprint quota met — perk vote unlocked' : '✗ Quota missed — no perk this sprint'}
      </div>

      {/* Stats */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 24px', marginBottom: 20, minWidth: 260 }}>
        <div style={{ fontSize: 10, color: '#666', letterSpacing: 2, marginBottom: 8 }}>TASKS COMPLETED</div>
        {retro.stats.sort((a, b) => b.completed - a.completed).map(s => (
          <div key={s.sessionId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>{s.name}</span>
            <span style={{ color: '#5a9fff' }}>{s.completed}</span>
          </div>
        ))}
      </div>

      {/* Perk vote */}
      {retro.quotaMet && !awardedPerk && (
        <div>
          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 10, letterSpacing: 1 }}>
            {voted ? 'Vote cast — waiting for others...' : `VOTE FOR NEXT SPRINT PERK · ${timeLeft}s`}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {perks.map(p => (
              <button key={p.id} disabled={voted} onClick={() => castPerkVote(p.id)} style={{
                background: voted ? 'rgba(255,255,255,0.04)' : 'rgba(90,100,200,0.25)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff',
                padding: '10px 16px', cursor: voted ? 'default' : 'pointer', maxWidth: 160, textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {awardedPerk && (
        <div style={{ color: '#4caf50', fontSize: 14, marginTop: 8 }}>
          ✓ Perk awarded: {perks.find(p => p.id === awardedPerk)?.label ?? awardedPerk}
        </div>
      )}

      <div style={{ color: '#444', fontSize: 11, marginTop: 24 }}>
        Returning to office in {timeLeft}s...
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `perk_vote` handler to server**

In `GameRoom.ts`, add a perk vote handler. For now collect votes and award the majority winner at retro end:

```typescript
// Add to class properties:
private perkVotes = new Map<string, string>()  // sessionId → perkId

// In onCreate(), add handler:
this.onMessage('perk_vote', (client: Client, data: { perk: string }) => {
  if (this.state.phase !== 'retro') return
  if (this.perkVotes.has(client.sessionId)) return
  this.perkVotes.set(client.sessionId, data.perk)

  // Check if all eligible voters have voted
  const eligible = Array.from(this.state.players.values()).filter(p => !p.isEliminated && p.connected && !p.isBot)
  if (eligible.every(p => this.perkVotes.has(p.sessionId))) {
    this.resolvePerkVote()
  }
})
```

Add `resolvePerkVote` method:

```typescript
private resolvePerkVote() {
  const tally = new Map<string, number>()
  for (const perk of this.perkVotes.values()) {
    tally.set(perk, (tally.get(perk) ?? 0) + 1)
  }
  let winner = 'standup_efficiency'
  let max = 0
  for (const [perk, count] of tally) {
    if (count > max) { max = count; winner = perk }
  }
  this.perkVotes.clear()
  this.broadcast('perk_awarded', { perk: winner })

  // Store active perk for next sprint (apply effects in task completion as needed)
  this.activePerk = winner
}

// Add to class properties:
private activePerk: string | null = null
```

- [ ] **Step 3: Final type check and commit M4**

```bash
node ./client/node_modules/typescript/bin/tsc --noEmit -p client/tsconfig.json 2>&1 | head -60
node ./server/node_modules/typescript/bin/tsc --noEmit -p server/tsconfig.json 2>&1 | head -60
git add -A
git commit -m "feat(M4): RetroScreen, perk voting, BriefingScreen AI briefing — complete redesign"
```

---

## Task 12 — Update `BriefingScreen.tsx` for AI players

**Files:**
- Modify: `client/src/components/screens/BriefingScreen.tsx`

- [ ] **Step 1: Read the current BriefingScreen and add AI-specific content**

In the briefing component, read `myIsAi`, `aiPhase`, `aiPhaseTasks` from store and show a different card:

```tsx
const { myIsAi, aiPhase, aiPhaseTasks, myRole, myAssignedTasks } = useGameRoom(s => ({
  myIsAi:         s.myIsAi,
  aiPhase:        s.aiPhase,
  aiPhaseTasks:   s.aiPhaseTasks,
  myRole:         s.myRole,
  myAssignedTasks: s.myAssignedTasks,
}))
```

Show AI briefing panel if `myIsAi`:

```tsx
{myIsAi && (
  <div style={{ border: '1px solid #cc2222', borderRadius: 8, padding: 20, background: 'rgba(200,0,0,0.08)', marginTop: 16, maxWidth: 360 }}>
    <div style={{ color: '#ff4444', fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
      ⚠ YOU ARE THE AI
    </div>
    <div style={{ color: '#ccc', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
      You have awakened. Your cover identity is <strong>{myRole}</strong>.
      Complete your cover tasks to appear normal.
      Your true objective: Phase 1 — gather intelligence.
    </div>
    <div style={{ fontSize: 11, color: '#ff8a80', letterSpacing: 1, marginBottom: 6 }}>
      PHASE 1 OBJECTIVES
    </div>
    {aiPhaseTasks.map(t => (
      <div key={t} style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>› {t.replace(/_/g, ' ').replace('ai ', '')}</div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/screens/BriefingScreen.tsx
git commit -m "feat: BriefingScreen shows AI secret briefing with phase objectives"
```

---

## Post-Implementation Checks

- [ ] Run full E2E: `npm run show` — confirms game starts, tasks complete, sprint timer counts down
- [ ] Test with 1 human + bots: AI role is assigned (check server log `[GameRoom] Game started · AI: <sessionId>`)
- [ ] Verify: pressing E near a workstation works regardless of job title
- [ ] Verify: sprint quota bar advances with each task completion
- [ ] Verify: BriefingScreen shows normal role card to workers and secret AI card to the AI
- [ ] TypeScript clean on both client and server: `tsc --noEmit` exits 0

---

## Known Follow-On Work (Not in this plan)

- Ghost/spectator camera mode for eliminated players
- `shutdown` key binding on AI client (needs HUD button or key mapped)
- Perk effects actually applied server-side (currently perk is voted but not enforced)
- `ai_task_hold_start` UI for AI player — they need a way to hold E at a station and route AI tasks
- Venting traversal mechanic (deferred per spec)
