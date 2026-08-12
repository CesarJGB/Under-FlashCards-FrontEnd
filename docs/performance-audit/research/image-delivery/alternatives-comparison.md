# Comparación de alternativas de almacenamiento y entrega de imágenes

Comparación documental sobre la matriz de la Fase 1A (mismos perfiles: 20/100/500/1000 tarjetas; 10/100/500 mazos; sin imagen / portada / fondo pequeño-mediano-grande / compartido / distinto / contenido parcial y completo). Las cifras de tamaños provienen del harness [raw-results.json](./raw-results.json) (MODELED/MEASURED sobre el contrato) y de la Fase 1A; las de infraestructura son ESTIMATED cualitativas salvo que se indique otra cosa.

## Familia A — Normalización mínima conservando Data URL

La tarjeta conserva `bgImageIndex`; la respuesta de tarjetas incluye un diccionario de fondos **una sola vez**; la lista de mazos deja de enviar `cardBackgrounds`. El almacenamiento (Data URL en MongoDB) no cambia.

| Dimensión | Evaluación |
|---|---|
| Bytes almacenados | Igual que hoy (1 copia por fondo + `contentImage` por tarjeta) |
| Bytes JSON/transferidos | 1000 tarjetas, fondo grande: **911.87 → 0.375 MiB** (−99.96%); gzip 686.81 → 0.008 MiB. Lista de 500 mazos con portada+fondos: 83.62 → 0.22 MiB (−99.7%); gzip 62.99 → 0.004 MiB |
| Requests | Sin cambios (misma cantidad de endpoints; 0 requests adicionales) |
| Caché navegador/HTTP | Sin mejora para las imágenes (siguen siendo cadenas embebidas); mejora todo el resto (JSON más pequeño, parse más barato) |
| Cold/warm load | Ambos mejoran vía payload/parse; la imagen sigue decodificándose de la cadena |
| Deduplicación | Total a nivel de transporte: el fondo se envía una vez; el diccionario deduplica también `contentImage` idénticas si se añade |
| Compresión/formatos | Sin cambios (JPEG/PNG del usuario) |
| Miniaturas | No en esta familia (diferida a D) |
| Calidad visual | Idéntica (se muestra la misma cadena) |
| CPU/memoria cliente | `JSON.parse` y heap caen drásticamente: 0.375 MiB frente a 911.87 MiB por respuesta |
| CPU/memoria servidor | Serialización sin expansión por tarjeta; `JSON.stringify` de la lista 500 mazos cae de 375.79 ms a 0.43 ms (MEASURED, Node/V8) |
| Coste de infraestructura | Cero (sin servicios nuevos) |
| Backup/restauración | Sin cambios (mismo Mongo) |
| Autorización | Sin cambios (idéntica postura actual, sin nuevos recursos) |
| Privacidad | Sin cambios; no se introducen URLs a terceros |
| CORS/CSP | Sin cambios |
| Expiración de URL | No aplica |
| Borrado/huérfanos | No resuelve: los fondos huérfanos de `cardBackgrounds` siguen existiendo (riesgo preexistente, ver IDL-003) |
| Offline | Sin cambios (sin nuevas peticiones; misma persistencia) |
| Importación/exportación | Ya compatibles: el formato es indexado (`deckController.js:186-191,213,229`); ningún cambio de modelo |
| PDF | Sin cambio: el cliente resuelve el diccionario antes de entregar las tarjetas al exportador |
| Mazos globales | Sin cambios (visibilidad y persistencia intactas) |
| Migración | Sin migración de datos: los `bgImageIndex` ya existen; la resolución se mueve del servidor al cliente |
| Rollback | Trivial: el servidor vuelve a expandir (cambio de serialización reversible) |
| Complejidad operacional | Mínima; sólo serializadores y consumidores |
| Vendor lock-in | Ninguno |
| VPS/backend/Coolify | Sin nuevos procesos ni volúmenes; compatible con varias instancias (sin estado de archivos) |

**Riesgos**: consumidores que esperen `card.bgImage` como cadena deben resolver el diccionario (editor, PDF, caras, grid); si algún consumidor se olvida, muestra tarjeta sin fondo (fallback a color sólido, degradación no catastrófica).

## Familia B — Assets administrados por el backend (documento/recurso separado)

Documento de assets (Mongo/GridFS) o archivos persistentes, con endpoint autenticado de carga y recuperación. Variante con varias instancias y Coolify: MongoDB es compartido; sistema de archivos local requeriría volumen persistente compartido o replicación.

| Dimensión | Evaluación |
|---|---|
| Bytes almacenados | Binario ~0.75× de la Data URL (sin overhead Base64); GridFS parte en 255 KiB |
| Bytes JSON/transferidos | Igual de bajo que A en las respuestas (referencias); el binario se descarga aparte |
| Requests | +1 por imagen única en frío (diccionario → N assets); con caché HTTP caliente, ~0 |
| Caché navegador/HTTP | **Sí**: recursos con URL propia, reutilizables, revalidables y cacheables por el navegador (mejora reaperturas y recargas) |
| Cold/warm load | Cold: payload pequeño + N descargas de assets; warm: caché HTTP cubre las imágenes |
| Deduplicación | Por id de asset si se normaliza por hash de contenido |
| Compresión/formatos | Oportunidad de generar variantes (webp/avif) y miniaturas en el servidor |
| Miniaturas | Posibles (variantes por tamaño) |
| Calidad visual | Controlable por variante; requiere decisión de qué variante sirve cada superficie |
| CPU/memoria | Menos string grandes en JSON; el servidor sirve bytes; transformación de imágenes añade CPU si se generan variantes |
| Coste de infraestructura | Sólo Mongo (plan actual) si se usan documentos/GridFS; sin proveedor externo |
| Backup/restauración | Mongo GridFS/documentos entran en el backup existente; archivos locales requieren procedimiento propio |
| Autorización | **Diseñar**: hoy los endpoints de lectura no están protegidos; un asset referenciado expone el binario salvo firmas/proxy |
| Privacidad | Depende de la autorización; peor si las URLs son adivinables |
| CORS/CSP | Requiere permitir el origen del backend en CSP; CORS ya configurado (`server.js:55-66`) |
| Expiración de URL | No aplica si el proxy valida sesión; aplica si se usan URLs firmadas |
| Borrado/huérfanos | **Diseñar GC**: al borrar tarjeta/mazo hay que eliminar assets sin referencias; sin GC crece el bucket/colección |
| Offline | Peor si la app se abre sin red y no cachea blobs; requiere cache de recursos o service worker |
| Importación/exportación | La importación debe re-subir assets y remapear ids; la exportación debe embeber de nuevo o acompañar ids (rompe la portabilidad JSON actual si no se diseña) |
| PDF | Mejora el pipeline (fetch de URL ya soportado por `pdf/images.js:49-59`) pero exige CORS del proxy y disponibilidad |
| Mazos globales | Los assets de mazos compartidos deben ser accesibles sin auth o con reglas por mazo |
| Migración | Necesaria: extraer Data URL → assets, con doble escritura y consistencia (mayor esfuerzo que A) |
| Rollback | Complejo si los documentos quedan con referencias sin assets (hay que mantener la cadena durante la transición) |
| Complejidad operacional | Media-alta: GC, autorización, consistencia, reinicio de procesos |
| Vendor lock-in | Ninguno (infra actual) |
| VPS/backend/Coolify | Con MongoDB, multi-instancia ok; con archivos locales, requiere volumen compartido/persistente en Coolify |

## Familia C — Object storage compatible con S3

Imágenes fuera de los documentos, con ID/key/URL controlada (pública, firmada o proxieda). No se selecciona proveedor aquí; la evaluación es de arquitectura. Las referencias de precios no se emiten: se requiere consultar documentación oficial del proveedor elegido en una fase con presupuesto real.

| Dimensión | Evaluación |
|---|---|
| Bytes almacenados | Binario nativo (mínimo); +variantes si se generan |
| Bytes JSON/transferidos | Mínimos en JSON; el binario viaja como descarga |
| Requests | Mismo patrón que B (+1 por asset en frío) |
| Caché navegador/HTTP | Excelente (URLs públicas cacheables, CDN opcional) |
| Cold/warm load | Cold: N descargas; warm: caché/CDN |
| Deduplicación | Por hash si la plataforma lo permite (o dedup en la app) |
| Compresión/formatos | Variantes servidas por superficie; formato moderno posible |
| Miniaturas | Soportadas (transformación en origen o pipeline propio) |
| Calidad visual | Máxima flexibilidad, requiere decisión por superficie |
| CPU/memoria | Libera al backend de servir binarios |
| Coste de infraestructura | **Añade coste mensual y operación** (bucket, transferencia, posible CDN); se debe cuantificar con datos reales antes de elegir |
| Backup/restauración | Bucket versionado + copia; la base ya no contiene las imágenes (restaurar requiere ambos) |
| Autorización | Diseñar: públicas vs firmadas vs proxy; hoy el API no autentica lecturas |
| Privacidad | Riesgo real si las URLs son públicas/adivinables; mitigación con ids no enumerables/firmas/proxy |
| CORS/CSP | Requiere configuración por dominio del bucket y CSP del frontend |
| Expiración de URL | Aplica a firmas (TTL); requiere renovación y manejo de expiración |
| Borrado/huérfanos | GC obligatorio; la eliminación del mazo/tarjeta debe borrar objetos |
| Offline | No mejor que B sin cache/worker; recarga descarga de nuevo (o caché HTTP si no expira) |
| Importación/exportación | Mismo problema que B (re-upload y remapeo; exportación portátil más difícil) |
| PDF | Igual que B + CORS del bucket/proxy |
| Mazos globales | Mismas reglas que B |
| Migración | La más costosa: extracción masiva, doble escritura, consistencia, re-upload |
| Rollback | Complejo (mantener cadenas y refs simultáneas o re-importar) |
| Complejidad operacional | Alta: credenciales, TTL, GC, monitorización |
| Vendor lock-in | Medio (API S3 estandariza; precio/condiciones varían; se mitiga con capa propia) |
| VPS/backend/Coolify | Independiente del hosting; añade dependencia de red/credenciales externas |

## Familia D — Arquitectura híbrida

Miniatura optimizada para Library/materias/grids + recurso de mayor resolución para cara/PDF + referencias cacheables + compatibilidad temporal con Base64 heredado. Es la extensión natural de A hacia B/C sin saltar de una vez.

| Dimensión | Evaluación |
|---|---|
| Bytes almacenados | Diccionario de miniaturas + full; más que A si se guardan ambos, menos que hoy si se migra |
| Bytes JSON/transferidos | Menor que A en superficies de resumen (sólo miniaturas): 500 mazos portadas thumb → 13.58 MiB (frente a 83.62 con portadas+fondos; ESTIMADO con perfil thumb) |
| Requests | +1 por miniatura única; full bajo demanda |
| Caché navegador/HTTP | Sí para miniaturas (recurso reutilizable) si se sirven como URL |
| Cold/warm load | Cold ligera en resúmenes; full bajo demanda en cara/PDF |
| Deduplicación | Por diccionario + hash |
| Compresión/formatos | Variantes por superficie (thumb/full; formatos modernos si se quiere) |
| Miniaturas | **Sí**, su propósito |
| Calidad visual | Full intacta en cara/PDF; miniatura sólo en grid/listas (fidelidad aprobable) |
| CPU/memoria | Menos raster en grids; decodificación menor |
| Coste de infraestructura | Cero si las miniaturas se generan y guardan en Mongo (igual que A); sube si se externalizan |
| Backup/restauración | Igual que A si se queda en Mongo |
| Autorización/privacidad | Igual que A si las refs se resuelven por el API; igual que B/C si se externaliza |
| CORS/CSP/expiración | No aplica (en Mongo) o igual que B/C (externalizado) |
| Borrado/huérfanos | GC de miniaturas huérfanas cuando se eliminen fondos |
| Offline | Igual que A en su forma local; externalizado requiere cache |
| Importación/exportación | Mantiene el formato indexado; añade variantes que deben regenerarse al importar |
| PDF | Usa full; sin cambio |
| Mazos globales | Sin cambios |
| Migración | Escalonada: primero A (sin storage), luego miniaturas; compatible con legacy |
| Rollback | Por cortes independientes (misma reversibilidad que A en cada paso) |
| Complejidad operacional | Baja en su primera mitad (A), media si externaliza |
| Vendor lock-in | Igual que A/C según dónde vivan los bytes |
| VPS/backend/Coolify | Igual que A en la fase local |

## Resumen comparativo (foco: objetivos de la fase)

| Objetivo | A | B | C | D |
|---|---|---|---|---|
| Rapidez percibida Library/materias | Alta (payload −99.7%) | Alta (referencias) | Alta (referencias/CDN) | Alta (miniaturas) |
| Evitar duplicación masiva | Sí (transporte y lógica) | Sí | Sí | Sí |
| Mantener mazos existentes | Sin migración | Migración necesaria | Migración necesaria | Sin migración en onda 1 |
| No perder calidad visible | Idéntica | Controlable | Controlable | Full intacta |
| Costes/operación VPS/Coolify | Cero | Media | Media-alta | Baja |
| No romper editor/repaso/PDF/export | Riesgo bajo | Riesgo medio | Riesgo medio-alto | Riesgo bajo |
| Migración gradual y reversible | Trivial | Media | Alta | Escalonada |

## Valoración

- **A domina** en coste/riesgo/impacto inmediato: captura el 99.7–99.96% del peso repetido sin migración ni infraestructura.
- **D es la evolución natural** y el único camino que además reduce raster en grids y transporta miniaturas a resúmenes; su primera mitad coincide con A.
- **B y C** resuelven caché HTTP real y variantes de formato, pero sólo compensan cuando el problema de contrato ya esté resuelto; añaden GC, autorización, consistencia, offline y portabilidad de exportación. No hay evidencia de que el problema actual los exija.
- **«Guardar URLs» como solución completa queda descartada**: externalizar sin resolver el contrato de salida (diccionario/índice) mantendría la expansión por tarjeta y añadiría N descargas.
