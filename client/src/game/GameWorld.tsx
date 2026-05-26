import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, useGLTF } from '@react-three/drei'
import { useRef, useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import * as THREE from 'three'
import { useGameRoom } from '../store/useGameRoom'
import { useKeyboard } from './useKeyboard'
import { TASK_DEFS, AI_TASK_DEFS } from '@shared/tasks'
import { generateMapData, isWalkable, CELL_SIZE, FLOOR_HEIGHT, WALL_HEIGHT } from '@shared/mapgen'
import type { MapData } from '@shared/mapgen'
import type { StationInfo, TaskId, BodyInfo } from '@shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const SPEED      = 7.0
const SEND_MS    = 80
const INTERACT_R = 2.5
const STAIR_CD   = 1500   // ms cooldown between floor transitions

// ── Module-level mutable state (outside React, no stale closure) ──────────────
const localPos   = new THREE.Vector3(0, 0, 0)
let   localFloor = 0
let   lastStair  = 0

// ── 3D asset models ───────────────────────────────────────────────────────────
const CHAR_MODELS = [
  '/models/Char01.glb',
  '/models/Char02.glb',
  '/models/Char03.glb',
  '/models/Char04.glb',
  '/models/Char05.glb',
]
CHAR_MODELS.forEach(p => useGLTF.preload(p))
useGLTF.preload('/models/Office_Desk_1.glb')

function charIndex(name: string): number {
  let h = 0
  for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return Math.abs(h) % CHAR_MODELS.length
}

// Renders a voxel character GLB; each caller gets its own clone so multiple
// instances of the same model can co-exist in the scene.
function CharacterModel({ name, opacity = 1 }: { name: string; opacity?: number }) {
  const { scene } = useGLTF(CHAR_MODELS[charIndex(name)])
  const clone = useMemo(() => {
    const c = scene.clone(true)
    if (opacity < 1) {
      c.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh
          const mat  = (mesh.material as THREE.Material).clone() as THREE.MeshStandardMaterial
          mat.transparent = true
          mat.opacity = opacity
          mesh.material = mat
        }
      })
    }
    return c
  }, [scene, opacity])
  // Model is 1.7 units tall, feet at Y=0 — matches capsule height exactly
  return <primitive object={clone} scale={[1, 1, 1]} />
}

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

  const { scene: deskScene } = useGLTF('/models/Office_Desk_1.glb')
  const deskClone = useMemo(() => deskScene.clone(true), [deskScene])

  return (
    <group position={[station.x, floorY, station.z]}>
      {/* 3D desk model — scale 0.009 (cm→game units, ~0.85 high × 1.33 wide) */}
      <primitive object={deskClone} scale={[0.009, 0.009, 0.009]} />
      {/* Monitor screen on top */}
      <mesh position={[0, 0.95, -0.28]}>
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

// ── Vote indicator with fade-in / fade-out ────────────────────────────────────
function VoteIndicatorBillboard({ text, aboveBubble }: { text: string; aboveBubble: boolean }) {
  const textRef = useRef<any>(null)
  const mountedAt = useRef(Date.now())
  const DURATION = 4.0

  useFrame(() => {
    if (!textRef.current) return
    const t = (Date.now() - mountedAt.current) / 1000
    const fadeIn  = 0.35
    const fadeOut = DURATION - 0.9
    const op = t < fadeIn ? t / fadeIn : t > fadeOut ? Math.max(0, 1 - (t - fadeOut) / 0.9) : 1
    textRef.current.fillOpacity = Math.max(0, Math.min(1, op))
  })

  return (
    <Billboard position={[0, aboveBubble ? 4.1 : 3.15, 0]} follow>
      <Text ref={textRef} fontSize={0.38} color="#f59e0b" anchorX="center" anchorY="middle">
        {text}
      </Text>
    </Billboard>
  )
}

// ── Player mesh ───────────────────────────────────────────────────────────────
const _v3 = new THREE.Vector3()

function PlayerMesh({
  x, z, floor: pFloor, facing, isLocal, isEliminated, name, isBot,
  speechBubble, voteIndicator,
}: {
  x: number; z: number; floor: number; facing: number
  isLocal: boolean; isEliminated?: boolean
  name?: string; isBot?: boolean
  speechBubble?: string
  voteIndicator?: string   // e.g. "→ Dave" or "⏭ skip"
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

  const color = isLocal ? '#6D28D9' : isBot ? '#f59e0b' : '#3b82f6'

  return (
    <group ref={groupRef} position={[x, floorY, z]}>
      {/* Voxel character model */}
      <CharacterModel name={name ?? ''} opacity={isEliminated ? 0.35 : 1} />
      {/* Colour-coded floor ring: purple = local, amber = bot, blue = human */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.48, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2}
          transparent opacity={isEliminated ? 0.2 : 0.8} />
      </mesh>
      {/* Floating name tag — always faces the camera */}
      {name && (
        <Billboard position={[0, 2.4, 0]} follow={true}>
          <Text
            fontSize={0.32}
            color={isBot ? '#fbbf24' : (isLocal ? '#c4b5fd' : '#93c5fd')}
            anchorX="center"
            anchorY="middle"
          >
            {name}
          </Text>
        </Billboard>
      )}
      {/* Speech bubble — shown during meeting chat */}
      {speechBubble && (
        <Billboard position={[0, 3.15, 0]} follow={true}>
          <mesh position={[0, 0, -0.04]}>
            <planeGeometry args={[Math.min(6.5, speechBubble.length * 0.165 + 0.6), 0.72]} />
            <meshBasicMaterial color="#0d0d24" transparent opacity={0.88} />
          </mesh>
          <Text
            fontSize={0.25} color="#e2e8f0"
            anchorX="center" anchorY="middle"
            maxWidth={6} textAlign="center"
          >
            {speechBubble}
          </Text>
        </Billboard>
      )}
      {/* Vote indicator — fades in then out when this player casts a vote */}
      {voteIndicator && (
        <VoteIndicatorBillboard key={voteIndicator} text={voteIndicator} aboveBubble={!!speechBubble} />
      )}
    </group>
  )
}

// ── Meeting room table + atmosphere ───────────────────────────────────────────
function MeetingTable() {
  return (
    <group position={[0, 0, 0]}>
      {/* Table top */}
      <mesh position={[0, 0.65, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.6, 2.8, 0.14, 32]} />
        <meshStandardMaterial color="#12101e" emissive="#1a1232" emissiveIntensity={0.5} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Table leg */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.18, 0.24, 0.65, 16]} />
        <meshStandardMaterial color="#0a0910" roughness={0.8} />
      </mesh>
      {/* Ambient glow under table */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.2, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.06} />
      </mesh>
      {/* Overhead spotlight */}
      <pointLight position={[0, 5, 0]} intensity={5} distance={14} decay={2} color="#f5c542" castShadow={false} />
      {/* Subtle ring on floor */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.0, 4.3, 48]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.12} />
      </mesh>
    </group>
  )
}

// ── Meeting room camera ────────────────────────────────────────────────────────
const _meetLook    = new THREE.Vector3()
const _meetDesired = new THREE.Vector3()

function MeetingCamera({ center }: { center: { x: number; z: number } }) {
  const { camera } = useThree()
  useFrame(() => {
    _meetDesired.set(center.x, 15, center.z + 13)
    _meetLook.set(center.x, 0.5, center.z)
    camera.position.lerp(_meetDesired, 0.06)
    camera.lookAt(_meetLook)
  })
  return null
}

// ── Body marker ───────────────────────────────────────────────────────────────
function BodyMarker({ body, floorY, isNear }: { body: BodyInfo; floorY: number; isNear: boolean }) {
  return (
    <group position={[body.x, floorY + 0.06, body.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isNear ? 2 : 0.7} transparent opacity={0.85} />
      </mesh>
      {isNear && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.85, 24]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3} transparent opacity={0.6} />
        </mesh>
      )}
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

// ── Spectator: follow a specific player ───────────────────────────────────────────────────
const _specLook    = new THREE.Vector3()
const _specDesired = new THREE.Vector3()

function SpectatorFollowCamera({ targetId }: { targetId: string }) {
  const { camera } = useThree()
  useFrame(() => {
    const gs = useGameRoom.getState()
    const target = gs.players.find(p => p.sessionId === targetId)
    if (!target) return
    const fy = (target.floor ?? 0) * FLOOR_HEIGHT
    _specLook.set(target.x, fy + 0.8, target.z)
    _specDesired.set(target.x + 14, fy + 12, target.z + 14)
    camera.position.lerp(_specDesired, 0.08)
    camera.lookAt(_specLook)
  })
  return null
}

// ── Local Player Controller ───────────────────────────────────────────────────
function LocalPlayerController({
  mapData, switchPositions, onNearStation, onNearSwitch, onZoneChange, onNearBody,
}: {
  mapData: MapData | null
  switchPositions: SwitchPos[]
  onNearStation: (st: StationInfo | null) => void
  onNearSwitch:  (zone: string | null) => void
  onZoneChange:  (zone: string | null) => void
  onNearBody:    (body: BodyInfo | null) => void
}) {
  const keys      = useKeyboard()
  const facingRef  = useRef(0)
  const lastSent   = useRef(0)
  const lastToggle = useRef(0); void lastToggle
  const groupRef  = useRef<THREE.Group>(null)
  const prevZone  = useRef<string | null>(null)
  const prevSwitch = useRef<string | null>(null)
  const localName  = useGameRoom(s => {
    const sid = s.room?.sessionId
    return s.players.find(p => p.sessionId === sid)?.name ?? ''
  })

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
      const spd = SPEED
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

    // Proximity to bodies
    const nearBodyObj = gs.bodies.find(b => {
      if (b.floor !== localFloor) return false
      const bx = localPos.x - b.x, bz = localPos.z - b.z
      return Math.sqrt(bx * bx + bz * bz) < INTERACT_R * 2
    }) ?? null
    onNearBody(nearBodyObj)

    // Hold-E for workstation or body report
    const wantsHold   = nearStation && !!k['KeyE']
    const currentHold = gs.holdingStationId
    if (!nearStation && nearBodyObj && k['KeyE']) {
      // Report body
      gs.room?.send('report_body', { bodyId: nearBodyObj.bodyId })
    } else if (wantsHold && nearStation) {
      const td = nearStation.taskId ? [...TASK_DEFS, ...AI_TASK_DEFS].find(t => t.id === nearStation.taskId) : null
      const playerTasks = gs.myAssignedTasks ?? []
      if (td && playerTasks.includes(nearStation.taskId as TaskId) && !gs.completedTasks.has(nearStation.taskId as TaskId)) {
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

  const color = '#6D28D9'
  return (
    <group ref={groupRef} position={[localPos.x, 0, localPos.z]}>
      <CharacterModel name={localName} />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.48, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
      {/* Local player follow light */}
      <pointLight position={[0, 2.2, 0]} intensity={1.8} distance={10} decay={2} color="#fff5e0" />
    </group>
  )
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({
  onNearStation, onNearBody, onZoneChange, gameOver, spectate, spectateTarget,
  meetingActive, speechBubbles, voteIndicators,
}: {
  onNearStation:  (st: StationInfo | null) => void
  onNearBody:     (body: BodyInfo | null) => void
  onZoneChange:   (zone: string | null) => void
  gameOver:       boolean
  spectate:       boolean
  spectateTarget: string | null
  meetingActive:  boolean
  speechBubbles:  Record<string, string>
  voteIndicators: Record<string, string>
}) {
  const { players, room, stations, completedTasks, holdingStationId } = useGameRoom()
  const myAssignedTasks = useGameRoom(s => s.myAssignedTasks)
  const bodies  = useGameRoom(s => s.bodies)
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

  // Meeting room center: the floor-0 room whose world-centre is closest to map origin
  const meetingCenter = useMemo<{ x: number; z: number }>(() => {
    if (!mapData) return { x: 0, z: 0 }
    const floor0 = mapData.rooms.filter(r => r.floor === 0)
    if (floor0.length === 0) return { x: 0, z: 0 }
    const closest = floor0.reduce((best, r) => (
      r.wcx * r.wcx + r.wcz * r.wcz < best.wcx * best.wcx + best.wcz * best.wcz ? r : best
    ))
    return { x: closest.wcx, z: closest.wcz }
  }, [mapData])

  // Meeting circle positions — computed once when meeting starts, stable during meeting
  const MEETING_RADIUS = 4.5
  const meetingPosMap = useMemo<Record<string, { x: number; z: number }>>(() => {
    if (!meetingActive) return {}
    const living = players.filter(p => !p.isSpectator && !p.isEliminated)
    return Object.fromEntries(living.map((p, i) => {
      const angle = (i / living.length) * Math.PI * 2
      return [p.sessionId, {
        x: meetingCenter.x + Math.sin(angle) * MEETING_RADIUS,
        z: meetingCenter.z + Math.cos(angle) * MEETING_RADIUS,
      }]
    }))
  }, [meetingActive, meetingCenter]) // meetingCenter is stable (mapData never changes at runtime)

  // Light switch handler (debounced, called by LocalPlayerController proximity)
  const handleSwitchToggle = useCallback((zone: string) => {
    const now = Date.now()
    if (now - lastToggleRef.current < 400) return
    lastToggleRef.current = now
    setRoomLights(prev => ({ ...prev, [zone]: !prev[zone] }))
  }, [])

  const [nearBodyState, setNearBodyState] = useState<BodyInfo | null>(null)

  // Track floor for rendering: follow spectate target in spectate mode, local floor otherwise
  useFrame(() => {
    let targetFloor = localFloor
    if (spectate && spectateTarget) {
      const target = useGameRoom.getState().players.find(p => p.sessionId === spectateTarget)
      if (target != null) targetFloor = target.floor ?? 0
    }
    if (renderFloor !== targetFloor) setRenderFloor(targetFloor)
  })

  useEffect(() => {
    if (!room) return
    room.onStateChange((state: any) => {
      const gs = useGameRoom.getState()
      gs.setPlayers(
        Array.from((state.players as Map<string, any>).values()).map((p: any) => ({
          sessionId:    p.sessionId,
          name:         p.name,
          x:            p.x      ?? 0,
          z:            p.z      ?? 0,
          floor:        p.floor  ?? 0,
          facing:       p.facing ?? 0,
          role:         p.role   ?? '',
          connected:    p.connected ?? true,
          isBot:        p.isBot        ?? false,
          isEliminated: p.isEliminated ?? false,
          isSpectator:  p.isSpectator  ?? false,
          allHandsLeft: p.allHandsLeft ?? 2,
        }))
      )
      // Sync bodies from server schema
      const bodyList = Array.from((state.bodies as Map<string, any>).values()).map((b: any) => ({
        bodyId: b.bodyId, name: b.name, x: b.x, z: b.z, floor: b.floor,
      }))
      for (const body of bodyList) gs.addBody(body)
    })
    room.onMessage('station_list',  (data: { stations: StationInfo[] }) => useGameRoom.getState().setStations(data.stations))
    room.onMessage('task_complete',  (data: { taskId: TaskId; playerName: string }) => {
      const gs = useGameRoom.getState()
      gs.completeTask(data.taskId)
      gs.addToast({ playerName: data.playerName, taskId: data.taskId, expiresAt: Date.now() + 4000 })
      gs.addIncident(`${data.playerName} completed ${String(data.taskId).replace(/_/g, ' ')}`, 'info')
    })
    room.onMessage('sprint_update', (data: { info: any }) => useGameRoom.getState().setSprint(data.info))
    room.onMessage('body_appeared', (data: { body: BodyInfo }) => useGameRoom.getState().addBody(data.body))
    room.onMessage('body_removed',  (data: { bodyId: string }) => useGameRoom.getState().removeBody(data.bodyId))
    room.onMessage('game_end',      (d: { winner: string; reason: string }) => useGameRoom.getState().setGameEnd(d.winner, d.reason))
    room.onMessage('incident',      (d: { message: string; severity: string; time: string }) => useGameRoom.getState().addIncident(d.message, d.severity as any, d.time))

    // Recovery: if stations were missed (race with game_start), ask the server to resend
    if (useGameRoom.getState().stations.length === 0 && useGameRoom.getState().mapSeed !== '') {
      room.send('request_station_list', {})
    }

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

      {/* Camera: meeting room → spectator follow → spectator free → player follow */}
      {meetingActive  && <MeetingCamera center={meetingCenter} />}
      {!meetingActive && spectate && spectateTarget && <SpectatorFollowCamera targetId={spectateTarget} />}
      {!meetingActive && spectate && !spectateTarget && <OrbitControls enableDamping dampingFactor={0.08} />}
      {!meetingActive && !spectate && <FollowCamera currentFloor={renderFloor} />}

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
        const done      = completedTasks.has(st.taskId as TaskId)
        const hasMyTask = !!myRole && !!st.taskId && (myAssignedTasks?.includes(st.taskId as TaskId) ?? false)
        const isHolding = holdingStationId === st.stationId
        return (
          <Workstation key={st.stationId} station={st} hasMyTask={hasMyTask}
            isHolding={isHolding} isComplete={done} floorY={floorY} />
        )
      })}

      {/* Meeting room table — visible during all-hands */}
      {meetingActive && (
        <group position={[meetingCenter.x, 0, meetingCenter.z]}>
          <MeetingTable />
        </group>
      )}

      {/* Remote players */}
      {players.filter(p => p.sessionId !== mySessionId && !p.isSpectator).map(p => {
        const mPos = meetingActive
          ? (meetingPosMap[p.sessionId] ?? { x: meetingCenter.x, z: meetingCenter.z })
          : undefined
        return (
          <PlayerMesh key={p.sessionId}
            x={mPos ? mPos.x : p.x}
            z={mPos ? mPos.z : p.z}
            floor={meetingActive ? 0 : p.floor}
            facing={p.facing}
            isLocal={false} isEliminated={p.isEliminated}
            name={p.name} isBot={p.isBot}
            speechBubble={speechBubbles[p.sessionId]}
            voteIndicator={voteIndicators[p.sessionId]}
          />
        )
      })}

      {/* Bodies on current floor */}
      {bodies.filter(b => b.floor === renderFloor).map(b => (
        <BodyMarker key={b.bodyId} body={b} floorY={floorY}
          isNear={nearBodyState?.bodyId === b.bodyId} />
      ))}

      {/* Local player — hidden in spectate mode */}
      {!gameOver && !spectate && (
        <LocalPlayerController
          mapData={mapData}
          switchPositions={switchPositions}
          onNearStation={onNearStation}
          onNearSwitch={setNearSwitch}
          onZoneChange={onZoneChange}
          onNearBody={(b) => { setNearBodyState(b); onNearBody(b) }}
        />
      )}
    </>
  )
}

// ── GameWorld (exported) ──────────────────────────────────────────────────────
export interface GameWorldProps {
  onNearStation?:  (st: StationInfo | null) => void
  onNearBody?:     (body: BodyInfo | null) => void
  onZoneChange?:   (zone: string | null) => void
  gameOver?:       boolean
  spectate?:       boolean
  spectateTarget?: string | null
  meetingActive?:  boolean
  speechBubbles?:  Record<string, string>
  voteIndicators?: Record<string, string>
}

export default function GameWorld({
  onNearStation, onNearBody, onZoneChange,
  gameOver = false, spectate = false, spectateTarget = null,
  meetingActive = false, speechBubbles = {}, voteIndicators = {},
}: GameWorldProps) {
  return (
    <Canvas
      shadows
      camera={{ fov: 50, near: 0.1, far: 400, position: [18, 16, 18] }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    >
      <Suspense fallback={null}>
        <Scene
          onNearStation={onNearStation ?? (() => {})}
          onNearBody={onNearBody ?? (() => {})}
          onZoneChange={onZoneChange ?? (() => {})}
          gameOver={gameOver}
          spectate={spectate}
          spectateTarget={spectateTarget}
          meetingActive={meetingActive}
          speechBubbles={speechBubbles}
          voteIndicators={voteIndicators}
        />
      </Suspense>
    </Canvas>
  )
}
