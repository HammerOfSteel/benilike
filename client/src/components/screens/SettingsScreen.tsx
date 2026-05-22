import { useState } from 'react'
import { ScreenShell } from '../shared/ScreenShell'
import { useTheme } from '../../store/useTheme'
import type { Screen } from '../../App'
import styles from './screens.module.css'

interface Props { onNavigate: (s: Screen) => void }

export default function SettingsScreen({ onNavigate }: Props) {
  const { theme, setTheme } = useTheme()
  const [audio, setAudio] = useState({ master: 80, sfx: 70, music: 50 })
  const [mapSize, setMapSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [tips, setTips] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <ScreenShell title="SETTINGS" onBack={() => onNavigate('main-menu')}>
      <div className={styles.settingsSections}>

        {/* ── Theme ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>// DISPLAY THEME</h3>
          <div className={styles.themeCards}>
            <button
              className={`${styles.themeCard} ${theme === 'dark' ? styles.themeCardActive : ''}`}
              onClick={() => setTheme('dark')}
            >
              <div className={styles.themePreview} data-preview="dark">
                <div className={styles.previewBar} />
                <div className={styles.previewLine} />
                <div className={styles.previewLine} style={{ width: '60%' }} />
                <div className={styles.previewLine} style={{ width: '80%' }} />
              </div>
              <span className={styles.themeLabel}>DARK</span>
              <span className={styles.themeDesc}>Terminal night mode · default</span>
              {theme === 'dark' && <span className={styles.themeCheck}>✓</span>}
            </button>

            <button
              className={`${styles.themeCard} ${theme === 'light' ? styles.themeCardActive : ''}`}
              onClick={() => setTheme('light')}
            >
              <div className={styles.themePreview} data-preview="light">
                <div className={styles.previewBar} />
                <div className={styles.previewLine} />
                <div className={styles.previewLine} style={{ width: '60%' }} />
                <div className={styles.previewLine} style={{ width: '80%' }} />
              </div>
              <span className={styles.themeLabel}>LIGHT</span>
              <span className={styles.themeDesc}>Dayshift office mode</span>
              {theme === 'light' && <span className={styles.themeCheck}>✓</span>}
            </button>
          </div>
        </section>

        {/* ── Audio ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>// AUDIO</h3>
          <div className={styles.sliders}>
            {(['master', 'sfx', 'music'] as const).map(key => (
              <div key={key} className={styles.sliderRow}>
                <label className={styles.sliderLabel}>{key.toUpperCase()}</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={audio[key]}
                  onChange={e => setAudio(a => ({ ...a, [key]: +e.target.value }))}
                  className={styles.slider}
                />
                <span className={styles.sliderVal}>{audio[key]}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Gameplay ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>// GAMEPLAY</h3>
          <div className={styles.row}>
            <span className={styles.rowLabel}>DEFAULT MAP SIZE</span>
            <div className={styles.segmented}>
              {(['small', 'medium', 'large'] as const).map(s => (
                <button
                  key={s}
                  className={`${styles.seg} ${mapSize === s ? styles.segActive : ''}`}
                  onClick={() => setMapSize(s)}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.row} style={{ marginTop: '0.75rem' }}>
            <span className={styles.rowLabel}>SHOW IN-GAME TIPS</span>
            <button
              className={`${styles.toggle} ${tips ? styles.toggleOn : ''}`}
              onClick={() => setTips(t => !t)}
            >
              <span className={styles.toggleThumb} />
              <span className={styles.toggleLabel}>{tips ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </section>

        {/* ── Controls ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>// CONTROLS</h3>
          <div className={styles.keybindings}>
            {[
              ['Move', 'W A S D'],
              ['Interact', 'E  /  Space'],
              ['Sprint', 'Shift'],
              ['Use Ability', 'Q'],
              ['Player List', 'Tab'],
              ['Menu / Back', 'Escape'],
              ['Mini-map', 'M  (Management only)'],
            ].map(([action, key]) => (
              <div key={action} className={styles.keybind}>
                <span className={styles.keybindAction}>{action}</span>
                <span className={styles.keybindKey}>{key}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Save button ── */}
        <div className={styles.saveRow}>
          <button className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`} onClick={handleSave}>
            {saved ? '✓ SETTINGS SAVED' : 'SAVE SETTINGS'}
          </button>
          <span className={styles.saveNote}>// Theme applies immediately</span>
        </div>

      </div>
    </ScreenShell>
  )
}
