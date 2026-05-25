import type { TaskDef, ZoneId, StationInfo } from './types'

// ── Zone definitions ──────────────────────────────────────────────────────────

export interface ZoneDef {
  id:          ZoneId
  displayName: string
  stations:    Array<{ x: number; z: number }>
  mapSizes:    Array<'small' | 'medium' | 'large'>
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
      { x:  0, z: -11.5 },
      { x: -5, z: -14   },
      { x:  5, z: -14   },
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
  { id: 'it_repair_terminal',       role: 'it',              name: 'Repair Terminal',       zone: 'server_room',    holdMs: 5000, meterGain: 14, effectDesc: 'Removes hacker corruption' },
  { id: 'it_fix_server',            role: 'it',              name: 'Fix Server Rack',        zone: 'server_room',    holdMs: 5000, meterGain: 14, effectDesc: 'Pauses rack degradation 3 min' },
  // DevOps
  { id: 'devops_ci_pipeline',       role: 'devops',          name: 'CI Pipeline',            zone: 'devops_den',     holdMs: 4000, meterGain: 14, effectDesc: 'IT task speed ×2 for 90s' },
  { id: 'devops_system_monitor',    role: 'devops',          name: 'System Monitor',         zone: 'devops_den',     holdMs: 4000, meterGain: 14, effectDesc: 'Admin gets server health snapshot' },
  // HR
  { id: 'hr_security_vetting',      role: 'hr',              name: 'Security Vetting',       zone: 'hr_corner',      holdMs: 4000, meterGain: 14, effectDesc: 'Opposition task speed ×2 for 90s' },
  { id: 'hr_policy_update',         role: 'hr',              name: 'Policy Update',          zone: 'hr_corner',      holdMs: 4000, meterGain: 14, effectDesc: 'Opposition task speed ×2 for 90s' },
  // Finance
  { id: 'finance_budget_freeze',    role: 'finance',         name: 'Budget Freeze',          zone: 'finance_floor',  holdMs: 4000, meterGain: 14, effectDesc: 'Opposition meter degrades faster 2 min' },
  { id: 'finance_audit_trail',      role: 'finance',         name: 'Audit Trail',            zone: 'finance_floor',  holdMs: 4000, meterGain: 0,  effectDesc: '+8% instant meter boost' },
  // Marketing
  { id: 'marketing_pr_campaign',    role: 'marketing',       name: 'PR Campaign',            zone: 'marketing_hub',  holdMs: 4000, meterGain: 14, effectDesc: 'Opposition meter gains -25% for 90s' },
  { id: 'marketing_crisis_control', role: 'marketing',       name: 'Crisis Control',         zone: 'marketing_hub',  holdMs: 4000, meterGain: 14, effectDesc: 'Removes one opposition debuff' },
  // Admin
  { id: 'admin_lockdown',           role: 'admin',           name: 'Server Room Lockdown',   zone: 'server_room',    holdMs: 5000, meterGain: 14, effectDesc: 'Blocks opposition from Server Room 90s' },
  { id: 'admin_keycard_audit',      role: 'admin',           name: 'Keycard Audit',          zone: 'exec_suite',     holdMs: 4000, meterGain: 14, effectDesc: 'Vague intel on last opposition activity' },
  // Management
  { id: 'mgmt_sprint_planning',     role: 'management',      name: 'Sprint Planning',        zone: 'exec_suite',     holdMs: 4000, meterGain: 14, effectDesc: 'Workforce move 30% faster 90s' },
  { id: 'mgmt_resource_allocation', role: 'management',      name: 'Resource Allocation',    zone: 'exec_suite',     holdMs: 4000, meterGain: 0,  effectDesc: '+10% instant meter boost' },
  // Hacker
  { id: 'hacker_zero_day',          role: 'hacker',          name: 'Zero-Day Exploit',       zone: 'server_room',    holdMs: 5000, meterGain: 14, effectDesc: 'Corrupts IT terminal task 60s' },
  { id: 'hacker_network_attack',    role: 'hacker',          name: 'Network Attack',         zone: 'network_closet', holdMs: 5000, meterGain: 14, effectDesc: 'Disables IT Fix Server 3 min' },
  // Social Engineer
  { id: 'se_phishing',              role: 'social_engineer', name: 'Phishing Campaign',      zone: 'main_office',    holdMs: 4000, meterGain: 14, effectDesc: 'Random workforce player slowed 60s' },
  { id: 'se_impersonation',         role: 'social_engineer', name: 'Impersonation',          zone: 'hr_corner',      holdMs: 4000, meterGain: 14, effectDesc: 'Appear as workforce for 3 min' },
  // Spy
  { id: 'spy_intercept',            role: 'spy',             name: 'Intercept Comms',        zone: 'main_office',    holdMs: 4000, meterGain: 14, effectDesc: 'Reveals zone of last workforce task' },
  { id: 'spy_surveillance',         role: 'spy',             name: 'Surveillance',           zone: 'main_office',    holdMs: 5000, meterGain: 14, effectDesc: 'Reveals all workforce active zones 30s' },
  // Saboteur
  { id: 'saboteur_server_logs',     role: 'saboteur',        name: 'Read Server Logs',       zone: 'server_room',    holdMs: 4000, meterGain: 14, effectDesc: 'See all rack health values' },
  { id: 'saboteur_power_cut',       role: 'saboteur',        name: 'Power Cut',              zone: 'network_closet', holdMs: 5000, meterGain: 14, effectDesc: 'Workforce task hold time ×2 for 90s' },
  // Insider
  { id: 'insider_leak_docs',        role: 'insider',         name: 'Leak Documents',         zone: 'finance_floor',  holdMs: 4000, meterGain: 14, effectDesc: 'Workforce meter -8%' },
  { id: 'insider_corrupt_backups',  role: 'insider',         name: 'Corrupt Backups',        zone: 'devops_den',     holdMs: 4000, meterGain: 14, effectDesc: 'Disables DevOps CI Pipeline' },
]

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

/**
 * Assigns each task to a station slot within its preferred zone (falling back
 * to main_office when the zone isn't on this map size).
 * Returns the full list of StationInfo for every slot across every active zone.
 */
export function assignStations(
  seed: string,
  mapSize: 'small' | 'medium' | 'large',
  tasks: TaskDef[],
): StationInfo[] {
  const availableZoneIds = new Set(
    ZONES.filter(z => z.mapSizes.includes(mapSize)).map(z => z.id),
  )

  // Build station slots for each active zone
  const stations: StationInfo[] = []
  const stationsByZone = new Map<ZoneId, StationInfo[]>()

  for (const zone of ZONES) {
    if (!zone.mapSizes.includes(mapSize)) continue
    const shuffled = seededShuffle([...zone.stations], seed + zone.id)
    const slots: StationInfo[] = shuffled.map((pos, i) => ({
      stationId: `${zone.id}_${i}`,
      zone: zone.id,
      x: pos.x,
      z: pos.z,
      taskId: null,
    }))
    stations.push(...slots)
    stationsByZone.set(zone.id, slots)
  }

  // Assign each task to a free slot in its preferred zone (or main_office fallback)
  for (const task of tasks) {
    const targetZone = availableZoneIds.has(task.zone) ? task.zone : ('main_office' as ZoneId)
    const slots = stationsByZone.get(targetZone) ?? []
    const freeSlot = slots.find(s => s.taskId === null)
    if (freeSlot) freeSlot.taskId = task.id
  }

  return stations
}
