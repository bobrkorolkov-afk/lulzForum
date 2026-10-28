import { useMemo, useRef, useState } from 'react'
import { usePlayer } from '../lib/player'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { Icon } from './Icon'
import { formatDuration, isPixelArt } from '../lib/util'
import { PROVIDER_LABEL, hasEmbed } from '../lib/music'

export function Player() {
  const player = usePlayer()
  const { saveTrack, tracks } = useApp()
  const { navigate } = useRouter()
  const [queueOpen, setQueueOpen] = useState(false)
  // Очередь и внешний плеер не должны наезжать друг на друга.
  const toggleQueue = () => {
    setQueueOpen((v) => {
      if (!v) player.setEmbedOpen(false)
      return !v
    })
  }
  const toggleEmbed = () => {
    const next = !player.embedOpen
    player.setEmbedOpen(next)
    if (next) setQueueOpen(false)
  }
  const barRef = useRef<HTMLDivElement>(null)

  const saved = useMemo(
    () => (player.current ? tracks.find((t) => t.track.id === player.current?.id) : undefined),
    [tracks, player.current],
  )

  if (!player.current) return null
  const track = player.current
  const pct = player.duration ? Math.min(100, (player.progress / player.duration) * 100) : 0

  const seekFromEvent = (clientX: number) => {
    const el = barRef.current
    if (!el || !player.duration) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    player.seek(ratio * player.duration)
  }

  return (
    <>
      <div className={`player ${queueOpen ? 'player--open' : ''}`}>
        <div
          className="player__progress"
          ref={barRef}
          onClick={(e) => seekFromEvent(e.clientX)}
          role="slider"
          aria-label="Позиция трека"
          aria-valuemin={0}
          aria-valuemax={player.duration}
          aria-valuenow={player.progress}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') player.seek(player.progress + 5)
            if (e.key === 'ArrowLeft') player.seek(player.progress - 5)
          }}
        >
          <div className="player__progress-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="player__inner">
          <button className="player__meta" onClick={() => navigate('/music')} title="Открыть музыку">
            <span className="player__art">
              {track.artwork ? (
                <img className={isPixelArt(track.artwork) ? 'art--auto' : undefined} src={track.artwork} alt="" />
              ) : (
                <span className="player__art-fallback">
                  <Icon name="music" size={18} />
                </span>
              )}
            </span>
            <span className="player__text">
              <b>{track.title}</b>
              <span>
                {track.artist} · {PROVIDER_LABEL[track.provider]}
                {hasEmbed(track) && !track.streamUrl ? ' · внешний плеер' : ''}
              </span>
            </span>
          </button>

          <div className="player__controls">
            <button className={`pbtn ${player.shuffle ? 'is-on' : ''}`} onClick={player.toggleShuffle} title="Перемешать">
              <Icon name="shuffle" size={15} />
            </button>
            <button className="pbtn" onClick={player.prev} title="Предыдущий">
              <Icon name="prev" size={15} />
            </button>
            <button className="pbtn pbtn--main" onClick={player.toggle} title="Играть / пауза">
              <Icon name={player.playing ? 'pause' : 'play'} size={18} />
            </button>
            <button className="pbtn" onClick={player.next} title="Следующий">
              <Icon name="next" size={15} />
            </button>
            <button
              className={`pbtn ${player.repeat !== 'off' ? 'is-on' : ''}`}
              onClick={player.cycleRepeat}
              title={`Повтор: ${player.repeat}`}
            >
              <Icon name="repeat" size={15} />
              {player.repeat === 'one' && <span className="pbtn__sup">1</span>}
            </button>
          </div>

          <div className="player__right">
            <span className="player__time">
              {formatDuration(player.progress)} / {formatDuration(player.duration)}
            </span>
            <button
              className="pbtn"
              onClick={() => void saveTrack(track)}
              title="В мою музыку"
              disabled={Boolean(saved)}
            >
              <Icon name={saved ? 'check' : 'plus'} size={15} />
            </button>
            {track.embedUrl && (
              <button className="pbtn" onClick={toggleEmbed} title="Внешний плеер">
                <Icon name="external" size={15} />
              </button>
            )}
            <button className="pbtn" onClick={player.toggleMute} title="Звук">
              <Icon name={player.muted || player.volume === 0 ? 'mute' : 'volume'} size={15} />
            </button>
            <input
              className="player__volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.muted ? 0 : player.volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              aria-label="Громкость"
            />
            <button
              className={`pbtn ${queueOpen ? 'is-on' : ''}`}
              onClick={toggleQueue}
              title="Очередь"
            >
              <Icon name="list" size={15} />
              <span className="pbtn__count">{player.queue.length}</span>
            </button>
            <button className="pbtn" onClick={player.clear} title="Остановить">
              <Icon name="close" size={15} />
            </button>
          </div>
        </div>

        {player.error && <div className="player__error">!! {player.error}</div>}
      </div>

      {queueOpen && (
        <div className="queue">
          <div className="queue__head">
            <span>ОЧЕРЕДЬ · {player.queue.length}</span>
            <button className="btn btn--icon" onClick={() => setQueueOpen(false)}>
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="queue__list">
            {player.queue.map((t, i) => (
              <button
                key={`${t.id}-${i}`}
                className={`queue__item ${i === player.index ? 'is-active' : ''}`}
                onClick={() => player.playQueue(player.queue, i)}
              >
                <span className="queue__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="queue__text">
                  <b>{t.title}</b>
                  <span>{t.artist}</span>
                </span>
                <span className="queue__dur">{formatDuration(t.duration)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {player.embedOpen && track.embedUrl && (
        <div className="embed">
          <div className="embed__head">
            <span>
              ВНЕШНИЙ ПЛЕЕР · {PROVIDER_LABEL[track.provider]}
            </span>
            <div className="embed__actions">
              <a href={track.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn--icon">
                <Icon name="external" size={14} />
              </a>
              <button className="btn btn--icon" onClick={() => player.setEmbedOpen(false)}>
                <Icon name="close" size={14} />
              </button>
            </div>
          </div>
          <iframe
            className="embed__frame"
            src={track.embedUrl}
            title={`${track.title} — ${track.artist}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          />
        </div>
      )}
    </>
  )
}
