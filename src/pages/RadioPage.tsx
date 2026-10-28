import { useEffect, useMemo, useRef, useState } from 'react'
import { STATIONS, VIBE_CHIPS, type Station } from '../lib/bitmapFm'
import { useCustomStations, useRadio } from '../lib/radio'
import { usePlayer } from '../lib/player'
import { useToast } from '../lib/toast'
import { Icon } from '../components/Icon'

const MOOD_LABEL: Record<Station['mood'], string> = {
  night: 'НОЧЬ',
  disco: 'ДИСКО',
  industrial: 'ЦЕХ',
  calm: 'ШТИЛЬ',
  dawn: 'РАССВЕТ',
  space: 'КОСМОС',
  empty: 'ПУСТОТА',
  glitch: 'СБОЙ',
}

export function RadioPage() {
  const radio = useRadio()
  const custom = useCustomStations()
  const player = usePlayer()
  const toast = useToast()
  const [vibe, setVibe] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const all = useMemo(() => [...custom, ...STATIONS], [custom])

  // Начинаем эфир — глушим обычный плеер, чтобы не было двух источников звука.
  const start = (station: Station) => {
    if (player.playing) player.clear()
    radio.playStation(station)
  }

  // Пиксельный визуализатор: столбики рисуются целыми клетками.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const bars = 32
    const css = getComputedStyle(document.documentElement)
    const draw = () => {
      const ink = css.getPropertyValue('--ink').trim() || '#000'
      const paper = css.getPropertyValue('--paper').trim() || '#fff'
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = ink
      const data = radio.playing ? radio.spectrum(bars) : new Array(bars).fill(0)
      const cell = Math.max(2, Math.floor(w / bars))
      const rows = Math.floor(h / cell)
      for (let i = 0; i < bars; i++) {
        const value = Math.max(radio.playing ? 0.06 : 0, data[i])
        const height = Math.max(1, Math.round(value * rows))
        for (let r = 0; r < height; r++) {
          const y = h - (r + 1) * cell
          ctx.fillRect(i * cell + 1, y, cell - 2 < 1 ? 1 : cell - 2, cell - 1)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [radio.playing])

  const buildVibe = (text: string) => {
    const station = radio.befriendVibe(text)
    start(station)
    toast.push(`Станция «${station.name}» в эфире`, 'ok')
  }

  const current = radio.station

  return (
    <div className="page page--radio">
      <div className="page__head">
        <div>
          <h1 className="page__title">BITMAP FM</h1>
          <p className="page__sub">
            Нейро-радио: музыка синтезируется прямо в браузере. Выбираешь вайб — модель собирает станцию.
          </p>
        </div>
        <span className={`onair ${radio.playing ? 'is-live' : ''}`}>
          <i /> {radio.playing ? 'ON AIR' : 'OFF AIR'}
        </span>
      </div>

      <section className={`radio ${radio.playing ? 'is-live' : ''}`}>
        <div className="radio__screen">
          <div className="radio__screen-top">
            <span className="radio__freq">{current ? `${current.bpm} BPM` : '— BPM'}</span>
            <span className="radio__label">{current ? MOOD_LABEL[current.mood] : 'НЕТ СИГНАЛА'}</span>
          </div>
          <canvas ref={canvasRef} className="radio__canvas" width={640} height={140} aria-hidden="true" />
          <div className="radio__meta">
            <b>{radio.trackTitle || 'BITMAP FM — тишина в эфире'}</b>
            <span>
              {current ? current.name : 'выберите станцию'} · нейросеть LulzForum
            </span>
          </div>
        </div>

        <div className="radio__controls">
          <button className="btn btn--primary radio__play" onClick={radio.toggle}>
            <Icon name={radio.playing ? 'pause' : 'play'} size={16} />
            {radio.playing ? 'ПАУЗА' : 'В ЭФИР'}
          </button>
          <button className="btn" onClick={radio.nextTrack} disabled={!radio.playing} title="Перегенерировать трек">
            <Icon name="refresh" size={14} /> ДРУГОЙ ТРЕК
          </button>
          <span className="radio__vol">
            <Icon name="volume" size={14} />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(radio.volume * 100)}
              onChange={(e) => radio.setVolume(Number(e.target.value) / 100)}
              aria-label="Громкость радио"
            />
          </span>
        </div>

        {radio.djLine && <p className="radio__dj">ДИДЖЕЙ: {radio.djLine}</p>}
        {radio.error && <p className="radio__error">{radio.error}</p>}
      </section>

      <section className="radio__vibe">
        <h3 className="section-title">СОБРАТЬ СТАНЦИЮ ПО ВАЙБУ</h3>
        <div className="inline-form">
          <input
            className="input"
            value={vibe}
            placeholder="ночной дождь в терминале, пиксель-диско, железо и туман…"
            onChange={(e) => setVibe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && vibe.trim()) buildVibe(vibe)
            }}
          />
          <button className="btn btn--primary" disabled={!vibe.trim()} onClick={() => buildVibe(vibe)}>
            <Icon name="zap" size={14} /> СОБРАТЬ
          </button>
        </div>
        <div className="radio__chips">
          {VIBE_CHIPS.map((chip) => (
            <button key={chip} className="chip chip--btn" onClick={() => buildVibe(chip)}>
              {chip}
            </button>
          ))}
        </div>
        <p className="muted small">
          Один и тот же вайб всегда даёт одну и ту же станцию — потому что это не случайность, а хеш вашего текста.
        </p>
      </section>

      <h3 className="section-title">СТАНЦИИ</h3>
      <div className="radio__grid">
        {all.map((station) => {
          const active = radio.station?.id === station.id
          return (
            <button
              key={station.id}
              className={`station ${active ? 'is-active' : ''}`}
              onClick={() => (active && radio.playing ? radio.stop() : start(station))}
            >
              <span className="station__top">
                <b>{station.name}</b>
                <span className="station__mood">{MOOD_LABEL[station.mood]}</span>
              </span>
              <span className="station__vibe">{station.vibe}</span>
              <span className="station__foot">
                <span className="chip chip--tiny">{station.bpm} BPM</span>
                {station.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="chip chip--tiny">
                    #{tag}
                  </span>
                ))}
                <span className={`station__state ${active && radio.playing ? 'is-live' : ''}`}>
                  {active && radio.playing ? 'ЭФИР' : 'СЛУШАТЬ'}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="radio__hint">
        BITMAP FM ничего не скачивает и не хранит: каждый звук рождается в вашем браузере через Web Audio, поэтому
        радио работает офлайн и не требует аккаунта. Закройте вкладку — эфир закончится.
      </p>
    </div>
  )
}
