# Fase 1A — línea base experimental de imágenes

## Objetivo y alcance

Esta investigación mide, sin implementar soluciones, dos hallazgos de la auditoría:

- `PERF-IMG-001`: expansión Base64/Data URL, duplicación en contratos y peso en MongoDB, red, JSON y caché local;
- `PERF-IMG-003`: degradación del `FlashcardGrid` real al montar, desplazar e interactuar con tarjetas con fondo.

Se usaron datos sintéticos deterministas. No se accedió a datos, credenciales ni bases remotas; no se cambió producción, UI, CSS, contratos, dependencias ni configuración. Las variantes de sombra, overlay, ventana reducida y referencia Blob existen sólo dentro del harness.

## Preparación y versión medida

| Dato | Resultado |
|---|---|
| Fecha UTC inicial | `2026-08-12T15:52:31Z` |
| Rama | `main` |
| HEAD inicial | `829b993b50833ce35c52cd5f385876316a539b7d` |
| `origin/main` tras `git fetch origin` | `829b993b50833ce35c52cd5f385876316a539b7d` |
| Commit que publicó la auditoría | `829b993b50833ce35c52cd5f385876316a539b7d` |
| Drift respecto a la auditoría | Ninguno: los tres commits coincidían |
| Estado inicial | `?? .agents/` y `?? package-lock.json` |

Las dos entradas no rastreadas ya existían, son ajenas y no se leyeron como evidencia, no se modificaron ni se incluyeron. Todas las mediciones están vinculadas al HEAD anterior.

## Clasificación

- **MEASURED**: la herramienta disponible produjo directamente el valor.
- **STATICALLY CONFIRMED**: el flujo se demostró siguiendo productor, controlador, modelo, serializador y consumidor.
- **MODELED**: reproducción determinista del contrato actual, sin afirmar tráfico real.
- **ESTIMATED**: fórmula y supuestos explícitos.
- **BLOCKED**: el entorno no ofrece el instrumento representativo.
- **PENDING — DEVICE REQUIRED**: requiere iPhone/Safari físico.

`PASS` significa que el escenario se ejecutó. Los 15 `FAIL` son escrituras de `localStorage` que lanzaron `QuotaExceededError` en perfiles aislados; son un resultado, no un fallo del runner. `NOT RUN` nunca se presenta como aprobado.

## Entorno e instrumentos

| Elemento | Valor |
|---|---|
| Host | Ubuntu Linux `7.0.0-1006-aws`, x86_64, AWS/KVM |
| CPU | Intel Xeon Platinum 8488C, 2 CPU lógicas |
| Memoria host | 7.6 GiB RAM, 2 GiB swap |
| Node/npm | Node `v22.23.1`; npm `10.9.8` |
| Vite | `5.4.21`, instalado previamente |
| Playwright | `1.62.1`, instalado previamente |
| Chromium | `151.0.7922.34`, headless, PASS |
| Firefox | `153.0`, headless, PASS |
| WebKit | `26.5`, headless, PASS |
| Viewport | 1280 × 900 CSS px; movimiento reducido; fuentes remotas bloqueadas |
| Caché | contexto nuevo por escenario; cinco navegaciones en el mismo contexto (primera fría respecto al contexto, siguientes calientes); Data URL inline sin caché HTTP independiente |
| BSON | paquete ya presente en `backend/node_modules` |
| Repeticiones | servidor/ejecutables calentados por piloto + smoke; 5 por escenario variable |

No se descargaron navegadores ni binarios. El harness importa el `FlashcardGrid.jsx` real y `frontend/src/index.css`; Vite lo sirve en desarrollo y también lo compila a un directorio temporal para la pasada de producción. React Profiler sólo produjo commits en desarrollo: en producción se conserva `readyWallMs`, que incluye `page.goto(..., waitUntil: 'networkidle')`, el intervalo fijo de quietud de red, dos frames y la validación explícita de decode de tres fuentes en todos los escenarios. No se denomina tiempo React ni tiempo hasta contenido útil; sólo se comparan diferenciales bajo el mismo guion.

Un piloto detectó que el relleno de un comentario SVG podía contener `--`, secuencia inválida en XML: `image.decode()` falló y todas sus cifras de grid fueron rechazadas. Se cambió únicamente el alfabeto sintético del harness y se repitieron desde cero desarrollo, producción y memoria. Los archivos publicados contienen sólo la segunda campaña: 48/48 escenarios de desarrollo y 24/24 de producción completaron cinco repeticiones con `decodeErrors.max = 0`; memoria completó 20/20. Esta validación evita presentar DOM con imágenes inválidas como raster real.

El piloto rechazado y un smoke de decode calentaron servidor, transformaciones y ejecutables antes de la campaña publicada. Cada escenario publicado abre después un contexto limpio y conserva cinco navegaciones; la primera puede conservar efectos de caché fría del contexto y no se eliminó del agregado. Se publican los cinco valores/min/mediana/max para que esa variación sea visible, en vez de afirmar un estado de caché uniforme.

## Archivos

- [base64-payload-results.md](./base64-payload-results.md): pipeline, matrices JSON/gzip/BSON y almacenamiento.
- [grid-interaction-results.md](./grid-interaction-results.md): grid real, interacciones, trazas, memoria y guía de iPhone.
- [raw-results.json](./raw-results.json): esquema `1.0.0`, valores individuales y agregados.
- [research-gates.md](./research-gates.md): gates independientes `IMG-DATA` e `IMG-RENDER`.
- `frontend/tests/performance/image-grid/`: harness no productivo y scripts reproducibles.

## Resumen ejecutivo

`PERF-IMG-001` queda cuantificado. Los cuatro perfiles sintéticos mostraron la expansión Base64 esperada de aproximadamente 1.333× respecto al binario. En el contrato actual, un único fondo grande de 700 KiB expandido sobre 1000 tarjetas produjo un JSON modelado de **911.85 MiB**, de los que **910.57 MiB** eran repetición evitable del mismo fondo; gzip quedó en **686.79 MiB**. No es tráfico observado en producción, sino una reproducción byte a byte del serializador vigente. Con 500 mazos, una portada pequeña y tres fondos pequeños por mazo, la lista general midió **83.61 MiB JSON**, **62.98 MiB gzip** y una mediana de `JSON.stringify` de **352.95 ms** en Node/V8.

`PERF-IMG-003` queda atribuido sólo parcialmente. El grid real monta todos los elementos: 1000 tarjetas generaron 15,011 nodos sin fondo y 16,011 con fondo. En Chromium/build de producción, el escenario con 1000 fondos grandes pasó de 195 a 490 ms acumulados de long tasks y la señal end-to-end `readyWallMs` pasó de 565.5 a 1741.1 ms. En WebKit headless, la misma señal fue 931.8 frente a 3152.6 ms y la secuencia automatizada de 20 hovers fue 7797 frente a 13,456 ms. Estos tiempos prueban degradación en este entorno, pero no equivalen a INP, FPS ni Safari físico.

La traza Chromium de 500 tarjetas con fondo grande atribuyó, para hover + scroll juntos, medianas de 230.0 ms de Paint y 878.5 ms de RasterTask. Desactivar sólo la sombra dentro del harness las redujo a 179.3 y 776.2 ms; quitar sólo el overlay, a 213.4 y 851.9 ms. Por tanto, sombra y overlay contribuyen en Chromium, pero ninguna queda demostrada como causa única del reporte. Montar sólo 40 de 1000 tarjetas redujo los nodos de 16,011 a 651 y eliminó las long tasks observadas en ese control; es atribución experimental, no propuesta de virtualización.

Gates: **IMG-DATA = GO** para investigar alternativas sin elegir una; **IMG-RENDER = PARTIAL** hasta capturar el caso real en iPhone/Safari y obtener evidencia fiable de composición/GPU.

## Estados de ejecución

| Estado | Resultado |
|---|---|
| PASS | 197 entradas normalizadas: payload, BSON, `indexOf`, grids, trazas, memoria, navegadores y escrituras locales que sí cupieron |
| FAIL | 15 intentos controlados de `localStorage` con `QuotaExceededError` |
| BLOCKED | `BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE`; composición no expuesta por la traza (`CompositeLayers`) |
| NOT RUN | FPS/frames perdidos; suites grandes no relacionadas |
| PENDING | `PENDING — DEVICE REQUIRED` para iPhone 16 Pro Max/Safari físico |

## Comandos ejecutados

Desde la raíz, salvo los marcados `frontend/`:

```text
git fetch origin
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
date -u +%Y-%m-%dT%H:%M:%SZ
  PASS; main; HEAD == origin/main == 829b993b...; dos untracked ajenos

rg --files docs/performance-audit docs/platform-limitations
sed -n ... / nl -ba ... / rg -n ...
  PASS; lectura íntegra de los seis documentos de auditoría y documentación relevante
  de editor V2, iOS/Safari, touch, viewport, teclado, foco, overlays y modales

cd frontend && npm run build
  PASS; Vite 5.4.21; 2,236 módulos; 10.81 s; chunk principal 900.65 kB

cd frontend && npm run test:manual-editor:unit
  PASS; 8/8, 534 ms

cd frontend && PERF_COMMIT=829b993b... node --max-old-space-size=4096 \
  tests/performance/image-grid/run-payload-baseline.mjs /tmp/image-payload-results.json
  PASS; 28 respuestas de tarjetas, 12 listas de mazos, 7 BSON y 24 recorridos indexOf

cd frontend && PERF_COMMIT=829b993b... node --max-old-space-size=4096 \
  tests/performance/image-grid/run-grid-baseline.mjs \
  /tmp/image-grid-results.json /tmp/image-payload-results.json
  PASS; Vite desarrollo; 44 core, 4 controles, 3 trazas, 36 localStorage

cd frontend && PERF_COMMIT=829b993b... node \
  tests/performance/image-grid/run-grid-memory.mjs /tmp/image-grid-memory-results.json
  PASS; 20 escenarios Chromium/CDP tras GC explícito

cd frontend && PERF_BUILD_MODE=production PERF_MATRIX_MODE=core PERF_COMMIT=829b993b... \
  node --max-old-space-size=4096 tests/performance/image-grid/run-grid-baseline.mjs \
  /tmp/image-grid-production-results.json /tmp/image-payload-results.json
  PASS; build y preview temporales; 20 core, 4 controles, 3 trazas, 36 localStorage

cd frontend && node tests/performance/image-grid/compose-results.mjs \
  /tmp/image-payload-results.json /tmp/image-grid-results.json \
  /tmp/image-grid-memory-results.json /tmp/image-grid-production-results.json \
  /tmp/raw-results.json
  PASS; 216 resultados: 197 PASS, 15 FAIL, 2 BLOCKED, 1 NOT RUN, 1 PENDING
```

Los comandos finales de verificación, commit y push se reflejan en el informe final del encargo.

## Limitaciones

- `BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE`: BSON es medido, pero no hubo `explain()`, profiler ni latencia MongoDB.
- WebKit Playwright no es Safari físico ni certifica el mismo GPU/compositor, presupuesto térmico o memoria.
- `PENDING — DEVICE REQUIRED`: falta la reproducción del reporte en iPhone 16 Pro Max.
- CDP no expuso `CompositeLayers`; no se convirtió ausencia de evento en cero.
- No hubo métrica directa fiable de FPS o frames perdidos: `NOT RUN`.
- Las Data URL del payload son bytes de alta entropía reproducibles que modelan tamaños; las del grid son SVG válidos con dimensiones controladas para ejercitar el navegador. No son fotografías equivalentes y ambas poblaciones están separadas.
- `readyWallMs` de producción incluye navegación HTTP local, quietud `networkidle`, dos frames y decode de tres fuentes de control incluso en `no_image`; las comparaciones se usan como señal end-to-end común, no como tiempo React, TTI ni tiempo de usuario.
- `PerformanceObserver(longtask)` está disponible en Chromium, no de forma equivalente en Firefox/WebKit; sus ceros no demuestran ausencia de tareas largas en esos motores.
- La cuota de `localStorage` sólo quedó acotada entre puntos discretos en estos perfiles/origen locales. No se declara una cuota universal.
- Memoria CDP cubre heap JS y embedder tras GC explícito; no incluye memoria de GPU ni superficies raster.
