import type { ReactNode } from 'react'
import styles from './ScreenShell.module.css'

interface Props {
  title: string
  eyebrow?: string
  onBack: () => void
  wide?: boolean
  children: ReactNode
}

export function ScreenShell({ title, eyebrow = 'BENISOFT CORP · INCIDENT RESPONSE SIM', onBack, wide = false, children }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={`${styles.panel} ${wide ? styles.wide : ''}`}>
        <div className={styles.titleBar}>
          <button className={styles.back} onClick={onBack}>
            <span>←</span> BACK
          </button>
          <div className={styles.meta}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h2 className={styles.title}>{title}</h2>
          </div>
          <div className={styles.indicator}>
            <span className={styles.dot} />
            <span className={styles.dotLabel}>LIVE</span>
          </div>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
