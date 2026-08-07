# Chrome Android, Android WebView y Samsung Internet

## Modelo de viewport desde Chrome 108

Chrome Android cambió en la versión 108 el comportamiento predeterminado del teclado en pantalla: al aparecer el OSK, el navegador redimensiona el **visual viewport**, pero mantiene el layout viewport. Chrome documenta la transición y sus tres políticas en [Prepare for viewport resize behavior changes coming to Chrome on Android](https://developer.chrome.com/blog/viewport-resize-behavior):

- `interactive-widget=resizes-visual`: política predeterminada; cambia VisualViewport;
- `interactive-widget=resizes-content`: también cambia el layout viewport;
- `interactive-widget=overlays-content`: el teclado superpone ambos viewports.

Esta política es global al documento. Añadir `interactive-widget=resizes-content` para arreglar un solo modal alteraría `position: fixed`, unidades dinámicas, shell y pies de toda la aplicación. Cualquier cambio de ese meta requiere una decisión explícita y la repetición completa de pruebas.

Chrome también aclara que las unidades dinámicas de viewport no se reducen necesariamente por el teclado bajo la política predeterminada ([Chrome 108](https://developer.chrome.com/blog/new-in-chrome-108/)). Por ello `100dvh` no es detector ni solución completa para OSK.

## VirtualKeyboard API

Chromium implementa la [VirtualKeyboard API](https://developer.chrome.com/docs/web-platform/virtual-keyboard/) como capacidad experimental/progresiva. La especificación permite `navigator.virtualKeyboard.overlaysContent`, `geometrychange`, `boundingRect` y variables `keyboard-inset-*`, pero exige secure context y no tiene soporte en iOS ([W3C Working Draft](https://www.w3.org/TR/virtual-keyboard/)).

Reglas del proyecto:

- comprobar `'virtualKeyboard' in navigator` y la propiedad concreta antes de usarla;
- no activar `overlaysContent` sin que el mismo componente posea el reposicionamiento de todas las acciones inferiores;
- mantener el camino VisualViewport y un layout legible sin la API;
- no mezclar `interactive-widget` y `overlaysContent` sin documentar qué política gana y probarla en cada host.

## Android System WebView no es “Chrome embebido”

Android System WebView usa Chromium y se actualiza normalmente mediante Google Play, pero el host controla configuración, ciclo de vida, ventana y versión instalada. El cambio de Chrome 108 **no se aplicó automáticamente a WebView**. Android documenta que el resize independiente de VisualViewport por IME empieza en WebView M139 y que cubre solapamiento inferior, no teclados acoplados a otros bordes: [Understand window insets in WebView](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets). Android recomienda identificar el paquete actual con `WebViewCompat.getCurrentWebViewPackage()` en [Managing WebView objects](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview) y ofrece herramientas específicas en [WebView DevTools](https://developer.android.com/develop/ui/views/layout/webapps/debug-webview-devtools-app).

Consecuencias:

- registrar proveedor y versión de WebView en cada incidencia;
- no dar por presente una API solo porque el Chrome del dispositivo sea reciente;
- probar dentro del host real, no solo abriendo la URL en Chrome;
- aceptar que el host puede cambiar `adjustResize`, fullscreen, barras del sistema o permisos de pickers.

La documentación general de Android advierte que WebView no incluye todas las funciones de un navegador completo: [Build web apps in WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview).

## Samsung Internet

Samsung Internet comparte una base Chromium, pero publica versiones y habilita capacidades en su propio calendario. La matriz conserva una columna SI separada. No se permite inferir soporte desde la versión de Chrome ni aplicar un workaround “Chromium” sin reproducirlo en Samsung Internet.

## Impacto directo en Under Flashcards

| Componente | Riesgo Android real | Regla aplicable |
|---|---|---|
| `ManualCardEditorModal` | El OSK reduce VisualViewport desde Chrome 108, mientras `100dvh` puede conservar altura de layout. El umbral de 100 px puede confundir UI/zoom con teclado. | VisualViewport para geometría; editable enfocado solo como señal auxiliar; alternativa táctil para foco. |
| `ManualCardEditorModal` y `ActionSheet` | `focus({preventScroll:true})` figura sin soporte efectivo en Chrome Android/WebView/Samsung; Chromium cerró el [issue 41453122](https://issues.chromium.org/issues/41453122) como obsoleto/Won't fix. | No confiar en que no lance. Medir el scroll container antes/después en pruebas específicas. |
| `useKeyboardHeight` | Compara `window.innerHeight` con `documentElement.clientHeight`. Con `resizes-visual`, el layout viewport puede no cambiar y la diferencia puede ser cero aun con OSK. | Considerarlo fallback heredado, no señal autorizada para nuevos componentes. |
| `StylePanel` | La paleta horizontal declara `touch-action: pan-x`; el navegador toma la decisión al inicio del gesto y puede emitir `pointercancel`. | Probar arrastre horizontal, diagonal y scroll vertical; no cambiar `touch-action` a mitad de gesto. |
| Color Picker | `showPicker()` requiere activación transitoria y puede lanzar `NotAllowedError` ([Chrome](https://developer.chrome.com/blog/show-picker)). | Invocarlo directamente desde el gesto; conservar `click()` y presets. |
| `ActionSheet` | `90dvh` no garantiza quedar sobre OSK. Scroll interno y foco/restauración pueden desplazar el documento. | Probar sheet con textarea enfocado y teclado visible; mantener acción primaria alcanzable. |
| `ScheduleMobileFooter` | Un footer fijo se resuelve contra el layout viewport; puede quedar tapado si el teclado está abierto. | Ocultarlo o reposicionarlo por contrato de pantalla, no por una suposición sobre `dvh`. |
| `useImmersiveScrollGuard` | `touchmove` no pasivo evita scroll en el hilo principal y puede interferir con gestos del navegador. | Acotar a la superficie inmersiva y permitir explícitamente sus scroll containers. |

## Reglas específicas de Android

- Probar Chrome con toolbar visible y después de scroll; el chrome dinámico también altera el área visible.
- Verificar versión exacta de Chrome, Samsung Internet y proveedor WebView; conservarla en la evidencia.
- Probar Gboard y, al menos en regresiones importantes, otro IME. Composición, barra de sugerencias y altura no son constantes.
- Probar botón/gesto Atrás con picker, teclado y ActionSheet. No debe cerrar dos capas ni dejar scroll bloqueado.
- No introducir una ruta de código por `Android` cuando la capacidad pueda detectarse directamente.
- No tratar VirtualKeyboard API como requisito mínimo hasta que matriz y política de navegadores del proyecto lo autoricen.

## Fuentes principales

- [Chrome: viewport resize behavior](https://developer.chrome.com/blog/viewport-resize-behavior)
- [Chrome: viewport units and keyboard in Chrome 108](https://developer.chrome.com/blog/new-in-chrome-108/)
- [Chrome: Virtual Keyboard API](https://developer.chrome.com/docs/web-platform/virtual-keyboard/)
- [W3C: VirtualKeyboard API](https://www.w3.org/TR/virtual-keyboard/)
- [Android Developers: Jetpack WebKit overview](https://developer.android.com/develop/ui/views/layout/webapps/jetpack-webkit-overview)
- [Android Developers: Managing WebView](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview)
- [Chrome: scrolling intervention for passive listeners](https://developer.chrome.com/blog/scrolling-intervention)
- [Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/)
