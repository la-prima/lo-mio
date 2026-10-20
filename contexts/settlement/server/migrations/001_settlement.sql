-- Proyección de las partes vigentes de cada ítem (desde claims.item.changed.v1, por versión).
create table settlement_items (
  item_id uuid primary key,
  session_id uuid not null,
  version int not null,
  shares jsonb not null
);
create index settlement_items_session on settlement_items (session_id);

-- Proyección propia de los comensales (desde tables.guest.joined / renamed).
create table settlement_guests (
  guest_id uuid primary key,
  session_id uuid not null,
  venue_id uuid not null,
  alias text not null,
  currency text not null              -- moneda de la sesión: la del saldo, también en cero
);
create index settlement_guests_session on settlement_guests (session_id);

-- Saldo vigente de cada comensal (para publicar solo los que cambian).
create table settlement_balances (
  guest_id uuid primary key,
  amount bigint not null,
  currency text not null
);
