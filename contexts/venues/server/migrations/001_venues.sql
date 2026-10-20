create table venues (
  id uuid primary key,
  name text not null,
  country text not null,
  currency text not null,
  created_at timestamptz not null default now()
);

create table venue_tables (
  id uuid primary key,
  venue_id uuid not null references venues (id),
  label text not null,
  qr_code text not null unique,
  created_at timestamptz not null default now(),
  unique (venue_id, label)
);

create table venue_products (
  id uuid primary key,
  venue_id uuid not null references venues (id),
  name text not null,
  price_amount bigint not null check (price_amount >= 0),
  price_currency text not null,
  created_at timestamptz not null default now()
);
create index venue_products_venue on venue_products (venue_id);
