import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Track } from '../types'

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerValue {
  queue: Track[]
  index: number
  current: Track | null
  playing: boolean
  progress: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
  embedOpen: boolean
  setEmbedOpen: (v: boolean) => void
  playQueue: (tracks: Track[], startIndex?: number) => void
  playTrack: (track: Track, queue?: Track[]) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (seconds: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  clear: () => void
}

const PlayerContext = createContext<PlayerValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [queue, setQueue] = useState<Track[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(() => {
    const raw = localStorage.getItem('lulzforum:volume')
    const n = raw ? Number(raw) : 0.8
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8
  })
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [error, setError] = useState<string | null>(null)
  const [embedOpen, setEmbedOpen] = useState(false)

  const current = queue[index] ?? null

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }

  const audio = audioRef.current

  /* -------------------------------------------------------------- listeners */
  useEffect(() => {
    if (!audio) return
    const onTime = () => setProgress(audio.currentTime)
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnd = () => setPlaying(false)
    const onErr = () => {
      if (audio.src) setError('Поток недоступен — попробуйте другой источник или откройте оригинал')
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('error', onErr)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('error', onErr)
    }
  }, [audio])

  useEffect(() => {
    if (audio) audio.volume = muted ? 0 : volume
  }, [audio, volume, muted])

  /* ---------------------------------------------------------- track switch */
  useEffect(() => {
    if (!audio) return
    setError(null)
    setProgress(0)
    setDuration(0)
    if (!current) {
      audio.pause()
      audio.removeAttribute('src')
      return
    }
    if (current.streamUrl) {
      audio.src = current.streamUrl
      audio.load()
      if (playing) {
        void audio.play().catch(() => {
          setPlaying(false)
          setError('Браузер заблокировал автозапуск — нажмите play')
        })
      }
    } else {
      audio.pause()
      audio.removeAttribute('src')
      if (current.embedUrl) setEmbedOpen(true)
    }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.title,
          artist: current.artist,
          album: 'LulzForum',
          artwork: current.artwork ? [{ src: current.artwork, sizes: '300x300', type: 'image/jpeg' }] : [],
        })
      } catch {
        /* not supported */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, audio])

  const goTo = useCallback(
    (nextIndex: number, auto = false) => {
      setIndex((prev) => {
        if (!queue.length) return 0
        if (auto && repeat === 'one') return prev
        let idx = nextIndex
        if (idx >= queue.length) idx = repeat === 'all' ? 0 : queue.length - 1
        if (idx < 0) idx = 0
        return idx
      })
      if (auto && repeat === 'one') {
        if (audio) {
          audio.currentTime = 0
          void audio.play().catch(() => setPlaying(false))
        }
        return
      }
      setPlaying(true)
    },
    [queue.length, repeat, audio],
  )

  const next = useCallback(() => {
    if (!queue.length) return
    if (shuffle && queue.length > 1) {
      let idx = index
      while (idx === index) idx = Math.floor(Math.random() * queue.length)
      setIndex(idx)
      setPlaying(true)
      return
    }
    if (index >= queue.length - 1 && repeat === 'off') {
      setPlaying(false)
      if (audio) audio.pause()
      return
    }
    goTo(index + 1)
  }, [audio, goTo, index, queue.length, repeat, shuffle])

  const prev = useCallback(() => {
    if (!queue.length) return
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0
      return
    }
    goTo(index - 1)
  }, [audio, goTo, index, queue.length])

  // Auto-advance on track end.
  useEffect(() => {
    if (!audio) return
    const handler = () => next()
    audio.addEventListener('ended', handler)
    return () => audio.removeEventListener('ended', handler)
  }, [audio, next])

  const playQueue = useCallback((tracks: Track[], startIndex = 0) => {
    const list = tracks.filter((t) => t.streamUrl || t.embedUrl || t.externalUrl)
    if (!list.length) return
    setQueue(list)
    setIndex(Math.max(0, Math.min(startIndex, list.length - 1)))
    setPlaying(true)
  }, [])

  const playTrack = useCallback(
    (track: Track, trackQueue?: Track[]) => {
      if (!track.streamUrl && !track.embedUrl) {
        if (track.externalUrl && typeof window !== 'undefined') window.open(track.externalUrl, '_blank', 'noopener')
        return
      }
      if (trackQueue && trackQueue.length) {
        const idx = Math.max(0, trackQueue.findIndex((t) => t.id === track.id))
        playQueue(trackQueue, idx)
        return
      }
      if (current?.id === track.id) {
        setPlaying((p) => !p)
        if (audio) {
          if (audio.paused) void audio.play().catch(() => setPlaying(false))
          else audio.pause()
        }
        return
      }
      playQueue([track], 0)
    },
    [audio, current?.id, playQueue],
  )

  const toggle = useCallback(() => {
    if (!current) return
    if (!current.streamUrl) {
      if (current.embedUrl) {
        setEmbedOpen(true)
        setPlaying((p) => !p)
      } else if (current.externalUrl) {
        window.open(current.externalUrl, '_blank', 'noopener')
      }
      return
    }
    if (!audio) return
    if (audio.paused) {
      void audio.play().catch(() => {
        setError('Не удалось запустить поток')
        setPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [audio, current])

  const seek = useCallback(
    (seconds: number) => {
      if (!audio || !Number.isFinite(seconds)) return
      audio.currentTime = seconds
      setProgress(seconds)
    },
    [audio],
  )

  const setVolume = useCallback((v: number) => {
    const val = Math.min(1, Math.max(0, v))
    setVolumeState(val)
    localStorage.setItem('lulzforum:volume', String(val))
    if (val > 0) setMuted(false)
  }, [])

  const value = useMemo<PlayerValue>(
    () => ({
      queue,
      index,
      current,
      playing,
      progress,
      duration: duration || current?.duration || 0,
      volume,
      muted,
      shuffle,
      repeat,
      error,
      embedOpen,
      setEmbedOpen,
      playQueue,
      playTrack,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      toggleMute: () => setMuted((m) => !m),
      toggleShuffle: () => setShuffle((s) => !s),
      cycleRepeat: () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
      clear: () => {
        setQueue([])
        setIndex(0)
        setPlaying(false)
        if (audio) audio.pause()
      },
    }),
    [queue, index, current, playing, progress, duration, volume, muted, shuffle, repeat, error, embedOpen, playQueue,
      playTrack, toggle, next, prev, seek, setVolume, audio],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}
