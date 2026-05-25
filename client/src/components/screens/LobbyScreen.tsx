import { useEffect, useRef, useState } from 'react'
import { ScreenShell } from '../shared/ScreenShell'
import { TerminalLog } from '../shared/TerminalLog'
import type { TerminalLine } from '../shared/TerminalLog'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import type { Screen } from '../../App'
import styles from './screens.module.css'

interface Props { onNavigate: (s: Screen) => void }

export default function LobbyScreen({ onNavigate }: Props) {
  const { room, myRole, myFaction, players, incidents, clearRoom } = useGameRoom()
  const [termLines, setTermLines]     = useState<TerminalLine[]>([])
  const prevIncidentLen               = useRef(0)

  // Sync Colyseus state → React
  useEffect(() => {
    if (!room) return

    // State change — update player list
    room.onStateChange((state: any) => {
      useGameRoom.getState().setPlayers(
        Array.from((state.players as Map<string, any>).values()).map((p: any) => ({
          sessionId: p.sessionId,
          name:      p.name,
          x:         p.x      ?? 0,
          z:         p.z      ?? 0,
          facing:    p.facing ?? 0,
          faction:   p.faction ?? '',
          role:      p.role   ?? '',
          connected: p.connected,
          isBot:     p.isBot  ?? false,
        }))
      )
    })

    // Server-broadcast messages
    room.onMessage('incident', (data: { message: string; severity: string; time: string }) => {
      useGameRoom.getState().addIncident(data.message, data.severity as any, data.time)
    })

    room.onMessage('role_assigned', (data: { role: string; faction: string }) => {
      useGameRoom.getState().setRole(data.role as any, data.faction as any)
    })

    room.onMessage('game_end', () => {
      onNavigate('main-menu')
    })

    room.onMessage('game_start', () => {
      onNavigate('briefing')
    })

    return () => { room.removeAllListeners() }
  }, [room, onNavigate])

  // Append new incidents to terminal lines (only new ones)
  useEffect(() => {
    if (incidents.length === prevIncidentLen.current) return
    const newOnes = incidents.slice(prevIncidentLen.current)
    prevIncidentLen.current = incidents.length
    setTermLines(prev => [...prev, ...newOnes.map(i => ({
      text: i.text,
      type: i.type,
      time: i.time,
    }))])
  }, [incidents])

  const handleLeave = () => {
    room?.leave()
    clearRoom()
    onNavigate('main-menu')
  }

  const handleStart = () => {
    if (!room) return
    room.send('start_game', {})
  }

  const roomCode = room?.id?.slice(0, 8).toUpperCase() ?? '---'
  const maxClients = (room as any)?.maxClients ?? 10

  return (
    <ScreenShell
      title="LOBBY"
      eyebrow={`ROOM ${roomCode} · WAITING FOR PLAYERS`}
      onBack={handleLeave}
    >
      <div className={styles.lobbyLayout}>

        {/* Room code */}
        <div className={styles.lobbyCodeBlock}>
          <span className={styles.fieldLabel}>SHARE THIS CODE</span>
          <div className={styles.lobbyCode}>{roomCode}</div>
          <span className={styles.roomCodeHint}>Other players enter this code on the Join Game screen</span>
        </div>

        {/* Player list */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            // CONNECTED OPERATIVES — {players.length}/{maxClients}
          </h3>
          <div className={styles.playerList}>
            {players.length === 0 && (
              <div className={styles.lobbyEmpty}>Waiting for players to join…</div>
            )}
            {players.map(p => {
              const isMe = p.sessionId === room?.sessionId
              return (
                <div key={p.sessionId} className={`${styles.playerRow} ${!p.connected ? styles.playerRowDim : ''}`}>
                  <span className={styles.playerName}>
                    {p.name}
                    {isMe && <span className={styles.youBadge}> YOU</span>}
                  </span>
                  <span className={styles.playerStatus}>
                    {isMe && myFaction ? (
                      <>
                        <span className={myFaction === 'workforce' ? styles.workforceTag : styles.oppositionTag}>
                          {myFaction.toUpperCase()}
                        </span>
                        {' · '}
                        <span>{myRole ? ROLE_LABELS[myRole] : '—'}</span>
                      </>
                    ) : (
                      <span className={styles.playerStatusHidden}>OPERATIVE</span>
                    )}
                  </span>
                  <span className={`${styles.playerDot} ${p.connected ? styles.playerDotOn : ''}`} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Live incident feed */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>// CONSOLE</h3>
          <div className={styles.terminalBox} style={{ height: '130px' }}>
            {termLines.length > 0
              ? <TerminalLog lines={termLines} typingSpeed={12} />
              : <span className={styles.lobbyEmpty}>Waiting for server events…</span>
            }
          </div>
        </div>

        {/* Actions */}
        <div className={styles.lobbyActions}>
          <button className={styles.ghostBtn} onClick={handleLeave}>LEAVE ROOM</button>
          <button
            className={styles.primaryBtn}
            style={{ width: 'auto', padding: '0.65rem 2rem' }}
            onClick={handleStart}
            disabled={!room}
          >
            [ START GAME ]
          </button>
        </div>

      </div>
    </ScreenShell>
  )
}
