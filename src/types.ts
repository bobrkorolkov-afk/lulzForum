export type ID = string

export interface Profile {
  id: ID
  handle: string
  name: string
  bio: string
  avatarUrl?: string | null
  links?: string[]
  createdAt: string
  lastSeen?: string
  bot?: boolean
}

export type TrackProvider = 'audius' | 'itunes' | 'soundcloud' | 'yandex' | 'link'

export interface Track {
  /** globally unique: `${provider}:${providerId}` */
  id: string
  provider: TrackProvider
  title: string
  artist: string
  artwork?: string | null
  duration?: number
  streamUrl?: string | null
  externalUrl: string
  embedUrl?: string | null
}

export interface SavedTrack {
  id: ID
  ownerId: ID
  track: Track
  liked: boolean
  note?: string
  createdAt: string
}

export interface Playlist {
  id: ID
  ownerId: ID
  title: string
  description: string
  trackIds: string[]
  createdAt: string
}

export interface Post {
  id: ID
  authorId: ID
  body: string
  tags: string[]
  imageUrl?: string | null
  track?: Track | null
  createdAt: string
  likeCount: number
  commentCount: number
  likedByMe?: boolean
  bookmarkedByMe?: boolean
  repostOf?: ID | null
  pinned?: boolean
}

export interface Comment {
  id: ID
  postId: ID
  authorId: ID
  body: string
  createdAt: string
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'

export interface Friendship {
  id: ID
  requesterId: ID
  addresseeId: ID
  status: FriendshipStatus
  createdAt: string
}

export type ChatKind = 'dm' | 'group'

export interface Chat {
  id: ID
  kind: ChatKind
  title: string
  memberIds: ID[]
  createdAt: string
  lastMessageAt: string
  lastMessageBody: string
  unreadCount: number
}

export interface Attachment {
  name: string
  url: string
  size: number
  mime: string
}

export interface Message {
  id: ID
  chatId: ID
  senderId: ID
  body: string
  attachment?: Attachment | null
  createdAt: string
  readBy: ID[]
}

export interface FileItem {
  id: ID
  ownerId: ID
  name: string
  size: number
  mime: string
  url: string
  createdAt: string
  kind: 'image' | 'audio' | 'video' | 'doc' | 'archive' | 'other'
}

export type NotificationKind = 'like' | 'comment' | 'friend' | 'message' | 'music'

export interface Notification {
  id: ID
  userId: ID
  kind: NotificationKind
  actorId: ID
  postId?: ID | null
  chatId?: ID | null
  text?: string
  createdAt: string
  read: boolean
}

export interface PostInput {
  body: string
  tags: string[]
  imageUrl?: string | null
  track?: Track | null
}

export interface AuthResult {
  user: Profile | null
  needsConfirmation?: boolean
}

export interface Backend {
  mode: 'local' | 'supabase'
  init(): Promise<Profile | null>
  onAuthChange(cb: (user: Profile | null) => void): () => void
  signIn(email: string, password: string): Promise<AuthResult>
  signUp(email: string, password: string, handle: string, name: string): Promise<AuthResult>
  signOut(): Promise<void>
  updateProfile(patch: Partial<Pick<Profile, 'name' | 'bio' | 'avatarUrl' | 'links' | 'handle'>>): Promise<Profile>

  fetchProfiles(): Promise<Profile[]>
  fetchPosts(): Promise<Post[]>
  createPost(input: PostInput): Promise<Post>
  deletePost(id: ID): Promise<void>
  toggleLike(postId: ID): Promise<{ liked: boolean; likeCount: number }>
  toggleBookmark(postId: ID): Promise<{ bookmarked: boolean }>
  fetchComments(postId: ID): Promise<Comment[]>
  addComment(postId: ID, body: string): Promise<Comment>

  fetchFriendships(): Promise<Friendship[]>
  sendFriendRequest(userId: ID): Promise<Friendship>
  respondFriendRequest(id: ID, accept: boolean): Promise<void>
  removeFriend(id: ID): Promise<void>

  fetchChats(): Promise<Chat[]>
  createChat(memberIds: ID[], title: string): Promise<Chat>
  fetchMessages(chatId: ID): Promise<Message[]>
  sendMessage(chatId: ID, body: string, attachment?: Attachment | null): Promise<Message>
  markChatRead(chatId: ID): Promise<void>
  subscribeChat(chatId: ID, cb: (m: Message) => void): () => void

  fetchFiles(): Promise<FileItem[]>
  uploadFile(file: File): Promise<FileItem>
  deleteFile(id: ID): Promise<void>

  fetchTracks(): Promise<SavedTrack[]>
  addTrack(track: Track): Promise<SavedTrack>
  toggleTrackLike(id: ID): Promise<{ liked: boolean }>
  removeTrack(id: ID): Promise<void>
  fetchPlaylists(): Promise<Playlist[]>
  createPlaylist(title: string, description: string): Promise<Playlist>
  deletePlaylist(id: ID): Promise<void>
  addToPlaylist(playlistId: ID, trackId: ID): Promise<void>
  removeFromPlaylist(playlistId: ID, trackId: ID): Promise<void>

  fetchNotifications(): Promise<Notification[]>
  markNotificationsRead(): Promise<void>

  searchUsers(query: string): Promise<Profile[]>
  /** Публичная загрузка картинки (обложка поста, аватар). */
  uploadPublicImage(file: File): Promise<string>
}
