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
