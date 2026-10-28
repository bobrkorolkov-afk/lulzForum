import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState, Segmented } from '../components/ui'
import { debounce, formatDate } from '../lib/util'

type Tab = 'friends' | 'incoming' | 'outgoing' | 'find'

export function FriendsPage() {
  const {
    user,
    profiles,
    friendships,
    friendIds,
    pendingIncoming,
    pendingOutgoing,
    profileById,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    startDm,
    searchUsers,
    posts,
  } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const [tab, setTab] = useState<Tab>('friends')
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<typeof profiles>([])


  useEffect(() => {
    if (!query.trim()) {
      setFound([])
      return
    }
    const run = debounce((q: string) => {
      void searchUsers(q).then(setFound)
    }, 280)
    run(query)
  }, [query, searchUsers])

  const friends = useMemo(
    () => Array.from(friendIds).map((id) => profileById(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [friendIds, profileById],
  )

  const findList = query.trim() ? found : profiles.filter((p) => p.id !== user?.id)

  const friendshipWith = (id: string) =>
    friendships.find(
      (f) => (f.requesterId === user?.id && f.addresseeId === id) || (f.addresseeId === user?.id && f.requesterId === id),
    )

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="friends"
          title="Друзья после входа"
          hint="Войдите, чтобы добавлять людей, принимать заявки и писать в личку."
          action={
            <button className="btn btn--primary" onClick={() => ui.openAuth('login')}>
              ВОЙТИ
            </button>
          }
        />
      </div>
    )
  }

  const renderUser = (id: string, actions?: React.ReactNode) => {
    const p = profileById(id)
    if (!p) return null
    const postsCount = posts.filter((x) => x.authorId === id).length
    return (
      <article key={id} className="usercard">
        <button className="usercard__main" onClick={() => navigate(`/u/${p.handle}`)}>
          <Avatar seed={p.handle} name={p.name} src={p.avatarUrl} size={46} />
          <span className="usercard__text">
            <b>{p.name}</b>
            <span className="usercard__handle">@{p.handle}</span>
            <span className="usercard__bio">{p.bio || 'Без описания'}</span>
            <span className="usercard__stats">
              {postsCount} постов · с {formatDate(p.createdAt)}
            </span>
          </span>
        </button>
        <div className="usercard__actions">{actions}</div>
      </article>
    )
  }

  const messageBtn = (id: string) => (
    <button
      className="btn"
      onClick={async () => {
        const chat = await startDm(id)
        navigate(`/chats/${chat.id}`)
      }}
    >
      <Icon name="chat" size={13} /> НАПИСАТЬ
    </button>
  )

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">ДРУЗЬЯ</h1>
          <p className="page__sub">
            {friends.length} в друзьях · {pendingIncoming.length} входящих заявок
          </p>
        </div>
        <div className="friends-search">
          <Icon name="search" size={13} />
          <input value={query} placeholder="Найти человека по нику" onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: `Друзья (${friends.length})`, icon: 'friends' },
          { value: 'incoming', label: `Заявки (${pendingIncoming.length})`, icon: 'bell' },
          { value: 'outgoing', label: `Отправлено (${pendingOutgoing.length})`, icon: 'send' },
          { value: 'find', label: 'Найти людей', icon: 'search' },
        ]}
      />

      {tab === 'friends' && (
        <div className="stack">
          {friends.length === 0 && (
            <EmptyState
              icon="friends"
              title="Пока никого"
              hint="Перейдите во вкладку «Найти людей» и отправьте пару заявок."
              action={
                <button className="btn btn--primary" onClick={() => setTab('find')}>
                  НАЙТИ ЛЮДЕЙ
                </button>
              }
            />
          )}
          {friends
            .filter((f) => !query.trim() || f.name.toLowerCase().includes(query.toLowerCase()) || f.handle.includes(query.toLowerCase()))
            .map((f) => {
              const fs = friendshipWith(f.id)
              return renderUser(
                f.id,
                <>
                  {messageBtn(f.id)}
                  <button
                    className="btn btn--danger"
                    onClick={() => fs && void removeFriend(fs.id)}
                    title="Убрать из друзей"
                  >
                    <Icon name="close" size={13} />
                  </button>
                </>,
              )
            })}
        </div>
      )}

      {tab === 'incoming' && (
        <div className="stack">
          {pendingIncoming.length === 0 && <EmptyState icon="bell" title="Входящих заявок нет" hint="Как только кто-то захочет дружить — увидите здесь." />}
          {pendingIncoming.map((f) =>
            renderUser(
              f.requesterId,
              <>
                <button className="btn btn--primary" onClick={() => void respondFriendRequest(f.id, true)}>
                  <Icon name="check" size={13} /> ПРИНЯТЬ
                </button>
                <button className="btn" onClick={() => void respondFriendRequest(f.id, false)}>
                  ОТКЛОНИТЬ
                </button>
              </>,
            ),
          )}
        </div>
      )}

      {tab === 'outgoing' && (
        <div className="stack">
          {pendingOutgoing.length === 0 && <EmptyState icon="send" title="Вы никого не добавили" hint="Найдите людей во вкладке «Найти людей»." />}
          {pendingOutgoing.map((f) =>
            renderUser(
              f.addresseeId,
              <button className="btn" onClick={() => void removeFriend(f.id)}>
                ОТМЕНИТЬ ЗАЯВКУ
              </button>,
            ),
          )}
        </div>
      )}

      {tab === 'find' && (
        <div className="stack">
          {findList.length === 0 && <EmptyState icon="search" title="Никого не нашли" hint="Попробуйте другой запрос." />}
          {findList.map((p) => {
            const fs = friendshipWith(p.id)
            const isFriend = fs?.status === 'accepted'
            const outgoing = fs?.status === 'pending' && fs.requesterId === user.id
            const incoming = fs?.status === 'pending' && fs.addresseeId === user.id
            return renderUser(
              p.id,
              <>
                {isFriend ? (
                  <>
                    {messageBtn(p.id)}
                    <span className="chip">
                      <Icon name="check" size={11} /> друг
                    </span>
                  </>
                ) : incoming ? (
                  <button className="btn btn--primary" onClick={() => fs && void respondFriendRequest(fs.id, true)}>
                    ПРИНЯТЬ ЗАЯВКУ
                  </button>
                ) : outgoing ? (
                  <button className="btn" onClick={() => fs && void removeFriend(fs.id)}>
                    ЗАЯВКА ОТПРАВЛЕНА
                  </button>
                ) : (
                  <button className="btn btn--primary" onClick={() => void sendFriendRequest(p.id)}>
                    <Icon name="plus" size={13} /> В ДРУЗЬЯ
                  </button>
                )}
              </>,
            )
          })}
        </div>
      )}
    </div>
  )
}
