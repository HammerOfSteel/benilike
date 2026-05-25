import { useState, useEffect, useCallback, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import GameWorld from '../../game/GameWorld'
import type { Screen } from '../../App'
import styles from './screens.module.css'

interface Props { onNavigate: (s: Screen) => void }

export default function SpectatorScreen({ onNavigate }: Props) {
  const {
    room, players, sprint, toasts, bodies,
    spectateTarget, setSpectateTarget, clearRoom,
  } = useGameRoom()

  const [panelOpen, setPanelOpen]    = useState(true)
  const [chatLog, setChatLog]        = useState<{ name: string; text: string; time: string }[]>([])
  const toastRaf = useRef<number>(0)
  const chatRef  = useRef<HTMLDivElement>(null)

  // Subscribe to room messages
  useEffect(() => {
    if (!room) return

    room.onMessage('all_hands_start', () => {
      onNavigate('meeting')
    })

    room.onMessage('retro_start', (data: any) => {
      useGameRoom.getState().setRetroData(data)
      onNavigate('retro')
    })

    room.onMessage('game_end', (d: { winner: string; reason: string }) => {
      useGameRoom.getState().setGameEnd(d.winner, d.reason)
    })

    room.onMessage('chat', (d: { name: string; text: string }) => {
      const time = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setChatLog(prev => [...prev.slice(-79), { name: d.name, text: d.text, time }])
    })

    room.onMessage('task_complete', (d: { taskId: string; playerName: string }) => {
      const time = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      useGameRoom.getState().addIncident(`${d.playerName} completed ${d.taskId.replace(/_/g, ' ')}`, 'success', time)
    })

    return () => { room.removeAllListeners() }
  }, [room, onNavigate])

  // Clear expired toasts
  useEffect(() => {
    const tick = () => {
      useGameRoom.getState().clearExpiredToasts()
      toastRaf.current = requestAnimationFrame(tick)
    }
    toastRaf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(toastRaf.current)
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatLog])

  // Tab key: cycle through living players
  useEffect(() => {
    const living = players.filter(p => !p.isEliminated && !p.isSpectator)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && living.length > 0) {
        e.preventDefault()
        const idx = spectateTarget ? living.findIndex(p => p.sessionId === spectateTarget) : -1
        const next = living[(idx + 1) % living.length]
        setSpectateTarget(next?.sessionId ?? null)
      }
      if (e.code === 'KeyF') {
        setSpectateTarget(null)  // free camera
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [players, spectateTarget, setSpectateTarget])

  const handleLeave = () => {
    room?.leave()
    clearRoom()
    onNavigate('main-menu')
  }

  const targetPlayer = spectateTarget
    ? players.find(p => p.sessionId === spectateTarget)
    : null

  const living     = players.filter(p => !p.isEliminated && !p.isSpectator)
  const eliminated = players.filter(p => p.isEliminated)

  const sprintPct = sprint && sprint.quota > 0
    ? Math.min(1, sprint.completed / sprint.quota)
    : 0

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* 3D world fills entire screen */}
      <GameWorld
        spectate
        spectateTarget={spectateTarget}
      />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '0.5rem 1rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 80%, transparent)',
        fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em',
        color: 'var(--text-muted)', zIndex: 20,
      }}>
        {/* Eye icon + mode */}
        <span style={{ color: 'var(--brand-orange)', fontWeight: 700, fontSize: '0.8rem' }}>
          👁 SPECTATOR
        </span>

        {/* Following indicator */}
        {targetPlayer ? (
          <span style={{ color: 'var(--color-terminal)' }}>
            FOLLOWING: <strong style={{ color: '#fff' }}>{targetPlayer.name}</strong>
            {targetPlayer.role ? ` [${ROLE_LABELS[targetPlayer.role as keyof typeof ROLE_LABELS] ?? targetPlayer.role}]` : ''}
          </span>
        ) : (
          <span style={{ opacity: 0.6 }}>FREE VIEW</span>
        )}

        {/* Camera hints */}
        <span style={{ opacity: 0.4, fontSize: '0.65rem' }}>
          TAB: cycle · F: free cam
        </span>

        {/* Sprint bar (centered) */}
        {sprint && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <span>SPRINT {sprint.sprint}/{3}</span>
            <div style={{ width: 160, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${sprintPct * 100}%`, height: '100%', background: 'var(--color-terminal)', transition: 'width 0.4s' }} />
            </div>
            <span>{sprint.completed}/{sprint.quota}</span>
            <span style={{ opacity: 0.6 }}>{fmtTime(sprint.timeLeft)}</span>
          </div>
        )}

        {/* Leave button */}
        <button
          style={{
            marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
            color: 'var(--text-muted)', padding: '0.25rem 0.75rem', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em',
          }}
          onClick={handleLeave}
        >
          LEAVE
        </button>
      </div>

      {/* ── Left side panel: player list ────────────────────────── */}
      <div style={{
        position: 'absolute', top: '2.5rem', left: panelOpen ? 0 : '-260px',
        width: 260, bottom: 0,
        background: 'rgba(0,0,0,0.75)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
        transition: 'left 0.2s ease',
        zIndex: 15,
      }}>
        {/* Toggle tab */}
        <button
          style={{
            position: 'absolute', right: -28, top: '40%',
            width: 28, height: 64,
            background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
          }}
          onClick={() => setPanelOpen(o => !o)}
          title={panelOpen ? 'Hide panel' : 'Show panel'}
        >
          {panelOpen ? '◀' : '▶'}
        </button>

        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '0.1em' }}>
          PLAYERS ({living.length} ACTIVE)
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Living players */}
          {living.map(p => {
            const isTarget = p.sessionId === spectateTarget
            const tasksDone = 0  // could be tracked per-player in a future update
            return (
              <div
                key={p.sessionId}
                onClick={() => setSpectateTarget(isTarget ? null : p.sessionId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  background: isTarget ? 'rgba(0,255,150,0.08)' : 'transparent',
                  borderLeft: isTarget ? '2px solid var(--color-terminal)' : '2px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Status dot */}
                <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: p.isBot ? 'var(--brand-orange)' : 'var(--color-terminal)' }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: isTarget ? '#fff' : 'var(--text-muted)', fontWeight: isTarget ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                    {p.isBot && <span style={{ color: 'var(--brand-orange)', fontSize: '0.6rem', marginLeft: 4 }}>BOT</span>}
                  </div>
                  {p.role && (
                    <div style={{ fontSize: '0.62rem', opacity: 0.5 }}>
                      {ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}
                    </div>
                  )}
                </div>

                {isTarget && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-terminal)', flexShrink: 0 }}>👁</span>
                )}
              </div>
            )
          })}

          {/* Eliminated */}
          {eliminated.length > 0 && (
            <>
              <div style={{ padding: '0.3rem 0.75rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', letterSpacing: '0.1em', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '0.25rem' }}>
                ELIMINATED
              </div>
              {eliminated.map(p => (
                <div key={p.sessionId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', opacity: 0.35 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#555' }} />
                  <div style={{ color: '#666', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Chat log at bottom of panel */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.3rem 0', maxHeight: 180 }}>
          <div style={{ padding: '0.2rem 0.75rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
            MEETING LOG
          </div>
          <div ref={chatRef} style={{ maxHeight: 150, overflowY: 'auto', padding: '0 0.5rem' }}>
            {chatLog.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.62rem', padding: '0.2rem' }}>
                // no chat yet
              </div>
            )}
            {chatLog.map((entry, i) => (
              <div key={i} style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.15rem', lineHeight: 1.3 }}>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{entry.time} </span>
                <span style={{ color: 'var(--color-terminal)', opacity: 0.8 }}>{entry.name}: </span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Task completion toasts (bottom right) ────────────────── */}
      <div style={{
        position: 'absolute', bottom: '1.5rem', right: '1rem',
        display: 'flex', flexDirection: 'column-reverse', gap: '0.4rem',
        zIndex: 20, maxWidth: 280,
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: 'rgba(0,255,150,0.1)', border: '1px solid rgba(0,255,150,0.25)',
            padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            color: 'var(--color-terminal)',
          }}>
            ✓ {toast.playerName} — {toast.taskId.replace(/_/g, ' ')}
          </div>
        ))}
      </div>

    </div>
  )
}
