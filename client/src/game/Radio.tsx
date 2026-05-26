import { useCallback, useEffect, useRef, useState } from 'react'

// ── Playlist ──────────────────────────────────────────────────────────────────
// All tracks by Dancing Salamanders — served from /music/
const PLAYLIST = [
  { file: 'benilike_main_theme.mp3',                          title: 'Benilike Main Theme' },
  { file: 'benilike_second_theme.mp3',                        title: 'Benilike Second Theme' },
  { file: '404_Dream_Not_Found.mp3',                          title: '404 Dream Not Found' },
  { file: 'Echo save file.mp3',                               title: 'Echo Save File' },
  { file: 'bless this mess (and all its variables).mp3',      title: 'Bless This Mess' },
  { file: 'breadcrumb cosmology.mp3',                         title: 'Breadcrumb Cosmology' },
  { file: 'checksum of the heart.mp3',                        title: 'Checksum of the Heart' },
  { file: 'cold_tea_catchup.mp3',                             title: 'Cold Tea Catchup' },
  { file: 'half hymn whole hashmap.mp3',                      title: 'Half Hymn Whole Hashmap' },
  { file: 'hearthglitch.mp3',                                 title: 'Hearthglitch' },
  { file: 'hide_and_seek.mp3',                                title: 'Hide and Seek' },
  { file: 'kettle logic.mp3',                                 title: 'Kettle Logic' },
  { file: 'kindly demons of the pantry.mp3',                  title: 'Kindly Demons of the Pantry' },
  { file: 'leaven, rise.mp3',                                 title: 'Leaven, Rise' },
  { file: 'lintel Chalk, lintel Code.mp3',                    title: 'Lintel Chalk, Lintel Code' },
  { file: 'magpie logging.mp3',                               title: 'Magpie Logging' },
  { file: 'meandering migration.mp3',                         title: 'Meandering Migration' },
  { file: 'moss matrix.mp3',                                  title: 'Moss Matrix' },
] as const

const N = PLAYLIST.length

function fisherYates(indices: number[]): number[] {
  const a = [...indices]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Btn ───────────────────────────────────────────────────────────────────────
function Btn({
  onClick, title, active = false, children,
}: {
  onClick: () => void; title?: string; active?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'rgba(160,220,255,0.18)' : 'transparent',
        border: '1px solid rgba(255,255,255,0.13)',
        color: active ? '#a0d8ff' : 'rgba(255,255,255,0.72)',
        borderRadius: 3,
        padding: '0.15rem 0.35rem',
        fontSize: '0.6rem',
        cursor: 'pointer',
        lineHeight: 1.1,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.04em',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {children}
    </button>
  )
}

// ── Radio ─────────────────────────────────────────────────────────────────────
export default function Radio({ style }: { style?: React.CSSProperties }) {
  const [shuffled,  setShuffled] = useState(false)
  // `order` is the sequence of track indices to play
  const [order,     setOrder]    = useState<number[]>(() => Array.from({ length: N }, (_, i) => i))
  const [pos,       setPos]      = useState(0)     // position inside `order`
  const [playing,   setPlaying]  = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackIdx = order[pos]
  const track    = PLAYLIST[trackIdx]

  // Create the audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.volume = 0.35
    audioRef.current = audio
    return () => { audio.pause(); audioRef.current = null }
  }, [])

  // Load new src whenever trackIdx changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = `/music/${encodeURIComponent(track.file)}`
    audio.load()
    if (playing) audio.play().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIdx]) // `playing` intentionally excluded — don't reload on pause/resume

  // Play / pause without reloading
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.play().catch(() => {})
    else audio.pause()
  }, [playing])

  // Auto-advance when a track ends
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnd = () => setPos(p => (p + 1) % N)
    audio.addEventListener('ended', onEnd)
    return () => audio.removeEventListener('ended', onEnd)
  }, [])

  const togglePlay     = useCallback(() => setPlaying(p => !p), [])
  const prev           = useCallback(() => setPos(p => (p - 1 + N) % N), [])
  const next           = useCallback(() => setPos(p => (p + 1) % N), [])

  const toggleShuffle  = useCallback(() => {
    setShuffled(s => {
      if (!s) {
        // Shuffle, but keep the currently playing track at position 0
        const rest = Array.from({ length: N }, (_, i) => i).filter(i => i !== trackIdx)
        setOrder([trackIdx, ...fisherYates(rest)])
        setPos(0)
      } else {
        // Restore sequential, keep the same track active
        setOrder(Array.from({ length: N }, (_, i) => i))
        setPos(trackIdx)
      }
      return !s
    })
  }, [trackIdx])

  return (
    <div style={{
      position: 'absolute',
      bottom: '1rem',
      right: '1rem',
      zIndex: 30,
      background: 'rgba(8, 8, 18, 0.84)',
      border: '1px solid rgba(255,255,255,0.11)',
      backdropFilter: 'blur(8px)',
      borderRadius: 6,
      padding: '0.42rem 0.6rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.18rem',
      width: 220,
      fontFamily: 'var(--font-mono)',
      pointerEvents: 'all',
      ...style,
    }}>
      {/* ── Controls row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.28rem' }}>
        <Btn onClick={prev}  title="Previous">◄◄</Btn>
        <Btn onClick={togglePlay} title={playing ? 'Pause' : 'Play'} active={playing}>
          {playing ? '❚❚' : '▶'}
        </Btn>
        <Btn onClick={next}  title="Next">▶▶</Btn>
        <Btn onClick={toggleShuffle} title="Shuffle" active={shuffled}>⇀ shuf</Btn>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.28)',
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>
          {pos + 1}/{N}
        </span>
      </div>

      {/* ── Song name ── */}
      <div style={{
        fontSize: '0.68rem',
        color: 'rgba(255,255,255,0.88)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.25,
        letterSpacing: '0.02em',
      }}>
        {playing
          ? <span style={{ marginRight: '0.35rem', color: '#a0d8ff', fontSize: '0.58rem' }}>♫</span>
          : null
        }
        {track.title}
      </div>

      {/* ── Artist credit ── */}
      <div style={{ fontSize: '0.57rem', lineHeight: 1.2 }}>
        <a
          href="https://www.dancingsalamanders.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(130,185,255,0.6)', textDecoration: 'none', letterSpacing: '0.04em' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(130,185,255,1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(130,185,255,0.6)')}
        >
          Dancing Salamanders ↗
        </a>
      </div>
    </div>
  )
}
