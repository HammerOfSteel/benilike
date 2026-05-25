import { useState, useCallback, useEffect, useRef } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS, ABILITY_NAMES, ABILITY_DESCS, ABILITY_COOLDOWNS_MS } from '@shared/types'
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
  const { room, myRole, myFaction, players, terminalProgress, gameEnd, activeEffects, myLastAbilityTime, clearRoom } = useGameRoom()
  const [nearTerminal, setNearTerminal] = useState(false)
  const [interacting,  setInteracting]  = useState(false)
  const [cdPct, setCdPct] = useState(0)  // 0=ready, 1=just used
  const cdRaf = useRef<number>(0)

  const handleLeave = () => {
    room?.send('task_stop', {})
    room?.leave()
    clearRoom()
    onNavigate('main-menu')
  }

  const handleNear     = useCallback((v: boolean) => setNearTerminal(v), [])
  const handleInteract = useCallback((v: boolean) => setInteracting(v), [])

  // Live cooldown animation
  useEffect(() => {
    const cd = myRole ? (ABILITY_COOLDOWNS_MS[myRole] ?? 60_000) : 60_000
    const tick = () => {
      const elapsed = Date.now() - myLastAbilityTime
      setCdPct(Math.max(0, 1 - elapsed / cd))
      cdRaf.current = requestAnimationFrame(tick)
    }
    cdRaf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(cdRaf.current)
  }, [myRole, myLastAbilityTime])

  const pct         = Math.round(terminalProgress)
  const isWorkforce = myFaction === 'workforce'
  const barColor    = isWorkforce ? 'var(--color-terminal)' : 'var(--brand-orange)'
  const taskLabel   = isWorkforce ? 'REPAIR TERMINAL' : 'HACK TERMINAL'
  const objectives  = myRole ? (ROLE_OBJECTIVES[myRole] ?? []) : []
  const abilityName = myRole ? ABILITY_NAMES[myRole] : '—'
  const abilityDesc = myRole ? ABILITY_DESCS[myRole] : ''
  const abilityReady = cdPct <= 0
  const insiderUsed  = myRole === 'insider' && myLastAbilityTime > 0

  // Active effect banners
  const effectBanners: { label: string; color: string }[] = []
  if (activeEffects.hotfixActive && isWorkforce)    effectBanners.push({ label: '⚡ HOTFIX ACTIVE — 2× speed', color: '#4ADE80' })
  if (activeEffects.speedBoostActive && isWorkforce) effectBanners.push({ label: '🏃 SPRINT ACTIVE — +30% speed', color: '#a78bfa' })
  if (activeEffects.frozenActive && !isWorkforce)    effectBanners.push({ label: '❄ COOLDOWNS FROZEN', color: '#38bdf8' })
  if (activeEffects.marketingActive && !isWorkforce) effectBanners.push({ label: '📢 PR BLITZ — HACK RATE ½', color: '#f59e0b' })
  if (activeEffects.lockdownActive && !isWorkforce)  effectBanners.push({ label: '🔒 SERVER ROOM LOCKED', color: '#ef4444' })
  if (activeEffects.trapPlanted && isWorkforce)      effectBanners.push({ label: '⚠ TRAP AT TERMINAL', color: '#fb923c' })

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

        {/* Ability slot — bottom-right */}
        <div className={styles.hudCornerBR}>
          <span className={styles.fieldLabel}>ABILITY  [Q]</span>
          <div className={abilityReady && !insiderUsed ? styles.abilityReady : styles.abilityCooldown}>
            {insiderUsed ? 'USED' : abilityName}
          </div>
          <div className={styles.roomCodeHint}>{abilityDesc}</div>
          {!abilityReady && !insiderUsed && (
            <div className={styles.abilityBar}>
              <div className={styles.abilityBarFill} style={{ width: `${cdPct * 100}%` }} />
            </div>
          )}
        </div>
        {/* Active effect banners */}
        {effectBanners.length > 0 && (
          <div className={styles.hudEffectBanners}>
            {effectBanners.map((b, i) => (
              <div key={i} className={styles.hudEffectBanner} style={{ borderColor: b.color, color: b.color }}>
                {b.label}
              </div>
            ))}
          </div>
        )}
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
