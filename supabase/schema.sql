-- ============================================================================
--  LULZFORUM — схема Supabase (Postgres + RLS + Storage + Realtime)
--  Как применить: Supabase → SQL Editor → вставить целиком → Run.
--  Затем: Project Settings → API → скопировать URL и anon key в .env
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  handle      text unique not null check (handle ~ '^[a-z0-9_.-]{2,24}$'),
  name        text not null default 'USER',
  bio         text not null default '',
  avatar_url  text,
  links       text[] not null default '{}',
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

-- ---------------------------------------------------------------- posts -----
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null default '',
  tags        text[] not null default '{}',
  image_url   text,
  track       jsonb,
  repost_of   uuid references public.posts(id) on delete set null,
  pinned      boolean not null default false,
  like_count  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_tags_idx on public.posts using gin (tags);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.bookmarks (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- ---------------------------------------------------------------- friends ---
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ---------------------------------------------------------------- chats -----
create table if not exists public.chats (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null default 'dm' check (kind in ('dm','group','channel')),
  title             text not null default '',
  group_id          uuid,
  created_by        uuid references public.profiles(id) on delete set null,
  last_message_at   timestamptz not null default now(),
  last_message_body text not null default '',
  created_at        timestamptz not null default now()
);

-- -------------------------------------------------------------- сообщества --
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'ГРУППА',
  description text not null default '',
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  icon_url    text,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.channels (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  name       text not null default 'канал',
  kind       text not null default 'text' check (kind in ('text','voice')),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists channels_group_idx on public.channels (group_id, position);

alter table public.chats
  drop constraint if exists chats_group_id_fkey;
alter table public.chats
  add constraint chats_group_id_fkey foreign key (group_id) references public.groups(id) on delete cascade;

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null default '',
  attachment jsonb,
  read_by    uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_idx on public.messages (chat_id, created_at);

-- ---------------------------------------------------------------- storage ----
create table if not exists public.files (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  size       bigint not null default 0,
  mime       text not null default 'application/octet-stream',
  url        text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- music -----
create table if not exists public.saved_tracks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  track      jsonb not null,
  track_id   text generated always as (track->>'id') stored,
  liked      boolean not null default false,
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, track_id)
);

create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null default '',
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id    uuid not null references public.saved_tracks(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

-- ---------------------------------------------------------------- notifs ----
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('like','comment','friend','message','music')),
  actor_id   uuid references public.profiles(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade,
  chat_id    uuid references public.chats(id) on delete cascade,
  text       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ============================================================ RLS ==========
alter table public.profiles       enable row level security;
alter table public.posts          enable row level security;
alter table public.post_likes     enable row level security;
alter table public.bookmarks      enable row level security;
alter table public.comments       enable row level security;
alter table public.friendships    enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.channels       enable row level security;
alter table public.chats          enable row level security;
alter table public.chat_members   enable row level security;
alter table public.messages       enable row level security;
alter table public.files          enable row level security;
alter table public.saved_tracks   enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.notifications  enable row level security;

-- profiles: читают все, меняет только владелец
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- posts: читают все, пишут/удаляют авторы
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert with check (auth.uid() = author_id);
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update using (auth.uid() = author_id);
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete using (auth.uid() = author_id);

-- likes / bookmarks: свои строки
drop policy if exists likes_read on public.post_likes;
create policy likes_read on public.post_likes for select using (true);
drop policy if exists likes_write on public.post_likes;
create policy likes_write on public.post_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists marks_read on public.bookmarks;
create policy marks_read on public.bookmarks for select using (auth.uid() = user_id);
drop policy if exists marks_write on public.bookmarks;
create policy marks_write on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- comments
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (auth.uid() = author_id);
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete using (auth.uid() = author_id);

-- friendships: видят обе стороны, создаёт инициатор, меняет адресат
drop policy if exists friends_read on public.friendships;
create policy friends_read on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists friends_insert on public.friendships;
create policy friends_insert on public.friendships for insert with check (auth.uid() = requester_id);
drop policy if exists friends_update on public.friendships;
create policy friends_update on public.friendships for update
  using (auth.uid() = addressee_id or auth.uid() = requester_id);
drop policy if exists friends_delete on public.friendships;
create policy friends_delete on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- группы: читают все (их можно находить), меняет владелец
drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select using (true);
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert with check (auth.uid() = owner_id);
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update using (auth.uid() = owner_id);
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete using (auth.uid() = owner_id);

drop policy if exists group_members_read on public.group_members;
create policy group_members_read on public.group_members for select using (true);
drop policy if exists group_members_join on public.group_members;
create policy group_members_join on public.group_members for insert with check (auth.uid() = user_id);
drop policy if exists group_members_leave on public.group_members;
create policy group_members_leave on public.group_members for delete
  using (auth.uid() = user_id or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

drop policy if exists channels_read on public.channels;
create policy channels_read on public.channels for select using (true);
drop policy if exists channels_write on public.channels;
create policy channels_write on public.channels for insert
  with check (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));
drop policy if exists channels_delete on public.channels;
create policy channels_delete on public.channels for delete
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

-- chats / members / messages: только участники
create or replace function public.is_chat_member(target_chat uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members m where m.chat_id = target_chat and m.user_id = auth.uid());
$$;

drop policy if exists chats_read on public.chats;
create policy chats_read on public.chats for select using (public.is_chat_member(id));
drop policy if exists chats_insert on public.chats;
create policy chats_insert on public.chats for insert with check (auth.uid() = created_by);
drop policy if exists chats_update on public.chats;
create policy chats_update on public.chats for update using (public.is_chat_member(id));

drop policy if exists members_read on public.chat_members;
create policy members_read on public.chat_members for select using (public.is_chat_member(chat_id));
drop policy if exists members_insert on public.chat_members;
create policy members_insert on public.chat_members for insert
  with check (
    auth.uid() = user_id
    or public.is_chat_member(chat_id)
    or exists (select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid())
  );

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (public.is_chat_member(chat_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (auth.uid() = sender_id and public.is_chat_member(chat_id));
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update using (public.is_chat_member(chat_id));

-- Непрочитанные сообщения по чатам текущего пользователя
create or replace function public.unread_counts()
returns table (chat_id uuid, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.chat_id, count(*)::bigint
  from public.messages m
  join public.chat_members cm on cm.chat_id = m.chat_id and cm.user_id = auth.uid()
  where m.sender_id <> auth.uid() and not (auth.uid() = any (m.read_by))
  group by m.chat_id;
$$;

-- files: строго личные
drop policy if exists files_own on public.files;
create policy files_own on public.files for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- music: своё
drop policy if exists tracks_own on public.saved_tracks;
create policy tracks_own on public.saved_tracks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists playlists_own on public.playlists;
create policy playlists_own on public.playlists for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists playlist_tracks_own on public.playlist_tracks;
create policy playlist_tracks_own on public.playlist_tracks for all
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()));

-- notifications: только адресат
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (auth.uid() = user_id);
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert with check (auth.uid() = actor_id);

-- ========================================================== триггеры =======
-- Профиль создаётся автоматически при регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_handle text;
  final_handle text;
  i int := 0;
begin
  base_handle := coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1));
  base_handle := lower(regexp_replace(base_handle, '[^a-z0-9_.-]', '', 'g'));
  if length(base_handle) < 2 then base_handle := 'user' || substr(new.id::text, 1, 6); end if;
  final_handle := base_handle;
  while exists (select 1 from public.profiles p where p.handle = final_handle) loop
    i := i + 1;
    final_handle := base_handle || i::text;
  end loop;
  insert into public.profiles (id, handle, name)
  values (
    new.id,
    final_handle,
    coalesce(new.raw_user_meta_data->>'name', upper(final_handle))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Счётчик лайков
create or replace function public.sync_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists on_like_change on public.post_likes;
create trigger on_like_change
  after insert or delete on public.post_likes
  for each row execute function public.sync_like_count();

-- Уведомление о лайке / комментарии
create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select author_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, kind, actor_id, post_id)
    values (owner, 'like', new.user_id, new.post_id);
  end if;
  return null;
end $$;

drop trigger if exists on_like_notify on public.post_likes;
create trigger on_like_notify
  after insert on public.post_likes
  for each row execute function public.notify_like();

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select author_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.author_id then
    insert into public.notifications (user_id, kind, actor_id, post_id, text)
    values (owner, 'comment', new.author_id, new.post_id, left(new.body, 90));
  end if;
  return null;
end $$;

drop trigger if exists on_comment_notify on public.comments;
create trigger on_comment_notify
  after insert on public.comments
  for each row execute function public.notify_comment();

-- ========================================================== Realtime =======
alter publication supabase_realtime add table public.messages;

-- ========================================================== Storage ========
insert into storage.buckets (id, name, public)
values ('vault', 'vault', false), ('public', 'public', true)
on conflict (id) do nothing;

-- Приватное хранилище: каждый видит только свою папку (<uid>/...)
drop policy if exists vault_read on storage.objects;
create policy vault_read on storage.objects for select
  using (bucket_id = 'vault' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists vault_write on storage.objects;
create policy vault_write on storage.objects for insert
  with check (bucket_id = 'vault' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists vault_delete on storage.objects;
create policy vault_delete on storage.objects for delete
  using (bucket_id = 'vault' and auth.uid()::text = (storage.foldername(name))[1]);

-- Публичный бакет (аватарки, картинки постов)
drop policy if exists public_read on storage.objects;
create policy public_read on storage.objects for select using (bucket_id = 'public');
drop policy if exists public_write on storage.objects;
create policy public_write on storage.objects for insert to authenticated with check (bucket_id = 'public');
drop policy if exists public_delete on storage.objects;
create policy public_delete on storage.objects for delete to authenticated using (bucket_id = 'public');

-- ==================================================== обновление старой базы ==
-- Если схема уже была применена раньше, эти строки добавят недостающее.
alter table public.chats drop constraint if exists chats_kind_check;
alter table public.chats add constraint chats_kind_check check (kind in ('dm','group','channel'));
alter table public.chats add column if not exists group_id uuid references public.groups(id) on delete cascade;

alter publication supabase_realtime add table public.messages;

-- Готово. Не забудьте вписать URL и anon key в .env и включить GitHub Pages.
