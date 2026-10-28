import { useMemo } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { PostCard } from '../components/PostCard'
import { EmptyState } from '../components/ui'
import { Icon } from '../components/Icon'
import { formatCount } from '../lib/util'

export function TagPage({ tag }: { tag: string }) {
  const normalized = tag.toLowerCase()
  const { posts } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()

  const filtered = useMemo(
    () =>
      posts
        .filter((p) => p.tags.some((t) => t.toLowerCase() === normalized) || p.body.toLowerCase().includes(`#${normalized}`))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [posts, normalized],
  )

  const related = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of filtered) for (const t of p.tags) if (t.toLowerCase() !== normalized) counts.set(t, (counts.get(t) ?? 0) + 1)
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }, [filtered, normalized])

  const likes = filtered.reduce((s, p) => s + p.likeCount, 0)

  return (
    <div className="page">
      <button className="backlink" onClick={() => navigate('/')}>
        <Icon name="arrowLeft" size={14} /> В ЛЕНТУ
      </button>

      <div className="tag-hero">
        <div className="tag-hero__hash">#</div>
        <div className="tag-hero__main">
          <h1 className="page__title">{normalized}</h1>
          <p className="page__sub">
            {formatCount(filtered.length)} постов · {formatCount(likes)} лайков в архиве тега
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => ui.openComposer(null, `#${normalized} `)}>
          <Icon name="plus" size={14} /> НАПИСАТЬ В ТЕГ
        </button>
      </div>

      {related.length > 0 && (
        <div className="tag-related">
          <span className="muted small">Рядом:</span>
          {related.map(([t, n]) => (
            <button key={t} className="tag" onClick={() => navigate(`/tag/${encodeURIComponent(t)}`)}>
              #{t} <i>{n}</i>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="tag"
          title={`Тег #${normalized} пуст`}
          hint="Станьте первым, кто напишет в этот тег."
          action={
            <button className="btn btn--primary" onClick={() => ui.openComposer(null, `#${normalized} `)}>
              НАПИСАТЬ ПОСТ
            </button>
          }
        />
      ) : (
        <div className="stack stack--posts">
          {filtered.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
