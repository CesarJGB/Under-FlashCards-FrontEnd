# Migración, despliegue y rollback

Esta fase no ejecuta nada; define cómo se haría cada corte cuando se apruebe.

## Principio

**Onda 1 sin migración de datos.** `bgImageIndex` y `cardBackgrounds` ya viven en MongoDB; la resolución se mueve del serializador al cliente. El único "estado de transición" es el contrato de API (dos versiones conviviendo), no los datos.

## Convivivencia dual (contrato)

| Versión servidor | Cliente viejo (espera `card.bgImage` expandido) | Cliente nuevo (espera diccionario + índice) |
|---|---|---|
| Antes del corte | `bgImage` expandido | incompatible con el objetivo |
| Durante (campo dual) | recibe `bgImage` expandido (legacy) | recibe `backgrounds` + `bgImageIndex`; ignora `bgImage` |
| Después (Corte 5) | no soportado (requiere actualizar app) | contrato nuevo |

Mecanismo de negociación recomendado (decisión humana pendiente): cabecera `Accept: application/json; version=2` o campo de consulta `?contract=indexed`. El servidor decide qué shape serializar con el mismo lector de mazo. Fallback: si llega un cliente sin cabecera, responde el shape expandido (legacy) — cero riesgo de romper la app desplegada.

## Criterios de entrada (pre-requisitos de cada corte)

1. Pruebas de caracterización (Corte 0) verdes en el HEAD objetivo.
2. Contract tests del shape nuevo + shape legacy.
3. Métricas de aceptación del corte anterior cumplidas (ver [implementation-cuts.md](./implementation-cuts.md)).
4. Entorno controlado (staging/VPS de pruebas) disponible; sin datos reales de usuarios.

## Secuencia de migración

1. **Corte 1** (serialización): desplegar backend con campo dual + frontend nuevo resolviendo diccionario. Sin scripts. Los datos no cambian.
2. **Corte 2** (contratos ligeros): resumen de lista sin `cardBackgrounds`; `coverImageThumb` opcional si se aprueba. Los clientes viejos reciben la respuesta legacy.
3. **Corte 3** (almacenamiento de assets, si se aprueba): **sí requiere migración de datos** — extracción de Data URL → assets con doble escritura:
   - Escritura dual: al guardar una imagen, se escribe el asset y se conserva la cadena en el documento (referencia + campo legacy).
   - Migración por lotes: lector de mazos con `coverImage`/`cardBackgrounds` poblados, genera asset + actualiza referencia; idempotente por id de mazo; reanudable.
   - Consistencia: la cadena legacy se conserva hasta que 0 consumidores la pidan (Corte 5); si un asset falta, el servidor sirve la cadena.
4. **Corte 4** (limpieza): GC de `cardBackgrounds` huérfanos (sin `bgImageIndex` referenciante) y de assets sin referencias, con dry-run y conteos previos.
5. **Corte 5** (contrato heredado): eliminar el campo `bgImage` del shape y el legacy `cardBackgrounds` de la lista, cuando no haya clientes viejos (métricas: tráfico sin cabecera de versión ≈ 0 durante N días).

## Rollback

| Corte | Rollback |
|---|---|
| 1/2 (serialización) | Volver a desplegar el backend anterior (el serializador vuelve a expandir). Los datos no se tocan. Sin migración inversa. |
| 3 (assets) | Mantener cadenas legacy durante toda la transición ⇒ al revertir, las referencias se ignoran y se sirven las cadenas. La migración es idempotente y no destructiva (no borra cadenas hasta el Corte 4/5). |
| 4 (GC) | Restaurar desde backup; el dry-run previo y la retención de cadenas reducen el riesgo; GC nunca ejecutado automáticamente sin aprobación. |
| 5 (limpieza) | No hay rollback limpio si se borraron cadenas; se ejecuta sólo con métricas de 0 clientes legacy sostenidas. |

Regla general: **ningún corte borra datos hasta que otro corte garantice que nadie los necesita** (dependencia estricta 1 → 2 → 3/4 → 5).

## Restauración y backup

- Onda 1/2: backup MongoDB actual (sin cambios).
- Onda 3: el backup debe cubrir base + assets (restaurar la base sin assets deja referencias huérfanas; el servidor debe tener fallback a la cadena legacy hasta el corte 5).

## Métricas de validación de la migración

- Respuesta de tarjetas: `jsonUtf8Bytes` ≤ presupuesto por perfil (ver cortes); duplicación de fondo = 0 en el shape nuevo.
- Lista de mazos: sin `cardBackgrounds` (contract test); bytes ≤ presupuesto.
- Error de resolución de diccionario: 0 (grid/caras/PDF con `bgImageIndex` inválido caen a color sólido con log).
- Tráfico legacy: proporción de requests sin cabecera de versión durante la convivencia.
- Regresión funcional: editor, repaso, sesiones, PDF, import/export y offline por matriz de la Fase 1A.

## Riesgos de la migración

| Riesgo | Mitigación |
|---|---|
| Cliente viejo rompe si se quita `bgImage` antes de tiempo | Campo dual + cabecera; nunca eliminar sin métricas |
| `bgImageIndex` fuera de rango en datos viejos | Resolver con `backgrounds[i] || ''` y log; fallback color sólido |
| Assets sin cadena legacy tras corte 3 (pérdida de imagen) | No borrar cadenas hasta corte 5; reanudación idempotente |
| GC borra en uso (fondos compartidos) | GC por recuento de referencias reales, dry-run, aprobación |
| Carga de sesiones con doble contrato | `all-cards` usa el mismo shape; probado en matrix de sesión |
| Multi-instancia Coolify escribiendo assets | Onda 3 debe elegir almacenamiento compartido (Mongo) o diseñar consistencia |
