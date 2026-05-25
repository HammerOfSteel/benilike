import { useEffect, useState } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS, ABILITY_NAMES, ABILITY_DESCS } from '@shared/types'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const ROLE_OBJECTIVES: Record<string, string[]> = {
  it:              ['Repair the corporate terminal to 100%', 'Hold [E] near the glowing terminal in the server room'],
  hr:              ['Restore personnel systems',             'Hold [E] near the terminal'],
  devops:          ['Secure the infrastructure',             'Hold [E] near the terminal'],
  finance:         ['Audit and restore financial systems',   'Hold [E] near the terminal'],
  marketing:       ['Run PR damage control',                 'Hold [E] near the terminal — you are workforce'],
  admin:           ['Restore administrative access',         'Hold [E] near the terminal'],
  management:      ['Re-establish executive control',        'Hold [E] near the terminal'],
  hacker:          ['Hack the corporate terminal to 0%',     'Hold [E] near the terminal in the server room'],
  social_engineer: ['Manipulate system records',             'Hold [E] near the terminal — blend in'],
  spy:             ['Extract classified data',               'Hold [E] near the terminal'],
  saboteur:        ['Corrupt the corporate servers',         'Hold [E] near the terminal'],
  insider:         ['Leak company secrets from within',      'Hold [E] near the terminal — you start disguised'],
}

const COUNTDOWN = 8

interface Props { onNavigate: (s: Screen) => void }

export default function BriefingScreen({ onNavigate }: Props) {
  const { myRole, myFaction } = useGameRoom()
  const [seconds, setSeconds] = useState(COUNTDOWN)

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(id)
          onNavigate('game')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [onNavigate])

  const isWorkforce  = myFaction === 'workforce'
  const roleLabel    = myRole ? (ROLE_LABELS[myRole] ?? myRole) : '—'
  const abilityName  = myRole ? (ABILITY_NAMES[myRole] ?? '—') : '—'
  const abilityDesc  = myRole ? (ABILITY_DESCS[myRole] ?? '') : ''
  const objectives   = myRole ? (ROLE_OBJECTIVES[myRole] ?? []) : []
  const factionLabel = isWorkforce ? '▲ WORKFORCE' : '▼ OPPOSITION'
  const cardClass    = `${styles.briefingCard} ${isWorkforce ? styles.briefingWorkforce : styles.briefingOpposition}`

  return (
    <div className={styles.briefingOverlay}>
      <div className={cardClass}>

        <div className={styles.briefingFaction}>{factionLabel}</div>
        <div className={styles.briefingRole}>{roleLabel}</div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>OBJECTIVE</div>
          {objectives.map((o, i) => (
            <div key={i} className={styles.briefingObjective}>{o}</div>
          ))}
        </div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>ABILITY · PRESS [Q]</div>
          <div className={styles.briefingAbilityName}>{abilityName}</div>
          <div className={styles.briefingAbilityDesc}>{abilityDesc}</div>
        </div>

        <div className={styles.briefingControls}>
          WASD · MOVE &nbsp;·&nbsp; E · INTERACT WITH TERMINAL &nbsp;·&nbsp; Q · ABILITY
        </div>

        <button className={styles.briefingBtn} onClick={() => onNavigate('game')}>
          LET'S GO — {seconds}s
        </button>

      </div>
    </div>
  )
}
