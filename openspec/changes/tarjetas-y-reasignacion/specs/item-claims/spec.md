# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Feed de la mesa
Cada comensal SHALL ver en tiempo real todos los ítems de su sesión con su estado (sin dueño, reclamado, compartido, en disputa) y quién los tiene. Un comensal MUST NOT ver ni modificar los ítems de otra sesión.

#### Scenario: Ítem nuevo
- **WHEN** el POS informa un ítem nuevo para la mesa
- **THEN** aparece como "sin dueño" en el feed de todos los comensales en menos de 5 segundos

#### Scenario: Pérdida de conexión del comensal
- **WHEN** el celular de un comensal pierde conexión y la recupera
- **THEN** el feed se resincroniza completo sin acciones duplicadas

#### Scenario: Ítem reasignado
- **WHEN** el personal reasigna un ítem y el nuevo dueño todavía no confirma
- **THEN** todos los comensales de la mesa lo ven "en disputa" con el dueño propuesto

### Requirement: Auditoría de asignaciones
Toda creación o cambio de una asignación SHALL registrarse como evento inmutable con actor, identificador usado, momento y motivo. El estado vigente MUST poder reconstruirse a partir de los eventos.

#### Scenario: Consulta de historial de un ítem
- **WHEN** un encargado consulta el historial de un ítem que se reclamó, se repartió y al que alguien se sumó
- **THEN** ve en orden cada cambio con su autor, y el estado vigente coincide con el que resulta de esos eventos

#### Scenario: Reintento del mismo comando
- **WHEN** un comensal reintenta un reclamo con la misma clave de idempotencia (por ejemplo, tras perder la respuesta)
- **THEN** recibe el mismo resultado y no se registra un segundo cambio

#### Scenario: Historial de un ítem disputado
- **WHEN** un encargado consulta el historial de un ítem disputado
- **THEN** ve en orden cada reclamo, reasignación, confirmación u override con su autor
