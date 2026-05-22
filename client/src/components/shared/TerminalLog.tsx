import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './TerminalLog.module.css'

export interface TerminalLine {
  text: string
  type?: 'info' | 'warn' | 'danger' | 'success' | 'system'
  time?: string
}

interface Props {
  lines: TerminalLine[]
  typingSpeed?: number
  loop?: boolean
  className?: string
}

export function TerminalLog({ lines, typingSpeed = 20, loop = false, className }: Props) {
  const [displayed, setDisplayed] = useState<TerminalLine[]>([])
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'done'>('typing')
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentLine = lines[lineIdx]
  const currentText = currentLine ? currentLine.text.slice(0, charIdx) : ''

  const advance = useCallback(() => {
    if (!currentLine) return
    if (charIdx < currentLine.text.length) {
      setCharIdx(i => i + 1)
    } else {
      setDisplayed(prev => [...prev, currentLine])
      const nextIdx = lineIdx + 1
      if (nextIdx >= lines.length) {
        setPhase(loop ? 'pausing' : 'done')
      } else {
        setLineIdx(nextIdx)
        setCharIdx(0)
      }
    }
  }, [charIdx, currentLine, lineIdx, lines.length, loop])

  // Character-by-character typing
  useEffect(() => {
    if (phase !== 'typing') return
    const delay = charIdx === 0 ? 80 : typingSpeed
    const t = setTimeout(advance, delay)
    return () => clearTimeout(t)
  }, [phase, charIdx, advance, typingSpeed])

  // Loop: pause then restart
  useEffect(() => {
    if (phase !== 'pausing') return
    const t = setTimeout(() => {
      setDisplayed([])
      setLineIdx(0)
      setCharIdx(0)
      setPhase('typing')
    }, 2800)
    return () => clearTimeout(t)
  }, [phase])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [displayed, currentText])

  return (
    <div ref={scrollRef} className={`${styles.terminal} ${className ?? ''}`}>
      {displayed.map((line, i) => (
        <div key={i} className={`${styles.line} ${styles[line.type ?? 'info']}`}>
          {line.time && <span className={styles.time}>{line.time}</span>}
          <span>{line.text}</span>
        </div>
      ))}

      {phase === 'typing' && currentLine && (
        <div className={`${styles.line} ${styles[currentLine.type ?? 'info']}`}>
          {currentLine.time && <span className={styles.time}>{currentLine.time}</span>}
          <span>{currentText}</span>
          <span className={styles.cursor}>█</span>
        </div>
      )}

      {(phase === 'done' || phase === 'pausing') && (
        <div className={styles.prompt}>
          {'>'}&nbsp;<span className={styles.cursor}>█</span>
        </div>
      )}
    </div>
  )
}
