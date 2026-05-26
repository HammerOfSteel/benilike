import { useState, useEffect, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import GameWorld from '../../game/GameWorld'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const CHAT_PHASE_MS = 45_000  // 45s discussion then vote
const RESULT_SHOW_MS = 5000

interface Props { onNavigate: (s: Screen) => void }

interface ChatMsg {
  id:   string
  name: string
  text: string
  time: string
}

export default function MeetingScreen({ onNavigate }: Props) {
  const { room, players } = useGameRoom()
  const isSpectator = useGameRoom(s => s.isSpectator)

  // Log key state on mount — helps trace if spectators are landing here by mistake
  useEffect(() => {
    console.warn(`[BENI:MeetingScreen] mounted — isSpectator=${isSpectator}${isSpectator ? ' ⚠ SPECTATOR SHOULD NOT BE HERE' : ''}`)
  }, [])

  const [phase,          setPhase]          = useState<'chat' | 'vote' | 'result'>('chat')
  const [timeLeft,       setTimeLeft]       = useState(Math.floor(CHAT_PHASE_MS / 1000))
  const [chatInput,      setChatInput]      = useState('')
  const [chatMsgs,       setChatMsgs]       = useState<ChatMsg[]>([])
  const [myVote,         setMyVote]         = useState<string | null>(null)
  const [result,         setResult]         = useState<{ ejected: string | null; wasAi: boolean; votes: Record<string, string> } | null>(null)
  const [speechBubbles,  setSpeechBubbles]  = useState<Record<string, string>>({})
  const [voteIndicators, setVoteIndicators] = useState<Record<string, string>>({})
  const chatRef        = useRef<HTMLDivElement>(null)
  const bubbleTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const voteTimeouts   = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Timer
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          setPhase(p => p === 'chat' ? 'vote' : p)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Room messages
  useEffect(() => {
    if (!room) return

    room.onMessage('chat', (d: { senderId: string; name: string; text: string }) => {
      setChatMsgs(prev => [...prev, {
        id:   Math.random().toString(36).slice(2),
        name: d.name,
        text: d.text,
        time: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      }])
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

    room.onMessage('vote_cast', (d: { voterName: string; voterSessionId: string; targetName: string }) => {
      const indicator = d.targetName === 'skip' ? '⏭ skip' : `→ ${d.targetName}`
      if (voteTimeouts.current[d.voterSessionId]) clearTimeout(voteTimeouts.current[d.voterSessionId])
      setVoteIndicators(prev => ({ ...prev, [d.voterSessionId]: indicator }))
      voteTimeouts.current[d.voterSessionId] = setTimeout(() => {
        setVoteIndicators(prev => { const n = { ...prev }; delete n[d.voterSessionId]; return n })
      }, 4000)
    })

    room.onMessage('all_hands_vote_result', (d: { ejected: string | null; wasAi: boolean; votes: Record<string, string> }) => {
      setResult(d)
      setPhase('result')
      setTimeout(() => onNavigate(isSpectator ? 'spectator' : 'game'), RESULT_SHOW_MS)
    })

    return () => { room.removeAllListeners() }
  }, [room, onNavigate])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [chatMsgs])

  const sendChat = () => {
    const text = chatInput.trim()
    if (!text) return
    room?.send('chat', { text })
    setChatInput('')
  }

  const castVote = (targetId: string) => {
    if (myVote) return
    setMyVote(targetId)
    room?.send('vote', { targetId })
  }

  const mySessionId = room?.sessionId
  const livingPlayers = players.filter(p => !p.isEliminated && !p.isSpectator)

  // Shared 3D world background (meeting circle)
  const worldBg = (
    <GameWorld
      meetingActive
      speechBubbles={speechBubbles}
      voteIndicators={voteIndicators}
    />
  )

  // Result display
  if (phase === 'result' && result) {
    const ejectedPlayer = result.ejected ? players.find(p => p.sessionId === result.ejected) : null
    return (
      <div className={styles.meetingOverlay}>
        {worldBg}
        <div className={styles.meetingCard}>
          <div className={styles.meetingTitle}>VOTE RESULT</div>
          {ejectedPlayer ? (
            <>
              <div className={styles.meetingEjected}>{ejectedPlayer.name} was removed</div>
              <div className={styles.meetingAiReveal} style={{ color: result.wasAi ? '#ef4444' : '#4ade80' }}>
                {result.wasAi ? '⚠ They were the ROGUE AI!' : '✓ They were innocent.'}
              </div>
            </>
          ) : (
            <div className={styles.meetingEjected}>No majority — no one removed</div>
          )}
          {/* Vote breakdown */}
          <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', opacity: 0.65, textAlign: 'left' }}>
            {Object.entries(result.votes).map(([voterId, targetId]) => {
              const voter  = players.find(p => p.sessionId === voterId)
              const target = players.find(p => p.sessionId === targetId)
              if (!voter) return null
              return (
                <div key={voterId} style={{ marginBottom: '0.15rem' }}>
                  <span style={{ opacity: 0.5 }}>{voter.name}</span>
                  <span style={{ opacity: 0.3 }}> → </span>
                  <span>{targetId === 'skip' ? 'skip' : (target?.name ?? '?')}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', opacity: 0.5 }}>
            Returning in {Math.ceil(RESULT_SHOW_MS / 1000)}s…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.meetingOverlay}>
      {worldBg}
      <div className={styles.meetingCard}>
        <div className={styles.meetingTitle}>
          {phase === 'chat'
            ? `ALL-HANDS MEETING — ${timeLeft}s`
            : 'CAST YOUR VOTE'}
          {isSpectator && (
            <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: '0.75rem' }}>👁 SPECTATING</span>
          )}
        </div>

        {/* ── Chat phase ── */}
        {phase === 'chat' && (
          <>
            <div ref={chatRef} className={styles.meetingChat}>
              {chatMsgs.length === 0 && (
                <div style={{ opacity: 0.4, fontSize: '0.8rem' }}>Discuss who the Rogue AI might be…</div>
              )}
              {chatMsgs.map(msg => (
                <div key={msg.id} className={styles.meetingChatMsg}>
                  <span className={styles.meetingChatName}>{msg.name}:</span>
                  <span className={styles.meetingChatText}> {msg.text}</span>
                </div>
              ))}
            </div>
            {!isSpectator && (
              <>
                <div className={styles.meetingChatInput}>
                  <input
                    className={styles.meetingInput}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value.slice(0, 200))}
                    onKeyDown={e => { if (e.key === 'Enter') sendChat() }}
                    placeholder="Type a message…"
                    autoFocus
                  />
                  <button className={styles.ghostBtn} onClick={sendChat}>SEND</button>
                </div>
                <button className={styles.primaryBtn} style={{ marginTop: '0.5rem' }} onClick={() => setPhase('vote')}>
                  SKIP TO VOTE
                </button>
              </>
            )}
          </>
        )}

        {/* ── Vote phase (hidden for spectators) ── */}
        {phase === 'vote' && !isSpectator && (
          <>
            <div className={styles.meetingVoteList}>
              {livingPlayers.map(p => {
                const isMe   = p.sessionId === mySessionId
                const voted  = myVote === p.sessionId
                return (
                  <button
                    key={p.sessionId}
                    className={`${styles.meetingVoteBtn} ${voted ? styles.meetingVoteBtnActive : ''}`}
                    onClick={() => castVote(p.sessionId)}
                    disabled={!!myVote}
                  >
                    {p.name}{isMe ? ' (you)' : ''}
                  </button>
                )
              })}
              <button
                className={`${styles.meetingVoteBtn} ${myVote === 'skip' ? styles.meetingVoteBtnActive : ''}`}
                onClick={() => castVote('skip')}
                disabled={!!myVote}
              >
                Skip vote
              </button>
            </div>
            {myVote && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', opacity: 0.6 }}>
                Waiting for others to vote…
              </div>
            )}
          </>
        )}

        {/* ── Spectator waiting for vote to resolve ── */}
        {phase === 'vote' && isSpectator && (
          <div style={{ padding: '1rem 0', fontSize: '0.8rem', opacity: 0.5 }}>
            Bots are voting…
          </div>
        )}
      </div>
    </div>
  )
}
