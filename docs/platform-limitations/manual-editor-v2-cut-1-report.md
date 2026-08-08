# Informe de implementación — editor manual V2, Corte 1

**Fecha:** 2026-08-08  
**Alcance:** sesión de input, selección por lado y transacciones de picker del editor manual.  
**Estado:** implementación y validación determinista terminadas; Playwright `BLOCKED` por ausencia del ejecutable Chromium; pruebas físicas pendientes.  
**Autorización:** se aplicó la excepción expresa para iniciar el Corte 1 con G0 abierto por un bloqueo de infraestructura. No se inició el Corte 2.

## 1. Base y drift

El árbol estaba limpio antes de editar. El commit base efectivo fue `5278bd0b5416208f46d17f0d42ab53fb32af1401` (`main`, igual a `origin/main`). No se hizo commit ni push.

Desde la base efectiva documentada por el Corte 0 (`33550ae5d60f3f29933ae9ae5590aae6bd286daf`) se habían publicado el harness, la configuración Playwright, el diagnóstico y el informe del Corte 0. Se detectó un drift de rutas: el informe y los scripts npm declaraban `frontend/tests/manual-editor`, pero los seis archivos del harness habían quedado en `tests/manual-editor` en la raíz. Este corte los reubicó a la ruta que consumen Vite, Playwright y los scripts npm. El placeholder ajeno `tests/manual-editor/Test` se conservó sin cambios.

No había drift previo en `ManualCardEditorModal.jsx`, `StylePanel.jsx`, `FormInputs.jsx`, `ActionSheet.jsx` ni backend respecto de ese cierre publicado del Corte 0.

## 2. Archivos

### Creados

- `frontend/src/components/creator/manual-editor/manualEditorSession.js`
- `frontend/src/components/creator/manual-editor/useManualEditorSession.js`
- `frontend/src/components/creator/manual-editor/manualEditorSession.test.js`
- `docs/platform-limitations/manual-editor-v2-cut-1-report.md`

### Modificados

- `frontend/src/components/creator/ManualCardEditorModal.jsx`
- `frontend/src/components/creator/StylePanel.jsx`
- `frontend/package.json`, solo para ampliar el script de tests; sin dependencia nueva
- `frontend/tests/manual-editor/harness.jsx`
- `frontend/tests/manual-editor/manual-editor-contracts.test.js`
- `frontend/tests/manual-editor/manual-editor-current.spec.js`
- `docs/platform-limitations/README.md`

### Reubicados sin cambiar su propósito

- `tests/manual-editor/evidence-schema.json` → `frontend/tests/manual-editor/evidence-schema.json`
- `tests/manual-editor/harness.html` → `frontend/tests/manual-editor/harness.html`
- `tests/manual-editor/vite.harness.config.js` → `frontend/tests/manual-editor/vite.harness.config.js`
- los tres archivos de harness/tests anteriores también pasaron de la raíz a `frontend/tests/manual-editor` y se actualizaron allí para el Corte 1

`FormInputs.jsx` no necesitó cambios: las props controladas existentes siguen siendo la autoridad de valores e integración. Backend, `ActionSheet`, `useKeyboardHeight`, locks, shell y persistencia no cambiaron.

## 3. Arquitectura implementada

`manualEditorSession.js` contiene un reducer puro. Posee fase de sesión, lado activo, transición pendiente durante IME, foco DOM observado, intención de foco/reanudación, metadatos `{valueLength, valueRevision}`, selecciones independientes de pregunta y respuesta y la submáquina transaccional de picker. Cada selección guarda `{selectionStart, selectionEnd, selectionDirection, valueLength, valueRevision}` además de sus alias internos cortos.

El reducer no posee texto, estilos persistidos, imagen, geometría, estado supuesto del teclado, nodos DOM, capas ni persistencia. Pregunta y respuesta continúan controladas por las props existentes.

`useManualEditorSession.js` adapta el reducer al `textarea` nativo:

- hay un único owner del intento inicial de foco;
- `focus({preventScroll:true})` se intenta una vez y solo cae a `focus()` si la firma lanza;
- observar foco y restaurar rango son operaciones separadas;
- una excepción de `setSelectionRange` termina la restauración y no vuelve a enfocar;
- el cambio de lado captura el rango actual, espera `compositionend` si hay IME y valida longitud/revisión antes de restaurar el rango del nuevo lado;
- un rango obsoleto produce un caret seguro al final;
- `beforeinput`/`input` retiran la ayuda de reanudación;
- `window.focus` y `visibilitychange` solo publican un retorno posible del picker.

No se modela ni se afirma la apertura del OSK.

## 4. Color, imagen y acciones DOM

El color personalizado se abre únicamente desde el `onClick` semántico del botón. En ese mismo call stack se captura lado/rango, se crea `transactionId`, se sincroniza el `input[type=color]` no controlado y se intenta `showPicker()` con fallback inmediato a `input.click()`. No hay timeout ni `requestAnimationFrame` en la activación.

La submáquina común usa `kind=color|image` y los estados `idle`, `requested`, `external`, `committed`, `cancelled` y `returned-unknown`. `input` actualiza un draft idempotente, `change` confirma una sola vez, `cancel` no aplica contenido, un retorno posible no inventa cancelación y eventos con un ID anterior son no-op. Un `change` tardío de la transacción vigente sigue siendo confirmable.

El selector de imagen limpia el valor antes de `click()` para permitir el mismo archivo, conserva el handler y formato existentes y solo invoca la integración externa después de un commit vigente.

Los presets, “sin color”, alineación, negrita y cursiva son acciones DOM: aplican una vez, cierran solo su menú cuando corresponde, conservan el rango compatible y no crean una transacción ni una ayuda de picker. El toggle del mismo trigger se resolvió con el estado local existente; no se creó un sistema de capas.

La ayuda anterior que cubría el `textarea` fue sustituida por un botón compacto, accesible y situado después de la superficie editable. No intercepta caret, selección, scroll, teclado físico, copiar/pegar ni exploración asistiva.

## 5. Código legado retirado

Se retiraron del flujo manual:

- la única `selectionRef` compartida;
- `autoFocus`, el foco inmediato competidor y el retry en `requestAnimationFrame`;
- apertura de color personalizado desde `pointerdown`;
- `customColorChangedRef`, cierre por blur y timer de 80 ms;
- `pickerReturnTimerRef` y certeza por 250 ms para imagen;
- `guardKeyboardResumeAfterMenu`, `menuKeyboardGuardTimerRef` y timer de 450 ms;
- mutación general de historia de teclado al cerrar cualquier menú;
- refs espejo de menú/picker e intentos duplicados de restauración del flujo manual.

No se retiraron portales, `VisualViewport`, scroll interno, safe area, `ActionSheet`, `input[type=color]` no controlado ni el fallback estándar.

## 6. Compatibilidad temporal para Corte 2

`viewportFrame` y su booleano heredado `keyboardOpen` permanecen exclusivamente como adaptador visual de altura/offset y padding inferior. Ambos puntos están marcados `@remove-in-cut-2`. No escriben en el reducer, no poseen selección o picker, no disparan foco y no se usan para afirmar que el OSK está visible.

No se introdujeron `useEditorGeometry`, `EditorGeometrySnapshot`, nuevas reglas de safe area ni otra heurística. Tampoco se implementaron `OverlayScope`, `OverlayStack`, `ScrollLease`, sentinel de historial, refactor de Back, migración de `ActionSheet` ni código de los Cortes 3–5.

## 7. Pruebas ejecutadas

La advertencia npm `Unknown env config "http-proxy"` apareció durante comandos npm y no alteró sus códigos de salida.

| Comando | Resultado real |
|---|---|
| `npm ci` | PASS; 217 paquetes. |
| `npm run build` antes de instalar | FAIL esperado de entorno: `vite: not found`; se repitió solo después del `npm ci` obligatorio. |
| `npm run test:manual-editor:unit` | PASS; 20/20: `UT-SES-001..006`, `UT-PICK-001..004` y 10 contratos estáticos. |
| `npm run build` final | PASS; Vite 5.4.21, 2214 módulos. |
| `npm run test:pdf-extraction` | PASS; 8/8. |
| `npm run test:schedule` | PASS; 44/44. |
| build aislado del harness con su configuración Vite | PASS; 1570 módulos. |
| `npx playwright test … --list --reporter=line` | PASS; 36 casos enumerados, 12 por proyecto. No abre navegadores. |
| único intento `npm run test:manual-editor -- --project=chromium` | `BLOCKED`; los 11 casos ejecutables no llegaron a abrir una página porque falta `/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`. No se descargaron binarios ni se reintentó. |
| `git diff --check` | PASS. |
| `git diff --name-only -- backend` | PASS; vacío. |

Playwright no se declara `PASS`. Sus specs y harness quedan preparados para ejecución posterior. El resultado `BLOCKED` es de infraestructura y coincide con la excepción autorizada.

## 8. Comprobaciones estáticas

- ningún picker se abre desde `pointerdown`;
- no quedan los timers de 80/250 ms ni el guard/timer de 450 ms;
- presets y alineación no despachan `PICKER_REQUESTED`;
- pregunta y respuesta tienen objetos de selección separados;
- las transacciones anteriores se ignoran por ID;
- la CTA no es `absolute inset-0` y está fuera del `textarea`;
- no se importó `useKeyboardHeight`;
- `frontend/package-lock.json` no cambió y no hay dependencia runtime nueva;
- backend no cambió;
- no hay implementación de los Cortes 2–5.

## 9. Validación manual preparada, no ejecutada

En iPhone queda pendiente comprobar:

1. Abrir editor y escribir.
2. Alternar pregunta/respuesta tres veces.
3. Seleccionar texto y aplicar preset.
4. Abrir color personalizado y elegir color.
5. Volver a escribir después del picker.
6. Cancelar picker.
7. Elegir y cancelar imagen.
8. Usar teclado físico si está disponible.
9. Comprobar que la ayuda no cubre el textarea.
10. Confirmar que no se perdió contenido.

Estos pasos no se ejecutaron ni se marcan como PASS. Las filas físicas de iPhone, iPad, Android, Samsung Internet y WebView del plan siguen `PENDING — DEVICE REQUIRED`.

## 10. Riesgos y condición para comenzar Corte 2

Riesgos abiertos:

1. Playwright no pudo observar el runtime por falta del binario Chromium; WebKit y Firefox tampoco se declaran disponibles ni probados.
2. La temporización real de `cancel`, `change` tardío, pérdida de foco y cierre inevitable del OSK depende del host y necesita dispositivo real.
3. La geometría heredada conserva falsos positivos conocidos hasta el Corte 2, aunque quedó aislada de sesión y picker.
4. El portal y el orden definitivo de capas siguen pendientes del Corte 3; el toggle local evita reabrir el mismo menú, pero no sustituye `OverlayStack`.

El Corte 2 puede evaluarse únicamente cuando build, suites deterministas, contratos y `git diff --check` permanezcan verdes sobre este diff, un revisor acepte la evidencia `BLOCKED` bajo la excepción vigente y el alcance del Corte 1 no presente regresiones de contenido. La ejecución posterior de Playwright y las pruebas físicas deben conservarse como deuda explícita; no pueden convertirse en PASS por inferencia. Este informe no autoriza ni inicia el Corte 2.
