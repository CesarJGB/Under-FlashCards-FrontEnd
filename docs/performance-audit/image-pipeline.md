# Pipeline de imágenes

## Resumen

Under Flashcards usa cadenas Data URL como unidad de transporte y persistencia para las imágenes auditadas. Esta decisión simplifica JSON/exportación y permite mostrar una imagen sin un servicio de objetos, pero combina bytes de imagen con documentos, respuestas y estado de aplicación. El fondo compartido está normalizado en MongoDB mediante un índice, pero se desnormaliza de nuevo en cada objeto de la respuesta.

La expansión Base64 es teóricamente cercana a 4/3 de los bytes binarios, más prefijo MIME y JSON. La memoria JavaScript no se calcula a partir de esa fórmula: encoding interno, substrings, deduplicación y superficies decodificadas varían por navegador.

## Inventario

| Tipo | Entrada/transformación | Estado/request | MongoDB | Respuesta | Render principal |
|---|---|---|---|---|---|
| Portada de mazo | `DeckModal`: FileReader Data URL; máximo de archivo 1.5 MB; sin resize | `coverImage` en JSON | `Deck.coverImage: String` | incluida por `Deck.serialize` en lista/detalle/export | `DeckCard` como `background-image` CSS |
| Fondo compartido | `FlashcardCreator`: FileReader Data URL; máximo 700 kB; sin resize | `bgImage` en POST/PUT | cadena única en `Deck.cardBackgrounds`; `Flashcard.bgImageIndex` | `Flashcard.serialize` expande cadena en cada card; `Deck.serialize` incluye array | grid/caras como `background-image` CSS |
| Imagen de contenido | FileReader → `Image` → canvas; ancho máx. 600; JPEG 0.7 | `contentImage` Data URL | `Flashcard.contentImage: String` | incluida por tarjeta | `<img>` en preview/estudio/review/session; grid mantiene string y abre preview |
| Imágenes PDF/export | recibe las cadenas anteriores | payload al worker/render | no cambia persistencia | export JSON conserva fondos una vez + índices; PDF rasteriza | worker/canvas/bitmap bajo demanda |

## 1. Portada de mazo

### Ciclo observado

1. `frontend/src/components/DeckModal.jsx:7-13` usa `FileReader.readAsDataURL()`.
2. `handleFile` (`DeckModal.jsx:28-42`) rechaza archivos mayores de 1.5 MB, pero no redimensiona, recodifica ni limita megapíxeles. El input aporta `accept`, que no sustituye validación efectiva.
3. El resultado completo entra en estado React y en el body JSON (`DeckModal.jsx:44-52`).
4. Create/update del deck asigna la cadena a `Deck.coverImage` (`backend/src/models/Deck.js:11`).
5. `Deck.serialize()` (`Deck.js:38-66`) siempre la devuelve.
6. `getDecks` serializa todos los mazos visibles; App guarda el array completo en estado y `safeLocalStorage`.
7. `DeckCard.jsx:32-39` la usa como `backgroundImage`. Al ser CSS, no hay `loading="lazy"`, `decoding="async"`, `srcset`, tamaño intrínseco ni thumbnail.

### Costes

- El límite se aplica a bytes del archivo original, no a resolución decodificada ni longitud Base64.
- La portada viaja al crear/editar y vuelve en cada lista completa/revalidación.
- Cada URL incluye timestamp, reduciendo reutilización de la respuesta JSON.
- El navegador debe parsear la cadena antes de que CSS pueda resolverla y decodificarla.
- Todos los DeckCards montados referencian su portada, incluso fuera del viewport; la prioridad real de decodificación CSS depende del motor.

### Medición faltante

Bytes medianos/p95 de portadas reales, dimensiones, tiempo de decode, número de portadas simultáneas, heap y comportamiento de CSS backgrounds fuera de viewport en Safari. No se midieron.

## 2. Fondo compartido de tarjetas

### Escritura y normalización

`FlashcardCreator.jsx:245-255` convierte el archivo a Data URL sin resize y conserva la cadena en `bgImage`. El body de POST/PUT incluye esa propiedad. En backend:

```text
bgImage Data URL
  -> getOrCreateBgIndex(deckId, bgImage)
  -> Deck.findById
  -> deck.cardBackgrounds.indexOf(cadena)
  -> push + Deck.save si no existe
  -> Flashcard.bgImageIndex = índice
```

La normalización en documentos de Flashcard es una optimización intencional: no repite el fondo en cada documento. Su búsqueda por igualdad recorre el array de fondos y compara cadenas potencialmente grandes. Guardar un fondo nuevo persiste el Deck completo, que también puede contener portada y otros fondos.

### Lectura y desnormalización

`getCardsByDeck` carga Deck y todas las Flashcards. `Flashcard.serialize(deck)` obtiene `deck.cardBackgrounds[bgImageIndex]` y produce `bgImage` en cada objeto. Para n tarjetas con el mismo fondo, el JSON repite n veces la Data URL. Además, `Deck.serialize()` expone todo `cardBackgrounds` en la colección general de mazos, aunque DeckCard sólo necesita portada.

Esta duplicación está confirmada en el contrato. La compresión HTTP podría comprimir bien repeticiones dentro de una respuesta, si está activa y su ventana/algoritmo las aprovecha; no elimina JSON descomprimido, parseo, propiedades, persistencia de la lista general ni superficies raster. La compresión efectiva de producción no se verificó.

### Exportación/importación

La exportación de mazo conserva `cardBackgrounds` una sola vez y cada Flashcard mantiene `bgImageIndex`, evitando repetir el fondo en el archivo exportado. La importación recrea el Deck y los índices. Es un control positivo que una futura evolución debe preservar.

## 3. Imagen de contenido

### Transformación

`FlashcardCreator.jsx:258-293` realiza:

1. FileReader a Data URL completa.
2. Creación y decodificación de `Image` en navegador.
3. Cálculo de ancho máximo cercano a 600 px conservando proporción.
4. `canvas.drawImage` en el hilo principal.
5. `canvas.toDataURL('image/jpeg', 0.7)`.

La salida está comprimida y redimensionada frente a una imagen ancha, una mitigación real. No obstante, la imagen original completa ya fue leída/decodificada; un archivo de muchos megapíxeles puede producir un pico de memoria y una tarea larga aunque la salida sea pequeña. El código limita ancho, no alto ni píxeles totales, y no expone handlers de error de reader/decode.

### Persistencia y lectura

`Flashcard.contentImage` guarda la cadena directamente. Cada respuesta que incluye la tarjeta la transporta una vez. El grid no pinta la imagen inline: conserva la cadena y muestra una acción “ver imagen”, reduciendo nodos/decodes visibles en la colección. Preview, `CardFace`, `ReviewMode` y `SessionPlayer` sí usan `<img>`.

No se encontraron dimensiones intrínsecas persistidas ni `loading="lazy"`/`decoding="async"` explícitos. En una sesión sólo se muestran pocas tarjetas, por lo que lazy puede ser irrelevante allí; en previews y transiciones deben medirse decode y layout.

### Divergencia de importación

El frontend incluye `contentImage` al formar el lote de importación, pero `flashcardController` asigna `contentImage: ''`. La imagen no llega al documento. Es un problema de contrato/calidad (PERF-CONTRACT-001), no una optimización validada.

## 4. Estudio, repaso, sesiones y PDF

### Estudio y sesión

`DeckInterior` carga todas las tarjetas. En ReviewMode simple se reutiliza ese array. En modos de sesión, `SessionPlayer` hace una segunda petición `all-cards`; ambas respuestas contienen `bgImage` expandido y `contentImage`. `SessionPlayer.allCardsRef` reutiliza el segundo array para lotes, lo cual evita más descargas durante el mismo montaje.

Las caras de tarjeta combinan fondo CSS, overlays y, cuando corresponde, contenido `<img>`. Cada respuesta a una revisión puede también serializar contexto de Deck/tarjeta; el inventario exacto de bytes debe capturarse por endpoint.

### PDF

PDF no pertenece al chunk inicial: Vite produce `PdfExtractor`, renderizadores y workers separados. Las utilidades de imagen:

- cachean por `source`, útil cuando muchas tarjetas comparten una Data URL;
- intentan `createImageBitmap` y `OffscreenCanvas`;
- cierran el bitmap creado;
- aplican límites y emiten advertencia/fallback si una capacidad falta;
- estiman peso contando la repetición del fondo por tarjeta, coherente con el payload actual.

El payload de strings se envía al worker y puede copiarse; el worker principal pesa 2,209.73 kB en el build. El pico real durante exportación con muchas imágenes está pendiente. Estos costes son bajo demanda y no deben confundirse con carga inicial.

## Duplicación por capa

| Capa | Portada | Fondo | ContentImage |
|---|---|---|---|
| Documento MongoDB | una por Deck | una por fondo en Deck | una por Flashcard |
| Documento Flashcard | no | índice numérico | cadena completa |
| Lista de mazos | una por mazo | array completo por mazo | no |
| Respuesta de tarjetas | no | cadena completa por tarjeta | cadena por tarjeta |
| Estado React | lista general incluye portada/fondos | array de cards repite propiedad | array de cards conserva cadena |
| localStorage | lista general incluye portada/fondos | copia completa del Deck | no en caché global observada |
| DOM/CSS | por DeckCard | por tarjeta montada | sólo superficies que lo muestran |
| Caché HTTP de recurso | no hay URL separada | no hay URL separada | no hay URL separada |

## Análisis específico del lag en la cuadrícula

### Causas confirmadas

- `FlashcardGrid` renderiza simultáneamente todas las tarjetas filtradas; no hay paginación/virtualización.
- Para cada tarjeta llama `getCardPresentation`, que vuelve a construir estilos y parsea configuración de fuente.
- Cada tarjeta con fondo recibe un objeto de estilo inline con `backgroundImage`, posición, tamaño y color.
- Cada tarjeta añade overlay negro semitransparente para contraste.
- El artículo usa `shadow-sm transition-shadow hover:shadow-md`.
- Abrir el menú de acciones o el preview cambia estado del grid y vuelve a ejecutar el `.map` completo.
- La respuesta/estado contiene la Data URL repetida en cada objeto con fondo compartido.

### Hipótesis fuertes

- Imágenes de resolución mayor que el tamaño visible elevan decode/raster y memoria sin aportar detalle perceptible.
- Con muchos elementos visibles, cambiar sombras puede requerir pintar/componer más píxeles; el overlay aumenta el trabajo por tarjeta.
- Payload/objetos grandes y superficies decodificadas elevan presión de heap y memoria gráfica, haciendo más probable GC o descarte/recreación de recursos.
- Safari/iPhone de menor memoria puede mostrar el síntoma antes que escritorio.

### Pendiente de perfilado

- Si `hover:shadow-md` es el cuello dominante o sólo un disparador visible.
- Si la transición se resuelve como paint o composite en cada navegador/configuración.
- Si Data URL idénticas comparten string interno, cache entry o superficie raster.
- Si hay redecodificación al hover, scroll o rerender.
- Si los objetos `style` y `parseCardStyles` aportan una fracción relevante al evento.
- Si el tirón reportado es long task de JavaScript, paint, composite, GPU upload o GC.
- Si el mismo comportamiento ocurre con touch, donde no existe hover persistente equivalente.

### Reproducción aislada requerida

| Variante | Propósito |
|---|---|
| 100 cards sin fondo | baseline DOM/React |
| 100 con fondo compartido 320×180 y pocos bytes | separar presencia de fondo de resolución |
| 100 con el mismo fondo de alta resolución | medir raster/memoria conservando repetición |
| 100 con fondos distintos de igual tamaño | detectar deduplicación/caché de superficies |
| repetir 20/500/1000 | curva por cantidad |
| sombra desactivada sólo en harness de medición | atribuir paint de hover; no es cambio de producción |
| overlay aislado sólo en harness | atribuir composición/paint |

Para cada variante: caché fría/caliente, Network offline tras carga, 15 s de scroll, 30 hovers o taps repetibles, apertura/cierre de menú y preview. Instrumentos y métricas están en [measurement-plan.md](./measurement-plan.md).

## Memoria, almacenamiento y límites

### MongoDB

Portada y fondos comparten el documento Deck. Muchas imágenes distintas hacen crecer una única unidad BSON que Mongoose lee/salva en operaciones de fondo y mastery. No se midió `bsonsize`; debe compararse contra presupuestos y límite de plataforma con margen operacional, no sólo esperar al error.

### Red/Node

Express admite cuerpos de 50 MB. Body parser crea representación de la petición y JSON serialization crea la respuesta; el pico depende de Node/V8. Sin medición de heap no se multiplica el tamaño de manera especulativa. La falta de middleware de compresión en app no demuestra ausencia en el edge.

### localStorage

`safeLocalStorage` hace `JSON.stringify` síncrono. Una lista de mazos con portadas/fondos puede acercarse a cuotas variables de navegador. Si falla, se guarda el valor de objeto en un Map de memoria sin TTL/evicción, pero `getJSON` no lo consulta si la clave no existe ni si queda un JSON antiguo válido. Así evita que `setJSON` lance, pero no garantiza recuperación y puede retener cadenas. Debe medirse `JSON.stringify(decks).length`, duración, error de cuota y valor recuperado por navegador.

### Navegador/gráficos

Una imagen comprimida pequeña puede ocupar ancho×alto×bytes por píxel al decodificar; formatos, escalado, cache y GPU cambian el valor real. Medir `performance.measureUserAgentSpecificMemory` donde exista, heap snapshots, Safari Timelines/memoria y terminaciones de pestaña. No inferir memoria raster sólo desde bytes Base64.

## Opciones para investigación externa posterior

Estas son familias de alternativas, no recomendaciones adoptadas:

- almacenamiento de objetos con URLs firmadas/públicas y políticas de ciclo de vida;
- IDs/referencias de imagen en contratos, con diccionario de fondos por respuesta;
- endpoint summary de mazos sin fondos y detalle bajo demanda;
- thumbnails/variantes responsivas por superficie;
- presupuestos por píxeles/bytes, resize y formatos modernos con fallback;
- carga progresiva/virtualización y priorización por viewport;
- cache headers, versionado/hash y revalidación;
- procesamiento en worker o servicio, sujeto a compatibilidad y latencia;
- mantener Data URL pero evitar su expansión por tarjeta.

Cada opción debe evaluarse en permisos, offline, export/import, PDF, eliminación, privacidad, CORS/CSP, coste, observabilidad, compatibilidad Safari y migración de datos.

## Preguntas pendientes de investigación externa

1. ¿Cuál es la distribución real p50/p95/máxima de bytes, dimensiones y formato por tipo de imagen?
2. ¿Qué compresión y límites aplica realmente el hosting/proxy a request y response?
3. ¿Qué cuota efectiva y política de eviction tiene cada navegador objetivo para estas claves?
4. ¿Safari comparte decode/superficie de Data URL idénticas entre backgrounds?
5. ¿Qué fase domina el lag reportado: JS, style, paint, composite, GPU upload o GC?
6. ¿Cuánto BSON ocupan los Deck más grandes y cuánto cuesta leer/salvarlos durante una review?
7. ¿Qué fidelidad visual necesita cada superficie: thumbnail de Library, grid, cara activa y PDF?
8. ¿Se requiere funcionamiento offline completo de las imágenes o basta una caché administrada?
9. ¿Qué reglas de retención, acceso y borrado requiere una alternativa de almacenamiento de objetos?
10. ¿El descarte de `contentImage` en bulk es una restricción deliberada o un bug?
