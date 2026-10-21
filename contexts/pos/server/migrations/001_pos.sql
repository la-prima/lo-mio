-- Proyección propia de las mesas (desde venues.table.registered.v1): pos no consulta a venues.
create table pos_tables (
  table_id uuid primary key,
  venue_id uuid not null,
  currency text not null
);
