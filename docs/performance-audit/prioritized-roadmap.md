# Hoja de ruta priorizada para una fase futura

## Propósito y regla de avance

Este documento ordena investigación y posibles líneas de solución. No autoriza implementación. Un elemento sólo pasa de hipótesis a cambio propuesto cuando tiene baseline reproducible, cuello atribuido, contrato de consumidores y criterio de aceptación/regresión.

## 1. Problemas que requieren medición primero

### P0 — Reproducción del lag con fondos

IDs: PERF-IMG-003, PERF-DECK-001, PERF-MOBILE-001.

Estado tras [Fase 1A](./experiments/image-baseline/research-gates.md): **IMG-RENDER = PARTIAL**. Ya existe matriz headless y atribución Chromium de Paint/Raster; faltan iPhone/Safari físico, compositor/GPU y acción exacta del reporte. No repetir el baseline salvo para validar drift.

1. Obtener el escenario exacto del reporte: dispositivo, Safari/Chrome, cantidad de cards, resolución/bytes y fondo compartido/distinto.
2. Ejecutar C20/100/500/1000 con I0/I2/I3, aislando tamaño, sombra y overlay en harness.
3. Atribuir scripting, style, paint, composite, decode, GPU/GC y memoria.
4. Determinar si el evento problemático es hover, scroll, tap, menú o un rerender asociado.

Criterio para avanzar: al menos una traza repetible por escritorio y móvil que explique la mayor parte de la duración del evento. Sin esto no se debe retirar efectos ni introducir memoización/virtualización como corrección asumida.

### P0 — Presupuesto de datos de imagen

IDs: PERF-IMG-001, PERF-IMG-002, PERF-SERVER-001.

Estado tras [Fase 1A](./experiments/image-baseline/research-gates.md): **IMG-DATA = GO** para investigar alternativas. Ya están cuantificados Base64, JSON/gzip, BSON sintético, duplicación, parse/stringify y puntos locales de cuota. Siguen faltando distribución real anonimizada, infraestructura de compresión y base representativa; GO no selecciona solución.

**Resuelto por [Fase 1B](./research/image-delivery/README.md) en su parte contractual.** La comparación de alternativas sobre la misma matriz concluyó en una recomendación: normalizar el contrato de salida (diccionario de fondos + índice; resumen de mazo sin `cardBackgrounds`) antes de cualquier almacenamiento externo. Las cifras clave y los cortes de implementación están en [research/image-delivery/quantitative-results.md](./research/image-delivery/quantitative-results.md) y [research/image-delivery/implementation-cuts.md](./research/image-delivery/implementation-cuts.md). La implementación no está autorizada; los gates están en [research/image-delivery/implementation-readiness.md](./research/image-delivery/implementation-readiness.md).

1. Medir bytes binarios/Data URL/JSON/transferidos y BSON por tipo de imagen.
2. Cuantificar repetición de un fondo en respuesta de tarjetas y campos de fondo en lista de mazos.
3. Verificar compresión del edge, cuota de localStorage, heap Node/browser y límite operacional del Deck.
4. Obtener distribución real p50/p95/máxima sin copiar contenido sensible.

Criterio para avanzar: presupuesto por superficie y endpoint, con peor caso soportado y margen. Sólo entonces comparar referencia/URL/diccionario/thumbnail/Data URL.

### P0 — Curvas de escala de Library y apertura

IDs: PERF-LIB-001, PERF-LIB-002, PERF-DECK-001, PERF-API-001, PERF-API-002.

Estado tras [Fase 2A](./research/library-scale/phase-2a-real-baseline.md): baseline **MEASURED** sobre el entorno productivo autorizado (HEAD `ef8c4d0`): 29 mazos / 5.877 tarjetas (máx. 545; 9 mazos ≥500); API indexada 9.4–304 KB con medianas de 145.55–245.74 ms (C20–C500) y 235.86 ms en la lista (5 muestras/caso, p95 NOT MEASURED); explain: lista con COLLSCAN + sort en memoria (36 docs examinados), muestra de conteos de los 3 mazos seleccionados cubierta con `deckId_1` (el aggregate completo de Library queda NOT MEASURED) y apertura por mazo indexada con sort en memoria (`{deckId, createdAt}` ausente). Quedaron sin medir los costes de navegador (render/storage/parseo real) y la compresión navegador/edge (el harness Node no anunció compresión).

Estado tras [Fase 2B](./research/library-scale/phase-2b-browser-profile.md): perfil de navegador **MEASURED** sobre los mismos datos reales (HEAD `ecb0259`, Chromium de Playwright, 5 repeticiones por escenario, p95 NOT MEASURED): Library utilizable y aperturas C20/C100/C500 con separación red/parseo/render, hidratación de `safeLocalStorage`, renders/commits de React (build de profiling aparte), DOM, memoria, long tasks y atribución scripting/layout/paint; compresión navegador/edge medida por primera vez; cero eventos legacy. Queda sin medir la curva con D100/D500 sintéticos, los entornos de red R1/R2 y los dispositivos M1/M2.

Ejecutar D10/100/500 y C20/100/500/1000, separar red/backend/browser y capturar `explain`. Confirmar el punto donde summary completo, conteos, filtros O(F×D), DOM o serialización dominan (2B ya aporta la atribución de navegador; falta la confirmación con cardinalidad sintética y red degradada).

Criterio para avanzar: curva y punto de quiebre por dispositivo objetivo; inventario campo→consumidor para contratos de resumen/detalle.

### P0 — Camino crítico de Guardar y review

IDs: PERF-CARD-001, PERF-CARD-002, PERF-CARD-003, PERF-REVIEW-001.

Instrumentar click→formulario listo, queries, refrescos secundarios y cola de mastery. Comparar texto, fondo existente/nuevo, contentImage y lote. Medir review/flush con mazos crecientes.

Criterio para avanzar: atribución porcentual/absoluta por segmento, profundidad de cola y reglas de consistencia acordadas.

### P1 — Carreras y errores

IDs: PERF-LIB-003, PERF-ERR-001.

Construir reproducción con respuestas invertidas, errores y navegación rápida. Registrar estado visible, cache persistida y loading. Criterio: test de contrato que falle de forma estable antes de diseñar cancelación/versionado.

## 2. Quick wins potenciales, sujetos a validación

“Potencial” significa alcance aparentemente acotado; no es permiso de cambio.

| Orden | Dirección candidata | IDs | Validación necesaria | Riesgo/regresión |
|---|---|---|---|---|
| Q1 | consolidar ownership/deduplicación de `loadDecks`/`loadMaterias` | NET-001, CACHE-001 | initiators y política de frescura | Home/Library desactualizados tras mutación |
| Q2 | evitar fondos en una representación de resumen de mazo | IMG-001, API-001 | mapa de consumidores, export/permisos | previews o flujos ocultos pierden campos |
| Q3 | reutilizar la colección ya cargada o evitar carga de DeckInterior al iniciar sesión | DECK-002 | semántica all-cards/stats y permisos | sesión usa datos incompletos/obsoletos |
| Q4 | precomputar mapa de conteos para la vista actual | LIB-002 | Profiler demuestra peso | invalidación/movimientos incorrectos |
| Q5 | secuenciar/abortar temas y subtemas | LIB-003 | reproducción de carrera | loading atascado o caché no poblada |
| Q6 | separar refrescos secundarios del ACK y actualizar sólo el conteo afectado | CARD-001 | contrato contador/globales | contador divergente y rollback complejo |
| Q7 | dimensiones/prioridad explícita donde se use `<img>` | IMG-004 | identificar superficies y layout | reservar ratio incorrecto o decode tardío |
| Q8 | definir y probar fallback de storage, mensajes y telemetría | CACHE-001, CACHE-002, ERR-001 | cuota con clave ausente/antigua y taxonomía de error | datos viejos, ruido o exposición de datos |

No se clasifica “quitar `?t=`” como quick win aislado: necesita cabeceras, revalidación e invalidación coherentes. Tampoco “añadir `React.memo`” sin perf de props/commits.

## 3. Cambios de arquitectura a comparar

### A. Contratos de resumen, detalle y colección

Problema: un serializador de Deck sirve lista, detalle, exportación y contexto, y uno de Flashcard expande fondo por tarjeta.

Alternativas a investigar:

- summary de mazo sin fondos y detalle bajo demanda;
- respuesta de cards con `bgImageIndex` + diccionario de fondos una vez;
- URLs/IDs de assets cacheables;
- campos/proyecciones por consumidor;
- Graph/normalización cliente con versionado.

Dependencias: Home, Library, DeckCard, editor, sesiones, export/import, PDF, defaults/globales, offline y datos antiguos. Criterio: reducir bytes/parse demostrablemente sin aumentar requests críticos ni romper fidelidad.

### B. Almacenamiento y variantes de imagen

Comparar Data URL en Mongo, almacenamiento de objetos, documentos de assets o híbrido. Considerar thumbnails para Library/grid y fuente de mayor resolución para cara/PDF.

Preguntas obligatorias: ownership, autenticación, URL expiration, CORS/CSP, borrado huérfano, deduplicación, privacidad, coste, backup, migración, offline, formato/calidad, EXIF, Safari y exportación portátil.

No decidir proveedor ni formato hasta medir datos reales y requisitos de producto.

**Estado tras la [Fase 1B](./research/image-delivery/alternatives-comparison.md):** las cuatro familias quedaron comparadas sobre la matriz de la Fase 1A. La recomendación es no externalizar aún: normalizar el contrato (diccionario + índice) y, sólo después, evaluar assets backend (B) u object storage (C) como evolución, con medición de distribución real y coste. La alternativa híbrida (D) es la evolución natural de A si Library exige miniaturas.

### C. Colecciones incrementales

Comparar paginación cursor, carga incremental, virtualización y `content-visibility` por superficie. Library, editor, búsqueda, review, sesión y exportación no tienen la misma semántica.

Riesgos: búsqueda incompleta, sort inconsistente, scroll/foco, menús portaled, selección, accesibilidad, teclado, reordenamiento, conteos y export total. Criterio: C1000 manejable con UX completa y comportamiento determinista.

### D. Estado y caché de datos

Definir una autoridad de consulta con claves, deduplicación, abort, stale time, invalidación por mutación, persistencia versionada y presupuesto. Puede ser una capa propia o una herramienta ya aprobada en fase futura; esta auditoría no pide dependencia nueva.

Riesgos: cache obsoleta, duplicación state/cache/storage, logout con datos anteriores, cuota, sincronización multi-tab y complejidad accidental.

### E. Escritura y actualización focalizada

Investigar respuesta mínima, ACK rápido, actualización optimista o pipeline asíncrono de imágenes/contadores. Medir primero qué domina. Cualquier optimismo necesita ID canónico, rollback, reintentos idempotentes, conflicto de edición, fondo normalizado y accesibilidad de saving/error.

### F. Cálculo de mastery y cola

Comparar cálculo incremental, batch, eventos persistidos y materializaciones. Preservar reglas académicas, consistencia tras retry, orden por usuario, recuperación y escalado multi-instancia. Antes: caracterizar backlog y exactitud del cálculo actual.

## 4. Riesgos y dependencias transversales

| Riesgo | Superficies afectadas | Mitigación de investigación |
|---|---|---|
| contratos ocultos consumen campos pesados | Home, Library, export, PDF, Study | mapa campo→consumidor y contract tests |
| caché mejora velocidad pero sirve datos viejos | contadores, jerarquía, permisos/globales | modelo explícito de frescura/invalidation |
| virtualización altera UX | grid, foco, menú, scroll, accesibilidad | pruebas funcionales y físicas |
| thumbnails reducen coste pero pierden fidelidad | fondos, preview, PDF | variante por superficie y comparación visual |
| URLs de objetos cambian seguridad/offline | todas las imágenes | threat/privacy/offline lifecycle review |
| índice acelera lectura y encarece escritura | Deck/Flashcard/review | explain + write benchmark + storage |
| respuesta mínima rompe actualización local | creador/editor | schema/consumer contract tests |
| optimismo duplica o pierde cards | creación rápida | idempotency key/rollback/reconciliation design |
| colas en memoria no escalan | review multi-instancia | carga/recovery/consistency tests |
| cambio móvil reabre problemas V2 | editor, sheets, teclado/scroll | mantener autoridad de `platform-limitations` y device matrix |
| suite backend roja oculta regresiones | IA/recovery/import | resolver intención antes de usarla como gate |

## 5. Orden recomendado de investigaciones posteriores

1. Congelar dataset/harness y reproducir el lag reportado (P0 hover).
2. Medir byte attribution y memoria de imágenes/contratos actuales.
3. Medir curvas D/C y planes MongoDB; establecer límites soportados.
4. Instrumentar Guardar y review para separar latencias.
5. Reproducir duplicaciones/carreras con initiators y respuestas invertidas.
6. Resolver drift de pruebas backend y fijar gates funcionales.
7. Prototipar fuera de producción el cambio mínimo sobre el cuello dominante.
8. Comparar alternativas arquitectónicas con el mismo dataset, no con benchmarks distintos.
9. Ejecutar regresión funcional, accesibilidad, export/import/PDF, móvil y memoria.
10. Sólo entonces preparar plan de migración/rollout/rollback y una fase de implementación.

## 6. Criterios de aceptación para una futura implementación

### Evidencia

- baseline y resultado comparten commit de fixture, entorno, dataset y número de repeticiones;
- métricas p50/p75/p95 o intervalos apropiados, no una captura favorable;
- mejora atribuida a fase concreta y sin trasladar coste no medido a otro endpoint;
- HAR/trazas anonimizadas y procedimiento reproducible;
- hipótesis y umbrales actualizados con resultados reales.

### Carga/Library

- una entrada no realiza dos descargas completas equivalentes sin razón registrada;
- tiempo a contenido útil y Web Vitals cumplen objetivos calibrados en M0/M1/M2;
- D500 conserva navegación, búsqueda, orden, breadcrumb y errores deterministas;
- caché tiene dueño, frescura, invalidación, logout y fallo de cuota definidos;
- respuesta summary no incluye campos no consumidos según contract tests.

### Mazo/grid/imágenes

- C20/100/500/1000 tiene comportamiento definido, no sólo “funciona en 20”;
- el escenario del lag no presenta long tasks/frames perdidos por encima del umbral acordado;
- bytes repetidos, memoria y superficies se mantienen dentro del presupuesto por perfil I0–I6;
- misma fidelidad en grid, cara, preview, sesión, export e import o diferencia aprobada;
- imágenes antiguas y nuevas conviven durante migración; fallos tienen fallback;
- no hay pérdida de `contentImage` ni índice de fondo inválido.

### Guardar/review/backend

- click→siguiente tarjeta lista cumple el objetivo en R0/R1/R2 y error/retry son inequívocos;
- no hay recarga global completa por mutación salvo que una medición/contrato la justifique;
- operaciones DB y serialización tienen presupuesto, índices verificados con `explain` y coste de escritura medido;
- cola de review tiene bound, observabilidad, recuperación y semántica multi-instancia;
- ningún body individual puede agotar recursos fuera del presupuesto acordado;
- compresión se verifica en producción, no se infiere por código.

### Calidad y regresión

- todas las pruebas relevantes verdes o excepciones explícitamente aceptadas;
- nuevas contract/performance tests cubren duplicación, orden de respuesta y perfiles de imagen;
- pruebas físicas Safari/Android incluyen teclado, scroll, touch y memoria;
- ninguna modificación fuera del alcance definido y rollback documentado;
- accesibilidad, foco, orden de tabulación y reduced motion preservados.

## No hacer todavía

- No cambiar Data URL por un proveedor de objetos sin medir distribución, offline, permisos, export/import y migración.
- No quitar sombras, overlays o transiciones atribuyéndoles el lag sin traza de paint/composite.
- No añadir `React.memo`, `useMemo` o `useCallback` de forma masiva sin commits del Profiler y estabilidad de props demostrada.
- No virtualizar el grid ni paginar un endpoint compartido sin mapear búsqueda, sort, editor, review, sesión y export.
- No eliminar `?t=${Date.now()}` sin diseñar revalidación e invalidación; podría convertir tráfico en datos obsoletos.
- No ampliar localStorage, añadir más cachés ni persistir cards completas como respuesta a la reapertura lenta.
- No crear índices MongoDB por intuición; obtener planes/selectividad y medir escritura/almacenamiento.
- No reducir el límite de 50 MB global sin presupuestos y contratos por importación/imagen.
- No adoptar actualización optimista sin idempotencia, rollback y reconciliación.
- No cambiar cálculo de mastery/cola sin pruebas de exactitud, orden, retry y multi-instancia.
- No reabrir como nuevos los defectos del editor V2 ya retirados; validar únicamente drift actual con dispositivo.
- No usar los umbrales hipotéticos del plan como mediciones ni prometer porcentajes de mejora.
- No convertir el fallo de pruebas en una “corrección” dentro de una fase de rendimiento sin decidir primero el contrato.
- No mezclar la implementación con esta auditoría documental.

## Resultado esperado de la siguiente investigación

La siguiente fase debe cerrar con un dossier comparativo por ID: baseline, traza, causa atribuida, alternativas evaluadas, coste/beneficio, contratos, riesgos y propuesta concreta. Sólo esa propuesta —aprobada separadamente— debe convertirse después en cambios de código.

**Entregado por la Fase 1B** en [research/image-delivery/](./research/image-delivery/README.md) para el bloque de imágenes: dossier comparativo completo (contratos, alternativas, mediciones, migración, cortes y gates) con propuesta concreta pendiente de aprobación. Siguen abiertos los bloques de lag físico (IMG-RENDER), curvas de escala, camino de Guardar/review y carreras de respuesta.
