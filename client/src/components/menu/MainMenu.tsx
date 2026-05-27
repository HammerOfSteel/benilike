import { useState, useEffect } from 'react'
import type { Screen } from '../../App'
import { TerminalLog } from '../shared/TerminalLog'
import type { TerminalLine } from '../shared/TerminalLog'
import styles from './MainMenu.module.css'

interface Props {
  onNavigate: (screen: Screen) => void
}

const MENU_ITEMS: { label: string; screen: Screen; description: string; key: string }[] = [
  {
    label: 'NEW GAME',
    screen: 'new-game',
    description: 'Host a session — generate an office floor plan and wait for operatives.',
    key: 'N',
  },
  {
    label: 'JOIN GAME',
    screen: 'join-game',
    description: 'Enter a room code and deploy into an active incident.',
    key: 'J',
  },
  {
    label: 'HOW TO PLAY',
    screen: 'how-to-play',
    description: 'Faction briefing — roles, objectives, and win conditions.',
    key: 'H',
  },
  {
    label: 'SETTINGS',
    screen: 'settings',
    description: 'Audio, display, keybindings, and accessibility options.',
    key: 'S',
  },
  {
    label: 'CREDITS',
    screen: 'credits',
    description: 'The team behind the incident.',
    key: 'C',
  },
]

// Rotating flavour taglines in dry corporate voice
const TAGLINES = [
  'Your quarterly performance review begins now.',
  'Please badge in before proceeding to your workstation.',
  'All incidents must be logged with IT before 17:00.',
  'Reminder: server room access requires Level 3 clearance.',
  'The all-hands meeting has been moved. Again.',
  'Your benefits package is fully intact. Probably.',
  'Payroll will be processed once the intrusion is contained.',
  'Sprint quota met. The anomaly is pleased.',
  'One of your colleagues is not who they say they are.',
  'Please do not approach unattended terminals on Floor 2.',
  'Body found in Network Closet. HR is investigating.',
  'Reminder: vote carefully. Wrongful termination has consequences.',
]

export default function MainMenu({ onNavigate }: Props) {
  const [selected, setSelected] = useState(0)
  const [tagline, setTagline] = useState(TAGLINES[0])
  const [taglineVisible, setTaglineVisible] = useState(true)
  const [booted, setBooted] = useState(false)

  // Boot animation delay
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 200)
    return () => clearTimeout(t)
  }, [])

  // Rotate taglines
  useEffect(() => {
    const cycle = setInterval(() => {
      setTaglineVisible(false)
      setTimeout(() => {
        setTagline(TAGLINES[Math.floor(Math.random() * TAGLINES.length)])
        setTaglineVisible(true)
      }, 400)
    }, 5000)
    return () => clearInterval(cycle)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')   setSelected(s => (s - 1 + MENU_ITEMS.length) % MENU_ITEMS.length)
      if (e.key === 'ArrowDown') setSelected(s => (s + 1) % MENU_ITEMS.length)
      if (e.key === 'Enter')     onNavigate(MENU_ITEMS[selected].screen)
      MENU_ITEMS.forEach((item, i) => {
        if (e.key.toUpperCase() === item.key) {
          setSelected(i)
          onNavigate(item.screen)
        }
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, onNavigate])

  return (
    <div className={`${styles.overlay} ${booted ? styles.booted : ''}`}>
      {/* ── Left panel ── */}
      <div className={styles.leftPanel}>
        {/* Logo / title */}
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>BENISOFT CORP · INCIDENT RESPONSE SIM</div>
          <h1 className={styles.title}>
            BENI
            <span className={styles.titleAccent}>LIKE</span>
          </h1>
          <div className={styles.titleCursor} aria-hidden />
          <p className={styles.subtitle}>v0.4.0 · phase-3-assets</p>
        </div>

        {/* Tagline */}
        <p className={`${styles.tagline} ${taglineVisible ? styles.taglineVisible : styles.taglineHidden}`}>
          <span className={styles.taglinePrompt}>// </span>
          {tagline}
        </p>

        {/* Navigation */}
        <nav className={styles.nav} role="menu">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item.label}
              role="menuitem"
              className={`${styles.menuItem} ${i === selected ? styles.menuItemActive : ''}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => onNavigate(item.screen)}
            >
              <span className={styles.menuKey}>[{item.key}]</span>
              <span className={styles.menuLabel}>{item.label}</span>
              {i === selected && (
                <span className={styles.menuArrow} aria-hidden>▶</span>
              )}
            </button>
          ))}
        </nav>

        {/* Description of selected item */}
        <div className={styles.descriptionBox}>
          <span className={styles.descriptionPrompt}>{'>'} </span>
          <span className={styles.descriptionText}>{MENU_ITEMS[selected].description}</span>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <span>↑↓ NAVIGATE</span>
          <span>ENTER SELECT</span>
          <span>ESC BACK</span>
        </footer>
      </div>

      {/* ── Right panel — faction status board ── */}
      <div className={styles.rightPanel}>
        <StatusBoard />
      </div>
    </div>
  )
}

const INCIDENT_LINES: TerminalLine[] = [
  { time: '08:47', text: 'Sprint 1 started — quota: 12 tasks', type: 'info' },
  { time: '08:51', text: 'Patch Terminal completed — IT', type: 'success' },
  { time: '08:54', text: 'Unusual activity · Server Room', type: 'warn' },
  { time: '08:58', text: 'Sprint quota met — retro vote open', type: 'success' },
  { time: '09:03', text: '⚠ Body found — Network Closet', type: 'danger' },
  { time: '09:03', text: 'ALL HANDS called by Pita M.', type: 'warn' },
  { time: '09:05', text: 'Vote: Kai ejected. They were innocent.', type: 'danger' },
  { time: '09:08', text: 'Sprint 2 started — quota: 14 tasks', type: 'info' },
  { time: '09:11', text: 'Analyse Audit Logs completed — ???', type: 'warn' },
  { time: '09:14', text: '⚠ Body found — Finance Floor', type: 'danger' },
  { time: '09:14', text: 'ALL HANDS called by Alex R.', type: 'warn' },
  { time: '09:16', text: 'Vote: Rogue AI ejected. WORKFORCE WINS.', type: 'success' },
]

// ── Status board widget ────────────────────────────────────────────────────
function StatusBoard() {

  return (
    <div className={styles.statusBoard}>
      <div className={styles.statusHeader}>
        <span className={styles.statusDot} />
        BENISOFT INCIDENT CONSOLE
      </div>

      <div className={styles.statusSection}>
        <div className={styles.statusSectionTitle}>SPRINT PROGRESS</div>
        <div className={styles.repBar}>
          <div className={styles.repFill} style={{ width: '58%' }} />
        </div>
        <div className={styles.repLabel}>7 / 12 tasks &nbsp;<span style={{ color: 'var(--color-warning)' }}>SPRINT 2 ACTIVE</span></div>
      </div>

      <div className={styles.statusSection}>
        <div className={styles.statusSectionTitle}>WORKFORCE ROLES</div>
        <div className={styles.roleGrid}>
          {[
            { role: 'IT',  color: '#60A5FA', active: true },
            { role: 'HR',  color: '#A78BFA', active: true },
            { role: 'DEV', color: '#4ADE80', active: true },
            { role: 'MKT', color: '#FB923C', active: false },
            { role: 'FIN', color: '#FBBF24', active: true },
            { role: 'ADM', color: '#E879F9', active: true },
            { role: 'MGT', color: '#F9A8D4', active: false },
          ].map(({ role, color, active }) => (
            <div key={role} className={`${styles.roleChip} ${active ? '' : styles.roleChipInactive}`} style={{ borderColor: color, color }}>
              {role}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.statusSection}>
        <div className={styles.statusSectionTitle}>INCIDENT LOG</div>
        <div className={styles.logList}>
          <TerminalLog lines={INCIDENT_LINES} typingSpeed={18} loop />
        </div>
      </div>

      <div className={styles.statusSection}>
        <div className={styles.statusSectionTitle}>ROGUE AI STATUS</div>
        <div className={styles.objectives}>
          <div className={`${styles.obj} ${styles.objDone}`}>✓ Index Personnel Records</div>
          <div className={`${styles.obj} ${styles.objDone}`}>✓ Analyse Audit Logs</div>
          <div className={`${styles.obj} ${styles.objActive}`}>◉ Map Network Topology</div>
          <div className={`${styles.obj} ${styles.objPending}`}>○ Phase 1 Buff: Vote ×2</div>
        </div>
      </div>
    </div>
  )
}
