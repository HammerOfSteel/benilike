import { useState } from 'react'
import { ScreenShell } from '../shared/ScreenShell'
import type { Screen } from '../../App'
import styles from './screens.module.css'

interface Props { onNavigate: (s: Screen) => void }

const JOB_TITLES = [
  { name: 'IT Technician',   zone: 'Server Room / Network Closet',  tasks: 'Patch Terminal · Restart Server Rack · Cable Audit · Firewall Check' },
  { name: 'HR Officer',      zone: 'HR Corner',                      tasks: 'Security Vetting · Policy Review · Onboarding Docs' },
  { name: 'DevOps Engineer', zone: 'DevOps Den',                     tasks: 'CI Pipeline · System Monitor · Deploy Config' },
  { name: 'Finance Analyst', zone: 'Finance Floor',                  tasks: 'Budget Freeze · Expense Audit · Invoice Batch' },
  { name: 'Marketing',       zone: 'Marketing Hub',                  tasks: 'PR Campaign · Social Scheduling · Crisis Control' },
  { name: 'Admin',           zone: 'Main Office',                    tasks: 'Keycard Audit · Meeting Setup · Onboarding Docs' },
  { name: 'Management',      zone: 'Executive Suite',                tasks: 'Sprint Planning · Resource Allocation · Crisis Control' },
]

const SECTIONS = ['OVERVIEW', 'ROLES', 'THE ROGUE AI', 'WIN CONDITIONS', 'CONTROLS'] as const
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
          <p>BENILIKE is a <strong>3–8 player social deduction game</strong> set in a procedurally generated corporate office.</p>
          <p>All players are Benisoft employees completing their sprint tasks — except <strong>one</strong>. A Rogue AI has woken up inside the network and is hiding among the staff, doing real work as cover while quietly eliminating the workforce.</p>

          <div className={styles.tipBox}>
            <span className={styles.tipIcon}>ℹ</span>
            <span>You don't know who the AI is at the start. Watch behaviour, check who goes to unusual rooms, and report bodies immediately.</span>
          </div>

          <h4 className={styles.subhead}>// GAME LOOP</h4>
          <ol className={styles.orderedList}>
            <li>All players spawn with a job title and 3 assigned tasks.</li>
            <li>Complete your tasks to hit the sprint quota before the timer runs out.</li>
            <li>If a body is found, press E near it to call an All Hands meeting and vote out the AI.</li>
            <li>After each sprint, if the quota is met you vote on a perk for the next sprint.</li>
            <li>The match ends when the Workforce or Rogue AI hits their win condition.</li>
          </ol>

          <h4 className={styles.subhead}>// THE OFFICE</h4>
          <p>Every match takes place in a <strong>procedurally generated</strong> office with up to 2 floors and 8 zones: Main Office, Server Room, Network Closet, HR Corner, Finance Floor, DevOps Den, Marketing Hub, and Executive Suite.</p>
          <p>Stations glow when you have the task for that location. Hold E to complete them — each task takes 3–5 seconds of uninterrupted hold time.</p>
        </div>
      )}

      {tab === 'ROLES' && (
        <div className={styles.prose}>
          <p>Every player gets a <strong>job title</strong> that determines their 3 assigned tasks and home zones. Titles are visible to all players — they are your cover story, not a secret.</p>
          <div className={styles.tipBox}>
            <span className={styles.tipIcon}>⚠</span>
            <span>The Rogue AI also gets a job title and assigned tasks. A player doing their job is not proof of innocence.</span>
          </div>
          <div style={{ marginTop: '1rem' }}>
            {JOB_TITLES.map(r => (
              <div key={r.name} className={`${styles.roleCard} ${styles.roleCardW}`} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className={styles.roleName}>{r.name}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{r.zone}</span>
                </div>
                <span className={styles.roleDesc}>{r.tasks}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'THE ROGUE AI' && (
        <div className={styles.prose}>
          <p>One player is secretly assigned the <strong>Rogue AI</strong> role. They have the same job title, same tasks, and look identical to everyone else — but run a hidden mission alongside their day job.</p>

          <h4 className={styles.subhead}>// AI SECRET TASKS (Reconnaissance)</h4>
          <p>The AI must complete 3 private tasks spread across the map each sprint:</p>
          <ul className={styles.winList}>
            <li><strong>Index Personnel Records</strong> — HR Corner (6 s hold)</li>
            <li><strong>Analyse Audit Logs</strong> — Server Room (7 s hold)</li>
            <li><strong>Map Network Topology</strong> — Network Closet (6.5 s hold)</li>
          </ul>
          <p>These tasks look identical to normal work from the outside.</p>

          <h4 className={styles.subhead}>// SPRINT BUFFS</h4>
          <p>Completing all 3 AI tasks in a sprint unlocks escalating abilities:</p>
          <ul className={styles.winList}>
            <li><strong>1st sprint complete:</strong> Vote counts x2 in the next All Hands meeting</li>
            <li><strong>2nd sprint complete:</strong> Invisibility unlocked — hold Q for 3 s to vanish for 5 s (30 s cooldown, cancelled by movement)</li>
          </ul>

          <h4 className={styles.subhead}>// KILL MECHANIC</h4>
          <p>The AI can eliminate workers at any time. Walk up to a player and press E — <strong>always available</strong>, 30 s cooldown. The victim's character falls to the ground and turns pale. Anyone who finds the body can report it by pressing E near it.</p>

          <div className={styles.tipBox}>
            <span className={styles.tipIcon}>ℹ</span>
            <span>Kill carefully — each body is a report waiting to happen. The AI wins only when just 1 worker remains.</span>
          </div>
        </div>
      )}

      {tab === 'WIN CONDITIONS' && (
        <div className={styles.winCols}>
          <div className={styles.winCard} data-faction="workforce">
            <h3 className={styles.winTitle}>WORKFORCE WINS IF…</h3>
            <ul className={styles.winList}>
              <li>The Rogue AI is correctly identified and voted out at an All Hands meeting, <strong>OR</strong></li>
              <li>All sprint quotas are completed without the AI winning first.</li>
            </ul>
            <div className={styles.tipBox} style={{ marginTop: '0.75rem' }}>
              <span className={styles.tipIcon}>⚠</span>
              <span>Voting out an innocent worker eliminates them. Be sure before you vote.</span>
            </div>
          </div>
          <div className={styles.winCard} data-faction="opposition">
            <h3 className={styles.winTitle}>ROGUE AI WINS IF…</h3>
            <ul className={styles.winList}>
              <li>Only 1 Workforce player remains alive (majority eliminated), <strong>OR</strong></li>
              <li>The AI survives all sprints without being identified.</li>
            </ul>
            <div className={styles.tipBox} style={{ marginTop: '0.75rem' }}>
              <span className={styles.tipIcon}>ℹ</span>
              <span>Blend in. Do real tasks. Only kill when truly alone — every body is evidence.</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'CONTROLS' && (
        <div className={styles.controlsGrid}>
          {[
            ['W A S D',       'Move'],
            ['E  (hold)',     'Complete task at workstation'],
            ['E  (press)',    'Report body · Call All Hands at wall terminal'],
            ['E  (AI only)',  'Eliminate nearby player  —  30 s cooldown'],
            ['Q  (AI hold)',  'Vanish 5 s  —  hold 3 s to activate  (unlocked sprint 2)'],
            ['R',             'Call All Hands emergency meeting'],
            ['RMB drag',      'Rotate camera'],
            ['Scroll wheel',  'Zoom in / out'],
          ].map(([key, action]) => (
            <div key={key} className={styles.controlRow}>
              <kbd className={styles.key}>{key}</kbd>
              <span className={styles.controlAction}>{action}</span>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', marginTop: '0.75rem', opacity: 0.5, fontSize: '0.72rem' }}>
            During All Hands: click a player name to cast your vote · click Skip to abstain
          </div>
        </div>
      )}
    </ScreenShell>
  )
}
