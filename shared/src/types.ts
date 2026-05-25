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
  | { type: 'move';     x: number; z: number; facing?: number }
  | { type: 'interact'; targetId: string }
  | { type: 'use_ability' }
  | { type: 'chat';     text: string }
  | { type: 'vote';     suspectId: string }

// ── Server → Client messages ──────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'role_assigned'; role: PlayerRole; faction: Faction }
  | { type: 'incident';      message: string; severity: 'info' | 'warn' | 'danger'; time: string }
  | { type: 'game_start';    seed: string; mapSize: RoomOptions['mapSize'] }
  | { type: 'game_end';      winner: Faction; reason: string }
  | { type: 'vote_result';   ejectedId: string | null; votes: Record<string, string> }

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
