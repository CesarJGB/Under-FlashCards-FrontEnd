# Plan de pruebas V2 del editor manual

**Estado general:** implementación/migración de código V2 completada en los Cortes 0–5; la certificación de navegador y dispositivo sigue pendiente.
**Automatizadas:** suite determinista implementada; el resultado de la ejecución del Corte 5 está en [`manual-editor-v2-cut-5-report.md`](manual-editor-v2-cut-5-report.md).
**Físicas:** `PENDING — DEVICE REQUIRED`.
Ninguna fila de dispositivo se considera PASS por emulación, inspección estática o documentación.

## 1. Política de resultados

| Estado | Uso |
|---|---|
| `PASS` | Se ejecutó exactamente en el entorno registrado y existe evidencia. |
| `FAIL` | Se ejecutó y el resultado esperado no se cumplió; requiere issue. |
| `BLOCKED` | La ejecución empezó pero una dependencia impidió terminar. |
| `PENDING — IMPLEMENTATION REQUIRED` | Test diseñado; falta código/test runner. |
| `PENDING — DEVICE REQUIRED` | Requiere hardware/UA/IME real y no se ejecutó. |
| `NOT APPLICABLE` | Solo con justificación por entorno, nunca para ocultar ausencia de equipo. |

## 2. Herramientas y límites

### Deterministas

- `node:test` y `node:assert/strict` para reducers, geometría pura y registries.
- Fakes explícitos de window/document/nodos; no se etiquetan como navegador.
- Sin React Testing Library ni dependencia runtime.

### Navegador

- `@playwright/test` como devDependency.
- Harness Vite aislado sin auth/backend.
- Proyectos Chromium, WebKit y, como control secundario, Firefox.
- Emulación de viewport/orientación, teclado físico y eventos DOM.

Playwright no valida OSK del sistema, toolbar real de Safari, Dynamic Island, Samsung Internet ni política del host WebView.

### Dispositivo

Safari iPhone/iPad, Chrome Android, Samsung Internet y WebView host real. Se registra versión exacta y no se extrapola entre familias.

## A. Pruebas deterministas automatizables

### Geometría

| ID | Objetivo | Preparación/pasos | Resultado esperado |
|---|---|---|---|
| `UT-GEO-001` | Fallback sin VisualViewport | Proveer `innerWidth/Height` y `clientWidth/Height`; omitir VV; leer dos muestras. | Source layout-fallback, rect válido, occlusion cero/unknown, sin keyboard flag. |
| `UT-GEO-002` | No publicar snapshot idéntico | Reducer parte stable; enviar sample semánticamente igual y confirmación. | Misma referencia/estado; revisión y render counter no aumentan. |
| `UT-GEO-003` | Reset por orientación | Sample portrait estable; sample landscape; confirmación; retorno portrait. | Epoch aumenta en cada discontinuidad; nunca usa altura portrait como baseline landscape. |
| `UT-GEO-004` | Tolerar actualización tardía | Confirmar stable; enviar evento posterior con offset/height nuevo; confirmar de nuevo. | stable → settling → stable; no se descarta evento tardío ni se usa timer. |
| `UT-GEO-005` | Snapshot completo y oclusión | Proveer width/height/offsetLeft/offsetTop/scale y layout rect. | Cálculo correcto de cuatro bordes; scale conservado; ninguna causa inferida. |
| `UT-GEO-006` | Rechazar muestra inválida | Enviar NaN, infinito, width/height 0 tras una muestra válida y sin muestra previa. | Conserva última válida; sin previa produce fallback/unavailable, nunca CSS negativo. |

### Sesión, selección y foco

| ID | Objetivo | Preparación/pasos | Resultado esperado |
|---|---|---|---|
| `UT-SES-001` | Apertura y un solo intento | OPEN; FOCUS_ATTEMPTED; FOCUS_OBSERVED o FAILED repetido. | Una intención inicial; evento repetido idempotente; OSK no aparece en estado. |
| `UT-SES-002` | Selección por lado | Guardar rangos/direcciones diferentes; alternar Q→A→Q. | Cada lado restaura su propio objeto. |
| `UT-SES-003` | Acotar e invalidar rango | Rango mayor al valor; cambio de longitud; cambio same-length con revision distinta. | Clamp cuando válido; revisión distinta impide restauración ciega; ninguna excepción causa focus retry. |
| `UT-SES-004` | Preset no es picker | OPEN_LAYER color; PRESET_APPLIED; DISMISS. | Picker sigue idle; resume reason no cambia; una capa menos. |
| `UT-SES-005` | CTA no bloqueante | FOCUS_FAILED o picker return; INPUT_OBSERVED y RESUME_ACTIVATED. | Resume disponible solo como affordance; input lo retira; no existe flag touch/keyboard. |
| `UT-SES-006` | Composición | COMPOSITION_STARTED; value events; SIDE_REQUESTED; COMPOSITION_ENDED. | No restaura/muta en preedición; transición final usa selección posterior. |

### Pickers

| ID | Objetivo | Preparación/pasos | Resultado esperado |
|---|---|---|---|
| `UT-PICK-001` | Color request/commit | Crear transaction 1; external; input/change; repetir change. | Un commit, changed=true, evento repetido no-op y retorno a idle controlado. |
| `UT-PICK-002` | Cancel/unknown | Transaction 2; return signal; cancel o resolve manual; enviar evento de transaction 1. | Unknown no muta color; cancel no muta; evento viejo ignorado. |
| `UT-PICK-003` | Imagen | Request con side/rango; commit file metadata, cancel y unknown en casos separados. | Solo commit llama integración externa; todos preservan sesión/rango y ofrecen retorno apropiado. |
| `UT-PICK-004` | Fallback de capacidad | Stub `showPicker` ausente, exitoso y lanzando; spy de `click`. | Ausente/rechazo llama click una vez en handler; éxito no duplica; ningún timeout/rAF. |

### Capas, foco y Back

| ID | Objetivo | Preparación/pasos | Resultado esperado |
|---|---|---|---|
| `UT-LAY-001` | Toggle atómico | TOGGLE color cerrado; TOGGLE color abierto. | [color] → []; nunca close+reopen. |
| `UT-LAY-002` | Cierre superior | Abrir align y sheet; backdrop/close. | Solo último se retira; propietario inferior permanece. |
| `UT-LAY-003` | Escape único | Dos capas y callback spies; DISMISS_TOP escape. | Un callback; evento no llega al root. |
| `UT-LAY-004` | Back + sentinel | Root con hija; POP; rearm; POP con root. | Primer POP cierra hija/rearma; segundo cierra root/no rearma. |
| `UT-LAY-005` | Retorno desconectado | Registrar target; marcar `isConnected=false`; cerrar. | No llama focus al nodo; usa resolver fallback o ninguno. |
| `UT-LAY-006` | Evento stale | Quitar capa y luego ejecutar su callback/evento. | No cambia stack ni capa nueva. |

### Scroll y lifecycle

| ID | Objetivo | Preparación/pasos | Resultado esperado |
|---|---|---|---|
| `UT-SCR-001` | Último owner | Dos leases sobre mismo fake root; liberar uno y luego otro. | Primer release mantiene lock/inert; segundo restaura exactamente. |
| `UT-SCR-002` | Restaurar originales | Root inicia con overflow/overscroll/inert no default y scroll offsets. | Último release restablece valores exactos, no valores hardcoded. |
| `UT-SCR-003` | Release idempotente | Llamar dos veces release y desmontar. | Sin underflow ni restauración doble. |
| `UT-LIFE-001` | Cleanup completo | Registrar fakes de listeners/rAF/observer; close durante settling. | Todos removidos/cancelados una vez; callback tardío no publica. |
| `UT-LIFE-002` | StrictMode | setup→cleanup→setup→cleanup con mismo owner lógico. | Cero owners/listeners/registry al final. |
| `UT-ARCH-001` | Exclusiones | Inspeccionar imports/símbolos del grafo V2. | No `useKeyboardHeight`, UA sniff, keyboardOpen, timers 80/250/450 ni `interactive-widget`. |

### ActionSheet compartido

| ID | Objetivo | Preparación/pasos | Resultado esperado |
|---|---|---|---|
| `UT-AS-001` | Registry top-only | Registrar dos sheets y ColorPalette hija; Escape/Back. | Cierra paleta, sheet superior, inferior; uno por evento. |
| `UT-AS-002` | Modal scope | Lower sheet + top sheet; cambiar top y liberar. | Solo top focusable/interactivo; backdrop fuera de tab order; inert se restaura. |

## B. Pruebas de navegador automatizables

### Configuración

| Proyecto | Viewports mínimos |
|---|---|
| Chromium | 320×568, 390×844, 844×390, desktop con teclado |
| WebKit | 320×568, 393×852, 852×393, zoom CSS/visual controlado donde sea posible |
| Firefox | Control de semántica/foco; no sustituye targets móviles |

Cada spec corre con `prefers-reduced-motion: reduce` y normal cuando la animación sea relevante.

### Casos

| ID | Objetivo | Pasos | Resultado esperado |
|---|---|---|---|
| `PW-CHAR-001` | Caracterizar apertura Fase 2 | En Corte 0, abrir/cerrar el editor actual en fixtures vacío/largo y registrar foco, geometría y owners sin afirmar OSK. | Evidencia reproducible del commit base; `KEEP` observables protegidos; P0 documentados como deuda, no aprobados. |
| `PW-CHAR-002` | Caracterizar menú/preset actual | Abrir/cerrar color y alineación con mismo trigger, preset y backdrop; instrumentar eventos de picker. | Secuencia actual registrada; preset útil protegido y carrera conocida etiquetada. |
| `PW-CHAR-003` | Caracterizar cierre actual | Con modal/paleta/sheet fixtures, enviar Escape y observar callbacks/capas. | Orden actual reproducible; cualquier cierre múltiple queda como test rojo o `fixme` con ID P0. |
| `PW-OPEN-001` | Abrir/cerrar estable | Click trigger Q; comprobar dialog, textarea, resume UI; cerrar; repetir 20 veces. | Una modal, contenido intacto, retorno lógico, cero owners/listeners acumulados. |
| `PW-SIDE-001` | Rango Q/A | Escribir valores; seleccionar rangos distintos con DOM API; alternar 3 veces. | Rango correcto por lado, con clamp al cambiar valor. |
| `PW-MENU-001` | Toggle/preset | Abrir color; pulsar mismo botón; abrir de nuevo; preset; backdrop; alineación. | Una transición por gesto; preset no activa picker; ninguna reapertura. |
| `PW-PICK-001` | Activación color | Spy/stub `showPicker`; activar con click, Enter y Space; probar ausencia/rechazo. | Handler semántico; fallback una vez; pointerdown solo no abre. |
| `PW-PICK-002` | Imagen commit/cancel/unknown | `setInputFiles`; disparar cancel soportado y return signal fake. | Solo archivo cambia imagen; otros no; CTA no bloquea textarea. |
| `PW-GEO-001` | Small viewport/orientation | Inyectar muestras; 390×844→844×390→390×844; offsetLeft/scale. | Epoch y frame correctos; footer/text area accesibles; no keyboard flag. |
| `PW-GEO-002` | Snapshot idéntico | Emitir 100 resize/scroll con misma muestra y leer render counter. | Sin 100 renders; máximo transición necesaria. |
| `PW-ESC-001` | Escape por stack | Editor→color→Escape→Escape. Repetir con sheet fixture. | Primero hija, después root; no doble close. |
| `PW-BACK-001` | Historia | Abrir root/hija; `page.goBack()`; verificar hija; volver a back. | Sentinel rearma una vez y root cierra después; URL/state previo preservado. |
| `PW-SCROLL-001` | Scroll owners | Preposicionar App main; abrir editor; scroll main editor, textarea y paleta; intentar App. | App estable; tres scroll internos funcionan; release restaura posición. |
| `PW-A11Y-001` | Tab y roles | Teclado: abrir modal/menu/sheet; Tab/Shift+Tab; Escape. | Fondo inert, orden lógico, popover no aria-modal, backdrop no tabbable. |
| `PW-LIFE-001` | Unmount hostil | Desmontar durante rAF, layer abierta y picker unknown; remontar. | Sin errores ni callbacks stale; segunda instancia funciona. |
| `PW-VIS-001` | Regresión visual | Capturas de fixtures short/long, portrait/landscape, resume, palette, sheet. | Diffs dentro del umbral aprobado; sin clipping/horizontal scroll. |
| `PW-AS-001` | Options-only | Abrir ActionSheet DeckCard/fixture; navegar/cerrar. | Opción final accesible, foco/restauración correctos. |
| `PW-AS-002` | Custom + footer | Style sheet con LivePreview/StylePanel; abrir palette. | Palette dentro de scope; footer alcanzable; no preserveFocus contradictorio. |
| `PW-AS-003` | Sheets consecutivos | Fixtures ScheduleCalendar con dos sheets. | Solo top recibe eventos/scroll lock. |
| `PW-AS-004` | Texto largo/200% | Aumentar font/zoom y viewport landscape; llegar a última acción. | Scroll interno llega al final; nada queda bajo bounds simulados. |

### Evidencia de Playwright

Por spec fallido o gate:

- `trace.zip`;
- screenshot antes/después;
- vídeo cuando la secuencia sea temporal;
- console/network errors;
- `diagnostics.jsonl` sin texto de tarjeta;
- proyecto, viewport, commit y seed.

## C. Pruebas físicas obligatorias

Todas las filas empiezan en `PENDING — DEVICE REQUIRED`.

### iPhone y iPad

| ID / estado | Objetivo | Pasos | Resultado esperado / evidencia |
|---|---|---|---|
| `DEV-IOS-001` — PENDING — DEVICE REQUIRED | Foco inicial, OSK y toolbar Safari | iPhone Dynamic Island; toolbar expandida. Abrir Q, escribir, cerrar OSK, retraer toolbar, repetir 3 veces. | Sin pérdida/hueco persistente; si focus no abre OSK, textarea/CTA permiten reanudar. Vídeo + geometry JSONL. |
| `DEV-IOS-002` — PENDING — DEVICE REQUIRED | Color custom | Con selección y OSK, abrir custom; elegir; repetir cancelando; volver a escribir. | OSK puede cerrar; contenido/rango recuperable; commit único; cancel sin cambio. Vídeo continuo. |
| `DEV-IOS-003` — PENDING — DEVICE REQUIRED | Rotation + safe area | Abrir en portrait; color/alineación; rotar a ambos landscape; OSK; volver. | Insets cuatro bordes, footer/paleta alcanzables, epoch sin baseline viejo. Capturas en cada orientación. |
| `DEV-IOS-004` — PENDING — DEVICE REQUIRED | Scroll lock + zoom | Pre-scroll App; modal+OSK; arrastrar fondo/bordes; pinch 200%; cerrar. | App no se desplaza/activa; editor/textarea sí; zoom preservado; release exacto. Vídeo + scroll offsets. |
| `DEV-IOS-005` — PENDING — DEVICE REQUIRED | iPhone pequeño/notch | Repetir open, textarea 30 líneas, footer, picker en dispositivo de baja altura. | Todas las acciones alcanzables; sin CTA que cubra texto. |
| `DEV-IPAD-001` — PENDING — DEVICE REQUIRED | Teclado físico | iPad Safari con teclado conectado; Tab/escritura/menus/Escape/rotation. | Sin falsa oclusión ni overlay; foco y selección funcionan; evidence del teclado conectado. |
| `DEV-IPAD-002` — PENDING — DEVICE REQUIRED | Safari iPad + VoiceOver | Activar VoiceOver; recorrer modal/paleta/sheet y cerrar. | Fondo no navegable; nombres/estado; retorno lógico. Grabación de pantalla con audio si política permite. |

### Android

| ID / estado | Objetivo | Pasos | Resultado esperado / evidencia |
|---|---|---|---|
| `DEV-AND-001` — PENDING — DEVICE REQUIRED | Chrome + Gboard | Pixel/equivalente; abrir/escribir; Back; reanudar; picker color/imagen; landscape. | Back cierra una capa; no salto persistente por preventScroll; contenido intacto. |
| `DEV-AND-002` — PENDING — DEVICE REQUIRED | Segundo IME | Mismo flujo con Samsung Keyboard/SwiftKey u otro disponible. | Composición, altura variable y sugerencias no corrompen valor/layout. |
| `DEV-SAM-001` — PENDING — DEVICE REQUIRED | Samsung Internet | Galaxy; repetir open, menus, custom color, Back, 200% y rotation. | No se infiere desde Chrome; todas las garantías V2 verificadas con versión registrada. |
| `DEV-WV-001` — PENDING — DEVICE REQUIRED | WebView M139+ | Host real; registrar paquete/config; abrir IME, picker y Back. | VV/host entregan geometría útil o fallback; release y Back según contrato del host. |
| `DEV-WV-002` — PENDING — DEVICE REQUIRED | WebView <M139/host sin resize | Si se dispone, repetir en portrait/landscape. | Layout recuperable; se puede ocultar IME y llegar a footer; no useKeyboardHeight. Si no hay equipo: BLOCKED, no PASS. |
| `DEV-AND-HW-001` — PENDING — DEVICE REQUIRED | Teclado físico Android | Conectar teclado; escribir, Tab, Escape, touch alternado. | CTA no bloquea; no se inventa OSK; focus order usable. |
| `DEV-AX-AND-001` — PENDING — DEVICE REQUIRED | TalkBack | Recorrer modal, popover, sheet; Back. | Scope modal correcto y una capa por acción. |

### Pickers, ActionSheet y variantes

| ID / estado | Objetivo | Pasos | Resultado esperado / evidencia |
|---|---|---|---|
| `DEV-PICK-IMG-001` — PENDING — DEVICE REQUIRED | Imagen en iOS/Android/Samsung | Elegir imagen, cancelar y volver desde multitarea en cada familia. | Solo change válido actualiza; unknown no destruye; reanudar disponible. |
| `DEV-AS-001` — PENDING — DEVICE REQUIRED | ActionSheet con OSK | Input enfocado → sheet normal/style → última acción → close; portrait/landscape. | Scroll interno completo, fondo inert, foco lógico; un layer. |
| `DEV-CUTOUT-001` — PENDING — DEVICE REQUIRED | Notch/Dynamic Island/cutout | Controles extremos en cuatro bordes, dos landscape. | Ningún control bajo recorte/gesto; sin constantes por modelo. |
| `DEV-HOME-001` — PENDING — DEVICE REQUIRED | Safari Home Screen | Lanzar standalone y repetir IOS-001/003. | Sin toolbar no hay padding fantasma; state/leases iguales. |

## 4. Evidencia obligatoria

Cada ejecución física guarda:

```json
{
  "testId": "DEV-IOS-001",
  "status": "PASS|FAIL|BLOCKED",
  "commit": "<sha>",
  "device": {"maker":"","model":"","cutout":""},
  "software": {"os":"","browser":"","version":"","mode":""},
  "input": {"ime":"","language":"","hardwareKeyboard":false},
  "orientationSequence": ["portrait","landscape","portrait"],
  "zoom": "100%",
  "resultNotes": "",
  "artifacts": ["video.mp4","geometry.jsonl","before.png","after.png"]
}
```

`geometry.jsonl` puede incluir timestamps relativos, event type, rects, phase, active element tag/test-id, layer IDs, owner counts y scroll offsets. Nunca valores, nombres de mazos, texto, archivos ni imágenes del usuario.

## 5. Criterio por gate

| Gate | Automatizadas | Físicas mínimas |
|---|---|---|
| Corte 1 | SES/PICK + PW SIDE/MENU/PICK | IOS-002, AND-001, SAM-001, PICK-IMG-001 antes de release |
| Corte 2 | GEO + PW GEO/VIS | IOS-001/003/005, AND-001, WV-001 |
| Corte 3 | LAY/SCR/LIFE + PW ESC/BACK/SCROLL/A11Y | IOS-004, IPAD-001/002, AND-001, AX-AND-001 |
| Corte 4 | AS + PW AS | DEV-AS-001 en iOS/Chrome/Samsung |
| Corte 5 | Suite completa + leak loop | Smoke iOS/Android y todos P0 sin FAIL abierto |

## 6. Regla de compatibilidad

Una familia solo se declara soportada por V2 cuando:

1. su versión mínima está definida;
2. las pruebas automatizables aplicables pasan;
3. la prueba física correspondiente pasa;
4. toda diferencia tiene issue/limitación y fallback;
5. la evidencia referencia el commit exacto.

Hasta entonces, la documentación usa `PENDING` o `BLOCKED`, nunca “funciona por ser Chromium/WebKit”.
