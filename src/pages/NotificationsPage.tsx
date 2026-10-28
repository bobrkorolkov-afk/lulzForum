import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { Avatar } from '../components/Avatar'
import { Icon, type IconName } from '../components/Icon'
import { EmptyState } from '../components/ui'
import { timeAgo } from '../lib/util'
import type { NotificationKind } from '../types'

const KIND_META: Record<NotificationKind, { icon: IconName; label: string }> = {
  like: { icon: 'heart', label: 'лайкнул(а) ваш пост' },
  comment: { icon: 'comment', label: 'ответил(а) на пост' },
  friend: { icon: 'friends', label: 'хочет добавить в друзья' },
  message: { icon: 'chat', label: 'написал(а) в чате' },
  music: { icon: 'music', label: 'поделился(ась) треком' },
}

export function NotificationsPage() {
  const { user, notifications, profileById, markNotificationsRead, unreadNotifications } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()


  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="bell"
          title="Уведомления после входа"
          hint="Лайки, комментарии, заявки в друзья и сообщения — всё здесь."
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
          <h1 className="page__title">УВЕДОМЛЕНИЯ</h1>
          <p className="page__sub">
            {unreadNotifications > 0 ? `${unreadNotifications} новых` : 'Всё прочитано'} · всего {notifications.length}
          </p>
        </div>
        <button className="btn" onClick={() => void markNotificationsRead()} disabled={unreadNotifications === 0}>
          <Icon name="check" size={14} /> ПРОЧИТАТЬ ВСЁ
        </button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon="bell" title="Тишина" hint="Пока никто не взаимодействовал с вашим профилем." />
      ) : (
        <div className="notifs">
          {notifications.map((n) => {
            const actor = profileById(n.actorId)
            const meta = KIND_META[n.kind]
            return (
              <button
                key={n.id}
                className={`notif ${n.read ? '' : 'notif--unread'}`}
                onClick={() => {
                  if (n.postId) navigate(`/post/${n.postId}`)
                  else if (n.chatId) navigate(`/chats/${n.chatId}`)
                  else if (actor) navigate(`/u/${actor.handle}`)
                }}
              >
                <span className="notif__kind">
                  <Icon name={meta.icon} size={16} />
                </span>
                <Avatar seed={actor?.handle ?? n.actorId} name={actor?.name} src={actor?.avatarUrl} size={34} />
                <span className="notif__text">
                  <b>{actor?.name ?? 'Кто-то'}</b> {meta.label}
                  {n.text ? <span className="notif__quote"> «{n.text}»</span> : null}
                  <span className="notif__time">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <i className="dot dot--unread" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
