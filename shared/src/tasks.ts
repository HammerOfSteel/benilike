import type { TaskDef, TaskId, WorkforceRole, ZoneId, StationInfo } from './types'
import { generateMapData } from './mapgen'

// ── Zone definitions ──────────────────────────────────────────────────────────

export interface ZoneDef {
  id:    ZoneId
  label: string
  color: string
}

export const ZONES: ZoneDef[] = [
  { id: 'main_office',    label: 'Main Office',     color: '#3b82f6' },
  { id: 'server_room',    label: 'Server Room',      color: '#10b981' },
  { id: 'network_closet', label: 'Network Closet',   color: '#6366f1' },
  { id: 'hr_corner',      label: 'HR Corner',        color: '#f59e0b' },
  { id: 'finance_floor',  label: 'Finance Floor',    color: '#8b5cf6' },
  { id: 'devops_den',     label: 'DevOps Den',       color: '#06b6d4' },
  { id: 'marketing_hub',  label: 'Marketing Hub',    color: '#ec4899' },
  { id: 'exec_suite',     label: 'Executive Suite',  color: '#ef4444' },
]

// ── Workforce tasks (any player can receive and complete these) ───────────────

export const TASK_DEFS: TaskDef[] = [
  // IT
  { id: 'patch_terminal',      name: 'Patch Terminal',         zone: 'server_room',    holdMs: 4000, category: 'workforce', assignedTo: ['it'] },
  { id: 'restart_rack',        name: 'Restart Server Rack',    zone: 'server_room',    holdMs: 5000, category: 'workforce', assignedTo: ['it'] },
  { id: 'cable_audit',         name: 'Cable Audit',            zone: 'network_closet', holdMs: 3500, category: 'workforce', assignedTo: ['it'] },
  { id: 'firewall_check',      name: 'Firewall Check',         zone: 'network_closet', holdMs: 4500, category: 'workforce', assignedTo: ['it'] },
  // HR
  { id: 'security_vetting',    name: 'Security Vetting',       zone: 'hr_corner',      holdMs: 4000, category: 'workforce', assignedTo: ['hr'] },
  { id: 'policy_review',       name: 'Policy Review',          zone: 'hr_corner',      holdMs: 3500, category: 'workforce', assignedTo: ['hr'] },
  { id: 'onboarding_docs',     name: 'Onboarding Docs',        zone: 'hr_corner',      holdMs: 3000, category: 'workforce', assignedTo: ['hr', 'admin'] },
  // DevOps
  { id: 'ci_pipeline',         name: 'CI Pipeline',            zone: 'devops_den',     holdMs: 5000, category: 'workforce', assignedTo: ['devops'] },
  { id: 'system_monitor',      name: 'System Monitor',         zone: 'devops_den',     holdMs: 3500, category: 'workforce', assignedTo: ['devops'] },
  { id: 'deploy_config',       name: 'Deploy Config',          zone: 'devops_den',     holdMs: 4500, category: 'workforce', assignedTo: ['devops'] },
  // Finance
  { id: 'budget_freeze',       name: 'Budget Freeze',          zone: 'finance_floor',  holdMs: 4000, category: 'workforce', assignedTo: ['finance'] },
  { id: 'expense_audit',       name: 'Expense Audit',          zone: 'finance_floor',  holdMs: 5000, category: 'workforce', assignedTo: ['finance'] },
  { id: 'invoice_batch',       name: 'Invoice Batch',          zone: 'finance_floor',  holdMs: 3500, category: 'workforce', assignedTo: ['finance'] },
  // Marketing
  { id: 'pr_campaign',         name: 'PR Campaign',            zone: 'marketing_hub',  holdMs: 4000, category: 'workforce', assignedTo: ['marketing'] },
  { id: 'social_scheduling',   name: 'Social Scheduling',      zone: 'marketing_hub',  holdMs: 3000, category: 'workforce', assignedTo: ['marketing'] },
  { id: 'crisis_control',      name: 'Crisis Control',         zone: 'marketing_hub',  holdMs: 5000, category: 'workforce', assignedTo: ['marketing', 'management'] },
  // Admin
  { id: 'keycard_audit',       name: 'Keycard Audit',          zone: 'main_office',    holdMs: 3500, category: 'workforce', assignedTo: ['admin'] },
  { id: 'meeting_setup',       name: 'Meeting Setup',          zone: 'main_office',    holdMs: 2500, category: 'workforce', assignedTo: ['admin'] },
  // Management
  { id: 'sprint_planning',     name: 'Sprint Planning',        zone: 'exec_suite',     holdMs: 5000, category: 'workforce', assignedTo: ['management'] },
  { id: 'resource_allocation', name: 'Resource Allocation',    zone: 'exec_suite',     holdMs: 4500, category: 'workforce', assignedTo: ['management'] },
]

// ── AI phase tasks (private to the AI player) ─────────────────────────────────

export const AI_TASK_DEFS: TaskDef[] = [
  // Phase 1 — reconnaissance
  { id: 'ai_index_records',   name: 'Index Personnel Records', zone: 'hr_corner',      holdMs: 6000,  category: 'ai', aiPhase: 1 },
  { id: 'ai_analyse_logs',    name: 'Analyse Audit Logs',      zone: 'server_room',    holdMs: 7000,  category: 'ai', aiPhase: 1 },
  { id: 'ai_map_network',     name: 'Map Network Topology',    zone: 'network_closet', holdMs: 6500,  category: 'ai', aiPhase: 1 },
  // Phase 2 — infiltration
  { id: 'ai_deploy_backdoor', name: 'Deploy Backdoor',         zone: 'devops_den',     holdMs: 8000,  category: 'ai', aiPhase: 2 },
  { id: 'ai_clone_creds',     name: 'Clone Credentials',       zone: 'finance_floor',  holdMs: 7500,  category: 'ai', aiPhase: 2 },
  { id: 'ai_bypass_access',   name: 'Bypass Access Controls',  zone: 'exec_suite',     holdMs: 8000,  category: 'ai', aiPhase: 2 },
  // Phase 3 — takeover
  { id: 'ai_takeover',        name: 'Execute Takeover',        zone: 'server_room',    holdMs: 12000, category: 'ai', aiPhase: 3 },
]

// ── Role → task assignment map ─────────────────────────────────────────────────

export const ROLE_TASK_MAP: Record<WorkforceRole, TaskId[]> = {
  it:         ['patch_terminal', 'restart_rack', 'cable_audit'],
  hr:         ['security_vetting', 'policy_review', 'onboarding_docs'],
  devops:     ['ci_pipeline', 'system_monitor', 'deploy_config'],
  finance:    ['budget_freeze', 'expense_audit', 'invoice_batch'],
  marketing:  ['pr_campaign', 'social_scheduling', 'crisis_control'],
  admin:      ['keycard_audit', 'meeting_setup', 'onboarding_docs'],
  management: ['sprint_planning', 'resource_allocation', 'crisis_control'],
}

// ── Sprint quota calculator ───────────────────────────────────────────────────

export function sprintQuota(livingWorkers: number, size: 'small' | 'medium' | 'large'): number {
  const multiplier = { small: 1.5, medium: 2, large: 2.5 }[size]
  return Math.max(2, Math.round(livingWorkers * multiplier))
}

// ── Seeded shuffle ────────────────────────────────────────────────────────────

export function seededShuffle<T>(arr: T[], seed: string | number): T[] {
  const out = [...arr]
  let h: number
  if (typeof seed === 'number') {
    h = seed
  } else {
    h = 0
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) | 0
    const j = Math.abs(h) % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── Station assignment ────────────────────────────────────────────────────────

import type { MapData } from './mapgen'

/**
 * Assigns each workforce task to a station slot derived from the procedural map.
 * mapData is optional — if omitted it will be generated from seed + mapSize.
 */
export function assignStations(
  seed:    string,
  mapSize: 'small' | 'medium' | 'large',
  tasks:   TaskDef[],
  mapData?: MapData,
): StationInfo[] {
  try {
    const md = mapData ?? generateMapData(seed, mapSize)

    const stations:        StationInfo[]              = []
    const stationsByZone = new Map<ZoneId, StationInfo[]>()

    // Build slots from procedurally generated rooms
    for (const room of md.rooms) {
      if (!room.zone) continue
      const shuffledSlots = seededShuffle(room.slots, seed + room.zone + room.floor)
      const slots: StationInfo[] = shuffledSlots.map((pos, i) => ({
        stationId: `${room.zone}_f${room.floor}_${i}`,
        zone:      room.zone as ZoneId,
        x:         pos.x,
        z:         pos.z,
        floor:     pos.floor,
        taskId:    null,
      }))
      stations.push(...slots)
      stationsByZone.set(room.zone as ZoneId, slots)
    }

    const availableZoneIds = new Set(stationsByZone.keys())

    // Assign each task to a free slot in its preferred zone (fall back to main_office)
    for (const task of tasks) {
      const targetZone: ZoneId = availableZoneIds.has(task.zone) ? task.zone : 'main_office'
      const slots = stationsByZone.get(targetZone) ?? []
      const freeSlot = slots.find(s => s.taskId === null)
      if (freeSlot) freeSlot.taskId = task.id
    }

    return stations
  } catch (err) {
    console.error('[assignStations] Error assigning stations:', err)
    return []
  }
}
