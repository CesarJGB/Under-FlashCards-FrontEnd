# Corrección de regresiones posterior al Corte 5

**Base:** `origin/main` `ff44500328fe0893dcb61c8aeab753a2d0145be1`.  
**Alcance:** editor manual; sin cambios de backend, persistencia, dependencias runtime ni diseño general del `ActionSheet`.  
**Certificación móvil:** continúa `BLOCKED — DEVICE REQUIRED`.

## Regresiones observadas

1. Después de seleccionar una imagen, la acción de reanudación aparecía como botón separado y la textarea no bajaba.
2. Cambiar rápidamente entre pregunta y respuesta podía perder el gesto útil de foco y cerrar el teclado.
3. Cerrar color o alineación pulsando otra vez su trigger podía dejar la textarea sin foco.
4. El picker de color personalizado podía validar `input/change` contra el estado React anterior a `PICKER_REQUESTED` y rechazar el commit.

## Corrección

- `ManualCardEditorModal` vuelve a mostrar la ayuda dentro de la caja del textarea. Con `resume.available`, el contenedor usa `flex-1 justify-end pb-4`; para imagen muestra `Imagen cargada / Toca aquí para seguir escribiendo`.
- Un commit de file picker ofrece reanudación de forma determinista aunque `document.activeElement` todavía apunte al textarea. Esto no intenta detectar el OSK.
- El cambio de lado asegura el foco dentro del gesto y marca ese `focusRequestId` como atendido para evitar un segundo intento en el layout effect.
- Cerrar un menú mediante su propio trigger realiza una sola transición top-only y asegura el foco en el mismo click.
- `useManualEditorSession` mantiene un snapshot sincrónico del reducer antes de delegar a React. Los callbacks del picker consultan ese snapshot, preservando tokens stale como no-op y permitiendo que el color personalizado confirme en el mismo ciclo nativo.
- El picker personalizado permanece en `onClick`; `pointerdown` no abre el selector.

## Contratos preservados

- sin `keyboardOpen`, umbrales, UA sniffing ni timers de certeza;
- input de color no controlado y `showPicker()` con fallback `click()`;
- una sola pila top-only, portal scoped, leases, `inert` y sentinel vigentes;
- selección independiente para pregunta/respuesta y composición IME;
- ningún `blur()`, `scrollIntoView()` ni bloqueo global de `touchmove`.

## Validación

- `npm run test:manual-editor:unit`: **PASS — 48 tests, 48 pass, 0 fail**.
- `npm run build`: **PASS — Vite transformó 2221 módulos**.
- `git diff --check`: **PASS — salida vacía**.
- barrido dirigido: sin `keyboardOpen`, timers de certeza, `blur()`, `scrollIntoView()`, `touchmove` global ni cambios de backend.

Las pruebas físicas en iOS/Android siguen siendo necesarias para certificar el comportamiento del OSK y los pickers nativos.
