import { useState, useRef, useEffect } from 'react'
import { ScreenShell } from '../shared/ScreenShell'
import { colyseusClient } from '../../services/colyseusClient'
import { useGameRoom } from '../../store/useGameRoom'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const ROOM_ADJECTIVES = ['SILENT', 'BURNING', 'FROZEN', 'HAUNTED', 'DIGITAL', 'ANNUAL', 'HOSTILE', 'ISOLATED', 'REDACTED', 'EXPIRED']
const ROOM_NOUNS      = ['OFFSITE', 'STANDUP', 'RETRO', 'REVIEW', 'SPRINT', 'AUDIT', 'INCIDENT', 'DEBRIEF', 'SYNC', 'HANDOFF']

function generateName() {
  const adj  = ROOM_ADJECTIVES[Math.floor(Math.random() * ROOM_ADJECTIVES.length)]
  const noun = ROOM_NOUNS[Math.floor(Math.random() * ROOM_NOUNS.length)]
  const num  = Math.floor(Math.random() * 99) + 1
  return `${adj}_${noun}_${num}`
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 7 }, (_, i) => i === 3 ? '-' : chars[Math.floor(Math.random() * chars.length)]).join('')
}

interface Props { onNavigate: (s: Screen) => void }

export default function NewGameScreen({ onNavigate }: Props) {
  const [roomName, setRoomName]         = useState(generateName)
  const [mapSize, setMapSize]           = useState<'small' | 'medium' | 'large'>('medium')
  const [factions, setFactions]         = useState<'random' | 'manual' | 'balanced'>('balanced')
  const [maxPlayers, setMaxPlayers]     = useState(6)
  const [botCount, setBotCount]         = useState(3)
  const [spectateMode, setSpectateMode] = useState(false)
  const [roomCode, setRoomCode]         = useState<string | null>(null)
  const [creating, setCreating]         = useState(false)
  const [error, setError]               = useState('')
  const { setRoom, setSpectator }       = useGameRoom()
  const lobbyTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // In spectate mode, bots fill all non-host slots
  const effectiveBotCount = spectateMode ? maxPlayers - 1 : botCount

  // Cancel the auto-navigate timer if this screen unmounts before it fires
  useEffect(() => () => { if (lobbyTimerRef.current) clearTimeout(lobbyTimerRef.current) }, [])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const room = await colyseusClient.create('game_room', {
        roomName,
        mapSize,
        maxPlayers,
        factionAssignment: factions,
        botCount: effectiveBotCount,
        spectate: spectateMode,
      })
      setRoom(room)
      if (spectateMode) {
        console.log('[BENI:NewGameScreen] spectateMode=true \u2192 calling setSpectator(true)')
        setSpectator(true)
      }
      // Register handlers NOW — before LobbyScreen mounts — so no messages are missed
      room.onMessage('role_assigned', (data: { role: string; faction: string }) => {
        useGameRoom.getState().setRole(data.role as any, data.faction as any)
      })
      room.onMessage('game_end', (data: { winner: string; reason: string }) => {
        useGameRoom.getState().setGameEnd(data.winner, data.reason)
      })
      setRoomCode(room.id.slice(0, 8).toUpperCase())
      lobbyTimerRef.current = setTimeout(() => onNavigate('lobby'), 1800)
    } catch {
      // Server offline — show mock code for UI demo
      setRoomCode(generateCode())
      setError('// Server offline — mock code shown for demo')
      setCreating(false)
    }
  }

  return (
    <ScreenShell title="NEW GAME" onBack={() => onNavigate('main-menu')}>
      <div className={styles.formGrid}>

        {/* Room name */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>ROOM NAME</label>
          <div className={styles.inputRow}>
            <input
              className={styles.textInput}
              value={roomName}
              onChange={e => setRoomName(e.target.value.toUpperCase())}
              spellCheck={false}
              maxLength={28}
            />
            <button className={styles.ghostBtn} onClick={() => setRoomName(generateName())}>↺ GEN</button>
          </div>
        </div>

        {/* Map size */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>MAP SIZE</label>
          <div className={styles.segmented}>
            {(['small', 'medium', 'large'] as const).map(s => (
              <button
                key={s}
                className={`${styles.seg} ${mapSize === s ? styles.segActive : ''}`}
                onClick={() => setMapSize(s)}
              >
                {s.toUpperCase()}
                <span className={styles.segSub}>{s === 'small' ? '3 floors' : s === 'medium' ? '5 floors' : '8 floors'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Faction assignment */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>FACTION ASSIGNMENT</label>
          <div className={styles.segmented}>
            {(['random', 'manual', 'balanced'] as const).map(f => (
              <button
                key={f}
                className={`${styles.seg} ${factions === f ? styles.segActive : ''}`}
                onClick={() => setFactions(f)}
              >
                {f.toUpperCase()}
                <span className={styles.segSub}>{f === 'random' ? 'pure luck' : f === 'manual' ? 'host picks' : 'auto-balanced'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Player count */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>MAX PLAYERS — <span className={styles.playerCount}>{maxPlayers}</span></label>
          <div className={styles.sliderRow}>
            <span className={styles.sliderCap}>4</span>
            <input
              type="range" min={4} max={10} step={1}
              value={maxPlayers}
              onChange={e => setMaxPlayers(+e.target.value)}
              className={styles.slider}
            />
            <span className={styles.sliderCap}>10</span>
          </div>
          <div className={styles.playerPips}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`${styles.pip} ${i < maxPlayers ? styles.pipFilled : ''}`} />
            ))}
          </div>
        </div>

        {/* Bot players */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>BOT PLAYERS — <span className={styles.playerCount}>{effectiveBotCount}</span></label>
          <div className={styles.inputRow}>
            <button className={styles.ghostBtn} onClick={() => { setSpectateMode(false); setBotCount(c => Math.max(0, c - 1)) }} disabled={spectateMode}>−</button>
            <div className={styles.sliderRow} style={{ flex: 1 }}>
              <span className={styles.sliderCap}>0</span>
              <input
                type="range" min={0} max={9} step={1}
                value={effectiveBotCount}
                onChange={e => { setSpectateMode(false); setBotCount(+e.target.value) }}
                className={styles.slider}
                disabled={spectateMode}
              />
              <span className={styles.sliderCap}>9</span>
            </div>
            <button className={styles.ghostBtn} onClick={() => { setSpectateMode(false); setBotCount(c => Math.min(9, c + 1)) }} disabled={spectateMode}>+</button>
          </div>
          <div className={styles.playerPips}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={`${styles.pip} ${i < effectiveBotCount ? styles.pipFilled : ''}`} style={{ background: i < effectiveBotCount ? 'var(--brand-orange)' : undefined }} />
            ))}
          </div>
        </div>

        {/* Spectate mode toggle */}
        <div className={styles.formField}>
          <button
            className={`${styles.ghostBtn} ${spectateMode ? styles.segActive : ''}`}
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem 1rem', fontSize: '0.9rem', letterSpacing: '0.1em' }}
            onClick={() => setSpectateMode(m => !m)}
          >
            {spectateMode ? '👁 SPECTATE MODE ON — all bots will fill the game' : '👁 SPECTATE MODE — fill with bots & watch'}
          </button>
          {spectateMode && (
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--brand-orange)', marginTop: '0.4rem', opacity: 0.8 }}>
              {effectiveBotCount} bots · you will observe from the sidelines
            </div>
          )}
        </div>

        {/* Create button */}
        <div className={styles.formField}>
          {!roomCode ? (
            <button
              className={`${styles.primaryBtn} ${creating ? styles.primaryBtnLoading : ''}`}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? '[ ALLOCATING SERVER… ]' : '[ CREATE ROOM ]'}
            </button>
          ) : (
            <div className={styles.roomCodeBox}>
              <span className={styles.roomCodeLabel}>ROOM CODE</span>
              <span className={styles.roomCode}>{roomCode}</span>
              <span className={styles.roomCodeHint}>Share this code with players · expires in 15 min</span>
              {error && <span className={styles.errorMsg} style={{ marginTop: '0.25rem' }}>{error}</span>}
              {!error && (
                <button className={styles.primaryBtn} style={{ marginTop: '1rem' }}
                  onClick={() => onNavigate('lobby')}>
                  [ OPEN LOBBY ]
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </ScreenShell>
  )
}
