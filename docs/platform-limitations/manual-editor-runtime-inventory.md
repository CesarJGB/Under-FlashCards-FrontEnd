# Inventario de runtime del editor manual

Inventario estático de la ruta de creación manual en `bc541f930f7fc6e3eb055adb0cb4a232d5099b5c`, comprobado el 2026-08-07. Este documento registra mecanismos; los defectos y prioridades están en [`manual-editor-audit.md`](manual-editor-audit.md).

## Alcance efectivo

Ruta montada:

`App` → `LibrarySection` → `DeckInterior` → `FlashcardCreator` → `FormInputs` → `ManualCardEditorModal`.

Dependencias directas del editor:

- `ManualCardEditorModal.jsx`;
- `StylePanel.jsx`, por `ColorPalette` y `ColorSwatchButton`;
- `ActionSheet.jsx`, para la hoja de estilos del creador que comparte estado con el editor;
- `scrollLock.js`, únicamente a través de `ActionSheet`;
- `FlashcardCreator.jsx`, `FormInputs.jsx`, `DeckInterior.jsx`, `App.jsx`, `index.css` e `index.html`.

No forman parte de la ruta activa del modal manual:

| Utilidad | Consumidores actuales | Resultado de la auditoría |
|---|---|---|
| `useKeyboardHeight` | `DeckModal`, `AcademicFolderModal`, `EvaluationModal` | No calcula el modal manual. No debe adoptarse en V2: su medición no representa el OSK en el modelo `resizes-visual`. |
| `useBottomGap` | `HomeSection` | No calcula footer, paleta ni modal manual. Mide distancia entre contenido y navegación de Home. |
| `useModalAccessibility` | overlays PDF y modales de calendario | No gestiona el diálogo manual. Reutilizarlo sin rediseño añadiría otro foco inicial y otro listener Escape. |
| `useImmersiveScrollGuard` | Home, repaso, sesión y borrado rápido | No está activo durante `DeckInterior` en modo edición. |

`FloatingPreviewPanel` y el `ActionSheet` de estilos sí pertenecen al creator, pero se desmontan/cierran mediante `!isManualModalOpen`. Sus listeners de `resize`, `orientationchange` y drag pointer no compiten durante el modal; esa exclusión mutua debe conservarse.

### Inspección de hooks relacionados pero no montados

| Hook | Mecanismos | Clasificación para su dominio | Riesgo si se conecta al editor |
|---|---|---|---|
| `useBottomGap` | Dos `getBoundingClientRect`, rAF, `ResizeObserver`, `visualViewport.resize` o `window.resize`, `orientationchange`, `animationend`, espera de fuentes/animaciones y límites 240/450 ms | ✅/🟡 para clasificar el espacio entre contenido y nav en Home; tiene comparación y tolerancia de jitter | ⚫/🔴 como teclado o footer manual: mide nodos de Home y sus tiers `80/240/450` no describen oclusión. Añadiría otra fuente, timers y observers. |
| `useModalAccessibility` | timer 0 de foco, `document.keydown` para Escape/Tab, consulta de focusables y restauración en cleanup | 🟡 primitive básico para modales sin portals descendientes; no implementa `inert` | 🟠 duplicaría `autoFocus`, Escape y restauración del modal. Su trap no contiene `ColorPalette` portaleada y puede mover foco fuera de activación. |
| `useImmersiveScrollGuard` | owner-set propio, `useBodyScrollLock`, `html overflow:hidden`, listeners globales no pasivos `wheel`/`touchmove`, excepción por `data-immersive-allow-scroll` | 🟡 para pantallas inmersivas que marcan de forma explícita sus scroll nodes | 🔴 si se reutiliza sin rediseño: el editor/textarea/sheet no declaran esa excepción y el listener global podría cancelar su scroll/touch. |

Estos hooks se analizaron para evitar falsos positivos: que existan en el repositorio no significa que intervengan en el bug actual. Su reutilización tampoco es una consolidación automática.

## Leyenda de clasificación

| Marca | Significado |
|---|---|
| ✅ | Correcto para el propósito declarado y debe conservarse como principio. |
| 🟡 | Aceptable únicamente como heurística o degradación acotada. |
| 🟠 | Frágil por orden de eventos, temporización, navegador o integración. |
| 🔴 | Incorrecto para el propósito que el código le atribuye. |
| ⚫ | Redundante, inactivo en esta ruta o duplicado por otro mecanismo. |

## Inventario de teclado, viewport, foco y picker

| Mecanismo actual | Ubicación | Clasificación | Motivo exacto |
|---|---|---:|---|
| Leer `visualViewport.height` y `offsetTop` | `ManualCardEditorModal:189-214` | ✅ geometría / 🟠 teclado | Describe la superficie visual vertical, pero su reducción no identifica la causa. |
| Escuchar `visualViewport.resize` y `scroll` | `ManualCardEditorModal:218-225` | ✅ | Ambos eventos son relevantes porque puede cambiar tamaño u offset. Falta agrupar la publicación. |
| Escuchar además `window.resize` | `ManualCardEditorModal:220-225` | 🟡 | Es un fallback razonable, no un evento de teclado. Puede duplicar una actualización de VisualViewport. |
| Baseline `max(initial, innerHeight, clientHeight)` | `ManualCardEditorModal:190-203` | 🔴 | Nunca puede disminuir durante la sesión; portrait → landscape clasifica la orientación como teclado. |
| Umbral fijo de 100 px | `ManualCardEditorModal:203`, `268-269` | 🟡 como “oclusión probable” / 🔴 como `keyboardOpen` | Zoom, toolbar y orientación también pueden superar el umbral. El nombre y los consumidores lo elevan a verdad. |
| Segundo detector tras 450 ms | `ManualCardEditorModal:245-285` | 🟠 | Duplica la fórmula, usa otro baseline y convierte tiempo transcurrido en evidencia del OSK. |
| `keyboardWasOpenRef` + transición a cerrado | `ManualCardEditorModal:290-311` | 🟠 | Solo es válido si la clasificación inicial fue correcta; zoom y orientación contaminan la historia. |
| `isTouchDevice()` como condición de CTA | `ManualCardEditorModal:44-47`, `262`, `291` | 🟠 | Touch no implica teclado virtual: iPad/Android con teclado físico y equipos híbridos son falsos positivos. |
| `autoFocus` | `ManualCardEditorModal:590` | 🟡 | Puede proponer foco; no garantiza OSK móvil. Está duplicado por llamadas explícitas. |
| `focus()` inmediato en `useLayoutEffect` | `ManualCardEditorModal:229-239` | ✅ intención / 🟠 portabilidad | Es el intento con mayor posibilidad de conservar la activación que abrió el modal, pero no puede prometer OSK. |
| Segundo `focus()` en `requestAnimationFrame` | `ManualCardEditorModal:234-238` | ⚫ para foco habitual / 🟠 para OSK | Normalmente `autoFocus` o la primera llamada ya enfocaron. El frame pierde la cadena inmediata de activación en iOS. |
| `focus({preventScroll:true})` con `catch` | `ManualCardEditorModal:105-118`, `433-451` | 🟡 | La forma es correcta donde está soportada. Android puede aceptarla e ignorar `preventScroll`; el `catch` no detecta eso. |
| Guardar `selectionStart`/`selectionEnd` | `ManualCardEditorModal:79`, `575-587` | ✅ API / 🟠 modelo | Es la API correcta para `textarea`, pero un solo rango se comparte entre pregunta y respuesta y no conserva dirección. |
| `setSelectionRange()` al restaurar | `ManualCardEditorModal:111-114`, `442-449` | ✅ API / 🟠 uso | Correcto para el control; no se acotan índices ni se separa selección de foco y OSK. |
| No llamar `blur()` para ajustar layout | toda la ruta | ✅ | Evita convertir el cierre del teclado en una herramienta geométrica. |
| Detección `typeof input.showPicker === 'function'` + `try/catch` + `click()` | `StylePanel:240-250` | ✅ patrón / 🔴 evento actual | La degradación es correcta, pero se ejecuta demasiado pronto en touch. |
| Abrir picker en `onPointerDown` | `StylePanel:229-250` | 🔴 | WHATWG activa touch/pen en `pointerup`, no en `pointerdown`; además no existe `onClick` para teclado o activación asistiva. |
| `<input type="color">` no controlado | `StylePanel:254-270` | ✅ | Evita reescribir `value` durante la UI nativa y conserva un fallback estándar. |
| Cerrar picker por `change` previo + `blur` + 80 ms | `StylePanel:65-84`, `265-266` | 🟠 | Depende de que el agente de usuario produzca foco/blur en ese orden; cancelar o no emitir blur deja la paleta abierta. |
| Restaurar textarea en un frame al cerrar menú | `ManualCardEditorModal:424-453` | 🟠 | No puede reabrir OSK en iOS y se ejecuta incluso cuando el textarea nunca perdió foco. |
| Guardia de 450 ms al cerrar cualquier menú | `ManualCardEditorModal:455-480` | 🔴 | Se aplica a presets y alineación, pone `keyboardWasOpen=false` y no publica estado cuando termina el timer. |
| CTA explícita para retomar escritura | `ManualCardEditorModal:596-614` | ✅ patrón / 🟠 disparador | El gesto explícito es el fallback correcto; la heurística que decide mostrarlo no lo es. |
| Medir ColorPalette con VisualViewport en ambos ejes | `StylePanel:98-135` | ✅/🟡 | Usa `width`, `height`, `offsetLeft` y `offsetTop`, a diferencia del modal; no lee `scale`. |
| Agrupar medición de paleta en `requestAnimationFrame` | `StylePanel:138-164` | ✅ | Separa la tormenta de eventos de la lectura de layout y cancela el frame anterior. |
| `max-w: calc(100vw - 1rem)` | `StylePanel:184-193` | 🟠 | Limita contra layout viewport; el ancho visual calculado en JS no se aplica al nodo cuando hay zoom o diálogo más estrecho. |
| `90dvh` en ActionSheet | `ActionSheet:122` | 🟡 | Limita chrome dinámico, no el OSK. Es válido solo junto con un contrato de oclusión/scroll. |
| `20dvh` para altura del textarea | `ManualCardEditorModal:571` | 🟡 | Es una preferencia de tamaño, no detección de teclado. Puede relayout durante chrome dinámico. |
| `useKeyboardHeight`: `innerHeight - clientHeight > 80` | `useKeyboardHeight:6-12` | 🔴 | En Chrome Android moderno ambos pueden seguir el layout viewport y producir cero con el IME visible. |
| `MutationObserver` global que marca todos los inputs | `useKeyboardHeight:29-50` | 🔴 | No escanea inputs iniciales hasta que ocurra una mutación; después muta el DOM completo, mezcla instancias mediante un atributo compartido y deja el atributo tras retirar listeners. |

Ningún código de la ruta lee `visualViewport.scale`. Esto no obliga a multiplicar coordenadas —`getBoundingClientRect` y VisualViewport exponen geometría compatible en CSS px—, pero el futuro snapshot debería registrar la escala para distinguir una fase de zoom de una oclusión probable. El modal tampoco lee `visualViewport.width` ni `offsetLeft`; solo la paleta lo hace.

Fuentes adicionales verificadas durante esta fase:

- [WHATWG: eventos que conceden activación](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event): `pointerdown` solo para mouse; `pointerup` para puntero no mouse.
- [WHATWG: `showPicker()`](https://html.spec.whatwg.org/multipage/input.html#dom-input-showpicker): requiere activación transitoria y puede lanzar `NotAllowedError`.

## Fuentes de altura y ancho

| Fuente | Código consumidor | Uso actual | Conflicto |
|---|---|---|---|
| `height: 100%` | `html`, `body`, `#root` en `index.css:8-14` | Base del documento | Convive con `-webkit-fill-available`; no describe el área sobre OSK. |
| `-webkit-fill-available` | `index.css:38-45` | Fallback global iOS heredado | No interviene directamente en el portal fijo, pero es otra política global de altura. |
| `fixed inset-0` | shell `App:202`; modal `ManualCardEditorModal:550` | Layout viewport | No sigue por sí solo VisualViewport ni OSK. |
| `100dvh` | shell desktop `App:202,239`; fallback modal `382` | Chrome dinámico | No representa necesariamente área sobre teclado. |
| JS `height: visualViewport.height px` | `ManualCardEditorModal:380-382` | Alto de la superficie interna | Compite con el outer `fixed inset-0` y con hijos en `dvh`. |
| JS `top: visualViewport.offsetTop px` | `ManualCardEditorModal:380-382` | Desplazamiento vertical visible | No existe equivalente para `left`/`width` en el modal. |
| `clamp(8rem,20dvh,10rem)` | textarea wrapper `ManualCardEditorModal:571` | Alto del campo | Relayout CSS simultáneo a la medición JS del contenedor. |
| `max-height:min(90dvh,720px)` | `ActionSheet:122` | Alto máximo del sheet | El sheet no comparte la geometría JS del editor. |
| `100vw` | `ColorPalette`, `StylePanel:185-186` | Ancho máximo | Puede exceder el VisualViewport calculado por JS. |
| `window.innerWidth` | fallback de `ColorPalette`, `StylePanel:105` | Borde derecho sin VisualViewport | Layout viewport; razonable como degradación, no equivalente a viewport visual bajo zoom. |
| `window.innerHeight` | modal y `useKeyboardHeight` | Baseline/fallback | Tiene dos interpretaciones incompatibles en el repositorio. |
| `documentElement.clientHeight` | modal y `useKeyboardHeight` | Baseline/diferencia | Se usa como máximo en un sitio y como sustraendo en otro. |

No hay usos de `svh` ni `lvh` en la dependencia efectiva del editor.

## Viewport meta, CSS global y App shell

| Capa | Configuración actual | Evaluación |
|---|---|---|
| `frontend/index.html` | `width=device-width, initial-scale=1.0, viewport-fit=cover` | ✅ habilita layout responsive y safe-area; no desactiva zoom con `maximum-scale`/`user-scalable`. |
| `html/body/#root` | `height:100%`; body con padding top/bottom de safe-area | 🟡 base histórica válida para pantallas generales; no es autoridad de portales fixed ni OSK. |
| CSS iOS global | `min-height/height:-webkit-fill-available` bajo `@supports(-webkit-touch-callout:none)` | 🟡 fallback heredado del documento; no interviene en la surface manual con altura inline. No usarlo como detector. |
| Inputs coarse | `font-size:16px !important` excepto tipos no textuales | ✅ evita zoom involuntario al enfocar en iOS; el textarea manual ya usa 16 px. |
| Dashboard móvil | wrapper `fixed inset-0 overflow-hidden`, padding top de safe-area | ✅ crea un shell estable; implica que body no es su scroll owner. |
| App `<main>` móvil | `min-h-0 overflow-y-auto overscroll-contain` | ✅ scroll root de contenido; 🔴 no se bloquea/inertiza mediante el lock de body del modal. |
| Dashboard desktop | `min-height:100dvh`, overflow visible | 🟡 correcto para chrome dinámico; no debe mezclarse con inferencia de OSK móvil. |

El modal es un portal directo en `body`, por lo que no hereda geométricamente el padding del shell ni sus límites de overflow. Esto evita un doble inset automático, pero obliga a que el modal posea sus cuatro bordes de safe-area de forma explícita.

## Propiedad de safe area

| Borde / nivel | Propietario actual | Estado |
|---|---|---|
| Documento superior e inferior | `body` en `index.css:24-26` | Global; no desplaza por sí mismo los portales `fixed`. |
| Shell superior | `App:202` | Protege el contenido de shell móvil; el modal portalizado lo cubre. |
| Navegación y footer creador inferior | `App:349`, `FlashcardCreator:529` | Cada superficie fija posee su inset cuando está visible. |
| Modal superior | `ManualCardEditorModal:558` | Propietario único dentro del modal; correcto en portrait. |
| Modal inferior | `ManualCardEditorModal:384-386` | Se elimina cuando la heurística dice `keyboardOpen`; no exige foco ni estabilidad. |
| ActionSheet inferior | `ActionSheet:136` sin footer o `204` con footer | Distribución interna correcta: el inset se aplica una vez por variante. |
| Izquierda/derecha de modal, footer, sheet y paleta | nadie | Falta contrato para landscape y recortes laterales. |

No se demuestra un doble padding inferior dentro del modal o del ActionSheet: al ser portales fijos, el padding de `body` no se suma geométricamente a sus cajas. El riesgo real es la duplicación de políticas entre superficies y la ausencia de insets laterales.

## Propiedad del scroll

| Nodo | ¿Puede desplazarse? | Propósito actual | Riesgo |
|---|---:|---|---|
| `window` / documento | Normalmente no durante dashboard fijo | Fallback de navegación y zoom | `body overflow:hidden` no inmoviliza el VisualViewport iOS en todos los estados. |
| `body` | Estilos globales y locks | Host de portales | No es el scroller principal del dashboard. |
| `App <main>` | Sí, `overflow-y:auto` | Scroll principal bajo el editor | El modal no lo bloquea ni vuelve inert; queda protegido solo por la cobertura de puntero. |
| outer modal | No, `overflow:hidden` | Recorte y fondo modal | Correcto como barrera visual. |
| superficie interna | No, `overflow:hidden` | Marco VisualViewport | Correcto para mantener footer dentro del frame. |
| modal `<main>` | Sí, `overflow-y:auto` | Contenido vertical del editor | Debe ser el único scroll vertical de superficie, salvo el propio textarea. |
| `textarea` | Sí, scroll nativo interno | Texto largo y caret | Produce scroll anidado legítimo; requiere pruebas de caret y chaining. |
| footer | No | Acciones persistentes | Correctamente participa en el flex del frame y no tiene un `fixed` independiente. |
| ColorPalette horizontal | Sí, `overflow-x:auto` | Presets | Su propio `scroll` llega al listener de captura global de posicionamiento. |
| ActionSheet content | Sí, `overflow-y:auto` | Contenido y acciones largas | Correcto, pero su caja completa puede quedar detrás del OSK. |
| picker nativo | Control del SO/UA | Selección de color o archivo | Fuera del árbol DOM y de todo lock del proyecto. |

No existen `scrollIntoView()` ni `scrollTo()` dentro de `ManualCardEditorModal`, `StylePanel` o `ActionSheet`. Es una decisión correcta: no hay una rutina local intentando mover todos los ancestros del caret. Sí existe un `window.scrollTo({top:0, behavior:'smooth'})` aguas arriba en `DeckInterior.handleEdit`: se inicia al cambiar `editingId`, justo antes de que `FormInputs` autoabra el modal. En móvil apunta a `window` aunque el scroll owner sea App `<main>`; en desktop puede seguir animando el fondo durante el foco inicial. Los resets de App ligados a `tab/currentDeck` no se disparan por abrir/cerrar el lado manual.

## Inventario de listeners y observadores

| Archivo / evento | Motivo | Frecuencia esperada | ¿setState / render? | ¿Consolidable? | ¿Necesario? |
|---|---|---|---|---|---|
| Manual · `window keydown` | Escape del modal | Baja | Cierra en padre | Sí, en stack de overlays | Sí, pero solo para capa superior. |
| Manual · `visualViewport resize` | Geometría visible | Alta durante OSK/toolbar/zoom | Sí: `setViewportFrame` | Sí, mediante snapshot+rAF | Sí. |
| Manual · `visualViewport scroll` | `offsetTop` | Alta durante pan/zoom/OSK | Sí | Sí, misma cola que resize | Sí. |
| Manual · `window resize` | Fallback/orientación | Media; puede duplicar | Sí | Sí | 🟡 fallback. |
| Manual · `window focus` | Retorno del file picker | Baja | No; timer muta ref | Sustituible por transacción de picker | 🟠. |
| Manual · toolbar `pointerdown` | Evitar que botones tomen foco; recordar retorno | Por acción | Normalmente no; trigger de menú escribe ref | Consolidar en primitive de toolbar | ✅ para acciones DOM / 🟠 si se usa para UI nativa. |
| Manual · backdrops `pointerdown/click` | Evitar foco y cerrar menú | Por cierre | `click` cierra y renderiza | Stack/primitive de popover | Sí. |
| Textarea · `change` | Valor y rango | Por entrada | Padre renderiza; ref cambia | No | Sí. |
| Textarea · `select` | Rango | Por caret/selección | Solo ref | Modelo por lado | Sí. |
| Palette · `window resize` | Reanclar | Media | rAF → `setPosition` | Sí | 🟡 fallback. |
| Palette · `visualViewport resize/scroll` | Reanclar | Alta | rAF → render | Sí, con snapshot del editor | Sí. |
| Palette · `document scroll` captura | Scroll de ActionSheet/ancestros | Alta | rAF → render incluso si posición no cambia | Filtrar target y comparar posición | 🟠. |
| Palette · `ResizeObserver` anchor+palette | Cambios de tamaño | Baja/media | rAF → render | Mantener local | Sí. |
| Color input · `focus/change/blur` | Sincronizar/aplicar/cerrar | Dependiente del UA | Cambio renderiza; blur agenda cierre | Transacción de picker | 🟠. |
| Palette · swatches/backdrop `pointerdown/click` | Preservar foco, seleccionar o cerrar | Por acción/pan iniciado | `click` aplica/cierra | Primitive de popover | ✅ presets; 🔴 custom en `pointerdown`. |
| ActionSheet · `window keydown` | Escape y Tab | Baja | Puede cerrar; foco imperativo | Stack central | Sí, no uno por capa. |
| ActionSheet · backdrop `pointerdown/click` | Evitar foco y cerrar | Por cierre | `click` cierra | Stack central | Sí; el botón no debería quedar en Tab order. |
| ActionSheet · timer 0 | Foco inicial | Una vez | No | Coordinador de foco | 🟡. |
| Creator · `ResizeObserver` footer | Notificar altura | Ninguna actualmente | Callback padre si existiera | Eliminar hasta tener consumidor | ⚫: ningún caller pasa la prop. |
| `useKeyboardHeight` · window resize | Medir teclado | Media | Sí | No reutilizar fórmula | 🔴 para OSK. |
| `useKeyboardHeight` · MutationObserver + focus/blur de todo input | Descubrir inputs | Muy alta en app dinámica | Timers → render | Eliminar enfoque global | 🔴. |
| `useBottomGap` · observers/eventos | Home adaptativo | Fuera de esta ruta | Sí en Home | No mezclar con editor | ⚫ para editor. |

No hay listeners explícitos `touchstart`, `touchmove` o `touchend`, ni listeners `pointermove`/`pointerup`, en los tres componentes prioritarios. Tampoco hay `orientationchange`: la orientación llega indirectamente por `window.resize`, pero el baseline no inicia una fase nueva. No hay listeners pasivos/no pasivos registrados con `addEventListener` para touch en esta ruta; los `onPointerDown` de React son handlers sintéticos por control.

## Lecturas, escrituras y reflow

| Ruta | Lecturas de layout | Escrituras/publicación | Evaluación |
|---|---|---|---|
| `updateViewportFrame` | `innerHeight`, `clientHeight`, VV `height/offsetTop` | `setViewportFrame` directamente desde evento | Puede renderizar una vez por frame de animación; falta rAF y fase estable. |
| check inicial 450 ms | Vuelve a leer alturas completas | `setFocusResumeReason` | Duplica la fuente y puede competir con `viewportFrame`. |
| `ColorPalette.measure` | Tres `getBoundingClientRect` + cuatro campos VV | `setPosition` en rAF | Orden lectura→escritura correcto; falta igualdad de posición. |
| `document scroll` de paleta | La captura incluye el scroll horizontal propio | Mismo `setPosition` | Trabajo evitable durante pan de presets. |
| `ResizeObserver` de paleta | Tamaño de anchor/palette | Agenda rAF | Correcto, pero CSS transforms del ActionSheet no disparan ResizeObserver. [W3C Resize Observer](https://www.w3.org/TR/resize-observer/#intro). |
| ActionSheet apertura | Ninguna lectura | Timer 0 y focus | Puede competir con restauraciones de StylePanel si cambian capas juntas. |
| footer del creador | `getBoundingClientRect().height` | Callback opcional | Código inactivo porque no existe consumidor de `onFooterHeightChange`. |

## Resultado operativo del inventario

Las fuentes que deben considerarse activas hoy son VisualViewport local, CSS `dvh`, safe area CSS, refs de “teclado” y foco, locks de `body` y tres sistemas de overlay. `useKeyboardHeight` y `useBottomGap` no resuelven el editor manual. Cualquier V2 que los mezcle sin eliminar fuentes anteriores aumentaría, no reduciría, la indeterminación.
