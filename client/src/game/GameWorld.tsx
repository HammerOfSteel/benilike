import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useGameRoom } from '../store/useGameRoom'
import { useKeyboard } from './useKeyboard'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROOM_HALF    = 11.5      // outer bound for main office (wall at ±12)
const ROOM_HALF_Z_N = 15.5    // north bound (server room back wall at -16)
const ROOM_HALF_Z_S = 9.0     // south bound
const SPEED        = 6.0       // units per second
const SEND_MS      = 100       // how often to send position to server
const TERMINAL_X   = 0
const TERMINAL_Z   = -11.5     // centre of server room
const INTERACT_R   = 2.5       // interact radius

// ── Room ──────────────────────────────────────────────────────────────────────
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
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

function Desk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial color="#3a3a52" />
      </mesh>
      {[[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.2, lz]}>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshStandardMaterial color="#2a2a3e" />
        </mesh>
      ))}
      <mesh position={[0, 0.72, -0.28]}>
        <boxGeometry args={[0.72, 0.44, 0.05]} />
        <meshStandardMaterial color="#0e0e1c" emissive="#4ADE80" emissiveIntensity={0.04} />
      </mesh>
    </group>
  )
}

function Terminal({ progress }: { progress: number }) {
  const bodyRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (!bodyRef.current || !lightRef.current) return
    const mat = bodyRef.current.material as THREE.MeshStandardMaterial
    const pulse = 0.25 + Math.sin(clock.elapsedTime * 3) * 0.08
    // Tint towards red when progress is low
    const g = progress / 100
    mat.emissive.setRGB(1 - g, g, g * 0.3)
    mat.emissiveIntensity = pulse
    lightRef.current.intensity = pulse * 3
    lightRef.current.color.setRGB(1 - g, g, g * 0.3)
  })

  return (
    <group position={[TERMINAL_X, 0, TERMINAL_Z]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.2, 0.12, 0.7]} />
        <meshStandardMaterial color="#2a2a3e" />
      </mesh>
      <mesh ref={bodyRef} position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.7, 1.5, 0.35]} />
        <meshStandardMaterial color="#0e0e1c" emissive={new THREE.Color(0, 1, 0.3)} emissiveIntensity={0.25} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.9, 0.5]} distance={5} intensity={1} />
    </group>
  )
}

function ServerRoom({ progress }: { progress: number }) {
  // Raised floor platform for server room (z: -9 to -14, slightly elevated)
  return (
    <group>
      {/* Raised floor */}
      <mesh position={[0, 0.12, -11.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 9]} />
        <meshStandardMaterial color="#0d0d1c" />
      </mesh>
      {/* Floor edge step */}
      <mesh position={[0, 0.06, -7.2]}>
        <boxGeometry args={[14, 0.12, 0.3]} />
        <meshStandardMaterial color="#1e1e30" />
      </mesh>
      {/* Server racks — left side */}
      <mesh position={[-5.5, 1.1, -14.5]} castShadow>
        <boxGeometry args={[1.2, 2.2, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[-3.5, 1.1, -14.5]} castShadow>
        <boxGeometry args={[1.2, 2.2, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Server racks — right side */}
      <mesh position={[ 5.5, 1.1, -14.5]} castShadow>
        <boxGeometry args={[1.2, 2.2, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[ 3.5, 1.1, -14.5]} castShadow>
        <boxGeometry args={[1.2, 2.2, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Blinking indicator lights on racks */}
      <mesh position={[-5.5, 1.8, -14.02]}>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-3.5, 1.8, -14.02]}>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={2} />
      </mesh>
      <mesh position={[ 5.5, 1.8, -14.02]}>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={2} />
      </mesh>
      {/* Railing posts (left and right of doorway, with gap in centre) */}
      <mesh position={[-5, 1, -7.6]}>
        <boxGeometry args={[0.12, 2, 0.12]} />
        <meshStandardMaterial color="#3a3a52" />
      </mesh>
      <mesh position={[-2, 1, -7.6]}>
        <boxGeometry args={[0.12, 2, 0.12]} />
        <meshStandardMaterial color="#3a3a52" />
      </mesh>
      <mesh position={[ 2, 1, -7.6]}>
        <boxGeometry args={[0.12, 2, 0.12]} />
        <meshStandardMaterial color="#3a3a52" />
      </mesh>
      <mesh position={[ 5, 1, -7.6]}>
        <boxGeometry args={[0.12, 2, 0.12]} />
        <meshStandardMaterial color="#3a3a52" />
      </mesh>
      {/* Railing bars */}
      <mesh position={[-3.5, 1.5, -7.6]}>
        <boxGeometry args={[3, 0.08, 0.08]} />
        <meshStandardMaterial color="#3a3a52" />
      </mesh>
      <mesh position={[ 3.5, 1.5, -7.6]}>
        <boxGeometry args={[3, 0.08, 0.08]} />
        <meshStandardMaterial color="#3a3a52" />
      </mesh>
      {/* "SERVER ROOM" sign above entrance */}
      <mesh position={[0, 2.6, -7.6]}>
        <boxGeometry args={[2.2, 0.4, 0.08]} />
        <meshStandardMaterial color="#6D28D9" emissive="#6D28D9" emissiveIntensity={0.5} />
      </mesh>
      {/* Ambient light for server room */}
      <pointLight position={[0, 2.5, -11.5]} distance={9} intensity={0.8} color="#8060ff" />
      <Terminal progress={progress} />
    </group>
  )
}

function OfficeDungeon({ progress }: { progress: number }) {
  return (
    <group>
      {/* Main office floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial color="#141420" />
      </mesh>

      {/* Outer walls — main office area (z: -7 to +9, x: -12 to +12) */}
      <Wall pos={[ 0,  1.5,  9.25]} sz={[24, 3, 0.5]} />   {/* South */}
      <Wall pos={[-12, 1.5,  1.0]}  sz={[0.5, 3, 16.5]} /> {/* West main */}
      <Wall pos={[ 12, 1.5,  1.0]}  sz={[0.5, 3, 16.5]} /> {/* East main */}

      {/* North divider wall — with a 4-unit opening in centre for server room */}
      <Wall pos={[-6.5, 1.5, -7]} sz={[9, 3, 0.5]} />   {/* Left of gap */}
      <Wall pos={[ 6.5, 1.5, -7]} sz={[9, 3, 0.5]} />   {/* Right of gap */}

      {/* Server room outer walls */}
      <Wall pos={[ 0,  1.5, -16]} sz={[16, 3, 0.5]} />  {/* North */}
      <Wall pos={[-8,  1.5, -11.5]} sz={[0.5, 3, 9]} /> {/* West */}
      <Wall pos={[ 8,  1.5, -11.5]} sz={[0.5, 3, 9]} /> {/* East */}

      {/* Desks — main floor */}
      <Desk position={[-6, 0, -4]} />
      <Desk position={[-2, 0, -4]} />
      <Desk position={[ 2, 0, -4]} />
      <Desk position={[ 6, 0, -4]} />
      <Desk position={[-6, 0,  0]} />
      <Desk position={[-2, 0,  0]} />
      <Desk position={[ 2, 0,  0]} />
      <Desk position={[ 6, 0,  0]} />
      <Desk position={[-5, 0,  5]} />
      <Desk position={[ 0, 0,  5]} />
      <Desk position={[ 5, 0,  5]} />

      <ServerRoom progress={progress} />
    </group>
  )
}

// ── Players ───────────────────────────────────────────────────────────────────
interface PlayerProps {
  x: number; z: number; facing: number
  faction: string; isLocal: boolean
}

function PlayerMesh({ x, z, facing, faction, isLocal }: PlayerProps) {
  const meshRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(x, 0, z)
      meshRef.current.rotation.y = facing
    }
  })

  const color = isLocal
    ? '#6D28D9'
    : faction === 'opposition' ? '#ef4444' : '#3b82f6'

  return (
    <group ref={meshRef}>
      {/* Body */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.8, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Facing dot */}
      <mesh position={[0, 1.25, 0.3]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

// ── Follow Camera ─────────────────────────────────────────────────────────────
const CAM_TARGET  = new THREE.Vector3()
const CAM_DESIRED = new THREE.Vector3()
const localPos    = new THREE.Vector3(0, 0, 6)  // shared between controller + camera

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
interface ControllerProps {
  faction:         string
  onNearTerminal:  (v: boolean) => void
  onInteracting:   (v: boolean) => void
}

function LocalPlayerController({ faction, onNearTerminal, onInteracting }: ControllerProps) {
  const keys         = useKeyboard()
  const facingRef    = useRef(0)
  const lastSent     = useRef(0)
  const isInteract   = useRef(false)
  const groupRef     = useRef<THREE.Group>(null)

  // Reset position each time this component mounts (new game session)
  useEffect(() => {
    localPos.set(0, 0, 6)
    return () => { localPos.set(0, 0, 6) }
  }, [])

  useFrame((_, delta) => {
    const k  = keys.current
    let dx = 0, dz = 0

    if (k['KeyW'] || k['ArrowUp'])    dz -= 1
    if (k['KeyS'] || k['ArrowDown'])  dz += 1
    if (k['KeyA'] || k['ArrowLeft'])  dx -= 1
    if (k['KeyD'] || k['ArrowRight']) dx += 1

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz)
      dx /= len; dz /= len
      localPos.x = Math.max(-ROOM_HALF, Math.min(ROOM_HALF, localPos.x + dx * SPEED * delta))
      localPos.z = Math.max(-ROOM_HALF_Z_N, Math.min(ROOM_HALF_Z_S, localPos.z + dz * SPEED * delta))
      facingRef.current = Math.atan2(dx, dz)
    }

    // Move mesh directly — avoids stale prop closure issue
    if (groupRef.current) {
      groupRef.current.position.set(localPos.x, 0, localPos.z)
      groupRef.current.rotation.y = facingRef.current
    }

    // Proximity to terminal
    const dx2 = localPos.x - TERMINAL_X
    const dz2 = localPos.z - TERMINAL_Z
    const nearTerminal = Math.sqrt(dx2 * dx2 + dz2 * dz2) < INTERACT_R
    onNearTerminal(nearTerminal)

    // E key interaction
    const wantsInteract = nearTerminal && !!k['KeyE']
    if (wantsInteract !== isInteract.current) {
      isInteract.current = wantsInteract
      onInteracting(wantsInteract)
      useGameRoom.getState().room?.send(wantsInteract ? 'task_start' : 'task_stop', {})
    }

    // Throttled position send
    const now = performance.now()
    if (now - lastSent.current > SEND_MS) {
      useGameRoom.getState().room?.send('move', { x: localPos.x, z: localPos.z, facing: facingRef.current })
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
interface SceneProps {
  onNearTerminal: (v: boolean) => void
  onInteracting:  (v: boolean) => void
  gameOver:       boolean
}

function Scene({ onNearTerminal, onInteracting, gameOver }: SceneProps) {
  const { players, myFaction, room, terminalProgress } = useGameRoom()

  // Sync server state → store while in game
  useEffect(() => {
    if (!room) return
    const unsub = room.onStateChange((state: any) => {
      const gs = useGameRoom.getState()
      gs.setPlayers(
        Array.from((state.players as Map<string, any>).values()).map((p: any) => ({
          sessionId: p.sessionId,
          name:      p.name,
          x:         p.x   ?? 0,
          z:         p.z   ?? 0,
          facing:    p.facing ?? 0,
          faction:   p.faction ?? '',
          role:      p.role ?? '',
          connected: p.connected,
          isBot:     p.isBot ?? false,
        }))
      )
      gs.setTerminalProgress(state.terminalProgress ?? 50)
    })

    room.onMessage('game_end', (data: { winner: string; reason: string }) => {
      useGameRoom.getState().setGameEnd(data.winner, data.reason)
    })

    return () => { if (typeof unsub === 'function') unsub() }
  }, [room])

  const mySessionId = room?.sessionId

  return (
    <>
      <ambientLight intensity={0.35} color="#8080cc" />
      <directionalLight position={[8, 14, 8]} intensity={0.9} castShadow
        shadow-mapSize={[1024, 1024]} />

      <FollowCamera />

      <OfficeDungeon progress={terminalProgress} />

      {/* Remote players (and bots) */}
      {players
        .filter(p => p.sessionId !== mySessionId)
        .map(p => (
          <PlayerMesh
            key={p.sessionId}
            x={p.x} z={p.z} facing={p.facing}
            faction={p.faction}
            isLocal={false}
          />
        ))
      }

      {/* Local player */}
      {!gameOver && (
        <LocalPlayerController
          faction={myFaction ?? 'workforce'}
          onNearTerminal={onNearTerminal}
          onInteracting={onInteracting}
        />
      )}
    </>
  )
}

// ── GameWorld component (exported) ────────────────────────────────────────────
export interface GameWorldProps {
  onNearTerminal: (v: boolean) => void
  onInteracting:  (v: boolean) => void
  gameOver:       boolean
}

export default function GameWorld({ onNearTerminal, onInteracting, gameOver }: GameWorldProps) {
  return (
    <Canvas shadows camera={{ fov: 50, near: 0.1, far: 300, position: [16, 14, 22] }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Scene onNearTerminal={onNearTerminal} onInteracting={onInteracting} gameOver={gameOver} />
    </Canvas>
  )
}
