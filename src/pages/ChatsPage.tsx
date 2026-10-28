import { useEffect, useMemo, useRef, useState } from 'react'
import type { Chat, Message } from '../types'
import { backend, useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState, Modal } from '../components/ui'
import { formatTime, timeAgo } from '../lib/util'

export function ChatsPage({ chatId }: { chatId?: string }) {
  const {
    chats,
    user,
    friendIds,
    profileById,
    messagesOf,
    openChat,
    sendMessage,
    createGroupChat,
    sendFile,
    loadMessages,
  } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = chats.find((c) => c.id === chatId) ?? null
  const messages = active ? messagesOf[active.id] ?? [] : []

  const chatTitle = (chat: Chat) => {
    if (chat.kind === 'group') return chat.title || 'Группа'
    const other = chat.memberIds.find((id) => id !== user?.id)
    return profileById(other ?? '')?.name ?? 'Диалог'
  }
  const chatPeer = (chat: Chat) => (chat.kind === 'dm' ? profileById(chat.memberIds.find((id) => id !== user?.id) ?? '') : undefined)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chats
    return chats.filter((c) => chatTitle(c).toLowerCase().includes(q) || c.lastMessageBody.toLowerCase().includes(q))
  }, [chats, query, user, profileById])

  useEffect(() => {
    if (!active || !user) return
    void openChat(active.id, active.memberIds)
  }, [active?.id, user?.id])

  useEffect(() => {
    if (!active) return
    const unsub = backend.subscribeChat(active.id, (msg: Message) => {
      if (msg.senderId === user?.id) return
      void loadMessages(active.id, active.memberIds)
    })
    return unsub
  }, [active?.id, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, active?.id])

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

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!active || !text.trim() || busy) return
    setBusy(true)
    try {
      await sendMessage(active.id, text)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  const attach = async (file?: File) => {
    if (!active || !file) return
    setBusy(true)
    try {
      const isImage = file.type.startsWith('image/')
      let url = ''
      if (isImage) {
        url = await backend.uploadPublicImage(file)
      } else {
        const item = await sendFile(file)
        url = item.url
      }
      await sendMessage(active.id, '', { name: file.name, url, size: file.size, mime: file.type || 'file' })
    } catch {
      toast.push('Не удалось прикрепить файл', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page--flush">
      <div className={`chats ${active ? 'chats--active' : ''}`}>
        <aside className="chats__list">
          <div className="chats__head">
            <div className="chats__title">
              <h1 className="page__title">ЧАТЫ</h1>
              <span className="chats__count">{chats.length}</span>
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

              <div className="chat__messages">
                {messages.length === 0 && (
                  <div className="chat__empty">
                    <Icon name="chat" size={32} />
                    <p>Сообщений пока нет. Напишите первым!</p>
                  </div>
                )}
                {messages.map((m, i) => {
                  const mine = m.senderId === user.id
                  const sender = profileById(m.senderId)
                  const prev = messages[i - 1]
                  const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
                  const grouped =
                    prev && prev.senderId === m.senderId && dayKey(prev.createdAt) === dayKey(m.createdAt)
                  return (
                    <div key={m.id}>
                      {showDay && <div className="chat__day">{dayLabel(m.createdAt)}</div>}
                      <div className={`msg ${mine ? 'msg--mine' : ''} ${grouped ? 'msg--grouped' : ''}`}>
                        {!mine && !grouped && (
                          <Avatar seed={sender?.handle ?? m.senderId} name={sender?.name} src={sender?.avatarUrl} size={28} />
                        )}
                        {!mine && grouped && <span className="msg__gap" />}
                        <div className="msg__bubble">
                          {!mine && active.kind === 'group' && !grouped && (
                            <div className="msg__author">{sender?.name ?? 'ЮЗЕР'}</div>
                          )}
                          {m.body && <div className="msg__text">{m.body}</div>}
                          {m.attachment && (
                            <a
                              className={`msg__file ${m.attachment.mime.startsWith('image/') ? 'msg__file--image' : ''}`}
                              href={m.attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {m.attachment.mime.startsWith('image/') ? (
                                <img src={m.attachment.url} alt={m.attachment.name} />
                              ) : (
                                <>
                                  <Icon name="folder" size={14} /> {m.attachment.name}
                                </>
                              )}
                            </a>
                          )}
                          <div className="msg__meta">
                            {formatTime(m.createdAt)}
                            {mine && (
                              <span className="msg__read">
                                {m.readBy.length > 1 ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <form className="chat__composer" onSubmit={submit}>
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => fileRef.current?.click()}
                  title="Прикрепить файл"
                  disabled={busy}
                >
                  <Icon name="upload" size={16} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  onChange={(e) => {
                    void attach(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <input
                  className="input"
                  value={text}
                  placeholder="Сообщение…"
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                />
                <button className="btn btn--primary" type="submit" disabled={!text.trim() || busy}>
                  <Icon name="send" size={14} />
                  <span className="hide-sm">ОТПРАВИТЬ</span>
                </button>
              </form>
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

function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'СЕГОДНЯ'
  if (d.toDateString() === yesterday.toDateString()) return 'ВЧЕРА'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })
}
