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

#### Scenario: Compartido con alguien que ya pagó
- **WHEN** se intenta sumar al reparto de un ítem a un comensal que ya pagó y se retiró
- **THEN** la operación se rechaza; solo el personal puede hacerlo como reasignación

### Requirement: Reasignación por el personal con confirmación
El mesero SHALL poder proponer un cambio de dueño o de reparto. El cambio MUST quedar pendiente hasta que cada comensal afectado al que se le suma monto lo confirme en su dispositivo o, si usa identificador físico, hasta que el mesero escanee ese identificador.

#### Scenario: Confirmación en celular
- **WHEN** el mesero reasigna un pisco a la comensal Ana, que usa celular, y Ana acepta
- **THEN** el pisco queda asignado a Ana y la reasignación queda registrada con mesero, hora y aceptación

#### Scenario: Confirmación con tarjeta
- **WHEN** el mesero reasigna un ítem a un comensal con tarjeta y escanea su tarjeta
- **THEN** la reasignación se confirma

#### Scenario: Rechazo
- **WHEN** el comensal rechaza la reasignación
- **THEN** el ítem vuelve a su estado anterior, queda marcado "en disputa" y se avisa al mesero

#### Scenario: Comensal que solo pierde monto
- **WHEN** la reasignación solo le quita un ítem a un comensal
- **THEN** no requiere su confirmación, pero se le notifica

### Requirement: Override sin respuesta del comensal
Si un comensal no responde dentro del tiempo configurado, el personal SHALL poder resolver la reasignación de una de tres formas: forzarla con PIN de encargado, enviarla a aprobación del encargado en la vista de administración, o transferir la cuenta del comensal a una tarjeta y confirmarla escaneándola (camino recomendado en la UI).

#### Scenario: Forzar con PIN
- **WHEN** la reasignación lleva más tiempo que el configurado y el encargado ingresa su PIN
- **THEN** la reasignación se aplica marcada como override, con el encargado como responsable, y el comensal la ve en su historial

#### Scenario: Aprobación remota
- **WHEN** el mesero envía la reasignación a aprobación y el encargado la aprueba desde administración
- **THEN** la reasignación se aplica marcada como override aprobado

#### Scenario: Antes del tiempo de espera
- **WHEN** el mesero intenta forzar una reasignación antes del tiempo configurado
- **THEN** la opción no está disponible

### Requirement: Ítems sin dueño
El sistema SHALL alertar al mesero de los ítems que siguen sin dueño cuando un comensal pide pagar o cuando se intenta cerrar la sesión.

#### Scenario: Alerta al primer pago
- **WHEN** el primer comensal pide pagar y hay 2 ítems sin dueño
- **THEN** el mesero y todos los comensales ven el aviso con los 2 ítems antes de registrar el pago

### Requirement: Auditoría de asignaciones
Toda creación o cambio de una asignación SHALL registrarse como evento inmutable con actor, identificador usado, momento y motivo. El estado vigente MUST poder reconstruirse a partir de los eventos.

#### Scenario: Consulta de historial de un ítem
- **WHEN** un encargado consulta el historial de un ítem disputado
- **THEN** ve en orden cada reclamo, reasignación, confirmación u override con su autor
