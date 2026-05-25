import { useState, useEffect } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const RETRO_MS = 45_000

const PERKS_BY_SIZE: Record<'small' | 'medium' | 'large', string[]> = {
  small:  ['Speed Boost', 'Task Discount'],
  medium: ['Speed Boost', 'Task Discount', 'Extra All-Hands'],
  large:  ['Speed Boost', 'Task Discount', 'Extra All-Hands', 'Quota Reduction'],
}

interface Props { onNavigate: (s: Screen) => void }

export default function RetroScreen({ onNavigate }: Props) {
  const { room, retroData, sprint } = useGameRoom()
  const [timeLeft,   setTimeLeft]   = useState(Math.floor(RETRO_MS / 1000))
  const [myPerkVote, setMyPerkVote] = useState<string | null>(null)

  // Timer
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); onNavigate('game'); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [onNavigate])

  // Perk awarded message
  useEffect(() => {
    if (!room) return
    room.onMessage('perk_awarded', (d: { perk: string }) => {
      useGameRoom.getState().addIncident(`Perk awarded: ${d.perk}`, 'success')
    })
    return () => { room.removeAllListeners() }
  }, [room])

  const castPerkVote = (perk: string) => {
    if (myPerkVote) return
    setMyPerkVote(perk)
    room?.send('perk_vote', { perk })
  }

  const size    = (sprint?.size ?? 'medium') as 'small' | 'medium' | 'large'
  const perks   = PERKS_BY_SIZE[size] ?? PERKS_BY_SIZE.medium
  const quotaMet = retroData?.quotaMet ?? false
  const sprintNum = retroData?.sprint ?? (sprint?.sprint ?? 1)
  const stats   = retroData?.stats ?? []

  return (
    <div className={styles.meetingOverlay}>
      <div className={styles.meetingCard}>
        <div className={styles.meetingTitle}>
          SPRINT {sprintNum} RETROSPECTIVE — {timeLeft}s
        </div>

        {/* Quota result */}
        <div className={styles.meetingEjected} style={{ color: quotaMet ? '#4ade80' : '#ef4444' }}>
          {quotaMet ? '✓ QUOTA MET' : '✗ QUOTA MISSED'}
        </div>

        {/* Per-player stats */}
        {stats.length > 0 && (
          <div className={styles.meetingVoteList}>
            {stats
              .sort((a, b) => b.completed - a.completed)
              .map(s => (
                <div key={s.sessionId} className={styles.meetingChatMsg} style={{ justifyContent: 'space-between' }}>
                  <span className={styles.meetingChatName}>{s.name}</span>
                  <span style={{ color: '#c8c0ff' }}>{s.completed} tasks</span>
                </div>
              ))
            }
          </div>
        )}

        {/* Perk vote */}
        <div style={{ marginTop: '1rem' }}>
          <div className={styles.meetingTitle} style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            VOTE FOR NEXT SPRINT PERK
          </div>
          <div className={styles.meetingVoteList}>
            {perks.map(perk => (
              <button
                key={perk}
                className={`${styles.meetingVoteBtn} ${myPerkVote === perk ? styles.meetingVoteBtnActive : ''}`}
                onClick={() => castPerkVote(perk)}
                disabled={!!myPerkVote}
              >
                {perk}
              </button>
            ))}
          </div>
          {myPerkVote && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>
              Voted for: {myPerkVote}
            </div>
          )}
        </div>

        <button className={styles.ghostBtn} style={{ marginTop: '0.75rem' }} onClick={() => onNavigate('game')}>
          CONTINUE
        </button>
      </div>
    </div>
  )
}
