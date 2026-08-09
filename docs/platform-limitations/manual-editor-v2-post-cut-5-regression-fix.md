# Corrección de regresiones posterior al Corte 5

**Base inicial:** `origin/main` `ff44500328fe0893dcb61c8aeab753a2d0145be1`.

**Revisión profunda:** `origin/main` `318e0d93909fbea6c6dd98a4854095ed1a37116a`.

**Alcance:** editor manual; sin cambios de backend, persistencia, dependencias runtime ni diseño general del `ActionSheet`.

**Certificación móvil:** continúa `BLOCKED — DEVICE REQUIRED`.

## Regresiones observadas

1. Después de seleccionar una imagen, la acción de reanudación aparecía como botón separado y la textarea no bajaba.
2. Cambiar rápidamente entre pregunta y respuesta podía perder el gesto útil de foco y cerrar el teclado.
3. Cerrar color o alineación pulsando otra vez su trigger podía dejar la textarea sin foco.
4. El picker de color personalizado podía validar `input/change` contra el estado React anterior a `PICKER_REQUESTED` y rechazar el commit.

La primera corrección no resolvió los puntos 2–4 en uso real. El diagnóstico profundo confirmó que esas acciones todavía ocurrían en `click`, después del momento en que iOS puede iniciar la transferencia de foco; un `focus()` posterior no garantiza recuperar el OSK. El color personalizado también había abandonado la ruta `pointerdown` que sí abría el picker en la implementación funcional anterior.

## Corrección

- `ManualCardEditorModal` vuelve a mostrar la ayuda dentro de la caja del textarea. Con `resume.available`, el contenedor usa `flex-1 justify-end pb-4`; para imagen muestra `Imagen cargada / Toca aquí para seguir escribiendo`.
- Un commit de file picker ofrece reanudación de forma determinista aunque `document.activeElement` todavía apunte al textarea. Esto no intenta detectar el OSK.
- Cambio de lado y triggers de color/alineación usan `handleFocusPreservingPress`: el puntero ejecuta en `pointerdown` primario con `preventDefault` y su click de compatibilidad es no-op; teclado/AT conserva click semántico.
- `attemptFocus` no vuelve a llamar `focus()` cuando la textarea ya es `document.activeElement`; el layout effect solo restaura el rango del lado ya renderizado.
- Cerrar un menú mediante su propio trigger realiza una sola transición top-only antes de que el trigger pueda recibir foco.
- `useManualEditorSession` mantiene un snapshot sincrónico del reducer antes de delegar a React. Los callbacks del picker consultan ese snapshot, preservando tokens stale como no-op y permitiendo que el color personalizado confirme en el mismo ciclo nativo.
- El picker personalizado vuelve a abrirse en `pointerdown` para puntero, con la transacción creada antes de `showPicker()`/`input.click()`. Enter, Space y AT siguen usando `click` semántico, sin doble solicitud.

## Contratos preservados

- sin `keyboardOpen`, umbrales, UA sniffing ni timers de certeza;
- input de color no controlado y `showPicker()` con fallback `click()`;
- una sola pila top-only, portal scoped, leases, `inert` y sentinel vigentes;
- selección independiente para pregunta/respuesta y composición IME;
- ningún `blur()`, `scrollIntoView()` ni bloqueo global de `touchmove`.

## Validación

- `npm run test:manual-editor:unit`: **PASS — 51/51 pruebas**.
- `npm run build`: **PASS — Vite transformó 2222 módulos**.
- `npx playwright test --list`: **PASS — 69 pruebas enumeradas** (23 por Chromium, WebKit y Firefox).
- ejecución Playwright en navegadores: **BLOCKED — los binarios de Chromium, WebKit y Firefox no están instalados en este entorno**; no se descargaron durante esta revisión.
- `git diff --check`: **PASS — salida vacía**.
- barrido dirigido: sin `keyboardOpen`, timers de certeza, `blur()`, `scrollIntoView()`, `touchmove` global ni cambios de backend.

Las pruebas físicas en iOS/Android siguen siendo necesarias para certificar el comportamiento del OSK y los pickers nativos.
