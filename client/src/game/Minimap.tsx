/**
 * Among Us-style minimap — canvas-based, runs its own RAF loop.
 * Reads game state from the zustand store via a ref-based subscription
 * so it never causes React re-renders.
 */
import { useRef, useEffect } from 'react'
import { useGameRoom } from '../store/useGameRoom'
import { TASK_DEFS } from '@shared/tasks'
import { generateMapData, CELL_SIZE } from '@shared/mapgen'
import type { MapData } from '@shared/mapgen'
import type { StationInfo } from '@shared/types'
import type { LobbyPlayer } from '../store/useGameRoom'

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const W = 160
const H = 160

// ── Zone fill colours (match the 3-D floor overlay palette) ──────────────────
const ZONE_FILL: Record<string, string> = {
  main_office:    '#2d2a6e',
  server_room:    '#1a2f4a',
  network_closet: '#152640',
  hr_corner:      '#3a1a52',
  devops_den:     '#1a4228',
  finance_floor:  '#4a2a0f',
  marketing_hub:  '#4a0f28',
  exec_suite:     '#1a2a4e',
  opposition_den: '#3a0a0a',
}

// ── Shared snapshot read by the RAF loop ──────────────────────────────────────
interface MinimapState {
  players:        LobbyPlayer[]
  stations:       StationInfo[]
  completedTasks: Set<string>
  myRole:         string | null
  mySessionId:    string
  myFloor:        number
}

export default function Minimap() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef<MinimapState>({
    players: [], stations: [], completedTasks: new Set(), myRole: null, mySessionId: '', myFloor: 0,
  })
  const mapRef     = useRef<MapData | null>(null)
  const seedRef    = useRef('')

  // ── Subscribe to store (no React re-renders) ─────────────────────────────
  useEffect(() => {
    return useGameRoom.subscribe(s => {
      const mySessionId = s.room?.sessionId ?? ''
      const me          = s.players.find(p => p.sessionId === mySessionId)
      stateRef.current = {
        players:        s.players,
        stations:       s.stations,
        completedTasks: s.completedTasks as Set<string>,
        myRole:         s.myRole,
        mySessionId,
        myFloor:        me?.floor ?? 0,
      }
      // Regenerate map geometry when seed changes
      if (s.mapSeed && s.mapSeed !== seedRef.current) {
        seedRef.current = s.mapSeed
        mapRef.current  = generateMapData(s.mapSeed, s.mapSize)
      }
    })
  }, [])

  // ── RAF draw loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameId = 0
    let tick    = 0

    // World → canvas coordinate transform (recomputed each frame from mapData)
    const toC = (wx: number, wz: number, gw: number, gh: number): [number, number] => {
      const worldW = gw * CELL_SIZE
      const worldH = gh * CELL_SIZE
      return [
        ((wx + worldW / 2) / worldW) * W,
        ((wz + worldH / 2) / worldH) * H,
      ]
    }

    const draw = () => {
      tick++
      ctx.clearRect(0, 0, W, H)

      // ── Background ───────────────────────────────────────────────────────
      ctx.fillStyle = '#0a0a18'
      ctx.fillRect(0, 0, W, H)

      const map = mapRef.current
      const { players, stations, completedTasks, myRole, mySessionId, myFloor } = stateRef.current

      if (map) {
        const { gridW: gw, gridH: gh } = map

        // ── Rooms for the current floor ──────────────────────────────────
        for (const room of map.rooms) {
          if (room.floor !== myFloor) continue
          const [x1, y1] = toC(room.wx1, room.wz1, gw, gh)
          const [x2, y2] = toC(room.wx2, room.wz2, gw, gh)
          const rw = x2 - x1
          const rh = y2 - y1

          ctx.fillStyle = ZONE_FILL[room.zone ?? ''] ?? '#1a1a2e'
          ctx.fillRect(x1, y1, rw, rh)

          ctx.strokeStyle = 'rgba(255,255,255,0.10)'
          ctx.lineWidth   = 0.5
          ctx.strokeRect(x1, y1, rw, rh)
        }

        // ── Staircases (small arrow icons) ───────────────────────────────
        ctx.fillStyle   = '#888'
        ctx.font        = '8px monospace'
        ctx.textAlign   = 'center'
        ctx.textBaseline = 'middle'
        for (const stair of map.staircases) {
          if (stair.fromFloor !== myFloor) continue
          const [cx, cy] = toC(stair.arrX, stair.arrZ, gw, gh)
          ctx.fillText(stair.toFloor > myFloor ? '▲' : '▼', cx, cy)
        }

        const myTaskIds = myRole
          ? new Set(TASK_DEFS.filter(t => t.role === myRole).map(t => t.id))
          : new Set<string>()

        // ── Station dots ─────────────────────────────────────────────────
        for (const station of stations) {
          if (!station.taskId) continue
          // Only show stations on current floor (station.floor may be undefined for old data)
          const stFloor = (station as any).floor ?? 0
          if (stFloor !== myFloor) continue

          const isDone   = completedTasks.has(station.taskId)
          const isMyTask = myTaskIds.has(station.taskId)
          const [cx, cy] = toC(station.x, station.z, gw, gh)

          if (isDone) {
            // Green check dot
            ctx.fillStyle   = '#22c55e'
            ctx.globalAlpha = 0.55
            ctx.beginPath()
            ctx.arc(cx, cy, 3, 0, Math.PI * 2)
            ctx.fill()
          } else if (isMyTask) {
            // Yellow pulsing — your target
            const pulse     = 0.65 + Math.sin(tick * 0.15) * 0.35
            ctx.fillStyle   = '#facc15'
            ctx.globalAlpha = pulse
            ctx.beginPath()
            ctx.arc(cx, cy, 4.5, 0, Math.PI * 2)
            ctx.fill()
            // Inner bright core
            ctx.fillStyle   = '#fff'
            ctx.globalAlpha = pulse * 0.6
            ctx.beginPath()
            ctx.arc(cx, cy, 2, 0, Math.PI * 2)
            ctx.fill()
          } else {
            // Dim grey — someone else's task
            ctx.fillStyle   = '#555'
            ctx.globalAlpha = 0.4
            ctx.beginPath()
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        }

        // ── Player dots ──────────────────────────────────────────────────
        for (const player of players) {
          const pFloor = player.floor ?? 0
          if (pFloor !== myFloor) continue

          const isSelf = player.sessionId === mySessionId
          const [cx, cy] = toC(player.x, player.z, gw, gh)

          let color = '#666'
          if (isSelf) {
            color = '#ffffff'
          } else if (player.faction === 'workforce') {
            color = '#4ade80'
          } else if (player.faction === 'opposition' && !player.disguised) {
            color = '#f87171'
          }

          const r = isSelf ? 5 : 3.5

          // Drop shadow
          ctx.fillStyle   = '#000'
          ctx.globalAlpha = 0.45
          ctx.beginPath()
          ctx.arc(cx + 0.8, cy + 0.8, r, 0, Math.PI * 2)
          ctx.fill()

          // Player dot
          ctx.fillStyle   = color
          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()

          if (isSelf) {
            // Direction indicator — small forward nub
            const a = player.facing ?? 0
            ctx.strokeStyle = '#fff'
            ctx.lineWidth   = 1.5
            ctx.globalAlpha = 0.75
            ctx.beginPath()
            ctx.moveTo(cx + Math.sin(a) * (r + 1), cy + Math.cos(a) * (r + 1))
            ctx.lineTo(cx + Math.sin(a) * (r + 5), cy + Math.cos(a) * (r + 5))
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }

        // ── Border ───────────────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth   = 1
        ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

        // ── Floor indicator (top-right corner) ───────────────────────────
        ctx.fillStyle    = 'rgba(255,255,255,0.45)'
        ctx.font         = '9px monospace'
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'top'
        ctx.fillText(`FL ${myFloor + 1}`, W - 4, 4)
      }

      frameId = requestAnimationFrame(draw)
    }

    frameId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        position:     'absolute',
        bottom:       '5.5rem',
        left:         '0.9rem',
        border:       '1px solid rgba(255,255,255,0.12)',
        borderRadius: '4px',
        background:   '#0a0a18',
        opacity:      0.9,
        pointerEvents: 'none',
      }}
    />
  )
}
