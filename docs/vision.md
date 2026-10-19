# lo-mio — visión

## El problema

En bares y restaurantes que trabajan por mesa, cada persona consume por su cuenta (y a veces comparten platos), y la gente llega y se va mientras la mesa sigue abierta. Después de varias horas, cobrar se vuelve un problema:

- Nadie recuerda con certeza quién pidió qué.
- No queda claro si los que se fueron pagaron su parte.
- El mesero gasta **~20 minutos por mesa** reconstruyendo la cuenta. Ese tiempo no lo dedica a otras mesas ni a vender más, y la experiencia del cliente al cierre empeora.
- Las diferencias las termina absorbiendo el local o se reparten entre los que quedan, con conflicto incluido.

## La idea

lo-mio lleva **la cuenta de cada persona dentro de la mesa**, sin cambiar cómo el local pide a cocina ni cómo cobra.

1. El mesero sigue cargando pedidos en su POS (Fudo en el piloto), igual que hoy.
2. lo-mio lee los ítems de la mesa y los muestra en un **feed de la mesa**.
3. Cada comensal se identifica en segundos (QR de la mesa en su celular, o una tarjeta/posavasos NFC que le entrega el mesero) y **reclama lo suyo**: "lo mío", "compartido entre X personas" o "por porciones".
4. Si el mesero corrige una asignación, el comensal la **acepta en su dispositivo**. Si usa tarjeta, el mesero **escanea la tarjeta** para confirmar.
5. Cuando alguien se va, paga **su saldo**. El mesero escanea el comprobante (timbre de la boleta, voucher o evidencia en efectivo) y lo-mio lo deja registrado.
6. Al cerrar la mesa ya no hay que reconstruir nada: cada ítem tiene dueño y cada pago tiene comprobante. Los ítems sin dueño se alertan **antes** de que se vaya el último.

## Por qué "el cliente reclama" y no "el mesero asigna"

Hacer que el mesero asigne cada ítem a una persona al tomar el pedido le suma trabajo en su momento de más carga, y eso es justo lo que queremos eliminar. Al revés funciona mejor: quien mejor sabe qué consumió es el propio cliente, y el sistema solo tiene que detectar lo que nadie reclamó. El mesero interviene solo cuando hay una excepción.

## Identificación del comensal

| Medio | Para quién | Costo | Notas |
|---|---|---|---|
| **Celular + QR de mesa** (web, sin instalar app) | La mayoría | ~0 | Medio principal. Sesión anónima en el navegador. |
| **Tarjeta individual NFC + QR impreso** | Sin celular, sin batería o sin ganas | Bajo (~USD 0,3–1 c/u) | Reutilizable y la entrega el mesero. El QR impreso sirve en teléfonos sin NFC web (iPhone). |
| **Posavasos NFC** | Bares, como diferenciador | Medio | Mismo protocolo que la tarjeta. Riesgo de pérdida o robo. Fase posterior. |
| Pulsera NFC (idea) | Eventos y terrazas | Bajo | Mismo protocolo que la tarjeta. |

Regla de oro: si el celular de alguien falla, el mesero le pasa una tarjeta y **transfiere su cuenta** a ella. El comensal no pierde lo que lleva.

## Ideas a explorar (no MVP)

- **Alertas de salida**: si un comensal con saldo sale de la mesa sin pagar (porque cerró la sesión o la inactividad sugiere que se fue), se avisa al mesero.
- **Pago desde el celular** (Webpay / Mercado Pago) para quien quiera irse sin esperar al mesero.
- **Propina por persona**, sugerida sobre su propio consumo.
- **Reclamo por foto**: el comensal fotografía su plato y se sugiere el ítem.
- **Analítica para el local**: tiempo de cobro por mesa, ítems sin dueño y pérdidas evitadas. Es el argumento de venta.

## Métrica de éxito del piloto

- Tiempo de cobro por mesa: de ~20 min a **< 3 min**.
- % de ítems reclamados sin intervención del mesero: **> 80 %**.
- Diferencias de caja por mesas compartidas: **0**.
