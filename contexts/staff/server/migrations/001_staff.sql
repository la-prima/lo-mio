create table staff_members (
  id uuid primary key,
  venue_id uuid not null,
  email text not null unique,
  name text not null,
  role text not null check (role in ('waiter', 'manager', 'admin')),
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Solo el hash del token: una filtración de la base no expone sesiones.
create table staff_sessions (
  token_hash text primary key,
  staff_id uuid not null references staff_members (id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index staff_sessions_staff on staff_sessions (staff_id);
