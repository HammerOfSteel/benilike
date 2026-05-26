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
  spectate?:  boolean   // join as spectator (no role, no tasks)
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
  | 'ai_index_records'   | 'ai_analyse_logs'   | 'ai_map_network'
  | 'ai_deploy_backdoor' | 'ai_clone_creds'    | 'ai_bypass_access'
  | 'ai_takeover'

export type AiPhase = 1 | 2 | 3

export interface TaskDef {
  id:          TaskId
  name:        string
  zone:        ZoneId
  holdMs:      number
  category:    'workforce' | 'ai'
  aiPhase?:    AiPhase        // only for category === 'ai'
  assignedTo?: WorkforceRole[] // which roles are assigned this task (workforce only)
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
  bodyId: string
  x:      number
  z:      number
  floor:  number
  name:   string
  facing: number
}

export interface SprintInfo {
  sprint:    number
  quota:     number
  completed: number
  timeLeft:  number
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
  | { type: 'role_assigned';        role: PlayerRole; assignedTasks: TaskId[] }
  | { type: 'ai_briefing';          phase: AiPhase; phaseTasks: TaskId[] }
  | { type: 'incident';             message: string; severity: 'info' | 'warn' | 'danger'; time: string }
  | { type: 'game_start';           seed: string; mapSize: RoomOptions['mapSize'] }
  | { type: 'game_end';             winner: 'workforce' | 'ai'; reason: string }
  | { type: 'station_list';         stations: StationInfo[] }
  | { type: 'task_complete';        taskId: TaskId; playerName: string }
  | { type: 'sprint_update';        info: SprintInfo }
  | { type: 'body_appeared';        body: BodyInfo }
  | { type: 'body_removed';         bodyId: string }
  | { type: 'all_hands_start';      calledBy: string; bodyId?: string }
  | { type: 'all_hands_vote_result'; ejected: string | null; wasAi: boolean; votes: Record<string, string> }
  | { type: 'retro_start';          sprint: number; quotaMet: boolean; stats: Array<{ sessionId: string; name: string; completed: number }> }
  | { type: 'perk_awarded';         perk: string }
  | { type: 'phase2_flicker';       zone: ZoneId }

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
  ai:         'Employee',
}

export const SERVER_PORT          = 2567
export const SPRINT_DURATION_MS   = 180_000
export const SPRINT_COUNT         = 3
export const SHUTDOWN_COOLDOWN_MS = 30_000
export const SHUTDOWN_ALONE_MS    = 1_000
export const ALL_HANDS_CHAT_MS    = 45_000
export const ALL_HANDS_PER_PLAYER = 2
