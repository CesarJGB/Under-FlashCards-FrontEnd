# Resultados de Base64, payload y persistencia

## Conclusión sobre PERF-IMG-001

**Resultado: cuantificado; confianza del mecanismo confirmada.** El almacenamiento compartido de fondos evita duplicarlos en documentos `Flashcard`, pero el serializador los vuelve a expandir una vez por tarjeta. La expansión Base64, la amplitud de `Deck.serialize()` y la copia de la lista en `safeLocalStorage` son `STATICALLY CONFIRMED`; los tamaños de contratos sintéticos son `MODELED`; BSON, gzip y tiempos Node/V8 son `MEASURED`. No se midieron payloads ni latencia de una base real.

## Pipeline observado en el HEAD

### Portada de mazo

1. `DeckModal.fileToBase64` usa `FileReader.readAsDataURL` sin canvas ni redimensionado (`frontend/src/components/DeckModal.jsx:7-13,28-42`). Sólo rechaza el archivo binario si supera 1.5 MiB.
2. La Data URL se mantiene en estado `coverImage` y entra en el JSON de creación/edición (`DeckModal.jsx:19,44-52`).
3. `deckController` copia la cadena a `Deck.coverImage`; el modelo la almacena como `String` (`backend/src/controllers/deckController.js:47-71,82-106`; `backend/src/models/Deck.js:11`).
4. `Deck.serialize()` incluye siempre `coverImage` y `cardBackgrounds` (`Deck.js:38-66`), tanto en detalle como en `GET /api/decks/:userId` (`deckController.js:7-37`).
5. `App.loadDecks` recibe toda la lista, la coloca en estado y llama `setJSON(decks_<user>)` (`frontend/src/App.jsx:81-99`). `safeLocalStorage.setJSON` vuelve a ejecutar `JSON.stringify`; ante cuota conserva además la referencia en el fallback de memoria (`frontend/src/lib/safeLocalStorage.js:21-35`).
6. `DeckCard` crea `backgroundImage: url(<Data URL>)` (`frontend/src/components/DeckCard.jsx:30-39`). No hay URL HTTP independiente que el caché de recursos pueda revalidar.

### Fondo compartido de tarjetas

1. `FlashcardCreator.handleBgFile` admite hasta 700 KiB y usa `readAsDataURL` sin redimensionar (`frontend/src/components/FlashcardCreator.jsx:245-256`).
2. `DeckInterior` incluye `bgImage` dentro del body JSON de POST/PUT (`frontend/src/components/DeckInterior.jsx:231-253`).
3. `getOrCreateBgIndex` lee el mazo, recorre `cardBackgrounds.indexOf(cadena)`, añade y guarda sólo si no existe (`backend/src/controllers/flashcardController.js:7-18`).
4. `Deck.cardBackgrounds` almacena las cadenas y `Flashcard.bgImageIndex` sólo el índice (`backend/src/models/Deck.js:12`; `backend/src/models/Flashcard.js:22`).
5. Al obtener el mazo, el controlador lee Deck + todas las tarjetas y llama `serialize(backgrounds)` (`flashcardController.js:21-28`). `Flashcard.serialize` transforma cada índice otra vez en la Data URL completa `bgImage` (`backend/src/models/Flashcard.js:58-70`). Los endpoints de review hacen la misma resolución (`backend/src/controllers/reviewController.js:174-235,264-318`).
6. `DeckInterior` conserva el arreglo completo en estado; `FlashcardGrid` inserta cada `card.bgImage` como `background-image` CSS (`frontend/src/components/FlashcardGrid.jsx:12-29,123-202`).
7. La lista de mazos también transporta una copia de `cardBackgrounds` por mazo y termina en `safeLocalStorage`, aunque el grid recibe los fondos expandidos desde el endpoint de tarjetas.

### Imagen de contenido

1. `FlashcardCreator` lee el archivo, carga un `Image`, reduce sólo si el ancho supera 600 px y convierte en canvas JPEG calidad 0.7 (`FlashcardCreator.jsx:258-285`). El trabajo ocurre en el hilo principal.
2. La Data URL vive en estado y viaja dentro del body JSON de la tarjeta (`DeckInterior.jsx:231-253`).
3. `Flashcard.contentImage` es una cadena embebida en cada documento y `serialize()` la devuelve (`backend/src/models/Flashcard.js:25,69`). No existe deduplicación con `Deck`.
4. En la cuadrícula normal sólo se muestra un botón “Ver Imagen”; la imagen completa se monta como `<img>` al abrir el preview/ActionSheet (`FlashcardGrid.jsx:159-193` y `CardActionPreview:45-106`). El string sí permanece en cada objeto aunque el raster no esté visible.

## Metodología y perfiles

El script genera bytes deterministas de alta entropía, los convierte a Base64 con prefijo `data:image/jpeg;base64,`, inserta el valor en el mismo shape de respuesta y mide `Buffer.byteLength(JSON.stringify(...), 'utf8')`. Gzip usa `node:zlib` nivel 6. “Dimensiones” representan el raster asociado al perfil; no se afirma que los bytes formen una foto JPEG real.

| Perfil | Dimensiones representadas | Binario | Base64 chars | Data URL UTF-8 | JSON UTF-8 | JSON gzip | Base64/binario | RGBA decodificado estimado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| pequeña | 320×180 | 32,768 B | 43,692 | 43,715 B | 43,727 B | 32,974 B | 1.333374× | 230,400 B |
| mediana | 1280×720 | 262,144 B | 349,528 | 349,551 B | 349,563 B | 263,339 B | 1.333344× | 3,686,400 B |
| grande | 2400×1600 | 716,800 B | 955,736 | 955,759 B | 955,771 B | 719,918 B | 1.333337× | 15,360,000 B |
| contenido | 600×338 | 131,072 B | 174,764 | 174,787 B | 174,799 B | 131,706 B | 1.333344× | 811,200 B |

La estimación de memoria raster es `ancho × alto × 4 bytes` (RGBA de 8 bits). No incluye mipmaps, copias de compositor, alineación, caché de decodificación ni GPU. Tampoco debe sumarse automáticamente por copia lógica: la deduplicación de strings/superficies depende del motor.

## Matriz de `GET /api/flashcards/deck/:deckId`

Los tamaños siguientes son `MODELED`: reproducen campos y expansión de `Flashcard.serialize`, con texto sintético fijo. Gzip es `MEASURED` sobre ese JSON modelado. “Único” cuenta cada cadena de imagen distinta una vez; “repetido” cuenta copias adicionales del fondo compartido. Un fondo “distinto” usa el perfil mediano con bytes diferentes por tarjeta.

| Tarjetas | Escenario | JSON MiB | gzip MiB | Único MiB | Repetido MiB | Duplicación | Copias lógicas |
|---:|---|---:|---:|---:|---:|---:|---:|
| 20 | sin imagen | 0.01 | 0.00 | 0.00 | 0.00 | 0.00% | 0 |
| 20 | fondo pequeño compartido | 0.84 | 0.63 | 0.04 | 0.79 | 94.17% | 20 |
| 20 | fondo mediano compartido | 6.67 | 5.03 | 0.33 | 6.33 | 94.90% | 20 |
| 20 | fondo grande compartido | 18.24 | 13.74 | 0.91 | 17.32 | 94.96% | 20 |
| 20 | fondos medianos distintos | 6.67 | 5.03 | 6.67 | 0.00 | 0.00% | 20 |
| 20 | `contentImage` 10% | 0.34 | 0.25 | 0.33 | 0.00 | 0.00% | 0 |
| 20 | `contentImage` 100% | 3.34 | 2.52 | 3.33 | 0.00 | 0.00% | 0 |
| 100 | sin imagen | 0.04 | 0.00 | 0.00 | 0.00 | 0.00% | 0 |
| 100 | fondo pequeño compartido | 4.21 | 3.17 | 0.04 | 4.13 | 98.13% | 100 |
| 100 | fondo mediano compartido | 33.37 | 25.14 | 0.33 | 33.00 | 98.89% | 100 |
| 100 | fondo grande compartido | 91.19 | 68.68 | 0.91 | 90.24 | 98.96% | 100 |
| 100 | fondos medianos distintos | 33.37 | 25.14 | 33.34 | 0.00 | 0.00% | 100 |
| 100 | `contentImage` 10% | 1.70 | 1.26 | 1.67 | 0.00 | 0.00% | 0 |
| 100 | `contentImage` 100% | 16.71 | 12.58 | 16.67 | 0.00 | 0.00% | 0 |
| 500 | sin imagen | 0.18 | 0.00 | 0.00 | 0.00 | 0.00% | 0 |
| 500 | fondo pequeño compartido | 21.03 | 15.84 | 0.04 | 20.80 | 98.92% | 500 |
| 500 | fondo mediano compartido | 166.86 | 125.68 | 0.33 | 166.35 | 99.69% | 500 |
| 500 | fondo grande compartido | 455.93 | 343.39 | 0.91 | 454.83 | 99.76% | 500 |
| 500 | fondos medianos distintos | 166.86 | 125.68 | 166.68 | 0.00 | 0.00% | 500 |
| 500 | `contentImage` 10% | 8.52 | 6.30 | 8.33 | 0.00 | 0.00% | 0 |
| 500 | `contentImage` 100% | 83.53 | 62.91 | 83.34 | 0.00 | 0.00% | 0 |
| 1000 | sin imagen | 0.37 | 0.01 | 0.00 | 0.00 | 0.00% | 0 |
| 1000 | fondo pequeño compartido | 42.06 | 31.67 | 0.04 | 41.65 | 99.02% | 1000 |
| 1000 | fondo mediano compartido | 333.73 | 251.36 | 0.33 | 333.02 | 99.79% | 1000 |
| 1000 | fondo grande compartido | 911.85 | 686.79 | 0.91 | 910.57 | 99.86% | 1000 |
| 1000 | fondos medianos distintos | 333.73 | 251.35 | 333.36 | 0.00 | 0.00% | 1000 |
| 1000 | `contentImage` 10% | 17.04 | 12.59 | 16.67 | 0.00 | 0.00% | 0 |
| 1000 | `contentImage` 100% | 167.07 | 125.83 | 166.69 | 0.00 | 0.00% | 0 |

El caso compartido crece casi linealmente por tarjeta: por cada 100 tarjetas, aproximadamente 4.21 MiB (pequeño), 33.37 MiB (mediano) o 91.19 MiB (grande). Aunque las cadenas sean iguales, DEFLATE usa una ventana histórica limitada; una imagen de decenas o cientos de KiB separa sus copias más allá de esa ventana. En estos datos de alta entropía, gzip no “recuperó” la deduplicación: 911.85 MiB lógicos siguieron siendo 686.79 MiB transferibles modelados.

## Matriz de `GET /api/decks/:userId` y caché

Cada portada/fondo usa el perfil pequeño; cada mazo con fondos contiene tres. Los bytes y gzip son medidos sobre la respuesta sintética fiel a `Deck.serialize`. `stringify`/`parse` son cinco repeticiones Node/V8; la tabla muestra mediana y [raw-results.json](./raw-results.json) conserva mínimo, máximo y valores.

| Mazos | Escenario | JSON MiB | gzip MiB | portada MiB | fondos MiB | stringify ms | parse ms |
|---:|---|---:|---:|---:|---:|---:|---:|
| 10 | sin imágenes | 0.00 | 0.00 | 0.00 | 0.00 | 0.01 | 0.01 |
| 10 | portadas | 0.42 | 0.32 | 0.42 | 0.00 | 1.30 | 0.19 |
| 10 | fondos | 1.26 | 0.95 | 0.00 | 1.25 | 3.91 | 0.44 |
| 10 | portada + fondos | 1.67 | 1.26 | 0.42 | 1.25 | 5.12 | 0.56 |
| 100 | sin imágenes | 0.04 | 0.00 | 0.00 | 0.00 | 0.07 | 0.10 |
| 100 | portadas | 4.21 | 3.17 | 4.17 | 0.00 | 13.42 | 1.50 |
| 100 | fondos | 12.55 | 9.45 | 0.00 | 12.51 | 41.72 | 5.24 |
| 100 | portada + fondos | 16.72 | 12.60 | 4.17 | 12.51 | 62.92 | 13.08 |
| 500 | sin imágenes | 0.22 | 0.00 | 0.00 | 0.00 | 0.43 | 0.51 |
| 500 | portadas | 21.07 | 15.86 | 20.84 | 0.00 | 77.50 | 13.44 |
| 500 | fondos | 62.76 | 47.27 | 0.00 | 62.53 | 239.59 | 65.22 |
| 500 | portada + fondos | 83.61 | 62.98 | 20.84 | 62.53 | 352.95 | 59.74 |

`safeLocalStorage` intentaría escribir el JSON lógico completo: 87,669,391 caracteres en el escenario de 500 mazos con portada + fondos. En perfiles temporales y origen HTTP local, los tres motores aceptaron el punto probado de 100 portadas (4,418,491 caracteres) y rechazaron el siguiente punto probado de 100 mazos con tres fondos (13,162,291 caracteres) con `QuotaExceededError`. También fallaron 100 “ambos” y los tres escenarios con imágenes de 500 mazos: 15 fallos en total. Esto sólo acota los puntos probados; no define umbral universal ni se extrapola a perfiles reales.

Medianas de `localStorage.setItem` para los puntos que cupieron: Chromium 1.6/5.8/7.2 ms para 10 portadas/fondos/ambos y 20.0 ms para 100 portadas; Firefox 1/4/6/13 ms; WebKit 0/2/6/12 ms. Son herramientas headless locales, no Safari iPhone.

## MongoDB/BSON y operaciones del backend

`BSON.serialize`, ya disponible, midió documentos sintéticos con el shape de los modelos:

| Documento | BSON medido | UTF-8 lógico de imágenes |
|---|---:|---:|
| Deck, portada pequeña + 1 fondo pequeño | 87,589 B | 87,430 B |
| Deck, portada pequeña + 10 fondos pequeños | 481,096 B | 480,865 B |
| Deck, portada mediana + 1 fondo mediano | 699,261 B | 699,102 B |
| Deck, portada mediana + 10 fondos medianos | 3,845,292 B | 3,845,061 B |
| Deck, portada grande + 1 fondo grande | 1,911,677 B | 1,911,518 B |
| Deck, portada grande + 10 fondos grandes | 10,513,580 B | 10,513,349 B |
| Flashcard con `contentImage` | 174,993 B | 174,787 B |

Esto es BSON real del fixture, no tamaño de un documento existente. No se ensayó el límite de plataforma ni se propone un límite de negocio.

`Array.indexOf` compara cadenas y escala con cantidad/longitud hasta hallar la coincidencia. En Node/V8, 100 fondos con una copia igual al final dieron medianas por lookup de 0.00394 ms (pequeño), 0.01119 ms (mediano) y 0.03148 ms (grande); un miss con prefijo común dio 0.00360/0.00846/0.02845 ms. Son cinco repeticiones de bucles amortizados y no representan latencia de request ni MongoDB.

Las operaciones de `createCard`, contadas estáticamente en el controlador, son:

| Caso | Lecturas | Escrituras | Secuencia |
|---|---:|---:|---|
| sin fondo | 1 | 1 | `Flashcard.create`; `Deck.findById` para serializar |
| fondo existente | 2 | 1 | `Deck.findById/indexOf`; `Flashcard.create`; nueva lectura Deck |
| fondo nuevo | 2 | 2 | lectura/indexOf; `Deck.save`; `Flashcard.create`; nueva lectura Deck |

No hubo base segura y representativa: **BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE**. No se ejecutaron `explain()`, profiler, red, middleware de compresión ni tiempos de persistencia.

## Impacto por capa

- **MongoDB — medido/modelado:** portada y fondos viven en Deck; `contentImage` vive en Flashcard. BSON crece casi uno a uno con el UTF-8 de las Data URL.
- **Backend — confirmado:** serializar tarjetas materializa la cadena compartida en cada objeto. `createCard` hace las operaciones anteriores; su tiempo real está bloqueado.
- **Red — modelado:** el JSON descomprimido crece por copia lógica y, con imágenes mayores que la ventana útil de gzip, el transferido conserva gran parte del peso.
- **Navegador — medido parcialmente:** recibe, parsea y mantiene strings; el raster estimado puede superar ampliamente al binario. CDP confirma presión de heap/embedder, pero no memoria GPU.
- **Caché — confirmado/medido:** no existe recurso HTTP separado; `safeLocalStorage` vuelve a stringify la lista. En el entorno local, varias matrices superaron la cuota.
- **Render — medido en el documento del grid:** cada fondo aparece en un style CSS por tarjeta; el coste raster depende de motor, resolución y superficie visible.

## Direcciones que ya pueden investigarse, sin decisión

La evidencia permite comparar después, con contratos y regresiones explícitos, almacenamiento de objetos/referencias, resumen frente a detalle, thumbnails, deduplicación de transporte y políticas de caché. No demuestra qué proveedor, formato, tamaño, TTL o migración debe elegirse. `IMG-DATA` sólo abre la investigación; no autoriza una implementación.
