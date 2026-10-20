# Spec Delta

## Purpose

Configuración de cada local y sus mesas: datos de país, moneda y modos de operación, con valores del local que cada mesa puede sobrescribir.

## ADDED Requirements

### Requirement: Configuración de país del local
Cada local SHALL tener un país que determine su moneda, la cantidad de decimales de la unidad mínima y el tipo de documento tributario. Los montos MUST almacenarse como enteros en la unidad mínima de esa moneda.

#### Scenario: Local chileno
- **WHEN** se crea un local con país Chile
- **THEN** su moneda es CLP con 0 decimales y su documento tributario es la boleta electrónica SII

#### Scenario: País no soportado
- **WHEN** se intenta crear un local con un país sin configuración disponible
- **THEN** la operación se rechaza indicando que el país no está soportado
