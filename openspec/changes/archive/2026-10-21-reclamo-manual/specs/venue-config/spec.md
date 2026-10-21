# Spec Delta

## Purpose

Configuración de cada local y sus mesas: datos de país, moneda y modos de operación, con valores del local que cada mesa puede sobrescribir.

## ADDED Requirements

### Requirement: Configuración de país del local
Cada local SHALL tener un país que determine su moneda, la cantidad de decimales de la unidad mínima y el tipo de documento tributario. Los montos MUST almacenarse como enteros en la unidad mínima de esa moneda.

#### Scenario: Local de un país soportado
- **WHEN** se crea un local con un país que tiene configuración disponible
- **THEN** el local toma la moneda, los decimales de la unidad mínima y el documento tributario de ese país

#### Scenario: País no soportado
- **WHEN** se intenta crear un local con un país sin configuración disponible
- **THEN** la operación se rechaza indicando que el país no está soportado
