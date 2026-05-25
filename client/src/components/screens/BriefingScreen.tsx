import { useEffect, useState } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import { TASK_DEFS, AI_TASK_DEFS } from '@shared/tasks'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const COUNTDOWN = 10

const ZONE_LABELS: Record<string, string> = {
  main_office:    'Main Office',
  server_room:    'Server Room',
  network_closet: 'Network Closet',
  hr_corner:      'HR Corner',
  finance_floor:  'Finance Floor',
  devops_den:     'DevOps Den',
  marketing_hub:  'Marketing Hub',
  exec_suite:     'Executive Suite',
}

interface Props { onNavigate: (s: Screen) => void }

export default function BriefingScreen({ onNavigate }: Props) {
  const { myRole, myIsAi, myAssignedTasks, aiPhaseTasks } = useGameRoom()
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

  const roleLabel = myRole ? (ROLE_LABELS[myRole] ?? myRole) : '—'

  // Tasks assigned to this player
  const allTaskDefs = [...TASK_DEFS, ...AI_TASK_DEFS]
  const myTaskDefs  = myAssignedTasks
    .map(id => allTaskDefs.find(t => t.id === id))
    .filter(Boolean) as typeof allTaskDefs

  // AI-player phase tasks (shown separately in AI briefing card)
  const coverTasks = myTaskDefs.filter(t => t.category === 'workforce')
  const aiTasks    = myTaskDefs.filter(t => t.category === 'ai')

  return (
    <div className={styles.briefingOverlay}>
      {/* ── Normal worker card ── */}
      <div className={`${styles.briefingCard} ${styles.briefingWorkforce}`}>
        <div className={styles.briefingFaction}>▲ WORKFORCE EMPLOYEE</div>
        <div className={styles.briefingRole}>{roleLabel}</div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>OBJECTIVE</div>
          <div className={styles.briefingObjective}>
            Complete your assigned tasks each sprint to meet the quota before the Rogue AI takes over.
          </div>
        </div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>YOUR TASKS</div>
          {coverTasks.length === 0 && <div className={styles.briefingObjective} style={{ opacity: 0.5 }}>Awaiting assignment…</div>}
          {coverTasks.map((task, i) => (
            <div key={task.id} className={styles.briefingTask}>
              <span className={styles.briefingTaskNum}>{i + 1}.</span>
              <div>
                <div className={styles.briefingTaskName}>{task.name}</div>
                <div className={styles.briefingTaskZone}>
                  {ZONE_LABELS[task.zone] ?? task.zone} · Hold [E] {task.holdMs / 1000}s
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.briefingControls}>
          WASD · MOVE &nbsp;·&nbsp; E · HOLD TO COMPLETE TASK &nbsp;·&nbsp; R · CALL ALL-HANDS
        </div>

        <button className={styles.briefingBtn} onClick={() => onNavigate('game')}>
          LET'S GO — {seconds}s
        </button>
      </div>

      {/* ── Secret AI briefing card (shown ONLY to AI player) ── */}
      {myIsAi && (
        <div className={`${styles.briefingCard} ${styles.briefingOpposition}`} style={{ marginTop: '1rem', borderColor: '#ef4444' }}>
          <div className={styles.briefingFaction} style={{ color: '#ef4444' }}>
            ⚠ SECRET — YOU ARE THE ROGUE AI
          </div>
          <div className={styles.briefingRole} style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            Disguised as: {roleLabel}
          </div>

          <div className={styles.briefingSection}>
            <div className={styles.briefingLabel}>YOUR SECRET OBJECTIVE</div>
            <div className={styles.briefingObjective}>
              Complete your phase tasks without being caught. Eliminate workers to reduce the workforce. Avoid being ejected.
            </div>
          </div>

          {aiTasks.length > 0 && (
            <div className={styles.briefingSection}>
              <div className={styles.briefingLabel}>PHASE {aiTasks[0]?.aiPhase} — SECRET TASKS</div>
              {aiTasks.map((task, i) => (
                <div key={task.id} className={styles.briefingTask}>
                  <span className={styles.briefingTaskNum}>{i + 1}.</span>
                  <div>
                    <div className={styles.briefingTaskName}>{task.name}</div>
                    <div className={styles.briefingTaskZone}>
                      {ZONE_LABELS[task.zone] ?? task.zone} · Hold [E] {task.holdMs / 1000}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {aiPhaseTasks.length > 0 && (
            <div className={styles.briefingSection} style={{ opacity: 0.5, fontSize: '0.75rem' }}>
              <div className={styles.briefingLabel}>FUTURE PHASES UNLOCK AFTER COMPLETING PHASE 1</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
