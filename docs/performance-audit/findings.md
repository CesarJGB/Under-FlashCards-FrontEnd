# Hallazgos de rendimiento y estabilidad

## Escala de clasificación

- **Severidad crítica**: puede volver inviable un flujo principal, exceder límites duros o multiplicar datos sin cota.
- **Alta**: impacto visible probable en carga/interacción o coste que crece directamente con colecciones e imágenes.
- **Media**: degradación relevante, carrera o deuda que amplifica otro coste.
- **Baja**: oportunidad acotada, control positivo con riesgo residual o coste de escala secundaria.
- **Confianza confirmada**: el camino existe y se ejecuta según código/build/prueba.
- **Fuerte**: el mecanismo es consistente con el síntoma, pero falta medición del entorno.
- **Pendiente de medición**: no se puede atribuir impacto sin instrumentación.

La severidad evalúa riesgo, no sustituye una medición. Una conducta puede estar confirmada y su duración seguir sin medirse.

## Tabla maestra

| ID | Área | Severidad | Confianza | Evidencia | Síntoma | Causa probable | Impacto | Reproducción | Dirección futura |
|---|---|---|---|---|---|---|---|---|---|
| PERF-LOAD-001 | Carga inicial | Alta | Confirmada | `App.jsx:8-22,253-339`; build: main 900.65 kB/246.33 gzip | arranque y parseo lentos, especialmente móvil | secciones principales, Library/editor/sesiones/IA en entry estático | red, parse/compile y memoria inicial | build y analizar entry; abrir frío con cobertura | medir cobertura y fronteras candidatas de carga diferida |
| PERF-LOAD-002 | Velocidad percibida | Media | Confirmada | `App.jsx:26,398-409,474-488` | dashboard oculto aunque ya pueda estar listo | overlay con 2,500 ms configurados tras login | latencia percibida mínima artificial | login con CPU/red rápida y traza visual | definir criterio basado en readiness tras medir |
| PERF-NET-001 | Red/App/Library | Alta | Confirmada | `App.jsx:121-129`; `HomeSection.jsx:487-490`; `LibrarySection.jsx:31-34` | cargas repetidas, parpadeos/uso de datos | tres propietarios llaman los mismos loaders | backend, red, JSON, estado y almacenamiento duplicados | entrar a dashboard/Home/Library con Network abierto | deduplicar ownership/revalidación en diseño futuro |
| PERF-CACHE-001 | Caché/persistencia | Alta | Confirmada | `App.jsx:81-119`; `safeLocalStorage.js` | poca reutilización HTTP, pausas y datos viejos silenciosos | timestamp por petición + colecciones completas en almacenamiento síncrono sin TTL | transferencia, stringify/parse, cuota y carreras | observar URLs únicas y tamaño de claves | investigar caché versionada, payloads ligeros y política HTTP |
| PERF-CACHE-002 | Caché/estabilidad | Media | Confirmada | `frontend/src/lib/safeLocalStorage.js`, funciones `getJSON`/`setJSON` | tras fallo de cuota puede reaparecer dato antiguo o faltar el último | el Map se escribe, pero no se lee si la clave falta o contiene JSON antiguo válido | falsa sensación de fallback, obsolescencia y retención en memoria | forzar cuota con/sin valor anterior y remontar consumidor | definir semántica y pruebas del fallback antes de depender de él |
| PERF-LIB-001 | Library/API | Alta | Confirmada | `deckController.getDecks`; `Deck.serialize`; `useLibraryState:146-188` | Library empeora con mazos propios y globales | endpoint general sin página/proyección; frontend filtra colección completa | bytes, consulta, heap y CPU local sin cota | comparar 10/100/500 mazos | medir filtros de servidor, páginas y resumen de mazo |
| PERF-LIB-002 | Library/render | Media | Confirmada | `useLibraryState:27-37,179-188`; `TemasLevel:27-28,61-62`; `SubtemasLevel:43-44,75-76` | navegación/ordenamiento se degrada | `filter` de mazos dentro de `map` de carpetas | O(carpetas × mazos), repetido por render | perfil con sort “cantidad” y jerarquía grande | precomputar conteos/índices sólo tras medir |
| PERF-LIB-003 | Library/asincronía | Media | Fuerte | `useLibraryState:80-144` | nivel o spinner puede mostrar respuesta anterior | sin abort/token de secuencia y bandera compartida | estado fuera de orden, trabajo desperdiciado | alternar rápido materias/parciales con latencia | instrumentar request IDs; diseñar cancelación |
| PERF-LIB-004 | Library/caché | Baja | Confirmada | `useLibraryState:57-58`; montaje condicional de Library | reapertura repite temas/subtemas | Maps viven sólo durante el montaje y carecen de invalidación | red adicional; posible obsolescencia durante montaje | salir/volver a Library y comparar Network | definir alcance/TTL/invalidation antes de ampliar caché |
| PERF-IMG-001 | Imágenes/datos | Crítica | Confirmada | `Deck.js:11-12,38-66`; `Flashcard.js:58-79`; [baseline experimental](./experiments/image-baseline/base64-payload-results.md) | respuestas/heap/storage se disparan; riesgo de límites duros | Data URL en Mongo; fondo compartido expandido en cada tarjeta; fondos también en lista de mazos | multiplicación por n en red/parse/estado y crecimiento documental | matriz sintética 20/100/500/1000 ejecutada; falta tráfico real | comparar referencias/URLs/thumbnails como opciones; `IMG-DATA = GO` |
| PERF-IMG-002 | Ingesta de imágenes | Alta | Confirmada | `DeckModal:7-42`; `FlashcardCreator:245-293` | guardar/mostrar imágenes grandes consume CPU/memoria/red | portada/fondo sin resize; contentImage decodifica y canvas en main thread, sólo limita ancho | picos de heap, long tasks, JSON grande | seleccionar archivos de resoluciones controladas | fijar presupuesto y experimentar procesamiento fuera del camino crítico |
| PERF-IMG-003 | Grid/hover | Alta | Fuerte | `FlashcardGrid:12-42,123-202`; [baseline experimental](./experiments/image-baseline/grid-interaction-results.md) | lag reproducido parcialmente en headless; falta iPhone reportado | grid completo + fondos CSS + overlays + sombra; presión de superficies | cantidad, Data URL, sombra y overlay contribuyen; causa física no cerrada | repetir guía en iPhone y capturar Timelines | `IMG-RENDER = PARTIAL`; no retirar sombra ni cambiar arquitectura aún |
| PERF-IMG-004 | Render de imágenes | Media | Confirmada | búsquedas de `<img>`; `CardFace`, `ReviewMode`, `SessionPlayer` | descarga/decodificación temprana o layout inestable | fondos CSS sin lazy/async; `<img>` sin dimensiones y sin atributos explícitos | trabajo fuera de viewport y posibles shifts | traza de carga/decode con colección larga | investigar thumbnail, dimensiones y prioridad por superficie |
| PERF-DECK-001 | Apertura de mazo | Alta | Confirmada | `DeckInterior:59-84`; `FlashcardCollection:48-66`; `FlashcardGrid:123-202` | mazos grandes tardan y bloquean interacción | API y DOM entregan/montan todas las tarjetas; sin página/virtualización/caché | O(n) bytes/nodos y O(n log n) sort | matriz 20/100/500/1000, reapertura | medir límite útil; investigar carga incremental y ventana |
| PERF-DECK-002 | Estudio/sesiones | Alta | Confirmada | `DeckInterior:78-84`; `SessionPlayer:370-390,425-462` | abrir sesión descarga la colección dos veces | carga incondicional de DeckInterior + `all-cards` de SessionPlayer | red/JSON/imágenes y DB duplicados | abrir directamente continuous/normal review | definir un propietario y contrato por sesión después de medir |
| PERF-CARD-001 | Creación/edición | Alta | Confirmada | `DeckInterior:184-271`; callbacks de `LibrarySection` | “Guardar” bloquea siguiente entrada y genera tráfico secundario | espera servidor antes de reset; luego recarga mazos y materias completos | latencia crítica + red/storage fuera del mazo | guardar sucesivamente con latencia inyectada | separar métricas; explorar ACK/actualización focalizada/optimista |
| PERF-CARD-002 | Backend/creación | Alta | Confirmada | `flashcardController:7-19` y create/update | guardado con fondo escala con tamaño del Deck | lecturas/saves secuenciales de Deck y relectura para serializar | 2–5 operaciones DB y documentos con imágenes | comparar sin fondo/existente/nuevo | perfilar DB y evaluar atomicidad/proyección/repuesta mínima |
| PERF-CARD-003 | Escritura/editor | Media | Pendiente de medición | estado controlado en `DeckInterior`/`FlashcardCreator`/`ManualCardEditorModal` | escritura o preview puede perder fluidez en móvil | estado elevado rerenderiza subárbol; imagen usa canvas principal | commits React/IME y long tasks | React Profiler + dispositivo/teclado real | conservar V2; localizar commits costosos antes de cambiar ownership |
| PERF-API-001 | API/serialización | Alta | Confirmada | controladores sin projection/lean; `Deck.serialize`; `Materia.serialize` | payload y materialización mayores de lo necesario | documentos completos y serializadores de uso general para vistas resumen | DB→Node→JSON→cliente transporta campos pesados | medir response bytes/campos usados por endpoint | diseñar contratos de resumen sólo tras inventario de consumidores |
| PERF-API-002 | MongoDB/índices | Media | Fuerte | índices en `Deck.js`, `Flashcard.js`; queries/sorts reales | consultas pueden degradarse con cardinalidad | índices simples no cubren filtros globales+sort o deck+createdAt | docs examinados/sort en memoria DB potencial | `explain(executionStats)` con 10/100/500/1000 | validar selectividad antes de crear índices |
| PERF-REVIEW-001 | Repaso/backend | Alta | Confirmada | `reviewController.registerReview`; cola/cascada de mastery | respuestas rápidas crean backlog; cerrar sesión puede esperar | por respuesta se relee todas las tarjetas, guarda Deck y propaga relaciones; cola sólo en proceso | DB/CPU O(respuestas × tarjetas), latencia de flush, escalado multi-instancia | sesión larga sobre mazo grande y profundidad de cola | medir cola y consultas; investigar cálculo incremental/idempotencia |
| PERF-SERVER-001 | Servidor/transporte | Media | Confirmada | `backend/src/server.js:65-66`; dependencias/middleware | bodies enormes aceptados; compresión efectiva incierta | límite JSON/urlencoded 50 MB; no middleware de compresión en app | heap/parse/GC, abuso accidental, ancho de banda | requests de tamaños controlados; inspeccionar cabeceras reales | presupuestos por endpoint y verificar compresión del edge |
| PERF-ERR-001 | Estabilidad | Media | Confirmada | catches de loaders; refrescos sin secuencia | UI conserva datos viejos o salta hacia atrás sin explicación | errores silenciosos y respuestas concurrentes reemplazan estado/cache | calidad percibida, reintentos manuales y trabajo repetido | simular 500/latencia/reordenamiento | observabilidad, error visible y control de versión/cancelación |
| PERF-CONTRACT-001 | Importación/calidad | Media | Confirmada | frontend incluye `contentImage`; bulk controller asigna `contentImage: ''` | imagen importada desaparece silenciosamente | divergencia de contrato en creación por lote | pérdida de datos y repetición de trabajo del usuario | importar tarjeta con contentImage en entorno aislado | decidir contrato y añadir prueba en fase correctiva |
| PERF-TEST-001 | Calidad técnica | Media | Confirmada | `npm test` backend; `aiService.test.js`; `deckRecovery.test.js` | cambios de rendimiento no tienen baseline totalmente confiable | expectativas de modelo/cantidad/reintento/HTTP divergieron | riesgo de regresión y diagnóstico ambiguo | ejecutar suite en HEAD auditado | resolver intención de tests/contrato antes de cambios sensibles |
| PERF-MOBILE-001 | Móvil/Safari | Media | Pendiente de medición | drift tras docs V2; fuente externa; superficies con imágenes | jank, foco/IME, rebote o presión de memoria en iPhone | motor gráfico/memoria/red y cambios posteriores a evidencia física | experiencia en dispositivos de menor potencia | matriz Safari real y Android gama media | perfilar sin reabrir defectos V2 ya retirados |
| PERF-PDF-001 | PDF | Baja | Confirmada | chunks Vite; `usePdfExport`; utilidades de imágenes/workers | export puede elevar memoria bajo demanda, no arranque | chunks/workers grandes y copia de payload; límites/caché ya presentes | pico acotado durante export | exportar escenarios con imágenes y registrar heap | mantener división/caché; medir límites antes de alterarlos |

## Desarrollo de hallazgos prioritarios

### PERF-IMG-001 — expansión de imágenes compartidas

**Flujo activador.** El creador envía `bgImage` como Data URL. `getOrCreateBgIndex()` busca el Deck, guarda la cadena una sola vez en `cardBackgrounds` y la Flashcard conserva el índice. Al responder, `Flashcard.serialize(deck)` sustituye el índice por la cadena completa. `getCardsByDeck` aplica ese serializador a todas las tarjetas. Separadamente, `getDecks` llama `Deck.serialize()`, que incluye el array completo de fondos, y App persiste toda la respuesta.

**Coste y síntoma.** Si n tarjetas comparten una cadena de B bytes, el documento Deck mantiene aproximadamente B para el fondo, pero la respuesta de tarjetas contiene aproximadamente n×B antes de compresión. El parseo genera n propiedades; la representación exacta de heap y la posible deduplicación de strings no se asumen. La lista de mazos además transporta B aunque `DeckCard` no use los fondos. El resultado puede ser carga lenta, pausas al parsear/persistir, presión de memoria y cuota. Data URL tampoco aporta una URL de recurso reutilizable por la caché HTTP.

**Escala.** Empeora con número de tarjetas, fondos únicos, resolución/bytes de cada fondo, reaperturas y sesiones duplicadas. `Deck.cardBackgrounds` y `coverImage` hacen crecer el documento MongoDB; la proximidad real al límite documental requiere medir BSON real.

**Reproducción/medición.** La [Fase 1A](./experiments/image-baseline/base64-payload-results.md) ejecutó matrices sintéticas de 20/100/500/1000 tarjetas y 10/100/500 mazos. Como caso límite controlado, 1000 tarjetas con un fondo grande compartido produjeron 911.85 MiB JSON modelados, 686.79 MiB gzip medidos sobre el modelo y 910.57 MiB repetidos. No es tráfico productivo ni latencia de MongoDB; esos puntos siguen pendientes.

**Direcciones, dependencias y regresiones.** Investigar contratos con referencias, recursos cacheables, thumbnails o tablas de fondos, y separar resumen/detalle. Cualquier opción afecta export/import, offline, permisos, limpieza de objetos, CORS, PDF y compatibilidad de datos antiguos. No seleccionar una aquí.

**Resolución en la [Fase 1B](./research/image-delivery/README.md).** El inventario de consumidores y la comparación de alternativas confirmaron que el cuello es el contrato de salida, no el almacenamiento: `cardBackgrounds` no tiene ningún consumidor en el frontend productivo y `Flashcard.serialize` expande el fondo por tarjeta. La Fase 1B recomienda la Alternativa A (diccionario de fondos + `bgImageIndex` en las respuestas y resumen de mazo sin `cardBackgrounds`), cuantificada: 1000 tarjetas con fondo grande compartido pasan de 911.87 MiB JSON / 686.81 MiB gzip a 0.375 MiB / 0.008 MiB (−99.96%), y la lista de 500 mazos con portada + fondos de 83.62 MiB a 0.22 MiB (−99.7%), sin migración de datos ni infraestructura. La implementación sigue sin autorizarse; los cortes, presupuestos y gates están en [research/image-delivery/implementation-cuts.md](./research/image-delivery/implementation-cuts.md) y [implementation-readiness.md](./research/image-delivery/implementation-readiness.md).

### PERF-IMG-003 — lag de hover/interacción con fondos

**Confirmado.** `FlashcardGrid` monta todos los cards, calcula objetos `style` y parsea estilos por cada uno en cada render. Cada artículo con fondo usa `background-image`, un overlay negro y `transition-shadow hover:shadow-md`. Un cambio como abrir acciones o preview actualiza estado en el grid y vuelve a recorrer toda la lista. `DeckCard` usa un patrón de fondo CSS similar.

**No confirmado.** El pseudoestado hover por sí solo no hace un `setState` React, así que la creación de objetos `style` no explica directamente cada movimiento del puntero. La [Fase 1A](./experiments/image-baseline/grid-interaction-results.md) sí midió que sombra y overlay contribuyen a Paint/Raster en Chromium, pero no que alguno sea la causa única. Promoción de capas, deduplicación/redecodificación de superficies y el comportamiento del iPhone/Safari físico permanecen pendientes.

**Hipótesis fuerte.** En una cuadrícula grande, cambiar sombra sobre elementos con imagen y overlay puede aumentar pintura/composición; una imagen sobredimensionada aumenta decode/raster/memoria; el payload repetido y los objetos completos pueden elevar presión de heap/GC. El dispositivo reportado, Safari y número de tarjetas pueden decidir qué factor domina.

**Reproducción.** El harness ya repitió cinco veces grid real, hover automatizado, scroll, menú, memoria y trazas Chromium/WebKit/Firefox. A 1000 tarjetas, el DOM de producción fue 15,011 nodos sin imagen y 16,011 con fondo. Sigue pendiente ejecutar la guía física en iPhone y capturar Safari Timelines, composición/GPU y frames directos; la confianza permanece Fuerte.

**Riesgos de una futura corrección.** Quitar efectos sin aislarlos puede no resolver el cuello; memoizar puede conservar cadenas grandes; virtualizar puede romper foco, selección, altura/scroll y menús; thumbnails pueden alterar fidelidad. Los criterios se definen en el plan de medición.

### PERF-DECK-001 — apertura sin límites

**Flujo.** `DeckInterior` descarga un array completo. El backend ejecuta `Flashcard.find({deckId}).sort(...)`, carga el Deck y serializa uno a uno. `FlashcardCollection` filtra/ordena; `FlashcardGrid` crea todos los elementos.

**Coste.** No hay corte entre tiempo de red, consulta, JSON, state update y render. En datos sin imágenes el crecimiento sigue siendo lineal; con fondos repetidos o `contentImage` domina el tamaño de strings y decode. Reabrir no reutiliza cards.

**Medición disponible.** Ninguna cifra de 20/100/500/1000. El código confirma falta de página/caché/ventana. La prueba futura debe registrar `Server-Timing` o marcas equivalentes para separar backend y navegador.

**Direcciones.** Evaluar primero la semántica: editor puede necesitar conteo/lista reciente, grid requiere navegación/búsqueda, ReviewMode puede necesitar un conjunto, sesión ya tiene otro contrato. Una única paginación genérica podría romper búsqueda, orden, exportación y repaso; investigar contratos por consumidor.

### PERF-NET-001, PERF-CACHE-001 y PERF-CACHE-002 — duplicación y persistencia

App, Home y Library son propietarios simultáneos de refresco. En producción no interviene StrictMode para crear esta duplicación: los efectos existen en componentes distintos. El timestamp también evita que el navegador reutilice normalmente una respuesta por URL. `safeLocalStorage.setJSON` hace `JSON.stringify` síncrono de toda la colección, y su fallback Map no posee evicción. Además, `getJSON` retorna `null` inmediatamente si no existe valor persistido y sólo consulta el Map dentro del catch de parseo; si la cuota falla con una clave antigua válida, seguirá leyendo la copia antigua. Los catch de App no actualizan error ni fecha.

Esto combina cuatro trabajos: petición, serialización del servidor, parseo/setState y persistencia. Si dos solicitudes se solapan, no hay request ID; la respuesta anterior puede ganar. La bandera de carga compartida se libera en el `finally` de cualquiera de las peticiones.

Para reproducir, activar throttling, entrar a Home y cambiar a Library; agrupar Network por pathname ignorando `t`, registrar iniciador y orden de respuesta, y instrumentar `JSON.stringify`. Medir por separado caché fría, reentrada y datos persistidos. La solución futura requiere definir dueño, política de frescura y forma de resumen; “quitar el timestamp” aislado puede introducir obsolescencia si el servidor no tiene una revalidación correcta.

### PERF-LIB-001 y PERF-LIB-002 — jerarquía académica

El endpoint general permite materia/parcial/tema/subtema, pero la carga de App no envía filtros. La colección local hace que navegar por una biblioteca pequeña sea inmediato y evita una petición por nivel; ésa es una intención válida. La oportunidad aparece al crecer: el usuario paga al entrar por todos los mazos propios y todos los globales visibles, por sus portadas/fondos y por conteos agregados.

Los filtros derivados recorren el array; al ordenar por cantidad y al pintar temas/subtemas se vuelve a ejecutar `filter` para cada carpeta. Con F carpetas y D mazos el patrón es O(F×D). No se midió el punto de quiebre. Debe perfilarse con 10/100/500 mazos, jerarquía ancha/profunda y sort por nombre/fecha/cantidad para separar el coste del algoritmo del render.

Una futura indexación local de relaciones podría acelerar pero debe invalidarse en crear/mover/eliminar/importar y preservar “sin clasificar”. Una futura consulta de servidor reduce bytes pero cambia navegación, búsqueda global y offline. Ambas son opciones, no decisión.

### PERF-LIB-003 y PERF-ERR-001 — orden de respuestas

Las cargas de temas/subtemas cambian estados compartidos sin abortar ni verificar que la clave siga activa. Los refrescos globales posteriores a mutaciones tampoco se esperan ni secuencian. Con latencia variable, una respuesta vieja puede sustituir una nueva y persistirse. Esto es una carrera estructural fuerte; no se observó una traza real que confirme frecuencia.

Reproducción: interceptar dos claves con latencias invertidas, navegar A→B y verificar contenido/breadcrumb/loading. Para globales, hacer dos guardados con respuestas reordenadas y comparar contador/almacenamiento. La futura corrección debe preservar caché por clave y distinguir cancelación de error visible.

### PERF-CARD-001 y PERF-CARD-002 — camino crítico de Guardar

El usuario pulsa Guardar después de que cualquier `contentImage` ya haya sido procesado. El cliente envía JSON y espera resultado antes de limpiar. El controlador puede leer/guardar el Deck por fondo, crea/actualiza la tarjeta y vuelve a leer el Deck para expandir fondo. Sólo entonces el cliente inserta/mappea y permite la siguiente tarjeta limpia. Finalmente dispara mazos/materias completos.

Para separar la latencia se requieren marcas:

1. `save.click` → inicio de fetch: React/serialización previa.
2. upload completo → handler: red de subida/proxy.
3. handler → cada operación Mongo: backend/DB.
4. último query → primer byte: serialización/respuesta.
5. primer byte → JSON listo: red/parse.
6. JSON listo → formulario limpio/paint: estado/render.
7. refrescos secundarios: red, setState y storage fuera del ACK.

No se midió ningún tramo. Una actualización optimista podría reducir espera percibida, pero introduce IDs temporales, rollback, fondo canónico, duplicados y conflictos; una respuesta mínima puede afectar consumidores que esperan `bgImage`. Deben validarse contratos antes.

### PERF-IMG-002 y PERF-CARD-003 — procesamiento y escritura

Portadas y fondos sólo validan tamaño de archivo; no dimensiones, formato efectivo, resize ni calidad. ContentImage crea un `Image`, decodifica el archivo completo y dibuja en canvas en el hilo principal antes de JPEG 0.7 y ancho máximo 600. Limitar ancho de salida no limita los megapíxeles decodificados de entrada. No hay `onerror` explícito para reader/image en ese camino.

Durante escritura, el estado de pregunta/respuesta pertenece al árbol de DeckInterior y se propaga desde el editor manual. Es razonable inferir commits React por pulsación, pero no su coste ni una regresión V2. Las unitarias V2 pasan; hacen falta React Profiler, Long Animation Frames y dispositivo con IME real.

Direcciones futuras incluyen presupuestos de bytes/píxeles, validación, procesamiento diferido/worker y aislamiento de renders, sujetos a UX de preview, EXIF/orientación, accesibilidad, Undo/Redo y compatibilidad Safari.

### PERF-API-001 y PERF-API-002 — contratos y consultas

Los endpoints de resumen materializan documentos Mongoose completos. `Deck.serialize` siempre añade fondos/portada y `Materia.serialize` puede añadir criterios de evaluación aunque Home/Library sólo necesiten identidad y conteos. `getDecks` agrega conteos después de leer documentos. No hay `lean()`/projection en esos caminos.

Los índices presentes ayudan a filtros simples, pero no demuestran cobertura de la consulta OR de visibilidad global con sort ni de `deckId` + sort temporal. Sólo un `explain` con distribución real puede establecer COLLSCAN, docs examinados y memoria de sort. Crear índices “obvios” sin medir eleva coste de escritura y almacenamiento.

La investigación siguiente debe producir un mapa campo→consumidor y response byte attribution antes de proponer contratos summary/detail. Export, bloqueo, metadata, calendario y permisos son dependencias.

### PERF-REVIEW-001 — cascada de mastery

Registrar una respuesta actualiza la tarjeta, crea `ReviewLog` e intenta actualizar la sesión. Luego encola por usuario una cascada. Esa cascada carga todas las tarjetas del Deck, recalcula, guarda el documento Deck —incluidos sus fondos— y puede cargar/actualizar mazos hermanos y niveles académicos. El patrón se repite por respuesta.

La cola evita carreras dentro de un proceso, una intención correcta. Sin embargo es un `Map` de Promises local al proceso: no coordina varias instancias y no se observó eliminación de claves tras resolver. Una sesión rápida sobre 1000 tarjetas puede generar backlog; el cierre que espera flush puede materializar la demora.

Medir: profundidad/edad de cola, queries y bytes BSON por respuesta, duración p50/p95/p99, flush y heap del Map; repetir con una y varias instancias en entorno controlado. Cálculo incremental, batch o persistencia de cola son opciones que requieren reglas de consistencia y recuperación, no decisiones de esta fase.

### PERF-SERVER-001 — body y compresión

Express acepta JSON y urlencoded de hasta 50 MB. Es coherente con imágenes embebidas/importación, pero permite que una petición individual reserve y parsee un cuerpo enorme. No se encontró middleware `compression` en la aplicación. Esto no prueba que producción no comprima: CDN/proxy puede hacerlo y debe verificarse con cabeceras reales.

La medición debe comparar `Content-Length`/`encodedDataLength`, Content-Encoding, CPU Node y heap para requests/responses con Data URL. Reducir el límite sin presupuestos por endpoint rompería importaciones legítimas; debe estudiarse por contrato.

### PERF-CONTRACT-001 — importación de contentImage

`DeckInterior` mapea `contentImage` al lote, pero el controlador bulk construye las Flashcards con `contentImage: ''`. El dato se pierde sin error. No es una causa de lentitud, pero afecta calidad/estabilidad y puede hacer que el usuario repita importación o edición. La futura fase debe confirmar si la exclusión es intencional por presupuesto de payload o un bug, actualizar contrato/prueba y considerar datos existentes.

### PERF-TEST-001 — drift de pruebas backend

La suite backend terminó con código 1. `aiService.test.js` tiene dos expectativas desactualizadas respecto al modelo y cantidad pedida. `deckRecovery.test.js` falla sus tres casos: dos esperan reintentos que no ocurren y uno espera 201 frente a 400. No se corrigieron.

Esto no prueba una degradación de rendimiento, pero reduce confianza para modificar IA/recuperación/importación, áreas con cuerpos o procesamiento grandes. La fase futura debe decidir si cambió el contrato o la implementación antes de usar la suite como gate.

### PERF-MOBILE-001 — evidencia física pendiente

La documentación de plataforma registra la migración V2 y evita repetir problemas ya retirados. Desde su último HEAD documental hubo cambios en App, editor, acciones, overlays, PDF y CSS; las pruebas unitarias V2 siguen verdes. No existe evidencia actual de Safari real para pintura de fondos, teclado/IME, memoria o elastic bounce.

La investigación debe usar iPhone/Safari y un Android de gama media, no sólo emulación. Debe observar memoria/terminaciones de pestaña, interacción táctil (donde hover no equivale a escritorio), scroll, foco y teclado con escenarios de imagen. No se declara regresión hasta obtener esa evidencia.

### PERF-PDF-001 — coste diferido y controles positivos

El build separa PDF del entry inicial. Las utilidades cachean por `source`, usan `createImageBitmap`/`OffscreenCanvas` cuando están disponibles y cierran bitmaps. También existen presupuestos/estimadores; `estimateDeckImageWeight` cuenta el fondo repetido por tarjeta, consistente con la respuesta serializada actual.

El worker principal es grande y el payload de strings se copia al worker; exportar muchas imágenes puede elevar el pico de memoria. Esto sólo afecta el flujo bajo demanda y debe medirse antes de alterar un diseño que ya contiene mitigaciones. La regresión a evitar es mover PDF al entry o perder deduplicación/cierre de recursos.

## Recuento

| Severidad | Cantidad |
|---|---:|
| Crítica | 1 |
| Alta | 12 |
| Media | 12 |
| Baja | 2 |
| **Total** | **27** |
