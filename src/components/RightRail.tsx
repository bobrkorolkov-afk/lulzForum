import { useMemo } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { usePlayer } from '../lib/player'
import { useUI } from '../lib/ui'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { formatCount, timeAgo } from '../lib/util'

export function RightRail() {
  const { posts, profiles, user, friendIds, sendFriendRequest, mode } = useApp()
  const { navigate } = useRouter()
  const player = usePlayer()
  const ui = useUI()

  const trends = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of posts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }, [posts])

  const suggestions = useMemo(() => {
    return profiles
      .filter((p) => p.id !== user?.id && !friendIds.has(p.id))
      .slice(0, 4)
  }, [profiles, user?.id, friendIds])

  const trendingPosts = useMemo(
    () => [...posts].sort((a, b) => b.likeCount + b.commentCount * 2 - (a.likeCount + a.commentCount * 2)).slice(0, 3),
    [posts],
  )

  return (
    <aside className="rail" aria-label="Дополнительно">
      {player.current && (
        <section className="rail__card rail__card--player">
          <div className="rail__title">
            <Icon name="volume" size={12} /> СЕЙЧАС В ЭФИРЕ
          </div>
          <button className="rail__now" onClick={() => player.toggle()}>
            {player.current.artwork ? (
              <img src={player.current.artwork} alt="" />
            ) : (
              <span className="rail__now-art">
                <Icon name="music" size={22} />
              </span>
            )}
            <span className="rail__now-text">
              <b>{player.current.title}</b>
              <span>{player.current.artist}</span>
            </span>
            <Icon name={player.playing ? 'pause' : 'play'} size={16} />
          </button>
          <button className="rail__more" onClick={() => navigate('/music')}>
            Открыть музыку <Icon name="arrowLeft" size={12} className="flip" />
          </button>
        </section>
      )}

      <section className="rail__card">
        <div className="rail__title">
          <Icon name="fire" size={12} /> ТРЕНДЫ ФОРУМА
        </div>
        <div className="rail__trends">
          {trends.length === 0 && <p className="muted small">Пока пусто — создайте первый тег.</p>}
          {trends.map(([tag, count], i) => (
            <button key={tag} className="trend" onClick={() => navigate(`/tag/${encodeURIComponent(tag)}`)}>
              <span className="trend__rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="trend__tag">#{tag}</span>
              <span className="trend__count">{formatCount(count)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rail__card">
        <div className="rail__title">
          <Icon name="star" size={12} /> ГОРЯЧЕЕ
        </div>
        <div className="rail__hot">
          {trendingPosts.map((p) => {
            const author = profiles.find((x) => x.id === p.authorId)
            return (
              <button key={p.id} className="hotpost" onClick={() => navigate(`/post/${p.id}`)}>
                <span className="hotpost__body">{p.body.slice(0, 74) || 'Пост с вложением'}…</span>
                <span className="hotpost__meta">
                  @{author?.handle ?? 'user'} · {timeAgo(p.createdAt)}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {user && suggestions.length > 0 && (
        <section className="rail__card">
          <div className="rail__title">
            <Icon name="friends" size={12} /> КОГО ДОБАВИТЬ
          </div>
          <div className="rail__people">
            {suggestions.map((p) => (
              <div key={p.id} className="person-mini">
                <button className="person-mini__main" onClick={() => navigate(`/u/${p.handle}`)}>
                  <Avatar seed={p.handle} name={p.name} src={p.avatarUrl} size={28} />
                  <span className="person-mini__text">
                    <b>{p.name}</b>
                    <span>@{p.handle}</span>
                  </span>
                </button>
                <button
                  className="btn btn--icon"
                  onClick={() => {
                    if (ui.requireAuth('Войдите, чтобы добавлять друзей')) void sendFriendRequest(p.id)
                  }}
                  title="Добавить в друзья"
                >
                  <Icon name="plus" size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="rail__footer">
        <p>
          <b>LULZFORUM</b> v1.0 · чёрно-белый bitmap-форум
          {mode === 'local' ? ' · демо-режим (localStorage)' : ' · Supabase подключён'}
        </p>
        <div className="rail__links">
          <button onClick={() => navigate('/about')}>О форуме</button>
          <button onClick={() => ui.toggleShortcuts(true)}>Клавиши</button>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </aside>
  )
}
