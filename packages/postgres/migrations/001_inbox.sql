-- Eventos ya procesados por cada suscriptor: hace idempotente a todo handler,
-- con este bus o con cualquier broker futuro.
-- ponytail: sin limpieza; agregar un job que borre filas de más de 30 días cuando pese.
create table inbox (
  subscriber text not null,
  event_id uuid not null,
  processed_at timestamptz not null default now(),
  primary key (subscriber, event_id)
);
