import type {
  Attachment,
  AuthResult,
  Backend,
  Channel,
  ChannelKind,
  Chat,
  Comment,
  FileItem,
  Friendship,
  Group,
  GroupBundle,
  GroupMember,
  ID,
  Message,
  Notification,
  Playlist,
  Post,
  PostInput,
  Profile,
  SavedTrack,
  Track,
} from '../types'
import { seed, DEMO_USER_ID } from './seed'
import { compressImage, fileKind, extractTags, normalizeTag, safeNick, sleep, uid } from './util'

const DB_NAME = 'lulzforum'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function readKey<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb()
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } catch {
    // IndexedDB unavailable (private mode / blocked): fall back to memory-only.
    const raw = localStorage.getItem(`lulzforum:${key}`)
    return raw ? (JSON.parse(raw) as T) : undefined
  }
}

async function writeKey<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    try {
      localStorage.setItem(`lulzforum:${key}`, JSON.stringify(value))
    } catch {
      /* ignore quota errors */
    }
  }
}

async function removeKey(key: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    localStorage.removeItem(`lulzforum:${key}`)
  }
}

interface AccountRow {
  email: string
  password: string
  profile: Profile
}

interface Db {
  profiles: Profile[]
  posts: Post[]
  comments: Comment[]
  groups: Group[]
  channels: Channel[]
  groupMembers: GroupMember[]
  chats: Chat[]
  messages: Message[]
  friendships: Friendship[]
  savedTracks: SavedTrack[]
  playlists: Playlist[]
  files: FileItem[]
  notifications: Notification[]
  accounts: AccountRow[]
  likes: Record<ID, ID[]>
  bookmarks: Record<ID, ID[]>
}

type Listener = (user: Profile | null) => void

const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T))

export class LocalBackend implements Backend {
  mode = 'local' as const
  private db: Db | null = null
  private user: Profile | null = null
  private listeners = new Set<Listener>()

  private async load(): Promise<Db> {
    if (this.db) return this.db
    const stored = await readKey<Db>('db')
    if (stored) {
      this.db = { ...emptyDb(), ...stored }
    } else {
      this.db = {
        profiles: clone(seed.profiles),
        posts: clone(seed.posts),
        comments: clone(seed.comments),
        groups: clone(seed.groups),
        channels: clone(seed.channels),
        groupMembers: clone(seed.groupMembers),
        chats: clone(seed.chats),
        messages: clone(seed.messages),
        friendships: clone(seed.friendships),
        savedTracks: clone(seed.savedTracks),
        playlists: clone(seed.playlists),
        files: clone(seed.files),
        notifications: clone(seed.notifications),
        accounts: [],
        likes: {},
        bookmarks: {},
      }
      await this.persist()
    }
    return this.db
  }

  private async persist() {
    if (this.db) await writeKey('db', this.db)
  }

  private emit() {
    for (const l of this.listeners) l(this.user)
  }

  private requireUser(): Profile {
    if (!this.user) throw new Error('Нужно войти в аккаунт')
    return this.user
  }

  async init(): Promise<Profile | null> {
    const db = await this.load()
    const sessionId = await readKey<ID>('session')
    if (sessionId === DEMO_USER_ID) {
      this.user = db.profiles.find((p) => p.id === DEMO_USER_ID) ?? null
      return this.user
    }
    this.user = sessionId ? db.profiles.find((p) => p.id === sessionId && !p.bot) ?? null : null
    return this.user
  }

  onAuthChange(cb: Listener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const db = await this.load()
    const acc = db.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
    if (!acc || acc.password !== password) throw new Error('Неверная почта или пароль')
    this.user = acc.profile
    await writeKey('session', acc.profile.id)
    this.emit()
    return { user: this.user }
  }

  async signUp(email: string, password: string, handle: string, name: string): Promise<AuthResult> {
    const db = await this.load()
    const mail = email.trim().toLowerCase()
    if (db.accounts.some((a) => a.email.toLowerCase() === mail)) throw new Error('Такая почта уже занята')
    const nick = safeNick(handle) || `user${Math.floor(Math.random() * 9999)}`
    if (db.profiles.some((p) => p.handle.toLowerCase() === nick)) throw new Error('Такой ник уже занят')
    const profile: Profile = {
      id: uid('u'),
      handle: nick,
      name: (name || nick).toUpperCase().slice(0, 32),
      bio: '',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    }
    db.profiles.push(profile)
    db.accounts.push({ email: mail, password, profile })
    this.user = profile
    await writeKey('session', profile.id)
    await this.persist()
    this.emit()
    return { user: profile }
  }

  async signOut(): Promise<void> {
    this.user = null
    await removeKey('session')
    this.emit()
  }

  async updateProfile(patch: Partial<Pick<Profile, 'name' | 'bio' | 'avatarUrl' | 'links' | 'handle'>>): Promise<Profile> {
    const db = await this.load()
    const me = this.requireUser()
    const row = db.profiles.find((p) => p.id === me.id)
    if (!row) throw new Error('Профиль не найден')
    if (patch.handle) {
      const nick = safeNick(patch.handle)
      if (!nick) throw new Error('Некорректный ник')
      if (db.profiles.some((p) => p.id !== me.id && p.handle.toLowerCase() === nick.toLowerCase()))
        throw new Error('Такой ник уже занят')
      row.handle = nick
    }
    if (patch.name !== undefined) row.name = patch.name.slice(0, 40)
    if (patch.bio !== undefined) row.bio = patch.bio.slice(0, 400)
    if (patch.avatarUrl !== undefined) row.avatarUrl = patch.avatarUrl
    if (patch.links !== undefined) row.links = patch.links.slice(0, 5)
    this.user = { ...row }
    const acc = db.accounts.find((a) => a.profile.id === me.id)
    if (acc) acc.profile = { ...row }
    await this.persist()
    this.emit()
    return { ...row }
  }

  async fetchProfiles(): Promise<Profile[]> {
    const db = await this.load()
    return clone(db.profiles)
  }

  private decoratePosts(posts: Post[], meId: ID | null): Post[] {
    const db = this.db!
    return posts.map((p) => ({
      ...p,
      likeCount: p.likeCount,
      commentCount: db.comments.filter((c) => c.postId === p.id).length,
      likedByMe: meId ? (db.likes[p.id] ?? []).includes(meId) : false,
      bookmarkedByMe: meId ? (db.bookmarks[p.id] ?? []).includes(meId) : false,
    }))
  }

  async fetchPosts(): Promise<Post[]> {
    const db = await this.load()
    const posts = [...db.posts].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return +new Date(b.createdAt) - +new Date(a.createdAt)
    })
    return this.decoratePosts(posts, this.user?.id ?? null)
  }

  async createPost(input: PostInput): Promise<Post> {
    const db = await this.load()
    const me = this.requireUser()
    const post: Post = {
      id: uid('p'),
      authorId: me.id,
      body: input.body.trim().slice(0, 4000),
      tags: extractTags(input.body, input.tags),
      imageUrl: input.imageUrl ?? null,
      track: input.track ?? null,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
    }
    if (!post.body && !post.imageUrl && !post.track) throw new Error('Пост не может быть пустым')
    db.posts.unshift(post)
    await this.persist()
    return { ...post }
  }

  async deletePost(id: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const post = db.posts.find((p) => p.id === id)
    if (!post) return
    if (post.authorId !== me.id) throw new Error('Можно удалять только свои посты')
    db.posts = db.posts.filter((p) => p.id !== id)
    db.comments = db.comments.filter((c) => c.postId !== id)
    delete db.likes[id]
    delete db.bookmarks[id]
    await this.persist()
  }

  async toggleLike(postId: ID): Promise<{ liked: boolean; likeCount: number }> {
    const db = await this.load()
    const me = this.requireUser()
    const post = db.posts.find((p) => p.id === postId)
    if (!post) throw new Error('Пост не найден')
    const list = db.likes[postId] ?? []
    const has = list.includes(me.id)
    db.likes[postId] = has ? list.filter((x) => x !== me.id) : [...list, me.id]
    post.likeCount = Math.max(0, post.likeCount + (has ? -1 : 1))
    if (!has && post.authorId !== me.id) {
      db.notifications.unshift({
        id: uid('n'),
        userId: post.authorId,
        kind: 'like',
        actorId: me.id,
        postId,
        createdAt: new Date().toISOString(),
        read: false,
      })
    }
    await this.persist()
    return { liked: !has, likeCount: post.likeCount }
  }

  async toggleBookmark(postId: ID): Promise<{ bookmarked: boolean }> {
    const db = await this.load()
    const me = this.requireUser()
    const list = db.bookmarks[postId] ?? []
    const has = list.includes(me.id)
    db.bookmarks[postId] = has ? list.filter((x) => x !== me.id) : [...list, me.id]
    await this.persist()
    return { bookmarked: !has }
  }

  async fetchComments(postId: ID): Promise<Comment[]> {
    const db = await this.load()
    return clone(db.comments.filter((c) => c.postId === postId).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)))
  }

  async addComment(postId: ID, body: string): Promise<Comment> {
    const db = await this.load()
    const me = this.requireUser()
    const post = db.posts.find((p) => p.id === postId)
    if (!post) throw new Error('Пост не найден')
    const text = body.trim()
    if (!text) throw new Error('Пустой комментарий')
    const comment: Comment = {
      id: uid('c'),
      postId,
      authorId: me.id,
      body: text.slice(0, 1000),
      createdAt: new Date().toISOString(),
    }
    db.comments.push(comment)
    post.commentCount = db.comments.filter((c) => c.postId === postId).length
    if (post.authorId !== me.id) {
      db.notifications.unshift({
        id: uid('n'),
        userId: post.authorId,
        kind: 'comment',
        actorId: me.id,
        postId,
        text: text.slice(0, 80),
        createdAt: new Date().toISOString(),
        read: false,
      })
    }
    await this.persist()
    return { ...comment }
  }

  async fetchFriendships(): Promise<Friendship[]> {
    const db = await this.load()
    const me = this.requireUser()
    return clone(db.friendships.filter((f) => f.requesterId === me.id || f.addresseeId === me.id))
  }

  async sendFriendRequest(userId: ID): Promise<Friendship> {
    const db = await this.load()
    const me = this.requireUser()
    const existing = db.friendships.find(
      (f) =>
        (f.requesterId === me.id && f.addresseeId === userId) || (f.requesterId === userId && f.addresseeId === me.id),
    )
    if (existing) return clone(existing)
    const f: Friendship = {
      id: uid('f'),
      requesterId: me.id,
      addresseeId: userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    db.friendships.push(f)
    db.notifications.unshift({
      id: uid('n'),
      userId,
      kind: 'friend',
      actorId: me.id,
      createdAt: new Date().toISOString(),
      read: false,
    })
    await this.persist()
    return clone(f)
  }

  async respondFriendRequest(id: ID, accept: boolean): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const f = db.friendships.find((x) => x.id === id && x.addresseeId === me.id)
    if (!f) return
    if (accept) f.status = 'accepted'
    else db.friendships = db.friendships.filter((x) => x.id !== id)
    await this.persist()
  }

  async removeFriend(id: ID): Promise<void> {
    const db = await this.load()
    db.friendships = db.friendships.filter((f) => f.id !== id)
    await this.persist()
  }

  /* ------------------------------------------------------------- сообщества */

  private channelChat(db: Db, channel: Channel, members: ID[]): Chat {
    const existing = db.chats.find((c) => c.id === channel.id)
    if (existing) {
      existing.title = channel.name
      existing.memberIds = members
      existing.kind = 'channel'
      existing.groupId = channel.groupId
      return existing
    }
    const chat: Chat = {
      id: channel.id,
      kind: 'channel',
      title: channel.name,
      memberIds: members,
      groupId: channel.groupId,
      createdAt: channel.createdAt,
      lastMessageAt: channel.createdAt,
      lastMessageBody: '',
      unreadCount: 0,
    }
    db.chats.push(chat)
    return chat
  }

  private groupMembers(db: Db, groupId: ID): GroupMember[] {
    return db.groupMembers.filter((m) => m.groupId === groupId)
  }

  private syncGroupChats(db: Db, groupId: ID) {
    const members = this.groupMembers(db, groupId).map((m) => m.userId)
    for (const channel of db.channels.filter((c) => c.groupId === groupId)) {
      this.channelChat(db, channel, members)
    }
  }

  async fetchGroups(): Promise<Group[]> {
    const db = await this.load()
    const me = this.user
    return clone(
      db.groups.map((g) => ({
        ...g,
        memberCount: this.groupMembers(db, g.id).length,
        isMember: Boolean(me && this.groupMembers(db, g.id).some((m) => m.userId === me.id)),
      })),
    )
  }

  async fetchGroup(groupId: ID): Promise<GroupBundle | null> {
    const db = await this.load()
    const group = db.groups.find((g) => g.id === groupId)
    if (!group) return null
    const members = this.groupMembers(db, groupId)
    this.syncGroupChats(db, groupId)
    await this.persist()
    const channels = db.channels.filter((c) => c.groupId === groupId).sort((a, b) => a.position - b.position)
    return clone({
      group: {
        ...group,
        memberCount: members.length,
        isMember: Boolean(this.user && members.some((m) => m.userId === this.user!.id)),
      },
      channels,
      members,
    })
  }

  async createGroup(name: string, description: string): Promise<GroupBundle> {
    const db = await this.load()
    const me = this.requireUser()
    const now = new Date().toISOString()
    const group: Group = {
      id: uid('g'),
      name: name.trim().slice(0, 60) || 'НОВАЯ ГРУППА',
      description: description.trim().slice(0, 300),
      ownerId: me.id,
      createdAt: now,
      memberCount: 1,
      isMember: true,
    }
    db.groups.unshift(group)
    db.groupMembers.push({ groupId: group.id, userId: me.id, role: 'owner', joinedAt: now })

    const textChannel: Channel = {
      id: uid('cn'),
      groupId: group.id,
      name: 'общий',
      kind: 'text',
      position: 0,
      createdAt: now,
    }
    const voiceChannel: Channel = {
      id: uid('cn'),
      groupId: group.id,
      name: 'ГОЛОСОВАЯ',
      kind: 'voice',
      position: 1,
      createdAt: now,
    }
    db.channels.push(textChannel, voiceChannel)
    this.channelChat(db, textChannel, [me.id])
    this.channelChat(db, voiceChannel, [me.id])
    await this.persist()
    return {
      group: { ...group },
      channels: [textChannel, voiceChannel],
      members: this.groupMembers(db, group.id),
    }
  }

  async joinGroup(groupId: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const group = db.groups.find((g) => g.id === groupId)
    if (!group) throw new Error('Группа не найдена')
    if (!this.groupMembers(db, groupId).some((m) => m.userId === me.id)) {
      db.groupMembers.push({ groupId, userId: me.id, role: 'member', joinedAt: new Date().toISOString() })
      const members = this.groupMembers(db, groupId).map((m) => m.userId)
      for (const c of db.channels.filter((x) => x.groupId === groupId)) {
        const chat = this.channelChat(db, c, members)
        chat.memberIds = members
      }
    }
    await this.persist()
  }

  async leaveGroup(groupId: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const members = this.groupMembers(db, groupId)
    const own = members.find((m) => m.userId === me.id)
    if (!own) return
    db.groupMembers = db.groupMembers.filter((m) => !(m.groupId === groupId && m.userId === me.id))
    const rest = this.groupMembers(db, groupId)
    const group = db.groups.find((g) => g.id === groupId)
    if (!rest.length && group) {
      await this.deleteGroup(groupId)
      return
    }
    if (own.role === 'owner' && group) {
      const next = rest[0]
      next.role = 'owner'
      group.ownerId = next.userId
    }
    if (group) group.memberCount = rest.length
    const ids = rest.map((m) => m.userId)
    for (const c of db.channels.filter((x) => x.groupId === groupId)) {
      const chat = db.chats.find((x) => x.id === c.id)
      if (chat) chat.memberIds = ids
    }
    await this.persist()
  }

  async updateGroup(groupId: ID, patch: Partial<Pick<Group, 'name' | 'description' | 'iconUrl'>>): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const group = db.groups.find((g) => g.id === groupId)
    if (!group) throw new Error('Группа не найдена')
    if (group.ownerId !== me.id) throw new Error('Менять группу может только владелец')
    if (patch.name !== undefined) group.name = patch.name.slice(0, 60)
    if (patch.description !== undefined) group.description = patch.description.slice(0, 300)
    if (patch.iconUrl !== undefined) group.iconUrl = patch.iconUrl
    await this.persist()
  }

  async deleteGroup(groupId: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const group = db.groups.find((g) => g.id === groupId)
    if (!group) return
    if (group.ownerId !== me.id) throw new Error('Удалить группу может только владелец')
    const channelIds = db.channels.filter((c) => c.groupId === groupId).map((c) => c.id)
    db.groups = db.groups.filter((g) => g.id !== groupId)
    db.channels = db.channels.filter((c) => c.groupId !== groupId)
    db.groupMembers = db.groupMembers.filter((m) => m.groupId !== groupId)
    db.chats = db.chats.filter((c) => !channelIds.includes(c.id))
    db.messages = db.messages.filter((m) => !channelIds.includes(m.chatId))
    await this.persist()
  }

  async createChannel(groupId: ID, name: string, kind: ChannelKind): Promise<Channel> {
    const db = await this.load()
    const me = this.requireUser()
    const group = db.groups.find((g) => g.id === groupId)
    if (!group) throw new Error('Группа не найдена')
    if (!this.groupMembers(db, groupId).some((m) => m.userId === me.id)) throw new Error('Вы не в группе')
    const channel: Channel = {
      id: uid('cn'),
      groupId,
      name: name.trim().replace(/^#/, '').slice(0, 40).toLowerCase() || 'канал',
      kind,
      position: db.channels.filter((c) => c.groupId === groupId).length,
      createdAt: new Date().toISOString(),
    }
    db.channels.push(channel)
    this.channelChat(db, channel, this.groupMembers(db, groupId).map((m) => m.userId))
    await this.persist()
    return clone(channel)
  }

  async deleteChannel(channelId: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const channel = db.channels.find((c) => c.id === channelId)
    if (!channel) return
    const group = db.groups.find((g) => g.id === channel.groupId)
    if (!group) return
    if (group.ownerId !== me.id) throw new Error('Удалять каналы может только владелец')
    db.channels = db.channels.filter((c) => c.id !== channelId)
    db.chats = db.chats.filter((c) => c.id !== channelId)
    db.messages = db.messages.filter((m) => m.chatId !== channelId)
    await this.persist()
  }

  async fetchChats(): Promise<Chat[]> {
    const db = await this.load()
    const me = this.requireUser()
    return clone(
      db.chats
        .filter((c) => c.kind !== 'channel' && c.memberIds.includes(me.id))
        .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)),
    )
  }

  async createChat(memberIds: ID[], title: string): Promise<Chat> {
    const db = await this.load()
    const me = this.requireUser()
    const members = Array.from(new Set([me.id, ...memberIds]))
    if (members.length === 2) {
      const existing = db.chats.find(
        (c) => c.kind === 'dm' && members.every((m) => c.memberIds.includes(m)) && c.memberIds.length === 2,
      )
      if (existing) return clone(existing)
    }
    const chat: Chat = {
      id: uid('ch'),
      kind: members.length > 2 ? 'group' : 'dm',
      title: members.length > 2 ? title || 'НОВАЯ ГРУППА' : '',
      memberIds: members,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      lastMessageBody: '',
      unreadCount: 0,
    }
    db.chats.unshift(chat)
    await this.persist()
    return clone(chat)
  }

  async fetchMessages(chatId: ID): Promise<Message[]> {
    const db = await this.load()
    return clone(db.messages.filter((m) => m.chatId === chatId).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)))
  }

  async sendMessage(chatId: ID, body: string, attachment?: Attachment | null): Promise<Message> {
    const db = await this.load()
    const me = this.requireUser()
    const chat = db.chats.find((c) => c.id === chatId)
    if (!chat) throw new Error('Чат не найден')
    const text = body.trim()
    if (!text && !attachment) throw new Error('Пустое сообщение')
    const msg: Message = {
      id: uid('m'),
      chatId,
      senderId: me.id,
      body: text.slice(0, 4000),
      attachment: attachment ?? null,
      createdAt: new Date().toISOString(),
      readBy: [me.id],
    }
    db.messages.push(msg)
    chat.lastMessageAt = msg.createdAt
    chat.lastMessageBody = attachment && !text ? `файл: ${attachment.name}` : text.slice(0, 80)
    for (const memberId of chat.memberIds) {
      if (memberId === me.id) continue
      db.notifications.unshift({
        id: uid('n'),
        userId: memberId,
        kind: 'message',
        actorId: me.id,
        chatId,
        text: text.slice(0, 80),
        createdAt: msg.createdAt,
        read: false,
      })
    }
    await this.persist()
    return clone(msg)
  }

  async markChatRead(chatId: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    let dirty = false
    for (const m of db.messages) {
      if (m.chatId === chatId && !m.readBy.includes(me.id)) {
        m.readBy.push(me.id)
        dirty = true
      }
    }
    const chat = db.chats.find((c) => c.id === chatId)
    if (chat) chat.unreadCount = 0
    if (dirty) await this.persist()
  }

  subscribeChat(_chatId: ID, _cb: (m: Message) => void): () => void {
    // Local mode is single-client: messages arrive through sendMessage directly.
    return () => undefined
  }

  async fetchFiles(): Promise<FileItem[]> {
    const db = await this.load()
    const me = this.requireUser()
    return clone(db.files.filter((f) => f.ownerId === me.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)))
  }

  async uploadFile(file: File): Promise<FileItem> {
    const db = await this.load()
    const me = this.requireUser()
    if (file.size > 8 * 1024 * 1024) throw new Error('В демо-режиме лимит 8 МБ (Supabase — до 50 МБ)')
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    const item: FileItem = {
      id: uid('fl'),
      ownerId: me.id,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      url,
      createdAt: new Date().toISOString(),
      kind: fileKind(file.type, file.name),
    }
    db.files.unshift(item)
    await this.persist()
    return clone(item)
  }

  async deleteFile(id: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    db.files = db.files.filter((f) => !(f.id === id && f.ownerId === me.id))
    await this.persist()
  }

  async fetchTracks(): Promise<SavedTrack[]> {
    const db = await this.load()
    const me = this.requireUser()
    return clone(db.savedTracks.filter((t) => t.ownerId === me.id))
  }

  async addTrack(track: Track): Promise<SavedTrack> {
    const db = await this.load()
    const me = this.requireUser()
    const existing = db.savedTracks.find((t) => t.ownerId === me.id && t.track.id === track.id)
    if (existing) return clone(existing)
    const saved: SavedTrack = {
      id: uid('st'),
      ownerId: me.id,
      track,
      liked: false,
      createdAt: new Date().toISOString(),
    }
    db.savedTracks.unshift(saved)
    await this.persist()
    return clone(saved)
  }

  async toggleTrackLike(id: ID): Promise<{ liked: boolean }> {
    const db = await this.load()
    const me = this.requireUser()
    const row = db.savedTracks.find((t) => t.id === id && t.ownerId === me.id)
    if (!row) throw new Error('Трек не найден')
    row.liked = !row.liked
    await this.persist()
    return { liked: row.liked }
  }

  async removeTrack(id: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    db.savedTracks = db.savedTracks.filter((t) => !(t.id === id && t.ownerId === me.id))
    for (const pl of db.playlists) pl.trackIds = pl.trackIds.filter((t) => t !== id)
    await this.persist()
  }

  async fetchPlaylists(): Promise<Playlist[]> {
    const db = await this.load()
    const me = this.requireUser()
    return clone(db.playlists.filter((p) => p.ownerId === me.id))
  }

  async createPlaylist(title: string, description: string): Promise<Playlist> {
    const db = await this.load()
    const me = this.requireUser()
    const pl: Playlist = {
      id: uid('pl'),
      ownerId: me.id,
      title: title.trim().slice(0, 60) || 'НОВЫЙ ПЛЕЙЛИСТ',
      description: description.trim().slice(0, 200),
      trackIds: [],
      createdAt: new Date().toISOString(),
    }
    db.playlists.push(pl)
    await this.persist()
    return clone(pl)
  }

  async deletePlaylist(id: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    db.playlists = db.playlists.filter((p) => !(p.id === id && p.ownerId === me.id))
    await this.persist()
  }

  async addToPlaylist(playlistId: ID, trackId: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const pl = db.playlists.find((p) => p.id === playlistId && p.ownerId === me.id)
    if (!pl) throw new Error('Плейлист не найден')
    if (!pl.trackIds.includes(trackId)) pl.trackIds.push(trackId)
    await this.persist()
  }

  async removeFromPlaylist(playlistId: ID, trackId: ID): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    const pl = db.playlists.find((p) => p.id === playlistId && p.ownerId === me.id)
    if (!pl) return
    pl.trackIds = pl.trackIds.filter((t) => t !== trackId)
    await this.persist()
  }

  async fetchNotifications(): Promise<Notification[]> {
    const db = await this.load()
    const me = this.requireUser()
    return clone(
      db.notifications
        .filter((n) => n.userId === me.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 60),
    )
  }

  async markNotificationsRead(): Promise<void> {
    const db = await this.load()
    const me = this.requireUser()
    for (const n of db.notifications) if (n.userId === me.id) n.read = true
    await this.persist()
  }

  async searchUsers(query: string): Promise<Profile[]> {
    const db = await this.load()
    const q = query.trim().toLowerCase()
    if (!q) return []
    return clone(db.profiles.filter((p) => p.handle.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)))
  }

  /** Полный дамп локальной базы (экспорт перед очисткой). */
  async exportData(): Promise<string> {
    const db = await this.load()
    return JSON.stringify(db, null, 2)
  }

  /** Полный сброс демо-данных. */
  async resetData(): Promise<void> {
    await removeKey('db')
    await removeKey('session')
    this.db = null
    this.user = null
    this.emit()
  }

  async uploadPublicImage(file: File): Promise<string> {
    return compressImage(file, 1400, 0.82)
  }

  /** Demo login without registration — a fully populated sample account. */
  async signInDemo(): Promise<AuthResult> {
    const db = await this.load()
    this.user = db.profiles.find((p) => p.id === DEMO_USER_ID) ?? null
    await writeKey('session', DEMO_USER_ID)
    await sleep(120)
    this.emit()
    return { user: this.user }
  }

  /** Helper used by seeding scripts so tags stay consistent. */
  static cleanTag(t: string) {
    return normalizeTag(t)
  }
}

function emptyDb(): Db {
  return {
    profiles: [],
    posts: [],
    comments: [],
    groups: [],
    channels: [],
    groupMembers: [],
    chats: [],
    messages: [],
    friendships: [],
    savedTracks: [],
    playlists: [],
    files: [],
    notifications: [],
    accounts: [],
    likes: {},
    bookmarks: {},
  }
}
