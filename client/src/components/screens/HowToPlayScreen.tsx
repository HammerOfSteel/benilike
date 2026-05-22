import { useState } from 'react'
import { ScreenShell } from '../shared/ScreenShell'
import type { Screen } from '../../App'
import styles from './screens.module.css'

interface Props { onNavigate: (s: Screen) => void }

const WORKFORCE_ROLES = [
  { name: 'IT Technician',   desc: 'Repairs terminals, disables rogue access points.' },
  { name: 'HR Officer',      desc: 'Investigates reports, can badge-check any zone.' },
  { name: 'DevOps Engineer', desc: 'Deploys patches, monitors server health.' },
  { name: 'Finance Analyst', desc: 'Tracks resource anomalies, locks accounts.' },
  { name: 'Marketing',       desc: 'Boosts morale. Exposes Opposition via rumour mill.' },
  { name: 'Admin',           desc: 'Accesses all doors. Vital support role.' },
  { name: 'Management',      desc: 'Has the mini-map. Coordinates the team.' },
]

const OPPOSITION_ROLES = [
  { name: 'Hacker',           desc: 'Remotely compromises systems. Leaves false trails.' },
  { name: 'Social Engineer',  desc: 'Impersonates staff. Manipulates interactions.' },
  { name: 'Spy',              desc: 'Observes without triggering alerts. Stealthy.' },
  { name: 'Saboteur',         desc: 'Breaks physical infrastructure. High noise.' },
  { name: 'Insider Threat',   desc: 'Planted within Workforce. Hardest to detect.' },
]

const SECTIONS = ['OVERVIEW', 'ROLES', 'WIN CONDITIONS', 'CONTROLS'] as const
type Tab = typeof SECTIONS[number]

export default function HowToPlayScreen({ onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>('OVERVIEW')

  return (
    <ScreenShell title="HOW TO PLAY" onBack={() => onNavigate('main-menu')} wide>
      <div className={styles.tabs}>
        {SECTIONS.map(s => (
          <button
            key={s}
            className={`${styles.tab} ${tab === s ? styles.tabActive : ''}`}
            onClick={() => setTab(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {tab === 'OVERVIEW' && (
        <div className={styles.prose}>
          <p>BENILIKE is a <strong>4–10 player asymmetric social-deduction roguelike</strong> set in a procedurally generated corporate office.</p>
          <p>Two factions battle in real time: the <span className={styles.workforceTag}>WORKFORCE</span> must identify and neutralise the <span className={styles.oppositionTag}>OPPOSITION</span> before critical infrastructure collapses.</p>
          <div className={styles.tipBox}>
            <span className={styles.tipIcon}>ℹ</span>
            <span>You do not know who is on which side at the start. Observe behaviour, complete tasks, and trust carefully.</span>
          </div>
          <h4 className={styles.subhead}>// GAME LOOP</h4>
          <ol className={styles.orderedList}>
            <li>All players spawn on Floor 1 with a role and a task list.</li>
            <li>Complete your tasks to maintain Reputation and unlock the exit.</li>
            <li>Opposition secretly sabotages objectives and eliminates workers.</li>
            <li>Workforce calls Emergency Meetings to vote on suspects.</li>
            <li>First faction to hit their win condition wins the round.</li>
          </ol>
          <h4 className={styles.subhead}>// REPUTATION</h4>
          <p>Your shared Reputation bar starts at 100. Sabotage lowers it. Resolving incidents raises it. If it hits 0, the Opposition wins automatically.</p>
        </div>
      )}

      {tab === 'ROLES' && (
        <div className={styles.roleColumns}>
          <div className={styles.roleCol}>
            <div className={styles.factionHeader} data-faction="workforce">
              <span className={styles.factionBadge}>◈</span>
              <h3>THE WORKFORCE</h3>
              <span className={styles.factionCount}>{WORKFORCE_ROLES.length} ROLES</span>
            </div>
            {WORKFORCE_ROLES.map(r => (
              <div key={r.name} className={`${styles.roleCard} ${styles.roleCardW}`}>
                <span className={styles.roleName}>{r.name}</span>
                <span className={styles.roleDesc}>{r.desc}</span>
              </div>
            ))}
          </div>
          <div className={styles.roleCol}>
            <div className={styles.factionHeader} data-faction="opposition">
              <span className={styles.factionBadge}>◇</span>
              <h3>THE OPPOSITION</h3>
              <span className={styles.factionCount}>{OPPOSITION_ROLES.length} ROLES</span>
            </div>
            {OPPOSITION_ROLES.map(r => (
              <div key={r.name} className={`${styles.roleCard} ${styles.roleCardO}`}>
                <span className={styles.roleName}>{r.name}</span>
                <span className={styles.roleDesc}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'WIN CONDITIONS' && (
        <div className={styles.winCols}>
          <div className={styles.winCard} data-faction="workforce">
            <h3 className={styles.winTitle}>◈ WORKFORCE WINS IF…</h3>
            <ul className={styles.winList}>
              <li>All Opposition members are voted out, OR</li>
              <li>All critical tasks are completed before Reputation hits 0, OR</li>
              <li>The Opposition is exposed via a unanimous Emergency Meeting vote.</li>
            </ul>
          </div>
          <div className={styles.winCard} data-faction="opposition">
            <h3 className={styles.winTitle}>◇ OPPOSITION WINS IF…</h3>
            <ul className={styles.winList}>
              <li>Reputation reaches 0 (full infrastructure collapse), OR</li>
              <li>Opposition reaches numerical parity with Workforce, OR</li>
              <li>The primary target (Management) is eliminated first.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'CONTROLS' && (
        <div className={styles.controlsGrid}>
          {[
            ['W A S D', 'Move'],
            ['E  /  Space', 'Interact with object or person'],
            ['Shift', 'Sprint (uses stamina)'],
            ['Q', 'Use role ability'],
            ['Tab', 'Player list'],
            ['Escape', 'Emergency Meeting / Pause'],
            ['M', 'Mini-map (Management role only)'],
            ['1 – 9', 'Inventory hotbar'],
            ['Left Click', 'Primary action'],
            ['Right Click', 'Secondary / inspect'],
          ].map(([key, action]) => (
            <div key={key} className={styles.controlRow}>
              <kbd className={styles.key}>{key}</kbd>
              <span className={styles.controlAction}>{action}</span>
            </div>
          ))}
        </div>
      )}
    </ScreenShell>
  )
}
