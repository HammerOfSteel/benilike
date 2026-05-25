import { useState, useCallback, useEffect, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import { TASK_DEFS } from '@shared/tasks'
import GameWorld from '../../game/GameWorld'
import type { Screen } from '../../App'
import type { StationInfo } from '@shared/types'
import styles from './screens.module.css'

const ZONE_LABELS: Record<string, string> = {
  main_office:    'Main Office',
  server_room:    'Server Room',
  network_closet: 'Network Closet',
  hr_corner:      'HR Corner',
  finance_floor:  'Finance Floor',
  devops_den:     'DevOps Den',
  marketing_hub:  'Marketing Hub',
  exec_suite:     'Exec Suite',
}

interface Props { onNavigate: (s: Screen) => void }

export default function GameScreen({ onNavigate }: Props) {
  const {
    room, myRole, myFaction, players,
    workforceMeter, oppositionMeter,
    gameEnd, activeEffects,
    stations, completedTasks, holdingStationId, holdStartedAt,
    toasts, monitorSnapshot,
    clearRoom,
  } = useGameRoom()

  const [nearStation, setNearStation] = useState<StationInfo | null>(null)
  const toastRaf = useRef<number>(0)

  const handleLeave = () => {
    room?.send('task_hold_cancel', {})
    room?.leave()
    clearRoom()
    onNavigate('main-menu')
  }

  const handleNearStation = useCallback((st: StationInfo | null) => setNearStation(st), [])

  // Clear expired toasts
  useEffect(() => {
    const tick = () => {
      useGameRoom.getState().clearExpiredToasts()
      toastRaf.current = requestAnimationFrame(tick)
    }
    toastRaf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(toastRaf.current)
  }, [])

  const myTasks    = myRole ? TASK_DEFS.filter(t => t.role === myRole) : []
  const isWorkforce = myFaction === 'workforce'
  const myMeter     = isWorkforce ? workforceMeter  : oppositionMeter
  const oppMeter    = isWorkforce ? oppositionMeter : workforceMeter
  const oppHint     = oppMeter < 34 ? 'LOW' : oppMeter < 67 ? 'MED' : 'HIGH'
  const roleLabel   = myRole ? ROLE_LABELS[myRole] : '—'

  // Hold progress
  const taskDef = nearStation ? TASK_DEFS.find(t => t.id === nearStation.taskId && t.role === myRole) : null
  const holdMs  = taskDef?.holdMs ?? 4000
  const holdPct = holdingStationId && holdStartedAt
    ? Math.min(1, (Date.now() - holdStartedAt) / holdMs)
    : 0

  // End screen
  if (gameEnd) {
    const won = gameEnd.winner === myFaction
    return (
      <div className={styles.endOverlay}>
        <div className={styles.endCard}>
          <div className={won ? styles.endFactionWon : styles.endFactionLost}>
            {won ? '✓ MISSION COMPLETE' : '✗ MISSION FAILED'}
          </div>
          <h1 className={styles.endHeadline}>
            {gameEnd.winner === 'workforce' ? 'WORKFORCE' : 'OPPOSITION'} WINS
          </h1>
          <p className={styles.endReason}>{gameEnd.reason}</p>
          <div className={styles.endStats}>
            <div className={styles.endStat}>
              <span className={styles.fieldLabel}>ROLE</span>
              <span className={styles.playerName}>{roleLabel}</span>
            </div>
            <div className={styles.endStat}>
              <span className={styles.fieldLabel}>TASKS DONE</span>
              <span className={styles.playerName}>
                {myTasks.filter(t => completedTasks.has(t.id as any)).length}/{myTasks.length}
              </span>
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
      <GameWorld onNearStation={handleNearStation} gameOver={false} />

      {/* ── Team meters (bottom centre) ── */}
      <div className={styles.hudMeters}>
        <div className={styles.hudMeterRow}>
          <span className={styles.hudMeterLabel}>{isWorkforce ? 'WORKFORCE' : 'OPPOSITION'}</span>
          <div className={styles.hudMeterBar}>
            <div
              className={styles.hudMeterFill}
              style={{
                width: `${myMeter}%`,
                background: isWorkforce ? 'var(--color-terminal)' : '#ef4444',
              }}
            />
          </div>
          <span className={styles.hudMeterPct}>{Math.round(myMeter)}%</span>
        </div>
        <div className={styles.hudMeterRow} style={{ opacity: 0.45 }}>
          <span className={styles.hudMeterLabel}>ENEMY</span>
          <div className={styles.hudMeterBar}>
            <div className={styles.hudMeterFill} style={{ width: '100%', background: '#444' }} />
          </div>
          <span className={styles.hudMeterPct}>{oppHint}</span>
        </div>
      </div>

      {/* ── Task checklist (top right) ── */}
      <div className={styles.hudTaskList}>
        <div className={styles.hudTaskListHeader}>{roleLabel}</div>
        {myTasks.map(task => {
          const done  = completedTasks.has(task.id as any)
          const stLoc = stations.find(s => s.taskId === task.id)
          const zone  = stLoc ? (ZONE_LABELS[stLoc.zone] ?? stLoc.zone) : ZONE_LABELS[task.zone] ?? task.zone
          return (
            <div key={task.id} className={`${styles.hudTask} ${done ? styles.hudTaskDone : ''}`}>
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
            {taskDef?.name ?? 'Working...'}
          </span>
        </div>
      )}

      {/* ── Interact prompt ── */}
      {nearStation && !holdingStationId && taskDef && !completedTasks.has(nearStation.taskId as any) && (
        <div className={styles.hudInteract}>[E] {taskDef.name}</div>
      )}

      {/* ── Task completion toasts ── */}
      <div className={styles.hudToasts}>
        {toasts.filter(t => t.expiresAt > Date.now()).map(t => (
          <div key={t.id} className={styles.hudToast}>
            <span className={styles.hudToastRole}>{t.role.replace('_', ' ')}</span>
            {' · '}{t.effectDesc}
          </div>
        ))}
      </div>

      {/* ── Monitor snapshot modal ── */}
      {monitorSnapshot && (
        <div className={styles.monitorModal}>
          <div className={styles.monitorCard}>
            <div className={styles.monitorTitle}>SERVER HEALTH MONITOR</div>
            {(['A', 'B', 'C'] as const).map(rack => {
              const health = monitorSnapshot[`rack${rack}` as 'rackA' | 'rackB' | 'rackC']
              return (
                <div key={rack} className={styles.monitorRack}>
                  <span>RACK {rack}</span>
                  <div className={styles.monitorRackBar}>
                    <div className={styles.monitorRackFill} style={{
                      width: `${health}%`,
                      background: health > 60 ? '#4ade80' : health > 30 ? '#f59e0b' : '#ef4444',
                    }} />
                  </div>
                  <span>{Math.round(health)}%</span>
                </div>
              )
            })}
            <button className={styles.monitorClose}
              onClick={() => useGameRoom.getState().setMonitorSnapshot(null)}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ── Corner info ── */}
      <div className={styles.hudCornerTL}>
        <div className={myFaction === 'opposition' ? styles.oppositionTag : styles.workforceTag}>
          {roleLabel}
        </div>
        <div className={styles.roomCodeHint} style={{ marginTop: '0.3rem' }}>
          {isWorkforce ? '▲ WORKFORCE' : '▼ OPPOSITION'}
        </div>
        <div className={styles.roomCodeHint} style={{ marginTop: '0.5rem' }}>
          {players.length} operative{players.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className={styles.hudCornerBL}>
        <span className={styles.roomCodeHint}>WASD · MOVE &nbsp;·&nbsp; E · INTERACT</span>
        <button className={styles.ghostBtn} onClick={handleLeave} style={{ marginTop: '0.4rem' }}>
          ESC LEAVE
        </button>
      </div>

      {/* ── Active effect warnings ── */}
      {activeEffects.workforceHoldSlow && isWorkforce && (
        <div className={styles.hudWarnBanner}>⚡ POWER CUT — tasks taking 2× longer</div>
      )}
      {activeEffects.hackerCorruption && isWorkforce && (
        <div className={styles.hudWarnBanner} style={{ top: '5.5rem' }}>☠ HACKER CORRUPTION — terminal task slowed</div>
      )}
      {activeEffects.workforceSpeedActive && isWorkforce && (
        <div className={styles.hudWarnBanner} style={{ top: activeEffects.workforceHoldSlow ? '7rem' : '3.5rem', color: '#4ade80', borderColor: '#4ade80' }}>
          🏃 SPRINT — movement speed +30%
        </div>
      )}
      {activeEffects.lockdownActive && !isWorkforce && (
        <div className={styles.hudWarnBanner}>🔒 SERVER ROOM LOCKED DOWN</div>
      )}
    </div>
  )
}
