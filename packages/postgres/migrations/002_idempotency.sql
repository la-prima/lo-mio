-- Comandos idempotentes: la misma Idempotency-Key devuelve la misma respuesta.
-- ponytail: sin limpieza; borrar filas de más de 7 días con un job cuando pese.
create table idempotency_keys (
  scope text not null,          -- actor que usó la clave (personal o comensal)
  key uuid not null,
  request_hash text not null,   -- operación + cuerpo: misma clave con otra solicitud = 422
  status int not null,
  body jsonb,
  created_at timestamptz not null default now(),
  primary key (scope, key)
);
