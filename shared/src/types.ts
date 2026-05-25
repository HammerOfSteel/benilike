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
  | 'main_office' | 'server_room' | 'network_closet'
  | 'hr_corner' | 'finance_floor' | 'devops_den'
  | 'marketing_hub' | 'exec_suite' | 'opposition_den'

export type TaskId =
  | 'it_repair_terminal' | 'it_fix_server'
  | 'devops_ci_pipeline' | 'devops_system_monitor'
  | 'hr_security_vetting' | 'hr_policy_update'
  | 'finance_budget_freeze' | 'finance_audit_trail'
  | 'marketing_pr_campaign' | 'marketing_crisis_control'
  | 'admin_lockdown' | 'admin_keycard_audit'
  | 'mgmt_sprint_planning' | 'mgmt_resource_allocation'
  | 'hacker_zero_day' | 'hacker_network_attack'
  | 'se_phishing' | 'se_impersonation'
  | 'spy_intercept' | 'spy_surveillance'
  | 'saboteur_server_logs' | 'saboteur_power_cut'
  | 'insider_leak_docs' | 'insider_corrupt_backups'

export interface TaskDef {
  id:          TaskId
  role:        PlayerRole
  name:        string
  zone:        ZoneId
  holdMs:      number
  meterGain:   number
  effectDesc:  string
}

export interface StationInfo {
  stationId:   string
  zone:        ZoneId
  x:           number
  z:           number
  floor:       number
  taskId:      TaskId | null
}

// ── Client → Server messages ──────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'move';             x: number; z: number; floor?: number; facing?: number }
  | { type: 'task_hold_start';  stationId: string }
  | { type: 'task_hold_cancel' }
  | { type: 'badge_renewal_done' }
  | { type: 'chat';             text: string }

// ── Server → Client messages ──────────────────────────────────────────────────

export type EffectUpdate = {
  workforceSpeedActive:  boolean
  lockdownActive:        boolean
  workforceHoldSlow:     boolean
  oppositionHoldSlow:    boolean
  hackerCorruption:      boolean
  ciPipelineActive:      boolean
  badgeRenewalRequired:  boolean
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

export const DEFAULT_REPUTATION            = 100
export const SERVER_PORT                   = 2567
export const TASK_METER_GAIN               = 14
export const METER_DEGRADE_INTERVAL_MS     = 45_000
export const RACK_DEGRADE_INTERVAL_MS      = 30_000
