import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  STATIONS,
  bitmapFm,
  stationFromVibe,
  type RadioState,
  type Station,
} from './bitmapFm'

interface RadioValue extends RadioState {
  playStation: (station: Station) => void
  toggle: () => void
  stop: () => void
  befriendVibe: (text: string) => Station
  nextTrack: () => void
  setVolume: (v: number) => void
  spectrum: (bars: number) => number[]
  level: () => number
  levelRef: React.RefObject<number>
  djLine: string
}

const RadioContext = createContext<RadioValue | null>(null)

const CUSTOM_KEY = 'lulzforum:radio-custom'
const VOLUME_KEY = 'lulzforum:radio-volume'
const STATION_KEY = 'lulzforum:radio-station'

function loadCustomStations(): Station[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Station[]
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.name === 'string').slice(0, 12) : []
  } catch {
    return []
  }
}

export function RadioProvider({ children }: { children: ReactNode }) {
  const [station, setStation] = useState<Station | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolumeState] = useState<number>(() => {
    const raw = localStorage.getItem(VOLUME_KEY)
    const value = raw ? Number(raw) : NaN
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.7
  })
  const [trackTitle, setTrackTitle] = useState('')
  const [trackIndex, setTrackIndex] = useState(0)
  const [djLine, setDjLine] = useState('')
  const [customStations, setCustomStations] = useState<Station[]>(() => loadCustomStations())
  const levelRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    bitmapFm.setVolume(volume)
    try {
      localStorage.setItem(VOLUME_KEY, String(volume))
    } catch {
      /* ignore */
    }
  }, [volume])

  // Уровень сигнала обновляем в кадре, не дёргая React каждые 16 мс.
  useEffect(() => {
    if (!playing) {
      levelRef.current = 0
      return
    }
    const loop = () => {
      levelRef.current = bitmapFm.level()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  useEffect(() => () => bitmapFm.stop(), [])

  const playStation = useCallback(
    (next: Station) => {
      setError(null)
      setLoading(true)
      try {
        bitmapFm.start(next, {
          onTrack: (title, index) => {
            setTrackTitle(title)
            setTrackIndex(index)
          },
          onDj: (line) => setDjLine(line),
        })
        bitmapFm.setVolume(volume)
        setStation(next)
        setPlaying(true)
        try {
          localStorage.setItem(STATION_KEY, next.id)
        } catch {
          /* ignore */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось включить эфир')
        setPlaying(false)
      } finally {
        setLoading(false)
      }
    },
    [volume],
  )

  const stop = useCallback(() => {
    bitmapFm.stop()
    setPlaying(false)
    setTrackTitle('')
  }, [])

  const toggle = useCallback(() => {
    if (playing) {
      stop()
      return
    }
    const saved = (() => {
      try {
        return localStorage.getItem(STATION_KEY)
      } catch {
        return null
      }
    })()
    const next =
      station ??
      STATIONS.find((s) => s.id === saved) ??
      customStations.find((s) => s.id === saved) ??
      STATIONS[0]
    playStation(next)
  }, [playing, station, customStations, playStation, stop])

  const befriendVibe = useCallback((text: string) => {
    const next = stationFromVibe(text)
    setCustomStations((list) => {
      const without = list.filter((s) => s.id !== next.id)
      const merged = [next, ...without].slice(0, 12)
      try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(merged))
      } catch {
        /* ignore */
      }
      return merged
    })
    return next
  }, [])

  const nextTrack = useCallback(() => {
    if (station) playStation(station)
  }, [station, playStation])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    bitmapFm.setVolume(clamped)
    setVolumeState(clamped)
  }, [])

  const value = useMemo<RadioValue>(
    () => ({
      station,
      playing,
      loading,
      volume,
      trackTitle,
      trackIndex,
      listeners: playing ? 1 : 0,
      error,
      djLine,
      playStation,
      toggle,
      stop,
      befriendVibe,
      nextTrack,
      setVolume,
      spectrum: (bars: number) => bitmapFm.spectrum(bars),
      level: () => levelRef.current,
      levelRef,
    }),
    [station, playing, loading, volume, trackTitle, trackIndex, error, djLine, playStation, toggle, stop, befriendVibe, nextTrack, setVolume],
  )

  // Пользовательские станции доступны странице через отдельный геттер.
  return (
    <RadioContext.Provider value={value}>
      <RadioCustomContext.Provider value={customStations}>{children}</RadioCustomContext.Provider>
    </RadioContext.Provider>
  )
}

const RadioCustomContext = createContext<Station[]>([])

export function useCustomStations(): Station[] {
  return useContext(RadioCustomContext)
}

export function useRadio(): RadioValue {
  const ctx = useContext(RadioContext)
  if (!ctx) throw new Error('useRadio must be used inside RadioProvider')
  return ctx
}
