import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

// ── Floating office tiles (isometric grid floor) ──────────────────────────
function OfficeTile({ position, delay }: { position: [number, number, number]; delay: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime + delay
    meshRef.current.position.y = position[1] + Math.sin(t * 0.4) * 0.08
    ;(meshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 0.3) * 0.06
  })

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.95, 0.95]} />
      <meshBasicMaterial
        color="#6D28D9"
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Floating desk block (low-poly prop) ───────────────────────────────────
function DeskBlock({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = clock.elapsedTime * 0.08
    groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.25) * 0.15
  })

  return (
    <group ref={groupRef} position={position}>
      {/* desk surface */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.8, 0.06, 0.5]} />
        <meshStandardMaterial color="#1e1b4b" emissive="#3730a3" emissiveIntensity={0.3} />
      </mesh>
      {/* monitor */}
      <mesh position={[0.1, 0.35, -0.1]}>
        <boxGeometry args={[0.35, 0.28, 0.03]} />
        <meshStandardMaterial color="#0f0f23" emissive="#6D28D9" emissiveIntensity={0.8} />
      </mesh>
      {/* monitor stand */}
      <mesh position={[0.1, 0.2, -0.1]}>
        <boxGeometry args={[0.04, 0.14, 0.04]} />
        <meshStandardMaterial color="#312e81" />
      </mesh>
      {/* keyboard */}
      <mesh position={[0.05, 0.14, 0.1]}>
        <boxGeometry args={[0.3, 0.02, 0.12]} />
        <meshStandardMaterial color="#1e1b4b" emissive="#4338ca" emissiveIntensity={0.2} />
      </mesh>
    </group>
  )
}

// ── Floating server rack ──────────────────────────────────────────────────
function ServerRack({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Group>(null)
  const time = useRef(Math.random() * 10)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime + time.current
    meshRef.current.rotation.y = -clock.elapsedTime * 0.06
    meshRef.current.position.y = position[1] + Math.sin(t * 0.2) * 0.12
  })

  return (
    <group ref={meshRef} position={position}>
      <mesh>
        <boxGeometry args={[0.3, 0.9, 0.4]} />
        <meshStandardMaterial color="#0c0c1e" emissive="#1d4ed8" emissiveIntensity={0.15} />
      </mesh>
      {/* LED strips */}
      {[0.3, 0.1, -0.1, -0.3].map((y, i) => (
        <mesh key={i} position={[0.151, y, 0]}>
          <boxGeometry args={[0.005, 0.04, 0.3]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#4ADE80' : '#6D28D9'}
            emissive={i % 2 === 0 ? '#4ADE80' : '#6D28D9'}
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Particle field (floating office debris) ───────────────────────────────
function Particles() {
  const count = 120
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 28
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return arr
  }, [])

  const pointsRef = useRef<THREE.Points>(null)

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y = clock.elapsedTime * 0.015
    pointsRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.01) * 0.05
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#A78BFA"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

// ── Grid lines on the floor ───────────────────────────────────────────────
function FloorGrid() {
  return (
    <gridHelper
      args={[40, 40, '#3B1591', '#1e1b4b']}
      position={[0, -3.5, 0]}
      rotation={[0, Math.PI / 6, 0]}
    />
  )
}

// ── Scene camera + lighting ───────────────────────────────────────────────
function SceneContent() {
  const tiles = useMemo(() => {
    const out: { pos: [number, number, number]; delay: number }[] = []
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        if (Math.random() > 0.45) {
          out.push({ pos: [x * 1.1, -2.8 + Math.random() * 0.3, z * 1.1], delay: Math.random() * 6 })
        }
      }
    }
    return out
  }, [])

  const desks: [number, number, number][] = [
    [-5, 0.5, -3], [4, -0.2, -5], [-3, 0.8, 4], [6, 0.3, 2], [-6, -0.3, 1],
  ]

  const servers: [number, number, number][] = [
    [7, 0.5, -6], [-7, 0.2, -4], [5, -0.3, 6],
  ]

  return (
    <>
      <ambientLight intensity={0.15} color="#3730a3" />
      <pointLight position={[0, 8, 0]} intensity={2} color="#6D28D9" distance={30} />
      <pointLight position={[-8, 2, -4]} intensity={1.2} color="#1d4ed8" distance={20} />
      <pointLight position={[8, 2, 4]} intensity={1.0} color="#F97316" distance={18} />
      <pointLight position={[0, -2, 0]} intensity={0.5} color="#4ADE80" distance={12} />

      <FloorGrid />
      <Particles />

      {tiles.map((t, i) => (
        <OfficeTile key={i} position={t.pos} delay={t.delay} />
      ))}
      {desks.map((pos, i) => (
        <DeskBlock key={i} position={pos} />
      ))}
      {servers.map((pos, i) => (
        <ServerRack key={i} position={pos} />
      ))}
    </>
  )
}

// ── Exported scene ────────────────────────────────────────────────────────
export default function OfficeScene() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 4, 12], fov: 55 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#05050D' }}
        frameloop="always"
      >
        <SceneContent />
      </Canvas>
    </div>
  )
}
