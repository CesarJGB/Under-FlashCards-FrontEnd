# Viewport y safe area

## Cuatro conceptos, no una sola “altura de pantalla”

| Concepto | Definición útil | Uso correcto en Under Flashcards |
|---|---|---|
| Layout viewport | Área contra la que se calcula normalmente el layout y `position: fixed` | Shell y fallback estable |
| Visual viewport | Parte visible del layout tras zoom, teclado o UI dinámica | Posicionar temporalmente modal/paleta dentro de lo que el usuario ve |
| Viewport pequeño (`sv*`) | Tamaño con interfaces dinámicas expandidas | Mantener acciones visibles en el peor estado de chrome |
| Viewport grande (`lv*`; `vh` por compatibilidad) | Tamaño con interfaces retraídas | Contenido que puede quedar detrás de UI; no acciones críticas |
| Viewport dinámico (`dv*`) | Interpola entre pequeño y grande al variar interfaces | Superficies que siguen chrome dinámico, con coste de relayout |

Las definiciones normativas están en [CSS Values and Units Level 4](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths). CSS mantiene `vh` ligado al viewport grande por compatibilidad. Safari incorporó las variantes en 15.4 ([WebKit](https://webkit.org/blog/12669/new-webkit-features-in-safari-15-5/)); Chromium en 108 ([Chrome](https://developer.chrome.com/blog/new-in-chrome-108/)).

Ninguna unidad responde a la pregunta “¿está abierto el teclado?”. En Chrome Android moderno, el comportamiento predeterminado reduce VisualViewport pero no el layout viewport ni necesariamente `dvh` ([Chrome](https://developer.chrome.com/blog/viewport-resize-behavior)).

## Safe area

`frontend/index.html` declara:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

`viewport-fit=cover` permite usar el área completa en pantallas no rectangulares. El contenido interactivo debe separarse mediante `env(safe-area-inset-top/right/bottom/left)`, como documentan [WebKit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) y [MDN](https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/meta/name/viewport#viewport-fit).

Reglas:

- aportar siempre fallback, por ejemplo `env(safe-area-inset-bottom, 0px)`;
- asignar un único propietario a cada borde;
- aplicar el inset a la zona interactiva, no necesariamente a todo el fondo visual;
- no sustituir un inset por un modelo o una constante de iPhone;
- probar en hardware con recorte: la emulación no valida la composición real con barras del sistema.

`safe-area-inset-bottom` representa una restricción del viewport, no el teclado. WebKit mantiene abierto el [bug 217754](https://bugs.webkit.org/show_bug.cgi?id=217754), donde el valor puede permanecer distinto de cero con OSK visible y producir hueco adicional. Ocultarlo solo con `:focus` tampoco es seguro: un input puede seguir enfocado cuando el teclado ya se cerró.

## Distribución actual de responsabilidades

| Nivel | Uso actual | Riesgo a revisar antes de editar |
|---|---|---|
| `index.css` / `body` | Altura completa, insets superior e inferior, fallback WebKit | El inset global puede propagarse a shells que ya reservan espacio |
| `App.jsx` | Shell fijo, inset superior y navegación móvil inferior | `fixed inset-0` sigue layout viewport; navegación puede competir con OSK |
| `ManualCardEditorModal` | Superficie fija dimensionada con VisualViewport; safe area inferior condicionado por teclado probable | Evento tardío, heurística errónea o doble padding |
| `ActionSheet` | `max-height: min(90dvh, 720px)` y padding inferior seguro | `dvh` no evita OSK; el contenido interno debe desplazarse |
| `ScheduleCalendar` | Padding inferior compuesto con safe area y espacio de footer | Footer oculto/visible debe conservar la misma propiedad del inset |
| `ScheduleMobileFooter` | Portal fijo con padding seguro | Debe probarse con toolbar, recorte y orientación |
| `ColorPalette` | Posición fija calculada dentro de VisualViewport | Cambios de offset y escala durante toolbar/zoom |

Que varios niveles usen `env()` no prueba que hoy exista un defecto visual; identifica una obligación de inspeccionar estilos calculados y rectángulos antes de cambiar la cascada.

## VisualViewport en la práctica

Para una superficie que debe seguir el área visible se leen conjuntamente:

- `width` y `height`;
- `offsetLeft` y `offsetTop`;
- `scale` si el zoom importa;
- eventos `resize` y `scroll`.

Usar solo `height` deja el modal en una posición incorrecta cuando el visual viewport se desplaza. Usar solo `offsetTop` ignora cambios de tamaño. El [bug WebKit 265578](https://bugs.webkit.org/show_bug.cgi?id=265578) demuestra además que la primera actualización puede no coincidir con el final de la animación; tolerar un estado transitorio y recalcular.

VisualViewport solo tiene significado especial para el documento de nivel superior; [MDN](https://developer.mozilla.org/docs/Web/API/Window/visualViewport) señala que en iframes su geometría coincide con el layout viewport. Si Under Flashcards se integra en un iframe, el host debe proporcionar el contrato de espacio disponible.

## Orientación y landscape

La orientación puede cambiar safe areas, chrome, dimensiones del teclado y relación entre viewports en una sola transición. `orientationchange` no debe ser la única señal: usar CSS responsive y mediciones tras `resize`. `screen.orientation.lock()` no está disponible en Safari iOS y puede estar restringido por fullscreen en otros navegadores ([Screen Orientation API](https://developer.mozilla.org/docs/Web/API/Screen_Orientation_API)).

En landscape:

- validar ambos lados del recorte;
- permitir scroll cuando toolbar + footer + teclado no caben;
- no forzar altura mínima que empuje el textarea fuera del área visual;
- recolocar paletas portadas después de la transición;
- probar el retorno a portrait, no solo la primera orientación.

## Dynamic Island y otros recortes

Dynamic Island no necesita una API propia: se modela mediante viewport y safe-area entregados por el agente de usuario. No codificar su tamaño. La prueba debe verificar fondo visual hasta el borde y controles dentro de insets, en portrait y landscape, con barras expandidas/retraídas.

## Patrón de CSS permitido

Una degradación razonable declara el fallback primero:

```css
.surface {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

Esto aporta soporte sintáctico; no resuelve por sí solo teclado, scroll ni bugs de safe area. Cualquier variable JavaScript de altura debe tener una razón más específica que “móvil”.

## Fuentes

- [W3C CSS Values and Units Level 4](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths)
- [CSSOM View](https://www.w3.org/TR/cssom-view-1/)
- [WebKit: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [WebKit: Safari 15.4 viewport units](https://webkit.org/blog/12669/new-webkit-features-in-safari-15-5/)
- [Chrome: viewport resize behavior](https://developer.chrome.com/blog/viewport-resize-behavior)
- [MDN: `env()`](https://developer.mozilla.org/docs/Web/CSS/env)
- [CSS Environment Variables: safe area](https://drafts.csswg.org/css-env/#safe-area-insets)
