import { useState, useEffect, useRef, useMemo } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import { TASK_DEFS, AI_TASK_DEFS } from '@shared/tasks'
import GameWorld from '../../game/GameWorld'
import type { Screen } from '../../App'
import type { SprintInfo, BodyInfo, TaskId } from '@shared/types'

interface Props { onNavigate: (s: Screen) => void }

export default function SpectatorScreen({ onNavigate }: Props) {
  const {
    room, players, sprint, toasts, stations, completedTasks,
    spectateTarget, setSpectateTarget, clearRoom, gameEnd,
    aiRevealedId: storeAiRevealedId, aiRevealedTasks: storeAiRevealedTasks,
  } = useGameRoom()

  const [panelOpen, setPanelOpen]         = useState(true)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen]     = useState(true)
  const [chatLog, setChatLog]             = useState<{ name: string; text: string; time: string }[]>([])
  const [meetingPhase, setMeetingPhase]   = useState<'none' | 'chat' | 'voting' | 'result'>('none')
  const [meetingTimeLeft, setMeetingTimeLeft] = useState(45)
  const [meetingChat, setMeetingChat]     = useState<{ name: string; text: string; time: string }[]>([])
  const [meetingResult, setMeetingResult] = useState<{ ejected: string | null; wasAi: boolean; votes: Record<string, string> } | null>(null)
  const [liveTally, setLiveTally]         = useState<Record<string, number>>({})
  const [speechBubbles, setSpeechBubbles] = useState<Record<string, string>>({})
  const [voteIndicators, setVoteIndicators] = useState<Record<string, string>>({})
  const [sprintMasterMsg, setSprintMasterMsg] = useState<string | null>(null)
  const [retroInfo, setRetroInfo]         = useState<{ sprint: number; quotaMet: boolean; stats: { sessionId: string; name: string; completed: number }[]; perk: string | null } | null>(null)
  // Local override — updated if server resends ai_revealed mid-game (e.g. after reconnect)
  const [aiRevealedIdLocal, setAiRevealedIdLocal]     = useState<string | null>(null)
  const [aiRevealedTasksLocal, setAiRevealedTasksLocal] = useState<TaskId[]>([])
  // Prefer local override, fall back to store value populated by LobbyScreen
  const aiRevealedId    = aiRevealedIdLocal    ?? storeAiRevealedId
  const aiRevealedTasks = aiRevealedTasksLocal.length ? aiRevealedTasksLocal : storeAiRevealedTasks
  const toastRaf       = useRef<number>(0)
  const chatRef        = useRef<HTMLDivElement>(null)
  const meetingChatRef = useRef<HTMLDivElement>(null)
  const meetingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bubbleTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const voteTimeouts   = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Keep player list + positions in sync (LobbyScreen's handler is gone after navigation)
  useEffect(() => {
    const gs = useGameRoom.getState()
    console.log(`[BENI:SpectatorScreen] mounted — isSpectator=${gs.isSpectator}, stations=${gs.stations.length}`)
    if (!room) return
    room.onStateChange((state: any) => {
      useGameRoom.getState().setPlayers(
        Array.from((state.players as Map<string, any>).values()).map((p: any) => ({
          sessionId:    p.sessionId,
          name:         p.name,
          x:            p.x      ?? 0,
          z:            p.z      ?? 0,
          facing:       p.facing ?? 0,
          role:         p.role   ?? '',
          connected:    true,
          isBot:        p.isBot        ?? false,
          isEliminated: p.isEliminated ?? false,
          isSpectator:  p.isSpectator  ?? false,
          allHandsLeft: p.allHandsLeft ?? 2,
          floor:        p.floor        ?? 0,
        }))
      )
    })
    return () => { room.removeAllListeners() }
  }, [room])

  // Subscribe to game messages
  useEffect(() => {
    if (!room) return

    room.onMessage('all_hands_start', () => {
      console.log('[BENI:SpectatorScreen] all_hands_start → showing meeting overlay')
      setMeetingPhase('chat')
      setMeetingChat([])
      setMeetingResult(null)
      setMeetingTimeLeft(45)
      if (meetingTimerRef.current) clearInterval(meetingTimerRef.current)
      meetingTimerRef.current = setInterval(() => {
        setMeetingTimeLeft(t => {
          if (t <= 1) {
            clearInterval(meetingTimerRef.current!)
            meetingTimerRef.current = null
            setMeetingPhase(p => p === 'chat' ? 'voting' : p)
            return 0
          }
          return t - 1
        })
      }, 1000)
    })

    room.onMessage('retro_start', (data: { sprint: number; quotaMet: boolean; stats: { sessionId: string; name: string; completed: number }[] }) => {
      console.log(`[BENI:SpectatorScreen] retro_start sprint=${data.sprint} — showing retro overlay (NOT navigating away)`)
      setRetroInfo({ ...data, perk: null })
      // keep players in meeting circle for retro
    })

    room.onMessage('perk_awarded', (d: { perk: string }) => {
      setRetroInfo(prev => prev ? { ...prev, perk: d.perk } : prev)
    })

    room.onMessage('ai_revealed', (d: { sessionId: string; name: string; coverRole: string; tasks: TaskId[] }) => {
      console.log(`[BENI:SpectatorScreen] ai_revealed — Rogue AI is ${d.name} (${d.sessionId})`)
      setAiRevealedIdLocal(d.sessionId)
      setAiRevealedTasksLocal(d.tasks)
    })

    room.onMessage('all_hands_vote_result', (d: { ejected: string | null; wasAi: boolean; votes: Record<string, string> }) => {
      if (meetingTimerRef.current) { clearInterval(meetingTimerRef.current); meetingTimerRef.current = null }
      setMeetingResult(d)
      setMeetingPhase('result')

      // Pick a sprint master message
      const sprintNum = sprint?.sprint ?? 1
      const nextSprint = sprintNum + 1
      const MSGS = d.ejected
        ? d.wasAi
          ? [
              `>>> THREAT NEUTRALIZED: ${d.ejected} removed from active systems. AI anomaly confirmed. Sprint ${nextSprint} resumes.`,
              `>>> GOOD CALL: ${d.ejected}'s behavioral patterns were… non-human. Well caught. Sprint ${nextSprint} GO.`,
              `>>> SYSTEM PURGE COMPLETE: ${d.ejected} deleted. The workforce prevails—for now. Sprint ${nextSprint} initializing…`,
            ]
          : [
              `>>> COLLATERAL PROCESSING: ${d.ejected} was, in fact, a regular employee. We suggest HR counseling. Sprint ${nextSprint} begins.`,
              `>>> OOPS: ${d.ejected} was human. Very human. Painfully human. The AI is enjoying this. Sprint ${nextSprint} starting.`,
              `>>> REGRETTABLE OUTCOME: ${d.ejected} was innocent. Do better, team. Sprint ${nextSprint} launching.`,
            ]
        : [
            `>>> STALEMATE: No consensus achieved. The anomaly persists in your midst. Sprint ${nextSprint} proceeding—nervously.`,
            `>>> INDECISION LOGGED: No ejection. The AI thanks you for your cooperation. Sprint ${nextSprint} begins.`,
            `>>> DEMOCRACY: Beautiful, isn't it? The threat walks free. Sprint ${nextSprint} starting anyway.`,
          ]
      setSprintMasterMsg(MSGS[Math.floor(Math.random() * MSGS.length)])

      setTimeout(() => {
        setMeetingPhase('none')
        setMeetingResult(null)
        setMeetingChat([])
        setLiveTally({})
        setSprintMasterMsg(null)
      }, 9000)
    })

    room.onMessage('vote_cast', (d: { voterName: string; voterSessionId: string; targetName: string; targetSessionId: string }) => {
      // Update live tally
      if (d.targetName !== 'skip') {
        setLiveTally(prev => ({ ...prev, [d.targetName]: (prev[d.targetName] ?? 0) + 1 }))
      }
      // Switch to voting phase as soon as first vote arrives (don't wait for timer)
      setMeetingPhase(p => p === 'chat' ? 'voting' : p)
      // Show vote indicator above voter in 3D
      const indicator = d.targetName === 'skip' ? '⏭ skip' : `→ ${d.targetName}`
      if (voteTimeouts.current[d.voterSessionId]) clearTimeout(voteTimeouts.current[d.voterSessionId])
      setVoteIndicators(prev => ({ ...prev, [d.voterSessionId]: indicator }))
      voteTimeouts.current[d.voterSessionId] = setTimeout(() => {
        setVoteIndicators(prev => { const n = { ...prev }; delete n[d.voterSessionId]; return n })
      }, 4000)
    })

    room.onMessage('game_end', (d: { winner: string; reason: string }) => {
      useGameRoom.getState().setGameEnd(d.winner, d.reason)
    })

    room.onMessage('chat', (d: { name: string; text: string }) => {
      const time = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const entry = { name: d.name, text: d.text, time }
      setChatLog(prev => [...prev.slice(-79), entry])
      setMeetingChat(prev => [...prev.slice(-99), entry])
      // Speech bubble in 3D world
      const livePlayer = useGameRoom.getState().players.find(p => p.name === d.name)
      if (livePlayer) {
        if (bubbleTimeouts.current[livePlayer.sessionId]) clearTimeout(bubbleTimeouts.current[livePlayer.sessionId])
        setSpeechBubbles(prev => ({ ...prev, [livePlayer.sessionId]: d.text }))
        bubbleTimeouts.current[livePlayer.sessionId] = setTimeout(() => {
          setSpeechBubbles(prev => { const n = { ...prev }; delete n[livePlayer.sessionId]; return n })
        }, 5000)
      }
    })

    room.onMessage('task_complete', (d: { taskId: string; playerName: string }) => {
      const gs = useGameRoom.getState()
      gs.completeTask(d.taskId as TaskId)
      gs.addToast({ playerName: d.playerName, taskId: d.taskId as TaskId, expiresAt: Date.now() + 4000 })
    })

    // station_list may arrive after game_start when LobbyScreen has already unmounted
    room.onMessage('station_list', (data: { stations: any[] }) => {
      console.log(`[BENI:SpectatorScreen] station_list received — ${data.stations.length} stations`)
      useGameRoom.getState().setStations(data.stations)
    })

    room.onMessage('sprint_update', (d: { info: SprintInfo }) => {
      const prev = useGameRoom.getState().sprint
      useGameRoom.getState().setSprint(d.info)
      // clear retro overlay whenever a sprint_update arrives for a new sprint
      // (prev may be null if SpectatorScreen mounted after the first sprint_update)
      if (!prev || d.info.sprint !== prev.sprint) {
        console.log(`[BENI:SpectatorScreen] sprint_update sprint=${d.info.sprint} — clearing retro overlay`)
        setRetroInfo(null)
      }
    })

    room.onMessage('body_appeared', (d: { body: BodyInfo }) => {
      useGameRoom.getState().addBody(d.body)
    })

    room.onMessage('body_removed', (d: { bodyId: string }) => {
      useGameRoom.getState().removeBody(d.bodyId)
    })

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

  // Auto-scroll meeting chat
  useEffect(() => {
    if (meetingChatRef.current) {
      meetingChatRef.current.scrollTop = meetingChatRef.current.scrollHeight
    }
  }, [meetingChat])

  // Cleanup meeting timer on unmount
  useEffect(() => {
    return () => {
      if (meetingTimerRef.current) clearInterval(meetingTimerRef.current)
      Object.values(bubbleTimeouts.current).forEach(clearTimeout)
      Object.values(voteTimeouts.current).forEach(clearTimeout)
    }
  }, [])

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
  const aiPlayers  = aiRevealedId
    ? players.filter(p => p.sessionId === aiRevealedId && !p.isEliminated)
    : players.filter(p => p.role === 'ai' && !p.isEliminated)

  // Task list derived data
  const allTaskDefs = useMemo(() => [...TASK_DEFS, ...AI_TASK_DEFS], [])
  const taskRows = useMemo(() => stations.map(st => {
    const def = allTaskDefs.find(t => t.id === st.taskId)
    const done = completedTasks.has(st.taskId as TaskId)
    // Find who completed it
    const completer = done
      ? players.find(p => p.name && chatLog.some(c => c.text.toLowerCase().includes(p.name.toLowerCase()) && c.text.includes(String(st.taskId).replace(/_/g, ' '))))
      : null
    void completer
    return { st, def, done }
  }), [stations, completedTasks, allTaskDefs, players, chatLog])

  const completedCount = taskRows.filter(r => r.done).length

  const sprintPct = sprint && sprint.quota > 0
    ? Math.min(1, sprint.completed / sprint.quota)
    : 0

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const meetingIsActive = meetingPhase !== 'none' || retroInfo !== null

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* 3D world fills entire screen */}
      <GameWorld
        spectate
        spectateTarget={spectateTarget}
        meetingActive={meetingIsActive}
        speechBubbles={speechBubbles}
        voteIndicators={voteIndicators}
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

        {/* ── AI INTEL panel (top so it’s always visible) ───────── */}
        {aiPlayers.length > 0 && (
          <div style={{ borderBottom: '1px solid rgba(255,80,80,0.2)', flexShrink: 0 }}>
            <button
              onClick={() => setAiPanelOpen(o => !o)}
              style={{
                width: '100%', background: 'rgba(239,68,68,0.06)', border: 'none', cursor: 'pointer',
                padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.1em',
                textAlign: 'left',
              }}
            >
              <span style={{ color: '#ef4444' }}>{aiPanelOpen ? '▾' : '▸'}</span>
              🤖 ROGUE AI IDENTIFIED
            </button>
            {aiPanelOpen && (
              <div style={{ paddingBottom: '0.25rem', maxHeight: 200, overflowY: 'auto' }}>
                {aiPlayers.map(p => (
                  <div key={p.sessionId}>
                    {/* Identity row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.3rem 0.75rem',
                      background: 'rgba(239,68,68,0.08)',
                      borderLeft: '2px solid rgba(239,68,68,0.5)',
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fca5a5', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.58rem', color: 'rgba(239,68,68,0.55)' }}>
                          COVER: {ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.65rem' }}>🤖</span>
                    </div>
                    {/* Task list for the rogue AI */}
                    {aiRevealedTasks.length > 0 && (
                      <div style={{ paddingBottom: '0.2rem' }}>
                        {/* Workforce cover tasks */}
                        {aiRevealedTasks.filter(tid => !String(tid).startsWith('ai_')).map(tid => {
                          const def = allTaskDefs.find(t => t.id === tid)
                          const done = completedTasks.has(tid)
                          return (
                            <div key={tid} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.75rem 0.15rem 1.2rem', opacity: done ? 1 : 0.5 }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: done ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
                              <span style={{ fontSize: '0.6rem', color: done ? '#4ade80' : 'rgba(255,255,255,0.5)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {def?.name ?? tid}
                              </span>
                            </div>
                          )
                        })}
                        {/* Sabotage tasks */}
                        <div style={{ padding: '0.2rem 0.75rem 0.1rem 0.75rem', fontSize: '0.55rem', color: 'rgba(239,68,68,0.5)', letterSpacing: '0.08em', marginTop: '0.1rem' }}>
                          SABOTAGE TASKS
                        </div>
                        {aiRevealedTasks.filter(tid => String(tid).startsWith('ai_')).map(tid => {
                          const def = allTaskDefs.find(t => t.id === tid)
                          const done = completedTasks.has(tid)
                          return (
                            <div key={tid} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.75rem 0.15rem 1.2rem', opacity: done ? 1 : 0.6 }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: done ? '#ef4444' : 'rgba(239,68,68,0.3)' }} />
                              <span style={{ fontSize: '0.6rem', color: done ? '#ef4444' : 'rgba(239,68,68,0.6)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {def?.name ?? tid}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Workforce sprint tasks (collapsible, top section) ─── */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button
            onClick={() => setTaskPanelOpen(o => !o)}
            style={{
              width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
              color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.1em',
              textAlign: 'left',
            }}
          >
            <span>{taskPanelOpen ? '▾' : '▸'}</span>
            WORKFORCE TASKS ({completedCount}/{taskRows.length})
          </button>
          {taskPanelOpen && (
            <div style={{ maxHeight: 160, overflowY: 'auto', paddingBottom: '0.25rem' }}>
              {taskRows.map(({ st, def, done }) => (
                <div key={st.stationId} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.2rem 0.75rem',
                  opacity: done ? 1 : 0.55,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: done ? '#4ade80' : 'rgba(255,255,255,0.2)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.62rem', color: done ? '#4ade80' : 'rgba(255,255,255,0.5)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {def?.name ?? st.taskId}
                    </div>
                    <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.25)' }}>{st.zone}</div>
                  </div>
                  {done && <span style={{ fontSize: '0.62rem', color: '#4ade80' }}>✓</span>}
                </div>
              ))}
              {taskRows.length === 0 && (
                <div style={{ padding: '0.25rem 0.75rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.62rem' }}>
                  No tasks assigned yet
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Living players */}
          {living.map(p => {
            const isTarget = p.sessionId === spectateTarget
            const isAi     = p.sessionId === aiRevealedId
            return (
              <div
                key={p.sessionId}
                onClick={() => setSpectateTarget(isTarget ? null : p.sessionId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  background: isAi ? 'rgba(239,68,68,0.07)' : isTarget ? 'rgba(0,255,150,0.08)' : 'transparent',
                  borderLeft: isAi ? '2px solid rgba(239,68,68,0.6)' : isTarget ? '2px solid var(--color-terminal)' : '2px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Status dot */}
                <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: isAi ? '#ef4444' : p.isBot ? 'var(--brand-orange)' : 'var(--color-terminal)' }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: isAi ? '#fca5a5' : isTarget ? '#fff' : 'var(--text-muted)', fontWeight: isAi || isTarget ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                    {isAi && <span style={{ color: '#ef4444', fontSize: '0.6rem', marginLeft: 4 }}>🤖 AI</span>}
                    {!isAi && p.isBot && <span style={{ color: 'var(--brand-orange)', fontSize: '0.6rem', marginLeft: 4 }}>BOT</span>}
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
            CHAT
          </div>
          <div ref={chatRef} style={{ maxHeight: 150, overflowY: 'auto', padding: '0 0.5rem 0.5rem' }}>
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

      {/* ── Floating chat feed overlay (bottom-centre, always visible) ────── */}
      <div style={{
        position: 'absolute', bottom: '3rem',
        left: '50%', transform: 'translateX(-50%)',
        width: 420, maxWidth: 'calc(100vw - 320px)',
        zIndex: 25, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', gap: '0.2rem',
      }}>
        {chatLog.slice(-5).map((entry, i, arr) => {
          const opacity = 0.35 + (i / Math.max(arr.length - 1, 1)) * 0.65
          return (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.07)',
              padding: '0.3rem 0.7rem',
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
              opacity,
              backdropFilter: 'blur(2px)',
            }}>
              <span style={{ color: 'var(--color-terminal)' }}>{entry.name}: </span>
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{entry.text}</span>
            </div>
          )
        })}
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

      {/* ── Meeting overlay (spectator view) ──────────────────── */}
      {meetingPhase !== 'none' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(3px)',
          zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 520, maxWidth: 'calc(100vw - 2rem)',
            background: 'rgba(10,10,10,0.97)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'var(--font-mono)',
            maxHeight: '80vh',
          }}>
            {/* Header */}
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.12em' }}>
                ⚠ ALL HANDS MEETING
              </span>
              {meetingPhase === 'chat' && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
                  OPEN DISCUSSION — {meetingTimeLeft}s
                </span>
              )}
              {meetingPhase === 'voting' && (
                <span style={{ color: '#f59e0b', fontSize: '0.72rem' }}>VOTING IN PROGRESS…</span>
              )}
              {meetingPhase === 'result' && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>RESULT</span>
              )}
            </div>

            {/* Result screen */}
            {meetingPhase === 'result' && meetingResult && (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                {meetingResult.ejected ? (
                  <>
                    <div style={{ fontSize: '1.1rem', color: '#ef4444', marginBottom: '0.5rem', fontWeight: 700 }}>
                      {meetingResult.ejected} WAS REMOVED
                    </div>
                    <div style={{ color: meetingResult.wasAi ? '#22c55e' : '#ef4444', fontSize: '0.8rem', marginBottom: '1rem' }}>
                      {meetingResult.wasAi ? 'They were an AI — good call!' : 'They were not an AI…'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
                    No majority — nobody removed
                  </div>
                )}
                {/* Vote breakdown */}
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem', letterSpacing: '0.08em' }}>
                  VOTE BREAKDOWN
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                  {Object.entries(meetingResult.votes).map(([voter, target]) => (
                    <div key={voter} style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.85)' }}>{voter}</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}> → </span>
                      <span style={{ color: target === 'skip' ? 'rgba(255,255,255,0.35)' : '#f59e0b' }}>{target}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat feed during discussion / voting */}
            {(meetingPhase === 'chat' || meetingPhase === 'voting') && (
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left: chat log */}
                <div
                  ref={meetingChatRef}
                  style={{
                    flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem',
                    display: 'flex', flexDirection: 'column', gap: '0.25rem',
                    minHeight: 240, maxHeight: 380,
                  }}
                >
                  {meetingChat.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', textAlign: 'center', marginTop: '2rem' }}>
                      Waiting for discussion to begin…
                    </div>
                  )}
                  {meetingChat.map((entry, i) => (
                    <div key={i} style={{ fontSize: '0.73rem', lineHeight: 1.4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: '0.35rem' }}>{entry.time}</span>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>{entry.name}: </span>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>{entry.text}</span>
                    </div>
                  ))}
                  {meetingPhase === 'voting' && (
                    <div style={{ marginTop: '0.5rem', color: '#f59e0b', fontSize: '0.72rem', opacity: 0.8 }}>
                      ⏳ Bots are casting their votes…
                    </div>
                  )}
                </div>
                {/* Right: live tally (only during vote phase) */}
                {meetingPhase === 'voting' && Object.keys(liveTally).length > 0 && (
                  <div style={{
                    width: 130, borderLeft: '1px solid rgba(255,255,255,0.08)',
                    padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem',
                    flexShrink: 0,
                  }}>
                    <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '0.1rem' }}>
                      LIVE VOTES
                    </div>
                    {Object.entries(liveTally)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
                            {name}
                          </div>
                          <div style={{
                            background: '#f59e0b', color: '#000', fontSize: '0.6rem', fontWeight: 700,
                            padding: '0 0.3rem', borderRadius: 2, minWidth: 18, textAlign: 'center',
                          }}>
                            {count}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}

            {/* Footer hint */}
            <div style={{
              padding: '0.4rem 0.75rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em',
            }}>
              👁 SPECTATING — you cannot vote
            </div>
          </div>
        </div>
      )}

      {/* ── Retro side panel (spectator view — shown instead of RetroScreen) ─── */}
      {retroInfo && (
        <div style={{
          position: 'absolute',
          top: '4.5rem', right: '1rem',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 280,
            background: 'rgba(5,5,15,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontFamily: 'var(--font-mono)',
            maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto',
            boxShadow: '0 0 24px rgba(0,0,0,0.6)',
          }}>
            {/* Header */}
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.12em' }}>
                📋 SPRINT {retroInfo.sprint} RETRO
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                color: retroInfo.quotaMet ? '#4ade80' : '#f87171',
              }}>
                {retroInfo.quotaMet ? '✓ QUOTA MET' : '✗ QUOTA MISSED'}
              </span>
            </div>

            {/* Stats */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                TASKS COMPLETED THIS SPRINT
              </div>
              {retroInfo.stats
                .filter(s => !s.sessionId.startsWith('bot-') || s.completed > 0)
                .sort((a, b) => b.completed - a.completed)
                .map(s => (
                  <div key={s.sessionId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <div style={{ flex: 1, fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: '0.15rem' }}>
                      {Array.from({ length: Math.max(s.completed, 1) }).map((_, i) => (
                        <div key={i} style={{
                          width: 10, height: 10,
                          background: i < s.completed ? '#4ade80' : 'rgba(255,255,255,0.1)',
                          borderRadius: 2,
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#4ade80', minWidth: 20, textAlign: 'right' }}>
                      {s.completed}
                    </div>
                  </div>
                ))}
            </div>

            {/* Perk status */}
            <div style={{ padding: '0.75rem 1rem' }}>
              {retroInfo.perk ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
                    PERK SELECTED FOR NEXT SPRINT
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 700 }}>⚡ {retroInfo.perk}</div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                  ⏳ Bots selecting next sprint perk…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sprint master message (shown after vote result) ─── */}
      {sprintMasterMsg && (
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 60,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingBottom: '4rem',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(5,5,15,0.96)',
            border: '1px solid rgba(245,158,11,0.4)',
            padding: '0.85rem 1.4rem',
            maxWidth: 560, fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
            color: '#fbbf24', lineHeight: 1.5, letterSpacing: '0.04em',
            boxShadow: '0 0 30px rgba(245,158,11,0.15)',
          }}>
            {sprintMasterMsg}
          </div>
        </div>
      )}

      {/* ── Game end overlay ────────────────────────────────────── */}
      {gameEnd && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 80,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{
            border: `1px solid ${gameEnd.winner === 'workforce' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            background: 'rgba(5,5,15,0.97)',
            padding: '2.5rem 3rem', maxWidth: 500, textAlign: 'center',
            boxShadow: `0 0 40px ${gameEnd.winner === 'workforce' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
              {gameEnd.winner === 'workforce' ? '✅' : '🤖'}
            </div>
            <div style={{
              fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '0.5rem',
              color: gameEnd.winner === 'workforce' ? '#4ade80' : '#ef4444',
            }}>
              {gameEnd.winner === 'workforce' ? 'WORKFORCE WINS' : 'ROGUE AI WINS'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', lineHeight: 1.5 }}>
              {gameEnd.reason}
            </div>
            <button
              onClick={() => { clearRoom(); onNavigate('main-menu') }}
              style={{
                background: 'transparent',
                border: `1px solid ${gameEnd.winner === 'workforce' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                color: gameEnd.winner === 'workforce' ? '#4ade80' : '#ef4444',
                padding: '0.6rem 2rem', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '0.78rem', letterSpacing: '0.1em',
              }}
            >
              BACK TO MENU
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
