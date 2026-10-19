# Spec Delta

## Purpose

Identificación rápida y anónima del comensal por distintos medios (navegador, app, tarjeta, posavasos) y continuidad de su cuenta si cambia de medio.

## ADDED Requirements

### Requirement: Comensal anónimo por defecto
Un comensal SHALL identificarse sin entregar datos personales. El sistema MUST NOT exigir nombre, teléfono ni email para unirse, reclamar o pagar.

#### Scenario: Alias por defecto
- **WHEN** un comensal se une sin escribir alias
- **THEN** se le asigna un alias generado legible (ej. "Comensal 3") que puede cambiar

### Requirement: Identificador de dispositivo
Al unirse por QR desde la web o desde la app, el dispositivo del comensal SHALL recibir un identificador seguro, no accesible por scripts de terceros, que lo reconoce mientras la sesión de mesa siga abierta.

#### Scenario: Recarga de página
- **WHEN** el comensal cierra y vuelve a abrir la página de la mesa
- **THEN** sigue siendo el mismo comensal, con sus reclamos

#### Scenario: Identificador de otra sesión
- **WHEN** un dispositivo con un identificador de una sesión ya cerrada escanea el QR de la mesa
- **THEN** se trata como un comensal nuevo en la sesión actual

### Requirement: Identificador físico (tarjeta, posavasos)
El local SHALL poder registrar identificadores físicos con un código único, legible por NFC y por un QR impreso. El mesero MUST poder vincular un identificador físico libre a un comensal de una sesión abierta.

#### Scenario: Vincular tarjeta a comensal nuevo
- **WHEN** el mesero escanea una tarjeta libre y elige "nuevo comensal" en la mesa 3
- **THEN** se crea un comensal en la sesión de la mesa 3 vinculado a esa tarjeta

#### Scenario: Tarjeta en uso
- **WHEN** el mesero escanea una tarjeta que ya está vinculada a un comensal de una sesión abierta
- **THEN** se muestra ese comensal con su saldo, en vez de vincularla de nuevo

#### Scenario: Liberación al pagar
- **WHEN** el comensal vinculado a una tarjeta queda con saldo cero y se retira
- **THEN** la tarjeta queda libre para otro comensal

### Requirement: Transferencia de cuenta entre identificadores
El mesero SHALL poder transferir un comensal a otro identificador (ej. de celular a tarjeta) conservando todos sus reclamos y pagos. El identificador anterior MUST quedar desvinculado.

#### Scenario: Celular sin batería
- **WHEN** un comensal se queda sin batería y el mesero transfiere su cuenta a una tarjeta libre
- **THEN** la tarjeta muestra el mismo saldo y reclamos, y las confirmaciones pendientes pasan a confirmarse escaneando la tarjeta
