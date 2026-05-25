// ── Factions & Roles ─────────────────────────────────────────────────────────

export type Faction = 'workforce' | 'opposition'

export type WorkforceRole =
  | 'it' | 'hr' | 'devops' | 'finance' | 'marketing' | 'admin' | 'management'

export type OppositionRole =
  | 'hacker' | 'social_engineer' | 'spy' | 'saboteur' | 'insider'

export type PlayerRole = WorkforceRole | OppositionRole

// ── Room options (sent by host when creating a room) ─────────────────────────

export interface RoomOptions {
  roomName:          string
  mapSize:           'small' | 'medium' | 'large'
  maxPlayers:        number
  factionAssignment: 'random' | 'manual' | 'balanced'
  botCount:          number
}

// ── Client → Server messages ──────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'move';        x: number; z: number; facing?: number }
  | { type: 'interact';    targetId: string }
  | { type: 'use_ability' }
  | { type: 'chat';        text: string }
  | { type: 'vote';        suspectId: string }

// ── Server → Client messages ──────────────────────────────────────────────────

export type PingPosition = { sessionId: string; x: number; z: number }

export type EffectUpdate = {
  hotfixActive:    boolean
  speedBoostActive: boolean
  frozenActive:    boolean
  marketingActive: boolean
  lockdownActive:  boolean
  trapPlanted:     boolean
}

export type ServerMessage =
  | { type: 'role_assigned'; role: PlayerRole; faction: Faction }
  | { type: 'incident';      message: string; severity: 'info' | 'warn' | 'danger'; time: string }
  | { type: 'game_start';    seed: string; mapSize: RoomOptions['mapSize'] }
  | { type: 'game_end';      winner: Faction; reason: string }
  | { type: 'vote_result';   ejectedId: string | null; votes: Record<string, string> }
  | { type: 'ability_used';  sessionId: string; role: string }
  | { type: 'effect_update' } & EffectUpdate
  | { type: 'hr_ping';       positions: PingPosition[]; duration: number }
  | { type: 'spy_sweep';     positions: PingPosition[]; duration: number }

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

// ── Ability system ────────────────────────────────────────────────────────────

export const ABILITY_COOLDOWNS_MS: Record<PlayerRole, number> = {
  it:              60_000,
  hr:              30_000,
  devops:          45_000,
  finance:         50_000,
  marketing:       40_000,
  admin:           60_000,
  management:      50_000,
  hacker:          60_000,
  social_engineer: 45_000,
  spy:             35_000,
  saboteur:        50_000,
  insider:         9_999_999,  // once per match
}

export const ABILITY_NAMES: Record<PlayerRole, string> = {
  it:              'Emergency Patch',
  hr:              'Background Check',
  devops:          'Deploy Hotfix',
  finance:         'Budget Freeze',
  marketing:       'PR Blitz',
  admin:           'Access Lockdown',
  management:      'Sprint Initiative',
  hacker:          'Zero-Day Exploit',
  social_engineer: 'Disguise',
  spy:             'Surveillance Sweep',
  saboteur:        'Plant Trap',
  insider:         'Badge Access',
}

export const ABILITY_DESCS: Record<PlayerRole, string> = {
  it:              '+20% terminal instantly',
  hr:              'Reveal enemy positions (5s)',
  devops:          '2× repair speed (8s)',
  finance:         'Enemy cooldowns ×2 (10s)',
  marketing:       'Halve enemy hack rate (8s)',
  admin:           'Block server room entrance (12s)',
  management:      '+30% team speed (10s)',
  hacker:          '−20% terminal instantly',
  social_engineer: 'Appear as Workforce (15s)',
  spy:             'Reveal enemy positions (3s)',
  saboteur:        'Plant trap at terminal',
  insider:         'Bypass lockdown + reveal (once)',
}
