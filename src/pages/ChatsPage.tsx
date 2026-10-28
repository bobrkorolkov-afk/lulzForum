import { useEffect, useMemo, useState } from 'react'
import type { Chat } from '../types'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { ChatStream } from '../components/ChatStream'
import { EmptyState, Modal } from '../components/ui'
import { timeAgo } from '../lib/util'

export function ChatsPage({ chatId }: { chatId?: string }) {
  const {
    chats,
    user,
    friendIds,
    profileById,
    createGroupChat,
  } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const [query, setQuery] = useState('')
  const [newOpen, setNewOpen] = useState(false)

  // каналы сообществ живут отдельно — их показывает страница группы
  const directChats = useMemo(() => chats.filter((c) => c.kind !== 'channel'), [chats])
  const active = directChats.find((c) => c.id === chatId) ?? null

  const chatTitle = (chat: Chat) => {
    if (chat.kind === 'group') return chat.title || 'Группа'
    const other = chat.memberIds.find((id) => id !== user?.id)
    return profileById(other ?? '')?.name ?? 'Диалог'
  }
  const chatPeer = (chat: Chat) => (chat.kind === 'dm' ? profileById(chat.memberIds.find((id) => id !== user?.id) ?? '') : undefined)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return directChats
    return directChats.filter(
      (c) => chatTitle(c).toLowerCase().includes(q) || c.lastMessageBody.toLowerCase().includes(q),
    )
  }, [directChats, query, user, profileById])

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="chat"
          title="Чаты доступны после входа"
          hint="Войдите или создайте аккаунт — личные сообщения и группы ждут."
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
    <div className="page page--flush">
      <div className={`chats ${active ? 'chats--active' : ''}`}>
        <aside className="chats__list">
          <div className="chats__head">
            <div className="chats__title">
              <h1 className="page__title">ЧАТЫ</h1>
              <span className="chats__count">{directChats.length}</span>
            </div>
            <button className="btn btn--icon" onClick={() => setNewOpen(true)} title="Новый чат">
              <Icon name="plus" size={15} />
            </button>
          </div>
          <div className="chats__search">
            <Icon name="search" size={13} />
            <input value={query} placeholder="Поиск по чатам" onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="chats__items">
            {filtered.length === 0 && <p className="muted small pad">Ничего не найдено</p>}
            {filtered.map((chat) => {
              const peer = chatPeer(chat)
              const title = chatTitle(chat)
              return (
                <button
                  key={chat.id}
                  className={`chat-item ${active?.id === chat.id ? 'is-active' : ''}`}
                  onClick={() => navigate(`/chats/${chat.id}`)}
                >
                  {chat.kind === 'group' ? (
                    <span className="chat-item__group">
                      <Icon name="friends" size={18} />
                    </span>
                  ) : (
                    <Avatar seed={peer?.handle ?? chat.id} name={peer?.name} src={peer?.avatarUrl} size={38} />
                  )}
                  <span className="chat-item__main">
                    <span className="chat-item__top">
                      <b>{title}</b>
                      <span className="chat-item__time">{timeAgo(chat.lastMessageAt)}</span>
                    </span>
                    <span className="chat-item__bottom">
                      <span className="chat-item__last">{chat.lastMessageBody || 'Нет сообщений'}</span>
                      {chat.unreadCount > 0 && <span className="badge">{chat.unreadCount}</span>}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="chat">
          {!active ? (
            <div className="chat__placeholder">
              <EmptyState
                icon="chat"
                title="Выберите чат"
                hint="Или начните новый диалог с другом — кнопка «+» слева."
                action={
                  <button className="btn btn--primary" onClick={() => setNewOpen(true)}>
                    НОВЫЙ ЧАТ
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <header className="chat__head">
                <button className="btn btn--icon chat__back" onClick={() => navigate('/chats')} aria-label="К списку">
                  <Icon name="arrowLeft" size={15} />
                </button>
                {active.kind === 'group' ? (
                  <span className="chat-item__group chat-item__group--sm">
                    <Icon name="friends" size={16} />
                  </span>
                ) : (
                  <Avatar
                    seed={chatPeer(active)?.handle ?? active.id}
                    name={chatPeer(active)?.name}
                    src={chatPeer(active)?.avatarUrl}
                    size={34}
                  />
                )}
                <div className="chat__head-text">
                  <b>{chatTitle(active)}</b>
                  <span>
                    {active.kind === 'group'
                      ? `${active.memberIds.length} участников`
                      : chatPeer(active)
                        ? `@${chatPeer(active)?.handle} · в сети`
                        : 'диалог'}
                  </span>
                </div>
                {chatPeer(active) && (
                  <button className="btn btn--icon" onClick={() => navigate(`/u/${chatPeer(active)?.handle}`)} title="Профиль">
                    <Icon name="user" size={15} />
                  </button>
                )}
              </header>

              <ChatStream chat={active} />
            </>
          )}
        </section>
      </div>

      <NewChatModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        friendIds={Array.from(friendIds)}
        onCreate={async (members, title) => {
          const chat = await createGroupChat(members, title)
          setNewOpen(false)
          navigate(`/chats/${chat.id}`)
        }}
        profileById={profileById}
      />
    </div>
  )
}

function NewChatModal({
  open,
  onClose,
  friendIds,
  onCreate,
  profileById,
}: {
  open: boolean
  onClose: () => void
  friendIds: string[]
  onCreate: (members: string[], title: string) => Promise<void>
  profileById: (id: string) => { name: string; handle: string; avatarUrl?: string | null } | undefined
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelected([])
      setTitle('')
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="НОВЫЙ ЧАТ" width={460}>
      <div className="stack">
        <p className="muted small">Выберите одного друга для диалога или нескольких для группы.</p>
        <div className="people-pick">
          {friendIds.length === 0 && <p className="muted small">Сначала добавьте друзей в разделе «Друзья».</p>}
          {friendIds.map((id) => {
            const p = profileById(id)
            if (!p) return null
            const on = selected.includes(id)
            return (
              <button
                key={id}
                className={`person-row ${on ? 'is-on' : ''}`}
                onClick={() => setSelected((s) => (on ? s.filter((x) => x !== id) : [...s, id]))}
              >
                <Avatar seed={p.handle} name={p.name} src={p.avatarUrl} size={30} />
                <span className="person-row__text">
                  <b>{p.name}</b>
                  <span>@{p.handle}</span>
                </span>
                <span className="checkbox">{on && <Icon name="check" size={12} />}</span>
              </button>
            )
          })}
        </div>
        {selected.length > 1 && (
          <label className="field">
            <span>Название группы</span>
            <input
              className="input"
              value={title}
              maxLength={50}
              placeholder="БИТМАП ШТАБ"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        )}
        <button
          className="btn btn--primary btn--wide"
          disabled={!selected.length || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onCreate(selected, title || 'НОВАЯ ГРУППА')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'СОЗДАЮ…' : 'СОЗДАТЬ ЧАТ'}
        </button>
      </div>
    </Modal>
  )
}

