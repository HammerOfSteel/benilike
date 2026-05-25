import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { useGameRoom } from '../store/useGameRoom'
import { useKeyboard } from './useKeyboard'
import { TASK_DEFS } from '@shared/tasks'
import { generateMapData, isWalkable, CELL_SIZE, FLOOR_HEIGHT, WALL_HEIGHT } from '@shared/mapgen'
import type { MapData } from '@shared/mapgen'
import type { StationInfo, TaskId } from '@shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const SPEED      = 7.0
const SEND_MS    = 80
const INTERACT_R = 2.5
const STAIR_CD   = 1500   // ms cooldown between floor transitions

// ── Module-level mutable state (outside React, no stale closure) ──────────────
const localPos   = new THREE.Vector3(0, 0, 0)
let   localFloor = 0
let   lastStair  = 0

// ── Grid renderer (InstancedMesh per floor) ───────────────────────────────────

const _m4 = new THREE.Matrix4()

function GridLayer({
  grid, gridW, gridH, floorY,
}: {
  grid: Map<string, 0 | 1>; gridW: number; gridH: number; floorY: number
}) {
  const wallRef  = useRef<THREE.InstancedMesh>(null)
  const floorRef = useRef<THREE.InstancedMesh>(null)

  const { wallMats, floorMats } = useMemo(() => {
    const wallMs: THREE.Matrix4[]  = []
    const floorMs: THREE.Matrix4[] = []
    for (const [key, type] of grid) {
      const [cx, cz] = key.split(',').map(Number)
      const wx = (cx - gridW / 2) * CELL_SIZE
      const wz = (cz - gridH / 2) * CELL_SIZE
      if (type === 1) {
        wallMs.push(_m4.clone().setPosition(wx, floorY + WALL_HEIGHT / 2, wz))
      } else {
        floorMs.push(_m4.clone().setPosition(wx, floorY, wz))
      }
    }
    return { wallMats: wallMs, floorMats: floorMs }
  }, [grid, gridW, gridH, floorY])

  useEffect(() => {
    if (wallRef.current) {
      wallMats.forEach((m, i) => wallRef.current!.setMatrixAt(i, m))
      wallRef.current.instanceMatrix.needsUpdate = true
    }
    if (floorRef.current) {
      floorMats.forEach((m, i) => floorRef.current!.setMatrixAt(i, m))
      floorRef.current.instanceMatrix.needsUpdate = true
    }
  }, [wallMats, floorMats])

  return (
    <group>
      <instancedMesh ref={wallRef} args={[undefined, undefined, wallMats.length]} castShadow receiveShadow>
        <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
        <meshStandardMaterial color="#5c4f8a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={floorRef} args={[undefined, undefined, floorMats.length]} receiveShadow>
        <boxGeometry args={[CELL_SIZE, 0.12, CELL_SIZE]} />
        <meshStandardMaterial color="#1c1b2e" roughness={0.85} />
      </instancedMesh>
    </group>
  )
}

// ── Zone accent overlays ──────────────────────────────────────────────────────
const ZONE_COLORS: Record<string, string> = {
  main_office:    '#2d2a6e',
  server_room:    '#1a2f4a',
  network_closet: '#152640',
  hr_corner:      '#3a1a52',
  devops_den:     '#1a4228',
  finance_floor:  '#4a2a0f',
  marketing_hub:  '#4a0f28',
  exec_suite:     '#1a2a4e',
}
const ZONE_LIGHT_COLORS: Record<string, string> = {
  main_office:    '#c8c0ff',
  server_room:    '#80d4ff',
  network_closet: '#80c8ff',
  hr_corner:      '#e0b0ff',
  devops_den:     '#90ffb0',
  finance_floor:  '#ffd090',
  marketing_hub:  '#ff90b0',
  exec_suite:     '#a0c0ff',
}

function ZoneOverlays({ mapData, floor }: { mapData: MapData; floor: number }) {
  const floorY = floor * FLOOR_HEIGHT
  return (
    <>
      {mapData.rooms.filter(r => r.floor === floor).map((room, i) => {
        const w = room.wx2 - room.wx1
        const d = room.wz2 - room.wz1
        const cx = (room.wx1 + room.wx2) / 2
        const cz = (room.wz1 + room.wz2) / 2
        return (
          <mesh key={i} position={[cx, floorY + 0.07, cz]} receiveShadow>
            <boxGeometry args={[w, 0.025, d]} />
            <meshStandardMaterial color={ZONE_COLORS[room.zone ?? ''] ?? '#2a2a4e'} roughness={0.9} />
          </mesh>
        )
      })}
    </>
  )
}

// ── Room ceiling lights (togglable) ──────────────────────────────────────────
export interface RoomLightsState { [zone: string]: boolean }

function RoomCeilingLights({ mapData, floor, lights }: {
  mapData: MapData; floor: number; lights: RoomLightsState
}) {
  const floorY   = floor * FLOOR_HEIGHT
  const ceilY    = floorY + WALL_HEIGHT
  return (
    <>
      {mapData.rooms.filter(r => r.floor === floor).map((room, i) => {
        const isOn   = lights[room.zone ?? ''] !== false  // default on
        const lcolor = ZONE_LIGHT_COLORS[room.zone ?? ''] ?? '#e8e0ff'
        const pw     = Math.min(room.wx2 - room.wx1 - 1, 6)
        const pd     = Math.min(room.wz2 - room.wz1 - 1, 6)
        return (
          <group key={i} position={[room.wcx, ceilY, room.wcz]}>
            {/* Ceiling panel */}
            <mesh>
              <boxGeometry args={[pw, 0.1, pd]} />
              <meshStandardMaterial
                color={isOn ? lcolor : '#1a1a28'}
                emissive={isOn ? lcolor : '#000'}
                emissiveIntensity={isOn ? 0.9 : 0}
              />
            </mesh>
            {/* Light cone downward */}
            {isOn && (
              <pointLight
                position={[0, -0.5, 0]}
                intensity={2.5}
                distance={18}
                decay={2}
                color={lcolor}
                castShadow={false}
              />
            )}
          </group>
        )
      })}
    </>
  )
}

// ── Light switch ──────────────────────────────────────────────────────────────
export interface SwitchPos { zone: string; floor: number; x: number; z: number }

function LightSwitches({ mapData, floor, lights, nearZone }: {
  mapData: MapData; floor: number; lights: RoomLightsState; nearZone: string | null
}) {
  const floorY = floor * FLOOR_HEIGHT
  return (
    <>
      {mapData.rooms.filter(r => r.floor === floor).map((room, i) => {
        const isOn   = lights[room.zone ?? ''] !== false
        const isNear = nearZone === room.zone
        return (
          <group key={i} position={[room.wx1 + CELL_SIZE, floorY + 1.1, room.wz1 + CELL_SIZE * 0.5]}>
            {/* Wall-mounted box */}
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.35, 0.12]} />
              <meshStandardMaterial color={isOn ? '#e8d84a' : '#2a2840'} />
            </mesh>
            {/* Indicator dot */}
            <mesh position={[0, 0.06, 0.07]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial
                color={isOn ? '#ffe040' : '#443a6a'}
                emissive={isOn ? '#ffe040' : '#000'}
                emissiveIntensity={isOn ? 1.5 : 0}
              />
            </mesh>
            {/* Highlight ring when near */}
            {isNear && (
              <mesh position={[0, 0, 0.1]} rotation={[0, 0, 0]}>
                <ringGeometry args={[0.22, 0.3, 16]} />
                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} transparent opacity={0.7} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}

// ── Staircase visuals ─────────────────────────────────────────────────────────
function StaircaseVisuals({ mapData, floor }: { mapData: MapData; floor: number }) {
  const floorY = floor * FLOOR_HEIGHT
  const shown  = mapData.staircases.filter(s => s.fromFloor === floor)
  return (
    <>
      {shown.map(s => {
        const cx = (s.tx1 + s.tx2) / 2
        const cz = (s.tz1 + s.tz2) / 2
        const w  = s.tx2 - s.tx1
        const d  = s.tz2 - s.tz1
        return (
          <group key={s.id} position={[cx, floorY, cz]}>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[w, 0.1, d]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.4} transparent opacity={0.7} />
            </mesh>
            <pointLight position={[0, 1.5, 0]} intensity={0.7} distance={5} color="#f59e0b" />
          </group>
        )
      })}
    </>
  )
}

// ── Room labels (floating text alternative: simple emissive box sign) ─────────
function RoomSigns({ mapData, floor }: { mapData: MapData; floor: number }) {
  const floorY = floor * FLOOR_HEIGHT
  return (
    <>
      {mapData.rooms.filter(r => r.floor === floor).map((room, i) => (
        <mesh key={i} position={[room.wcx, floorY + WALL_HEIGHT - 0.1, room.wz1 + CELL_SIZE * 0.5]}>
          <boxGeometry args={[Math.min(room.wx2 - room.wx1 - 1, 8), 0.6, 0.12]} />
          <meshStandardMaterial
            color={ZONE_COLORS[room.zone ?? ''] ?? '#1a1a2e'}
            emissive={ZONE_COLORS[room.zone ?? ''] ?? '#1a1a2e'}
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </>
  )
}

// ── Workstation ───────────────────────────────────────────────────────────────
function Workstation({
  station, hasMyTask, isHolding, isComplete, floorY,
}: {
  station: StationInfo; hasMyTask: boolean
  isHolding: boolean; isComplete: boolean; floorY: number
}) {
  const color    = isComplete ? '#4ade80' : hasMyTask ? '#f59e0b' : '#3a3a52'
  const emissive = isComplete ? '#4ade80' : hasMyTask ? '#f59e0b' : '#1a1a2e'
  const emInt    = isHolding ? 2.2 : hasMyTask ? 0.6 : 0.08

  return (
    <group position={[station.x, floorY, station.z]}>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.09, 0.85]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emInt} />
      </mesh>
      {([[-0.75, -0.32], [0.75, -0.32], [-0.75, 0.32], [0.75, 0.32]] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.2, lz]}>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshStandardMaterial color="#2a2840" />
        </mesh>
      ))}
      <mesh position={[0, 0.72, -0.28]}>
        <boxGeometry args={[0.68, 0.44, 0.04]} />
        <meshStandardMaterial color="#0f0f23" emissive={emissive} emissiveIntensity={emInt * 0.4} />
      </mesh>
      {hasMyTask && !isComplete && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.05, 1.25, 32]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={isHolding ? 3 : 1} transparent opacity={0.55} />
        </mesh>
      )}
      {isComplete && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.05, 1.25, 32]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={0.8} transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  )
}

// ── Player mesh ───────────────────────────────────────────────────────────────
const _v3 = new THREE.Vector3()

function PlayerMesh({
  x, z, floor: pFloor, facing, faction, isLocal, disguised,
}: {
  x: number; z: number; floor: number; facing: number
  faction: string; isLocal: boolean; disguised?: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const floorY   = pFloor * FLOOR_HEIGHT

  useFrame(() => {
    if (groupRef.current) {
      _v3.set(x, floorY, z)
      groupRef.current.position.lerp(_v3, 0.25)
      groupRef.current.rotation.y = facing
    }
  })

  const effectiveFaction = (!isLocal && disguised) ? 'workforce' : faction
  const color = isLocal ? '#6D28D9' : effectiveFaction === 'opposition' ? '#ef4444' : '#3b82f6'

  return (
    <group ref={groupRef} position={[x, floorY, z]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.8, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.25, 0.3]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

// ── Follow Camera ─────────────────────────────────────────────────────────────
const CAM_DESIRED = new THREE.Vector3()
const CAM_LOOKAT  = new THREE.Vector3()

function FollowCamera({ currentFloor: _cf }: { currentFloor: number }) {
  const { camera } = useThree()
  useFrame(() => {
    const floorY = localFloor * FLOOR_HEIGHT
    CAM_LOOKAT.set(localPos.x, floorY, localPos.z)
    CAM_DESIRED.set(localPos.x + 18, floorY + 16, localPos.z + 18)
    camera.position.lerp(CAM_DESIRED, 0.1)
    camera.lookAt(CAM_LOOKAT)
  })
  return null
}

// ── Local Player Controller ───────────────────────────────────────────────────
function LocalPlayerController({
  faction, mapData, switchPositions, onNearStation, onNearSwitch, onZoneChange,
}: {
  faction: string
  mapData: MapData | null
  switchPositions: SwitchPos[]
  onNearStation: (st: StationInfo | null) => void
  onNearSwitch:  (zone: string | null) => void
  onZoneChange:  (zone: string | null) => void
}) {
  const keys      = useKeyboard()
  const facingRef  = useRef(0)
  const lastSent   = useRef(0)
  const lastToggle = useRef(0); void lastToggle
  const groupRef  = useRef<THREE.Group>(null)
  const prevZone  = useRef<string | null>(null)
  const prevSwitch = useRef<string | null>(null)

  useFrame((_, delta) => {
    const k   = keys.current
    let dx = 0, dz = 0
    if (k['KeyW'] || k['ArrowUp'])    dz -= 1
    if (k['KeyS'] || k['ArrowDown'])  dz += 1
    if (k['KeyA'] || k['ArrowLeft'])  dx -= 1
    if (k['KeyD'] || k['ArrowRight']) dx += 1

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz)
      dx /= len; dz /= len
      const gs  = useGameRoom.getState()
      const spd = (faction === 'workforce' && gs.activeEffects.workforceSpeedActive) ? SPEED * 1.3 : SPEED
      const nx  = localPos.x + dx * spd * delta
      const nz  = localPos.z + dz * spd * delta

      if (mapData) {
        const gw = mapData.gridW, gh = mapData.gridH, grids = mapData.grids
        if      (isWalkable(nx, nz, localFloor, grids, gw, gh))            { localPos.x = nx; localPos.z = nz }
        else if (isWalkable(nx, localPos.z, localFloor, grids, gw, gh))    { localPos.x = nx }
        else if (isWalkable(localPos.x, nz, localFloor, grids, gw, gh))    { localPos.z = nz }
      } else {
        localPos.x = nx; localPos.z = nz
      }
      facingRef.current = Math.atan2(dx, dz)
    }

    if (groupRef.current) {
      groupRef.current.position.set(localPos.x, localFloor * FLOOR_HEIGHT, localPos.z)
      groupRef.current.rotation.y = facingRef.current
    }

    // Staircase transitions
    if (mapData && Date.now() - lastStair > STAIR_CD) {
      const stair = mapData.staircases.find(s =>
        s.fromFloor === localFloor &&
        localPos.x >= s.tx1 && localPos.x <= s.tx2 &&
        localPos.z >= s.tz1 && localPos.z <= s.tz2
      )
      if (stair) {
        localFloor = stair.toFloor
        localPos.set(stair.arrX, 0, stair.arrZ)
        lastStair = Date.now()
      }
    }

    // Current zone (which room are we inside?)
    const zone = mapData?.rooms.find(r =>
      r.floor === localFloor &&
      localPos.x >= r.wx1 && localPos.x <= r.wx2 &&
      localPos.z >= r.wz1 && localPos.z <= r.wz2
    )?.zone ?? null
    if (zone !== prevZone.current) { prevZone.current = zone; onZoneChange(zone) }

    // Station proximity
    const gs = useGameRoom.getState()
    const nearStation = gs.stations.find(st => {
      if ((st.floor ?? 0) !== localFloor) return false
      if (!st.taskId) return false
      const sx = localPos.x - st.x, sz = localPos.z - st.z
      return Math.sqrt(sx * sx + sz * sz) < INTERACT_R
    }) ?? null
    onNearStation(nearStation)

    // Light-switch proximity (only on same floor, only when not near a station)
    const sw = !nearStation ? switchPositions.find(s => {
      if (s.floor !== localFloor) return false
      const sx = localPos.x - s.x, sz = localPos.z - s.z
      return Math.sqrt(sx * sx + sz * sz) < 2.5
    }) ?? null : null
    const swZone = sw?.zone ?? null
    if (swZone !== prevSwitch.current) { prevSwitch.current = swZone; onNearSwitch(swZone) }

    // Hold-E for workstation
    const wantsHold   = nearStation && !!k['KeyE']
    const currentHold = gs.holdingStationId
    if (wantsHold && nearStation) {
      const td = TASK_DEFS.find(t => t.id === nearStation.taskId && t.role === gs.myRole)
      if (td && !gs.completedTasks.has(nearStation.taskId as TaskId)) {
        if (currentHold !== nearStation.stationId) {
          gs.setHolding(nearStation.stationId)
          gs.room?.send('task_hold_start', { stationId: nearStation.stationId })
        }
      }
    } else if (!wantsHold && currentHold) {
      gs.setHolding(null)
      gs.room?.send('task_hold_cancel', {})
    }

    // Position broadcast
    const now = performance.now()
    if (now - lastSent.current > SEND_MS) {
      gs.room?.send('move', { x: localPos.x, z: localPos.z, floor: localFloor, facing: facingRef.current })
      lastSent.current = now
    }
  })

  const color = faction === 'opposition' ? '#ef4444' : '#6D28D9'
  return (
    <group ref={groupRef} position={[localPos.x, 0, localPos.z]}>
      {/* Player body */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.8, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.25, 0.3]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1} />
      </mesh>
      {/* Local player follow light */}
      <pointLight position={[0, 2.2, 0]} intensity={1.8} distance={10} decay={2} color="#fff5e0" />
    </group>
  )
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({
  onNearStation, onZoneChange, gameOver,
}: {
  onNearStation: (st: StationInfo | null) => void
  onZoneChange:  (zone: string | null) => void
  gameOver:      boolean
}) {
  const { players, myFaction, room, stations, completedTasks, holdingStationId } = useGameRoom()
  const mapSeed = useGameRoom(s => s.mapSeed)
  const mapSize = useGameRoom(s => s.mapSize)
  const myRole  = useGameRoom(s => s.myRole)
  const [renderFloor,  setRenderFloor]  = useState(0)
  const [roomLights,   setRoomLights]   = useState<RoomLightsState>({})
  const [nearSwitch,   setNearSwitch]   = useState<string | null>(null)
  const lastToggleRef = useRef(0)

  // Regenerate map from seed
  const mapData = useMemo<MapData | null>(() => {
    if (!mapSeed) return null
    const md = generateMapData(mapSeed, mapSize)
    localPos.set(md.startX, 0, md.startZ)
    localFloor = 0
    return md
  }, [mapSeed, mapSize])

  // Default all room lights to ON when map changes
  useEffect(() => {
    if (!mapData) return
    const defaults: RoomLightsState = {}
    for (const r of mapData.rooms) defaults[r.zone ?? ''] = true
    setRoomLights(defaults)
  }, [mapData])

  // Switch positions: just inside the top-left corner of each room
  const switchPositions = useMemo<SwitchPos[]>(() =>
    mapData ? mapData.rooms.map(r => ({
      zone:  r.zone ?? '',
      floor: r.floor,
      x:     r.wx1 + CELL_SIZE,
      z:     r.wz1 + CELL_SIZE * 0.5,
    })) : []
  , [mapData])

  // Light switch handler (debounced, called by LocalPlayerController proximity)
  const handleSwitchToggle = useCallback((zone: string) => {
    const now = Date.now()
    if (now - lastToggleRef.current < 400) return
    lastToggleRef.current = now
    setRoomLights(prev => ({ ...prev, [zone]: !prev[zone] }))
  }, [])

  // Track local floor for rendering
  useFrame(() => {
    if (renderFloor !== localFloor) setRenderFloor(localFloor)
  })

  useEffect(() => {
    if (!room) return
    room.onStateChange((state: any) => {
      const gs = useGameRoom.getState()
      gs.setPlayers(
        Array.from((state.players as Map<string, any>).values()).map((p: any) => ({
          sessionId: p.sessionId, name: p.name,
          x: p.x ?? 0, z: p.z ?? 0, floor: p.floor ?? 0, facing: p.facing ?? 0,
          faction: p.faction ?? '', role: p.role ?? '',
          connected: p.connected, isBot: p.isBot ?? false,
          disguised: p.disguised ?? false, slowed: p.slowed ?? false,
        }))
      )
      if (state.lockdownActive !== undefined) {
        const curr = gs.activeEffects
        if (curr.lockdownActive !== !!state.lockdownActive)
          gs.setActiveEffects({ ...curr, lockdownActive: !!state.lockdownActive })
      }
    })
    room.onMessage('station_list',     (data: { stations: StationInfo[] }) => useGameRoom.getState().setStations(data.stations))
    room.onMessage('task_complete',    (data: { taskId: TaskId; role: string; effectDesc: string; meterGain: number }) => {
      const gs = useGameRoom.getState()
      gs.completeTask(data.taskId)
      gs.addToast({ role: data.role, effectDesc: data.effectDesc, meterGain: data.meterGain, expiresAt: Date.now() + 4000 })
      gs.addIncident(`${data.role.replace('_', ' ')}: ${data.effectDesc}`, 'info')
    })
    room.onMessage('meter_update',     (d: { workforce: number; opposition: number }) => useGameRoom.getState().setMeters(d.workforce, d.opposition))
    room.onMessage('monitor_snapshot', (d: any) => useGameRoom.getState().setMonitorSnapshot(d))
    room.onMessage('effect_update',    (d: any) => useGameRoom.getState().setActiveEffects(d))
    room.onMessage('game_end',         (d: { winner: string; reason: string }) => useGameRoom.getState().setGameEnd(d.winner, d.reason))
    room.onMessage('incident',         (d: { message: string; severity: string; time: string }) => useGameRoom.getState().addIncident(d.message, d.severity as any, d.time))
    return () => {}
  }, [room])

  // Light switch press handling (E key while near a switch, not near a station)
  const keysRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keysRef.current[e.code] = true }
    const up   = (e: KeyboardEvent) => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])
  useFrame(() => {
    if (nearSwitch && keysRef.current['KeyF']) handleSwitchToggle(nearSwitch)
  })

  const mySessionId = room?.sessionId
  const floorY      = renderFloor * FLOOR_HEIGHT

  return (
    <>
      <ambientLight intensity={0.45} color="#8080cc" />
      <directionalLight position={[20, 30, 20]} intensity={0.6} castShadow={false} />

      <FollowCamera currentFloor={renderFloor} />

      {/* Grid + lights */}
      {mapData && (
        <group key={`floor-${renderFloor}`}>
          <GridLayer
            grid={mapData.grids[renderFloor]}
            gridW={mapData.gridW}
            gridH={mapData.gridH}
            floorY={floorY}
          />
          <ZoneOverlays     mapData={mapData} floor={renderFloor} />
          <RoomCeilingLights mapData={mapData} floor={renderFloor} lights={roomLights} />
          <LightSwitches    mapData={mapData} floor={renderFloor} lights={roomLights} nearZone={nearSwitch} />
          <StaircaseVisuals mapData={mapData} floor={renderFloor} />
          <RoomSigns        mapData={mapData} floor={renderFloor} />
        </group>
      )}

      {/* Workstations */}
      {stations.filter(st => (st.floor ?? 0) === renderFloor).map(st => {
        const hasMyTask  = !!myRole && !!st.taskId && TASK_DEFS.some(t => t.id === st.taskId && t.role === myRole)
        const isHolding  = holdingStationId === st.stationId
        const isComplete = !!st.taskId && completedTasks.has(st.taskId)
        return (
          <Workstation key={st.stationId} station={st} hasMyTask={hasMyTask}
            isHolding={isHolding} isComplete={isComplete} floorY={floorY} />
        )
      })}

      {/* Remote players */}
      {players.filter(p => p.sessionId !== mySessionId).map(p => (
        <PlayerMesh key={p.sessionId}
          x={p.x} z={p.z} floor={p.floor} facing={p.facing}
          faction={p.faction} isLocal={false} disguised={p.disguised}
        />
      ))}

      {/* Local player */}
      {!gameOver && (
        <LocalPlayerController
          faction={myFaction ?? 'workforce'}
          mapData={mapData}
          switchPositions={switchPositions}
          onNearStation={onNearStation}
          onNearSwitch={setNearSwitch}
          onZoneChange={onZoneChange}
        />
      )}
    </>
  )
}

// ── GameWorld (exported) ──────────────────────────────────────────────────────
export interface GameWorldProps {
  onNearStation: (st: StationInfo | null) => void
  onZoneChange?: (zone: string | null) => void
  gameOver?:     boolean
}

export default function GameWorld({ onNearStation, onZoneChange, gameOver = false }: GameWorldProps) {
  return (
    <Canvas
      shadows
      camera={{ fov: 50, near: 0.1, far: 400, position: [18, 16, 18] }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    >
      <Scene onNearStation={onNearStation} onZoneChange={onZoneChange ?? (() => {})} gameOver={gameOver} />
    </Canvas>
  )
}
