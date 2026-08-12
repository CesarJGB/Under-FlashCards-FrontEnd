# Plan reproducible de medición

## Propósito

Este plan convierte los hallazgos estáticos en experimentos falsables. No contiene tiempos inventados. Los únicos valores ya medidos son los tamaños del build y resultados de pruebas registrados en [README.md](./README.md).

## Métricas base

### Usuario y navegador

| Métrica | Punto de captura | Por qué |
|---|---|---|
| FCP/LCP | navegación fría y login→dashboard | velocidad visual inicial |
| tiempo a contenido útil | Library con carpetas visibles; mazo con primeras cards visibles | overlay o skeleton puede ocultar disponibilidad real |
| INP y duración de evento | hover/tap, abrir menú, escribir, Guardar | respuesta interactiva |
| Long Tasks/Long Animation Frames | carga, canvas, parseo, grid | bloqueo de hilo principal |
| scripting/style/layout/paint/composite | Performance/Timelines | atribuir el lag, no adivinarlo |
| frames perdidos/FPS | scroll e interacción de grid | fluidez sostenida |
| commits React y duración | Profiler | renders en cascada/por escritura |
| nodos DOM | grid y SearchResults | crecimiento por colección |
| heap JS y memoria de proceso/tab | antes/después/cierre/reapertura | cadenas, arrays, cachés y GC |
| imágenes decodificadas/layers | DevTools/Safari | rasterización y composición |
| duración de `JSON.parse/stringify` | marcas locales en harness | coste de payload/cache |
| bytes de localStorage y errores | por clave/navegador | cuota y pausas síncronas |

### Red/API

| Métrica | Separación requerida |
|---|---|
| request/response body | bytes sin comprimir y transferidos; por endpoint |
| TTFB | DNS/TLS si aplica, espera de servidor, red simulada |
| descarga y parseo | no mezclar con TTFB |
| número de requests | agrupar ignorando `t`; registrar initiator |
| caché | cold/warm, status/headers, `Content-Encoding`, ETag/age |
| canceladas/fuera de orden | request ID, clave académica y momento de commit de estado |
| campos usados | byte attribution de cover/fondos/content/metadata |

### Backend y MongoDB

| Métrica | Instrumento esperado |
|---|---|
| handler total y serialización | marcas de alta resolución/APM/`Server-Timing` en entorno de investigación |
| duración y conteo de queries | Mongoose debug/APM/profiler de Mongo aislado |
| `docsExamined`, `keysExamined`, sort y plan | `explain("executionStats")` |
| bytes BSON/documento | `$bsonSize`/herramienta equivalente en dataset sintético |
| aggregate de conteos | tiempo y memoria por cardinalidad |
| heap/CPU/event loop Node | profiler y event-loop delay |
| cola de reviews | profundidad, edad máxima, flush, claves retenidas |
| escritura | bytes y latencia de Deck con 0/1/muchos fondos |

## Entornos mínimos

1. Escritorio de referencia: Chromium estable, CPU sin throttling y luego 4×.
2. WebKit de automatización para repetibilidad, sin tratarlo como sustituto de iPhone.
3. iPhone físico/Safari soportado, con inspector remoto.
4. Android físico de gama media, Chrome, memoria/CPU representativas.
5. Backend local/cercano para baseline y entorno aislado con latencia inyectada.
6. MongoDB con datos sintéticos no productivos y planes habilitados.

Registrar versión de navegador/SO, CPU, RAM, viewport, DPR, batería/thermal state, commit, origen de datos, caché y compresión en cada resultado.

## Dataset sintético controlado

Usar IDs reproducibles y generador externo al commit de aplicación o fixture desechable en entorno aislado. No usar producción. Mantener constante longitud media de pregunta/respuesta y jerarquía salvo la variable estudiada.

### Perfiles de imagen

| Código | Composición | Datos transferidos esperados | Trabajo del navegador | Trabajo backend | Riesgo esperado |
|---|---|---|---|---|---|
| I0 | sin imágenes | texto/estilos/metadata | parse + DOM, sin raster | queries/serialización base | baseline |
| I1 | portada únicamente | portada en cada Deck/lista | decode/background de DeckCards; storage | documento/JSON de Deck | Library/red/cache |
| I2 | un fondo compartido por todas las cards | `bgImage` repetido n veces en cards; fondo también en Deck list | parse, fondos CSS, posible superficie compartida | leer Deck y expandir por card | multiplicación principal |
| I3 | fondos diferentes | n Data URL distintas + array del Deck | n decodes/superficies, alto heap | documento Deck grande, strings/indexOf/save | límite documental/memoria |
| I4 | contentImage en 10% | cadena en algunas cards | parse; decode al mostrar/preview | Flashcard/JSON mayores | picos focalizados |
| I5 | contentImage en 80% | cadena en mayoría | heap/parse/decode en estudio | documentos/respuestas grandes | sesión/apertura severa |
| I6 | I2 + contentImage 80% | fondos repetidos + contenido | costes combinados | serialización/queries combinadas | peor caso plausible compartido |

Para I2/I3 usar al menos dos resoluciones con bytes controlados: una cercana al tamaño de visualización y otra sobredimensionada. Registrar formato, ancho, alto, bytes binarios y longitud Data URL; no comparar archivos distintos sin controlar esas variables.

## Matriz A — cantidad de mazos

Cada fila se ejecuta con I0 e I1 como mínimo; añadir mazos con `cardBackgrounds` I2/I3 para medir el sobrecoste indebido en el resumen. Repetir red/dispositivo según la matriz C.

| Escenario | Endpoint | Datos transferidos | Navegador | Backend | Métrica necesaria | Riesgo esperado |
|---|---|---|---|---|---|---|
| D10-I0/I1 | `GET /api/decks/:userId`; materias | 10 Deck serializados + conteos + imágenes del perfil | parse, state, 10 cards, storage | find/sort + aggregate | TTFB, bytes, FCP/Library useful, stringify | bajo/baseline |
| D100-I0/I1 | mismos | 100 Deck completos | filtros/sorts/render/storage | más docs y aggregate | curva bytes/CPU/commits/heap | medio; duplicación visible |
| D500-I0/I1 | mismos | 500 propios/globales visibles | lista, búsquedas, O(F×D), storage/cuota | consulta OR/sort/aggregate | long tasks, docs examined, quota | alto |
| D10-I2/I3 | mismos | fondos de los Deck aunque grid no se abrió | parse/storage de campos no usados | documentos más pesados | byte attribution a backgrounds | desperdicio contractual |
| D100-I2/I3 | mismos | 100 arrays de fondos | heap/stringify | materialización/serialización | bytes únicos/repetidos, heap | alto |
| D500-I2/I3 | mismos | 500 arrays de fondos | cuota/GC/lista | Node heap/response | failure rate, event loop, storage | crítico potencial |

Distribuir los Deck entre materias/parciales/temas/subtemas y catálogo global. Ejecutar orden nombre/fecha/cantidad, búsqueda y navegación. Separar “todos globales visibles” de “sólo usuario” para cuantificar el OR del endpoint.

## Matriz B — cantidad de tarjetas por mazo

Cada fila debe ejecutarse con I0, I2, I3, I4, I5 e I6. La columna de datos especifica la forma, no un tamaño inventado.

| Escenario | Endpoint | Datos transferidos | Navegador | Backend | Métrica necesaria | Riesgo esperado |
|---|---|---|---|---|---|---|
| C20-I* | `GET /flashcards/deck/:id` | 20 tarjetas; imágenes según perfil | parse/filter/sort/20 artículos | Deck.find + Flashcard.find/sort + serialize | útil, INP, bytes, heap | baseline funcional |
| C100-I* | mismo | 100 cards, fondo repetido 100× en I2 | 100 DOM/backgrounds; hover/scroll | serialize 100 | paint/composite, React commits, TTFB | lag probable con imagen grande |
| C500-I* | mismo | 500 cards/imágenes | grid completo, heap/GC, búsqueda/sort | 500 docs/serializadores | long tasks, frames, memory, response | alto |
| C1000-I* | mismo | 1000 cards/imágenes | 1000 artículos; posible presión/terminación móvil | query/JSON grandes | time-to-useful, failure, heap, event loop | muy alto; límite práctico pendiente |
| S20-I* | carga anterior + `GET /decks/:id/all-cards` | dos arrays completos | parse/estado duplicado | dos caminos de consulta | request count/bytes/heap | duplicación moderada |
| S100-I* | mismos | dos arrays de 100 | memoria/decodes/lotes | serializa dos veces | delta sesión vs colección | alto con imágenes |
| S500-I* | mismos | dos arrays de 500 | presión/GC | carga y serialización dobles | peak heap, time to first card | alto/muy alto |
| S1000-I* | mismos | dos arrays de 1000 | riesgo de tab jank/kill | response/event loop | failure rate, memory, TTFB | crítico potencial |

Para cada C*: abrir por primera vez, cerrar/reabrir el mismo mazo, buscar, cambiar sort, abrir/cerrar menú, preview y hacer scroll. Para cada S*: iniciar sesión, responder 20/100 tarjetas y cerrar, midiendo cola/flush.

## Matriz C — red y backend

| Perfil | Configuración que debe registrarse | Endpoints | Datos | Navegador | Backend | Métrica/riesgo |
|---|---|---|---|---|---|---|
| R0 rápida | RTT/bandwidth reales del laboratorio, sin throttling | todos | según D/C/I | baseline CPU/render | baseline | separa coste local |
| R1 lenta | preset documentado o parámetros exactos, no sólo nombre | GET lists/cards + POST/PUT | Data URL amplifica subida/bajada | espera/skeleton/carreras | igual R0 | TTFB/download/útil, duplicación más visible |
| R2 backend con latencia | inyectar demora conocida después de recibir body | mismos | iguales | carreras/estado saving | latencia controlada | guardar→siguiente card, orden de respuestas |
| R3 DB degradada | dataset/cardinalidad + plan no óptimo controlado | lists/cards/reviews | iguales | espera | query/aggregate/cascada | docs examined, queue/backlog |

No mezclar R1 y R2 en la primera atribución. Medir subida de POST/PUT por separado de TTFB: un body Base64 grande puede consumir tiempo antes de entrar al handler.

## Matriz D — dispositivos

| Perfil | Escenarios obligatorios | Trabajo a observar | Riesgo esperado |
|---|---|---|---|
| M0 escritorio potente | D10/100/500; C20/100/500/1000; I0/I2/I3/I5 | baseline JS/DOM/paint; cobertura bundle | puede ocultar jank móvil |
| M1 móvil potente | C100/500/1000 I2/I5; sesión; editor+imagen | Safari/Chrome real, memoria, touch, decode | presión de imágenes/hover distinto |
| M2 móvil gama media | D100/500; C100/500 I0/I2/I5; escritura | long tasks, GC, keyboard, tab survival | punto de quiebre temprano |

“Hover” se prueba con puntero en escritorio y con tap/scroll/estado táctil real en móvil; no trasladar automáticamente un evento CSS entre ambos.

## Matriz E — Guardar tarjeta

| Caso | Endpoint/datos | Navegador | Backend/DB | Métricas | Riesgo |
|---|---|---|---|---|---|
| G0 texto sin fondo | POST/PUT pequeño | state/fetch/reset/render | create/update + Deck reread | segmentos click→paint y queries | baseline |
| G1 fondo existente | `bgImage` completa aunque ya exista | stringify/upload | Deck.find/indexOf + card + reread | upload, string compare, DB | coste repetido innecesario potencial |
| G2 fondo nuevo | nuevo Data URL | igual + state | Deck.find/save completo + card + reread | bytes write/BSON/latencia | crece con backgrounds |
| G3 contentImage grande | JPEG resultante + procesamiento previo | decode/canvas/long task + upload | card string/JSON | select→ready y save por separado | jank previo y save largo |
| G4 20 guardados consecutivos | 20 POST + 40 refrescos globales potenciales | reordenamiento/storage/renders | queries + aggregates repetidos | request count, stale overwrite, queue | degradación acumulada |
| G5 bulk 20/100/500 | bulk JSON | stringify/upload/result parse | fondo save + insertMany + serialize | total/per-card, memory, failure | body/respuesta y contrato de imagen |

## Procedimientos

### P1. Carga inicial y composición

1. Fijar commit y limpiar sólo caché del sitio en el entorno de pruebas.
2. Capturar navegación, login y 10 s posteriores con cobertura JS/CSS y Network.
3. Marcar descarga/parse/compile/execute, overlay de 2.5 s, llamadas App/Home y precarga SVG.
4. Repetir caché caliente y entrada directa a Library.
5. Exportar HAR y traza; no incluir tokens/cookies en artefactos compartidos.

### P2. Library

1. Cargar D10/D100/D500 con I0, luego I1/I2.
2. Contar requests agrupados sin query timestamp e identificar initiator.
3. Navegar materia→parcial→tema→subtema, volver, buscar y ordenar.
4. Con interceptación, invertir latencias A/B y registrar si estado/breadcrumb corresponde a la selección actual.
5. Medir React commits, filtros, DOM, bytes, storage y backend aggregate.

### P3. Mazo y hover

1. Ejecutar C20/C100/C500/C1000 con I0 para baseline.
2. Repetir I2 pequeño/grande, I3 e I5.
3. Grabar apertura, scroll, 30 interacciones reproducibles, menú y preview.
4. Activar paint flashing/layers y capturar heap antes, después y tras cerrar.
5. En harness aislado —no producción— cambiar una sola variable: sombra, overlay, tamaño de imagen o ventana de DOM.
6. Clasificar el tiempo por scripting/style/layout/paint/composite/GC.

### P4. Guardar

1. Añadir instrumentación temporal sólo en rama/entorno de investigación posterior.
2. Registrar marcas de los siete segmentos definidos en PERF-CARD-001.
3. Ejecutar G0–G5 en R0/R1/R2.
4. Capturar queries y bytes, y contar recargas globales.
5. Repetir rápidamente para provocar respuestas fuera de orden.

### P5. Mongo/API

1. Construir dataset sintético con distribución documentada.
2. Ejecutar cada query exacta con `explain("executionStats")` sin modificar índices primero.
3. Registrar plan, docs/keys examinados, sort, tiempo, tamaño BSON y respuesta.
4. Medir serialización con y sin campos pesados sólo en un harness comparativo.
5. Perfilar review de 20/100 respuestas sobre C20/C100/C500/C1000 y el flush.

### P6. Safari/móvil

1. Repetir P1/P3/P4 en iPhone físico y M2.
2. Registrar thermal state y reiniciar entre variantes para evitar sesgo.
3. Usar teclado real/virtual, orientación y scroll elástico.
4. Observar memory warning/tab reload y no sólo FPS promedio.
5. Relacionar cualquier fallo con el drift posterior a la documentación V2 antes de declararlo regresión.

## Umbrales propuestos como hipótesis

Estos valores son objetivos iniciales de investigación, no SLAs aprobados ni resultados medidos:

| Área | Hipótesis de aceptación a calibrar |
|---|---|
| Interacción | INP p75 ≤ 200 ms y ausencia de tareas >50 ms durante hover/tap habitual |
| Grid | interacción/scroll sin frames perdidos sostenidos en C100-I2 sobre M2 |
| Guardar texto | formulario listo para la siguiente entrada ≤300 ms p75 en R0 y estado inequívoco en R2 |
| Apertura | primeras tarjetas útiles ≤1 s p75 en R0 para C100-I0 |
| Red | ninguna descarga completa duplicada en una entrada/sesión salvo revalidación demostrada |
| Storage | ningún fallo de cuota en matriz soportada y stringify sin long task |
| Backend | `docsExamined` proporcional al resultado y sin sort bloqueante no acotado |
| Memoria | vuelve cerca del baseline tras cerrar/reabrir; cero terminaciones de tab en matriz soportada |
| Calidad | cero respuestas fuera de orden visibles y suite relevante verde |

Los umbrales deben revisarse con analítica de dispositivos, RTT y tamaño real de biblioteca. No deben usarse para “aprobar” una variante pequeña y extrapolar a 1000 tarjetas.

## Datos faltantes y bloqueos

- distribución real de mazos/tarjetas por usuario y catálogo global;
- bytes/dimensiones/formato p50/p95/máximo de imágenes;
- headers y compresión reales del edge;
- versión/configuración/cardinalidad de MongoDB productivo;
- planes de consultas y tamaño BSON;
- dispositivos soportados y cuota de navegador objetivo;
- telemetría de Web Vitals, errores de cuota, OOM/tab reload y latencia API;
- reproducción exacta del usuario: dispositivo, navegador, cantidad y resolución de fondos;
- dataset legalmente compartible para perfiles;
- criterio de producto sobre offline, búsqueda global y fidelidad de thumbnails;
- suite backend actualmente roja en dos archivos.

Hasta obtenerlos, cualquier cifra de mejora o causa única del hover debe seguir etiquetada como hipótesis.

## Plantilla de resultado

```text
commit / build:
escenario D/C/I/R/M:
fecha y entorno:
caché fría/caliente:
endpoint + status + initiator:
request / response transferido / descomprimido:
TTFB / download / JSON parse:
backend total / queries / explain:
FCP / LCP / útil / INP:
JS / style / layout / paint / composite / GC:
DOM / heap / imágenes/layers:
storage bytes / stringify / error:
resultado funcional y captura:
limitaciones / ruido / número de repeticiones:
clasificación confirmada/fuerte/pendiente actualizada:
```
