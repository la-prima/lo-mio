# Tasks

## 1. Entorno

- [ ] 1.1 `compose.load.yaml` con 2 API + Postgres + proxy y datos semilla (200 locales × 30 mesas); verificar que levanta en CI

## 2. Carga

- [ ] 2.1 Escenarios k6 de HTTP, WebSocket (36 000 conexiones) y latencia reclamo → feed y entre contextos, con los umbrales de `docs/arquitectura.md` sección 9; verificar que el workflow nightly falla si no se cumplen

## 3. Failover

- [ ] 3.1 Matar una instancia de la API y reiniciar la DB a mitad del flujo; verificar 0 comandos o eventos perdidos o duplicados y reconexión WebSocket en < 10 s

## 4. DAST

- [ ] 4.1 OWASP ZAP baseline contra la API y guest-web en nightly; verificar que falla ante hallazgos altos
