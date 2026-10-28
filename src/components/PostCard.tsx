import { useState } from 'react'
import type { Post } from '../types'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { usePlayer } from '../lib/player'
import { formatCount, isPixelArt, timeAgo, truncate } from '../lib/util'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { RichText } from './RichText'
import { PROVIDER_LABEL } from '../lib/music'

export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const { profileById, user, toggleLike, toggleBookmark, deletePost, saveTrack, tracks } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const toast = useToast()
  const player = usePlayer()
  const [menuOpen, setMenuOpen] = useState(false)

  const author = profileById(post.authorId)
  const isMine = user?.id === post.authorId
  const savedTrack = post.track ? tracks.find((t) => t.track.id === post.track?.id) : undefined

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/post/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.push('Ссылка на пост скопирована', 'ok')
    } catch {
      toast.push(truncate(url, 48))
    }
  }

  return (
    <article className="post">
      <header className="post__head">
        <button className="post__author" onClick={() => author && navigate(`/u/${author.handle}`)}>
          <Avatar seed={author?.handle ?? post.authorId} name={author?.name} src={author?.avatarUrl} size={38} />
          <span className="post__author-text">
            <span className="post__name">
              {author?.name ?? 'УДАЛЁННЫЙ ЮЗЕР'}
              {post.pinned && <span className="chip chip--pin">закреплён</span>}
            </span>
            <span className="post__handle">
              @{author?.handle ?? 'unknown'} · {timeAgo(post.createdAt)}
            </span>
          </span>
        </button>

        <div className="post__menu-wrap">
          <button className="btn btn--icon" onClick={() => setMenuOpen((v) => !v)} aria-label="Действия">
            <Icon name="more" size={14} />
          </button>
          {menuOpen && (
            <>
              <button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" />
              <div className="menu">
                <button
                  className="menu__item"
                  onClick={() => {
                    setMenuOpen(false)
                    void share()
                  }}
                >
                  <Icon name="copy" size={14} /> Скопировать ссылку
                </button>
                <button
                  className="menu__item"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate(`/post/${post.id}`)
                  }}
                >
                  <Icon name="external" size={14} /> Открыть пост
                </button>
                {isMine && (
                  <button
                    className="menu__item menu__item--danger"
                    onClick={() => {
                      setMenuOpen(false)
                      void deletePost(post.id).then(() => onDeleted?.())
                    }}
                  >
                    <Icon name="trash" size={14} /> Удалить
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {post.body && (
        <div className="post__body" onClick={() => navigate(`/post/${post.id}`)}>
          <RichText text={post.body} />
        </div>
      )}

      {post.imageUrl && (
        <button className="post__image" onClick={() => ui.openLightbox(post.imageUrl!)}>
          <img className={isPixelArt(post.imageUrl) ? 'art--auto' : undefined} src={post.imageUrl} alt="Вложение поста" loading="lazy" />
        </button>
      )}

      {post.track && (
        <div className="post__track">
          <button
            className="post__track-play"
            onClick={() => player.playTrack(post.track!, [post.track!])}
            title="Слушать"
          >
            <Icon name={player.current?.id === post.track.id && player.playing ? 'pause' : 'play'} size={18} />
          </button>
          {post.track.artwork && (
            <img className={`post__track-art ${isPixelArt(post.track.artwork) ? 'art--auto' : ''}`} src={post.track.artwork} alt="" />
          )}
          <span className="post__track-main">
            <span className="post__track-title">{post.track.title}</span>
            <span className="post__track-artist">
              {post.track.artist} · {PROVIDER_LABEL[post.track.provider]}
            </span>
          </span>
          {post.track.externalUrl && (
            <a
              className="btn btn--icon"
              href={post.track.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Источник"
            >
              <Icon name="external" size={14} />
            </a>
          )}
          <button
            className={`btn btn--icon ${savedTrack ? 'is-on' : ''}`}
            onClick={() => void saveTrack(post.track!)}
            title="В мою музыку"
          >
            <Icon name={savedTrack ? 'check' : 'plus'} size={14} />
          </button>
        </div>
      )}

      {post.tags.length > 0 && (
        <div className="post__tags">
          {post.tags.map((tag) => (
            <button key={tag} className="tag" onClick={() => navigate(`/tag/${encodeURIComponent(tag)}`)}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      <footer className="post__actions">
        <button
          className={`act ${post.likedByMe ? 'act--on' : ''}`}
          onClick={() => void toggleLike(post.id)}
          title="Лайк"
        >
          <Icon name="heart" size={15} /> {formatCount(post.likeCount)}
        </button>
        <button className="act" onClick={() => navigate(`/post/${post.id}`)} title="Комментарии">
          <Icon name="comment" size={15} /> {formatCount(post.commentCount)}
        </button>
        <button
          className={`act ${post.bookmarkedByMe ? 'act--on' : ''}`}
          onClick={() => void toggleBookmark(post.id)}
          title="В закладки"
        >
          <Icon name="bookmark" size={15} />
        </button>
        <button className="act act--ghost" onClick={() => void share()} title="Поделиться">
          <Icon name="copy" size={15} />
        </button>
        <button
          className="act act--ghost"
          onClick={() => ui.openComposer(post.track ?? null, '')}
          title="Написать пост"
        >
          <Icon name="edit" size={15} />
        </button>
      </footer>
    </article>
  )
}
