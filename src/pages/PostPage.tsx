import { useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useToast } from '../lib/toast'
import { PostCard } from '../components/PostCard'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/ui'
import { RichText } from '../components/RichText'
import { timeAgo } from '../lib/util'

export function PostPage({ id }: { id: string }) {
  const { posts, commentsOf, loadComments, addComment, profileById, user } = useApp()
  const { navigate, back } = useRouter()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const post = posts.find((p) => p.id === id)
  const comments = commentsOf[id] ?? []

  useEffect(() => {
    if (post) void loadComments(id)
  }, [id, post, loadComments])

  if (!post) {
    return (
      <div className="page">
        <EmptyState
          icon="search"
          title="Пост не найден"
          hint="Возможно, он удалён или ссылка неверна."
          action={
            <button className="btn btn--primary" onClick={() => navigate('/')}>
              В ЛЕНТУ
            </button>
          }
        />
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    if (!user) {
      toast.push('Войдите, чтобы комментировать', 'error')
      return
    }
    setBusy(true)
    try {
      await addComment(id, text)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page--post">
      <button className="backlink" onClick={back}>
        <Icon name="arrowLeft" size={14} /> НАЗАД
      </button>

      <PostCard post={post} onDeleted={() => navigate('/')} />

      <section className="comments">
        <div className="comments__head">
          <span>
            <Icon name="comment" size={14} /> КОММЕНТАРИИ · {comments.length}
          </span>
        </div>

        {comments.length === 0 && <p className="muted small">Пока никто не ответил. Будьте первым.</p>}

        <div className="comments__list">
          {comments.map((c) => {
            const author = profileById(c.authorId)
            return (
              <article key={c.id} className="comment">
                <button className="comment__avatar" onClick={() => author && navigate(`/u/${author.handle}`)}>
                  <Avatar seed={author?.handle ?? c.authorId} name={author?.name} src={author?.avatarUrl} size={30} />
                </button>
                <div className="comment__main">
                  <div className="comment__head">
                    <b>{author?.name ?? 'ЮЗЕР'}</b>
                    <span>
                      @{author?.handle ?? 'user'} · {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <RichText text={c.body} />
                </div>
              </article>
            )
          })}
        </div>

        <form className="comment-form" onSubmit={submit}>
          {user ? (
            <Avatar seed={user.handle} name={user.name} src={user.avatarUrl} size={30} />
          ) : (
            <span className="comment-form__anon">
              <Icon name="user" size={14} />
            </span>
          )}
          <input
            className="input"
            value={text}
            maxLength={1000}
            placeholder={user ? 'Ваш комментарий…' : 'Войдите, чтобы комментировать'}
            onChange={(e) => setText(e.target.value)}
            disabled={!user}
          />
          <button className="btn btn--primary" type="submit" disabled={!text.trim() || busy || !user}>
            <Icon name="send" size={14} /> ОТПРАВИТЬ
          </button>
        </form>
      </section>
    </div>
  )
}
