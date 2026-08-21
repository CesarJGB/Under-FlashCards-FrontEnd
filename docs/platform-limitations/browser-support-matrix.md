# Matriz de soporte móvil

Matriz de decisión para Under Flashcards. Las versiones mínimas proceden de documentación de proveedores y de [MDN Browser Compatibility Data](https://github.com/mdn/browser-compat-data), comprobado en su snapshot del 2026-08-06; “soportado” no significa libre de bugs. Plataformas abreviadas: **iOS** = Safari/WebKit de iPhone o iPad, **CA** = Chrome Android, **WV** = Android System WebView, **SI** = Samsung Internet.

## Viewport, teclado y layout

| Característica | Estado | Compatibilidad documentada | Riesgo para Under Flashcards | Alternativa o guardia | Confianza | Comprobado |
|---|---|---|---|---|---|---|
| `window.visualViewport` | Estándar CSSOM View; disponible ampliamente | iOS 13+, CA/WV 61+, SI 8+; en WebView el resize independiente por IME llegó en M139 | Los eventos y la geometría pueden llegar tarde; una reducción no identifica la causa; el host WebView importa | Usar `window.innerHeight` solo como layout fallback; tratar teclado como inferencia y registrar proveedor WebView | Alta | 2026-08-07 |
| VirtualKeyboard API | Estándar en desarrollo, **experimental**, secure context y no Baseline | iOS: no; CA/WV 94+; SI 17+ | No puede sostener el editor en iPhone; el host puede no exponerla | Mejora progresiva tras `'virtualKeyboard' in navigator`; fallback VisualViewport | Alta | 2026-08-07 |
| `keyboard-inset-*` | Variables experimentales ligadas a VirtualKeyboard | Misma dependencia práctica; no iOS | CSS puede resolver a cero o no existir | Layout legible sin ellas; geometría observada como mejora | Media | 2026-08-07 |
| `env(safe-area-inset-*)` | CSS Environment Variables | iOS 11+; CA/WV 69+; SI 10+ | Inset inferior puede persistir con el teclado en iOS; posible doble aplicación en la cascada | Propietario único del padding; fallback `0px`; prueba con recorte real | Alta | 2026-08-07 |
| `apple-mobile-web-app-status-bar-style` | Extensión Apple para web apps Home Screen | iOS standalone; requiere `apple-mobile-web-app-capable=yes` | `default` mantiene el contenido bajo la barra; `black-translucent` usa toda la pantalla, pero Apple lo define como estilo negro translúcido y no garantiza iconos oscuros sobre fondos claros | Para superficies claras, conservar `default` y sincronizar el fondo real de `html`/`body`; validar color e iconos en PWA física | Media | 2026-08-22 |
| `<meta name="theme-color">` | Meta HTML soportado por Safari 15+ | Safari 15+ documenta color de status bar en iOS y chrome/overscroll en otras plataformas Apple | No sustituye el contrato de `apple-mobile-web-app-status-bar-style` en standalone ni demuestra que cambios dinámicos recoloreen una PWA ya lanzada | Mantener como configuración global; no usarlo como único mecanismo para una transición temporal | Media | 2026-08-22 |
| `100vh` | Unidad estándar; `vh` equivale al viewport grande por compatibilidad | Amplio en las cuatro familias | Puede quedar detrás de UI retráctil; no modela teclado | `svh` para visibilidad estable o `dvh` para UI dinámica, con fallback | Alta | 2026-08-07 |
| `100dvh` | Unidad dinámica estándar | iOS 15.4+; CA/WV 108+; SI 21+ | Cambia con chrome dinámico; con el modo de teclado predeterminado no representa necesariamente el área sobre el OSK | `min-height:100vh; min-height:100dvh` y medición visual solo cuando sea necesaria | Alta | 2026-08-07 |
| `100svh` | Unidad de viewport pequeño estándar | iOS 15.4+; CA/WV 108+; SI 21+ | Reserva el peor caso de UI y puede dejar espacio libre cuando se retrae | Útil para contenido siempre visible; no detector de teclado | Alta | 2026-08-07 |
| `100lvh` | Unidad de viewport grande estándar | iOS 15.4+; CA/WV 108+; SI 21+ | Puede situar controles bajo la UI del navegador | Evitar para acciones críticas pegadas a bordes | Alta | 2026-08-07 |
| `interactive-widget` en viewport meta | Definido en CSS Viewport; implementación no uniforme | Chrome 108+ documenta `resizes-visual`, `resizes-content`, `overlays-content`; no contrato portable en Safari | Cambia qué viewport redimensiona el teclado; afecta toda la app | Mantener política explícita y probar; no añadir para corregir un único modal | Media | 2026-08-07 |
| `position: fixed` | Estándar ampliamente soportado | Amplio | Se referencia al containing block/layout viewport, no al área visual sobre el teclado; un ancestro transformado puede cambiarlo | Portal a un root conocido, contenedor interno de scroll y VisualViewport cuando proceda | Alta | 2026-08-07 |
| `position: sticky` | Estándar; depende del scroll container | iOS 13+ sin prefijo; CA/WV 56+; SI 6+ | Falla conceptualmente si el ancestro de scroll o de overflow no es el esperado | Definir propietario del scroll; usar `fixed` solo si el contrato lo exige | Alta | 2026-08-07 |
| `ResizeObserver` | Estándar ampliamente disponible | iOS 13.4+; CA/WV 64+; SI 9+ | Bucle de medición si la callback cambia lo observado | Observar el mínimo nodo, agrupar escritura en animation frame | Alta | 2026-08-07 |

## Entrada, foco y selección

| Característica | Estado | Compatibilidad documentada | Riesgo para Under Flashcards | Alternativa o guardia | Confianza | Comprobado |
|---|---|---|---|---|---|---|
| `HTMLElement.focus()` | Estándar y amplio | Amplio | En iOS, sin activación de usuario puede enfocar sin mostrar OSK o no producir el efecto esperado | Botón explícito “continuar escribiendo”; no prometer teclado | Alta | 2026-08-07 |
| `focus({preventScroll:true})` | Opción estándar | iOS 15.5+; Chrome escritorio sí; CA/WV/SI figuran sin soporte | Puede aceptarse e ignorarse en Android, moviendo el scroll | Guardar/restaurar solo el scroll container relevante tras prueba; no confiar en `try/catch` | Alta | 2026-08-07 |
| `HTMLElement.blur()` | Estándar y amplio | Amplio | No existe promesa de cuándo se oculta el OSK ni de orden de eventos | Tratarlo como cambio de foco; observar geometría por separado | Alta | 2026-08-07 |
| `<textarea>` | Estándar y amplio | Amplio | Scroll interno, composición IME, autocorrección y selección varían; texto largo desplaza el caret | Usar API nativa y pruebas con IME/texto largo | Alta | 2026-08-07 |
| `selectionStart`, `selectionEnd`, `setSelectionRange()` | API estándar de controles de texto | Amplio | Restaurar selección no garantiza foco ni teclado; índices cambian tras mutar el valor | Guardar rango justo antes de la acción y acotarlo a la longitud actual | Alta | 2026-08-07 |
| Selection API (`getSelection`, `Range`) | Estándar | Amplio | Modela selección del documento, no la selección interna de `textarea` | En el editor actual usar las propiedades del control; Selection API solo para `contenteditable` | Alta | 2026-08-07 |
| `contenteditable` | Estándar, interoperabilidad de edición limitada | Amplio | Comandos, pegado, IME, undo, selección y HTML generado no son uniformes | Mantener `textarea` para texto plano; introducir editor rico solo con modelo y pruebas propios | Media | 2026-08-07 |
| `<input type="color">` | Control estándar; UI es del agente de usuario | iOS 12.2+; CA 25+; WV 4.4+; SI 1.5+ | Apariencia, foco y transición al picker son nativos y no controlables | Conservar presets y aceptar la selección mediante `input`/`change` | Alta | 2026-08-07 |
| `HTMLInputElement.showPicker()` para color | Método estándar con activación transitoria; soporte limitado por tipo | iOS: no para color; CA/WV 99+; SI 18+ | Puede lanzar `NotAllowedError`; no hay garantía de conservar OSK | Detección + `try/catch` + `click()` desde el mismo gesto; presets siempre disponibles | Alta | 2026-08-07 |

## Gestos, scroll, modales y dispositivo

| Característica | Estado | Compatibilidad documentada | Riesgo para Under Flashcards | Alternativa o guardia | Confianza | Comprobado |
|---|---|---|---|---|---|---|
| Pointer Events | Estándar recomendado para puntero unificado | iOS 13+; CA/WV 55+; SI 6+ | El navegador puede cancelar la secuencia para hacer scroll/zoom | Declarar `touch-action` antes del gesto y manejar `pointercancel` | Alta | 2026-08-07 |
| Touch Events | Estándar legado, aún ampliamente disponible | Amplio | Listeners no pasivos pueden bloquear el hilo de scroll; duplicar con Pointer Events causa dobles acciones | Pointer Events por defecto; Touch Events solo para necesidad documentada | Alta | 2026-08-07 |
| CSS `touch-action` | Estándar | iOS 9.3+; CA 36+; WV 37+; SI 3+ | `pan-x`/`pan-y` ceden ciertos gestos al navegador; no se puede cambiar a mitad del gesto | Valor mínimo necesario; prueba diagonal y cancelación | Alta | 2026-08-07 |
| CSS `pointer-events` | Estándar CSS/SVG, amplio | Amplio | Puede dejar elementos enfocables por teclado aunque no reciban hit testing | Combinar con estado deshabilitado/inert cuando corresponda | Alta | 2026-08-07 |
| `overscroll-behavior` | Estándar | iOS 16+; CA/WV 63+ (históricamente parcial; completo desde 144); SI 8 parcial | No bloquea un viewport iOS en todos los estados ni actúa si el contenedor no tiene overflow desplazable | Propietario de scroll interno; guardia táctil local solo si una prueba demuestra necesidad | Media | 2026-08-07 |
| `scrollIntoView()` | Estándar ampliamente soportado | Base amplia; opciones modernas varían (iOS 14+, CA/WV 61+, SI 8+) | Puede desplazar ancestros y viewport; `smooth` llegó más tarde en iOS | Scroll explícito del contenedor conocido; respetar `prefers-reduced-motion` | Media | 2026-08-07 |
| `<dialog>.showModal()` | Estándar HTML/top layer | iOS 15.4+; CA/WV 37+; SI 3+ | Migrar desde un portal custom cambia top layer, foco, backdrop y anidación | Mantener diálogo ARIA actual hasta una migración probada; feature detect si se adopta | Alta | 2026-08-07 |
| `inert` | Estándar HTML | iOS 15.5+; CA/WV 102+; SI 19+ | `aria-modal` por sí solo no vuelve inerte el fondo | Gestionar foco/fondo explícitamente; usar `inert` como mejora si el mínimo lo permite | Alta | 2026-08-07 |
| Fullscreen API | Estándar, no Baseline en todas las variantes | CA/WV 71+, SI 10+; iOS Safari parcial: iPad, no iPhone | No puede ser requisito para editor inmersivo en iPhone; gesto y salida pertenecen al UA | Pantalla completa visual mediante layout, manteniendo controles del navegador | Alta | 2026-08-07 |
| `screen.orientation` | Estándar; disponibilidad desigual | iOS 16.4+; CA/WV 39+; SI 4+ | Cambios pueden ocurrir mientras OSK o sheet están abiertos | CSS/media queries + `resize`; API solo para diagnóstico | Alta | 2026-08-07 |
| `screen.orientation.lock()` | Estándar con restricciones | iOS: no; CA/WV 38+; SI 3+ | Suele requerir fullscreen/condiciones del UA; no portable | Diseñar portrait y landscape; nunca bloquear para corregir layout | Alta | 2026-08-07 |

## Fuentes de la matriz

- [CSS Values and Units Level 4: viewport variants](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths)
- [CSSOM View: VisualViewport](https://drafts.csswg.org/cssom-view/#visual-viewport)
- [W3C VirtualKeyboard API Working Draft](https://www.w3.org/TR/virtual-keyboard/)
- [CSS Viewport: `interactive-widget`](https://www.w3.org/TR/css-viewport-1/#interactive-widget-section)
- [Chrome: cambio de resize del teclado desde Chrome 108](https://developer.chrome.com/blog/viewport-resize-behavior)
- [WebKit: nuevas unidades de viewport en Safari 15.4](https://webkit.org/blog/12669/new-webkit-features-in-safari-15-5/)
- [WebKit: safe areas y `viewport-fit=cover`](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Apple: meta tags de web apps y `apple-mobile-web-app-status-bar-style`](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html)
- [Apple: soporte de `theme-color` en Safari 15](https://developer.apple.com/documentation/safari-release-notes/safari-15-release-notes)
- [Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/)
- [WHATWG HTML: foco](https://html.spec.whatwg.org/multipage/interaction.html#focus)
- [WHATWG HTML: controles de formulario y selección](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html)
- [MDN: VisualViewport](https://developer.mozilla.org/docs/Web/API/VisualViewport)
- [MDN: VirtualKeyboard API](https://developer.mozilla.org/docs/Web/API/VirtualKeyboard_API)
- [MDN: tipo CSS `<length>` y unidades de viewport](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)
- [MDN: `env()`](https://developer.mozilla.org/docs/Web/CSS/env)
- [MDN: `showPicker()`](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/showPicker)
- [MDN: Fullscreen API](https://developer.mozilla.org/docs/Web/API/Fullscreen_API)
- [MDN: Screen Orientation API](https://developer.mozilla.org/docs/Web/API/Screen_Orientation_API)

Las entradas exactas deben revalidarse antes de elevar el mínimo de navegadores o eliminar una alternativa.
