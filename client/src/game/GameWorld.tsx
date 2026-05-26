import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, useGLTF } from '@react-three/drei'
import { useRef, useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
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

// ── KayKit animated character models ─────────────────────────────────────────
const KAYKIT_CHARS = [
  '/models/kaykit/Barbarian.glb',
  '/models/kaykit/Knight.glb',
  '/models/kaykit/Mage.glb',
  '/models/kaykit/Ranger.glb',
  '/models/kaykit/Rogue.glb',
  '/models/kaykit/Rogue_Hooded.glb',
]
const ANIM_MOVEMENT = '/models/kaykit/Rig_Medium_MovementBasic.glb'
const ANIM_GENERAL  = '/models/kaykit/Rig_Medium_General.glb'
KAYKIT_CHARS.forEach(p => useGLTF.preload(p))
useGLTF.preload(ANIM_MOVEMENT)
useGLTF.preload(ANIM_GENERAL)
useGLTF.preload('/models/Office_Desk_1.glb')
useGLTF.preload('/models/Chair_A.glb')
useGLTF.preload('/models/Computer_Monitor.glb')
useGLTF.preload('/models/Bookshelf.glb')

function charIndex(name: string): number {
  let h = 0
  for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return Math.abs(h) % KAYKIT_CHARS.length
}

// KayKit uses dotted bone names ("lowerarm.l") which Three.js PropertyBinding
// splits incorrectly. Fix: rename dots in bones + match track names.
function fixKayKitClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.map(track => {
    const lastDot  = track.name.lastIndexOf('.')
    if (lastDot === -1) return track
    const boneName = track.name.slice(0, lastDot).replace(/\./g, '_') // "lowerarm_l"
    const prop     = track.name.slice(lastDot + 1)                    // "quaternion"
    const TC       = track.constructor as any
    return new TC(boneName + '.' + prop, track.times, track.values, track.getInterpolation())
  })
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

// KayKit animated character: loads character GLB + retargets animation rig clips
// movingRef drives the idle↔walk transition without triggering React re-renders
function KayKitCharacter({
  name, opacity = 1, movingRef,
}: {
  name: string
  opacity?: number
  movingRef: React.MutableRefObject<boolean>
}) {
  const { scene: charScene }      = useGLTF(KAYKIT_CHARS[charIndex(name)])
  const { animations: moveAnims } = useGLTF(ANIM_MOVEMENT)
  const { animations: genAnims  } = useGLTF(ANIM_GENERAL)

  // Fix animation clips once per unique animation set (useGLTF caches the originals)
  const fixedMoveAnims = useMemo(() => moveAnims.map(fixKayKitClip), [moveAnims])
  const fixedGenAnims  = useMemo(() => genAnims.map(fixKayKitClip),  [genAnims])

  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(charScene) as THREE.Group
    // Rename bones to match fixed track names ("lowerarm.l" → "lowerarm_l")
    c.traverse(obj => { if (obj.name.includes('.')) obj.name = obj.name.replace(/\./g, '_') })
    if (opacity < 1) {
      c.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mesh.material = mats.map(m => {
            const n = (m as THREE.Material).clone() as THREE.MeshStandardMaterial
            n.transparent = true; n.opacity = opacity
            return n
          }) as any
        }
      })
    }
    return c
  }, [charScene, opacity])

  const mixerRef    = useRef<THREE.AnimationMixer | null>(null)
  const actionsRef  = useRef<Record<string, THREE.AnimationAction>>({})
  const currentAnim = useRef('Idle_A')

  // Create mixer directly on clone after it's ready — avoids null-root timing issue with useAnimations
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clone)
    mixerRef.current = mixer
    const acts: Record<string, THREE.AnimationAction> = {}
    for (const clip of [...fixedMoveAnims, ...fixedGenAnims]) {
      acts[clip.name] = mixer.clipAction(clip)
    }
    actionsRef.current = acts
    acts['Idle_A']?.reset().play()
    currentAnim.current = 'Idle_A'
    return () => { mixer.stopAllAction() }
  }, [clone, fixedMoveAnims, fixedGenAnims])

  useFrame((_, delta) => {
    mixerRef.current?.update(delta)
    const target = movingRef.current ? 'Walking_A' : 'Idle_A'
    if (target !== currentAnim.current && actionsRef.current[target]) {
      actionsRef.current[currentAnim.current]?.fadeOut(0.2)
      actionsRef.current[target]!.reset().fadeIn(0.2).play()
      currentAnim.current = target
    }
  })

  return <primitive object={clone} />
}

// ── Grid renderer (InstancedMesh per floor) ───────────────────────────────────

const _m4 = new THREE.Matrix4()

function GridLayer({
  grid, gridW, gridH, floorY, spectate,
}: {
  grid: Map<string, 0 | 1>; gridW: number; gridH: number; floorY: number; spectate?: boolean
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
        <meshStandardMaterial color="#d6d0c0" roughness={0.85}
          transparent={spectate} opacity={spectate ? 0.18 : 1} depthWrite={!spectate} />
      </instancedMesh>
      <instancedMesh ref={floorRef} args={[undefined, undefined, floorMats.length]} receiveShadow>
        <boxGeometry args={[CELL_SIZE, 0.12, CELL_SIZE]} />
        <meshStandardMaterial color="#6e685a" roughness={0.9} />
      </instancedMesh>
    </group>
  )
}

// ── Zone accent overlays ──────────────────────────────────────────────────────
// Zone floor-overlay colours — natural office tones (greens, creams, taupes)
const ZONE_COLORS: Record<string, string> = {
  main_office:    '#cdc8b8',  // warm cream carpet
  server_room:    '#8ea8b2',  // cool grey-blue concrete
  network_closet: '#8c9498',  // utility grey
  hr_corner:      '#b8a090',  // warm taupe
  devops_den:     '#7a9878',  // sage green
  finance_floor:  '#a89e78',  // warm wheat
  marketing_hub:  '#a88090',  // dusty mauve
  exec_suite:     '#8898b0',  // muted slate blue
}
// Zone ceiling-light tint colours
const ZONE_LIGHT_COLORS: Record<string, string> = {
  main_office:    '#fffef0',  // neutral warm white
  server_room:    '#b0d8f8',  // cool blue glow
  network_closet: '#c8e0f0',  // cool grey-blue
  hr_corner:      '#ffe8d0',  // warm friendly
  devops_den:     '#d0f0d0',  // soft green
  finance_floor:  '#fff0c8',  // warm amber
  marketing_hub:  '#ffe0f0',  // soft pink
  exec_suite:     '#e0ecff',  // prestige blue
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
            <meshStandardMaterial color={ZONE_COLORS[room.zone ?? ''] ?? '#c0bba8'} roughness={0.9} />
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
  const floorY = floor * FLOOR_HEIGHT
  const ceilY  = floorY + WALL_HEIGHT
  return (
    <>
      {mapData.rooms.filter(r => r.floor === floor).map((room, i) => {
        const isOn   = lights[room.zone ?? ''] !== false
        const lcolor = ZONE_LIGHT_COLORS[room.zone ?? ''] ?? '#e8e0ff'
        const rw     = room.wx2 - room.wx1
        const rd     = room.wz2 - room.wz1
        // Fluorescent tube layout: tubes run along Z, spaced across X
        const tubeLen   = Math.min(rd - 1, 5)
        const numTubes  = Math.max(1, Math.floor((rw - 1) / 3.5))
        const tubeSpan  = Math.min(rw - 1.5, (numTubes - 1) * 3.2)
        const tubes = Array.from({ length: numTubes }, (_, t) => {
          const tx = numTubes > 1 ? -tubeSpan / 2 + t * (tubeSpan / (numTubes - 1)) : 0
          return tx
        })
        return (
          <group key={i} position={[room.wcx, ceilY, room.wcz]}>
            {/* Bright white fluorescent tubes — no housing panel (avoids opaque box from spectator view) */}
            {tubes.map((tx, ti) => (
              <mesh key={ti} position={[tx, -0.03, 0]}>
                <boxGeometry args={[0.10, 0.04, tubeLen * 0.9]} />
                <meshStandardMaterial
                  color="#fffef0"
                  emissive="#fffef0"
                  emissiveIntensity={isOn ? 5 : 0}
                />
              </mesh>
            ))}
            {/* Point lights below fixture */}
            {isOn && tubes.map((tx, ti) => (
              <pointLight
                key={ti}
                position={[tx, -1.0, 0]}
                intensity={5 / numTubes}
                distance={22}
                decay={2}
                color={lcolor}
                castShadow={false}
              />
            ))}
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

// ── Procedural office plant ────────────────────────────────────────────────────
function OfficePlant({ x, z, floorY, seed = 0 }: { x: number; z: number; floorY: number; seed?: number }) {
  const potH    = 0.35 + (seed % 3) * 0.07
  const foliageR = 0.38 + (seed % 5) * 0.06
  const green   = ['#4a7c59', '#5a8c3c', '#3d6e4e', '#6a9e4c'][seed % 4]
  return (
    <group position={[x, floorY, z]}>
      {/* terracotta pot */}
      <mesh position={[0, potH / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.13, potH, 10]} />
        <meshStandardMaterial color="#b5623a" roughness={0.85} />
      </mesh>
      {/* soil top */}
      <mesh position={[0, potH + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.17, 10]} />
        <meshStandardMaterial color="#3b2516" roughness={1} />
      </mesh>
      {/* foliage — 3 overlapping spheres for a bushy look */}
      {[0, 1.1, 2.2].map((ang, i) => (
        <mesh key={i}
          position={[
            Math.cos(ang * 2) * foliageR * 0.35,
            potH + foliageR * 0.7 + i * 0.12,
            Math.sin(ang * 2) * foliageR * 0.28,
          ]}
        >
          <sphereGeometry args={[foliageR * (0.8 + i * 0.12), 8, 6]} />
          <meshStandardMaterial color={green} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// ── Room decoration (bookshelves, file cabinets, coffee machines, printers, plants) ──
useGLTF.preload('/models/Bookshelf.glb')
useGLTF.preload('/models/FileCabinet_Standard.glb')
useGLTF.preload('/models/CoffeeMachine.glb')
useGLTF.preload('/models/CoffeeTable.glb')
useGLTF.preload('/models/Printer.glb')

// Zones that get a coffee machine / printer break area
const COFFEE_ZONES = new Set(['main_office', 'hr_corner', 'exec_suite', 'marketing_hub'])
const PRINTER_ZONES = new Set(['main_office', 'finance_floor', 'hr_corner'])

function RoomDecoration({ mapData, floor }: { mapData: MapData; floor: number }) {
  const floorY = floor * FLOOR_HEIGHT
  const { scene: shelfScene    } = useGLTF('/models/Bookshelf.glb')
  const { scene: cabinetScene  } = useGLTF('/models/FileCabinet_Standard.glb')
  const { scene: coffeeScene   } = useGLTF('/models/CoffeeMachine.glb')
  const { scene: tableScene    } = useGLTF('/models/CoffeeTable.glb')
  const { scene: printerScene  } = useGLTF('/models/Printer.glb')

  const items = useMemo(() => {
    const out: { key: string; scene: THREE.Group; x: number; z: number; ry: number; scale?: number }[] = []
    mapData.rooms.filter(r => r.floor === floor).forEach((room, ri) => {
      const rw   = room.wx2 - room.wx1
      const rd   = room.wz2 - room.wz1
      if (rw < 5 || rd < 5) return

      const zone = room.zone ?? ''
      const skip = zone === 'server_room' || zone === 'network_closet'

      // Back wall (high Z): bookshelves — skip server/network rooms
      if (!skip) {
        const numShelves = Math.max(1, Math.floor((rw - 3) / 4))
        for (let s = 0; s < numShelves; s++) {
          const tx = room.wx1 + 1.5 + s * (rw - 3) / Math.max(numShelves - 1, 1)
          out.push({ key: `shelf-${ri}-${s}`, scene: shelfScene.clone(true), x: tx, z: room.wz2 - 0.7, ry: 0 })
        }
      }

      // Low-X corner: file cabinet
      if (rw >= 6 && rd >= 6) {
        out.push({ key: `cab-${ri}`, scene: cabinetScene.clone(true), x: room.wx1 + 0.8, z: room.wz1 + 1.5, ry: Math.PI / 2 })
      }

      // Coffee machine + table in break-area zones (high-Z corner, low-X side)
      if (COFFEE_ZONES.has(zone) && rw >= 7) {
        const cx = room.wx2 - 1.0
        const cz = room.wz1 + 1.2
        out.push({ key: `coffee-${ri}`,  scene: coffeeScene.clone(true),  x: cx,        z: cz,        ry: -Math.PI / 2 })
        out.push({ key: `ctable-${ri}`,  scene: tableScene.clone(true),   x: cx - 1.4,  z: cz + 0.3,  ry: 0 })
      }

      // Printer in office zones (low-Z corner, high-X side)
      if (PRINTER_ZONES.has(zone) && rd >= 7) {
        out.push({ key: `printer-${ri}`, scene: printerScene.clone(true), x: room.wx2 - 0.9, z: room.wz2 - 1.1, ry: Math.PI })
      }
    })
    return out
  }, [mapData, floor, shelfScene, cabinetScene, coffeeScene, tableScene, printerScene])

  // Plant positions: far corners of rooms
  const plants = useMemo(() => {
    const out: { key: string; x: number; z: number; seed: number }[] = []
    mapData.rooms.filter(r => r.floor === floor).forEach((room, ri) => {
      const rw = room.wx2 - room.wx1
      const rd = room.wz2 - room.wz1
      if (rw < 6 || rd < 6) return
      // Up to 2 plants per room in far corners
      out.push({ key: `plant-${ri}-a`, x: room.wx2 - 0.7, z: room.wz2 - 0.8, seed: ri })
      if (rw >= 9 && rd >= 9) {
        out.push({ key: `plant-${ri}-b`, x: room.wx1 + 0.7, z: room.wz2 - 0.8, seed: ri + 7 })
      }
    })
    return out
  }, [mapData, floor])

  return (
    <>
      {items.map(item => (
        <primitive key={item.key} object={item.scene}
          scale={[0.009, 0.009, 0.009]}
          position={[item.x, floorY, item.z]}
          rotation={[0, item.ry, 0]}
        />
      ))}
      {plants.map(p => (
        <OfficePlant key={p.key} x={p.x} z={p.z} floorY={floorY} seed={p.seed} />
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
  const emissive = isComplete ? '#4ade80' : hasMyTask ? '#f59e0b' : '#1a1a2e'
  const emInt    = isHolding ? 2.2 : hasMyTask ? 0.6 : 0.08

  const { scene: deskScene    } = useGLTF('/models/Office_Desk_1.glb')
  const { scene: chairScene   } = useGLTF('/models/Chair_A.glb')
  const { scene: monitorScene } = useGLTF('/models/Computer_Monitor.glb')
  const deskClone    = useMemo(() => deskScene.clone(true),    [deskScene])
  const chairClone   = useMemo(() => chairScene.clone(true),   [chairScene])
  const monitorClone = useMemo(() => monitorScene.clone(true), [monitorScene])

  return (
    <group position={[station.x, floorY, station.z]}>
      {/* Desk */}
      <primitive object={deskClone} scale={[0.009, 0.009, 0.009]} />
      {/* Office chair behind desk */}
      <primitive object={chairClone} scale={[0.009, 0.009, 0.009]}
        position={[0, 0, 0.85]} rotation={[0, Math.PI, 0]} />
      {/* Monitor on desk surface (desk ~0.85 high, monitor base ~0 at origin) */}
      <group position={[0, 0.85, -0.22]}>
        <primitive object={monitorClone} scale={[0.009, 0.009, 0.009]} />
        {/* Screen glow */}
        <pointLight position={[0, 0.25, -0.1]} intensity={emInt * 0.6} distance={2.5} decay={2} color={emissive} />
      </group>
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
  const groupRef  = useRef<THREE.Group>(null)
  const movingRef = useRef(false)
  const prevX     = useRef(x)
  const prevZ     = useRef(z)
  const floorY    = pFloor * FLOOR_HEIGHT

  useFrame(() => {
    if (groupRef.current) {
      _v3.set(x, floorY, z)
      groupRef.current.position.lerp(_v3, 0.25)
      groupRef.current.rotation.y = facing
    }
    movingRef.current = Math.hypot(x - prevX.current, z - prevZ.current) > 0.015
    prevX.current = x
    prevZ.current = z
  })

  const color = isLocal ? '#6D28D9' : isBot ? '#f59e0b' : '#3b82f6'

  return (
    <group ref={groupRef} position={[x, floorY, z]}>
      {/* Animated KayKit character */}
      <KayKitCharacter name={name ?? ''} opacity={isEliminated ? 0.35 : 1} movingRef={movingRef} />
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
// camAngle: angle (radians) of the camera offset from the player in the XZ plane.
// π/4 = 45° matches the original fixed offset (18, 16, 18) where R = 18√2 ≈ 25.5.
// [ key rotates CCW, ] key rotates CW. Both controlled from LocalPlayerController.
let camAngle = Math.PI / 4
const CAM_R       = 26          // horizontal radius (≈ 18 * √2, rounded up)
const CAM_DESIRED = new THREE.Vector3()
const CAM_LOOKAT  = new THREE.Vector3()

function FollowCamera({ currentFloor: _cf }: { currentFloor: number }) {
  const { camera } = useThree()
  useFrame(() => {
    const floorY = localFloor * FLOOR_HEIGHT
    CAM_LOOKAT.set(localPos.x, floorY, localPos.z)
    CAM_DESIRED.set(
      localPos.x + CAM_R * Math.sin(camAngle),
      floorY + 16,
      localPos.z + CAM_R * Math.cos(camAngle),
    )
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
  const keys       = useKeyboard()
  const facingRef   = useRef(0)
  const lastSent    = useRef(0)
  const lastToggle  = useRef(0); void lastToggle
  const groupRef    = useRef<THREE.Group>(null)
  const movingRef   = useRef(false)
  const prevZone    = useRef<string | null>(null)
  const prevSwitch  = useRef<string | null>(null)
  const localName  = useGameRoom(s => {
    const sid = s.room?.sessionId
    return s.players.find(p => p.sessionId === sid)?.name ?? ''
  })

  useFrame((_, delta) => {
    const k   = keys.current

    // Camera rotation: [ rotates CCW (left), ] rotates CW (right)
    if (k['BracketLeft'])  camAngle -= 1.4 * delta
    if (k['BracketRight']) camAngle += 1.4 * delta

    let dx = 0, dz = 0
    if (k['KeyW'] || k['ArrowUp'])    dz -= 1
    if (k['KeyS'] || k['ArrowDown'])  dz += 1
    if (k['KeyA'] || k['ArrowLeft'])  dx -= 1
    if (k['KeyD'] || k['ArrowRight']) dx += 1

    movingRef.current = (dx !== 0 || dz !== 0)
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
      <KayKitCharacter name={localName} movingRef={movingRef} />
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
      {/* Office lighting: warm white sky / warm tan ground bounce */}
      <hemisphereLight args={['#fff8ec', '#c8b880', 0.9]} />
      <ambientLight intensity={0.55} color="#fffaf0" />
      <directionalLight position={[20, 30, 20]} intensity={0.5} castShadow={false} />

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
            spectate={spectate}
          />
          <ZoneOverlays     mapData={mapData} floor={renderFloor} />
          <RoomCeilingLights mapData={mapData} floor={renderFloor} lights={roomLights} />
          <LightSwitches    mapData={mapData} floor={renderFloor} lights={roomLights} nearZone={nearSwitch} />
          <StaircaseVisuals mapData={mapData} floor={renderFloor} />
          <RoomSigns        mapData={mapData} floor={renderFloor} />
          <RoomDecoration   mapData={mapData} floor={renderFloor} />
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
      style={{ position: 'fixed', inset: 0, zIndex: 0, width: '100vw', height: '100vh' }}
      resize={{ debounce: { scroll: 50, resize: 200 } }}
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
