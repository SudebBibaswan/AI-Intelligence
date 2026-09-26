begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  onboarding_state text not null default 'not_started'
    check (onboarding_state in ('not_started', 'in_progress', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  workspace_type text not null default 'personal'
    check (workspace_type in ('personal', 'team')),
  created_by uuid not null references public.profiles(user_id),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, created_by)
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  description text not null,
  default_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(default_config) = 'object'),
  config_version integer not null default 1 check (config_version > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid not null references public.domains(id),
  name text,
  topics text[] not null default '{}',
  geographies text[] not null default '{}',
  entity_types text[] not null default '{}',
  source_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_config) = 'object'),
  collection_frequency text not null default 'manual'
    check (collection_frequency in ('manual', 'daily', 'weekly')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create unique index workspace_domains_active_name_uidx
  on public.workspace_domains (workspace_id, domain_id, coalesce(name, ''))
  where status <> 'archived';

create index workspace_domains_workspace_created_idx
  on public.workspace_domains (workspace_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger domains_set_updated_at
before update on public.domains
for each row execute function public.set_updated_at();

create trigger workspace_domains_set_updated_at
before update on public.workspace_domains
for each row execute function public.set_updated_at();

create or replace function private.is_workspace_member(
  target_workspace_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and w.deleted_at is null
      and (allowed_roles is null or wm.role = any (allowed_roles))
  );
$$;

revoke all on function private.is_workspace_member(uuid, text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid, text[]) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  profile_name text;
begin
  profile_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '');

  insert into public.profiles (user_id, display_name)
  values (new.id, profile_name)
  on conflict (user_id) do nothing;

  insert into public.workspaces (id, name, slug, workspace_type, created_by)
  values (
    new_workspace_id,
    coalesce(profile_name || '''s Workspace', 'My Workspace'),
    'personal-' || replace(new.id::text, '-', ''),
    'personal',
    new.id
  );

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

commit;

