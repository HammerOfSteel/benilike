import { useEffect, useState } from 'react'
import { useGameRoom } from '../../store/useGameRoom'
import { ROLE_LABELS } from '@shared/types'
import { TASK_DEFS } from '@shared/tasks'
import type { Screen } from '../../App'
import styles from './screens.module.css'

const COUNTDOWN = 10

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
  const factionLabel = isWorkforce ? '▲ WORKFORCE' : '▼ OPPOSITION'
  const myTasks      = myRole ? TASK_DEFS.filter(t => t.role === myRole) : []
  const cardClass    = `${styles.briefingCard} ${isWorkforce ? styles.briefingWorkforce : styles.briefingOpposition}`
  const winDesc      = isWorkforce
    ? 'Complete your tasks to push the Workforce meter to 100%'
    : 'Complete your tasks to push the Opposition meter to 100%'

  const ZONE_LABELS: Record<string, string> = {
    main_office:    'Main Office',
    server_room:    'Server Room',
    network_closet: 'Network Closet',
    hr_corner:      'HR Corner',
    finance_floor:  'Finance Floor',
    devops_den:     'DevOps Den',
    marketing_hub:  'Marketing Hub',
    exec_suite:     'Exec Suite',
  }

  return (
    <div className={styles.briefingOverlay}>
      <div className={cardClass}>

        <div className={styles.briefingFaction}>{factionLabel}</div>
        <div className={styles.briefingRole}>{roleLabel}</div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>OBJECTIVE</div>
          <div className={styles.briefingObjective}>{winDesc}</div>
        </div>

        <div className={styles.briefingSection}>
          <div className={styles.briefingLabel}>YOUR TASKS</div>
          {myTasks.map((task, i) => (
            <div key={task.id} className={styles.briefingTask}>
              <span className={styles.briefingTaskNum}>{i + 1}.</span>
              <div>
                <div className={styles.briefingTaskName}>{task.name}</div>
                <div className={styles.briefingTaskZone}>
                  {ZONE_LABELS[task.zone] ?? task.zone} · Hold [E] {task.holdMs / 1000}s
                </div>
                <div className={styles.briefingAbilityDesc}>{task.effectDesc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.briefingControls}>
          WASD · MOVE &nbsp;·&nbsp; E · HOLD TO COMPLETE TASK
        </div>

        <button className={styles.briefingBtn} onClick={() => onNavigate('game')}>
          LET'S GO — {seconds}s
        </button>

      </div>
    </div>
  )
}
