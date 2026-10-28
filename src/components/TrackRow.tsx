import { useMemo, useState } from 'react'
import type { Playlist, SavedTrack, Track } from '../types'
import { PROVIDER_LABEL, hasEmbed, isPlayable } from '../lib/music'
import { formatDuration } from '../lib/util'
import { Icon } from './Icon'
import { Modal } from './ui'
import { usePlayer } from '../lib/player'

interface TrackRowProps {
  track: Track
  saved?: SavedTrack
  onLike?: () => void
  onSave?: () => void
  onRemove?: () => void
  onAddToPlaylist?: () => void
  onShare?: () => void
  onPost?: () => void
  queue?: Track[]
}

export function TrackRow({ track, saved, onLike, onSave, onRemove, onAddToPlaylist, onShare, onPost, queue }: TrackRowProps) {
  const player = usePlayer()
  const isCurrent = player.current?.id === track.id
  const playable = isPlayable(track) || hasEmbed(track)

  return (
    <div className={`track ${isCurrent ? 'track--active' : ''}`}>
      <button
        className="track__art"
        onClick={() => (playable ? player.playTrack(track, queue) : onShare?.())}
        title={playable ? 'Слушать' : 'Открыть источник'}
      >
        {track.artwork ? (
          <img src={track.artwork} alt="" loading="lazy" draggable={false} />
        ) : (
          <span className="track__art-fallback">
            <Icon name="music" size={20} />
          </span>
        )}
        <span className="track__play">
          <Icon name={isCurrent && player.playing ? 'pause' : 'play'} size={18} />
        </span>
      </button>

      <div className="track__main">
        <div className="track__title" title={track.title}>
          {track.title || 'Без названия'}
        </div>
        <div className="track__meta">
          <span className="chip chip--tiny">{PROVIDER_LABEL[track.provider]}</span>
          <span className="track__artist">{track.artist}</span>
          {saved?.note ? <span className="track__note">· {saved.note}</span> : null}
        </div>
      </div>

      <div className="track__dur">{formatDuration(saved?.track.duration ?? track.duration)}</div>

      <div className="track__actions">
        {onSave && (
          <button className="btn btn--icon" onClick={onSave} title="Сохранить в мою музыку">
            <Icon name={saved ? 'check' : 'plus'} size={14} />
          </button>
        )}
        {onLike && (
          <button
            className={`btn btn--icon ${saved?.liked ? 'is-on' : ''}`}
            onClick={onLike}
            title={saved?.liked ? 'Убрать лайк' : 'Лайкнуть'}
          >
            <Icon name="heart" size={14} />
          </button>
        )}
        {onAddToPlaylist && (
          <button className="btn btn--icon" onClick={onAddToPlaylist} title="В плейлист">
            <Icon name="list" size={14} />
          </button>
        )}
        {onPost && (
          <button className="btn btn--icon" onClick={onPost} title="Поделиться в посте">
            <Icon name="edit" size={14} />
          </button>
        )}
        {onShare && (
          <a className="btn btn--icon" href={track.externalUrl} target="_blank" rel="noopener noreferrer" title="Источник">
            <Icon name="external" size={14} />
          </a>
        )}
        {onRemove && (
          <button className="btn btn--icon btn--danger" onClick={onRemove} title="Удалить">
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function AddToPlaylistModal({
  open,
  onClose,
  playlists,
  onCreate,
  onPick,
}: {
  open: boolean
  onClose: () => void
  playlists: Playlist[]
  onCreate: (title: string) => Promise<void>
  onPick: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const sorted = useMemo(() => [...playlists].sort((a, b) => a.title.localeCompare(b.title)), [playlists])

  return (
    <Modal open={open} onClose={onClose} title="Добавить в плейлист" width={440}>
      <div className="stack">
        {sorted.length === 0 && <p className="muted">Плейлистов пока нет — создайте первый.</p>}
        {sorted.map((pl) => (
          <button
            key={pl.id}
            className="playlist-pick"
            onClick={() => {
              onPick(pl.id)
              onClose()
            }}
          >
            <span className="playlist-pick__icon">
              <Icon name="grid" size={16} />
            </span>
            <span className="playlist-pick__title">{pl.title}</span>
            <span className="playlist-pick__count">{pl.trackIds.length}</span>
          </button>
        ))}
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!title.trim() || busy) return
            setBusy(true)
            try {
              await onCreate(title.trim())
              setTitle('')
            } finally {
              setBusy(false)
            }
          }}
        >
          <input
            className="input"
            value={title}
            maxLength={60}
            placeholder="Новый плейлист…"
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn btn--primary" disabled={!title.trim() || busy} type="submit">
            <Icon name="plus" size={14} /> Создать
          </button>
        </form>
      </div>
    </Modal>
  )
}
