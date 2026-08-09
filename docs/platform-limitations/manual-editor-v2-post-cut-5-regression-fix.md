# Corrección Safari/iOS posterior al Corte 5

## Seguimiento sobre `9059e3b` — color propio e imagen controlada

La prueba física posterior confirmó en iPhone que el cambio rápido de pregunta/respuesta y el toggle del mismo trigger ya no bajan el teclado. Esos contratos, `useFocusPreservingPress`, su listener `touchstart` nativo no pasivo, la selección por lado y la posición de la raíz de popovers no se modificaron.

Quedaban dos fallos del color nativo: el primer toque podía limitarse a cerrar el OSK y `change` podía llegar mientras el usuario aún movía controles. El handler confirmaba, llamaba `onClose()` y desmontaba la paleta —incluido el `input[type=color]` que Safari seguía usando—, por lo que la UI nativa se cerraba prematuramente con un valor anterior. La semántica de `input/change` del picker del sistema no ofrece una frontera portable de “Aplicar”.

La ruta nativa se retiró. “Color personalizado” abre ahora un ActionSheet propio con preview, tono, saturación, luminosidad y hexadecimal. Al abrir captura color, lado y clave de estilo; 50 movimientos solo cambian el borrador local. Aplicar normaliza `#rrggbb` y muta una vez la clave congelada. Cancelar, backdrop, Escape y Back descartan sin restauración porque el modelo no se tocó. La caracterización WebKit mostró además que cancelar `pointerdown` en este nuevo botón semántico suprimía su click táctil; se permite completar el click y el sheet constituye la transición visible del primer toque.

El botón de imagen abre primero “Imagen de la tarjeta”. El destino Pregunta/Respuesta, la selección de archivo y la eliminación son borradores. Un `input[type=file]` real y transparente cubre el botón “Seleccionar/Cambiar imagen”; recibe directamente ese segundo gesto y no se abre mediante `input.click()`. `CardFrame` renderiza la preview. Las URLs de objeto se revocan al reemplazar, cancelar, aplicar o desmontar. Solo Aplicar llama una vez al contrato existente de imagen o eliminación; el modelo continúa representando una imagen única con un solo `imageSide`.

Ambos sheets usan `ActionSheet`, `OverlayScope` y la pila top-only existentes. Se portalizan por encima del chrome del editor sin cambiar el z-index relativo ya validado de popovers/footer. Escape/Back cierran una sola capa y los desmontajes hostiles dejan cero owners, sentinels, leases y focus traps.

El harness conserva la traza de eventos y añade identidad de nodo, `isConnected`, MutationObserver de montaje/desmontaje, valores de draft, conteos de commit y URLs creadas/revocadas. Playwright demuestra estos contratos DOM en Chromium/WebKit/Firefox; el OSK real y el file picker de iOS siguen `PENDING — DEVICE REQUIRED`.

### Gate del seguimiento

- `npm run test:manual-editor:unit`: 7/7 archivos PASS.
- `npm run build`: PASS, 2225 módulos transformados.
- Chromium: 29 PASS, 1 `DEVICE REQUIRED` omitida.
- WebKit: 29 PASS, 1 `DEVICE REQUIRED` omitida.
- Firefox: 29 PASS, 1 `DEVICE REQUIRED` omitida.
- `git diff --check`: PASS.

## Registro histórico de la corrección `9059e3b` (picker de color sustituido)

**Base inicial:** `origin/main` `d1f52c22a2457026c4e8fcd7afc8ba3d1bcd00a7`.

**Alcance:** modal del editor manual, activación de sus tres triggers sensibles al foco, paletas y harness. Sin backend, persistencia, API ni dependencias runtime.

**Certificación de OSK y picker de iPhone:** `PENDING — DEVICE REQUIRED`.

## Reproducción y orden observado

El harness registra en captura y burbuja `touchstart`, `pointerdown`, `mousedown`, `pointerup`, `touchend`, `click`, `focus`, `focusin`, `blur`, `focusout`, `input` y `change`, además de `document.activeElement` en cada entrada.

Con la implementación anterior, el primer tap en color produjo:

- Chromium móvil: `pointerdown` sobre el contenido del trigger → apertura de la capa → `touchstart`/`pointerup`/`touchend` → `click` retargeteado al backdrop recién montado. El mismo gesto abría y cerraba.
- WebKit móvil: `pointerdown` sobre el trigger → apertura → `touchstart` → `pointerup` ya retargeteado al backdrop. El menú quedaba abierto, pero el backdrop impedía tocar el mismo trigger para cerrarlo.
- Un `click` compatible sintetizado con `detail=0` se confundía con activación semántica y repetía el toggle iniciado en `pointerdown`.

El `pointerdown` de React sí llamaba `preventDefault`, pero el `touchstart` delegado seguía apareciendo sin cancelar en la captura previa al target. Dado que el fallo restante solo aparecía en un iPhone físico, el contrato incorpora un listener `touchstart` directo y no pasivo por trigger; no es global y no bloquea scroll fuera de esos tres controles.

## Causas raíz

1. **Cambio rápido de lado:** `pointerdown` evitaba parte de la transferencia de foco, pero no cancelaba de forma nativa el inicio táctil que Safari usa para decidir el foco/OSK. Recuperar foco después del render no puede restaurar de forma fiable el teclado del sistema.
2. **Color/alineación:** la capa se montaba durante `pointerdown` encima de la barra. Los eventos restantes del mismo gesto alcanzaban el backdrop y, después, el propio trigger quedaba físicamente cubierto. La heurística basada en metadatos de `click` tampoco distinguía todos los clicks compatibles.
3. **Color personalizado:** el elemento que recibía el gesto era un botón. Este intentaba abrir un `input[type=color]` `sr-only` mediante `showPicker()` y, si fallaba, `input.click()`. Esa activación programática no abrió el picker en Safari/iOS físico.

## Solución aplicada

- `useFocusPreservingPress` mantiene estado por control y ejecuta una sola acción en `pointerdown` primario, antes de que el control robe foco. Su listener nativo `touchstart` no pasivo cancela la transferencia táctil. `mousedown` es fallback y el click compatible se consume aunque llegue sin `pointerType`; Enter, Space y activación asistiva siguen usando el click semántico.
- El cambio de lado conserva la textarea activa. `useManualEditorSession` restaura el rango del lado renderizado y no llama `focus()` si la textarea ya es `document.activeElement`.
- La raíz de overlays queda debajo del footer, de modo que color/alineación siguen siendo tocables cuando hay una capa. Las paletas se limitan verticalmente a `editorMain`, por encima del footer. Cada gesto realiza exactamente un toggle y color puede reemplazarse directamente por alineación.
- “Color personalizado” es ahora un `<input type="color">` real, no controlado, transparente y de tamaño táctil, situado encima de toda el área visual. El input recibe directamente el gesto confiable; no existe ruta `showPicker()`/`input.click()` para color. La transacción nace en su `pointerdown` (o en su click semántico), antes de procesar `input`, `change` o `cancel`.
- La limpieza de `StylePanel` vuelve a marcar la instancia como montada en el segundo setup de StrictMode; así un dismiss de la pila elimina la paleta y no deja una capa visual huérfana.

No se añadió `setTimeout`, recuperación rAF de foco, `blur()`, detección de teclado, medición arbitraria, UA sniffing ni bloqueo global de `touchmove`.

## Pruebas automatizadas

- Unitarias: activación única de puntero, supresión de click compatible, click semántico, cancelación de `touchstart`, selección por lado y transacciones stale.
- Playwright móvil Chromium/WebKit: 20 cambios rápidos de lado; 20 toggles de color y 20 de alineación; mismo trigger; reemplazo color→alineación; foco DOM y trazas; cero capas/backdrops huérfanos.
- Color nativo: hit-testing prueba que `elementFromPoint` devuelve el propio input; el click directo es confiable en el harness; no se llama `showPicker()` ni `input.click()`; `input/change` aplica una vez; cancel y eventos obsoletos no cambian estilo.
- Firefox conserva los contratos DOM, teclado y accesibilidad; no certifica UI nativa móvil.

### Línea base previa

- `npm run test:manual-editor:unit`: 6/6 archivos PASS.
- `npx playwright test --list`: 69 pruebas enumeradas.
- `npm run test:manual-editor`: 51 PASS, 15 FAIL y 3 `DEVICE REQUIRED` omitidas. Eran cinco fallos por proyecto: contador de listeners sobre nodos React desconectados, expectativa stale de `tabindex` del backdrop, cleanup StrictMode de `StylePanel`, placement antiguo de la ayuda de reanudación y la prueba programática de `showPicker()`.

### Gate final

- `npm run test:manual-editor:unit`: 6/6 archivos PASS.
- `npm run build`: PASS, 2222 módulos transformados.
- Chromium móvil: 26 PASS, 1 `DEVICE REQUIRED` omitida.
- WebKit móvil: 26 PASS, 1 `DEVICE REQUIRED` omitida.
- Firefox: 26 PASS, 1 `DEVICE REQUIRED` omitida.
- `git diff --check`: PASS.

## Límite de la evidencia

Playwright WebKit demuestra orden de eventos, foco DOM, hit-testing, transiciones, accesibilidad y lifecycle. No demuestra que el OSK de iOS permanezca visible ni que el picker del sistema se presente en un iPhone. Deben repetirse `DEV-IOS-002` y los ciclos táctiles de lado/color/alineación en hardware físico; hasta entonces ambos resultados son `PENDING — DEVICE REQUIRED`.
