# Spec Delta

## ADDED Requirements

### Requirement: Ítems sin dueño
El sistema SHALL alertar al mesero de los ítems que siguen sin dueño cuando un comensal pide pagar o cuando se intenta cerrar la sesión.

#### Scenario: Alerta al primer pago
- **WHEN** el primer comensal pide pagar y hay 2 ítems sin dueño
- **THEN** el mesero y todos los comensales ven el aviso con los 2 ítems antes de registrar el pago

### Requirement: Reparto con comensales retirados
Un comensal retirado SHALL quedar fuera de los repartos que inician los comensales. Solo el personal MAY sumarlo, como reasignación.

#### Scenario: Sumar a un retirado
- **WHEN** se intenta sumar al reparto de un ítem a un comensal que ya pagó y se retiró
- **THEN** la operación se rechaza; solo el personal puede hacerlo como reasignación
