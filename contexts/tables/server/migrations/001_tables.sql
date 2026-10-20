-- Proyección propia de las mesas y su QR vigente (desde los eventos de venues).
create table tables_registry (
  table_id uuid primary key,
  venue_id uuid not null,
  label text not null,
  qr_code text not null unique
);

create table table_sessions (
  id uuid primary key,
  venue_id uuid not null,
  table_id uuid not null references tables_registry (table_id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
-- Una mesa tiene como máximo una sesión abierta: lo garantiza la base, también con aperturas simultáneas.
create unique index table_sessions_one_open on table_sessions (table_id) where closed_at is null;

create table guests (
  id uuid primary key,
  session_id uuid not null references table_sessions (id),
  alias text not null,
  token_hash text not null unique,   -- solo el hash de la cookie del dispositivo
  joined_at timestamptz not null default now()
);
create index guests_session on guests (session_id);
