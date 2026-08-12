# Gates de investigación de imágenes

Estos gates autorizan únicamente investigación comparativa posterior. No seleccionan almacenamiento, formato, contrato, thumbnail, caché, paginación ni tratamiento visual.

## Gate IMG-DATA — GO

### Evidencia disponible

- **STATICALLY CONFIRMED:** portada y fondo entran por `readAsDataURL`; `contentImage` se convierte a JPEG 0.7 con ancho máximo 600 px; las tres rutas conservan strings dentro de MongoDB.
- **STATICALLY CONFIRMED:** Deck guarda `coverImage` + `cardBackgrounds`; Flashcard guarda `bgImageIndex` + `contentImage`; `Flashcard.serialize` expande el fondo y `Deck.serialize` incluye portada/fondos en la lista general.
- **MEASURED:** Base64 amplió los perfiles controlados aproximadamente 1.333×; JSON/gzip, BSON, parse/stringify, `indexOf` y puntos de cuota local quedaron cuantificados.
- **MODELED:** a 1000 tarjetas, un fondo grande compartido produjo 911.85 MiB JSON, 686.79 MiB gzip y 910.57 MiB repetidos; el modelo reproduce el contrato actual y no afirma tráfico productivo.
- **MEASURED:** 500 mazos con portada + tres fondos pequeños dieron 83.61 MiB JSON, 62.98 MiB gzip y 352.95 ms medianos de stringify Node/V8.
- **MEASURED:** los tres navegadores locales aceptaron 4,418,491 caracteres y rechazaron el punto probado de 13,162,291 con `QuotaExceededError`; no se generalizó la cuota.

Esta evidencia es suficiente para que César y ChatGPT investiguen y comparen opciones de almacenamiento, transporte, contratos resumen/detalle, thumbnails, deduplicación y caché. El problema cuantitativo está demostrado sin necesitar una base productiva.

### Evidencia faltante

- distribución real y percentiles de dimensiones/bytes/cantidad de imágenes, con datos anonimizados o fixtures autorizados;
- cabeceras y compresión efectivas del hosting/API;
- latencia, CPU, memoria y plan MongoDB representativos: **BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE**;
- compatibilidad/migración, autorización, borrado, costes y consistencia de cualquier alternativa;
- presupuesto de calidad visual y offline por superficie.

### Hipótesis descartadas

- “El índice compartido evita duplicación en todo el sistema”: falso en el contrato de salida; sólo evita duplicación en documentos Flashcard.
- “gzip hace irrelevantes las copias”: falso para estos perfiles; los fondos mayores exceden la ventana útil entre repeticiones y conservaron gran parte del peso.
- “la lista de mazos sólo trae metadatos livianos”: falso; el serializador incluye portada y fondos.
- “`safeLocalStorage` garantiza persistencia aunque la lista sea grande”: falso; cae al Map en memoria al fallar la cuota.

### Hipótesis todavía vivas

- recursos referenciados podrían permitir caché/deduplicación de transporte, sujeto a autorización y ciclo de vida;
- resumen/detalle podría reducir la lista general, sujeto a consumidores actuales;
- thumbnails o transformaciones podrían reducir decode/raster, sujeto a fidelidad y almacenamiento;
- deduplicación explícita podría reducir el endpoint de tarjetas sin implicar proveedor concreto;
- límites/presupuestos por contrato podrían prevenir documentos/payloads extremos, sujeto a importación y compatibilidad.

### Siguiente acción mínima

Crear una comparación documental, no código, de 2–4 formas de contrato/almacenamiento usando esta misma matriz. Para cada una calcular bytes, requests, cache hits/misses, autorización, offline, migración y regresiones. Validar además una muestra sintética contra la infraestructura real no productiva antes de decidir.

## Gate IMG-RENDER — PARTIAL

### Evidencia disponible

- **STATICALLY CONFIRMED:** grid ilimitado, Data URL en `background-image`, overlay y transición `hover:shadow-md`; hover CSS no cambia estado React.
- **MEASURED:** 1000 tarjetas montaron 15,011 nodos sin fondo y 16,011 con fondo en producción.
- **MEASURED:** Chromium producción, 1000/fondo grande frente a sin imagen: 1741.1 frente a 565.5 ms de señal ready y 490 frente a 195 ms de long tasks acumuladas.
- **MEASURED:** WebKit headless, 1000/fondo grande frente a sin imagen: 3152.6 frente a 931.8 ms ready; secuencia de hovers 13,456 frente a 7797 ms.
- **MEASURED:** Chromium CDP, 500/fondo grande: 230.0 ms Paint y 878.5 ms RasterTask; sombra off redujo 22.0%/11.6%, overlay off 7.2%/3.0%.
- **MEASURED:** controles de Blob equivalente y 40 elementos montados redujeron carga/long tasks, sin convertirse en propuestas.
- **MEASURED:** memoria Chromium tras GC separa heap JS, embedder y retorno después de cerrar.

La evidencia basta para orientar la siguiente captura y descartar explicaciones simples. No basta para elegir una solución concreta al lag reportado: el dispositivo, motor y acción exacta siguen sin medirse.

### Evidencia faltante

- **PENDING — DEVICE REQUIRED:** iPhone 16 Pro Max/Safari físico con el guion descrito;
- captura de memoria, Timelines y capas/composición del dispositivo afectado;
- `CompositeLayers`: **BLOCKED** en las trazas disponibles;
- FPS/frames perdidos directos: **NOT RUN**;
- aislamiento físico de scroll, scroll sobre tarjeta, tap, menú, preview y presión prolongada;
- JPEG/fotografía representativa frente al SVG controlado del harness;
- prueba de caché fría/caliente y reapertura dentro de la aplicación completa.

### Hipótesis descartadas

- hover causa por sí mismo un rerender React del grid;
- la sombra es la causa única;
- el overlay es la causa única;
- cada `contentImage` se rasteriza durante el grid cerrado;
- WebKit Playwright equivale a una validación Safari/iPhone.

### Hipótesis todavía vivas

- número de elementos/superficies montadas es un multiplicador principal;
- dimensión y representación inline del fondo elevan parseo/materialización/raster;
- sombra y overlay se suman al coste de interacción en Chromium y pueden pesar distinto en Safari;
- Safari físico puede recodificar, desalojar o recomponer superficies bajo presión de memoria;
- la pausa percibida puede concentrarse en scroll o apertura del menú, no en hover literal;
- GC, GPU o presión térmica pueden explicar jank tardío aunque el harness cierre limpiamente.

### Siguiente acción mínima

Ejecutar la guía de 8–10 minutos en el iPhone con mazos gemelos de 100/500/1000, registrar acción exacta y vídeo, y sólo después capturar Safari Timelines/memoria de la reproducción mínima. Si el diferencial no aparece con el SVG, repetir con JPEG controlado de dimensiones/bytes equivalentes. No cambiar producción para hacer esta prueba.

## Decisión global

| Gate | Resultado | Qué permite | Qué no permite |
|---|---|---|---|
| IMG-DATA | **GO** | investigar y comparar alternativas cuantitativamente | elegir proveedor, contrato o migración |
| IMG-RENDER | **PARTIAL** | diseñar la captura física y mantener un conjunto acotado de hipótesis | retirar efectos, virtualizar, memoizar o cambiar imágenes |
