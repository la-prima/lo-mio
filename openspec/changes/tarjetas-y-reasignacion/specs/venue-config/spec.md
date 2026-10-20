# Spec Delta

## ADDED Requirements

### Requirement: Tiempo de espera de confirmación
La configuración SHALL incluir el tiempo que una reasignación espera la confirmación del comensal antes de habilitar el override (por defecto 3 minutos), con override por mesa.

#### Scenario: Valor por defecto
- **WHEN** un local no configura el tiempo de espera
- **THEN** las reasignaciones esperan 3 minutos antes de habilitar el override

#### Scenario: Valor fuera de rango
- **WHEN** se configura un tiempo menor a 30 segundos o mayor a 30 minutos
- **THEN** la configuración se rechaza indicando el rango permitido
