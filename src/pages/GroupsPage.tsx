import { useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import type { Group } from '../types'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState, Modal } from '../components/ui'

export function GroupsPage() {
  const { groups, user, createGroup, joinGroup, leaveGroup } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => `${g.name} ${g.description}`.toLowerCase().includes(q))
  }, [groups, query])

  const mine = filtered.filter((g) => g.isMember)
  const others = filtered.filter((g) => !g.isMember)

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="users"
          title="Сообщества доступны после входа"
          hint="Текстовые и голосовые каналы, участники, общие файлы — войдите, чтобы вступить."
          action={
            <button className="btn btn--primary" onClick={() => ui.openAuth('login')}>
              ВОЙТИ
            </button>
          }
        />
      </div>
    )
  }

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const bundle = await createGroup(name, description)
      if (bundle) {
        setCreating(false)
        setName('')
        setDescription('')
        navigate(`/g/${bundle.group.id}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">СООБЩЕСТВА</h1>
          <p className="page__sub">Комнаты с текстовыми и голосовыми каналами — как в большом мессенджере, только пиксельно.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> <span>СОЗДАТЬ</span>
        </button>
      </div>

      <div className="chats__search groups__search">
        <Icon name="search" size={13} />
        <input value={query} placeholder="Найти сообщество" onChange={(e) => setQuery(e.target.value)} />
      </div>

      {mine.length > 0 && (
        <>
          <h2 className="section-title">МОИ СООБЩЕСТВА</h2>
          <div className="groups-grid">
            {mine.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                onOpen={() => navigate(`/g/${g.id}`)}
                action={
                  <button
                    className="btn btn--sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Покинуть «${g.name}»?`)) void leaveGroup(g.id)
                    }}
                  >
                    ПОКИНУТЬ
                  </button>
                }
              />
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">ОТКРЫТЬ ДЛЯ СЕБЯ</h2>
      {others.length === 0 ? (
        <p className="muted small">
          {groups.length === 0 ? 'Сообществ пока нет — создайте первое.' : 'Вы уже во всех сообществах.'}
        </p>
      ) : (
        <div className="groups-grid">
          {others.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onOpen={() => navigate(`/g/${g.id}`)}
              action={
                <button
                  className="btn btn--primary btn--sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    void joinGroup(g.id)
                  }}
                >
                  ВСТУПИТЬ
                </button>
              }
            />
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="НОВОЕ СООБЩЕСТВО" width={480}>
        <div className="stack">
          <p className="muted small">
            Внутри сразу появятся два канала: текстовый «общий» и голосовой. Названия можно поменять и добавить свои.
          </p>
          <label className="field">
            <span>Название</span>
            <input
              className="input"
              value={name}
              maxLength={60}
              placeholder="ПИКСЕЛЬ-ЦЕХ"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Описание</span>
            <textarea
              className="input input--area"
              value={description}
              maxLength={300}
              rows={3}
              placeholder="О чём сообщество, какие правила"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button className="btn btn--primary btn--wide" disabled={!name.trim() || busy} onClick={submit}>
            {busy ? 'СОЗДАЮ…' : 'СОЗДАТЬ СООБЩЕСТВО'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function GroupCard({ group, onOpen, action }: { group: Group; onOpen: () => void; action: React.ReactNode }) {
  return (
    <div className="group-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="group-card__top">
        <Avatar seed={group.id} name={group.name} src={group.iconUrl} size={44} />
        <div className="group-card__title">
          <b>{group.name}</b>
          <span>
            <Icon name="users" size={11} /> {group.memberCount}
          </span>
        </div>
      </div>
      <p className="group-card__desc">{group.description || 'Без описания'}</p>
      <div className="group-card__foot">{action}</div>
    </div>
  )
}
