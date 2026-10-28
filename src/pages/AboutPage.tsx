import { useRouter } from '../lib/router'
import { useApp } from '../lib/app'
import { Icon } from '../components/Icon'
import { IMAGE_CAT, IMAGE_SKULL } from '../lib/seed'

const FEATURES = [
  {
    icon: 'home' as const,
    title: 'Лента рекомендаций',
    text: 'Алгоритм считает свежесть, лайки, комментарии и ваши любимые теги. Есть режимы «Свежее», «Подписки» и «Топ».',
  },
  {
    icon: 'chat' as const,
    title: 'Чаты и группы',
    text: 'Личные диалоги и групповые беседы, вложения, отметки о прочтении, счётчики непрочитанного, realtime через Supabase.',
  },
  {
    icon: 'music' as const,
    title: 'Музыка со всего интернета',
    text: 'Поиск по Audius, iTunes и Creative Commons, вставка ссылок SoundCloud и Яндекс Музыки, лайки, плейлисты и полноценный плеер.',
  },
  {
    icon: 'vault' as const,
    title: 'Личное хранилище',
    text: 'Приватный бакет Supabase (или IndexedDB в демо). Превью, скачивание, фильтры, поиск и подписанные ссылки.',
  },
  {
    icon: 'friends' as const,
    title: 'Друзья и профили',
    text: 'Заявки в друзья, списки, личные сообщения в один клик, редактирование профиля и аватара.',
  },
  {
    icon: 'tag' as const,
    title: 'Теги и поиск',
    text: 'Теги прямо в тексте поста, архив тега, тренды, единый поиск по постам, людям и тегам.',
  },
]

export function AboutPage() {
  const { navigate } = useRouter()
  const { mode } = useApp()

  return (
    <div className="page">
      <div className="about-hero">
        <div className="about-hero__logo">
          <img src={IMAGE_CAT} alt="" />
          <img src={IMAGE_SKULL} alt="" />
        </div>
        <div>
          <h1 className="page__title">О LULZFORUM</h1>
          <p className="page__sub">
            Чёрно-белый bitmap форум-мессенджер: лента, чаты, теги, друзья, файлы и музыка. Без серой морали и серых
            пикселей.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/')}>
          <Icon name="home" size={14} /> В ЛЕНТУ
        </button>
      </div>

      <div className="about-grid">
        {FEATURES.map((f) => (
          <section key={f.title} className="card about-card">
            <span className="about-card__icon">
              <Icon name={f.icon} size={22} />
            </span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </section>
        ))}
      </div>

      <div className="about-grid">
        <section className="card">
          <h3>Как это работает</h3>
          <ol className="tips tips--num">
            <li>Статический фронтенд на React + Vite собирается в GitHub Pages — хостинг бесплатный.</li>
            <li>Аккаунты, база и файлы — Supabase: Postgres, Auth, Storage и Realtime.</li>
            <li>Если Supabase не настроен, включается демо-режим: всё хранится в IndexedDB браузера.</li>
            <li>
              Текущий режим: <b>{mode === 'local' ? 'демо (localStorage / IndexedDB)' : 'Supabase'}</b>.
            </li>
          </ol>
        </section>
        <section className="card">
          <h3>Правила форума</h3>
          <ul className="tips">
            <li>Ставьте теги — так работают архивы и рекомендации.</li>
            <li>Не публикуйте чужие файлы без разрешения.</li>
            <li>Музыка: делитесь ссылками на легальные источники.</li>
            <li>Технические баги — в личку администрации.</li>
            <li>Уважайте чёрно-белую эстетику.</li>
          </ul>
        </section>
      </div>

      <section className="card about-setup">
        <h3>
          <Icon name="settings" size={14} /> ПОДКЛЮЧИТЬ SUPABASE
        </h3>
        <pre className="code">{`1. Создайте проект на supabase.com
2. SQL Editor → вставьте supabase/schema.sql → Run
3. Project Settings → API → скопируйте URL и anon key
4. Создайте .env:

VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

5. Для GitHub Pages: Settings → Secrets → Actions добавьте
   VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
6. Settings → Pages → Source: GitHub Actions`}</pre>
      </section>
    </div>
  )
}
