# Resultados de interacción de `FlashcardGrid`

## Conclusión sobre PERF-IMG-003

**Resultado: evidencia fuerte y atribuida parcialmente; no causa única confirmada.** En el `FlashcardGrid` real, cantidad montada, Data URL grande, sombra y overlay afectan fases distintas. Chromium/CDP midió Paint y RasterTask; Chromium y WebKit headless mostraron degradación de carga/interacción a escala. Falta el dispositivo reportado y una señal de composición/GPU fiable. Por ello `PERF-IMG-003` conserva confianza **Fuerte**, no pasa a “Confirmada”.

## Componente y conducta estática

El harness importa directamente `frontend/src/components/FlashcardGrid.jsx`, no una copia. El componente:

- ejecuta `cards.map` y monta todas las tarjetas (`FlashcardGrid.jsx:123-202`);
- crea `cardStyle`, `questionStyle` y `answerStyle` por tarjeta en cada render (`:12-42,125-133`);
- usa la Data URL como `backgroundImage`, centrada y `cover` (`:16-22`);
- monta un overlay `bg-black/55` por tarjeta con fondo (`:136-139`);
- aplica `shadow-sm transition-shadow hover:shadow-md` al artículo (`:136`);
- monta `contentImage` sólo dentro del preview de acciones (`:45-106`); en el grid cerrado conserva el string y presenta un botón (`:159-193`);
- usa `card.id` como key estable (`:136`).

No hay estado React asociado al hover de la tarjeta, por lo que pasar el mouse no dispara por sí mismo un render React. Sí cambia estilo/pintura por CSS. Abrir el menú cambia `actionCard`, vuelve a renderizar el componente y monta `ActionSheet`/preview.

## Definición exacta de las interacciones

Las señales no se mezclan en los registros individuales:

| Acción | Procedimiento del harness | Qué sí mide | Qué no mide |
|---|---|---|---|
| render inicial | navegación, render y dos `requestAnimationFrame` | señal end-to-end `readyWallMs`; Profiler React en desarrollo | LCP real, red remota, GPU física |
| hover mouse | entrar/salir secuencialmente en hasta 20 `article`, pausa de 1 frame | duración de la secuencia automatizada | INP; latencia de un único hover humano |
| scroll de página | 48 pasos `requestAnimationFrame` hasta el final y vuelta | duración del guion fijo | FPS/frames perdidos directos |
| scroll pasando por tarjetas | el mismo recorrido atraviesa la superficie del grid | trabajo acumulado durante el recorrido | aislamiento perfecto de hover frente a scroll |
| menú tres puntos | click en primera tarjeta, esperar dialog, cerrar | end-to-end incluida animación del UI real | sólo scripting del click |
| tap | no ejecutado como señal separada fiable | — | tacto físico |
| preview | cubierto por el menú real cuando existe contenido | montaje de ActionSheet/preview en ese escenario | gesto/zoom físico |
| movimiento táctil Safari | no ejecutado | — | `PENDING — DEVICE REQUIRED` |

Los tiempos de hover y scroll contienen pausas deliberadas del driver; se comparan dentro del mismo navegador, pero no son INP ni “tiempo bloqueado”. Las trazas CDP combinan hover + scroll para atribuir Paint/Raster/Layout y están identificadas como tal.

## Escenarios y fixtures

Se probaron 20, 100, 500 y 1000 tarjetas con: sin fondo, un fondo pequeño compartido, uno grande compartido, fondos pequeños distintos, `contentImage` en todas y fondo + `contentImage`. Las matrices completas se ejecutaron en Chromium; WebKit cubrió todos los tamaños para sin fondo/fondo grande y 100/500 para los otros perfiles; Firefox cubrió 100/500 sin fondo/fondo grande.

Para que el navegador decodifique algo válido sin guardar binarios, el harness genera SVG determinista como Data URL: pequeño 320×180/8 KiB, grande 2400×1600/128 KiB y contenido 600×338/16 KiB. Estos fixtures ejercitan dimensión, style y decodificación, pero no reproducen el codec ni entropía de una fotografía JPEG. Por eso el pipeline de bytes usa perfiles separados en [base64-payload-results.md](./base64-payload-results.md).

## Render/montaje en desarrollo: React Profiler

React Profiler está habilitado en la pasada de Vite desarrollo. Medianas de cinco ejecuciones en Chromium; mínimo y máximo están en [raw-results.json](./raw-results.json).

| Tarjetas | Escenario | React actual ms | Nodos DOM | Long tasks total ms |
|---:|---|---:|---:|---:|
| 20 | sin imagen | 12.2 | 314 | 0 |
| 20 | fondo pequeño compartido | 15.3 | 334 | 0 |
| 20 | fondo grande compartido | 42.2 | 334 | 0 |
| 20 | `contentImage` | 16.9 | 414 | 0 |
| 20 | fondo + contenido | 48.5 | 434 | 0 |
| 100 | sin imagen | 31.5 | 1,514 | 0 |
| 100 | fondo pequeño compartido | 42.0 | 1,614 | 0 |
| 100 | fondo grande compartido | 173.7 | 1,614 | 51 |
| 100 | `contentImage` | 40.8 | 2,014 | 0 |
| 100 | fondo + contenido | 180.0 | 2,114 | 121 |
| 500 | sin imagen | 89.1 | 7,514 | 191 |
| 500 | fondo pequeño compartido | 116.7 | 8,014 | 209 |
| 500 | fondo grande compartido | 773.9 | 8,014 | 331 |
| 500 | `contentImage` | 121.0 | 10,014 | 420 |
| 500 | fondo + contenido | 808.3 | 10,514 | 685 |
| 1000 | sin imagen | 140.3 | 15,014 | 328 |
| 1000 | fondo pequeño compartido | 231.9 | 16,014 | 378 |
| 1000 | fondo grande compartido | 1,512.2 | 16,014 | 663 |
| 1000 | `contentImage` | 213.2 | 20,014 | 725 |
| 1000 | fondo + contenido | 1,621.3 | 21,014 | 1,330 |

Fondos pequeños compartidos y distintos dieron tiempos React cercanos; el fondo grande fue el separador dominante de este fixture. `contentImage` añade nodos de botones/iconos en el grid aun sin montar el raster completo. Las cifras de desarrollo incluyen instrumentación/transformado y no deben utilizarse como presupuesto de producción.

## Build de producción: comparación principal

`<Profiler>` no entrega commits en React production estándar. `readyWallMs` es una señal end-to-end desde `page.goto` y contiene `networkidle`, dos frames y el decode explícito de las tres fuentes de control en todos los escenarios, incluido `no_image`. Se conserva porque el diferencial a escala es reproducible bajo un coste común, pero no se etiqueta “tiempo de montaje React” ni “tiempo hasta contenido útil”. Long tasks sólo son comparables en Chromium, donde el observer está disponible.

| Navegador | Tarjetas | Escenario | ready mediana [min–max] ms | Long tasks total ms | Hover 20 ms | Scroll ida/vuelta ms | Menú ms |
|---|---:|---|---:|---:|---:|---:|---:|
| Chromium | 20 | sin imagen | 566.0 [566.0–636.6] | 0 | 681 | 830 | 1,015 |
| Chromium | 20 | fondo grande | 565.3 [557.7–649.5] | 0 | 676 | 830 | 1,033 |
| Chromium | 100 | sin imagen | 566.3 [563.5–566.4] | 0 | 680 | 830 | 1,033 |
| Chromium | 100 | fondo grande | 566.1 [549.2–566.3] | 0 | 676 | 831 | 1,080 |
| Chromium | 500 | sin imagen | 568.0 [564.0–578.3] | 70 | 692 | 831 | 1,164 |
| Chromium | 500 | fondo grande | 939.1 [909.2–949.1] | 286 | 699 | 859 | 1,368 |
| Chromium | 1000 | sin imagen | 565.5 [562.7–597.3] | 195 | 686 | 832 | 1,337 |
| Chromium | 1000 | fondo grande | 1,741.1 [1,700.7–1,769.0] | 490 | 681 | 958 | 1,634 |
| Firefox | 100 | sin imagen / fondo grande | 586.1 / 581.8 | n/d | 685 / 681 | 827 / 830 | 1,172 / 792 |
| Firefox | 500 | sin imagen / fondo grande | 590.3 / 583.4 | n/d | 682 / 680 | 827 / 867 | 966 / 1,156 |
| WebKit | 20 | sin imagen / fondo grande | 585.6 / 618.8 | n/d | 888 / 11,121 | 3,246 / 1,238 | 1,058 / 1,429 |
| WebKit | 100 | sin imagen / fondo grande | 583.8 / 682.2 | n/d | 935 / 11,404 | 8,409 / 16,942 | 1,429 / 1,758 |
| WebKit | 500 | sin imagen / fondo grande | 615.8 / 1,771.1 | n/d | 6,350 / 12,573 | 6,886 / 15,040 | 1,677 / 2,642 |
| WebKit | 1000 | sin imagen / fondo grande | 931.8 / 3,152.6 | n/d | 7,797 / 13,456 | 7,952 / 16,623 | 2,210 / 3,515 |

La secuencia WebKit cambia de régimen entre 100 y 500 elementos incluso sin imagen; el fondo añade degradación, pero el volumen montado ya es un multiplicador. La variación no monótona del scroll WebKit (p. ej. 20 sin imagen) impide convertir esa duración en una tasa de frames. Firefox no mostró el mismo diferencial de ready a 500 en esta VM; no invalida Chromium/WebKit ni autoriza extrapolar entre motores.

## Variantes aisladas del harness

Todos los controles usan Chromium/build de producción y cinco repeticiones. “Baseline” comparable es 500 tarjetas/fondo grande: ready 939.1 ms, 286 ms de long tasks y 8,011 nodos.

| Variante experimental | ready mediana ms | Long tasks ms | Nodos | Lectura |
|---|---:|---:|---:|---|
| sombra desactivada, 500 | 926.4 | 284 | 8,011 | no cambia de forma concluyente el coste de carga; su efecto aparece en Paint/Raster durante interacción |
| overlay desactivado, 500 | 914.5 | 285 | 8,011 | tampoco explica montaje por sí solo; contribuye a Paint/Raster |
| Blob URL equivalente, 500 | 573.1 | 122 | 8,011 | la repetición inline de Data URL contribuye; control local, no propuesta de URL remota |
| sólo 40 de 1000 montadas | 566.4 | 0 | 651 | cantidad montada/DOM es multiplicador independiente; no decide virtualización |

La referencia Blob representa el mismo SVG una sola vez dentro del origen temporal y se revoca al cerrar. No modela red, autorización, caché, CDN ni proveedor. Su diferencia mantiene viva la hipótesis de coste de parseo/materialización de Data URL, pero no identifica por sí sola una arquitectura.

## Atribución de Paint/Raster en Chromium

Trazas CDP de cinco repeticiones, 500 tarjetas, fondo grande, build producción. Cada captura incluye la secuencia hover + scroll; las duraciones son suma de eventos de la categoría, no duración de una interacción única.

| Variante | Paint ms | RasterTask ms | UpdateLayoutTree ms | EventDispatch ms | FunctionCall ms |
|---|---:|---:|---:|---:|---:|
| actual | 230.0 | 878.5 | 50.5 | 43.1 | 24.8 |
| sombra off | 179.3 (−22.0%) | 776.2 (−11.6%) | 25.2 (−50.1%) | 39.6 (−8.1%) | 25.4 (+2.8%) |
| overlay off | 213.4 (−7.2%) | 851.9 (−3.0%) | 44.6 (−11.7%) | 39.5 (−8.4%) | 25.5 (+3.0%) |

**MEASURED:** sombra y overlay contribuyen al trabajo de pintura/raster de este escenario Chromium. **No confirmado:** que la sombra sea el cuello principal del iPhone o que quitarla resuelva el reporte. `CompositeLayers` no apareció como evento X en estas trazas: **BLOCKED**, no 0 ms. FPS/frames perdidos: **NOT RUN**.

## Memoria tras GC explícito

Chromium/CDP midió heap JS y memoria embedder antes, cargado y después de cerrar, forzando GC en cada punto. Medianas en MiB; no incluye GPU/raster.

| Tarjetas | Escenario | Δ JS cargado | Δ embedder cargado | Δ JS tras cerrar | Δ embedder tras cerrar | Nodos |
|---:|---|---:|---:|---:|---:|---:|
| 100 | sin imagen | 5.25 | 3.10 | 4.53 | 0.62 | 1,514 |
| 100 | fondo grande compartido | 16.78 | 3.50 | 4.53 | 0.70 | 1,614 |
| 500 | sin imagen | 8.14 | 12.74 | 4.62 | 0.63 | 7,514 |
| 500 | fondo grande compartido | 15.80 | 14.41 | 4.61 | 0.73 | 8,014 |
| 500 | fondos pequeños distintos | 9.34 | 44.15 | 4.65 | 1.91 | 8,014 |
| 500 | fondo + contenido | 13.80 | 18.07 | 4.64 | 0.23 | 10,514 |
| 1000 | sin imagen | 11.68 | 24.79 | 4.70 | 0.63 | 15,014 |
| 1000 | fondo grande compartido | 12.06 | 28.01 | 4.70 | 0.78 | 16,014 |
| 1000 | fondos pequeños distintos | 13.89 | 87.49 | 4.76 | 2.14 | 16,014 |
| 1000 | fondo + contenido | 15.38 | 36.32 | 4.74 | 0.79 | 21,014 |
| 500 | fondo grande como Blob | 8.36 | 14.34 | 4.62 | 0.67 | 8,014 |
| 40 de 1000 | fondo grande Data URL | 11.46 | 1.86 | 4.50 | 0.70 | 654 |

La memoria embedder escala con DOM y fondos distintos. El heap de strings grandes no es monotónico entre 500 y 1000 por representaciones/deduplicación internas de V8; no se interpreta como ausencia de raster adicional. Tras cerrar, embedder vuelve cerca del baseline en este harness; eso descarta una fuga obvia del montaje experimental, no fugas en navegación completa de la aplicación.

## Clasificación de hipótesis

### Causa confirmada en este entorno

- El grid monta todas las tarjetas y el DOM crece aproximadamente 15–21 nodos por tarjeta según contenido.
- El fondo grande aumenta carga y long tasks a 500/1000 en Chromium y carga/interacciones en WebKit headless.
- Sombra y overlay añaden Paint/Raster en la traza Chromium aislada.
- Una ventana de 40 reduce DOM y long tasks del control frente a 1000 montadas.
- Data URL frente a Blob local equivalente produce un diferencial de carga/memoria en el control Chromium.

### Hipótesis fuerte, todavía no cerrada

- El reporte visible resulta de la combinación de cantidad montada, resolución/representación inline, raster y efectos por tarjeta.
- WebKit/Safari puede ser más sensible al volumen del grid que Chromium/Firefox; WebKit headless apoya la dirección, no la equivalencia física.
- Recolección de basura o presión de superficies puede contribuir durante navegación prolongada; CDP JS/embedder no observa GPU.

### Pendiente o descartada como explicación única

- **Pendiente:** redecodificación de la misma Data URL, memoria GPU, composición, frames perdidos y thermal throttling.
- **Pendiente:** cuál acción exacta del reporte —hover, scroll sobre tarjeta, tap o menú— domina en iPhone.
- **Descartada como causa única:** `hover` provoca rerender React; no hay setter/evento React en la tarjeta para hover.
- **Descartada como causa única:** sombra u overlay por separado; ambos contribuyen, pero su desactivación no elimina el coste de montaje y falta iPhone.
- **Descartada para el grid cerrado:** raster inmediato de cada `contentImage`; el componente sólo monta el `<img>` en preview, aunque conserva strings y nodos de control.

## Guía segura para iPhone 16 Pro Max

Estado: **PENDING — DEVICE REQUIRED**. No requiere instalar herramientas en el iPhone.

1. Preparar fuera de producción o en una cuenta/dataset autorizado un mazo de 500 tarjetas; si es viable, repetir con 100 y 1000. Usar el mismo fondo 2400×1600, alrededor de 700 KiB, en todas. Preparar un mazo gemelo sin fondo.
2. Cerrar otras apps pesadas, abrir Safari, cargar primero el mazo sin fondo y esperar 10 s. Repetir con el mazo con fondo tras recargar la página.
3. Durante aproximadamente 45 s por mazo: desplazar de arriba abajo durante 10 s; hacer cinco desplazamientos cortos empezando encima de tarjetas; tocar diez menús de tres puntos y cerrarlos; abrir/cerrar cinco previews; volver al inicio. No mezclar acciones: grabar cada bloque por separado.
4. Observar y devolver: versión exacta de iOS; si el tirón aparece al iniciar scroll, mientras se mueve, al tocar menú o al abrir preview; si empeora tras varios recorridos; si Safari recarga la pestaña; una grabación de pantalla con reloj visible y, si iOS lo muestra, mensaje de recarga.
5. Repetir una vez con Safari recién abierto y otra tras cinco minutos de uso. Duración total estimada de ejecución humana: 8–10 minutos; no es un tiempo medido de rendimiento.

La grabación sirve para localizar acción/síntoma. Para atribuir compositor/memoria será necesaria después una captura remota autorizada desde macOS/Safari; esta fase no la exige ni la simula.
