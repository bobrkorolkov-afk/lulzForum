import type {
  Channel,
  Chat,
  Comment,
  FileItem,
  Friendship,
  Group,
  GroupMember,
  Message,
  Notification,
  Playlist,
  Post,
  Profile,
  SavedTrack,
  Track,
} from '../types'

const mins = (n: number) => new Date(Date.now() - n * 60_000).toISOString()
const hrs = (n: number) => mins(n * 60)
const days = (n: number) => hrs(n * 24)

/** Paint a bitmap image as an SVG data-url: "#" = ink, "." = paper, other letters = grey steps. */
export function pixelSvg(rows: string[], scale = 8, ink = '#000000', paper = '#ffffff'): string {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  let rects = ''
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      const fill = ch === '#' ? ink : ch === 'o' ? '#555555' : ch === 'p' ? '#999999' : ch === 'q' ? '#cccccc' : ink
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`
    }
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges"><rect width="${w}" height="${h}" fill="${paper}"/>${rects}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const cat = pixelSvg([
  '.#............#.',
  '.##..........##.',
  '.###........###.',
  '.###.######.###.',
  '.##.########.##.',
  '.##.########.##.',
  '.##.##.##.##.##.',
  '.##.########.##.',
  '.##.########.##.',
  '.####.####.####.',
  '.##..######..##.',
  '.#....####....#.',
  '.#.#........#.#.',
  '..#..........#..',
  '...#........#...',
  '....##....##....',
])

const skull = pixelSvg([
  '....########....',
  '..############..',
  '.###..####..###.',
  '.###..####..###.',
  '################',
  '################',
  '###..######..###',
  '################',
  '..####.##.####..',
  '....########....',
  '...##.##.##.....',
  '...########.....',
  '....######......',
  '.#.#.#.#.#.#....',
  '................',
  '................',
])

const sunset = pixelSvg(
  [
    'qqqqqqqqqqqqqqqq',
    'qppppppppppppppq',
    'qppooooooooooppq',
    'qpoooooooooooopq',
    'qpooo######ooopq',
    'qpoo########oopq',
    'qpoo########oopq',
    'qpooo######ooopq',
    'qpoooooooooooopq',
    'qp.oo.oo.oo.oopq',
    'q.oo.oo.oo.oo.q.',
    'qoo.oo.oo.oo.ooq',
    'q.oo.oo.oo.oo.q.',
    'qqqqqqqqqqqqqqqq',
    'q.oo.oo.oo.oo.q.',
    'qqqqqqqqqqqqqqqq',
  ],
  10,
)

const checker = pixelSvg(
  [
    '##..##..##..##..',
    '##..##..##..##..',
    '..##..##..##..##',
    '..##..##..##..##',
    '##..##..##..##..',
    '##..##..##..##..',
    '..##..##..##..##',
    '..##..##..##..##',
    '##..##..##..##..',
    '##..##..##..##..',
    '..##..##..##..##',
    '..##..##..##..##',
    '##..##..##..##..',
    '##..##..##..##..',
    '..##..##..##..##',
    '..##..##..##..##',
  ],
  10,
)

export const IMAGE_CAT = cat
export const IMAGE_SKULL = skull
export const IMAGE_SUNSET = sunset
export const IMAGE_CHECKER = checker

export const DEMO_USER_ID = 'u_demo'

const profiles: Profile[] = [
  {
    id: DEMO_USER_ID,
    handle: 'demo',
    name: 'ДЕМО ЮЗЕР',
    bio: 'Это демо-аккаунт. Жми «Создать аккаунт», чтобы стать собой.',
    createdAt: days(30),
    lastSeen: mins(1),
  },
  {
    id: 'u_root',
    handle: 'root',
    name: 'ROOT',
    bio: 'Администратор LulzForum. Пиксели — наше всё. Пишите в личку по багам.',
    createdAt: days(400),
    lastSeen: mins(3),
    links: ['https://github.com'],
  },
  {
    id: 'u_pete',
    handle: 'pixel_pete',
    name: 'PIXEL PETE',
    bio: 'Рисую аватарки 8×8. Собираю чиптюн. Не спрашивайте про антиалиасинг.',
    createdAt: days(220),
    lastSeen: mins(9),
  },
  {
    id: 'u_lord',
    handle: 'lulz_lord',
    name: 'LULZ LORD',
    bio: 'Мемы, теги, дизлайки в голове. Тут с 2019.',
    createdAt: days(900),
    lastSeen: mins(2),
  },
  {
    id: 'u_vera',
    handle: 'bitmap_vera',
    name: 'ВЕРА BITMAP',
    bio: 'Куратор тега #арт. Чёрно-белое — тоже цвет.',
    createdAt: days(180),
    lastSeen: mins(14),
  },
  {
    id: 'u_dan',
    handle: 'dither_dan',
    name: 'DITHER DAN',
    bio: 'Дизеринг, дизеринг и ещё раз дизеринг. Хранилище: 12 ГБ пикселей.',
    createdAt: days(140),
    lastSeen: hrs(2),
  },
  {
    id: 'u_masha',
    handle: 'mono_masha',
    name: 'МАША 1-BIT',
    bio: 'Собираю плейлисты для ночных смен. Пишите, если нашли годный лоу-фай.',
    createdAt: days(95),
    lastSeen: mins(5),
  },
  {
    id: 'u_sasha',
    handle: 'synth_sasha',
    name: 'SYNTH SASHA',
    bio: 'Модульный синтез, аналоговый шум. Ищу треки по всему интернету.',
    createdAt: days(60),
    lastSeen: hrs(6),
  },
  {
    id: 'u_filin',
    handle: 'night_owl',
    name: 'НОЧНОЙ ФИЛИН',
    bio: 'Онлайн после 02:00. Не сплю, чтобы вы не скучали.',
    createdAt: days(45),
    lastSeen: mins(11),
  },
]

const demoId = DEMO_USER_ID

const tracks: Track[] = [
  {
    id: 'demo:bitmap-fm-1',
    provider: 'link',
    title: 'BITMAP FM — канал 1',
    artist: 'LULZFORUM DEMO',
    duration: 372,
    artwork: checker,
    streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
  },
  {
    id: 'demo:bitmap-fm-2',
    provider: 'link',
    title: 'BITMAP FM — канал 2',
    artist: 'LULZFORUM DEMO',
    duration: 282,
    artwork: sunset,
    streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
  },
  {
    id: 'demo:bitmap-fm-3',
    provider: 'link',
    title: 'BITMAP FM — канал 3',
    artist: 'LULZFORUM DEMO',
    duration: 245,
    artwork: skull,
    streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
  },
]

const posts: Post[] = [
  {
    id: 'p_1',
    authorId: 'u_root',
    body: 'LULZFORUM v1.0 в эфире. Лента, чаты, теги, друзья, личное хранилище и музыка со всего интернета — в одном чёрно-белом окне. Правила простые: не мусорить, ставить теги, кидать годные треки.\n\nКнопка «Z» листает ленту, «/» ищет, «N» открывает новый пост.',
    tags: ['мета', 'новости'],
    createdAt: mins(24),
    likeCount: 128,
    commentCount: 2,
    pinned: true,
  },
  {
    id: 'p_2',
    authorId: 'u_pete',
    body: 'Новая аватарка — 8×8, каждый пиксель выстрадан. Кто узнал, что это кот?',
    tags: ['арт', 'пиксель'],
    imageUrl: cat,
    createdAt: hrs(1),
    likeCount: 64,
    commentCount: 2,
  },
  {
    id: 'p_3',
    authorId: 'u_masha',
    body: 'Собрала ночной плейлист для тех, кто читает форум в 03:00. Три канала BITMAP FM + всё, что найдёте через «Музыку».\n\nДобавляйте свои находки в комментарии, только с тегом #музыка.',
    tags: ['музыка', 'плейлист', 'ночь'],
    track: tracks[1],
    createdAt: hrs(2),
    likeCount: 41,
    commentCount: 2,
  },
  {
    id: 'p_4',
    authorId: 'u_dan',
    body: 'Перетащил 12 ГБ пиксель-арта в «Хранилище». Файлы живут в приватном бакете, папка на каждого. Никто, кроме вас, не видит.\n\nЛайфхак: изображения можно закинуть прямо в пост — они сжимаются в браузере.',
    tags: ['хранилище', 'файлы', 'гайд'],
    createdAt: hrs(4),
    likeCount: 29,
    commentCount: 1,
  },
  {
    id: 'p_5',
    authorId: 'u_lord',
    body: 'Ищу мем «плачущий кактус» в 1-битном исполнении. Обменяю на два инвайта в группу БИТМАП ШТАБ.',
    tags: ['мемы', 'поиск'],
    createdAt: hrs(5),
    likeCount: 17,
    commentCount: 2,
  },
  {
    id: 'p_6',
    authorId: 'u_vera',
    body: 'Правило куратора: если скриншот можно сделать чёрно-белым без потери смысла — он уже чёрно-белый.',
    tags: ['арт', 'мысли'],
    imageUrl: skull,
    createdAt: hrs(7),
    likeCount: 88,
    commentCount: 1,
  },
  {
    id: 'p_7',
    authorId: 'u_sasha',
    body: 'SoundCloud и Яндекс Музыку теперь можно тащить к себе ссылкой: вставляете трек — он появляется в «Моей музыке», играет во встроенном плеере, лайкается и уходит в плейлисты. Для остального интернета есть поиск по Audius и iTunes.',
    tags: ['музыка', 'гайд', 'обновление'],
    createdAt: hrs(9),
    likeCount: 55,
    commentCount: 2,
  },
  {
    id: 'p_8',
    authorId: 'u_filin',
    body: 'Ночная смена открыта. Кто ещё не спит — пишите в чат, включим канал 3 и будем спорить о шрифтах.',
    tags: ['ночь', 'чат'],
    imageUrl: sunset,
    createdAt: hrs(11),
    likeCount: 12,
    commentCount: 1,
  },
  {
    id: 'p_9',
    authorId: 'u_root',
    body: 'Как работает лента рекомендаций: считаем лайки, комментарии, свежесть и ваши любимые теги. Чем больше лайкаете #арт, тем больше #арт в ленте. Кнопка «Свежее» отключает магию и показывает всё подряд.',
    tags: ['мета', 'гайд'],
    createdAt: days(1),
    likeCount: 73,
    commentCount: 2,
  },
  {
    id: 'p_10',
    authorId: 'u_pete',
    body: 'Дизеринг-челлендж: переведите любое фото в 1 бит и закиньте с тегом #дизеринг. Победитель получит статус «ПИКСЕЛЬ-МАСТЕР» и моё уважение.',
    tags: ['дизеринг', 'челлендж'],
    createdAt: days(1),
    likeCount: 34,
    commentCount: 1,
  },
  {
    id: 'p_11',
    authorId: 'u_lord',
    body: 'Напоминание: теги ставятся через # прямо в тексте поста. Клик по тегу — и вы в тематическом архиве. Всё, как в старых добрых форумах, только быстрее.',
    tags: ['теги', 'гайд'],
    createdAt: days(2),
    likeCount: 46,
    commentCount: 1,
  },
  {
    id: 'p_12',
    authorId: 'u_vera',
    body: 'Сделала обои для форума. Кто поставит — скиньте скриншот, соберу галерею в хранилище.',
    tags: ['арт', 'обои'],
    imageUrl: checker,
    createdAt: days(2),
    likeCount: 61,
    commentCount: 1,
  },
]

const comments: Comment[] = [
  { id: 'c_1', postId: 'p_1', authorId: 'u_pete', body: 'Наконец-то! Пиксели в массы.', createdAt: mins(20) },
  { id: 'c_2', postId: 'p_1', authorId: 'u_masha', body: 'Горячие клавиши — топ. Z реально удобно.', createdAt: mins(16) },
  { id: 'c_3', postId: 'p_2', authorId: 'u_vera', body: 'Кот. Однозначно кот.', createdAt: mins(45) },
  { id: 'c_4', postId: 'p_2', authorId: 'u_lord', body: 'Уши выдают.', createdAt: mins(40) },
  { id: 'c_5', postId: 'p_3', authorId: 'u_sasha', body: 'Канал 2 — лучший. Добавил в плейлист.', createdAt: hrs(1) },
  { id: 'c_6', postId: 'p_3', authorId: 'u_filin', body: 'Слушаю прямо сейчас. Ночь удалась.', createdAt: mins(50) },
  { id: 'c_7', postId: 'p_4', authorId: 'u_masha', body: 'А лимит на файл какой?', createdAt: hrs(3) },
  { id: 'c_8', postId: 'p_5', authorId: 'u_dan', body: 'Есть в архиве, скину вечером.', createdAt: hrs(4) },
  { id: 'c_9', postId: 'p_5', authorId: 'u_pete', body: 'Кактус плачет или кактус-плакса? Уточни, а то два разных мема.', createdAt: hrs(4) },
  { id: 'c_10', postId: 'p_6', authorId: 'u_root', body: 'Золотые слова. В цитаты форума.', createdAt: hrs(6) },
  { id: 'c_11', postId: 'p_7', authorId: 'u_masha', body: 'Проверила с Яндекса — вставилось нормально.', createdAt: hrs(8) },
  { id: 'c_12', postId: 'p_7', authorId: 'u_dan', body: 'А Audius играет без всяких ключей, да?', createdAt: hrs(7) },
  { id: 'c_13', postId: 'p_8', authorId: 'u_masha', body: 'Я тут. Ставь канал 3.', createdAt: hrs(10) },
  { id: 'c_14', postId: 'p_9', authorId: 'u_vera', body: 'Наконец-то не просто «по дате».', createdAt: hrs(23) },
  { id: 'c_15', postId: 'p_9', authorId: 'u_lord', body: 'А черновики кто-нибудь сохраняет?', createdAt: hrs(22) },
  { id: 'c_16', postId: 'p_10', authorId: 'u_vera', body: 'Уже делаю.', createdAt: hrs(20) },
  { id: 'c_17', postId: 'p_11', authorId: 'u_dan', body: 'Проверил, работает.', createdAt: days(1) },
  { id: 'c_18', postId: 'p_12', authorId: 'u_sasha', body: 'Поставил на второй монитор. Идеально.', createdAt: days(1) },
]

const groups: Group[] = [
  {
    id: 'g_lulz',
    name: 'LULZ HQ',
    description: 'Главный штаб форума: новости, правила, техподдержка и голосовые по вечерам.',
    ownerId: 'u_root',
    createdAt: days(60),
    memberCount: 7,
  },
  {
    id: 'g_night',
    name: 'НОЧНАЯ СМЕНА',
    description: 'Для тех, кто не спит: лоу-фай, ночные чаты и голосовой канал до утра.',
    ownerId: 'u_masha',
    createdAt: days(30),
    memberCount: 5,
  },
  {
    id: 'g_pixel',
    name: 'ПИКСЕЛЬ-ЦЕХ',
    description: 'Пиксель-арт, дизеринг, аватарки 8×8. Показываем работу и жёстко критикуем.',
    ownerId: 'u_pete',
    createdAt: days(18),
    memberCount: 4,
  },
]

const channels: Channel[] = [
  { id: 'cn_1', groupId: 'g_lulz', name: 'общий', kind: 'text', position: 0, createdAt: days(60) },
  { id: 'cn_2', groupId: 'g_lulz', name: 'помощь', kind: 'text', position: 1, createdAt: days(58) },
  { id: 'cn_3', groupId: 'g_lulz', name: 'ГОЛОСОВАЯ · ШТАБ', kind: 'voice', position: 2, createdAt: days(55) },
  { id: 'cn_4', groupId: 'g_night', name: 'болталка', kind: 'text', position: 0, createdAt: days(30) },
  { id: 'cn_5', groupId: 'g_night', name: 'музыка', kind: 'text', position: 1, createdAt: days(30) },
  { id: 'cn_6', groupId: 'g_night', name: 'ГОЛОСОВАЯ · НОЧЬ', kind: 'voice', position: 2, createdAt: days(29) },
  { id: 'cn_7', groupId: 'g_pixel', name: 'галерея', kind: 'text', position: 0, createdAt: days(18) },
  { id: 'cn_8', groupId: 'g_pixel', name: 'ГОЛОСОВАЯ · ЦЕХ', kind: 'voice', position: 1, createdAt: days(17) },
]

const channelMembers: GroupMember[] = [
  { groupId: 'g_lulz', userId: 'u_root', role: 'owner', joinedAt: days(60) },
  { groupId: 'g_lulz', userId: demoId, role: 'member', joinedAt: days(40) },
  { groupId: 'g_lulz', userId: 'u_pete', role: 'member', joinedAt: days(38) },
  { groupId: 'g_lulz', userId: 'u_vera', role: 'member', joinedAt: days(35) },
  { groupId: 'g_lulz', userId: 'u_dan', role: 'member', joinedAt: days(33) },
  { groupId: 'g_lulz', userId: 'u_lord', role: 'member', joinedAt: days(30) },
  { groupId: 'g_lulz', userId: 'u_sasha', role: 'member', joinedAt: days(20) },

  { groupId: 'g_night', userId: 'u_masha', role: 'owner', joinedAt: days(30) },
  { groupId: 'g_night', userId: demoId, role: 'member', joinedAt: days(22) },
  { groupId: 'g_night', userId: 'u_filin', role: 'member', joinedAt: days(21) },
  { groupId: 'g_night', userId: 'u_sasha', role: 'member', joinedAt: days(19) },
  { groupId: 'g_night', userId: 'u_lord', role: 'member', joinedAt: days(12) },

  { groupId: 'g_pixel', userId: 'u_pete', role: 'owner', joinedAt: days(18) },
  { groupId: 'g_pixel', userId: 'u_vera', role: 'member', joinedAt: days(17) },
  { groupId: 'g_pixel', userId: 'u_dan', role: 'member', joinedAt: days(16) },
  { groupId: 'g_pixel', userId: 'u_root', role: 'member', joinedAt: days(15) },
]

const membersOf = (groupId: string) => channelMembers.filter((m) => m.groupId === groupId).map((m) => m.userId)

const channelChats: Chat[] = channels.map((ch) => ({
  id: ch.id,
  kind: 'channel',
  title: ch.name,
  memberIds: membersOf(ch.groupId),
  groupId: ch.groupId,
  createdAt: ch.createdAt,
  lastMessageAt: hrs(3),
  lastMessageBody: '',
  unreadCount: 0,
}))

const chats: Chat[] = [
  {
    id: 'ch_1',
    kind: 'dm',
    title: '',
    memberIds: [demoId, 'u_pete'],
    createdAt: days(10),
    lastMessageAt: mins(6),
    lastMessageBody: 'Скинь ссылку, добавлю в «Мою музыку»',
    unreadCount: 0,
  },
  {
    id: 'ch_2',
    kind: 'dm',
    title: '',
    memberIds: [demoId, 'u_masha'],
    createdAt: days(8),
    lastMessageAt: mins(38),
    lastMessageBody: 'В ночной плейлист добавила, зацени',
    unreadCount: 2,
  },
  {
    id: 'ch_3',
    kind: 'group',
    title: 'БИТМАП ШТАБ',
    memberIds: [demoId, 'u_root', 'u_vera', 'u_dan', 'u_lord'],
    createdAt: days(20),
    lastMessageAt: hrs(2),
    lastMessageBody: 'ROOT: правила форума обновил, читаем',
    unreadCount: 1,
  },
  {
    id: 'ch_4',
    kind: 'dm',
    title: '',
    memberIds: [demoId, 'u_lord'],
    createdAt: days(5),
    lastMessageAt: hrs(8),
    lastMessageBody: 'Мем в архиве, держи',
    unreadCount: 0,
  },
  {
    id: 'ch_5',
    kind: 'group',
    title: 'ХРАНИЛИЩЕ 12 ГБ',
    memberIds: [demoId, 'u_dan', 'u_sasha'],
    createdAt: days(3),
    lastMessageAt: days(1),
    lastMessageBody: 'DITHER DAN: файлы залил, доступ по ссылке',
    unreadCount: 0,
  },
]

const channelMessages: Message[] = [
  { id: 'cm_1', chatId: 'cn_1', senderId: 'u_root', body: 'Добро пожаловать в LULZ HQ. Правила в закрепе, вопросы — в #помощь.', createdAt: hrs(26), readBy: [] },
  { id: 'cm_2', chatId: 'cn_1', senderId: 'u_pete', body: 'Голосовая работает, заходите вечером.', createdAt: hrs(20), readBy: [] },
  { id: 'cm_3', chatId: 'cn_1', senderId: demoId, body: 'Привет всем! Тут есть канал для музыки?', createdAt: hrs(18), readBy: [demoId] },
  { id: 'cm_4', chatId: 'cn_1', senderId: 'u_lord', body: 'Ночная смена — там музыка. Ссылка в профиле группы.', createdAt: hrs(17), readBy: [] },
  { id: 'cm_5', chatId: 'cn_2', senderId: 'u_vera', body: 'Как прикрепить трек к посту?', createdAt: hrs(9), readBy: [] },
  { id: 'cm_6', chatId: 'cn_2', senderId: 'u_root', body: 'Композер → иконка ноты → поиск или ссылка. Всё сохраняется в «Мою музыку».', createdAt: hrs(8), readBy: [] },
  { id: 'cm_7', chatId: 'cn_4', senderId: 'u_masha', body: 'Ночь началась. Кто в голосовую?', createdAt: hrs(5), readBy: [] },
  { id: 'cm_8', chatId: 'cn_4', senderId: 'u_filin', body: 'Я уже там, микрофон проверяю.', createdAt: hrs(4), readBy: [] },
  { id: 'cm_9', chatId: 'cn_7', senderId: 'u_dan', body: 'Свежий дизеринг: 1 бит, 16 оттенков серого из ничего.', createdAt: hrs(12), readBy: [] },
  { id: 'cm_10', chatId: 'cn_7', senderId: 'u_pete', body: 'Жёстко. Одобряю.', createdAt: hrs(11), readBy: [] },
  { id: 'cm_11', chatId: 'cn_5', senderId: 'u_sasha', body: 'Скинул в «Мою музыку» три канала BITMAP FM, слушайте.', createdAt: hrs(7), readBy: [] },
]

const messages: Message[] = [
  { id: 'm_1', chatId: 'ch_1', senderId: 'u_pete', body: 'Привет! Видел твой пост про дизеринг?', createdAt: mins(52), readBy: [demoId] },
  { id: 'm_2', chatId: 'ch_1', senderId: demoId, body: 'Видел, но пока не пробовал. Пресет нужен?', createdAt: mins(48), readBy: [demoId, 'u_pete'] },
  { id: 'm_3', chatId: 'ch_1', senderId: 'u_pete', body: 'Да, могу скинуть. Только у меня в хранилище, дам ссылку.', createdAt: mins(44), readBy: [demoId] },
  { id: 'm_4', chatId: 'ch_1', senderId: 'u_pete', body: 'И ещё: нашёл трек на Audius, играет прямо в плеере. Скинь ссылку, добавлю в «Мою музыку»', createdAt: mins(6), readBy: [] },

  { id: 'm_5', chatId: 'ch_2', senderId: 'u_masha', body: 'Слушай, ты вчера трек искал?', createdAt: mins(70), readBy: [demoId] },
  { id: 'm_6', chatId: 'ch_2', senderId: demoId, body: 'Да, что-то лоу-файное на ночь.', createdAt: mins(64), readBy: [demoId, 'u_masha'] },
  { id: 'm_7', chatId: 'ch_2', senderId: 'u_masha', body: 'В ночной плейлист добавила, зацени', createdAt: mins(38), readBy: [] },

  { id: 'm_8', chatId: 'ch_3', senderId: 'u_lord', body: 'Кто идёт на ночной созвон?', createdAt: hrs(4), readBy: [demoId, 'u_lord'] },
  { id: 'm_9', chatId: 'ch_3', senderId: demoId, body: 'Я после 23:00.', createdAt: hrs(3), readBy: [demoId] },
  { id: 'm_10', chatId: 'ch_3', senderId: 'u_vera', body: 'Скину обои в хранилище до созвона.', createdAt: hrs(2), readBy: [demoId] },
  { id: 'm_11', chatId: 'ch_3', senderId: 'u_root', body: 'Правила форума обновил, читаем', createdAt: hrs(2), readBy: [] },

  { id: 'm_12', chatId: 'ch_4', senderId: demoId, body: 'Есть мем про кактус?', createdAt: hrs(9), readBy: [demoId, 'u_lord'] },
  { id: 'm_13', chatId: 'ch_4', senderId: 'u_lord', body: 'Мем в архиве, держи', createdAt: hrs(8), readBy: [demoId] },

  { id: 'm_14', chatId: 'ch_5', senderId: 'u_dan', body: 'Файлы залил, доступ по ссылке', createdAt: days(1), readBy: [demoId] },
]

const friendships: Friendship[] = [
  { id: 'f_1', requesterId: demoId, addresseeId: 'u_root', status: 'accepted', createdAt: days(30) },
  { id: 'f_2', requesterId: 'u_pete', addresseeId: demoId, status: 'accepted', createdAt: days(25) },
  { id: 'f_3', requesterId: demoId, addresseeId: 'u_masha', status: 'accepted', createdAt: days(12) },
  { id: 'f_4', requesterId: 'u_dan', addresseeId: demoId, status: 'accepted', createdAt: days(9) },
  { id: 'f_5', requesterId: demoId, addresseeId: 'u_lord', status: 'accepted', createdAt: days(7) },
  { id: 'f_6', requesterId: 'u_vera', addresseeId: demoId, status: 'pending', createdAt: hrs(5) },
  { id: 'f_7', requesterId: 'u_filin', addresseeId: demoId, status: 'pending', createdAt: hrs(2) },
  { id: 'f_8', requesterId: demoId, addresseeId: 'u_sasha', status: 'pending', createdAt: hrs(1) },
]

const savedTracks: SavedTrack[] = [
  { id: 'st_1', ownerId: demoId, track: tracks[0], liked: true, note: 'Ночная смена', createdAt: hrs(30) },
  { id: 'st_2', ownerId: demoId, track: tracks[1], liked: true, note: '', createdAt: hrs(26) },
  { id: 'st_3', ownerId: demoId, track: tracks[2], liked: false, note: 'На утро', createdAt: hrs(20) },
]

const playlists: Playlist[] = [
  {
    id: 'pl_1',
    ownerId: demoId,
    title: 'НОЧНАЯ СМЕНА',
    description: 'Для чтения форума после полуночи',
    trackIds: ['st_1', 'st_2'],
    createdAt: days(4),
  },
  {
    id: 'pl_2',
    ownerId: demoId,
    title: 'ПИКСЕЛЬ-БИТ',
    description: 'Всё, что нашлось в интернете',
    trackIds: ['st_3'],
    createdAt: days(2),
  },
]

const files: FileItem[] = [
  {
    id: 'fl_1',
    ownerId: demoId,
    name: 'pixel-cat.svg',
    size: 2140,
    mime: 'image/svg+xml',
    url: cat,
    createdAt: hrs(3),
    kind: 'image',
  },
  {
    id: 'fl_2',
    ownerId: demoId,
    name: 'lulzforum-notes.txt',
    size: 420,
    mime: 'text/plain',
    url: `data:text/plain;charset=utf-8,${encodeURIComponent(
      'LULZFORUM / ЛИЧНОЕ ХРАНИЛИЩЕ\n\n1. Файлы видны только владельцу.\n2. В демо-режиме содержимое живёт в IndexedDB браузера.\n3. С Supabase — в приватном бакете vault.\n',
    )}`,
    createdAt: days(1),
    kind: 'doc',
  },
  {
    id: 'fl_3',
    ownerId: demoId,
    name: 'avatars-8x8.svg',
    size: 3120,
    mime: 'image/svg+xml',
    url: skull,
    createdAt: days(2),
    kind: 'image',
  },
]

const notifications: Notification[] = [
  { id: 'n_1', userId: demoId, kind: 'like', actorId: 'u_vera', postId: 'p_1', createdAt: mins(12), read: false },
  { id: 'n_2', userId: demoId, kind: 'comment', actorId: 'u_pete', postId: 'p_1', text: 'Наконец-то! Пиксели в массы.', createdAt: mins(20), read: false },
  { id: 'n_3', userId: demoId, kind: 'friend', actorId: 'u_vera', createdAt: hrs(5), read: false },
  { id: 'n_4', userId: demoId, kind: 'message', actorId: 'u_masha', chatId: 'ch_2', createdAt: mins(38), read: false },
  { id: 'n_5', userId: demoId, kind: 'music', actorId: 'u_sasha', text: 'поделился треком BITMAP FM — канал 2', createdAt: hrs(7), read: true },
]

export const seed = {
  profiles,
  posts,
  comments,
  groups,
  channels,
  groupMembers: channelMembers,
  chats: [...chats, ...channelChats],
  messages: [...messages, ...channelMessages],
  friendships,
  savedTracks,
  playlists,
  files,
  notifications,
  tracks,
}

export type Seed = typeof seed
