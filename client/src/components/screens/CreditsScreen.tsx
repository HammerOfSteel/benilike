import { ScreenShell } from '../shared/ScreenShell'
import { TerminalLog } from '../shared/TerminalLog'
import type { TerminalLine } from '../shared/TerminalLog'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const CREDIT_LINES: TerminalLine[] = [
  { text: '════════════════════════════════', type: 'system' },
  { text: '  BENISOFT CORP HACKATHON  2026 ', type: 'system' },
  { text: '  INCIDENT RESPONSE SIMULATOR  ', type: 'system' },
  { text: '════════════════════════════════', type: 'system' },
  { text: '' , type: 'info' },
  { text: '[ DEVELOPMENT TEAM ]', type: 'system' },
  { text: 'Terry Goleman ........... Lead Dev', type: 'success' },
  { text: 'Add your team here ......... Role', type: 'info' },
  { text: 'Add your team here ......... Role', type: 'info' },
  { text: '' , type: 'info' },
  { text: '[ BUILT WITH ]', type: 'system' },
  { text: 'React 18 + Vite ......... App shell', type: 'info' },
  { text: 'React Three Fiber ........ 3D scene', type: 'info' },
  { text: 'Three.js ................. Renderer', type: 'info' },
  { text: 'Colyseus ............... Multiplayer', type: 'info' },
  { text: 'Zustand ................. App state', type: 'info' },
  { text: 'TypeScript ............... Type safe', type: 'info' },
  { text: '' , type: 'info' },
  { text: '[ INSPIRATION ]', type: 'system' },
  { text: 'Benify / Benifex .......... The vibe', type: 'warn' },
  { text: 'Among Us ......... Social deduction', type: 'warn' },
  { text: 'Darkest Dungeon ......... Tone & dread', type: 'warn' },
  { text: 'Spy Party ........ Asymmetric tension', type: 'warn' },
  { text: 'Lethal Company ...... Corporate chaos', type: 'warn' },
  { text: '' , type: 'info' },
  { text: '[ SPECIAL THANKS ]', type: 'system' },
  { text: 'Everyone who showed up to build something', type: 'info' },
  { text: 'at 9am on a hackathon day.', type: 'info' },
  { text: '' , type: 'info' },
  { text: '════════════════════════════════', type: 'system' },
  { text: '// No employees were harmed in  ', type: 'success' },
  { text: '// the making of this simulation.', type: 'success' },
  { text: '// (The server room was a different story.)', type: 'success' },
  { text: '════════════════════════════════', type: 'system' },
]

interface Props { onNavigate: (s: Screen) => void }

export default function CreditsScreen({ onNavigate }: Props) {
  return (
    <ScreenShell title="CREDITS" onBack={() => onNavigate('main-menu')}>
      <div className={styles.terminalBox} style={{ height: '520px' }}>
        <TerminalLog lines={CREDIT_LINES} typingSpeed={14} />
      </div>
    </ScreenShell>
  )
}
