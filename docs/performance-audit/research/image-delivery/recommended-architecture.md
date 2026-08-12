# Arquitectura recomendada de entrega de imágenes

## Decisión

**Alternativa recomendada: A — normalización mínima del contrato conservando Data URL en MongoDB.** Diccionario de fondos + `bgImageIndex` en las respuestas de tarjetas y resumen de mazo sin `cardBackgrounds`.

**Alternativa de respaldo: D — híbrida**, cuando la onda A esté desplegada: miniaturas en resúmenes/grids y referencia full para cara/PDF, manteniendo compatibilidad con el contrato heredado.

**Explícitamente NO recomendadas ahora: B (assets en backend) y C (object storage S3).** Documentadas en [alternatives-comparison.md](./alternatives-comparison.md) como evolución futura; no hay evidencia de que el problema actual las exija.

## Por qué (cuantitativo)

| Métrica | Hoy | Con A | Fuente |
|---|---:|---:|---|
| 1000 tarjetas, fondo grande compartido, JSON | 911.87 MiB | 0.375 MiB (−99.96%) | [quantitative-results.md](./quantitative-results.md) §1 |
| Ídem, gzip | 686.81 MiB | 0.008 MiB | §1 |
| Lista 500 mazos portada+fondos, JSON | 83.62 MiB | 0.22 MiB (−99.7%) | §4 |
| `JSON.stringify` lista 500 (App + localStorage) | 375.79 ms | 0.43 ms | §5 |
| Requests | 1 | 1 (sin cambios) | §7 |
| Migración de datos | — | ninguna | — |
| Coste de infraestructura | — | cero | — |

El 99.86% del JSON de tarjetas con fondo compartido es la misma cadena repetida; `cardBackgrounds` en la lista de mazos pesa ~63 MiB de 83 MiB con 500 mazos y **no tiene consumidores en el frontend** (IDL-001, [current-image-contract.md](./current-image-contract.md) §10). El cuello es el serializador, no el almacenamiento: por eso la solución de menor riesgo no toca MongoDB ni añade proveedores.

## Arquitectura objetivo (onda 1, sin cambios de almacenamiento)

### Respuesta de tarjetas (detalle)

```jsonc
// GET /api/flashcards/deck/:deckId  (y all-cards / continuous / normal)
{
  "backgrounds": ["data:image/jpeg;base64,..."],   // una vez por cadena única
  "cards": [
    { "id": "...", "question": "...", "bgImageIndex": 0, "contentImage": "data:...", ... }
  ]
}
```

- El servidor deja de expandir `bgImage` (eliminar la sustitución de `Flashcard.serialize` en `Flashcard.js:66` para estos endpoints, o moverla a una función de compatibilidad).
- El cliente resuelve `bgImage = backgrounds[bgImageIndex]` en: grid (`FlashcardGrid.jsx:13-23`), caras (`CardFace.jsx:28-29,87-98`), repaso (`ReviewMode.jsx:42,59-62`), borrado rápido (`FastDeleteMode.jsx:92-105`), preview (`LivePreview.jsx:11-16`), editor (`DeckInterior.jsx:277`) y PDF (`pdf/images.js:248,261`).
- Los endpoints de sesión y colas devuelven el mismo shape (son el mismo serializador: `reviewController.js:235,281,318`).

### Resumen de mazo (lista)

- `Deck.serialize` para `GET /api/decks/:userId` deja de incluir `cardBackgrounds`; `coverImage` permanece (la consume `DeckCard.jsx:30-39`). Opcional en cortes posteriores: `coverImageThumb`.
- Los endpoints que sí necesitan el diccionario (detalle de tarjetas, export) lo obtienen del documento como hoy.

### Respuestas de creación/edición

- El servidor puede seguir devolviendo el shape expandido **sólo** a los clientes antiguos (negociación por `Accept`/versión) o devolver diccionario+índice a todos y resolver en cliente. La onda 1 recomienda: respuesta de escritura = misma tarjeta serializada expandida (sin romper el flujo ACK del editor), y respuesta de lectura = contrato nuevo.

## Compatibilidad heredada

| Superficie | Requisito | Compatibilidad |
|---|---|---|
| Datos en MongoDB | `bgImageIndex` + `cardBackgrounds` ya existen | Sin migración; índice `-1` y diccionario vacío cubren tarjetas sin fondo |
| Cliente viejo (aplicación desplegada antes del corte) | `card.bgImage` expandido | Servidor dual: cabecera de versión o campo `bgImage` opcional hasta que no haya clientes antiguos (Corte 5) |
| Export/import JSON | Ya indexado | Sin cambios |
| PDF | Necesita cadena completa | El cliente resuelve el diccionario antes de `exportDeckToPDF` |
| Offline | Sin nuevas peticiones | Sin cambios (los datos locales siguen siendo cadenas) |
| `safeLocalStorage` | Contrato resumen | Menor stringify/parse y cuota (−99.7% caracteres) |

## Qué está confirmado y qué sigue bloqueado

**Confirmado (STATICALLY CONFIRMED / MEASURED / MODELED):** duplicación por serialización (`Flashcard.js:66`); `cardBackgrounds` sin consumidores en frontend; beneficio cuantitativo de A (tablas §1-§5); coste nulo de la doble escritura de migración (§4, +0.04%); endpoints afectados y consumidores de `bgImage` inventariados.

**Fuerte (ESTIMATED):** ahorro de miniaturas (perfil thumb), impacto real de payload en FCP/LCP/INP.

**Bloqueado:** latencia/`explain()`/selectividad de MongoDB (**BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE**); comportamiento del grid con el contrato nuevo en Safari/iPhone (**PENDING — DEVICE REQUIRED**; IMG-RENDER = PARTIAL); compresión efectiva del edge; distribución real de tamaños de imagen.

## Cambio mínimo de mayor mejora con menor riesgo

**Corte 1**: dejar de enviar `cardBackgrounds` en la lista de mazos + devolver diccionario+índice en las respuestas de tarjetas, con resolución en el cliente y `bgImage` dual para clientes antiguos. Captura el ~99.7–99.96% del peso sin tocar modelos, almacenamiento, export, PDF, import ni offline. Ver [implementation-cuts.md](./implementation-cuts.md).

## Decisiones que requieren aprobación humana

1. **Cabecera de versión / campo dual** durante la transición (o aceptar un corte sincronizado frontend+backend).
2. **Alcance de `contentImage`**: deduplicar por diccionario o mantener por tarjeta (afecta el ahorro de mazos con muchas imágenes de contenido).
3. **Miniaturas (Corte 2/3)**: presupuesto visual y de bytes por superficie; ¿se genera `coverImageThumb` en cliente o en servidor?
4. **Política de caché/invalidación** (IMG-CACHE): TTL y dueño de la revalidación antes de tocar `?t=` o ampliar cachés.
5. **Futuro almacenamiento de assets** (B/C): si se desea caché HTTP real para imágenes, cuándo y con qué proveedor; requiere nueva fase de medición de distribución real y coste.
6. **Límite/presupuesto por contrato** (p. ej. nº de fondos por mazo) y GC de `cardBackgrounds` huérfanos (IDL-003).

## Qué NO debe implementarse todavía

- No externalizar a S3/GridFS/objetos (sin medición de distribución real, autorización, offline, exportación portátil y coste).
- No tocar `?t=${Date.now()}` ni ampliar localStorage sin política de revalidación.
- No cambiar el contrato de export/import ni el de PDF.
- No modificar UX ni efectos visuales del grid (IMG-RENDER = PARTIAL; nada de sombras/overlays/virtualización).
- No ejecutar migraciones reales ni scripts sobre datos de producción.
