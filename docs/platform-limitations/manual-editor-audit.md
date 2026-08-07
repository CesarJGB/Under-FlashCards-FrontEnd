# Auditoría profunda del editor manual

**Fase:** 2 — diagnóstico y arquitectura de problemas.  
**Commit auditado:** `bc541f930f7fc6e3eb055adb0cb4a232d5099b5c`.  
**Fecha:** 2026-08-07.  
**Alcance de cambios:** documentación solamente; no se modificó comportamiento de aplicación.

## Dictamen

El editor no necesita “más detección de teclado”. Necesita reducir sus fuentes de verdad. La geometría base con VisualViewport, el `textarea` nativo, los portales y los scroll containers internos son decisiones valiosas. Sobre esa base se acumularon un booleano absoluto `keyboardOpen`, dos detectores, cuatro temporizaciones, tres restauradores de foco, dos sistemas de scroll lock y tres modelos de overlay. Varias de esas capas ya compiten.

Los bloqueadores P0 antes de diseñar V2 son:

| ID | Bloqueador |
|---|---|
| `EDITOR-COLOR-001` | El picker custom se invoca en `pointerdown`; en touch la activación normativa llega en `pointerup`, y el botón no tiene ruta `click`/teclado. |
| `EDITOR-VV-001` | El baseline de altura solo crece; rotar a landscape puede convertirse determinísticamente en `keyboardOpen=true`. |
| `EDITOR-KB-001` / `EDITOR-SAFE-001` | Una reducción de 100 px se trata como teclado real y decide safe area. |
| `EDITOR-COLOR-004` | Cerrar cualquier menú borra la historia de teclado y puede desactivar la ayuda de reanudación. |
| `EDITOR-FOCUS-003` | El diálogo manual no contiene/restaura foco ni vuelve inert el shell desplazable inferior. |
| `EDITOR-COLOR-005` / `EDITOR-FOCUS-003` / `EDITOR-AS-001` | Portales y `preserveFocus` producen diálogos declarados modales con el foco fuera de ellos. |

La auditoría es estática y normativa: los errores deterministas se prueban por flujo de código; las diferencias de implementación se clasifican con la documentación de Fase 1. Los resultados visuales que dependen del dispositivo deben ejecutarse con [`testing-checklist.md`](testing-checklist.md); no se presentan como pruebas físicas ya realizadas.

## Escala

- **Critical:** bloquea la interacción primaria o carece de ruta accesible/portable.
- **High:** puede dejar editor, foco, teclado, safe area, scroll o modalidad en estado incoherente.
- **Medium:** degradación visible, deuda que agrava carreras o fallo de caso secundario.
- **Low:** coste o redundancia sin fallo primario inmediato.

Las prioridades son de arquitectura, no autorización de implementación: P0 antes de V2, P1 en su primera implementación, P2 en estabilización y P3 como limpieza posterior.

## Hallazgos: teclado, viewport y safe area

### EDITOR-KB-001 — `keyboardOpen` eleva una inferencia a contrato

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `frontend/src/components/creator/ManualCardEditorModal.jsx:190-214`, `291-311`, `380-386`, `554`.
- **Comportamiento actual:** una diferencia mayor de 100 px entre `visualViewport.height` y el máximo de alturas de layout produce un booleano llamado `keyboardOpen`; ese valor mueve UI, elimina safe area, alimenta historial y se expone como atributo DOM.
- **Problema:** VisualViewport solo demuestra geometría. Zoom, toolbar y orientación pueden activar exactamente la misma rama. El código ya no usa la señal como heurística limitada, sino como fuente de verdad para cuatro decisiones.
- **Navegadores afectados:** todos con VisualViewport; riesgo mayor en Safari iOS con toolbar dinámica y en zoom móvil.
- **Evidencia en platform-limitations:** [`virtual-keyboard.md`](virtual-keyboard.md), “Lo que la web puede y no puede saber”; [`viewport-and-safe-area.md`](viewport-and-safe-area.md), “Cuatro conceptos”.
- **Gravedad:** High.
- **Tipo:** Heuristic / Architecture.
- **Solución conceptual recomendada:** publicar geometría observable y una confianza de oclusión acotada (`unknown`, `settling`, `likely-occluded`), nunca un estado factual de teclado. Cada consumidor debe declarar por qué necesita esa inferencia.
- **NO hacer:** renombrar el umbral sin desacoplar sus consumidores ni sustituir 100 por otro número “más preciso”.
- **Riesgo de regresión:** alto; cambia footer, CTA, altura y retorno de menús.
- **Prioridad:** P0.

### EDITOR-KB-002 — existen dos detectores y una historia paralela

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:186-227`, `245-311`; refs `keyboardWasOpenRef`, `resumeRequestedRef`, estado `focusResumeReason`.
- **Comportamiento actual:** el efecto de viewport calcula `keyboardOpen`; 450 ms después otro efecto repite la fórmula con un baseline distinto; un tercer efecto mantiene historia en refs y decide el CTA.
- **Problema:** los tres caminos pueden observar frames diferentes y no tienen una transición atómica. Estado React y refs pueden describir realidades incompatibles sin producir un render que los reconcilie.
- **Navegadores afectados:** todos; la carrera es más probable durante animaciones tardías de Safari y cambios rápidos de Android IME.
- **Evidencia en platform-limitations:** [`virtual-keyboard.md`](virtual-keyboard.md), “Orden y temporización de eventos” y modelo permitido.
- **Gravedad:** High.
- **Tipo:** Architecture / Redundant workaround.
- **Solución conceptual recomendada:** un solo snapshot de runtime con timestamp/fase; el CTA debe derivarse de intención de edición + capacidad de reanudación, no de refs independientes.
- **NO hacer:** añadir un tercer timeout o leer `activeElement` como desempate de teclado.
- **Riesgo de regresión:** medio-alto; el CTA puede aparecer o desaparecer en momentos distintos.
- **Prioridad:** P1.

### EDITOR-KB-003 — touch se confunde con necesidad de teclado virtual

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:44-47`, `245-277`, `290-311`, `596-614`.
- **Comportamiento actual:** en cualquier equipo con touch, si el viewport no se reduce tras 450 ms, se cubre el textarea con “Toca para comenzar”.
- **Problema:** iPad/Android con teclado físico y equipos híbridos pueden tener foco y entrada funcional sin OSK. El overlay tapa visualmente un control que ya puede recibir texto y convierte una ausencia de reducción en fallo.
- **Navegadores afectados:** iPadOS, Android con teclado físico y laptops touch; también WebView que no reporta resize.
- **Evidencia en platform-limitations:** [`testing-checklist.md`](testing-checklist.md), `IN-04`; [`virtual-keyboard.md`](virtual-keyboard.md), tabla de señales.
- **Gravedad:** High.
- **Tipo:** Implementation bug / Heuristic.
- **Solución conceptual recomendada:** modelar “el usuario pidió reanudar” y ofrecer una acción no bloqueante cuando sea útil; no cubrir el campo solo porque no se observó OSK.
- **NO hacer:** detectar teclado físico por user-agent o asumir que `activeElement` implica OSK.
- **Riesgo de regresión:** medio; afecta la ayuda inicial y accesibilidad con teclado.
- **Prioridad:** P1.

### EDITOR-VV-001 — el baseline monotónico rompe orientación

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:190-203`.
- **Comportamiento actual:** `layoutHeight` es el máximo entre la altura inicial y todas las alturas posteriores.
- **Problema:** al abrir en portrait y rotar a landscape, la altura portrait permanece como baseline. Aunque no haya teclado, la altura visual landscape puede quedar más de 100 px por debajo y activar `keyboardOpen`. El baseline tampoco se reinicia cuando cambia la clase geométrica de orientación.
- **Navegadores afectados:** iOS, Chrome Android, Samsung Internet y WebView.
- **Evidencia en platform-limitations:** [`viewport-and-safe-area.md`](viewport-and-safe-area.md), “Orientación y landscape”; prueba `VP-04` de [`testing-checklist.md`](testing-checklist.md).
- **Gravedad:** High.
- **Tipo:** Implementation bug.
- **Solución conceptual recomendada:** separar baseline de layout por fase/orientación y comparar únicamente snapshots compatibles; durante transición usar `settling`.
- **NO hacer:** escuchar `orientationchange` y conservar el mismo máximo histórico.
- **Riesgo de regresión:** alto; modifica safe area y estado del footer al rotar.
- **Prioridad:** P0.

### EDITOR-VV-002 — el modal sigue solo la mitad de VisualViewport

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:201-214`, `380-382`, `558-560`.
- **Comportamiento actual:** usa `height` y `offsetTop`, pero no `width`, `offsetLeft` ni `scale`; el ancho queda en `inset-x-0` del layout viewport.
- **Problema:** con pinch zoom o pan horizontal, la superficie dice seguir VisualViewport pero sus acciones laterales siguen el layout viewport. La paleta usa un modelo más completo que su modal padre.
- **Navegadores afectados:** iOS y Android con zoom; iframes requerirían además contrato del host.
- **Evidencia en platform-limitations:** [`viewport-and-safe-area.md`](viewport-and-safe-area.md), “VisualViewport en la práctica” y `VP-07`.
- **Gravedad:** Medium.
- **Tipo:** Architecture.
- **Solución conceptual recomendada:** un snapshot geométrico completo y una política explícita: seguir VisualViewport en ambos ejes o declarar degradación de zoom sin fingir equivalencia.
- **NO hacer:** desactivar zoom ni usar un offset fijo por modelo de iPhone.
- **Riesgo de regresión:** medio; cambia anchura y posicionamiento bajo zoom.
- **Prioridad:** P1.

### EDITOR-VV-003 — cada evento de geometría puede renderizar todo el modal

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:195-220`.
- **Comportamiento actual:** los listeners leen layout y llaman `setViewportFrame` dentro del evento. La igualdad evita frames idénticos, pero una animación produce alturas distintas sucesivas.
- **Problema:** resize/scroll de VisualViewport durante OSK, toolbar o zoom puede renderizar el árbol completo por evento. No existe cola rAF ni fase estable; también se puede leer antes de la actualización tardía de WebKit.
- **Navegadores afectados:** todos; sensibilidad mayor en Safari `WK-265578` y dispositivos de gama baja.
- **Evidencia en platform-limitations:** [`virtual-keyboard.md`](virtual-keyboard.md), “Orden y temporización”; [`known-browser-bugs.md`](known-browser-bugs.md), `WK-265578`.
- **Gravedad:** Medium.
- **Tipo:** Performance / Architecture.
- **Solución conceptual recomendada:** recolectar eventos en un único frame, leer una vez, publicar solo cambios semánticos y aceptar una segunda medición.
- **NO hacer:** debounce largo que retrase el caret o anime hacia el primer valor como definitivo.
- **Riesgo de regresión:** medio; un throttle incorrecto puede dejar el footer atrás del teclado.
- **Prioridad:** P1.

### EDITOR-VV-004 — WebView antiguo/host desconocido carece de degradación explícita

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:189-214`, `380-386`.
- **Comportamiento actual:** sin un VisualViewport que cambie por IME, el frame conserva altura de layout, `keyboardOpen=false` y safe area inferior.
- **Problema:** Android WebView anterior a M139 puede no redimensionar VisualViewport independientemente. El modal mantiene scroll interno, pero no existe contrato que garantice que footer/caret permanezcan alcanzables bajo la oclusión.
- **Navegadores afectados:** Android System WebView <139 y hosts con política de insets distinta; hosts embebidos desconocidos.
- **Evidencia en platform-limitations:** [`android-chrome.md`](android-chrome.md), “Android System WebView”; [`known-browser-bugs.md`](known-browser-bugs.md), `CR-40287394`.
- **Gravedad:** High.
- **Tipo:** Browser limitation / Architecture.
- **Solución conceptual recomendada:** declarar una degradación sin geometría fiable: scroll interno completo, acción visible para foco y matriz mínima de host/version.
- **NO hacer:** importar `useKeyboardHeight` como fallback ni suponer que la versión de Chrome equivale a la de WebView.
- **Riesgo de regresión:** alto en wrappers nativos; bajo en Chrome estable.
- **Prioridad:** P1.

### EDITOR-SAFE-001 — safe area inferior depende de una heurística no estable

- **Componente:** footer de `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:384-386`, `625-628`.
- **Comportamiento actual:** `paddingBottom` pasa a cero cuando `viewportFrame.keyboardOpen` es verdadero.
- **Problema:** el workaround de `WK-217754` requiere, como mínimo, foco editable y reducción material/estable. El código usa solo el umbral; zoom, landscape o toolbar pueden retirar protección del home indicator sin OSK.
- **Navegadores afectados:** principalmente Safari iOS; el falso positivo existe en todas las plataformas con recortes.
- **Evidencia en platform-limitations:** [`known-browser-bugs.md`](known-browser-bugs.md), `WK-217754`; [`viewport-and-safe-area.md`](viewport-and-safe-area.md), “Safe area”.
- **Gravedad:** High.
- **Tipo:** Browser bug / Heuristic.
- **Solución conceptual recomendada:** propietario único del inset y supresión solo en un estado de oclusión probable, enfocado y estable; conservar fallback seguro en `unknown`.
- **NO hacer:** usar `:focus` solo ni eliminar el inset para todo iOS.
- **Riesgo de regresión:** alto; puede tapar acciones con el gesto del sistema o crear hueco sobre OSK.
- **Prioridad:** P0.

### EDITOR-SAFE-002 — no hay propietario de insets laterales

- **Componente:** modal, footer, ActionSheet y ColorPalette.
- **Código implicado:** `ManualCardEditorModal.jsx:558-562`, `629`, `654`; `ActionSheet.jsx:122-136`; `StylePanel.jsx:111-114`.
- **Comportamiento actual:** se aplican insets top/bottom, pero los laterales usan padding fijo de 8–24 px.
- **Problema:** en landscape, Dynamic Island/notch o cutouts Android pueden ocupar más que ese padding. La paleta se limita al VisualViewport y al diálogo, no a `safe-area-inset-left/right`.
- **Navegadores afectados:** iPhone con notch/Dynamic Island, Android con cutout, ambas orientaciones.
- **Evidencia en platform-limitations:** [`viewport-and-safe-area.md`](viewport-and-safe-area.md), “Dynamic Island”; pruebas `VP-05` y `AS-04`.
- **Gravedad:** High.
- **Tipo:** Implementation bug.
- **Solución conceptual recomendada:** asignar insets laterales a la superficie interactiva y compartirlos con overlays anclados.
- **NO hacer:** codificar 47 px, identificar un modelo o sumar el inset en body + modal + control.
- **Riesgo de regresión:** medio; altera el ancho útil en landscape.
- **Prioridad:** P1.

## Hallazgos: foco y selección

### EDITOR-FOCUS-001 — tres intentos compiten por el foco inicial

- **Componente:** `ManualCardEditorModal` / `textarea`.
- **Código implicado:** `ManualCardEditorModal.jsx:229-239`, `590`.
- **Comportamiento actual:** React aplica `autoFocus`; un layout effect vuelve a enfocar siempre; un animation frame lo intenta otra vez si `activeElement` no coincide.
- **Problema:** hay al menos dos llamadas en la apertura normal. Reenfocar puede restablecer selección y, en Android, desplazar pese a `preventScroll`. El frame adicional no recupera activación para OSK en iOS.
- **Navegadores afectados:** todos; scroll especialmente en Chrome Android/WebView/Samsung, OSK en iOS.
- **Evidencia en platform-limitations:** [`focus-and-input.md`](focus-and-input.md), secciones de foco y `preventScroll`; `CR-41453122`.
- **Gravedad:** Medium.
- **Tipo:** Redundant workaround.
- **Solución conceptual recomendada:** un único intento inmediato asociado a la apertura y una ruta táctil explícita; medir el resultado sin volver a disparar foco automáticamente.
- **NO hacer:** añadir más frames/promesas para “forzar” el teclado.
- **Riesgo de regresión:** medio; eliminar el intento equivocado puede reducir apertura inicial en un navegador.
- **Prioridad:** P1.

### EDITOR-FOCUS-002 — el rango no pertenece a cada lado

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `selectionRef` en `ManualCardEditorModal.jsx:79`, captura `575-587`, restauración `105-118`, cambio de lado `504-511`.
- **Comportamiento actual:** pregunta y respuesta comparten `{start,end}`; no se conserva `selectionDirection` ni se acota explícitamente contra el valor actual.
- **Problema:** cambiar de lado sobrescribe el rango del anterior. Volver puede insertar/seleccionar en la posición del otro campo; una mutación de valor vuelve obsoletos los índices.
- **Navegadores afectados:** todos.
- **Evidencia en platform-limitations:** [`focus-and-input.md`](focus-and-input.md), “textarea del editor manual”; pruebas `FO-02` e `IN-03`.
- **Gravedad:** Medium.
- **Tipo:** Implementation bug.
- **Solución conceptual recomendada:** sesión de selección por lado con rango, dirección, versión/longitud del valor y restauración solo cuando siga siendo válido.
- **NO hacer:** cambiar a Selection API del documento ni a `contenteditable` para resolverlo.
- **Riesgo de regresión:** medio; afecta formato/caret al alternar.
- **Prioridad:** P1.

### EDITOR-FOCUS-003 — el modal es visualmente modal, no modal en interacción

- **Componente:** `ManualCardEditorModal` y App shell.
- **Código implicado:** `ManualCardEditorModal.jsx:548-560`; `App.jsx:239`; ausencia de `useModalAccessibility`/`inert`/retorno de foco.
- **Comportamiento actual:** declara `role="dialog" aria-modal="true"`, cubre la pantalla y bloquea `body`; no atrapa Tab, no vuelve inert `#root`/shell, no restaura el trigger al cerrar.
- **Problema:** el scroller real bajo el portal es `App <main>`, no `body`. Teclado, lector de pantalla o foco programático pueden entrar al fondo y desplazarlo. `aria-modal` no ejecuta esas barreras.
- **Navegadores afectados:** todos; impacto alto con teclado físico, VoiceOver y TalkBack.
- **Evidencia en platform-limitations:** [`modals-and-sheets.md`](modals-and-sheets.md), “Contrato modal”; [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), “Bloqueo de scroll”.
- **Gravedad:** High.
- **Tipo:** Architecture / Implementation bug.
- **Solución conceptual recomendada:** coordinador modal que gestione inertness, foco inicial, contención, retorno y capa superior junto con el lock de scroll real.
- **NO hacer:** conectar directamente `useModalAccessibility` sin retirar `autoFocus`, Escape y restauradores actuales; crearía otra competencia.
- **Riesgo de regresión:** alto; foco, screen readers y overlays portaleados deben migrar juntos.
- **Prioridad:** P0.

### EDITOR-FOCUS-004 — restaurar en rAF no conserva OSK y puede mover Android

- **Componente:** `ManualCardEditorModal`, `StylePanel`, `ActionSheet`.
- **Código implicado:** `ManualCardEditorModal.jsx:424-453`; `StylePanel.jsx:318-340`; `ActionSheet.jsx:54-76`.
- **Comportamiento actual:** cada superficie guarda `activeElement` y enfoca después o al desmontar con `preventScroll`.
- **Problema:** la restauración diferida está fuera de la activación que abrió/cerró el picker, por lo que iOS no promete OSK. En Android `preventScroll` puede ignorarse. Manual además reenfoca aun si el target sigue activo.
- **Navegadores afectados:** Safari/WebKit iOS; Chrome Android, WebView y Samsung Internet.
- **Evidencia en platform-limitations:** [`ios-safari.md`](ios-safari.md), “Foco”; [`focus-and-input.md`](focus-and-input.md), “preventScroll”; `WK-195884` y `CR-41453122` en la base.
- **Gravedad:** High.
- **Tipo:** Browser limitation / Redundant workaround.
- **Solución conceptual recomendada:** distinguir restaurar foco DOM, restaurar rango y pedir OSK. Solo el último debe ocurrir desde un gesto explícito; no reenfocar si el target ya es activo.
- **NO hacer:** prometer teclado mediante rAF, timeout o `try/catch` de `preventScroll`.
- **Riesgo de regresión:** alto; intervienen caret, scroll y accesibilidad.
- **Prioridad:** P1.

### EDITOR-FOCUS-005 — un fallo de selección repite el foco sin `preventScroll`

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `focusTextarea`, `ManualCardEditorModal.jsx:105-118`.
- **Comportamiento actual:** `focus({preventScroll:true})` y `setSelectionRange()` comparten un solo `try`; cualquier excepción de la selección entra al `catch` y ejecuta otra vez `focus()` sin opciones.
- **Problema:** el fallback no distingue una opción de foco no soportada de un rango inválido/transición de selección. Puede producir una segunda llamada y permitir scroll exactamente cuando la primera ya había enfocado correctamente.
- **Navegadores afectados:** todos; movimiento más probable en Chrome Android, WebView y Samsung Internet.
- **Evidencia en platform-limitations:** [`focus-and-input.md`](focus-and-input.md), foco, selección y `preventScroll`; `CR-41453122`.
- **Gravedad:** Medium.
- **Tipo:** Implementation bug / Redundant workaround.
- **Solución conceptual recomendada:** validar/acotar el rango y tratar foco y selección como operaciones independientes dentro de `InputSession`; una excepción de rango no debe reenfocar.
- **NO hacer:** ampliar el `catch` ni reintentar mediante timeout.
- **Riesgo de regresión:** bajo-medio; cambia únicamente el fallback, pero debe probarse con composición/IME.
- **Prioridad:** P1.

## Hallazgos: selector de color personalizado

### EDITOR-COLOR-001 — el picker se abre antes de la activación touch

- **Componente:** `ColorPalette`.
- **Código implicado:** `frontend/src/components/creator/StylePanel.jsx:224-253`.
- **Comportamiento actual:** el botón custom llama `showPicker()` o `input.click()` dentro de `onPointerDown`; no define `onClick` ni handler de teclado.
- **Problema:** WHATWG define `pointerdown` como evento activador solo para mouse y `pointerup` para punteros no mouse. En touch/pen, `showPicker()` puede no tener activación transitoria y lanzar `NotAllowedError`; el fallback sintético sigue sin un gesto activador válido. VoiceOver/Enter/Space pueden producir `click` sin ejecutar ninguna apertura. Además, un drag horizontal que empieza en el botón abre UI nativa antes de poder convertirse en scroll.
- **Navegadores afectados:** Chrome Android, Samsung Internet, WebView y cualquier implementación normativa touch; accesibilidad en todas. Safari iOS usa el fallback y su tolerancia no es un contrato portable.
- **Evidencia en platform-limitations:** [`browser-support-matrix.md`](browser-support-matrix.md), fila `showPicker`; [WHATWG user activation](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event); [WHATWG `showPicker()`](https://html.spec.whatwg.org/multipage/input.html#dom-input-showpicker).
- **Gravedad:** Critical.
- **Tipo:** Implementation bug.
- **Solución conceptual recomendada:** una única activación semántica en `click`/teclado, ejecutada sin diferimiento, con feature detection y fallback estándar; el gesto de pan debe poder cancelarla.
- **NO hacer:** moverlo a `setTimeout`, rAF, `pointerup` exclusivo o detectar Android/iOS por UA.
- **Riesgo de regresión:** alto; apertura del picker y pan horizontal comparten el gesto.
- **Prioridad:** P0.

### EDITOR-COLOR-002 — iOS no puede garantizar conservar el teclado

- **Componente:** `ColorPalette` + `ManualCardEditorModal`.
- **Código implicado:** `StylePanel.jsx:229-270`; `ManualCardEditorModal.jsx:424-480`.
- **Comportamiento actual:** se intenta impedir cambio de foco, abrir la UI nativa y reenfocar después.
- **Problema:** el picker nativo pertenece al UA/SO y puede cerrar el OSK. Safari iOS no ofrece `showPicker()` para color según la matriz, y el foco diferido posterior no tiene la activación necesaria para reabrir el teclado. Esta parte no es corregible de forma total por JavaScript.
- **Navegadores afectados:** Safari y navegadores WebKit de iOS; otros navegadores pueden elegir UI/foco distintos.
- **Evidencia en platform-limitations:** [`focus-and-input.md`](focus-and-input.md), “Color Picker”; [`ios-safari.md`](ios-safari.md), tabla de Color; `WK-195884`.
- **Gravedad:** High.
- **Tipo:** Browser limitation.
- **Solución conceptual recomendada:** contrato honesto: preservar contenido/rango, aplicar o cancelar color y ofrecer reanudación táctil; mantener presets como camino sin UI nativa.
- **NO hacer:** prometer “teclado siempre abierto”, enfocar repetidamente o sustituir el picker por hacks de viewport.
- **Riesgo de regresión:** bajo si solo cambia la promesa; alto si se altera el flujo del picker.
- **Prioridad:** P0 para el contrato de V2.

### EDITOR-COLOR-003 — el cierre depende de `change → blur → 80 ms`

- **Componente:** `ColorPalette`.
- **Código implicado:** `StylePanel.jsx:55-84`, `254-270`.
- **Comportamiento actual:** `change` marca un ref; solo un `blur` posterior agenda el cierre. Cancelar o blur sin cambio no cierra.
- **Problema:** la plataforma estandariza aplicación de `input/change`, pero la UI concreta y su foco pertenecen al UA. No existe en la base una garantía cross-browser de que el color input reciba y pierda foco con ese orden. El timer es una inferencia adicional.
- **Navegadores afectados:** todos los pickers nativos; especial incertidumbre en Safari iOS y Samsung Internet.
- **Evidencia en platform-limitations:** [`focus-and-input.md`](focus-and-input.md), “blur, pickers y retorno”; [WHATWG eventos comunes de input](https://html.spec.whatwg.org/multipage/input.html#common-input-element-events).
- **Gravedad:** Medium.
- **Tipo:** Heuristic.
- **Solución conceptual recomendada:** modelar una transacción `opening/returned/committed/cancelled` usando eventos disponibles y una salida manual, sin usar blur como prueba única de cierre.
- **NO hacer:** cerrar en cada cambio intermedio ni añadir otro timeout por navegador.
- **Riesgo de regresión:** medio; algunas UIs emiten múltiples cambios mientras arrastran.
- **Prioridad:** P1.

### EDITOR-COLOR-004 — la guardia de picker se aplica también a presets y alineación

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `guardKeyboardResumeAfterMenu` y `closeMenu`, `ManualCardEditorModal.jsx:455-481`; consumidores `748`, `798` y backdrop.
- **Comportamiento actual:** cualquier cierre de menú pone `keyboardWasOpenRef=false`, `resumeRequestedRef=true` y, 450 ms después, cambia solo el ref de reanudación.
- **Problema:** elegir un preset o alineación normalmente no abre UI nativa ni cierra OSK, pero borra la historia igualmente. El timer no hace `setState`; al expirar no reevalúa el efecto. Si el teclado se cierra después, el CTA puede quedar suprimido hasta otro evento favorable.
- **Navegadores afectados:** todos; el síntoma depende del orden de eventos de cada OSK.
- **Evidencia en platform-limitations:** [`virtual-keyboard.md`](virtual-keyboard.md), modelo observable y orden de eventos.
- **Gravedad:** High.
- **Tipo:** Implementation bug / Redundant workaround.
- **Solución conceptual recomendada:** no alterar estado de oclusión al cerrar un menú DOM. Solo una transacción de picker nativo debe registrar salida/retorno, y aun así no debe falsificar la historia geométrica.
- **NO hacer:** ajustar 450 ms ni duplicar la guardia por menú.
- **Riesgo de regresión:** alto; puede cambiar cuándo aparece la ayuda después de formato.
- **Prioridad:** P0.

### EDITOR-COLOR-005 — un `dialog` portaleado queda fuera de la modalidad que lo invoca

- **Componente:** `ColorPalette`, `ManualCardEditorModal`, `ActionSheet`.
- **Código implicado:** `StylePanel.jsx:167-194`, `274-294`; `ManualCardEditorModal.jsx:548-560`; `ActionSheet.jsx:98-124`.
- **Comportamiento actual:** la paleta declara `role="dialog"` y se monta directamente en `document.body`, mientras el textarea conserva el foco dentro de otro elemento `aria-modal="true"`. En `StylePanel`, la misma paleta puede abrirse desde un `ActionSheet` también modal.
- **Problema:** el árbol accesible anuncia una modalidad nueva fuera de la modalidad propietaria, pero no mueve ni contiene el foco en ella. Su `onKeyDown(Escape)` solo es fiable si un descendiente recibe el evento; el diseño intenta precisamente evitarlo. El trap del `ActionSheet` tampoco incluye el portal.
- **Navegadores afectados:** todos; impacto mayor con VoiceOver iOS, TalkBack Android y navegación por teclado.
- **Evidencia en platform-limitations:** [`modals-and-sheets.md`](modals-and-sheets.md), “Portals” y “Accesibilidad”; [`focus-and-input.md`](focus-and-input.md), separación entre foco y teclado.
- **Gravedad:** High.
- **Tipo:** Architecture / Implementation bug.
- **Solución conceptual recomendada:** decidir si la paleta es un popover no modal perteneciente al editor o una submodal real. En ambos casos debe registrarse en una pila de overlays y en el ámbito accesible del propietario.
- **NO hacer:** añadir otro `aria-modal`, otro trap o enfocar el input oculto sin definir antes el contrato de interacción.
- **Riesgo de regresión:** alto; afecta cierre, lector de pantalla, picker nativo y conservación de selección.
- **Prioridad:** P0.

### EDITOR-COLOR-006 — el clamp calcula un ancho que el DOM no adopta

- **Componente:** `ColorPalette`.
- **Código implicado:** `StylePanel.jsx:94-135`, `184-193`.
- **Comportamiento actual:** la medición limita `paletteWidth` al espacio visual disponible y usa ese valor para calcular `left`, pero el estilo solo escribe `left` y `top`. El ancho real sigue gobernado por `w-max`/`168px` y `max-width: calc(100vw - 1rem)`.
- **Problema:** con zoom, viewport visual estrecho, landscape o un diálogo más estrecho que el layout viewport, la posición se calcula para una caja virtual menor que la caja renderizada. Puede sobresalir, quedar bajo una zona no visible o provocar scroll horizontal interno inesperado.
- **Navegadores afectados:** Safari iOS, Chrome Android y escritorio con zoom; más visible en split-screen y landscape.
- **Evidencia en platform-limitations:** [`viewport-and-safe-area.md`](viewport-and-safe-area.md), distinción layout/visual viewport; [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), geometría de overlays.
- **Gravedad:** High.
- **Tipo:** Implementation bug.
- **Solución conceptual recomendada:** una única geometría debe producir tamaño y posición efectivos, incluyendo `offsetLeft`, ancho visual y safe-area lateral.
- **NO hacer:** compensar con márgenes distintos por UA o asumir que `100vw` equivale a `visualViewport.width`.
- **Riesgo de regresión:** medio; el scroll horizontal de los swatches depende del ancho disponible.
- **Prioridad:** P1.

### EDITOR-COLOR-007 — la paleta mide durante scroll global y puede seguir una geometría animada atrasada

- **Componente:** `ColorPalette`, `ActionSheet`.
- **Código implicado:** `StylePanel.jsx:86-165`; `ActionSheet.jsx:122-124`.
- **Comportamiento actual:** cada scroll capturado en `document`, cada resize de ventana/`VisualViewport` y cada notificación de `ResizeObserver` cancela y agenda una medición. La medición lee tres rectángulos y siempre crea un nuevo objeto `position`. El sheet entra durante 400 ms mediante `transform`.
- **Problema:** el listener en captura también observa el scroll horizontal de la propia paleta y el vertical del sheet. Aunque el rAF agrupa eventos, cada frame puede causar layout reads, `setState`, render y escritura de `left/top` sin comprobar igualdad. `ResizeObserver` no se dispara por una transformación CSS, así que una paleta abierta mientras el sheet se anima puede quedar desfasada hasta otro evento.
- **Navegadores afectados:** todos; coste y jitter mayores en móviles de gama baja y durante animaciones/OSK.
- **Evidencia en platform-limitations:** [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), containing blocks y coste de reposicionamiento; [W3C Resize Observer](https://www.w3.org/TR/resize-observer/#intro), transformaciones CSS fuera de sus disparadores.
- **Gravedad:** Medium.
- **Tipo:** Performance / Heuristic.
- **Solución conceptual recomendada:** medir solo mientras el overlay está estable y abierto, suscribirse a los scroll owners concretos, comparar el snapshot antes de renderizar y coordinar la apertura con el fin de la transición del propietario.
- **NO hacer:** añadir intervalos, `MutationObserver` o una lectura síncrona por cada `scroll`.
- **Riesgo de regresión:** medio; una consolidación incompleta puede dejar el popover atrasado.
- **Prioridad:** P2.

## Hallazgos: overlays, modalidad y navegación

### EDITOR-OVERLAY-001 — color y alineación usan modelos de posicionamiento incompatibles

- **Componente:** `ManualCardEditorModal`, `ColorPalette`.
- **Código implicado:** `ManualCardEditorModal.jsx:724-808`; `StylePanel.jsx:86-194`, `274-294`.
- **Comportamiento actual:** color es un portal `position: fixed` medido contra `VisualViewport`; alineación es `position: absolute` dentro de la toolbar, con un backdrop `fixed` pero sin medición.
- **Problema:** dos menús equivalentes tienen distintas reglas de clipping, safe-area, viewport, stacking y respuesta a resize. El menú de alineación puede recortarse por los ancestros `overflow-hidden` del modal o quedar fuera de la parte visible; el de color no.
- **Navegadores afectados:** todos; mayor impacto con OSK en iOS/Android, landscape y zoom.
- **Evidencia en platform-limitations:** [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), “Containing blocks” y “Portal”; [`modals-and-sheets.md`](modals-and-sheets.md).
- **Gravedad:** High.
- **Tipo:** Architecture.
- **Solución conceptual recomendada:** ambos deben compartir un primitive de popover ligado a la misma raíz de overlays y al mismo snapshot geométrico.
- **NO hacer:** copiar el algoritmo de `ColorPalette` dentro del menú de alineación.
- **Riesgo de regresión:** medio; cambiar de portal altera bubbling, focus y z-index.
- **Prioridad:** P1.

### EDITOR-OVERLAY-002 — no existe una pila propietaria de capas ni de Escape

- **Componente:** `ManualCardEditorModal`, `ColorPalette`, `ActionSheet`, footer global.
- **Código implicado:** z-index `30/40/70/71/80/90/100/110/120`; handlers globales en `ManualCardEditorModal.jsx:173-184` y `ActionSheet.jsx:26-52`; handler local en `StylePanel.jsx:175-183`.
- **Comportamiento actual:** cada superficie codifica sus números y su cierre. El modal escucha Escape en `window`; cada `ActionSheet` también. El menú de alineación no intercepta Escape. La paleta solo lo intercepta si el evento pasa por su árbol DOM.
- **Problema:** un Escape puede cerrar la superficie hija y la padre, o saltarse la hija y cerrar el editor. Dos sheets montados pueden reaccionar al mismo evento. Los portales funcionan visualmente por números, no por propiedad o profundidad.
- **Navegadores afectados:** todos; teclado físico, switch control y Android con teclado externo.
- **Evidencia en platform-limitations:** [`modals-and-sheets.md`](modals-and-sheets.md), pila modal; [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), stacking contexts.
- **Gravedad:** High.
- **Tipo:** Architecture / Implementation bug.
- **Solución conceptual recomendada:** una pila de overlays asigna capa, propietario y única acción de cierre al elemento superior; el editor recibe cierre solo cuando no hay hijos.
- **NO hacer:** aumentar z-index o llamar `stopPropagation` de forma dispersa sin una pila.
- **Riesgo de regresión:** alto; implica todos los cierres y la navegación atrás.
- **Prioridad:** P0.

### EDITOR-AS-001 — `ActionSheet` permite foco fuera del diálogo

- **Componente:** `ActionSheet`.
- **Código implicado:** `ActionSheet.jsx:26-76`, `98-123`; `preserveFocus` usado por el sheet de estilos.
- **Comportamiento actual:** con `preserveFocus`, el foco permanece en un elemento detrás del `aria-modal`. El trap solo actúa cuando el foco ya está en el primer/último control interno. El backdrop es un botón enfocable situado fuera del `<section>` y `ColorPalette` queda en otro portal.
- **Problema:** Tab/Shift+Tab puede escapar o llegar al backdrop; los descendientes portaleados no forman parte del trap. El contrato visual, el DOM y el árbol de foco discrepan.
- **Navegadores afectados:** todos; más grave con tecnologías de asistencia.
- **Evidencia en platform-limitations:** [`modals-and-sheets.md`](modals-and-sheets.md), foco, `inert` y portals.
- **Gravedad:** High.
- **Tipo:** Implementation bug / Architecture.
- **Solución conceptual recomendada:** el sheet y sus overlays registrados deben constituir un solo ámbito modal; el backdrop no debe participar en el orden de tabulación y `preserveFocus` debe ser un contrato de popover, no de diálogo modal.
- **NO hacer:** ampliar únicamente el selector de focusables o añadir sentinels que ignoren los portales.
- **Riesgo de regresión:** alto; el sheet se usa en más flujos que el editor.
- **Prioridad:** P0.

### EDITOR-AS-002 — `90dvh` no vuelve visible un sheet detrás del OSK

- **Componente:** `ActionSheet` de estilos.
- **Código implicado:** `ActionSheet.jsx:122-137`; montaje en `FlashcardCreator.jsx`.
- **Comportamiento actual:** el sheet está fijo a `bottom: 0`, limita su alto con `min(90dvh, 720px)` y hace scroll interno.
- **Problema:** `dvh` sigue el viewport dinámico del navegador, no garantiza excluir el teclado virtual. En plataformas donde el OSK se superpone, la parte inferior y su footer pueden quedar ocluidos; tener `overflow-y:auto` no permite desplazar una región que permanece físicamente debajo del OSK.
- **Navegadores afectados:** Safari/WebKit iOS y configuraciones Android/WebView con overlay o reporting tardío.
- **Evidencia en platform-limitations:** [`virtual-keyboard.md`](virtual-keyboard.md), “dvh no es keyboard height”; [`modals-and-sheets.md`](modals-and-sheets.md), bottom sheets con OSK; `WK-265578` y `CR-40287394`.
- **Gravedad:** High.
- **Tipo:** Browser limitation / Architecture.
- **Solución conceptual recomendada:** posicionar el sheet interactivo contra la geometría visual observable cuando sea necesario y conservar scroll interno; degradar sin inferir un teclado.
- **NO hacer:** sustituir `90dvh` por otro porcentaje `vh` o restar una altura de teclado fija.
- **Riesgo de regresión:** alto; Android cambia de comportamiento entre navegador, WebView y política de resize.
- **Prioridad:** P1.

### EDITOR-NAV-001 — Back/history no comparte el contrato de cierre

- **Componente:** `ManualCardEditorModal`, `ActionSheet`, menús.
- **Código implicado:** solo listeners de `keydown` Escape; no hay integración local con `popstate`/pila de navegación para estas capas.
- **Comportamiento actual:** el cierre de overlays se gobierna por click y Escape. El botón Back de Android, el gesto de historial y el cierre programático no se modelan como el mismo evento de capa superior.
- **Problema:** según el shell/router, Back puede navegar fuera antes de cerrar una paleta/sheet/editor o ser manejado por otra capa. Es una ausencia de contrato, no una prueba de que todos los dispositivos fallen hoy.
- **Navegadores afectados:** Chrome Android, Samsung Internet, WebView; también navegación por historial en iOS.
- **Evidencia en platform-limitations:** [`android-chrome.md`](android-chrome.md), navegación Back; [`modals-and-sheets.md`](modals-and-sheets.md), disciplina de cierre.
- **Gravedad:** Medium.
- **Tipo:** Architecture.
- **Solución conceptual recomendada:** integrar Back, Escape y cierre visual en la misma pila superior, de acuerdo con el router real.
- **NO hacer:** añadir un `popstate` por componente ni insertar entradas de historial sin política de restauración.
- **Riesgo de regresión:** alto; puede interferir con navegación real y deep links.
- **Prioridad:** P2.

## Hallazgos: scroll, safe-area y workarounds compartidos

### EDITOR-SCROLL-001 — el lock manual no bloquea al scroll owner real

- **Componente:** `ManualCardEditorModal`, App shell, `scrollLock`.
- **Código implicado:** `ManualCardEditorModal.jsx:165-184`; `App.jsx:202-239`; `frontend/src/lib/scrollLock.js:7-47`.
- **Comportamiento actual:** el modal escribe `body.style.overflow/overscrollBehavior` directamente. En móvil, el shell es `fixed overflow-hidden` y el `<main>` de App es `overflow-y-auto`; ese `<main>` es el scroll container de fondo.
- **Problema:** bloquear `body` no bloquea necesariamente el nodo que realmente desplaza contenido. Además, el bypass no participa en el `Set` de propietarios que usa `ActionSheet`; al desmontarse puede restaurar estilos mientras otro overlay todavía los necesita.
- **Navegadores afectados:** todos; el scroll residual y rubber-banding son especialmente visibles en iOS.
- **Evidencia en platform-limitations:** [`modals-and-sheets.md`](modals-and-sheets.md), scroll ownership; [`touch-and-gestures.md`](touch-and-gestures.md), scroll chaining.
- **Gravedad:** High.
- **Tipo:** Implementation bug / Architecture.
- **Solución conceptual recomendada:** una única lease de scroll conoce el verdadero scroll root del shell, aplica inert al fondo y conserva el scroll interno del editor.
- **NO hacer:** añadir `touchmove.preventDefault` global ni otro lock de `body` local.
- **Riesgo de regresión:** alto; un lock incorrecto puede romper toda la navegación de la app.
- **Prioridad:** P0.

### EDITOR-SCROLL-002 — `body overflow:hidden` conserva un bug conocido de iOS

- **Componente:** `ManualCardEditorModal`, `ActionSheet`, `scrollLock`.
- **Código implicado:** escritura de `document.body.style.overflow = 'hidden'` en `ManualCardEditorModal.jsx:168-181` y `scrollLock.js:12-33`.
- **Comportamiento actual:** ambos modelos dependen de ocultar overflow del body para inmovilizar fondo.
- **Problema:** WebKit documenta desplazamientos/saltos con body bloqueado y teclado. La estrategia tampoco restaura explícitamente una posición porque asume que el body es el scroller. Es parcialmente mitigable, no totalmente controlable desde JS.
- **Navegadores afectados:** Safari y navegadores WebKit iOS.
- **Evidencia en platform-limitations:** [`ios-safari.md`](ios-safari.md), “Scroll lock”; [`known-browser-bugs.md`](known-browser-bugs.md), `WK-240860`.
- **Gravedad:** High.
- **Tipo:** Browser bug / Architecture.
- **Solución conceptual recomendada:** inmovilizar/inertizar el scroll owner real, guardar/restaurar su posición y evitar mutaciones de body cuando el shell ya controla el scroll.
- **NO hacer:** interceptar todo `touchmove` o forzar `scrollTo(0,0)` tras cada evento.
- **Riesgo de regresión:** alto; VoiceOver y scroll interno deben seguir funcionando.
- **Prioridad:** P1.

### EDITOR-SCROLL-003 — editar una tarjeta inicia scroll suave mientras el modal se autoabre

- **Componente:** `DeckInterior`, `FormInputs`, `ManualCardEditorModal`.
- **Código implicado:** `DeckInterior.jsx:273-283`; efecto de autoapertura `FormInputs.jsx:137-147`.
- **Comportamiento actual:** `handleEdit()` cambia `editingId`, muestra el creator y llama `window.scrollTo({top:0, behavior:'smooth'})`. En el render siguiente, `FormInputs` detecta ese `editingId` y abre automáticamente el modal manual.
- **Problema:** la animación de scroll del fondo puede continuar durante montaje, foco y medición del portal. En móvil el scroll owner principal es App `<main>`, por lo que `window.scrollTo` puede apuntar al nodo equivocado; en desktop puede mover el documento detrás del diálogo. No se registra/restaura la posición previa.
- **Navegadores afectados:** todos; el movimiento añadido puede combinarse con `preventScroll` ignorado en Chrome Android/WebView/Samsung.
- **Evidencia en platform-limitations:** [`modals-and-sheets.md`](modals-and-sheets.md), propiedad/restauración de scroll; [`focus-and-input.md`](focus-and-input.md), `preventScroll`; `CR-41453122`.
- **Gravedad:** Medium.
- **Tipo:** Implementation bug / Architecture.
- **Solución conceptual recomendada:** la transición a edición debe pedir al scroll owner real una posición estable antes de abrir la modalidad, o no desplazar el fondo cuando el modal será la superficie primaria; guardar/restaurar mediante el futuro `ScrollLease`.
- **NO hacer:** cancelar el movimiento con otro `window.scrollTo` desde el modal ni añadir un timeout para “esperar” al smooth scroll.
- **Riesgo de regresión:** medio; la colección puede depender visualmente de llevar al usuario al creator en otras rutas.
- **Prioridad:** P1.

### EDITOR-PICKER-001 — el retorno del file picker se infiere con `window focus + 250 ms`

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `ManualCardEditorModal.jsx:120-143`, `313-335`.
- **Comportamiento actual:** `input.click()` marca `imagePickerActive`; `change` resuelve selección. Para cancelación, cualquier `window.focus` agenda 250 ms y solo borra el ref.
- **Problema:** focus de ventana no prueba que el file picker haya cerrado y puede ocurrir por multitarea, devtools u otra UI. El timer no renderiza ni reconcilia un estado visible; puede borrar la exclusión antes/después del cambio real y competir con eventos de viewport.
- **Navegadores afectados:** todos; orden especialmente variable en iOS, Android y WebView.
- **Evidencia en platform-limitations:** [`focus-and-input.md`](focus-and-input.md), “Pickers”; [`virtual-keyboard.md`](virtual-keyboard.md), orden no estable.
- **Gravedad:** Medium.
- **Tipo:** Heuristic.
- **Solución conceptual recomendada:** modelar la selección de archivo como transacción separada con `change`/`cancel` cuando esté disponible y una salida manual segura; tratar `focus` solo como indicio.
- **NO hacer:** ajustar 250 ms por navegador o convertir `window.focus` en certeza.
- **Riesgo de regresión:** medio; el evento `cancel` no está igualmente disponible en todos los motores objetivo.
- **Prioridad:** P1.

### EDITOR-HOOK-001 — `useKeyboardHeight` no debe convertirse en dependencia de V2

- **Componente:** hook compartido `useKeyboardHeight` (no consumido hoy por el editor manual).
- **Código implicado:** `frontend/src/hooks/useKeyboardHeight.js:3-55`; consumidores actuales: otros modales.
- **Comportamiento actual:** calcula `innerHeight - documentElement.clientHeight`, exige `>80`, debounces resize 100 ms, añade focus/blur con timers de 200 ms a todos los inputs descubiertos por un `MutationObserver` global y los marca con `data-keyboard-listener`.
- **Problema:** en muchos modos resize-visual ambas alturas de layout son iguales, por lo que no mide la oclusión. No realiza un scan inicial: los inputs ya presentes no reciben listeners hasta otra mutación. La marca persiste tras cleanup: una segunda/futura instancia puede saltarse nodos, y el cleanup de una instancia opera sobre atributos globales aunque sus callbacks sean distintos. Los timers creados desde focus/blur no se guardan ni cancelan. Es una implementación global, frágil y ajena al modal actual.
- **Navegadores afectados:** todos; resultados distintos entre Safari iOS, Chrome Android y WebView.
- **Evidencia en platform-limitations:** [`virtual-keyboard.md`](virtual-keyboard.md), ausencia de `keyboardHeight` universal; [`browser-support-matrix.md`](browser-support-matrix.md), diferencias de resize.
- **Gravedad:** High si se reutiliza; sin impacto directo actual en el modal.
- **Tipo:** Implementation bug / Heuristic / Performance.
- **Solución conceptual recomendada:** dejarlo fuera del grafo del editor y, en una fase aparte, migrar sus consumidores a un snapshot observable con semántica explícita.
- **NO hacer:** importarlo en `ManualCardEditorModal`, bajar el umbral ni ampliar el `MutationObserver`.
- **Riesgo de regresión:** alto fuera de este alcance; otros modales sí lo consumen.
- **Prioridad:** P1 para impedir su reutilización; refactor global separado.

### EDITOR-DEAD-001 — medición de footer preparada pero sin consumidor

- **Componente:** `FlashcardCreator`.
- **Código implicado:** prop `onFooterHeightChange`, `footerRef` y efecto `ResizeObserver` en `FlashcardCreator.jsx:161`, `182`, `197-218`, `527-529`.
- **Comportamiento actual:** la medición solo se instala si la prop es función; ningún caller del repositorio la pasa.
- **Problema:** el contrato y su comentario sugieren una fuente de geometría que no existe en ejecución. No cuesta renders hoy por el guard, pero añade superficie mental y puede reactivarse accidentalmente como segunda fuente de verdad.
- **Navegadores afectados:** ninguno directamente.
- **Evidencia en platform-limitations:** [`viewport-and-safe-area.md`](viewport-and-safe-area.md), evitar múltiples propietarios geométricos.
- **Gravedad:** Low.
- **Tipo:** Redundant workaround.
- **Solución conceptual recomendada:** retirar el contrato muerto en la futura limpieza o conectarlo únicamente al coordinador geométrico si aparece una necesidad demostrada.
- **NO hacer:** conectarlo al modal para “arreglar” el teclado; mide un footer distinto y oculto durante la edición manual.
- **Riesgo de regresión:** bajo tras confirmar de nuevo todos los callers.
- **Prioridad:** P2.

## Hallazgos: rendimiento y consistencia de estado

### EDITOR-PERF-001 — las lecturas y escrituras de paleta pueden realimentarse

- **Componente:** `ColorPalette`.
- **Código implicado:** `StylePanel.jsx:91-165`, `184-193`.
- **Comportamiento actual:** rAF lee anchor, palette y dialog; luego `setPosition` renderiza y escribe `left/top`. `ResizeObserver` observa anchor y palette, y scroll capture vuelve a agendar.
- **Problema:** no es thrashing síncrono dentro del mismo callback, pero sí puede formar una cadena read → render/write → observer/scroll → read en frames sucesivos. Al no comparar posiciones, incluso el mismo resultado produce un render nuevo.
- **Navegadores afectados:** todos.
- **Evidencia en platform-limitations:** [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), coste de medición/reflow.
- **Gravedad:** Medium.
- **Tipo:** Performance.
- **Solución conceptual recomendada:** comparar coordenadas, observar solo dimensiones necesarias y separar invalidación de scroll propio frente a scroll del anchor.
- **NO hacer:** mover las lecturas a render o `useMemo`; seguirían forzando layout y romperían pureza.
- **Riesgo de regresión:** bajo-medio.
- **Prioridad:** P2.

### EDITOR-STATE-001 — refs, estado React y DOM describen sesiones distintas

- **Componente:** `ManualCardEditorModal`.
- **Código implicado:** `focusResumeReason` + ref espejo, `openMenu` + ref espejo, `keyboardWasOpenRef`, `resumeRequestedRef`, `imagePickerActiveRef`, `viewportFrame`.
- **Comportamiento actual:** algunos cambios actualizan estado y ref mediante wrappers; otros alteran solo refs. Los efectos reaccionan a `viewportFrame`, no a las mutaciones de refs.
- **Problema:** el resultado depende de que llegue después un evento geométrico que fuerce render/efecto. Los timers de 250/450 ms cambian decisiones futuras sin publicar transición, creando carreras difíciles de probar y explicando estados de CTA obsoletos.
- **Navegadores afectados:** todos; frecuencia determinada por el orden de eventos de cada plataforma.
- **Evidencia en platform-limitations:** [`virtual-keyboard.md`](virtual-keyboard.md), modelo observable; [`testing-checklist.md`](testing-checklist.md), secuencias de foco/picker.
- **Gravedad:** High.
- **Tipo:** Architecture / Implementation bug.
- **Solución conceptual recomendada:** una máquina de estados explícita para sesión de input y transacciones de picker, alimentada por eventos observables; geometría queda como snapshot independiente.
- **NO hacer:** convertir cada ref en `useState` aislado; aumentaría renders sin resolver las transiciones.
- **Riesgo de regresión:** alto; es el núcleo del comportamiento actual.
- **Prioridad:** P0.

## KEEP — decisiones correctas

Estas decisiones encajan con la base de Fase 1. Deben conservarse como principios, aunque su implementación se integre en una arquitectura común.

### KEEP-001 — `textarea` nativo y selección explícita

- **Componente:** `ManualCardEditorModal`.
- **Decisión a conservar:** editar en `<textarea>` y guardar `selectionStart`/`selectionEnd` para restablecer el rango.
- **Por qué:** mantiene IME, autocorrección, dictado, accesibilidad y semántica nativa. La alternativa `contenteditable` abre más incompatibilidades.
- **Condición:** la sesión debe ser por lado, incluir `selectionDirection`, acotar el rango a la longitud actual y separar rango de foco/OSK.
- **Evidencia:** [`focus-and-input.md`](focus-and-input.md), recomendación de input nativo.

### KEEP-002 — feature detection y fallback del picker

- **Componente:** `ColorPalette`.
- **Decisión a conservar:** comprobar `typeof input.showPicker === 'function'`, capturar rechazo y disponer de `input.click()`.
- **Por qué:** la capacidad difiere entre motores y `showPicker()` puede fallar aun existiendo.
- **Condición:** ejecutar la apertura desde una activación semántica válida; no preservar el `onPointerDown` actual.
- **Evidencia:** [`browser-support-matrix.md`](browser-support-matrix.md) y [WHATWG `showPicker()`](https://html.spec.whatwg.org/multipage/input.html#dom-input-showpicker).

### KEEP-003 — `input[type=color]` no controlado mientras está abierto

- **Componente:** `ColorPalette`.
- **Decisión a conservar:** `defaultValue` y sincronización puntual, en vez de reescribir `value` desde cada render.
- **Por qué:** evita que React interfiera durante una UI nativa cuyo ciclo no controla.
- **Condición:** la transacción de picker debe decidir cuándo sincronizar antes/después, sin depender solo de blur.
- **Evidencia:** [`focus-and-input.md`](focus-and-input.md), pickers nativos.

### KEEP-004 — portal para overlays que deben escapar de clipping

- **Componente:** modal manual, paleta y `ActionSheet`.
- **Decisión a conservar:** usar portal para escapar de `overflow`, transforms y stacking contexts ancestrales cuando la superficie lo requiere.
- **Por qué:** es la herramienta correcta para geometría global y capas.
- **Condición:** el destino debe ser una raíz de overlays del modal, no `document.body` sin registro de propiedad.
- **Evidencia:** [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), “Portal”; [`modals-and-sheets.md`](modals-and-sheets.md).

### KEEP-005 — `VisualViewport.height/offsetTop` y sus eventos

- **Componente:** `ManualCardEditorModal`, `ColorPalette`.
- **Decisión a conservar:** observar `resize` y `scroll`, y usar altura/offset visual para mantener superficies alcanzables.
- **Por qué:** son datos geométricos relevantes durante OSK, toolbar y zoom; `scroll` importa incluso sin resize.
- **Condición:** snapshot completo, rAF compartido, segunda medición tolerante y ninguna equivalencia automática con teclado.
- **Evidencia:** [`virtual-keyboard.md`](virtual-keyboard.md) y [`viewport-and-safe-area.md`](viewport-and-safe-area.md).

### KEEP-006 — footer dentro de la superficie medida

- **Componente:** `ManualCardEditorModal`.
- **Decisión a conservar:** el footer es `shrink-0` dentro del flex column cuya altura/top siguen la superficie, no otro `fixed` independiente.
- **Por qué:** deja al área de contenido el espacio restante y evita dos seguidores geométricos que puedan separarse.
- **Condición:** la superficie debe provenir de una sola geometría y el footer debe seguir siendo alcanzable mediante scroll/degradación.
- **Evidencia:** [`fixed-sticky-overlays.md`](fixed-sticky-overlays.md), jerarquía estable.

### KEEP-007 — scroll interno explícito y overscroll acotado

- **Componente:** main del editor, textarea, contenido de `ActionSheet`, paleta horizontal.
- **Decisión a conservar:** `overflow-y-auto`/scroll nativo en contenido, textarea nativo y `overscroll-contain` en superficies internas.
- **Por qué:** una UI con OSK necesita que el contenido siga alcanzable; el scroll no es un error por sí mismo.
- **Condición:** cada eje debe tener un propietario declarado y el fondo debe estar inert/locked sin bloquear estos nodos.
- **Evidencia:** [`touch-and-gestures.md`](touch-and-gestures.md) y [`modals-and-sheets.md`](modals-and-sheets.md).

### KEEP-008 — lock de scroll con propietarios

- **Componente:** `frontend/src/lib/scrollLock.js`, utilizado por `ActionSheet`.
- **Decisión a conservar:** contar propietarios y restaurar solo al liberar el último.
- **Por qué:** evita que un overlay anidado desbloquee a otro.
- **Condición:** debe evolucionar a lease del scroll root real y ser el único sistema; no conservar el bypass del modal.
- **Evidencia:** [`modals-and-sheets.md`](modals-and-sheets.md), ownership.

### KEEP-009 — reanudación mediante gesto explícito

- **Componente:** CTA “Toca para seguir escribiendo”.
- **Decisión a conservar:** cuando la plataforma no abre el OSK programáticamente, ofrecer una acción de usuario que enfoque el textarea.
- **Por qué:** respeta la activación exigida por WebKit y no promete control del OSK.
- **Condición:** no debe tapar un input ya utilizable ni derivarse de un booleano factual `keyboardOpen`.
- **Evidencia:** [`ios-safari.md`](ios-safari.md), `WK-195884`; [`focus-and-input.md`](focus-and-input.md).

### KEEP-010 — preservar foco al elegir presets DOM

- **Componente:** swatches predefinidos y botones de formato.
- **Decisión a conservar:** impedir el foco de puntero en controles DOM de acción inmediata puede conservar caret/OSK, manteniendo después un `click` semántico.
- **Por qué:** los presets no abren UI nativa ni necesitan tomar foco durante interacción touch/mouse.
- **Condición:** debe existir ruta de teclado/AT visible y no debe extrapolarse al botón custom que invoca un picker.
- **Evidencia:** [`focus-and-input.md`](focus-and-input.md), eventos y activación.

### KEEP-011 — no hay hacks destructivos de zoom, blur o scroll forzado

- **Componente:** configuración global y editor.
- **Decisión a conservar:** viewport permite zoom; no se llama `blur()` para cerrar OSK, no hay `scrollIntoView()`/`scrollTo()` repetitivo, ni `touchmove.preventDefault` global.
- **Por qué:** evita luchar contra restricciones de plataforma y conserva accesibilidad.
- **Condición:** no introducirlos durante V2 como compensación de geometría.
- **Evidencia:** [`touch-and-gestures.md`](touch-and-gestures.md), [`focus-and-input.md`](focus-and-input.md), [`viewport-and-safe-area.md`](viewport-and-safe-area.md).

### KEEP-012 — viewport-fit y tamaño de texto táctil

- **Componente:** `frontend/index.html`, `frontend/src/index.css`.
- **Decisión a conservar:** `viewport-fit=cover` y `font-size:16px` para inputs/textarea en puntero coarse.
- **Por qué:** habilita safe-area y evita zoom de foco involuntario en iOS sin desactivar el zoom del usuario.
- **Condición:** mantener la propiedad de los insets por superficie; no usar el padding global de body como sustituto.
- **Evidencia:** [`viewport-and-safe-area.md`](viewport-and-safe-area.md), [`ios-safari.md`](ios-safari.md).

### KEEP-013 — superficies de preview/estilo se suspenden al abrir el manual

- **Componente:** `FlashcardCreator`, `FloatingPreviewPanel`, `ActionSheet` de estilos.
- **Decisión a conservar:** `FloatingPreviewPanel` solo se monta con `!isManualModalOpen` y el sheet de estilos abre con `showStyles && !isManualModalOpen`.
- **Por qué:** evita que sus listeners de resize/orientation/pointer y su portal compitan visualmente durante la edición manual.
- **Condición:** mantener la exclusión mutua; no tratarla como sustituto de `inert`/focus containment para el resto del App shell.
- **Evidencia:** [`modals-and-sheets.md`](modals-and-sheets.md), una capa modal activa y ownership.

## Arquitectura conceptual recomendada para V2

No es una propuesta de implementación en esta fase. Es el límite de responsabilidades que debería reemplazar las fuentes de verdad actuales:

1. **`EditorGeometrySnapshot`:** una sola lectura rAF de layout + VisualViewport (`width`, `height`, `offsetLeft`, `offsetTop`, `scale`, orientación/fase). Publica geometría, no `keyboardOpen`.
2. **`InputSession`:** por lado (`question`/`answer`) conserva valor, rango, dirección, último foco válido e intención de edición. Distingue foco DOM, selección y disponibilidad desconocida del OSK.
3. **`PickerTransaction`:** ciclo explícito para color/archivo (`idle → opening → returned → committed|cancelled|unknown`). La UI puede ofrecer reanudación; nunca afirma que mantendrá el teclado.
4. **`OverlayStack`:** una raíz modal-aware registra popovers, palette y sheet; asigna capa, ámbito de foco, Escape/Back y retorno al propietario.
5. **`ScrollLease`:** un único servicio bloquea/inertiza el scroll owner real del App shell y conserva scroll de editor/sheets/textarea.
6. **`SafeAreaContract`:** cada borde tiene exactamente un propietario. Geometría, inset y tamaño del footer se componen una vez, no mediante detectores paralelos.

Las relaciones y secuencias exactas están en [`manual-editor-dependency-map.md`](manual-editor-dependency-map.md); las fuentes de verdad enfrentadas, en [`manual-editor-conflicts.md`](manual-editor-conflicts.md); el inventario completo de APIs/listeners, en [`manual-editor-runtime-inventory.md`](manual-editor-runtime-inventory.md).

## Respuesta ejecutiva solicitada

### 1. Qué está mal actualmente

El editor convierte geometría en un estado factual de teclado, conserva un baseline inválido al rotar, mezcla refs/estado/timers, invoca el color picker desde el evento equivocado, declara modalidad sin contener foco y combina sistemas incompatibles de overlay y scroll lock. Son fallos propios; no deben atribuirse al navegador.

### 2. Qué está bien

`textarea` nativo, selección explícita, feature detection del picker, color input no controlado, VisualViewport como geometría, portales, footer dentro de la superficie, scroll interno, owner-set de `scrollLock`, CTA mediante gesto, `viewport-fit=cover`, 16 px táctiles y la exclusión mutua de previews/sheet. Están enumerados como `KEEP-001` a `KEEP-013`.

### 3. Qué código probablemente sobra

- El segundo detector a 450 ms y la historia paralela basada en `keyboardWasOpenRef`.
- `guardKeyboardResumeAfterMenu` aplicado a menús DOM y su timer de 450 ms.
- El retorno de file picker tratado como certeza mediante `window.focus + 250 ms`.
- El lock inline de body del modal, una vez exista un único `ScrollLease`.
- `onFooterHeightChange`/`ResizeObserver` de `FlashcardCreator`, hoy sin caller.
- Lecturas/listeners duplicados de geometría una vez exista el snapshot común.

“Probablemente” significa candidato para la fase de implementación tras pruebas de secuencia; no se eliminó nada en esta auditoría.

### 4. Qué hacks deberían eliminarse

El umbral absoluto `100`, el máximo histórico de altura, los timeouts 80/250/450 como prueba de eventos de UA, el falso `keyboardOpen`, el re-enfoque rAF como promesa de OSK, z-index disperso y el bypass del scroll lock. `useKeyboardHeight` no debe incorporarse al editor; su limpieza global es un alcance separado.

### 5. Qué limitaciones son imposibles de solucionar completamente

No se puede saber de forma universal si el teclado está abierto, obtener una altura de OSK fiable en todos los hosts, obligar a mantenerlo durante un picker nativo, reabrirlo programáticamente en iOS fuera de activación, garantizar que `preventScroll` sea respetado en Android, ni controlar el foco/orden de eventos internos del picker nativo. Se puede preservar datos, rango y una ruta de reanudación, no prometer el OSK.

### 6. Qué problemas son específicamente de iOS

- Foco programático sin gesto puede dejar el textarea activo sin OSK (`WK-195884`).
- VisualViewport puede entregar eventos tardíos (`WK-265578`).
- Safe-area inferior puede seguir reportándose durante OSK (`WK-217754`).
- `body overflow:hidden` puede saltar/desplazar con teclado (`WK-240860`).
- `showPicker()` para color no es una capacidad portable en Safari iOS; la UI nativa puede cerrar OSK.

### 7. Qué problemas son específicamente de Android

- `preventScroll` puede ignorarse en Chrome/WebView/Samsung (`CR-41453122`).
- WebView anterior a M139 puede no redimensionar VisualViewport con IME (`CR-40287394`).
- resize-pan/resize-visual, política del host y botón Back varían; `dvh` tampoco representa necesariamente la oclusión.
- El `pointerdown` del botón custom precede a la activación touch normativa; es fallo nuestro especialmente visible en este flujo.

### 8. Qué problemas son nuestros

Todos los IDs de tipo `Implementation bug`, `Architecture`, `Heuristic`, `Redundant workaround` o `Performance`: baseline monotónico, doble detector, CTA bloqueante, picker en `pointerdown`, ciclo `change/blur/80 ms`, guardia general, modalidad/foco incompletos, clamp no aplicado, capas/Escape dispersos, lock del nodo equivocado y estados paralelos. Los bugs de navegador agravan el resultado, no justifican estas carreras.

### 9. Qué arquitectura conceptual debería sustituir el sistema actual

Un coordinador de runtime compuesto por `EditorGeometrySnapshot`, `InputSession`, `PickerTransaction`, `OverlayStack`, `ScrollLease` y `SafeAreaContract`, cada uno con una sola autoridad y transiciones observables. No debe existir un store global `keyboardOpen`.

### 10. Qué NO deberíamos tocar

No sustituir el textarea por `contenteditable`; no desactivar zoom; no eliminar VisualViewport ni sus eventos; no retirar portales como concepto; no hacer footer fijo de forma independiente; no eliminar scroll interno; no volver controlado el color input durante el picker; no eliminar el fallback `click()`; no volver a montar previews/sheets de fondo durante el manual; no retirar `-webkit-fill-available` global solo porque el portal no lo consume (otros flujos requieren auditoría propia); no añadir UA sniffing, blur, scroll forzado o touchmove global. Conservar `KEEP-001` a `KEEP-013` y cambiar solo sus límites de propiedad.

## Orden de actuación recomendado (sin implementar en esta fase)

1. **P0:** definir contratos de geometría/input/picker/overlay/scroll y pruebas de secuencia; corregir el evento conceptual del color picker y la modalidad como una unidad.
2. **P1:** migrar viewport, safe-area, scroll owners y posicionadores; cubrir iOS/Android/WebView físicos según checklist.
3. **P2:** consolidar listeners/mediciones y retirar contratos muertos con evidencia de callers.
4. **P3:** limpieza de nombres/comentarios después de estabilizar comportamiento.

No se autoriza inferir que la fase siguiente está validada hasta ejecutar las pruebas físicas `KB`, `FO`, `VP`, `AS`, `CP`, `SC`, `IN`, `PR`, `SR` y `NW` aplicables de [`testing-checklist.md`](testing-checklist.md).
