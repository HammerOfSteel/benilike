import { useState, useEffect } from 'react'
import { ScreenShell } from '../shared/ScreenShell'
import { colyseusClient } from '../../services/colyseusClient'
import { useGameRoom } from '../../store/useGameRoom'
import type { Screen } from '../../App'
import styles from './screens.module.css'

interface MockRoom {
  code: string
  name: string
  players: number
  max: number
  mapSize: 'SMALL' | 'MEDIUM' | 'LARGE'
  status: 'OPEN' | 'STARTING' | 'IN PROGRESS'
  workforce: number
  opposition: number
}

const MOCK_ROOMS: MockRoom[] = [
  { code: 'BNF-4XZ', name: 'DIGITAL_OFFSITE_7',  players: 3,  max: 6,  mapSize: 'SMALL',  status: 'OPEN',        workforce: 2, opposition: 0 },
  { code: 'KG8-2WP', name: 'ANNUAL_AUDIT_42',    players: 7,  max: 10, mapSize: 'LARGE',  status: 'OPEN',        workforce: 5, opposition: 1 },
  { code: 'ZR1-9LT', name: 'HOSTILE_STANDUP_11', players: 4,  max: 6,  mapSize: 'MEDIUM', status: 'STARTING',    workforce: 3, opposition: 1 },
  { code: 'MN5-3QC', name: 'REDACTED_SYNC_99',   players: 8,  max: 8,  mapSize: 'LARGE',  status: 'IN PROGRESS', workforce: 6, opposition: 2 },
]

interface Props { onNavigate: (s: Screen) => void }

export default function JoinGameScreen({ onNavigate }: Props) {
  const [code, setCode]           = useState('')
  const [joining, setJoining]     = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [liveRooms, setLiveRooms] = useState<MockRoom[] | null>(null)
  const { setRoom }               = useGameRoom()

  // Try to fetch live rooms; fall back to mock
  useEffect(() => {
    colyseusClient.getAvailableRooms('game_room')
      .then(rooms => {
        if (rooms.length === 0) { setLiveRooms(null); return }
        setLiveRooms(rooms.map(r => ({
          code:       r.roomId.slice(0, 8).toUpperCase(),
          name:       (r.metadata?.roomName as string | undefined) ?? r.roomId,
          players:    r.clients,
          max:        r.maxClients,
          mapSize:    ((r.metadata?.mapSize as string | undefined) ?? 'MEDIUM').toUpperCase() as MockRoom['mapSize'],
          status:     r.clients >= r.maxClients ? 'IN PROGRESS' : 'OPEN',
          workforce:  0,
          opposition: 0,
        })))
      })
      .catch(() => setLiveRooms(null))
  }, [])

  const handleJoin = async (roomCode: string) => {
    const cleaned = roomCode.replace(/[^A-Z0-9-]/gi, '').toUpperCase()
    if (cleaned.length < 7) { setError('Room code must be 7+ characters (e.g. BNF-4XZ)'); return }
    setError('')
    setJoining(cleaned)
    try {
      const room = await colyseusClient.joinById(cleaned)
      setRoom(room)
      onNavigate('lobby')
    } catch {
      setError('Room not found, full, or server offline.')
      setJoining(null)
    }
  }

  const handleInput = (v: string) => {
    let cleaned = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length > 3) cleaned = cleaned.slice(0, 3) + '-' + cleaned.slice(3)
    setCode(cleaned.slice(0, 7))
    setError('')
  }

  const statusColor = (s: MockRoom['status']) => {
    if (s === 'OPEN')        return 'var(--color-terminal)'
    if (s === 'STARTING')    return 'var(--brand-orange)'
    return 'var(--text-muted)'
  }

  return (
    <ScreenShell title="JOIN GAME" onBack={() => onNavigate('main-menu')}>
      <div className={styles.joinLayout}>

        {/* Code entry */}
        <div className={styles.codeBlock}>
          <label className={styles.fieldLabel}>ENTER ROOM CODE</label>
          <div className={styles.codeEntry}>
            <input
              className={styles.codeInput}
              value={code}
              onChange={e => handleInput(e.target.value)}
              placeholder="BNF-4XZ"
              spellCheck={false}
              maxLength={7}
              onKeyDown={e => e.key === 'Enter' && handleJoin(code)}
            />
            <button
              className={`${styles.primaryBtn} ${joining === code ? styles.primaryBtnLoading : ''}`}
              onClick={() => handleJoin(code)}
              disabled={joining !== null}
            >
              {joining === code ? '[ CONNECTING… ]' : '[ JOIN ]'}
            </button>
          </div>
          {error && <span className={styles.errorMsg}>{error}</span>}
        </div>

        <div className={styles.divider}><span>— OR BROWSE OPEN ROOMS —</span></div>

        {/* Room list */}
        <div className={styles.roomList}>
          <div className={styles.roomListHeader}>
            <span style={{ flex: 3 }}>ROOM NAME</span>
            <span style={{ flex: 1, textAlign: 'center' }}>CODE</span>
            <span style={{ flex: 1, textAlign: 'center' }}>SIZE</span>
            <span style={{ flex: 1, textAlign: 'center' }}>PLAYERS</span>
            <span style={{ flex: 1, textAlign: 'center' }}>STATUS</span>
            <span style={{ flex: 0.7 }} />
          </div>
          {(liveRooms ?? MOCK_ROOMS).map(room => (
            <div key={room.code} className={`${styles.roomRow} ${room.status === 'IN PROGRESS' ? styles.roomRowDim : ''}`}>
              <span style={{ flex: 3 }} className={styles.roomName}>{room.name}</span>
              <span style={{ flex: 1, textAlign: 'center' }} className={styles.roomCode2}>{room.code}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>{room.mapSize}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>
                {room.players}/{room.max}
                <span className={styles.slots}>
                  {room.status === 'OPEN' ? ` (${room.max - room.players} open)` : ''}
                </span>
              </span>
              <span style={{ flex: 1, textAlign: 'center', color: statusColor(room.status), fontSize: '0.67rem', letterSpacing: '0.06em' }}>
                {room.status}
              </span>
              <span style={{ flex: 0.7, textAlign: 'right' }}>
                {room.status !== 'IN PROGRESS' && (
                  <button
                    className={styles.smallBtn}
                    onClick={() => handleJoin(room.code)}
                    disabled={joining !== null}
                  >
                    {joining === room.code ? '…' : 'JOIN'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.refreshRow}>
          <span className={styles.refreshNote}>
            {liveRooms ? '// Live rooms from server' : '// Mock data — server offline'}
          </span>
        </div>

      </div>
    </ScreenShell>
  )
}
