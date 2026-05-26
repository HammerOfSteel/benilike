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
  const [nearKillTarget, setNearKillTarget] = useState<{ sessionId: string; name: string } | null>(null)
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
  const handleNearKillTarget = useCallback((t: { sessionId: string; name: string } | null) => setNearKillTarget(t), [])
  const handleZoneChange   = useCallback((z: string | null)      => setCurrentZone(z), [])

  // ── Q-hold invisibility mechanic ─────────────────────────────────────────
  const aiInvisibilityUnlocked  = useGameRoom(s => s.aiInvisibilityUnlocked)
  const aiInvisibleActive       = useGameRoom(s => s.aiInvisibleActive)
  const aiInvisibilityCooldownUntil = useGameRoom(s => s.aiInvisibilityCooldownUntil)
  const aiExtraVoteReady        = useGameRoom(s => s.aiExtraVoteReady)
  const [qHoldProgress, setQHoldProgress] = useState(0)
  const qHoldStart = useRef<number | null>(null)
  const qRaf       = useRef<number>(0)
  const Q_HOLD_MS  = 3000

  useEffect(() => {
    if (!myIsAi || !aiInvisibilityUnlocked) return

    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyQ' || e.repeat) return
      if (aiInvisibleActive || Date.now() < aiInvisibilityCooldownUntil) return
      qHoldStart.current = Date.now()

      const tick = () => {
        if (!qHoldStart.current) return
        const elapsed = Date.now() - qHoldStart.current
        const pct     = Math.min(1, elapsed / Q_HOLD_MS)
        setQHoldProgress(pct)
        if (pct < 1) {
          qRaf.current = requestAnimationFrame(tick)
        } else {
          room?.send('ai_invisibility_activate', {})
          qHoldStart.current = null
          setQHoldProgress(0)
        }
      }
      qRaf.current = requestAnimationFrame(tick)
    }

    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'KeyQ') return
      if (qHoldStart.current) {
        qHoldStart.current = null
        cancelAnimationFrame(qRaf.current)
        setQHoldProgress(0)
      }
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
      cancelAnimationFrame(qRaf.current)
    }
  }, [myIsAi, aiInvisibilityUnlocked, aiInvisibleActive, aiInvisibilityCooldownUntil, room])

  // Cooldown countdown display (recomputed on each render via state tick)
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (aiInvisibilityCooldownUntil <= Date.now()) return
    const id = setInterval(() => forceUpdate(n => n + 1), 500)
    return () => clearInterval(id)
  }, [aiInvisibilityCooldownUntil])

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
        onNearKillTarget={handleNearKillTarget}
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

      {/* ── Kill prompt (Rogue AI only — always available) ── */}
      {nearKillTarget && myIsAi && !nearStation && !nearBody && (
        <div className={styles.hudInteract} style={{ color: '#ff2222', fontWeight: 700 }}>
          [E] ELIMINATE — {nearKillTarget.name}
        </div>
      )}

      {/* ── AI Abilities HUD (Rogue AI only) ── */}
      {myIsAi && (
        <div style={{
          position: 'absolute', top: 60, right: 16,
          display: 'flex', flexDirection: 'column', gap: 6,
          alignItems: 'flex-end', pointerEvents: 'none',
        }}>
          {/* Extra vote indicator */}
          {aiExtraVoteReady && (
            <div style={{
              background: 'rgba(99,30,255,0.85)', border: '1px solid #a78bfa',
              borderRadius: 6, padding: '4px 10px', fontSize: 11,
              color: '#ede9fe', fontFamily: 'monospace', letterSpacing: 1,
            }}>
              ✦ VOTE ×2 READY
            </div>
          )}

          {/* Invisibility ability */}
          {aiInvisibilityUnlocked && (() => {
            const now = Date.now()
            const onCooldown = aiInvisibilityCooldownUntil > now
            const cooldownSec = Math.ceil((aiInvisibilityCooldownUntil - now) / 1000)
            return (
              <div style={{
                background: 'rgba(0,0,0,0.75)', border: `1px solid ${aiInvisibleActive ? '#22d3ee' : onCooldown ? '#475569' : '#6ee7b7'}`,
                borderRadius: 6, padding: '4px 10px', fontSize: 11,
                color: aiInvisibleActive ? '#22d3ee' : onCooldown ? '#94a3b8' : '#6ee7b7',
                fontFamily: 'monospace', letterSpacing: 1,
              }}>
                {aiInvisibleActive
                  ? 'Q · INVISIBLE'
                  : onCooldown
                    ? `Q · VANISH [${cooldownSec}s]`
                    : 'Q · VANISH ready'}
              </div>
            )
          })()}

          {/* Q-hold progress bar */}
          {qHoldProgress > 0 && (
            <div style={{
              width: 120, height: 6, background: 'rgba(255,255,255,0.15)',
              borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${qHoldProgress * 100}%`,
                background: '#22d3ee', transition: 'none',
              }} />
            </div>
          )}
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
        <span className={styles.roomCodeHint}>WASD · MOVE &nbsp;·&nbsp; E · INTERACT &nbsp;·&nbsp; R · ALL-HANDS{myIsAi && aiInvisibilityUnlocked ? ' &nbsp;·&nbsp; Q (hold) · VANISH' : ''} &nbsp;·&nbsp; RMB · ROTATE CAM &nbsp;·&nbsp; SCROLL · ZOOM</span>
        <button className={styles.ghostBtn} onClick={handleLeave} style={{ marginTop: '0.4rem' }}>
          ESC LEAVE
        </button>
      </div>

      {/* ── Radio (bottom-right) ── */}
      <Radio />
    </div>
  )
}
