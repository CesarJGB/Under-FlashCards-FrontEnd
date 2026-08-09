# Corrección Safari/iOS posterior al Corte 5

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
