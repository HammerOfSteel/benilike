/**
 * Procedural map generator — rot.js (Digger algorithm)
 * Same seed + mapSize always produces the same layout on server AND client.
 *
 * Grid coordinates:   cx (column, horizontal) → world X
 *                     cz (row,    vertical)   → world Z
 * World coords are centred: cell (gw/2, gh/2) ≈ world (0, 0).
 */
import * as ROT from 'rot-js'
import type { ZoneId } from './types'

// ── Scale constants ──────────────────────────────────────────────────────────
export const CELL_SIZE    = 2    // world units per grid cell
export const FLOOR_HEIGHT = 7    // world-Y between floors (wall height 3 + gap 4)
export const WALL_HEIGHT  = 3    // visual wall height
export const NUM_FLOORS   = 2    // all sizes use 2 floors for now

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedRoom {
  zone:   ZoneId | null
  floor:  number
  cx1: number; cx2: number  // cell-space left / right
  cz1: number; cz2: number  // cell-space top  / bottom
  wx1: number; wx2: number  // world-space left / right
  wz1: number; wz2: number  // world-space top  / bottom
  wcx: number; wcz: number  // world-space centre
  slots: Array<{ x: number; z: number; floor: number }>
}

export interface MapStaircase {
  id:        string
  fromFloor: number
  toFloor:   number
  tx1: number; tx2: number  // trigger zone world coords
  tz1: number; tz2: number
  arrX: number; arrZ: number
}

export interface MapData {
  grids:       Array<Map<string, 0 | 1>>  // per floor; key `${cx},${cz}`
  floors:      number
  gridW:       number
  gridH:       number
  cellSize:    number
  floorHeight: number
  rooms:       GeneratedRoom[]
  staircases:  MapStaircase[]
  startX:      number
  startZ:      number
}

// ── Grid-size per map-size ───────────────────────────────────────────────────
const GRID_W: Record<'small' | 'medium' | 'large', number> = {
  small:  30,   //  60 × 60 world units  ≈ Among Us Skeld scale
  medium: 42,   //  84 × 84 world units
  large:  56,   // 112 × 112 world units
}

// ── Zones expected on each floor ─────────────────────────────────────────────
const FLOOR_ZONES: ZoneId[][] = [
  ['main_office', 'server_room', 'network_closet', 'hr_corner'],      // floor 0
  ['devops_den',  'finance_floor', 'marketing_hub', 'exec_suite'],     // floor 1
]

// ── Zone position scorers (higher = better fit) ──────────────────────────────
// rot.js getCenter() returns [col, row] = [cx, cz]
type RotRoom = ReturnType<InstanceType<typeof ROT.Map.Digger>['getRooms']>[0]
const ZONE_SCORERS: Record<ZoneId, (r: RotRoom, gw: number, gh: number) => number> = {
  main_office:    (r, gw, gh) => { const [cx, cz] = r.getCenter(); return -(Math.abs(cx - gw/2) + Math.abs(cz - gh/2)) },
  server_room:    (r, _gw, _gh) => { const [, cz] = r.getCenter(); return cz },           // south (high cz)
  network_closet: (r, _gw)     => { const [cx] = r.getCenter(); return -cx },            // west  (low cx)
  hr_corner:      (r)         => { const [cx] = r.getCenter(); return cx },             // east  (high cx)
  devops_den:     (r)         => { const [cx, cz] = r.getCenter(); return -cx - cz },   // NW
  finance_floor:  (r)         => { const [cx, cz] = r.getCenter(); return  cx - cz },   // NE
  marketing_hub:  (r)         => { const [cx, cz] = r.getCenter(); return -cx + cz },   // SW
  exec_suite:     (r)         => { const [cx, cz] = r.getCenter(); return  cx + cz },   // SE
  opposition_den: (r, gw, gh) => { const [cx, cz] = r.getCenter(); return -(Math.abs(cx - gw/2) + Math.abs(cz - gh/2)) },
}

// ── Coordinate helpers (exported for client/server use) ──────────────────────

/** Cell → world (centred) */
export function c2w(cx: number, cz: number, gw: number, gh: number): [number, number] {
  return [(cx - gw / 2) * CELL_SIZE, (cz - gh / 2) * CELL_SIZE]
}

/** World → nearest cell */
export function w2c(wx: number, wz: number, gw: number, gh: number): [number, number] {
  return [Math.round(wx / CELL_SIZE + gw / 2), Math.round(wz / CELL_SIZE + gh / 2)]
}

/**
 * Radius-aware walkability check.
 * Returns true if the player's bounding box corners all land on floor cells.
 */
export function isWalkable(
  wx: number, wz: number, floor: number,
  grids: MapData['grids'], gw: number, gh: number,
): boolean {
  const grid = grids[floor]
  if (!grid) return false
  const R = 0.3  // player collision radius
  for (const [px, pz] of [[wx - R, wz - R], [wx + R, wz - R], [wx - R, wz + R], [wx + R, wz + R]] as [number, number][]) {
    const [cx, cz] = w2c(px, pz, gw, gh)
    if (grid.get(`${cx},${cz}`) !== 0) return false
  }
  return true
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateMapData(seed: string, mapSize: 'small' | 'medium' | 'large'): MapData {
  // String → deterministic integer seed
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0
  s = Math.abs(s) || 1

  const gw = GRID_W[mapSize]
  const gh = gw

  const grids:      Array<Map<string, 0 | 1>> = []
  const allRooms:   GeneratedRoom[]            = []
  const staircases: MapStaircase[]             = []

  // Staircase fixed cell positions (relative to grid size) – consistent across floors
  const stairCells = [
    { cx: Math.round(gw * 0.38), cz: Math.round(gh * 0.38) },
    { cx: Math.round(gw * 0.62), cz: Math.round(gh * 0.38) },
  ]

  for (let fl = 0; fl < NUM_FLOORS; fl++) {
    // Per-floor seed offset keeps floors independent
    ROT.RNG.setSeed(s + fl * 77_777)

    const grid = new Map<string, 0 | 1>()
    grids.push(grid)

    const roomW = mapSize === 'small' ? [6, 11] : mapSize === 'medium' ? [7, 13] : [8, 15]
    const roomH = mapSize === 'small' ? [5, 10] : mapSize === 'medium' ? [6, 12] : [7, 14]

    const digger = new ROT.Map.Digger(gw, gh, {
      roomWidth:      roomW as [number, number],
      roomHeight:     roomH as [number, number],
      dugPercentage:  0.30,
      corridorLength: [1, 6],
      timeLimit:      1200,
    })

    digger.create((x: number, y: number, type: number) => {
      grid.set(`${x},${y}`, type as 0 | 1)
    })

    // ── Carve staircase areas (3×3 cleared cells) + connect to grid centre ──
    const midX = Math.floor(gw / 2)
    const midZ = Math.floor(gh / 2)
    for (const sc of stairCells) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          grid.set(`${sc.cx + dx},${sc.cz + dz}`, 0)
      // Horizontal + vertical corridor to grid centre
      const x0 = Math.min(sc.cx, midX), x1 = Math.max(sc.cx, midX)
      const z0 = Math.min(sc.cz, midZ), z1 = Math.max(sc.cz, midZ)
      for (let x = x0; x <= x1; x++) grid.set(`${x},${sc.cz}`, 0)
      for (let z = z0; z <= z1; z++) grid.set(`${midX},${z}`, 0)
    }

    // ── Assign zones to rooms ──
    const rotRooms   = digger.getRooms()
    const zoneIds    = FLOOR_ZONES[fl] ?? []
    const usedIdx    = new Set<number>()

    for (const zone of zoneIds) {
      const scorer = ZONE_SCORERS[zone]
      if (!scorer) continue
      let best = -Infinity, bestIdx = -1
      rotRooms.forEach((r: RotRoom, i: number) => {
        if (usedIdx.has(i)) return
        const sc = scorer(r, gw, gh)
        if (sc > best) { best = sc; bestIdx = i }
      })
      if (bestIdx < 0) continue
      usedIdx.add(bestIdx)

      const r    = rotRooms[bestIdx]
      const cx1  = r.getLeft(), cx2 = r.getRight()
      const cz1  = r.getTop(),  cz2 = r.getBottom()
      const [wx1, wz1] = c2w(cx1, cz1, gw, gh)
      const [wx2, wz2] = c2w(cx2, cz2, gw, gh)
      const [wcx, wcz] = c2w(Math.floor((cx1 + cx2) / 2), Math.floor((cz1 + cz2) / 2), gw, gh)

      // Station slots: grid within room (margin 2 cells from walls, every 2-3 cells)
      const slots: GeneratedRoom['slots'] = []
      const margin = 2
      const stepX  = Math.max(1, Math.ceil((cx2 - cx1 - margin * 2) / 2))
      const stepZ  = Math.max(1, Math.ceil((cz2 - cz1 - margin * 2) / 2))
      for (let ix = cx1 + margin; ix <= cx2 - margin && slots.length < 6; ix += stepX)
        for (let iz = cz1 + margin; iz <= cz2 - margin && slots.length < 6; iz += stepZ) {
          const [x, z] = c2w(ix, iz, gw, gh)
          slots.push({ x, z, floor: fl })
        }

      allRooms.push({ zone, floor: fl, cx1, cx2, cz1, cz2, wx1, wx2: wx2 + CELL_SIZE, wz1, wz2: wz2 + CELL_SIZE, wcx, wcz, slots })
    }
  }

  // ── Build staircases (same world position on both floors) ──
  for (const sc of stairCells) {
    const [wx, wz] = c2w(sc.cx, sc.cz, gw, gh)
    const pad = CELL_SIZE * 1.2
    const base = { tx1: wx - pad, tx2: wx + pad, tz1: wz - pad, tz2: wz + pad, arrX: wx, arrZ: wz }
    staircases.push({ id: `stair_${sc.cx}_${sc.cz}_up`,   fromFloor: 0, toFloor: 1, ...base })
    staircases.push({ id: `stair_${sc.cx}_${sc.cz}_down`, fromFloor: 1, toFloor: 0, ...base })
  }

  // ── Player start: centre of main_office on floor 0 ──
  const mainOff = allRooms.find(r => r.zone === 'main_office' && r.floor === 0)
  const [startX, startZ] = mainOff ? [mainOff.wcx, mainOff.wcz] : [0, 0]

  return { grids, floors: NUM_FLOORS, gridW: gw, gridH: gh, cellSize: CELL_SIZE, floorHeight: FLOOR_HEIGHT, rooms: allRooms, staircases, startX, startZ }
}
