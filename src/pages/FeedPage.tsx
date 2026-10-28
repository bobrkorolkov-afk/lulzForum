import { useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { PostCard } from '../components/PostCard'
import { Segmented, EmptyState } from '../components/ui'
import { Icon } from '../components/Icon'
import { Avatar } from '../components/Avatar'
import { shuffle } from '../lib/util'

type Tab = 'for-you' | 'fresh' | 'friends' | 'top'

export function FeedPage() {
  const { posts, user, friendIds, profileById } = useApp()
  const { navigate, route } = useRouter()
  const ui = useUI()
  const [tab, setTab] = useState<Tab>('for-you')
  const [limit, setLimit] = useState(12)

  const affinity = useMemo(() => {
    if (!user) return new Map<string, number>()
    const counts = new Map<string, number>()
    for (const p of posts) {
      if (!p.likedByMe && !p.bookmarkedByMe) continue
      for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return counts
  }, [posts, user])

  const ranked = useMemo(() => {
    const now = Date.now()
    const scored = posts.map((p) => {
      const ageHours = Math.max(0.05, (now - +new Date(p.createdAt)) / 3_600_000)
      // Свежесть затухает экспоненциально, но у совсем новых постов есть бонус.
      const recency = 90 * Math.exp(-ageHours / 60)
      const freshBonus = ageHours < 2 ? 26 : 0
      const engagement = Math.min(45, p.likeCount * 0.8 + p.commentCount * 2.5)
      const tagScore = Math.min(24, p.tags.reduce((sum, t) => sum + (affinity.get(t) ?? 0) * 6, 0))
      const friends = friendIds.has(p.authorId) ? 10 : 0
      const jitter = (hashString(p.id) % 100) / 25
      return { post: p, score: recency + freshBonus + engagement + tagScore + friends + jitter }
    })
    return scored.sort((a, b) => b.score - a.score).map((s) => s.post)
  }, [posts, affinity, friendIds, user])

  const list = useMemo(() => {
    const pinned = posts.filter((p) => p.pinned)
    switch (tab) {
      case 'fresh':
        return [...pinned, ...posts.filter((p) => !p.pinned).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))]
      case 'friends':
        return ranked.filter((p) => friendIds.has(p.authorId) || p.authorId === user?.id)
      case 'top':
        return [...posts].sort((a, b) => b.likeCount + b.commentCount * 2 - (a.likeCount + a.commentCount * 2))
      default:
        return [...pinned, ...ranked.filter((p) => !p.pinned)]
    }
  }, [tab, posts, ranked, friendIds, user])

  const suggestions = useMemo(
    () => shuffle(posts.filter((p) => p.authorId !== user?.id)).slice(0, 5),
    [posts, user],
  )

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">ЛЕНТА</h1>
          <p className="page__sub">
            {route.query.get('welcome') ? 'Аккаунт готов. ' : ''}
            Рекомендации по лайкам, тегам и свежести
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => ui.openComposer()}>
          <Icon name="plus" size={14} /> НОВЫЙ ПОСТ
        </button>
      </div>

      <div className="feedbar">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'for-you', label: 'Для тебя', icon: 'star' },
            { value: 'fresh', label: 'Свежее', icon: 'refresh' },
            { value: 'friends', label: 'Подписки', icon: 'friends' },
            { value: 'top', label: 'Топ', icon: 'fire' },
          ]}
        />
        <span className="feedbar__count">{list.length} постов</span>
      </div>

      {!user && (
        <div className="guest-banner">
          <div className="guest-banner__text">
            <b>Вы читаете форум как гость.</b>
            <span>Создайте аккаунт, чтобы лайкать, писать, собирать музыку и хранить файлы.</span>
          </div>
          <div className="guest-banner__actions">
            <button className="btn btn--primary" onClick={() => ui.openAuth('register')}>
              СОЗДАТЬ АККАУНТ
            </button>
            <button className="btn" onClick={() => ui.openAuth('login')}>
              ВОЙТИ
            </button>
          </div>
        </div>
      )}

      <button className="composer-stub" onClick={() => ui.openComposer()}>
        {user ? (
          <Avatar seed={user.handle} name={user.name} src={user.avatarUrl} size={34} />
        ) : (
          <span className="composer-stub__icon">
            <Icon name="edit" size={18} />
          </span>
        )}
        <span className="composer-stub__text">Что нового, форум? #теги, картинки и музыка внутри</span>
        <span className="composer-stub__meta">
          <Icon name="image" size={14} />
          <Icon name="music" size={14} />
          <Icon name="tag" size={14} />
        </span>
      </button>

      {list.length === 0 ? (
        <EmptyState
          icon="chat"
          title="Здесь пока тихо"
          hint={
            tab === 'friends'
              ? 'Добавьте друзей — и их посты появятся здесь.'
              : 'Напишите первый пост и задайте настроение форуму.'
          }
          action={
            <button className="btn btn--primary" onClick={() => ui.openComposer()}>
              НАПИСАТЬ ПОСТ
            </button>
          }
        />
      ) : (
        <div className="stack stack--posts">
          {list.slice(0, limit).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {list.length > limit && (
            <button className="btn btn--wide btn--loadmore" onClick={() => setLimit((l) => l + 10)}>
              ПОКАЗАТЬ ЕЩЁ ({list.length - limit})
            </button>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="suggest-strip">
          <div className="suggest-strip__title">
            <Icon name="fire" size={13} /> МОЖЕТ ЗАЙТИ
          </div>
          <div className="suggest-strip__row">
            {suggestions.map((p) => {
              const author = profileById(p.authorId)
              return (
                <button key={p.id} className="suggest-card" onClick={() => navigate(`/post/${p.id}`)}>
                  <span className="suggest-card__who">
                    <Avatar seed={author?.handle ?? 'x'} name={author?.name} src={author?.avatarUrl} size={22} />
                    @{author?.handle ?? 'user'}
                  </span>
                  <span className="suggest-card__body">{p.body.slice(0, 90) || 'Без текста'}…</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000
  return h
}
