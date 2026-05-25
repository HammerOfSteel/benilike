/**
 * benilike dev test runner
 *
 * Usage:
 *   npm run test:game                       → run all suites
 *   npm run test:game -- --suite mapgen     → mapgen only
 *   npm run test:game -- --suite tasks      → task-assignment only
 *   npm run test:game -- --seed "myseed" --size small
 *   npm run test:game -- --visual           → print ASCII grid
 *   npm run test:game -- --floor 1          → visual for floor 1
 *
 * Suites: mapgen | tasks | collision | all (default)
 */

import { generateMapData, isWalkable, CELL_SIZE, FLOOR_HEIGHT } from '../shared/src/mapgen'
import { assignStations }                                        from '../shared/src/tasks'

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
}
const ok    = (msg: string) => console.log(`  ${C.green}✓${C.reset} ${msg}`)
const fail  = (msg: string) => console.log(`  ${C.red}✗${C.reset} ${C.bold}${msg}${C.reset}`)
const info  = (msg: string) => console.log(`  ${C.cyan}·${C.reset} ${msg}`)
const head  = (msg: string) => console.log(`\n${C.bold}${C.white}══ ${msg} ══${C.reset}`)
const sub   = (msg: string) => console.log(`${C.yellow}▸ ${msg}${C.reset}`)

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const arg  = (flag: string, fallback = '') =>
  (args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')) ??
  (args.includes(flag) ? args[args.indexOf(flag) + 1] ?? fallback : fallback)

const SEED    = arg('--seed',  'benilike-dev-42')
const SIZE    = (arg('--size', 'small') as 'small' | 'medium' | 'large')
const SUITE   = arg('--suite', 'all')
const FLOOR   = parseInt(arg('--floor', '0'))
const VISUAL  = args.includes('--visual')

let passed = 0, failed = 0

function assert(label: string, cond: boolean, detail = '') {
  if (cond) { ok(label); passed++ }
  else       { fail(`${label}${detail ? ' — ' + detail : ''}`); failed++ }
}

function assertThrows(label: string, fn: () => void) {
  try { fn(); fail(`${label} (no error thrown)`); failed++ }
  catch (e) { ok(`${label} (threw: ${(e as Error).message?.slice(0, 60)})`); passed++ }
}

// ── Suite: mapgen ─────────────────────────────────────────────────────────────
function suiteMapgen() {
  head('MAPGEN SUITE')

  sub(`generateMapData seed="${SEED}" size=${SIZE}`)
  const t0 = Date.now()
  let md: ReturnType<typeof generateMapData>
  try {
    md = generateMapData(SEED, SIZE)
  } catch (e) {
    fail(`generateMapData threw: ${(e as Error).message}`)
    console.error((e as Error).stack)
    failed++
    return
  }
  const ms = Date.now() - t0
  ok(`generated in ${ms}ms`)

  // Basic shape
  assert('floors count matches NUM_FLOORS',  md.floors === 2)
  assert('grids array length === floors',    md.grids.length === md.floors)
  assert('gridW > 0',                        md.gridW > 0)
  assert('gridH > 0',                        md.gridH > 0)
  assert('cellSize === CELL_SIZE',           md.cellSize === CELL_SIZE)
  assert('floorHeight === FLOOR_HEIGHT',     md.floorHeight === FLOOR_HEIGHT)

  // Grid contents
  for (let fl = 0; fl < md.floors; fl++) {
    const grid = md.grids[fl]
    const total = grid.size
    const walls  = Array.from(grid.values()).filter(v => v === 1).length
    const floors = total - walls
    info(`floor ${fl}: ${total} cells, ${floors} floor (${C.green}${Math.round(floors/total*100)}%${C.reset}), ${walls} wall`)
    assert(`floor ${fl} has cells`,           total > 0, `got ${total}`)
    assert(`floor ${fl} has floor cells`,     floors > 100, `got ${floors}`)
    assert(`floor ${fl} has wall cells`,      walls  > 10,  `got ${walls}`)
    assert(`floor ${fl} coverage <= 100%`,    floors + walls === total)
  }

  // Rooms
  assert('rooms array non-empty',   md.rooms.length > 0,   `got ${md.rooms.length}`)
  assert('rooms have zone field',   md.rooms.every(r => !!r.zone))
  assert('rooms have floor field',  md.rooms.every(r => typeof r.floor === 'number'))
  assert('main_office on floor 0',  md.rooms.some(r => r.zone === 'main_office' && r.floor === 0))
  info(`rooms: ${md.rooms.map(r => `${r.zone}(fl${r.floor})`).join(', ')}`)

  // Staircases
  assert('staircases non-empty',    md.staircases.length >= 2, `got ${md.staircases.length}`)
  assert('staircase fromFloor 0→1', md.staircases.some(s => s.fromFloor === 0 && s.toFloor === 1))
  assert('staircase fromFloor 1→0', md.staircases.some(s => s.fromFloor === 1 && s.toFloor === 0))
  info(`staircases: ${md.staircases.map(s => `${s.id}`).join(', ')}`)

  // Start position
  assert('startX is finite',        isFinite(md.startX))
  assert('startZ is finite',        isFinite(md.startZ))
  info(`start position: (${md.startX.toFixed(1)}, ${md.startZ.toFixed(1)})`)

  // Determinism: same seed → same grid
  sub('Determinism check (generate twice)')
  const md2 = generateMapData(SEED, SIZE)
  let det = true
  for (const [k, v] of md.grids[0]) {
    if (md2.grids[0].get(k) !== v) { det = false; break }
  }
  assert('same seed produces identical floor-0 grid', det)

  // Different seed → different grid
  const mdAlt = generateMapData(SEED + '_ALT', SIZE)
  let diff = false
  let checked = 0
  for (const [k, v] of md.grids[0]) {
    if (mdAlt.grids[0].get(k) !== v) { diff = true; break }
    if (++checked > 200) break
  }
  assert('different seed produces different grid', diff)

  // Optional ASCII visual
  if (VISUAL) {
    printGridASCII(md, FLOOR)
  }
}

// ── Suite: collision ──────────────────────────────────────────────────────────
function suiteCollision() {
  head('COLLISION SUITE')

  const md = generateMapData(SEED, SIZE)

  sub('isWalkable on floor cells')
  // Find a known floor cell and test walkability at its centre
  let floorCell: [number, number] | null = null
  for (const [k, v] of md.grids[0]) {
    if (v === 0) {
      floorCell = k.split(',').map(Number) as [number, number]
      break
    }
  }
  if (floorCell) {
    const [cx, cz] = floorCell
    const wx = (cx - md.gridW / 2) * CELL_SIZE
    const wz = (cz - md.gridH / 2) * CELL_SIZE
    info(`testing floor cell [${cx},${cz}] → world (${wx.toFixed(1)}, ${wz.toFixed(1)})`)
    assert('floor cell centre is walkable', isWalkable(wx, wz, 0, md.grids, md.gridW, md.gridH))
  } else {
    fail('no floor cell found on floor 0')
  }

  sub('isWalkable on wall cells')
  let wallCell: [number, number] | null = null
  for (const [k, v] of md.grids[0]) {
    if (v === 1) {
      wallCell = k.split(',').map(Number) as [number, number]
      break
    }
  }
  if (wallCell) {
    const [cx, cz] = wallCell
    const wx = (cx - md.gridW / 2) * CELL_SIZE
    const wz = (cz - md.gridH / 2) * CELL_SIZE
    info(`testing wall cell [${cx},${cz}] → world (${wx.toFixed(1)}, ${wz.toFixed(1)})`)
    assert('wall cell centre is NOT walkable', !isWalkable(wx, wz, 0, md.grids, md.gridW, md.gridH))
  } else {
    fail('no wall cell found on floor 0')
  }

  sub('isWalkable out of bounds')
  assert('far out of bounds → not walkable', !isWalkable(9999, 9999, 0, md.grids, md.gridW, md.gridH))
  assert('negative out of bounds → not walkable', !isWalkable(-9999, -9999, 0, md.grids, md.gridW, md.gridH))
  assert('invalid floor → not walkable', !isWalkable(0, 0, 99, md.grids, md.gridW, md.gridH))

  sub('isWalkable sliding test (near wall edge)')
  // Pick a floor cell adjacent to a wall and test near-wall positions
  let edgeFloor: [number, number] | null = null
  let edgeWall:  [number, number] | null = null
  outer: for (const [k, v] of md.grids[0]) {
    if (v !== 0) continue
    const [cx, cz] = k.split(',').map(Number)
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      if (md.grids[0].get(`${cx+dx},${cz+dz}`) === 1) {
        edgeFloor = [cx, cz]
        edgeWall  = [cx+dx, cz+dz]
        break outer
      }
    }
  }
  if (edgeFloor && edgeWall) {
    const [fx, fz] = edgeFloor
    const wx = (fx - md.gridW / 2) * CELL_SIZE
    const wz = (fz - md.gridH / 2) * CELL_SIZE
    // 0.1 world units inside the floor cell — should be walkable
    assert('0.1 units from floor→wall boundary is walkable',
      isWalkable(wx + 0.1, wz, 0, md.grids, md.gridW, md.gridH) ||
      isWalkable(wx, wz + 0.1, 0, md.grids, md.gridW, md.gridH)
    )
  }

  sub('Staircase trigger zones are walkable')
  for (const sc of md.staircases) {
    const cx = (sc.tx1 + sc.tx2) / 2
    const cz = (sc.tz1 + sc.tz2) / 2
    const walkable = isWalkable(cx, cz, sc.fromFloor, md.grids, md.gridW, md.gridH)
    assert(`staircase ${sc.id} centre walkable`, walkable, `at (${cx.toFixed(1)}, ${cz.toFixed(1)}) fl=${sc.fromFloor}`)
  }
}

// ── Suite: tasks ──────────────────────────────────────────────────────────────
function suiteTasks() {
  head('TASKS SUITE')

  const TASK_DEFS_SAMPLE = [
    { id: 'it_repair_terminal' as const, role: 'it' as const, name: 'Repair Terminal', zone: 'main_office' as const, holdMs: 3000, meterGain: 14, effectDesc: 'system restored' },
    { id: 'devops_ci_pipeline' as const, role: 'devops' as const, name: 'CI Pipeline', zone: 'devops_den' as const, holdMs: 4000, meterGain: 14, effectDesc: 'pipeline active' },
    { id: 'hacker_zero_day'   as const, role: 'hacker' as const, name: 'Zero Day',    zone: 'server_room' as const, holdMs: 5000, meterGain: 14, effectDesc: 'system breached' },
  ]

  sub('assignStations with pre-generated mapData')
  const md = generateMapData(SEED, SIZE)

  let stations: ReturnType<typeof assignStations>
  try {
    stations = assignStations(SEED, SIZE, TASK_DEFS_SAMPLE as any, md)
  } catch (e) {
    fail(`assignStations threw: ${(e as Error).message}`)
    console.error((e as Error).stack)
    failed++
    return
  }

  assert('stations array non-empty',         stations.length > 0,                         `got ${stations.length}`)
  assert('each station has stationId',       stations.every(s => !!s.stationId))
  assert('each station has x and z coords', stations.every(s => isFinite(s.x) && isFinite(s.z)))
  info(`assigned ${stations.length} station(s):`)
  for (const s of stations) {
    const flTag = (s as any).floor !== undefined ? ` fl=${(s as any).floor}` : ''
    info(`  ${C.gray}${s.stationId}${C.reset} zone=${s.zone} task=${s.taskId}${flTag} pos=(${s.x.toFixed(1)},${s.z.toFixed(1)})`)
  }

  sub('assignStations determinism')
  const st2 = assignStations(SEED, SIZE, TASK_DEFS_SAMPLE as any, md)
  assert('same seed → same station positions', stations.every((s, i) =>
    s.x === st2[i].x && s.z === st2[i].z && s.stationId === st2[i].stationId
  ))

  sub('assignStations without pre-generated mapData (generates internally)')
  try {
    const stAuto = assignStations(SEED, SIZE, TASK_DEFS_SAMPLE as any)
    assert('auto-generated stations non-empty', stAuto.length > 0)
  } catch (e) {
    fail(`assignStations (auto mapData) threw: ${(e as Error).message}`)
    console.error((e as Error).stack)
    failed++
  }
}

// ── ASCII grid printer ────────────────────────────────────────────────────────
function printGridASCII(md: ReturnType<typeof generateMapData>, floor: number) {
  console.log(`\n${C.bold}${C.cyan}── ASCII Grid: floor ${floor} (${md.gridW}×${md.gridH}) ──${C.reset}`)
  const STEP = 2  // sample every N cells to fit in terminal
  const grid = md.grids[floor]
  if (!grid) { console.log(`  floor ${floor} not found`); return }

  // Compute room zone lookup for colour
  const cellZone = new Map<string, string>()
  for (const r of md.rooms.filter(r => r.floor === floor)) {
    for (let cx = r.cx1; cx <= r.cx2; cx++)
      for (let cz = r.cz1; cz <= r.cz2; cz++)
        cellZone.set(`${cx},${cz}`, r.zone ?? '')
  }

  // Mark staircase cells
  const stairCells = new Set<string>()
  for (const sc of md.staircases.filter(s => s.fromFloor === floor)) {
    const cxMid = Math.round((sc.tx1 + sc.tx2) / 2 / CELL_SIZE + md.gridW / 2)
    const czMid = Math.round((sc.tz1 + sc.tz2) / 2 / CELL_SIZE + md.gridH / 2)
    stairCells.add(`${cxMid},${czMid}`)
  }

  const ZONE_CHAR: Record<string, string> = {
    main_office:    'O', server_room: 'S', network_closet: 'N',
    hr_corner:      'H', finance_floor: 'F', devops_den: 'D',
    marketing_hub:  'M', exec_suite: 'E', opposition_den: 'X', '': '.',
  }

  const rows: string[] = []
  for (let cz = 0; cz < md.gridH; cz += STEP) {
    let row = ''
    for (let cx = 0; cx < md.gridW; cx += STEP) {
      const key  = `${cx},${cz}`
      const type = grid.get(key)
      if (stairCells.has(key)) {
        row += `${C.yellow}↑${C.reset}`
      } else if (type === 1) {
        row += `${C.dim}█${C.reset}`
      } else if (type === 0) {
        const zone = cellZone.get(key) ?? ''
        const ch   = ZONE_CHAR[zone] ?? '·'
        row += `${C.gray}${ch}${C.reset}`
      } else {
        row += ' '
      }
    }
    rows.push(row)
  }
  console.log(rows.join('\n'))

  // Legend
  console.log(`\n  ${C.dim}█${C.reset}=wall  ${C.gray}·${C.reset}=corridor  ${C.yellow}↑${C.reset}=stair`)
  console.log(`  zones: O=main_office S=server_room N=net_closet H=hr D=devops F=finance M=marketing E=exec`)
}

// ── Runner ────────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}${C.white}╔═══════════════════════════════════╗`)
console.log(`║  benilike  game  test  runner      ║`)
console.log(`╚═══════════════════════════════════╝${C.reset}`)
console.log(`  seed="${C.cyan}${SEED}${C.reset}"  size=${C.cyan}${SIZE}${C.reset}  floor=${C.cyan}${FLOOR}${C.reset}  suite=${C.cyan}${SUITE}${C.reset}`)

const run = (name: string, fn: () => void) => {
  if (SUITE === 'all' || SUITE === name) {
    try { fn() }
    catch (e) {
      fail(`Suite "${name}" crashed: ${(e as Error).message}`)
      console.error((e as Error).stack)
      failed++
    }
  }
}

run('mapgen',    suiteMapgen)
run('collision', suiteCollision)
run('tasks',     suiteTasks)

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}${'─'.repeat(40)}${C.reset}`)
const total = passed + failed
if (failed === 0) {
  console.log(`${C.green}${C.bold}  ALL PASSED${C.reset}  (${passed}/${total})`)
} else {
  console.log(`${C.red}${C.bold}  ${failed} FAILED${C.reset}  ${C.green}${passed} passed${C.reset}  (${total} total)`)
  process.exitCode = 1
}
console.log()
