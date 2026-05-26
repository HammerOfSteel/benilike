import { useState, useEffect, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import GameWorld from '../../game/GameWorld'
import type { Screen } from '../../App'
import styles from './screens.module.css'

// Server resolves after 45 s — vote panel is shown immediately so the player
// has the full window (not just the last 3 seconds)
const MEETING_DURATION_MS = 45_000
const RESULT_SHOW_MS = 5_000

interface Props { onNavigate: (s: Screen) => void }

export default function MeetingScreen({ onNavigate }: Props) {
  const { room, players } = useGameRoom()
  const isSpectator = useGameRoom(s => s.isSpectator)

  useEffect(() => {
    console.warn(`[BENI:MeetingScreen] mounted — isSpectator=${isSpectator}`)
  }, [])

  const [timeLeft,       setTimeLeft]       = useState(Math.floor(MEETING_DURATION_MS / 1000))
  const [chatInput,      setChatInput]      = useState('')
  const [myVote,         setMyVote]         = useState<string | null>(null)
  // result.votes is Record<voterName, targetName> (server sends names, not IDs)
  const [result,         setResult]         = useState<{ ejected: string | null; wasAi: boolean; votes: Record<string, string> } | null>(null)
  const [speechBubbles,  setSpeechBubbles]  = useState<Record<string, string>>({})
  const [voteIndicators, setVoteIndicators] = useState<Record<string, string>>({})
  const bubbleTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const voteTimeouts   = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Countdown
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  // Room messages
  useEffect(() => {
    if (!room) return

    room.onMessage('chat', (d: { senderId: string; name: string; text: string }) => {
      // Show ONLY as speech bubble in the 3-D world — no chat log panel
      const lp = useGameRoom.getState().players.find(p => p.name === d.name)
      if (lp) {
        if (bubbleTimeouts.current[lp.sessionId]) clearTimeout(bubbleTimeouts.current[lp.sessionId])
        setSpeechBubbles(prev => ({ ...prev, [lp.sessionId]: d.text }))
        bubbleTimeouts.current[lp.sessionId] = setTimeout(() => {
          setSpeechBubbles(prev => { const n = { ...prev }; delete n[lp.sessionId]; return n })
        }, 5000)
      }
    })

    room.onMessage('vote_cast', (d: { voterName: string; voterSessionId: string; targetName: string }) => {
      const indicator = d.targetName === 'skip' ? '\u23ed skip' : `\u2192 ${d.targetName}`
      if (voteTimeouts.current[d.voterSessionId]) clearTimeout(voteTimeouts.current[d.voterSessionId])
      setVoteIndicators(prev => ({ ...prev, [d.voterSessionId]: indicator }))
      voteTimeouts.current[d.voterSessionId] = setTimeout(() => {
        setVoteIndicators(prev => { const n = { ...prev }; delete n[d.voterSessionId]; return n })
      }, 4000)
    })

    room.onMessage('all_hands_vote_result', (d: { ejected: string | null; wasAi: boolean; votes: Record<string, string> }) => {
      setResult(d)
      setTimeout(() => onNavigate(isSpectator ? 'spectator' : 'game'), RESULT_SHOW_MS)
    })

    return () => { room.removeAllListeners() }
  }, [room, onNavigate, isSpectator])

  const sendChat = () => {
    const text = chatInput.trim()
    if (!text) return
    room?.send('chat', { text })
    setChatInput('')
  }

  const castVote = (targetId: string) => {
    if (myVote || isSpectator) return
    setMyVote(targetId)
    room?.send('vote', { targetId })
  }

  const mySessionId    = room?.sessionId
  const livingPlayers  = players.filter(p => !p.isEliminated && !p.isSpectator)

  const worldBg = (
    <GameWorld meetingActive speechBubbles={speechBubbles} voteIndicators={voteIndicators} />
  )

  // ── Result screen ────────────────────────────────────────────────────────────
  if (result) {
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
                {result.wasAi ? '\u26a0 They were the ROGUE AI!' : '\u2713 They were innocent.'}
              </div>
            </>
          ) : (
            <div className={styles.meetingEjected}>No majority — no one removed</div>
          )}
          {/* votes is Record<voterName, targetName> */}
          <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', opacity: 0.65, textAlign: 'left' }}>
            {Object.entries(result.votes).map(([voterName, targetName]) => (
              <div key={voterName} style={{ marginBottom: '0.15rem' }}>
                <span style={{ opacity: 0.5 }}>{voterName}</span>
                <span style={{ opacity: 0.3 }}> \u2192 </span>
                <span>{targetName}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', opacity: 0.5 }}>
            Returning in {Math.ceil(RESULT_SHOW_MS / 1000)}s…
          </div>
        </div>
      </div>
    )
  }

  // ── Active meeting ────────────────────────────────────────────────────────────
  return (
    <div className={styles.meetingOverlay}>
      {worldBg}
      <div className={styles.meetingCard}>

        <div className={styles.meetingTitle}>
          ALL-HANDS MEETING
          <span style={{ marginLeft: '0.6rem', fontVariantNumeric: 'tabular-nums', opacity: 0.65 }}>
            {timeLeft}s
          </span>
          {isSpectator && (
            <span style={{ fontSize: '0.7rem', opacity: 0.45, marginLeft: '0.75rem' }}>\ud83d\udc41 SPECTATING</span>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', opacity: 0.5, marginBottom: '0.6rem' }}>
          {isSpectator
            ? 'Watching the vote play out…'
            : myVote
              ? 'Vote cast — waiting for others…'
              : 'Vote now. Who is the Rogue AI?'}
        </div>

        {/* Vote buttons — available immediately for the full 45 s */}
        {!isSpectator && (
          <div className={styles.meetingVoteList}>
            {livingPlayers.map(p => {
              const isMe  = p.sessionId === mySessionId
              const voted = myVote === p.sessionId
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
        )}

        {/* Chat input — player’s message shows as their speech bubble in 3-D */}
        {!isSpectator && (
          <div className={styles.meetingChatInput} style={{ marginTop: '0.75rem' }}>
            <input
              className={styles.meetingInput}
              value={chatInput}
              onChange={e => setChatInput(e.target.value.slice(0, 200))}
              onKeyDown={e => { if (e.key === 'Enter') sendChat() }}
              placeholder="Say something… (Enter)"
            />
            <button className={styles.ghostBtn} onClick={sendChat}>SAY</button>
          </div>
        )}
      </div>
    </div>
  )
}
