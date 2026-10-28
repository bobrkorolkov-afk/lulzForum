import { useEffect, useRef, useState } from 'react'
import type { Chat, Message } from '../types'
import { backend, useApp } from '../lib/app'
import { useToast } from '../lib/toast'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { formatTime } from '../lib/util'
import { isPixelArt } from '../lib/util'

/**
 * Лента сообщений + композер. Используется и в личных чатах, и в текстовых
 * каналах сообществ — канал живёт в той же таблице чатов.
 */
export function ChatStream({
  chat,
  showAuthors,
  placeholder,
  onSent,
}: {
  chat: Chat
  showAuthors?: boolean
  placeholder?: string
  onSent?: (msg: Message) => void
}) {
  const { user, profileById, messagesOf, openChat, sendMessage, sendFile, loadMessages } = useApp()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const messages = messagesOf[chat.id] ?? []
  const authors = showAuthors ?? chat.kind !== 'dm'

  useEffect(() => {
    if (!user) return
    void openChat(chat.id, chat.memberIds)
  }, [chat.id, user?.id])

  useEffect(() => {
    if (!user) return
    const unsub = backend.subscribeChat(chat.id, (msg: Message) => {
      if (msg.senderId === user.id) return
      void loadMessages(chat.id, chat.memberIds)
    })
    return unsub
  }, [chat.id, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, chat.id])

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const msg = await sendMessage(chat.id, text)
      setText('')
      onSent?.(msg)
    } finally {
      setBusy(false)
    }
  }

  const attach = async (file?: File) => {
    if (!file) return
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
      const msg = await sendMessage(chat.id, '', {
        name: file.name,
        url,
        size: file.size,
        mime: file.type || 'file',
      })
      onSent?.(msg)
    } catch {
      toast.push('Не удалось прикрепить файл', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="chat__messages">
        {messages.length === 0 && (
          <div className="chat__empty">
            <Icon name="chat" size={32} />
            <p>Сообщений пока нет. Напишите первым!</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.senderId === user?.id
          const sender = profileById(m.senderId)
          const prev = messages[i - 1]
          const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
          const grouped = prev && prev.senderId === m.senderId && dayKey(prev.createdAt) === dayKey(m.createdAt)
          return (
            <div key={m.id}>
              {showDay && <div className="chat__day">{dayLabel(m.createdAt)}</div>}
              <div className={`msg ${mine ? 'msg--mine' : ''} ${grouped ? 'msg--grouped' : ''}`}>
                {!mine && !grouped && (
                  <Avatar seed={sender?.handle ?? m.senderId} name={sender?.name} src={sender?.avatarUrl} size={28} />
                )}
                {!mine && grouped && <span className="msg__gap" />}
                <div className="msg__bubble">
                  {!mine && authors && !grouped && <div className="msg__author">{sender?.name ?? 'ЮЗЕР'}</div>}
                  {m.body && <div className="msg__text">{m.body}</div>}
                  {m.attachment && (
                    <a
                      className={`msg__file ${m.attachment.mime.startsWith('image/') ? 'msg__file--image' : ''}`}
                      href={m.attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {m.attachment.mime.startsWith('image/') ? (
                        <img
                          className={isPixelArt(m.attachment.url) ? 'art--auto' : undefined}
                          src={m.attachment.url}
                          alt={m.attachment.name}
                        />
                      ) : (
                        <>
                          <Icon name="folder" size={14} /> {m.attachment.name}
                        </>
                      )}
                    </a>
                  )}
                  <div className="msg__meta">
                    {formatTime(m.createdAt)}
                    {mine && <span className="msg__read">{m.readBy.length > 1 ? '✓✓' : '✓'}</span>}
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
          placeholder={placeholder ?? 'Сообщение…'}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="btn btn--primary" type="submit" disabled={!text.trim() || busy}>
          <Icon name="send" size={14} />
          <span className="hide-sm">ОТПРАВИТЬ</span>
        </button>
      </form>
    </>
  )
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'СЕГОДНЯ'
  if (d.toDateString() === yesterday.toDateString()) return 'ВЧЕРА'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })
}
