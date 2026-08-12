# Auditoría técnica de rendimiento de Under Flashcards

## Objetivo

Esta carpeta documenta una auditoría estática y reproducible de los flujos que más afectan a la velocidad percibida, carga, renderizado, imágenes, edición de tarjetas, consumo de recursos y escalabilidad de Under Flashcards. Su finalidad es conservar evidencia suficiente para medir después las hipótesis y decidir, en otra fase, qué cambios conviene implementar.

Esta fase no modifica comportamiento, interfaz, lógica, modelos, controladores, configuración, dependencias ni pruebas. Tampoco adopta una migración de almacenamiento o un contrato de API como solución definitiva.

## Preparación y versión auditada

| Dato | Resultado |
|---|---|
| Fecha de preparación UTC | 2026-08-12T14:51:52Z |
| Repositorio | `CesarJGB/Under-FlashCards-FrontEnd` |
| Rama | `main` |
| HEAD inicial auditado | `6b1492c9bed57dbfe15537d5a8cbe1424f01c12f` |
| `origin/main` tras `git fetch origin` | `6b1492c9bed57dbfe15537d5a8cbe1424f01c12f` |
| HEAD indicado como observado en el encargo | `8c4f1fd5cf2bd047aa4038f6ef16868521e6e8b3` |
| Drift de código remoto al preparar | Ninguno: `HEAD == origin/main` |
| Drift frente al HEAD del encargo | Un commit: `6b1492c` (`Corrige la profundidad del stack de widgets`) |
| Estado inicial del árbol | Dos entradas no rastreadas preexistentes: `.agents/` y `package-lock.json` |

Las entradas no rastreadas eran ajenas a esta auditoría. No se modificaron, añadieron al índice ni incluyeron en el commit documental.

## Alcance

La investigación sigue productores y consumidores reales a través de:

- arranque desde `frontend/src/App.jsx`, CSS, fuentes y recursos estáticos;
- `LibrarySection`, `useLibraryState`, niveles académicos, búsqueda, tarjetas de mazo y apertura de mazo;
- creación, edición manual, importación y actualización local de tarjetas;
- portada, fondo compartido, `contentImage`, estudio, repaso y exportación PDF;
- controladores, serializadores, consultas e índices de MongoDB;
- cachés de React, `safeLocalStorage`, caché HTTP y estados persistidos;
- trabajo del navegador: descarga, parseo, render, pintura, composición, memoria y almacenamiento;
- comportamiento bajo 10/100/500 mazos y 20/100/500/1000 tarjetas, preparado como matriz, no simulado con datos inventados;
- estabilidad: carreras, errores silenciosos, falta de cancelación, pruebas degradadas y contratos divergentes.

## Exclusiones

- No se crearon datos remotos ni fixtures de producción.
- No se ejecutaron migraciones, cambios de índices ni consultas `explain()` contra una base real.
- No se instalaron dependencias.
- No se aplicaron optimizaciones, refactors ni correcciones.
- No se atribuye el lag de tarjetas con fondo a una fase del pipeline gráfico sin un perfil de dispositivo.
- No se presentan tiempos de carga, interacción o consultas como medidos cuando no hubo entorno funcional con datos representativos.
- La seguridad y autorización sólo se mencionan cuando alteran el coste o la estabilidad del flujo auditado.

## Metodología

1. Se sincronizó la referencia remota y se verificaron rama, HEAD y árbol.
2. Se leyó la documentación existente de `docs/platform-limitations/`, con especial atención al editor manual V2, inventarios, dependencias, cortes de migración, estados, matrices y limitaciones móviles.
3. Se reconstruyeron los flujos en ambos sentidos: UI → petición → controlador → modelo → serializador → respuesta → estado/caché → render.
4. Se siguieron consumidores con búsquedas estáticas; un comentario no se aceptó como prueba aislada.
5. Se generó un build de producción para medir la composición real de los artefactos.
6. Se ejecutaron las pruebas instaladas relevantes y se conservaron los fallos como evidencia de drift.
7. Cada hallazgo recibió severidad y confianza independientes. “Confirmada” significa que el comportamiento está demostrado en el código o en un comando; no implica que su impacto temporal haya sido medido.
8. Los costes dependientes del motor gráfico, compresión de infraestructura, plan de MongoDB o dispositivo quedan como “fuerte” o “pendiente de medición”.

## Resumen ejecutivo

El riesgo dominante es que las imágenes no se comportan como recursos cacheables independientes: se convierten en Data URL, se almacenan como cadenas dentro de documentos MongoDB y se vuelven a insertar en JSON. Un fondo guardado una vez en `Deck.cardBackgrounds` se expande de nuevo a `bgImage` en cada tarjeta serializada. Además, la lista general de mazos incluye `coverImage` y todo `cardBackgrounds`, y esa respuesta completa se copia a `safeLocalStorage`. El diseño evita duplicar el fondo dentro de cada documento `Flashcard`, pero desplaza la duplicación a red, parseo, estado, caché y, en algunos flujos, a dos respuestas simultáneas.

El segundo riesgo es la ausencia de límites en colecciones críticas. La API de mazos devuelve toda la colección visible y calcula conteos globales; la apertura de un mazo devuelve todas sus tarjetas; `FlashcardGrid` monta todas a la vez con fondo CSS, overlay y transición de sombra. No hay paginación, carga incremental, virtualización ni caché por mazo. Por ello, el mismo código que es razonable con 20 tarjetas puede crecer simultáneamente en bytes, objetos JavaScript, nodos DOM y superficies de imagen con 500 o 1000.

El tercero es trabajo duplicado en el camino interactivo. `App`, `HomeSection` y `LibrarySection` pueden solicitar mazos y materias al montarse. Cada URL incorpora `?t=${Date.now()}` y las respuestas completas vuelven a serializarse hacia almacenamiento local. Después de crear o editar una tarjeta, el cliente espera la respuesta, actualiza su lista y dispara otra carga completa de mazos y materias. Al abrir modos de sesión, `DeckInterior` carga todas las tarjetas y `SessionPlayer` descarga otra colección completa mediante `all-cards`.

El build confirma una carga inicial JavaScript grande: el chunk principal minificado mide 900.65 kB (246.33 kB gzip según Vite) y contiene rutas de Library, editor, sesiones e IA aunque sus vistas sean condicionales. PDF sí está dividido en chunks diferidos; su worker mayor mide 2,209.73 kB y se carga bajo demanda. La hoja CSS principal mide 156.15 kB (24.51 kB gzip) e importa Google Fonts externamente.

El lag reportado al interactuar con una cuadrícula de tarjetas con fondo no tiene una causa única confirmada. Sí están confirmados el render completo, el uso de `background-image` Data URL, un overlay por tarjeta y `hover:shadow-md`; es fuerte que resolución, cantidad visible y presión de memoria eleven pintura/composición. Que la sombra sea el cuello de botella, que Safari vuelva a decodificar o que el recolector produzca los tirones requiere una captura de Performance/Timelines y memoria en el dispositivo afectado.

## Resultados medidos disponibles

| Medición | Resultado | Alcance |
|---|---:|---|
| Build Vite de producción | 10.90 s, 2,236 módulos transformados | Tiempo del comando local; no es tiempo de carga del usuario |
| JS principal | 900.65 kB minificado; 246.33 kB gzip | Reporte de Vite |
| CSS principal | 156.15 kB minificado; 24.51 kB gzip | Reporte de Vite |
| `DebugPanel` diferido | 21.26 kB; 5.93 kB gzip | Reporte de Vite |
| `PdfExtractor` diferido | 66.63 kB; 22.84 kB gzip | Reporte de Vite |
| Worker PDF más grande | 2,209.73 kB | Bajo demanda; reporte de Vite |
| Pruebas editor manual V2 | 8/8 aprobadas | Unitarias instaladas |
| Pruebas de calendario | 9/9 aprobadas | Unitarias instaladas |
| Prueba de extracción PDF | 1/1 aprobada | Instalada |
| Pruebas backend | 6 archivos aprobados, 2 fallidos | `aiService` y `deckRecovery` presentan drift |

No se midieron TTFB, FCP, LCP, INP, memoria decodificada, tiempo de consulta MongoDB, tamaño de respuestas con datos reales ni FPS. Sus procedimientos quedan en [measurement-plan.md](./measurement-plan.md).

## Relación con documentación previa y drift

`docs/platform-limitations/` es la autoridad previa para el editor manual móvil y sus superficies compartidas. Esta auditoría no reabre como defectos nuevos los listeners, scroll locks y acoplamientos que la migración V2 declaró retirados. La evidencia actual conserva:

- arquitectura V2 y ownership descritos en `manual-card-editor-v2-architecture.md`;
- inventarios y dependencias en `manual-editor-dependency-map.md`, `manual-editor-migration-inventory.md` y `manual-editor-runtime-dependency-report.md`;
- cierre estático y pruebas en `manual-editor-migration-state.md`, `manual-editor-test-matrix.md` y los reportes de corte;
- limitaciones pendientes de dispositivo real para Safari/IME/VisualViewport y elastic bounce.

Existe drift posterior al último commit documental registrado allí (`36c77a74108b089de36a0d663aae9888d62fb37e`) en `App.jsx`, superficies del editor, PDF, overlays y CSS. Las pruebas unitarias V2 continúan aprobando, pero no hay una nueva evidencia física que cierre ese drift. Por tanto, rendimiento de escritura/foco/teclado móvil se marca pendiente de perfilado, no como regresión confirmada.

## Mapa de documentos

- [architecture-and-critical-flows.md](./architecture-and-critical-flows.md): arquitectura, diagramas y contratos observados.
- [findings.md](./findings.md): tabla maestra y evidencia desarrollada por ID.
- [image-pipeline.md](./image-pipeline.md): ciclo de vida de imágenes y análisis del lag de la cuadrícula.
- [measurement-plan.md](./measurement-plan.md): matriz de escala, métricas e instrumentos necesarios.
- [prioritized-roadmap.md](./prioritized-roadmap.md): orden de investigación futura, riesgos, aceptación y “No hacer todavía”.

## Comandos ejecutados y resultados relevantes

Todos se ejecutaron desde el repositorio salvo los que indican `frontend/` o `backend/`:

```text
git fetch origin
  correcto; origin/main quedó en 6b1492c9bed57dbfe15537d5a8cbe1424f01c12f

git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short
  main; HEAD y origin/main iguales; ?? .agents/ y ?? package-lock.json

git log --oneline --decorate -3 HEAD
  6b1492c Corrige la profundidad del stack de widgets
  8c4f1fd Actualiza Home al estilo visual V4

rg --files docs/platform-limitations frontend/src backend/src
rg ...
sed -n ...
  inspección estática, productores, consumidores, rutas, modelos e índices

cd frontend && npm run build
  correcto; Vite 5.4.21; 2,236 módulos; 10.90 s; advertencia de chunk >500 kB

cd frontend && npm run test:manual-editor:unit
  correcto; 8/8

cd frontend && npm run test:schedule
  correcto; 9/9

cd frontend && npm run test:pdf-extraction
  correcto; 1/1

cd backend && npm test
  código 1; 6 archivos aprobados y 2 fallidos

cd backend && node test/aiService.test.js
  5/7; expectativas de modelo y cantidad de tarjetas divergentes

cd backend && node test/deckRecovery.test.js
  0/3; expectativas de reintentos/HTTP divergentes

date -u +%Y-%m-%dT%H:%M:%SZ
  2026-08-12T14:51:52Z
```

Los comandos finales de verificación, commit y push se registran al cerrar la auditoría en la sección siguiente.

## Verificación final

Resultados obtenidos antes de congelar el contenido del commit:

- `git status --short`: seis documentos nuevos staged bajo `docs/performance-audit/`; continuaban sin rastrear `.agents/` y `package-lock.json`, ya presentes al inicio.
- `git diff --cached --name-only`: exactamente los seis archivos de esta carpeta; ningún archivo de producción, configuración, dependencia o prueba.
- validador local de enlaces Markdown relativos: 6 archivos revisados; todos los destinos resuelven.
- validador local de rutas de repositorio citadas: todas las rutas sin comodines existen.
- recuento de filas de la tabla maestra: 1 crítica, 12 altas, 12 medias y 2 bajas; 27 total.
- `git diff --cached --check`: sin salida, código 0.
- búsquedas de lenguaje de confianza y revisión editorial: las cifras no medidas permanecen declaradas como hipótesis o pendientes; el tiempo de build se identifica como tiempo del comando, no del usuario.

El commit, su HEAD resultante y el push se ejecutan necesariamente después de fijar este archivo; su resultado exacto se entrega en el informe final del encargo.

## Limitaciones de la investigación

- No se dispuso de una base MongoDB representativa ni de credenciales para ejecutar planes reales.
- No hubo dataset reproducible con 500/1000 tarjetas e imágenes de resoluciones controladas.
- No se capturó red móvil, heap, presión de memoria, paint flashing, capas ni Timelines de Safari.
- Los tamaños gzip provienen de Vite; la compresión efectiva en producción depende de la plataforma, donde no se verificaron cabeceras.
- La deduplicación interna de cadenas o superficies decodificadas depende del motor y no se infiere desde el código.
- El límite de documento de MongoDB y la cuota de almacenamiento del navegador son riesgos de plataforma; la distancia real al límite requiere muestras de datos.
- El build prueba composición, no ejecución en frío, caché caliente ni interacción.
- Los umbrales de la matriz son hipótesis de aceptación y deben calibrarse con telemetría y dispositivos reales.
