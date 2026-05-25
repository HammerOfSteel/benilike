import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useGameRoom } from '../store/useGameRoom'
import { useKeyboard } from './useKeyboard'
import { TASK_DEFS } from '@shared/tasks'
import type { StationInfo, TaskId } from '@shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROOM_HALF     = 11.5
const ROOM_HALF_Z_N = 15.5
const ROOM_HALF_Z_S = 9.0
const SPEED         = 6.0
const SEND_MS       = 100
const INTERACT_R    = 2.5

// ── Shared position (module-level, avoids stale closures) ────────────────────
const localPos = new THREE.Vector3(0, 0, 6)

// ── Room pieces ───────────────────────────────────────────────────────────────
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[24, 20]} />
      <meshStandardMaterial color="#141420" />
    </mesh>
  )
}

function Wall({ pos, sz }: { pos: [number, number, number]; sz: [number, number, number] }) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={sz} />
      <meshStandardMaterial color="#252538" />
    </mesh>
  )
}

// ── Workstation (glowing task desk) ──────────────────────────────────────────
function Workstation({ station, hasMyTask, isHolding, isComplete }: {
  station: StationInfo
  hasMyTask: boolean
  isHolding: boolean
  isComplete: boolean
}) {
  const color     = isComplete ? '#4ade80' : hasMyTask ? '#f59e0b' : '#3a3a52'
  const emissive  = isComplete ? '#4ade80' : hasMyTask ? '#f59e0b' : '#1a1a2e'
  const emInt     = isHolding ? 2.0 : hasMyTask ? 0.6 : 0.08

  return (
    <group position={[station.x, 0, station.z]}>
      {/* Desk surface */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emInt} />
      </mesh>
      {/* Legs */}
      {([[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.2, lz]}>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshStandardMaterial color="#2a2a3e" />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 0.72, -0.28]}>
        <boxGeometry args={[0.7, 0.45, 0.04]} />
        <meshStandardMaterial color="#0f0f23" emissive={emissive} emissiveIntensity={emInt * 0.5} />
      </mesh>
      {/* Amber/green glow ring when player has task here */}
      {hasMyTask && !isComplete && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.3, 32]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={isHolding ? 3 : 1} transparent opacity={0.55} />
        </mesh>
      )}
      {isComplete && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.3, 32]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={0.8} transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  )
}

// ── Server room (racks + ambient, no terminal) ────────────────────────────────
function ServerRoom() {
  return (
    <group>
      <mesh position={[0, 0.12, -11.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#0d0d1c" />
      </mesh>
      <mesh position={[0, 0.06, -7.2]}>
        <boxGeometry args={[16, 0.12, 0.3]} />
        <meshStandardMaterial color="#1e1e30" />
      </mesh>
      {/* Server racks */}
      {([-5.5, -3.5, 3.5, 5.5] as number[]).map((rx, i) => (
        <group key={i}>
          <mesh position={[rx, 1.1, -14.5]} castShadow>
            <boxGeometry args={[1.2, 2.2, 1]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>
          <mesh position={[rx, 1.8, -14.02]}>
            <boxGeometry args={[0.08, 0.08, 0.05]} />
            <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
      {/* Railing */}
      {([-5, -2, 2, 5] as number[]).map((rx, i) => (
        <mesh key={i} position={[rx, 1, -7.6]}>
          <boxGeometry args={[0.12, 2, 0.12]} />
          <meshStandardMaterial color="#3a3a52" />
        </mesh>
      ))}
      <mesh position={[-3.5, 1.5, -7.6]}><boxGeometry args={[3, 0.08, 0.08]} /><meshStandardMaterial color="#3a3a52" /></mesh>
      <mesh position={[ 3.5, 1.5, -7.6]}><boxGeometry args={[3, 0.08, 0.08]} /><meshStandardMaterial color="#3a3a52" /></mesh>
      {/* Sign */}
      <mesh position={[0, 2.6, -7.6]}>
        <boxGeometry args={[2.2, 0.4, 0.08]} />
        <meshStandardMaterial color="#6D28D9" emissive="#6D28D9" emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 2.5, -11.5]} distance={9} intensity={0.8} color="#8060ff" />
    </group>
  )
}

function OfficeDungeon({ lockdown }: { lockdown: boolean }) {
  return (
    <group>
      <Floor />
      {/* Outer walls */}
      <Wall pos={[ 0,  1.5,  9.25]} sz={[24, 3, 0.5]} />
      <Wall pos={[ 12, 1.5,  1.0]}  sz={[0.5, 3, 16.5]} />

      {/* West main wall — two segments with gap at z=-5 to z=+1 for Network Closet */}
      <Wall pos={[-12, 1.5,  5.5]}  sz={[0.5, 3, 7.5]} />  {/* south segment */}
      <Wall pos={[-12, 1.5, -6.5]}  sz={[0.5, 3, 3.0]} />  {/* north segment  */}

      {/* North divider — gap in centre for server room */}
      <Wall pos={[-6.5, 1.5, -7]} sz={[9, 3, 0.5]} />
      <Wall pos={[ 6.5, 1.5, -7]} sz={[9, 3, 0.5]} />

      {/* Server room outer walls */}
      <Wall pos={[ 0,  1.5, -16]}   sz={[16, 3, 0.5]} />
      <Wall pos={[-8,  1.5, -11.5]} sz={[0.5, 3, 9]} />
      <Wall pos={[ 8,  1.5, -11.5]} sz={[0.5, 3, 9]} />

      {/* Network Closet walls (x: -12 to -8, z: -5 to +1) */}
      <Wall pos={[-10, 1.5, -5.25]} sz={[4, 3, 0.5]} />   {/* north wall  */}
      <Wall pos={[-10, 1.5,  0.75]} sz={[4, 3, 0.5]} />   {/* south wall  */}
      {/* Closet sign */}
      <mesh position={[-9, 2.5, -5.0]}>
        <boxGeometry args={[1.6, 0.3, 0.06]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.4} />
      </mesh>
      <pointLight position={[-10, 2, -2.5]} distance={5} intensity={0.4} color="#38bdf8" />

      {/* Lockdown barrier */}
      {lockdown && (
        <mesh position={[0, 1.5, -7.1]}>
          <boxGeometry args={[4, 3, 0.1]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} transparent opacity={0.35} />
        </mesh>
      )}

      <ServerRoom />
    </group>
  )
}

// ── Players ───────────────────────────────────────────────────────────────────
function PlayerMesh({ x, z, facing, faction, isLocal, disguised }: {
  x: number; z: number; facing: number
  faction: string; isLocal: boolean; disguised?: boolean
}) {
  const meshRef = useRef<THREE.Group>(null)
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(x, 0, z)
      meshRef.current.rotation.y = facing
    }
  })
  const effectiveFaction = (!isLocal && disguised) ? 'workforce' : faction
  const color = isLocal ? '#6D28D9' : effectiveFaction === 'opposition' ? '#ef4444' : '#3b82f6'
  return (
    <group ref={meshRef}>
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
const CAM_TARGET  = new THREE.Vector3()

function FollowCamera() {
  const { camera } = useThree()
  useFrame(() => {
    CAM_TARGET.set(localPos.x, 0, localPos.z)
    CAM_DESIRED.set(localPos.x + 14, 12, localPos.z + 14)
    camera.position.lerp(CAM_DESIRED, 0.1)
    camera.lookAt(CAM_TARGET)
  })
  return null
}

// ── Local Player Controller ───────────────────────────────────────────────────
function LocalPlayerController({ faction, onNearStation }: {
  faction: string
  onNearStation: (st: StationInfo | null) => void
}) {
  const keys      = useKeyboard()
  const facingRef = useRef(0)
  const lastSent  = useRef(0)
  const groupRef  = useRef<THREE.Group>(null)

  useEffect(() => {
    localPos.set(0, 0, 6)
    return () => { localPos.set(0, 0, 6) }
  }, [])

  useFrame((_, delta) => {
    const k = keys.current
    let dx = 0, dz = 0

    if (k['KeyW'] || k['ArrowUp'])    dz -= 1
    if (k['KeyS'] || k['ArrowDown'])  dz += 1
    if (k['KeyA'] || k['ArrowLeft'])  dx -= 1
    if (k['KeyD'] || k['ArrowRight']) dx += 1

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz)
      dx /= len; dz /= len
      const gs = useGameRoom.getState()
      const speedMult = (faction === 'workforce' && gs.activeEffects.workforceSpeedActive) ? 1.3 : 1.0
      localPos.x = Math.max(-ROOM_HALF,     Math.min(ROOM_HALF,     localPos.x + dx * SPEED * speedMult * delta))
      localPos.z = Math.max(-ROOM_HALF_Z_N, Math.min(ROOM_HALF_Z_S, localPos.z + dz * SPEED * speedMult * delta))
      facingRef.current = Math.atan2(dx, dz)
    }

    if (groupRef.current) {
      groupRef.current.position.set(localPos.x, 0, localPos.z)
      groupRef.current.rotation.y = facingRef.current
    }

    // Station proximity
    const gs = useGameRoom.getState()
    const myRole = gs.myRole
    const nearStation = gs.stations.find(st => {
      if (!st.taskId) return false
      const sx = localPos.x - st.x
      const sz = localPos.z - st.z
      return Math.sqrt(sx * sx + sz * sz) < INTERACT_R
    }) ?? null

    onNearStation(nearStation)

    // Hold-E station interaction
    const wantsHold = nearStation && !!k['KeyE']
    const currentHold = gs.holdingStationId

    if (wantsHold && nearStation && currentHold !== nearStation.stationId) {
      const taskDef = TASK_DEFS.find(t => t.id === nearStation.taskId && t.role === myRole)
      if (taskDef && !gs.completedTasks.has(nearStation.taskId as TaskId)) {
        gs.setHolding(nearStation.stationId)
        gs.room?.send('task_hold_start', { stationId: nearStation.stationId })
      }
    } else if (!wantsHold && currentHold) {
      gs.setHolding(null)
      gs.room?.send('task_hold_cancel', {})
    }

    // Throttled position send
    const now = performance.now()
    if (now - lastSent.current > SEND_MS) {
      gs.room?.send('move', { x: localPos.x, z: localPos.z, facing: facingRef.current })
      lastSent.current = now
    }
  })

  const color = faction === 'opposition' ? '#ef4444' : '#6D28D9'
  return (
    <group ref={groupRef} position={[0, 0, 6]}>
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

// ── Scene root ────────────────────────────────────────────────────────────────
function Scene({ onNearStation, gameOver }: {
  onNearStation: (st: StationInfo | null) => void
  gameOver:      boolean
}) {
  const { players, myFaction, room, activeEffects, stations, completedTasks, holdingStationId } = useGameRoom()

  useEffect(() => {
    if (!room) return

    const unsub = room.onStateChange((state: any) => {
      const gs = useGameRoom.getState()
      gs.setPlayers(
        Array.from((state.players as Map<string, any>).values()).map((p: any) => ({
          sessionId: p.sessionId,
          name:      p.name,
          x:         p.x      ?? 0,
          z:         p.z      ?? 0,
          facing:    p.facing  ?? 0,
          faction:   p.faction ?? '',
          role:      p.role    ?? '',
          connected: p.connected,
          isBot:     p.isBot   ?? false,
          disguised: p.disguised ?? false,
          slowed:    p.slowed    ?? false,
        }))
      )
      if (state.lockdownActive !== undefined) {
        const curr = gs.activeEffects
        if (curr.lockdownActive !== !!state.lockdownActive) {
          gs.setActiveEffects({ ...curr, lockdownActive: !!state.lockdownActive })
        }
      }
    })

    room.onMessage('station_list', (data: { stations: StationInfo[] }) => {
      useGameRoom.getState().setStations(data.stations)
    })

    room.onMessage('task_complete', (data: { taskId: TaskId; role: string; effectDesc: string; meterGain: number }) => {
      const gs = useGameRoom.getState()
      gs.completeTask(data.taskId)
      gs.addToast({ role: data.role, effectDesc: data.effectDesc, meterGain: data.meterGain, expiresAt: Date.now() + 4000 })
      gs.addIncident(`${data.role.replace('_', ' ')}: ${data.effectDesc}`, 'info')
    })

    room.onMessage('meter_update', (data: { workforce: number; opposition: number }) => {
      useGameRoom.getState().setMeters(data.workforce, data.opposition)
    })

    room.onMessage('monitor_snapshot', (data: { rackA: number; rackB: number; rackC: number }) => {
      useGameRoom.getState().setMonitorSnapshot(data)
    })

    room.onMessage('effect_update', (data: any) => {
      useGameRoom.getState().setActiveEffects(data)
    })

    room.onMessage('game_end', (data: { winner: string; reason: string }) => {
      useGameRoom.getState().setGameEnd(data.winner, data.reason)
    })

    room.onMessage('incident', (data: { message: string; severity: string; time: string }) => {
      useGameRoom.getState().addIncident(data.message, (data.severity as any) ?? 'info', data.time)
    })

    return () => { if (typeof unsub === 'function') unsub() }
  }, [room])

  const myRole       = useGameRoom(s => s.myRole)
  const mySessionId  = room?.sessionId

  return (
    <>
      <ambientLight intensity={0.35} color="#8080cc" />
      <directionalLight position={[8, 14, 8]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} />

      <FollowCamera />

      <OfficeDungeon lockdown={activeEffects.lockdownActive} />

      {/* Workstations */}
      {stations.map(st => {
        const hasMyTask = !!myRole && !!st.taskId && TASK_DEFS.some(t => t.id === st.taskId && t.role === myRole)
        const isHolding = holdingStationId === st.stationId
        const isComplete = !!st.taskId && completedTasks.has(st.taskId)
        return (
          <Workstation key={st.stationId} station={st} hasMyTask={hasMyTask} isHolding={isHolding} isComplete={isComplete} />
        )
      })}

      {/* Remote players */}
      {players.filter(p => p.sessionId !== mySessionId).map(p => (
        <PlayerMesh
          key={p.sessionId}
          x={p.x} z={p.z} facing={p.facing}
          faction={p.faction} isLocal={false} disguised={p.disguised}
        />
      ))}

      {/* Local player */}
      {!gameOver && (
        <LocalPlayerController
          faction={myFaction ?? 'workforce'}
          onNearStation={onNearStation}
        />
      )}
    </>
  )
}

// ── GameWorld (exported) ──────────────────────────────────────────────────────
export interface GameWorldProps {
  onNearStation: (st: StationInfo | null) => void
  gameOver?:     boolean
}

export default function GameWorld({ onNearStation, gameOver = false }: GameWorldProps) {
  return (
    <Canvas shadows camera={{ fov: 50, near: 0.1, far: 300, position: [16, 14, 22] }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Scene onNearStation={onNearStation} gameOver={gameOver} />
    </Canvas>
  )
}
