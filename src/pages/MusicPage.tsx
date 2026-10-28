import { useMemo, useState } from 'react'
import type { SavedTrack, Track } from '../types'
import { useApp } from '../lib/app'
import { usePlayer } from '../lib/player'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { PROVIDER_LABEL, SEARCH_HINTS, resolveMusicLink, searchMusic } from '../lib/music'
import { AddToPlaylistModal, TrackRow } from '../components/TrackRow'
import { EmptyState, Modal, Segmented, Spinner } from '../components/ui'
import { Icon } from '../components/Icon'
import { formatDuration, timeAgo } from '../lib/util'

type Tab = 'search' | 'library' | 'playlists' | 'link'
type SourceFilter = 'all' | 'audius' | 'itunes' | 'link'

export function MusicPage() {
  const {
    tracks,
    playlists,
    user,
    saveTrack,
    toggleTrackLike,
    removeTrack,
    createPlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
  } = useApp()
  const player = usePlayer()
  const ui = useUI()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [source, setSource] = useState<SourceFilter>('all')
  const [likedOnly, setLikedOnly] = useState(false)
  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [addTarget, setAddTarget] = useState<SavedTrack | null>(null)
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [linkPreview, setLinkPreview] = useState<Track | null>(null)

  const savedQueue = tracks.map((t) => t.track)
  const activePlaylist = playlists.find((p) => p.id === playlistId) ?? null
  const playlistTracks = activePlaylist
    ? activePlaylist.trackIds.map((id) => tracks.find((t) => t.id === id)).filter((t): t is SavedTrack => Boolean(t))
    : []

  const shownResults = useMemo(
    () => (source === 'all' ? results : results.filter((r) => (source === 'link' ? r.provider === 'link' || r.provider === 'soundcloud' || r.provider === 'yandex' : r.provider === source))),
    [results, source],
  )

  const library = useMemo(() => (likedOnly ? tracks.filter((t) => t.liked) : tracks), [tracks, likedOnly])

  const runSearch = async (q = query) => {
    const term = q.trim()
    if (!term) return
    setQuery(term)
    setSearching(true)
    setSearched(true)
    try {
      const res = await searchMusic(term, 8)
      setResults(res.tracks)
      if (!res.tracks.length) toast.push('Ничего не нашлось. Попробуйте другой запрос или вставьте ссылку.', 'error')
      if (res.errors.length) toast.push(`Часть источников недоступна: ${res.errors.join(', ')}`)
    } catch {
      toast.push('Поиск не отвечает — проверьте соединение', 'error')
    } finally {
      setSearching(false)
    }
  }

  const playAll = (list: Track[]) => {
    if (!list.length) return
    player.playQueue(list, 0)
    toast.push(`В очереди ${list.length} треков`, 'ok')
  }

  const openAdd = (saved: SavedTrack) => {
    if (!user) {
      ui.requireAuth('Войдите, чтобы собирать плейлисты')
      return
    }
    setAddTarget(saved)
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">МУЗЫКА</h1>
          <p className="page__sub">Поиск по всему интернету: Audius · iTunes · Creative Commons · SoundCloud · Яндекс Музыка</p>
        </div>
        <button className="btn btn--primary" onClick={() => playAll(savedQueue)} disabled={!savedQueue.length}>
          <Icon name="play" size={14} /> СЛУШАТЬ МОЁ
        </button>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t)
          if (t !== 'playlists') setPlaylistId(null)
        }}
        options={[
          { value: 'search', label: 'Найти', icon: 'search' },
          { value: 'library', label: `Моя музыка (${tracks.length})`, icon: 'heart' },
          { value: 'playlists', label: `Плейлисты (${playlists.length})`, icon: 'grid' },
          { value: 'link', label: 'По ссылке', icon: 'link' },
        ]}
      />

      {tab === 'search' && (
        <section className="music-search">
          <div className="music-search__bar">
            <Icon name="search" size={16} />
            <input
              value={query}
              placeholder="Трек, исполнитель, жанр…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch()
              }}
            />
            <button className="btn btn--primary" onClick={() => void runSearch()} disabled={searching || !query.trim()}>
              {searching ? 'ИЩУ…' : 'ИСКАТЬ'}
            </button>
          </div>
          <div className="music-search__hints">
            {SEARCH_HINTS.map((h) => (
              <button key={h} className="chip chip--btn" onClick={() => void runSearch(h)}>
                {h}
              </button>
            ))}
          </div>

          {searched && (
            <div className="music-search__filters">
              <span className="muted small">Источник:</span>
              <Segmented<SourceFilter>
                small
                value={source}
                onChange={setSource}
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'audius', label: 'Audius' },
                  { value: 'itunes', label: 'iTunes' },
                  { value: 'link', label: 'Ссылки' },
                ]}
              />
              <span className="music-search__count">{shownResults.length} результатов</span>
            </div>
          )}

          {searching && <Spinner label="Опрашиваю открытые каталоги…" />}

          {!searching && searched && shownResults.length === 0 && (
            <EmptyState
              icon="music"
              title="Ничего не найдено"
              hint="Попробуйте другой запрос или вставьте прямую ссылку на трек во вкладке «По ссылке»."
            />
          )}

          {!searching && !searched && (
            <div className="music-intro">
              <div className="music-intro__block">
                <Icon name="music" size={28} />
                <h3>Ищите во всём интернете</h3>
                <p>
                  LulzForum спрашивает открытые каталоги напрямую из браузера — без сервера и ключей. Audius и
                  Openverse отдают полноценные стримы, iTunes — превью на 30 секунд.
                </p>
              </div>
              <div className="music-intro__block">
                <Icon name="link" size={28} />
                <h3>Или вставьте ссылку</h3>
                <p>
                  SoundCloud, Яндекс Музыка, YouTube и прямые mp3 открываются во встроенном плеере. Всё сохранённое
                  живёт в «Моей музыке» и плейлистах.
                </p>
              </div>
            </div>
          )}

          <div className="stack stack--tracks">
            {shownResults.map((t) => {
              const saved = tracks.find((s) => s.track.id === t.id)
              return (
                <TrackRow
                  key={t.id}
                  track={t}
                  saved={saved}
                  onSave={() => void saveTrack(t)}
                  onLike={saved ? () => void toggleTrackLike(saved.id) : undefined}
                  onAddToPlaylist={saved ? () => openAdd(saved) : undefined}
                  onShare={() => window.open(t.externalUrl, '_blank', 'noopener')}
                  onPost={() => ui.openComposer(t)}
                  queue={shownResults}
                />
              )
            })}
          </div>
        </section>
      )}

      {tab === 'library' && (
        <section className="music-library">
          <div className="music-library__bar">
            <Segmented
              small
              value={likedOnly ? 'liked' : 'all'}
              onChange={(v) => setLikedOnly(v === 'liked')}
              options={[
                { value: 'all', label: `Все (${tracks.length})` },
                { value: 'liked', label: `Любимые (${tracks.filter((t) => t.liked).length})` },
              ]}
            />
            <button className="btn" onClick={() => playAll(library.map((t) => t.track))} disabled={!library.length}>
              <Icon name="play" size={13} /> ИГРАТЬ ВСЁ
            </button>
            <button className="btn" onClick={() => setTab('link')}>
              <Icon name="plus" size={13} /> ДОБАВИТЬ
            </button>
          </div>

          {library.length === 0 ? (
            <EmptyState
              icon="music"
              title="Моя музыка пуста"
              hint="Найдите треки во вкладке «Найти» или вставьте ссылку — они появятся здесь."
              action={
                <button className="btn btn--primary" onClick={() => setTab('search')}>
                  НАЙТИ МУЗЫКУ
                </button>
              }
            />
          ) : (
            <div className="stack stack--tracks">
              {library.map((s) => (
                <TrackRow
                  key={s.id}
                  track={s.track}
                  saved={s}
                  onLike={() => void toggleTrackLike(s.id)}
                  onAddToPlaylist={() => openAdd(s)}
                  onRemove={() => void removeTrack(s.id)}
                  onShare={() => window.open(s.track.externalUrl, '_blank', 'noopener')}
                  onPost={() => ui.openComposer(s.track)}
                  queue={library.map((x) => x.track)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'playlists' && (
        <section className="playlists">
          {!activePlaylist ? (
            <>
              <div className="playlists__bar">
                <button className="btn btn--primary" onClick={() => setNewPlaylistOpen(true)}>
                  <Icon name="plus" size={14} /> НОВЫЙ ПЛЕЙЛИСТ
                </button>
                <span className="muted small">Плейлисты приватные — их видите только вы</span>
              </div>
              {playlists.length === 0 ? (
                <EmptyState
                  icon="grid"
                  title="Плейлистов нет"
                  hint="Соберите подборку под настроение: ночная смена, работа, спорт."
                  action={
                    <button className="btn btn--primary" onClick={() => setNewPlaylistOpen(true)}>
                      СОЗДАТЬ ПЛЕЙЛИСТ
                    </button>
                  }
                />
              ) : (
                <div className="playlists__grid">
                  {playlists.map((pl) => {
                    const items = pl.trackIds.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as SavedTrack[]
                    const total = items.reduce((s, t) => s + (t.track.duration ?? 0), 0)
                    return (
                      <article key={pl.id} className="playlist-card">
                        <div className="playlist-card__art">
                          {items.slice(0, 4).map((t, i) =>
                            t.track.artwork ? (
                              <img key={i} src={t.track.artwork} alt="" />
                            ) : (
                              <span key={i} className="playlist-card__cell">
                                <Icon name="music" size={16} />
                              </span>
                            ),
                          )}
                          {items.length === 0 && (
                            <span className="playlist-card__empty">
                              <Icon name="grid" size={26} />
                            </span>
                          )}
                        </div>
                        <div className="playlist-card__main">
                          <h3>{pl.title}</h3>
                          <p>{pl.description || 'Без описания'}</p>
                          <span className="playlist-card__meta">
                            {items.length} треков · {formatDuration(total)} · создан {timeAgo(pl.createdAt)}
                          </span>
                        </div>
                        <div className="playlist-card__actions">
                          <button className="btn btn--icon" onClick={() => setPlaylistId(pl.id)} title="Открыть">
                            <Icon name="eye" size={14} />
                          </button>
                          <button
                            className="btn btn--icon"
                            onClick={() => playAll(items.map((t) => t.track))}
                            title="Играть"
                            disabled={!items.length}
                          >
                            <Icon name="play" size={14} />
                          </button>
                          <button
                            className="btn btn--icon btn--danger"
                            onClick={() => {
                              if (confirm(`Удалить плейлист «${pl.title}»?`)) void deletePlaylist(pl.id)
                            }}
                            title="Удалить"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <button className="backlink" onClick={() => setPlaylistId(null)}>
                <Icon name="arrowLeft" size={14} /> ВСЕ ПЛЕЙЛИСТЫ
              </button>
              <div className="playlist-hero">
                <div>
                  <h2>{activePlaylist.title}</h2>
                  <p>{activePlaylist.description || 'Без описания'}</p>
                  <span className="muted small">
                    {playlistTracks.length} треков ·{' '}
                    {formatDuration(playlistTracks.reduce((s, t) => s + (t.track.duration ?? 0), 0))}
                  </span>
                </div>
                <div className="playlist-hero__actions">
                  <button
                    className="btn btn--primary"
                    onClick={() => playAll(playlistTracks.map((t) => t.track))}
                    disabled={!playlistTracks.length}
                  >
                    <Icon name="play" size={14} /> ИГРАТЬ
                  </button>
                  <button
                    className="btn btn--danger"
                    onClick={() => {
                      if (confirm('Удалить плейлист?')) {
                        void deletePlaylist(activePlaylist.id)
                        setPlaylistId(null)
                      }
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>

              <div className="stack stack--tracks">
                {playlistTracks.map((s) => (
                  <TrackRow
                    key={s.id}
                    track={s.track}
                    saved={s}
                    onLike={() => void toggleTrackLike(s.id)}
                    onRemove={() => void removeFromPlaylist(activePlaylist.id, s.id)}
                    onShare={() => window.open(s.track.externalUrl, '_blank', 'noopener')}
                    queue={playlistTracks.map((x) => x.track)}
                  />
                ))}
                {playlistTracks.length === 0 && (
                  <EmptyState icon="music" title="Плейлист пуст" hint="Добавьте треки из «Моей музыки» кнопкой со списком." />
                )}
              </div>

              <div className="playlist-add">
                <div className="playlist-add__title">ДОБАВИТЬ ИЗ МОЕЙ МУЗЫКИ</div>
                <div className="playlist-add__list">
                  {tracks
                    .filter((t) => !activePlaylist.trackIds.includes(t.id))
                    .map((t) => (
                      <button key={t.id} className="playlist-add__item" onClick={() => void addToPlaylist(activePlaylist.id, t.id)}>
                        <span>{t.track.title}</span>
                        <span className="muted">{t.track.artist}</span>
                        <Icon name="plus" size={13} />
                      </button>
                    ))}
                  {tracks.filter((t) => !activePlaylist.trackIds.includes(t.id)).length === 0 && (
                    <p className="muted small">Все ваши треки уже в плейлисте.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'link' && (
        <section className="music-link">
          <div className="music-link__card">
            <h3>
              <Icon name="link" size={18} /> ДОБАВИТЬ ПО ССЫЛКЕ
            </h3>
            <p className="muted small">
              Поддерживаются SoundCloud, Яндекс Музыка, YouTube, Bandcamp и прямые ссылки на mp3/ogg/wav.
            </p>
            <div className="inline-form">
              <input
                className="input"
                value={linkInput}
                placeholder="https://soundcloud.com/artist/track"
                onChange={(e) => setLinkInput(e.target.value)}
              />
              <button
                className="btn"
                onClick={() => {
                  try {
                    const { track, note } = resolveMusicLink(linkInput)
                    setLinkPreview(track)
                    if (note) toast.push(note)
                  } catch (e) {
                    toast.push(e instanceof Error ? e.message : 'Неверная ссылка', 'error')
                  }
                }}
                disabled={!linkInput.trim()}
              >
                ПРОВЕРИТЬ
              </button>
            </div>

            {linkPreview && (
              <div className="music-link__preview">
                <TrackRow
                  track={linkPreview}
                  saved={tracks.find((t) => t.track.id === linkPreview.id)}
                  onSave={() => void saveTrack(linkPreview)}
                  onLike={() => {
                    const s = tracks.find((t) => t.track.id === linkPreview.id)
                    if (s) void toggleTrackLike(s.id)
                  }}
                  onShare={() => window.open(linkPreview.externalUrl, '_blank', 'noopener')}
                />
                <div className="music-link__actions">
                  <button
                    className="btn btn--primary"
                    onClick={() => {
                      player.playTrack(linkPreview)
                      void saveTrack(linkPreview)
                    }}
                  >
                    <Icon name="play" size={13} /> СЛУШАТЬ И СОХРАНИТЬ
                  </button>
                  <button className="btn" onClick={() => setLinkPreview(null)}>
                    СБРОСИТЬ
                  </button>
                </div>
              </div>
            )}

            <div className="music-link__providers">
              {(['soundcloud', 'yandex', 'audius', 'itunes', 'link'] as const).map((p) => (
                <span key={p} className="chip chip--tiny">
                  {PROVIDER_LABEL[p]}
                </span>
              ))}
            </div>
          </div>

          <div className="music-link__side">
            <div className="rail__title">
              <Icon name="music" size={12} /> ПОДСКАЗКИ
            </div>
            <ul className="tips">
              <li>SoundCloud: скопируйте обычную ссылку на трек из адресной строки.</li>
              <li>Яндекс Музыка: подойдёт ссылка вида music.yandex.ru/album/…/track/…</li>
              <li>Полное прослушивание зависит от прав сервиса — LulzForum встраивает официальный плеер.</li>
              <li>Прямые mp3 играют внутри LulzForum без ограничений.</li>
            </ul>
          </div>
        </section>
      )}

      <AddToPlaylistModal
        open={Boolean(addTarget)}
        onClose={() => setAddTarget(null)}
        playlists={playlists}
        onCreate={async (title) => {
          const pl = await createPlaylist(title, '')
          if (addTarget) await addToPlaylist(pl.id, addTarget.id)
          setAddTarget(null)
        }}
        onPick={(pid) => {
          if (addTarget) void addToPlaylist(pid, addTarget.id)
        }}
      />

      <NewPlaylistModal
        open={newPlaylistOpen}
        onClose={() => setNewPlaylistOpen(false)}
        onCreate={async (title, description) => {
          await createPlaylist(title, description)
          setNewPlaylistOpen(false)
        }}
      />
    </div>
  )
}

function NewPlaylistModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (title: string, description: string) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Modal open={open} onClose={onClose} title="НОВЫЙ ПЛЕЙЛИСТ" width={420}>
      <div className="stack">
        <label className="field">
          <span>Название</span>
          <input
            className="input"
            value={title}
            maxLength={60}
            placeholder="НОЧНАЯ СМЕНА"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Описание</span>
          <input
            className="input"
            value={description}
            maxLength={200}
            placeholder="Для чтения форума после полуночи"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          className="btn btn--primary btn--wide"
          disabled={!title.trim() || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onCreate(title.trim(), description.trim())
              setTitle('')
              setDescription('')
            } finally {
              setBusy(false)
            }
          }}
        >
          СОЗДАТЬ
        </button>
      </div>
    </Modal>
  )
}
