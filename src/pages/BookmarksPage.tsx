import { useApp } from '../lib/app'
import { useUI } from '../lib/ui'
import { PostCard } from '../components/PostCard'
import { EmptyState } from '../components/ui'

export function BookmarksPage() {
  const { user, posts } = useApp()
  const ui = useUI()
  const saved = posts.filter((p) => p.bookmarkedByMe)

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="bookmark"
          title="Закладки после входа"
          hint="Сохранённые посты всегда под рукой."
          action={
            <button className="btn btn--primary" onClick={() => ui.openAuth('login')}>
              ВОЙТИ
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">ЗАКЛАДКИ</h1>
          <p className="page__sub">{saved.length} сохранённых постов</p>
        </div>
      </div>
      {saved.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Пока пусто"
          hint="Нажмите на закладку под любым постом — он появится здесь."
        />
      ) : (
        <div className="stack stack--posts">
          {saved.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
