import { useState, useCallback } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import GameWorld from '../../game/GameWorld'
import type { Screen } from '../../App'
import styles from './screens.module.css'

interface Props { onNavigate: (s: Screen) => void }

const ROLE_OBJECTIVES: Record<string, string[]> = {
  it:              ['Repair the corporate terminal', 'Hold [E] near the glowing terminal'],
  hr:              ['Restore personnel systems',     'Hold [E] near the terminal'],
  devops:          ['Secure the infrastructure',     'Hold [E] near the terminal'],
  finance:         ['Audit financial systems',       'Hold [E] near the terminal'],
  marketing:       ['Run PR damage control',         'Hold [E] near the terminal'],
  admin:           ['Restore administrative access', 'Hold [E] near the terminal'],
  management:      ['Re-establish executive control','Hold [E] near the terminal'],
  hacker:          ['Hack the corporate terminal',   'Hold [E] near the terminal'],
  social_engineer: ['Manipulate system records',     'Hold [E] near the terminal'],
  spy:             ['Extract classified data',       'Hold [E] near the terminal'],
  saboteur:        ['Corrupt the servers',           'Hold [E] near the terminal'],
  insider:         ['Leak company secrets',          'Hold [E] near the terminal'],
}

export default function GameScreen({ onNavigate }: Props) {
  const { room, myRole, myFaction, players, terminalProgress, gameEnd, clearRoom } = useGameRoom()
  const [nearTerminal, setNearTerminal] = useState(false)
  const [interacting,  setInteracting]  = useState(false)

  const handleLeave = () => {
    room?.send('task_stop', {})
    room?.leave()
    clearRoom()
    onNavigate('main-menu')
  }

  const handleNear     = useCallback((v: boolean) => setNearTerminal(v), [])
  const handleInteract = useCallback((v: boolean) => setInteracting(v), [])

  const pct         = Math.round(terminalProgress)
  const isWorkforce = myFaction === 'workforce'
  const barColor    = isWorkforce ? 'var(--color-terminal)' : 'var(--brand-orange)'
  const taskLabel   = isWorkforce ? 'REPAIR TERMINAL' : 'HACK TERMINAL'
  const objectives  = myRole ? (ROLE_OBJECTIVES[myRole] ?? []) : []

  if (gameEnd) {
    const iWon = gameEnd.winner === myFaction
    return (
      <div className={styles.endOverlay}>
        <div className={styles.endCard}>
          <div className={iWon ? styles.endFactionWon : styles.endFactionLost}>
            {iWon ? '// MISSION ACCOMPLISHED' : '// MISSION FAILED'}
          </div>
          <h1 className={styles.endHeadline}>
            {gameEnd.winner === 'workforce' ? 'WORKFORCE' : 'OPPOSITION'} WINS
          </h1>
          <p className={styles.endReason}>{gameEnd.reason}</p>
          <div className={styles.endStats}>
            <div className={styles.endStat}>
              <span className={styles.fieldLabel}>YOUR FACTION</span>
              <span className={myFaction === 'opposition' ? styles.oppositionTag : styles.workforceTag}>
                {myFaction?.toUpperCase() ?? '—'}
              </span>
            </div>
            <div className={styles.endStat}>
              <span className={styles.fieldLabel}>YOUR ROLE</span>
              <span className={styles.playerName}>{myRole ? ROLE_LABELS[myRole] : '—'}</span>
            </div>
            <div className={styles.endStat}>
              <span className={styles.fieldLabel}>TERMINAL</span>
              <span className={styles.playerName}>{pct}%</span>
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
    <>
      <GameWorld onNearTerminal={handleNear} onInteracting={handleInteract} gameOver={false} />
      <div className={styles.gameHud}>
        <div className={styles.hudCornerTL}>
          <span className={styles.fieldLabel}>ROLE</span>
          <div className={myFaction === 'opposition' ? styles.oppositionTag : styles.workforceTag}>
            {myRole ? ROLE_LABELS[myRole] : '—'}
          </div>
          {objectives.map((obj, i) => (
            <div key={i} className={styles.roomCodeHint} style={{ marginTop: i === 0 ? '0.5rem' : '0.15rem' }}>
              {i === 0 ? '▶ ' : '   '}{obj}
            </div>
          ))}
        </div>
        <div className={styles.hudCornerTR}>
          <span className={styles.fieldLabel}>OPERATIVES</span>
          <div className={styles.playerCount}>{players.length}</div>
          <div className={styles.roomCodeHint}>{myFaction?.toUpperCase() ?? ''}</div>
        </div>
        <div className={styles.hudTaskBar}>
          <div className={styles.hudTaskLabel}>{taskLabel}</div>
          <div className={styles.hudProgressTrack}>
            <div className={styles.hudProgressFill} style={{ width: `${pct}%`, background: barColor }} />
            <div className={styles.hudProgressMarker} style={{ left: `${pct}%` }} />
          </div>
          <div className={styles.hudProgressPct}>{pct}%</div>
        </div>
        {nearTerminal && (
          <div className={styles.hudCenter}>
            <div className={styles.hudPrompt}>
              {interacting
                ? `[ HOLD E ]  ${isWorkforce ? 'REPAIRING…' : 'HACKING…'}`
                : '[ E ]  INTERACT WITH TERMINAL'}
            </div>
          </div>
        )}
        <div className={styles.hudCornerBL}>
          <span className={styles.roomCodeHint}>WASD · MOVE &nbsp;&nbsp; E · INTERACT</span>
          <button className={styles.ghostBtn} onClick={handleLeave} style={{ marginTop: '0.4rem' }}>
            ESC LEAVE
          </button>
        </div>
      </div>
    </>
  )
}
