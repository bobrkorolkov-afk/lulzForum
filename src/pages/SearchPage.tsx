import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { PostCard } from '../components/PostCard'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState, Segmented } from '../components/ui'
import { formatCount } from '../lib/util'

type Tab = 'all' | 'posts' | 'people' | 'tags'

export function SearchPage({ query }: { query: string }) {
  const { posts, profiles, searchUsers, user } = useApp()
  const { navigate } = useRouter()
  const [tab, setTab] = useState<Tab>('all')
  const [input, setInput] = useState(query)
  const [remoteUsers, setRemoteUsers] = useState(profiles)

  useEffect(() => {
    setInput(query)
  }, [query])

  useEffect(() => {
    if (!query.trim()) return
    void searchUsers(query).then((list) => setRemoteUsers(list.length ? list : profiles))
  }, [query, searchUsers, profiles])

  const q = query.trim().toLowerCase()

  const matchedPosts = useMemo(
    () => (q ? posts.filter((p) => p.body.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))) : []),
    [posts, q],
  )

  const matchedPeople = useMemo(
    () =>
      q
        ? (remoteUsers.length ? remoteUsers : profiles).filter(
            (p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q) || p.bio.toLowerCase().includes(q),
          )
        : [],
    [q, remoteUsers, profiles],
  )

  const matchedTags = useMemo(() => {
    if (!q) return []
    const counts = new Map<string, number>()
    for (const p of posts) for (const t of p.tags) if (t.includes(q)) counts.set(t, (counts.get(t) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [posts, q])

  const total = matchedPosts.length + matchedPeople.length + matchedTags.length

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">ПОИСК</h1>
          <p className="page__sub">
            {q ? <>по запросу «{query}» · {total} совпадений</> : 'Посты, люди и теги — в одном окне'}
          </p>
        </div>
      </div>

      <form
        className="music-search__bar"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/search?q=${encodeURIComponent(input.trim())}`)
        }}
      >
        <Icon name="search" size={16} />
        <input
          value={input}
          autoFocus
          placeholder="Что искать? Например: пиксель или pixel_pete"
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn--primary" type="submit" disabled={!input.trim()}>
          ИСКАТЬ
        </button>
      </form>

      {!q && (
        <EmptyState
          icon="search"
          title="Введите запрос"
          hint="Можно искать по тексту постов, тегам, нику и имени пользователя."
        />
      )}

      {q && (
        <>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: `Всё (${total})` },
              { value: 'posts', label: `Посты (${matchedPosts.length})`, icon: 'home' },
              { value: 'people', label: `Люди (${matchedPeople.length})`, icon: 'user' },
              { value: 'tags', label: `Теги (${matchedTags.length})`, icon: 'tag' },
            ]}
          />

          {(tab === 'all' || tab === 'tags') && matchedTags.length > 0 && (
            <section className="search-block">
              <div className="search-block__title">
                <Icon name="tag" size={13} /> ТЕГИ
              </div>
              <div className="search-tags">
                {matchedTags.map(([t, n]) => (
                  <button key={t} className="tag tag--big" onClick={() => navigate(`/tag/${encodeURIComponent(t)}`)}>
                    #{t} <i>{formatCount(n)}</i>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(tab === 'all' || tab === 'people') && matchedPeople.length > 0 && (
            <section className="search-block">
              <div className="search-block__title">
                <Icon name="user" size={13} /> ЛЮДИ
              </div>
              <div className="people-grid">
                {matchedPeople.map((p) => (
                  <button key={p.id} className="person-card" onClick={() => navigate(`/u/${p.handle}`)}>
                    <Avatar seed={p.handle} name={p.name} src={p.avatarUrl} size={46} />
                    <b>{p.name}</b>
                    <span>@{p.handle}</span>
                    <span className="person-card__bio">{p.bio || 'Без описания'}</span>
                    {user?.id === p.id && <i className="chip chip--tiny">это вы</i>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {(tab === 'all' || tab === 'posts') && (
            <section className="search-block">
              <div className="search-block__title">
                <Icon name="home" size={13} /> ПОСТЫ
              </div>
              {matchedPosts.length === 0 ? (
                <p className="muted small">Постов по запросу нет.</p>
              ) : (
                <div className="stack stack--posts">
                  {matchedPosts.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              )}
            </section>
          )}

          {total === 0 && (
            <EmptyState icon="search" title="Ничего не найдено" hint="Попробуйте другое слово или создайте пост с этим тегом." />
          )}
        </>
      )}
    </div>
  )
}
