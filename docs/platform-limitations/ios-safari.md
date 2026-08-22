# iOS y Safari

## Modelo que debe asumir Under Flashcards

En iOS existen dos geometrías relevantes: el **layout viewport**, contra el que se resuelve normalmente el layout, y el **visual viewport**, que representa la porción visible tras zoom, teclado o cambios en la interfaz del navegador. La [especificación CSSOM View](https://drafts.csswg.org/cssom-view/#visual-viewport) no atribuye la reducción a una causa concreta. Por tanto, `visualViewport.height < innerHeight` es una observación geométrica, no una señal oficial de “teclado abierto”.

La política de motor también debe tratarse con precisión. Apple mantiene programas de entitlement para motores alternativos en determinadas regiones y versiones; las condiciones se publican en [Alternative Browser Engines](https://developer.apple.com/support/alternative-browser-engines/) y en las [App Review Guidelines, 2.5.6](https://developer.apple.com/app-store/review/guidelines/#software-requirements). Fuera de una excepción verificada, los navegadores iOS de terceros deben probarse como aplicaciones que usan WebKit. Nunca extrapolar capacidades de Chrome Android a Chrome iOS por el nombre del producto.

## Capacidades y límites relevantes

| Área | Contrato verificable | Consecuencia de ingeniería |
|---|---|---|
| Teclado | iOS expone VisualViewport, pero no VirtualKeyboard API. WebKit conserva restricciones deliberadas al foco programático sin gesto de usuario ([bug 195884](https://bugs.webkit.org/show_bug.cgi?id=195884)). | El editor debe funcionar aunque `focus()` no abra el OSK. Ofrecer una acción táctil explícita y no inferir teclado desde `activeElement`. |
| Viewport | Safari 15.4 añadió `svh`, `lvh` y `dvh`; WebKit documenta la entrega en sus [notas de Safari 15.5](https://webkit.org/blog/12669/new-webkit-features-in-safari-15-5/). | `dvh` sirve para chrome dinámico, no identifica el teclado ni sustituye VisualViewport cuando el diseño debe seguir el área visual. |
| Safe area | `viewport-fit=cover` permite extender el layout y `env(safe-area-inset-*)` protege zonas no rectangulares ([WebKit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)). | Mantener padding en controles de borde, pero aplicarlo una sola vez y no tratarlo como altura de teclado. |
| Posición fija | Los elementos fijos se ligan al containing block; el viewport visual puede desplazarse dentro del layout viewport. WebKit ha tratado este modelo como esperado en el [bug 202120](https://bugs.webkit.org/show_bug.cgi?id=202120). | Un footer `fixed` no queda automáticamente encima del OSK. El modal debe poseer su geometría y su scroll interno. |
| Foco | La activación del teclado por JavaScript puede requerir que la llamada ocurra en la cadena inmediata de una activación de usuario. | `requestAnimationFrame`, promesas o efectos posteriores pueden conservar el foco DOM sin conservar la autorización para mostrar OSK. |
| Color | `<input type="color">` existe, pero `showPicker()` para color no está soportado en Safari iOS según [MDN BCD](https://github.com/mdn/browser-compat-data). La UI y el foco del picker son responsabilidad del agente de usuario. | Conservar `click()` como alternativa y presets accesibles. No exigir que el teclado permanezca visible mientras el picker nativo está abierto. |
| Fullscreen | La implementación móvil es parcial; `requestFullscreen()` no ofrece un contrato portable para iPhone ([MDN](https://developer.mozilla.org/docs/Web/API/Element/requestFullscreen)). | El modo inmersivo del editor debe ser CSS y seguir siendo utilizable con UI del navegador visible. |
| Orientación | `screen.orientation` llegó tarde a Safari iOS y `lock()` no está disponible de forma portable ([MDN](https://developer.mozilla.org/docs/Web/API/ScreenOrientation/lock)). | Diseñar y probar portrait/landscape; nunca bloquear orientación como reparación de layout. |

## Impacto directo en el repositorio

### Animación MP4 de carga

La metadata inspeccionada del recurso actual (`lua_loading_animation_5s.mp4`) describe una pista de vídeo H.264 `avc1` cuadrada de `1068 × 1068` y aproximadamente `5.08 s`. En la implementación anterior, el `<video>` medía `350 × 350` en portrait, pero podía medir `640 × 226.19` en landscape por combinar `aspect-square`, `max-height: 58vh` y `object-fit: contain`. Esa caja no compartía la relación de aspecto del recurso y dejaba un límite de composición innecesario.

La mitigación actual usa un frame cuadrado cuyo lado es el menor entre el ancho disponible y `58vh`, con `overflow: hidden`, fondo igual al overlay y aislamiento de pintura; el vídeo es un bloque que ocupa exactamente ese frame. Esto elimina el letterboxing de la caja y cualquier separación de layout en sus bordes sin recodificar ni sustituir el MP4. No demuestra que Safari haya corregido un artefacto de su compositor ni descarta una línea codificada en un frame.

Chromium y WebKit Linux no pudieron decodificar este recurso durante la investigación (`MEDIA_ERR_DECODE`), aunque sí permitieron medir la caja CSS. La ausencia de una línea en esas capturas no es evidencia de ausencia en Safari iPhone. La validación de portrait/landscape, Safari normal y Home Screen queda **PENDING — DEVICE REQUIRED**.

### `ManualCardEditorModal`

El componente escucha `visualViewport.resize`/`scroll`, conserva una altura de layout inicial y considera probable el teclado cuando la altura visible cae más de 100 px. Esa regla es una **heurística local**, no una API de teclado. Es razonable como degradación porque iOS carece de VirtualKeyboard API, pero debe tolerar:

- cambios del toolbar inferior que también reducen o desplazan VisualViewport;
- zoom de página;
- eventos tardíos durante la animación del teclado;
- foco DOM sin OSK;
- `safe-area-inset-bottom` incorrecto durante el teclado ([bug 217754](https://bugs.webkit.org/show_bug.cgi?id=217754)).

El `focus({preventScroll:true})`, `autofocus` y los reintentos en animation frame no permiten prometer que el OSK aparecerá. El botón contextual para retomar escritura es el fallback de producto verificable.

### `StylePanel` y `ColorPalette`

La paleta se porta a `document.body` y se posiciona con `offsetTop`, `offsetLeft`, `width` y `height` de VisualViewport. Esto evita depender solo del layout viewport, pero sigue expuesto a actualizaciones tardías de Safari. Debe recalcular después de `resize`/`scroll`, no almacenar la primera medida como definitiva.

El `pointerdown.preventDefault()` sobre presets puede preservar el foco DOM. No demuestra que el teclado siga abierto. En el color custom, el picker del sistema puede cambiar foco, suspender eventos o devolver el control en un orden propio del navegador; el criterio de aceptación es que el color se aplique y el usuario pueda retomar edición.

### `ActionSheet`

El sheet usa `position: fixed`, `90dvh`, scroll interno, safe area y bloqueo de `body`. En iOS, `overflow:hidden` en `body` no siempre inmoviliza el viewport cuando el visual viewport es menor ([bug 240860](https://bugs.webkit.org/show_bug.cgi?id=240860)). La hoja no debe depender del bloqueo global como única barrera: el contenido desplazable debe estar dentro del sheet y las pruebas deben intentar arrastrar el fondo.

`preserveFocus` evita mover el foco intencionadamente, pero `aria-modal` no vuelve inerte el fondo por sí solo. La gestión de foco y la accesibilidad se detallan en `modals-and-sheets.md`.

### `ScheduleCalendar` y `ScheduleMobileFooter`

El footer se porta a un shell y queda fijo al borde inferior con safe area. Debe probarse con toolbar de Safari expandido/retraído, orientación, recorte físico y sheets abiertos. Ocultarlo durante superficies inmersivas reduce solapamientos; si vuelve a mostrarse con un input aún enfocado, no debe presumir que el teclado ya terminó su animación.

### Shell y estilos globales

`index.html` ya declara `viewport-fit=cover`; `App.jsx`, `index.css` y varios componentes aplican insets. Antes de cambiar padding hay que inspeccionar estilos calculados para evitar sumar el mismo inset en `body`, shell y footer. Esto es un riesgo de integración observado en la estructura, no un bug del navegador confirmado.

En un cold launch real de la PWA standalone, WebKit expandió `html`/`body`/`#root` y `100vh` antes de actualizar `100dvh` y VisualViewport. Como Login declaraba simultáneamente `fixed inset-0` y `height: 100dvh`, la altura explícita corta prevaleció y dejó visible la franja hasta el `visualViewport.resize`. La clase `login-viewport-surface` mantiene `100dvh` como contrato general, pero usa `100vh` solo cuando coinciden la capacidad WebKit y `display-mode: standalone`; no usa UA, modelo, timeout ni valores de safe area.

La transición de carga usa `apple-mobile-web-app-status-bar-style=black-translucent`. Apple documenta que `default` coloca el contenido por debajo de la status bar y que `black-translucent` permite ocupar toda la pantalla; por eso el modo anterior no podía garantizar un fondo web detrás del notch/Dynamic Island en una PWA standalone. `viewport-fit=cover` sigue presente y no se modifican los paddings globales de safe area, de modo que el cambio amplía la superficie pintada sin sumar un segundo inset al contenido.

`AppLoadingScreen` sincroniza temporalmente el `background-color` inline de `html`, `body` y `#root`: `#FBFAFF` durante Lua y `#EDE9FE` desde el inicio de la marca hasta que termina el reveal. Durante esa superficie lila también cambia el único `<meta name="theme-color">` existente a `#EDE9FE`. Al completar o desmontarse restaura exactamente el contenido anterior del meta y cada valor/prioridad inline; no crea metas nuevos ni cambia `theme_color` del manifest. Esto cubre tanto el canvas que WebKit puede muestrear como el chrome que respeta `theme-color`, pero la composición y el contraste reales de la status bar standalone siguen requiriendo dispositivo físico.

## Reglas específicas de iOS

- Probar en Safari normal y, si se soporta instalación, como web app de pantalla de inicio. Apple documenta que una web app standalone se ejecuta sin UI de navegador y en un contexto separado en [WWDC23: Meet Web Push for Safari](https://developer.apple.com/videos/play/wwdc2023/10120/).
- Probar con toolbar inferior expandido y retraído; no validar solo desde una carga limpia.
- Hacer que toda acción crítica siga visible con safe area y zoom.
- No ocultar el teclado mediante `blur()` para arreglar geometría salvo que el requisito de producto lo exija.
- No corregir todos los iPhone con un offset constante. Recorte, barras, orientación, modo standalone y versión cambian la geometría.
- No usar un bug abierto para predecir el comportamiento de una versión futura. Conservar el workaround pequeño y revalidarlo al actualizar iOS.

## Fuentes principales

- [Apple: Alternative Browser Engines](https://developer.apple.com/support/alternative-browser-engines/)
- [Apple: meta tags de web apps y estilos de status bar](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html)
- [Apple: Safari 15 y `theme-color`](https://developer.apple.com/documentation/safari-release-notes/safari-15-release-notes)
- [WebKit: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [WebKit: New WebKit Features in Safari 15.5](https://webkit.org/blog/12669/new-webkit-features-in-safari-15-5/)
- [WebKit bug 141832: viewport units and browser UI](https://bugs.webkit.org/show_bug.cgi?id=141832)
- [CSSOM View: VisualViewport](https://drafts.csswg.org/cssom-view/#the-visualviewport-interface)
- [CSS Images 4: `object-fit`](https://drafts.csswg.org/css-images-4/#the-object-fit)
- [MDN: `<meta name="viewport">`](https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/meta/name/viewport)
