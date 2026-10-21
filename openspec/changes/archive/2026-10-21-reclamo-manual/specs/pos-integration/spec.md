# Spec Delta

## Purpose

Contrato único para conectar lo-mio con el sistema de punto de venta de cada local, sin que el dominio dependa de un POS particular.

## ADDED Requirements

### Requirement: Contrato de adaptador POS
Cada integración SHALL implementar el mismo contrato: listar mesas, obtener los ítems de una mesa y, si el POS lo permite, crear pedidos. Cada adaptador MUST declarar qué capacidades soporta, y MUST pasar la suite de pruebas compartida del contrato.

#### Scenario: Capacidades declaradas
- **WHEN** se consulta el adaptador manual
- **THEN** declara la capacidad `createOrder` como no soportada

### Requirement: Adaptador manual
El sistema SHALL incluir un adaptador manual en el que el mesero carga los ítems directamente en lo-mio a partir de un catálogo de productos del local.

#### Scenario: Carga manual
- **WHEN** el mesero agrega 2 cervezas a la mesa 4 en modo manual
- **THEN** aparecen 2 ítems sin dueño en el feed de la mesa 4 con el precio del catálogo

#### Scenario: Precio en otra moneda
- **WHEN** se intenta cargar un ítem con un precio en una moneda distinta de la del local
- **THEN** la carga se rechaza y no aparece ningún ítem

#### Scenario: Mesa de otro local
- **WHEN** un mesero intenta cargar ítems en una mesa de otro local
- **THEN** la carga se rechaza como si la mesa no existiera y el intento queda registrado
