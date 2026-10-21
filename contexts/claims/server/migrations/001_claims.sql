-- Eventos de dominio de cada ítem: inmutables, son la auditoría y la fuente del estado.
create table claims_events (
  item_id uuid not null,
  version int not null,
  type text not null,
  data jsonb not null,
  actor_kind text not null check (actor_kind in ('guest', 'staff', 'system')),
  actor_id uuid,
  at timestamptz not null default now(),
  primary key (item_id, version)       -- dos cambios no pueden escribir la misma versión
);

-- Proyección del estado vigente (se actualiza en la misma transacción que el evento).
create table claims_items (
  item_id uuid primary key,
  session_id uuid not null,
  venue_id uuid not null,
  pos_unit_ref text not null unique,   -- `<posItemId>#<n>`: un evento repetido no duplica el ítem
  name text not null,
  price_amount bigint not null,
  price_currency text not null,
  owners jsonb not null default '[]',
  version int not null,
  created_at timestamptz not null default now()
);
create index claims_items_session on claims_items (session_id, created_at);

-- Proyección propia de los comensales (desde tables.guest.joined / renamed).
create table claims_guests (
  guest_id uuid primary key,
  session_id uuid not null,
  alias text not null
);
