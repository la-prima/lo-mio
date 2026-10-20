# Spec Delta

## Purpose

Asignación de cada ítem de la mesa a quien lo consumió: reclamos de los comensales, repartos de ítems compartidos, correcciones del personal y control de ítems sin dueño.

## ADDED Requirements

### Requirement: Feed de la mesa
Cada comensal SHALL ver en tiempo real todos los ítems de su sesión con su estado (sin dueño, reclamado, compartido, en disputa) y quién los tiene.

#### Scenario: Ítem nuevo
- **WHEN** el POS informa un ítem nuevo para la mesa
- **THEN** aparece como "sin dueño" en el feed de todos los comensales en menos de 5 segundos

#### Scenario: Pérdida de conexión del comensal
- **WHEN** el celular de un comensal pierde conexión y la recupera
- **THEN** el feed se resincroniza completo sin acciones duplicadas

### Requirement: Reclamo de ítem completo
Un comensal SHALL poder reclamar un ítem sin dueño como propio. Un ítem MUST tener como máximo un conjunto de dueños vigente.

#### Scenario: Reclamo simple
- **WHEN** un comensal toca "lo mío" en una cerveza sin dueño
- **THEN** la cerveza queda asignada a ese comensal y su saldo aumenta en el precio de la cerveza

#### Scenario: Reclamo simultáneo
- **WHEN** dos comensales reclaman el mismo ítem completo casi al mismo tiempo
- **THEN** solo el primero queda como dueño, y el segundo ve el ítem como reclamado con opción de proponer compartirlo

### Requirement: Ítems compartidos
Un ítem SHALL poder repartirse entre varios comensales en partes iguales o por porciones enteras. La suma de las partes MUST ser exactamente el precio del ítem; el resto indivisible se asigna de forma determinista.

#### Scenario: Partes iguales
- **WHEN** una tabla de 10.000 CLP se comparte en partes iguales entre 3 comensales
- **THEN** las partes son 3.334, 3.333 y 3.333 CLP

#### Scenario: Unirse a un compartido
- **WHEN** un comensal toca "yo también comí" en un ítem compartido entre 2
- **THEN** el ítem pasa a repartirse entre 3 y los saldos de los 3 se recalculan

### Requirement: Auditoría de asignaciones
Toda creación o cambio de una asignación SHALL registrarse como evento inmutable con actor, identificador usado, momento y motivo. El estado vigente MUST poder reconstruirse a partir de los eventos.

#### Scenario: Consulta de historial de un ítem
- **WHEN** un encargado consulta el historial de un ítem disputado
- **THEN** ve en orden cada reclamo, reasignación, confirmación u override con su autor
