# guest-identity Specification

## Purpose

Identificación rápida y anónima del comensal por distintos medios (navegador, app, tarjeta, posavasos) y continuidad de su cuenta si cambia de medio.

## Requirements

### Requirement: Comensal anónimo por defecto
Un comensal SHALL identificarse sin entregar datos personales. El sistema MUST NOT exigir nombre, teléfono ni email para unirse ni para reclamar.

#### Scenario: Alias por defecto
- **WHEN** un comensal se une sin escribir alias
- **THEN** se le asigna un alias generado legible (ej. "Comensal 3") que puede cambiar

#### Scenario: Alias inválido
- **WHEN** un comensal intenta cambiar su alias por uno vacío o con caracteres de control
- **THEN** el cambio se rechaza y conserva su alias anterior

### Requirement: Identificador de dispositivo
Al unirse por QR desde la web o desde la app, el dispositivo del comensal SHALL recibir un identificador seguro, no accesible por scripts de terceros, que lo reconoce mientras la sesión de mesa siga abierta.

#### Scenario: Recarga de página
- **WHEN** el comensal cierra y vuelve a abrir la página de la mesa
- **THEN** sigue siendo el mismo comensal, con sus reclamos

#### Scenario: Identificador de otra sesión
- **WHEN** un dispositivo con un identificador de una sesión ya cerrada escanea el QR de la mesa
- **THEN** se trata como un comensal nuevo en la sesión actual
