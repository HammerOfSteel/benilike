import { useState, useCallback, useEffect, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import { TASK_DEFS, AI_TASK_DEFS } from '@shared/tasks'
import GameWorld from '../../game/GameWorld'
import Minimap from '../../game/Minimap'
import Radio from '../../game/Radio'
import type { Screen } from '../../App'
import type { StationInfo, BodyInfo, TaskId } from '@shared/types'
import styles from './screens.module.css'

const ZONE_LABELS: Record<string, string> = {
  main_office:    'Main Office',
  server_room:    'Server Room',
  network_closet: 'Network Closet',
  hr_corner:      'HR Corner',
  finance_floor:  'Finance Floor',
  devops_den:     'DevOps Den',
  marketing_hub:  'Marketing Hub',
  exec_suite:     'Executive Suite',
}

interface Props { onNavigate: (s: Screen) => void }

export default function GameScreen({ onNavigate }: Props) {
  const {
    room, myRole, myAssignedTasks, myIsAi,
    players, gameEnd, sprint,
    stations, completedTasks, holdingStationId, holdStartedAt,
    toasts, clearRoom,
  } = useGameRoom()

  // Safety redirect — spectators should never be on GameScreen
  const isSpectatorGuard = useGameRoom(s => s.isSpectator)
  useEffect(() => {
    if (isSpectatorGuard) {
      console.warn('[BENI:GameScreen] ⚠ isSpectator=true detected on GameScreen — redirecting to spectator')
      onNavigate('spectator')
    } else {
      console.log('[BENI:GameScreen] mounted, isSpectator=false ✓')
    }
  }, [isSpectatorGuard, onNavigate])

  const [nearStation,  setNearStation]  = useState<StationInfo | null>(null)
  const [nearBody,     setNearBody]     = useState<BodyInfo | null>(null)
  const [currentZone,  setCurrentZone]  = useState<string | null>(null)
  const [flickerOn,    setFlickerOn]    = useState(false)
  const toastRaf = useRef<number>(0)

  // Navigation-triggering messages and phase2_flicker
  useEffect(() => {
    if (!room) return

    room.onMessage('all_hands_start', (data: { calledBy: string; bodyId?: string }) => {
      const gs = useGameRoom.getState()
      gs.addIncident(`ALL-HANDS called by ${data.calledBy}`, 'warn')
      if (gs.isSpectator) {
        console.warn('[BENI:GameScreen] all_hands_start received but isSpectator=true — redirecting to spectator instead of meeting')
        onNavigate('spectator')
      } else {
        console.log('[BENI:GameScreen] all_hands_start → navigating to meeting')
        onNavigate('meeting')
      }
    })

    room.onMessage('retro_start', (data: any) => {
      useGameRoom.getState().setRetroData(data)
      onNavigate('retro')
    })

    room.onMessage('game_end', (d: { winner: string; reason: string }) => {
      useGameRoom.getState().setGameEnd(d.winner, d.reason)
    })

    room.onMessage('phase2_flicker', () => {
      setFlickerOn(true)
      setTimeout(() => setFlickerOn(false), 800)
    })

    room.onMessage('perk_awarded', (d: { perk: string }) => {
      useGameRoom.getState().addIncident(`Perk awarded: ${d.perk}`, 'success')
    })

    return () => {
      room.removeAllListeners()
    }
  }, [room, onNavigate])

  const handleLeave = () => {
    room?.send('task_hold_cancel', {})
    room?.leave()
    clearRoom()
    onNavigate('main-menu')
  }

  // R key → call all-hands
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !e.repeat) {
        room?.send('call_all_hands', {})
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [room])

  const handleNearStation  = useCallback((st: StationInfo | null) => setNearStation(st), [])
  const handleNearBody     = useCallback((b: BodyInfo | null)    => setNearBody(b), [])
  const handleZoneChange   = useCallback((z: string | null)      => setCurrentZone(z), [])

  // Clear expired toasts
  useEffect(() => {
    const tick = () => {
      useGameRoom.getState().clearExpiredToasts()
      toastRaf.current = requestAnimationFrame(tick)
    }
    toastRaf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(toastRaf.current)
  }, [])

  const allTaskDefs = [...TASK_DEFS, ...AI_TASK_DEFS]
  const myTaskDefs  = myAssignedTasks
    .map(id => allTaskDefs.find(t => t.id === id))
    .filter(Boolean) as typeof allTaskDefs

  const roleLabel = myRole ? ROLE_LABELS[myRole] : '—'

  // Hold progress
  const nearTaskDef = nearStation
    ? allTaskDefs.find(t => t.id === nearStation.taskId)
    : null
  const holdMs  = nearTaskDef?.holdMs ?? 4000
  const holdPct = holdingStationId && holdStartedAt
    ? Math.min(1, (Date.now() - holdStartedAt) / holdMs)
    : 0

  // Sprint display
  const sprintPct = sprint && sprint.quota > 0
    ? Math.min(1, sprint.completed / sprint.quota)
    : 0

  // End screen
  if (gameEnd) {
    const totalDone  = myTaskDefs.filter(t => completedTasks.has(t.id as TaskId)).length
    const workerWon  = gameEnd.winner === 'workforce'
    return (
      <div className={styles.endOverlay}>
        <div className={styles.endCard}>
          <div className={workerWon ? styles.endFactionWon : styles.endFactionLost}>
            {workerWon ? '✓ WORKFORCE WINS' : '✗ ROGUE AI WINS'}
          </div>
          <h1 className={styles.endHeadline}>
            {workerWon ? 'CONTAINED' : 'TAKEOVER'}
          </h1>
          <p className={styles.endReason}>{gameEnd.reason}</p>
          <div className={styles.endStats}>
            <div className={styles.endStat}>
              <span className={styles.fieldLabel}>ROLE</span>
              <span className={styles.playerName}>{roleLabel}</span>
            </div>
            <div className={styles.endStat}>
              <span className={styles.fieldLabel}>TASKS DONE</span>
              <span className={styles.playerName}>{totalDone}/{myTaskDefs.length}</span>
            </div>
          </div>
          <button className={styles.primaryBtn} onClick={handleLeave} style={{ marginTop: '1.5rem' }}>
            [ BACK TO MENU ]
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GameWorld
        onNearStation={handleNearStation}
        onNearBody={handleNearBody}
        onZoneChange={handleZoneChange}
        gameOver={false}
      />

      {/* Phase 2 flicker overlay */}
      {flickerOn && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(239,68,68,0.18)',
          pointerEvents: 'none', zIndex: 1000,
          animation: 'none',
        }} />
      )}

      {/* ── Minimap (bottom-left) ── */}
      <Minimap />

      {/* ── Sprint quota bar (bottom centre) ── */}
      {sprint && (
        <div className={styles.hudMeters}>
          <div className={styles.hudMeterRow}>
            <span className={styles.hudMeterLabel}>
              SPRINT {sprint.sprint}/{3} &nbsp;·&nbsp; {Math.floor(sprint.timeLeft / 60)}:{String(sprint.timeLeft % 60).padStart(2, '0')}
            </span>
            <div className={styles.hudMeterBar}>
              <div
                className={styles.hudMeterFill}
                style={{
                  width: `${sprintPct * 100}%`,
                  background: sprintPct >= 1 ? '#4ade80' : 'var(--color-terminal)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <span className={styles.hudMeterPct}>{sprint.completed}/{sprint.quota}</span>
          </div>
        </div>
      )}

      {/* ── Task checklist (top right) ── */}
      <div className={styles.hudTaskList}>
        <div className={styles.hudTaskListHeader}>{roleLabel}{myIsAi ? ' [AI]' : ''}</div>
        {myTaskDefs.map(task => {
          const done  = completedTasks.has(task.id as TaskId)
          const stLoc = stations.find(s => s.taskId === task.id)
          const zone  = stLoc
            ? (ZONE_LABELS[stLoc.zone] ?? stLoc.zone)
            : (ZONE_LABELS[task.zone] ?? task.zone)
          const isAiTask = task.category === 'ai'
          return (
            <div key={task.id} className={`${styles.hudTask} ${done ? styles.hudTaskDone : ''}`}
              style={isAiTask ? { color: '#ff8888' } : {}}>
              <span className={styles.hudTaskCheck}>{done ? '✓' : '○'}</span>
              <span className={styles.hudTaskName}>{task.name}</span>
              {!done && <span className={styles.hudTaskZone}>{zone}</span>}
            </div>
          )
        })}
      </div>

      {/* ── Hold-E progress bar (centre) ── */}
      {holdingStationId && (
        <div className={styles.hudHoldBar}>
          <div className={styles.hudHoldFill} style={{ width: `${holdPct * 100}%` }} />
          <span className={styles.hudHoldLabel}>
            {nearTaskDef?.name ?? 'Working...'}
          </span>
        </div>
      )}

      {/* ── Interact prompt: task ── */}
      {nearStation && !holdingStationId && nearTaskDef && !completedTasks.has(nearStation.taskId as TaskId) && (
        <div className={styles.hudInteract}>[E] {nearTaskDef.name}</div>
      )}

      {/* ── Not your task hint ── */}
      {nearStation && !holdingStationId && !nearTaskDef && nearStation.taskId && !completedTasks.has(nearStation.taskId as TaskId) && (
        <div className={styles.hudInteract} style={{ opacity: 0.45, fontSize: '0.7rem' }}>
          not your workstation
        </div>
      )}

      {/* ── Body report prompt ── */}
      {nearBody && !nearStation && (
        <div className={styles.hudInteract} style={{ color: '#ef4444' }}>
          [E] Report body — {nearBody.name}
        </div>
      )}

      {/* ── Zone HUD (top centre) ── */}
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none',
      }}>
        {currentZone && (
          <div style={{
            background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, padding: '4px 14px', fontSize: 11, letterSpacing: 2,
            color: '#c8c0ff', textTransform: 'uppercase', fontFamily: 'monospace',
          }}>
            {ZONE_LABELS[currentZone] ?? currentZone}
          </div>
        )}
      </div>

      {/* ── Task completion toasts ── */}
      <div className={styles.hudToasts}>
        {toasts.filter(t => t.expiresAt > Date.now()).map(t => (
          <div key={t.id} className={styles.hudToast}>
            <span className={styles.hudToastRole}>{t.playerName}</span>
            {' · '}{String(t.taskId).replace(/_/g, ' ')}
          </div>
        ))}
      </div>

      {/* ── Corner info ── */}
      <div className={styles.hudCornerTL}>
        <div className={styles.workforceTag}>{roleLabel}</div>
        <div className={styles.roomCodeHint} style={{ marginTop: '0.3rem' }}>
          {players.length} operative{players.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className={styles.hudCornerBL}>
        <span className={styles.roomCodeHint}>WASD · MOVE &nbsp;·&nbsp; E · INTERACT &nbsp;·&nbsp; R · ALL-HANDS</span>
        <button className={styles.ghostBtn} onClick={handleLeave} style={{ marginTop: '0.4rem' }}>
          ESC LEAVE
        </button>
      </div>

      {/* ── Radio (bottom-right) ── */}
      <Radio />
    </div>
  )
}
