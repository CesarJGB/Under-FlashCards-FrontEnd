# Bugs conocidos de navegadores

**Estado comprobado:** 2026-08-07. Este registro solo incluye issues del tracker oficial cuyo título, alcance y estado se pudieron verificar. Un comentario de usuario no se convierte en hecho general. “Workaround” significa mitigación recomendada para Under Flashcards, no necesariamente solución avalada por el proveedor.

## Criterio de inclusión

Un bug entra cuando:

1. existe en WebKit Bugzilla o Chromium Issues;
2. su reproducción se relaciona con una ruta real del proyecto;
3. el estado oficial está disponible;
4. puede definirse una mitigación acotada o una prueba de regresión.

No se agrupan bugs solo porque “se parecen”. Safari, WKWebView, Chrome Android, Android WebView y Samsung Internet mantienen secciones separadas.

## iOS / WebKit compartido

### WK-254868 — alturas incorrectas con `viewport-fit=cover` en web apps instaladas

- **Descripción:** en una PWA instalada con `viewport-fit=cover`, `100svh`, `-webkit-fill-available` y `visualViewport.height` pueden devolver el espacio disponible menos la safe area. El root puede terminar antes del borde físico y revelar una franja inferior; el propio reporte corrige su workaround para usar `100vh` en standalone.
- **Fuente oficial:** [WebKit bug 254868](https://bugs.webkit.org/show_bug.cgi?id=254868), relacionado con [WebKit bug 237961](https://bugs.webkit.org/show_bug.cgi?id=237961).
- **Estado:** `NEW`, P2, Safari 16 en el reporte; última modificación visible 2026-06-07.
- **Workaround recomendado:** conservar los fallbacks pequeños/dinámicos donde modelan Safari normal y sobrescribir solo `min-height` de `html`, `body` y `#root` con `100vh` dentro de `@media (display-mode: standalone)`. El fondo puede ocupar el área física y los controles de borde mantienen un propietario independiente de `env(safe-area-inset-bottom)`.
- **Componentes afectados:** `frontend/src/index.css` y el shell global de `App.jsx`. Los overlays con geometría propia no deben heredar este workaround como detector de teclado.
- **Condición de retirada:** issue resuelto y pruebas físicas de Safari normal/Home Screen con Home Indicator, apertura/cierre de OSK y comparación de rectángulos aprobadas en la versión mínima iOS del proyecto.

### WK-217754 — `safe-area-inset-bottom` permanece con el teclado

- **Descripción:** al aparecer el teclado, `env(safe-area-inset-bottom)` puede seguir siendo distinto de cero aunque el área sobre el OSK ya sea rectangular, dejando un hueco adicional.
- **Fuente oficial:** [WebKit bug 217754](https://bugs.webkit.org/show_bug.cgi?id=217754).
- **Estado:** `NEW`, P2, hardware iPhone/iPad, OS “All”; última modificación visible 2025-04-22.
- **Workaround recomendado:** hacer que un solo contenedor posea el inset. Suprimirlo únicamente cuando coincidan foco editable y reducción material/estable de VisualViewport; restaurarlo cuando la geometría se recupere. No usar `:focus` solo: el input puede quedar enfocado con OSK cerrado.
- **Componentes afectados:** footer de `ManualCardEditorModal`, `ActionSheet`, `ScheduleMobileFooter`, padding inferior de `ScheduleCalendar` y shell global.
- **Condición de retirada:** issue resuelto y prueba física aprobada en la versión mínima iOS del proyecto.

### WK-240860 — `body { overflow:hidden }` puede seguir desplazándose

- **Descripción:** cuando VisualViewport es menor que layout viewport por OSK o zoom, WebKit permite desplazar el documento aunque `body` tenga `overflow:hidden`.
- **Fuente oficial:** [WebKit bug 240860](https://bugs.webkit.org/show_bug.cgi?id=240860).
- **Estado:** `NEW`, P2, Safari 15 en el reporte; el tracker confirma que el comportamiento no es correcto.
- **Workaround recomendado:** no usar body lock como única barrera. Dar scroll a un contenedor interno, volver inerte/no interactivo el fondo y aplicar una guardia `touchmove` no pasiva solo al alcance que una reproducción real necesite. Conservar zoom.
- **Componentes afectados:** `ManualCardEditorModal`, `ActionSheet`, `scrollLock.js`, `useImmersiveScrollGuard`, shell fijo y sheets del calendario.
- **Condición de retirada:** issue resuelto y pruebas con OSK y pinch zoom sin scroll de fondo.

## Safari iOS

### WK-265578 — VisualViewport se actualiza tarde con la UI de Safari expandida

- **Descripción:** con la barra de dirección inferior expandida, `visualViewport.height` y su `resize` pueden actualizarse al final de la animación de apertura/cierre del teclado; con toolbar colapsado o modo Home Screen el reporte observa actualización inmediata.
- **Fuente oficial:** [WebKit bug 265578](https://bugs.webkit.org/show_bug.cgi?id=265578).
- **Estado:** `NEW`, P2, Safari 17, iPhone/iPad; modificado 2026-07-28.
- **Workaround recomendado:** aceptar el frame transitorio, volver a medir en animation frame y responder a una segunda actualización. No animar el modal hacia una medida inicial tratándola como definitiva. Probar toolbar inferior expandido y retraído.
- **Componentes afectados:** `ManualCardEditorModal`, posicionamiento de `ColorPalette`, `useBottomGap` y cualquier overlay ligado a VisualViewport.
- **Condición de retirada:** issue resuelto y secuencia de apertura/cierre estable en las dos posiciones de toolbar soportadas.

## Chrome Android

### CR-41453122 — `focus({preventScroll:true})` no evita scroll

- **Descripción:** Chrome Android puede aceptar la opción `preventScroll` sin impedir el desplazamiento al enfocar.
- **Fuente oficial:** [Chromium issue 41453122](https://issues.chromium.org/issues/41453122) y su [vista de recursos](https://issues.chromium.org/issues/41453122/resources).
- **Estado:** `Won't fix (Obsolete)` en el tracker; MDN BCD continúa marcando la opción sin soporte en Chrome Android, Android WebView y Samsung Internet.
- **Workaround recomendado:** no detectar con excepción. En la pantalla afectada, registrar el scroll container antes del foco y corregir solo un desplazamiento reproducido, comprobando que el caret no quede oculto. Evitar restaurar `window.scrollY` globalmente.
- **Componentes afectados:** foco inicial/reanudación de `ManualCardEditorModal`, restauración de foco de `ActionSheet`, formularios de `ScheduleCalendar` y retorno desde Color Picker.
- **Condición de retirada:** datos de compatibilidad actualizados y prueba real en Chrome Android/WebView/Samsung mínimo del proyecto.

## WebView

### CR-40287394 — Android WebView no redimensionaba VisualViewport independientemente

- **Descripción:** versiones anteriores de Android WebView no ajustaban VisualViewport de forma independiente al aparecer el IME. El issue confirma el cambio desde WebView `139.0.7231.0`.
- **Fuente oficial:** [Chromium issue 40287394](https://issues.chromium.org/issues/40287394); Android documenta el comportamiento M139 en [Understand window insets in WebView](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets).
- **Estado:** corregido desde M139 según el issue. La documentación de Android aclara que el resize por IME cubre solapamiento inferior, no teclados acoplados a izquierda, derecha o arriba.
- **Workaround recomendado:** para WebView <139 o host desconocido, no depender de VisualViewport como única ruta; permitir scroll interno y registrar paquete/proveedor. Para >=139 conservar prueba de regresión dentro del host real.
- **Componentes afectados:** `ManualCardEditorModal`, `useKeyboardHeight`, footers fijos, `ActionSheet` y cualquier futura envoltura nativa.
- **Condición de retirada:** solo si la política de producto exige WebView >=139 y todos los hosts soportados lo verifican.

### WK-301857 — WKWebView iOS 26 conservaba viewport reducido tras cerrar OSK

- **Descripción:** un WKWebView/Cordova podía quedar con altura reducida después de cerrar el teclado en iOS 26.0.1; el reporter confirmó recuperación en iOS 26.1.
- **Fuente oficial:** [WebKit bug 301857](https://bugs.webkit.org/show_bug.cgi?id=301857).
- **Estado:** `RESOLVED CONFIGURATION CHANGED`, P2; el tracker registra prueba corregida en iOS 26.1.
- **Workaround recomendado:** no añadir un hack para versiones corregidas. Si el producto se embebe en WKWebView iOS 26.0.x, volver a medir tras cierre/orientación y ofrecer scroll interno; preferir elevar el mínimo a 26.1 antes que offsets permanentes.
- **Componentes afectados:** `ManualCardEditorModal`, footer fijo, ActionSheets y cualquier host Cordova/Capacitor futuro.
- **Condición de retirada:** conservar como prueba histórica mientras se soporte iOS 26.0.x; no activar workaround en Safari/WebKit sin reproducción.

## Samsung Internet

No se añade ningún bug específico de Samsung Internet en esta revisión: no se encontró un issue oficial de Samsung/Chromium con estado verificable y alcance exclusivo que afecte estas rutas. Esto **no demuestra ausencia de bugs** ni autoriza a heredar resultados de Chrome.

La incompatibilidad de `focus({preventScroll:true})` permanece en la matriz para Samsung porque MDN BCD la registra, pero no se presenta como un bug Samsung confirmado. Se exigen pruebas físicas de foco, picker, teclado, scroll lock y `overscroll-behavior`.

## Bugs resueltos que evitan hacks heredados

### WK-198347 — no llegaba `visualViewport.resize` al abrir teclado

- **Descripción:** iOS 12 no actualizaba VisualViewport ni emitía `resize` al abrir OSK.
- **Fuente oficial:** [WebKit bug 198347](https://bugs.webkit.org/show_bug.cgi?id=198347).
- **Estado:** `RESOLVED FIXED`; el tracker registra la corrección en iOS 13.
- **Workaround recomendado:** ninguno para el mínimo moderno. No conservar polling específico de iOS 12 salvo que el proyecto vuelva a declararlo compatible.
- **Componentes afectados:** listeners de `ManualCardEditorModal` y `ColorPalette` solo como prueba de que un fallback debe tener fecha de retirada.

## Comportamientos que no deben registrarse como bugs

| Comportamiento | Clasificación correcta | Fuente |
|---|---|---|
| `focus()` sin gesto no abre OSK en iOS | Política de interacción de WebKit | [bug 195884](https://bugs.webkit.org/show_bug.cgi?id=195884) |
| `fixed` permanece ligado al layout viewport con OSK | Modelo de viewport esperado | [WebKit bug 202120](https://bugs.webkit.org/show_bug.cgi?id=202120), [Chrome](https://developer.chrome.com/blog/viewport-resize-behavior) |
| `vh` usa el viewport grande | Decisión de compatibilidad de CSS | [CSS Values 4](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths), [WebKit bug 141832](https://bugs.webkit.org/show_bug.cgi?id=141832) |
| `showPicker()` de color no existe en iOS | Falta de soporte, no bug confirmado | [`showPicker()` en MDN](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/showPicker) |
| Fullscreen no portable en iPhone | Limitación de soporte | [Fullscreen API en MDN](https://developer.mozilla.org/docs/Web/API/Fullscreen_API) |

## Plantilla para añadir un bug

```md
### VENDOR-ID — título exacto
- **Descripción:** resultado observado y precondiciones.
- **Fuente oficial:** URL directa al issue.
- **Estado:** valor literal y fecha de comprobación.
- **Workaround recomendado:** alcance, guardia y riesgos.
- **Componentes afectados:** rutas reales de Under Flashcards.
- **Condición de retirada:** evidencia necesaria para eliminarlo.
```

No copiar workarounds de comentarios sin validarlos; un comentario puede ser útil para diseñar una prueba, no para declarar una solución universal.
