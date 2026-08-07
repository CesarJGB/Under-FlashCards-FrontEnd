# Teclado virtual

## Lo que la web puede y no puede saber

No existe una señal cross-browser que equivalga a `keyboardIsOpen`. La plataforma ofrece piezas distintas:

| Señal | Qué demuestra | Qué no demuestra |
|---|---|---|
| `document.activeElement` es editable | Un control posee foco DOM | Que el OSK esté visible, su altura o que vaya a aparecer |
| `focus()` resolvió sin error | El método fue aceptado | Que exista activación de usuario o que iOS abra el teclado |
| VisualViewport se redujo/desplazó | Cambió el área visual | Que la causa sea el OSK; zoom y chrome del navegador también la cambian |
| `window.resize` | Algún viewport/ventana cambió según esa implementación | Que sea un evento de teclado ni que ocurra en todos los modos |
| `navigator.virtualKeyboard.boundingRect` | Geometría reportada por una implementación de VirtualKeyboard | Disponibilidad en iOS o en hosts antiguos |
| `blur()` | El elemento perdió foco | Cuándo termina la animación de cierre del OSK |

La distinción entre layout y visual viewport está definida en [CSSOM View](https://drafts.csswg.org/cssom-view/#visual-viewport). Chrome 108 adoptó el modelo en que el OSK redimensiona por defecto solo VisualViewport ([Chrome Developers](https://developer.chrome.com/blog/viewport-resize-behavior)); Safari iOS ya seguía ese modelo. Las unidades `dvh` siguen las variaciones de UI definidas por CSS, pero Chrome documenta que el teclado no las reduce bajo su comportamiento predeterminado ([Chrome 108](https://developer.chrome.com/blog/new-in-chrome-108/)).

## VirtualKeyboard API

La [VirtualKeyboard API de W3C](https://www.w3.org/TR/virtual-keyboard/) es un Working Draft y [MDN](https://developer.mozilla.org/docs/Web/API/VirtualKeyboard_API) la clasifica como experimental, de disponibilidad limitada y restringida a secure contexts. Incluye:

- `navigator.virtualKeyboard.overlaysContent` para pedir que el teclado superponga contenido;
- `geometrychange` y `boundingRect`;
- variables CSS `keyboard-inset-top/right/bottom/left/width/height`.

No está disponible en Safari iOS. En Under Flashcards solo puede añadirse como mejora progresiva:

```js
const canUseVirtualKeyboard = 'virtualKeyboard' in navigator;
```

Esa comprobación solo autoriza a consultar la API. Antes de activar `overlaysContent` se debe demostrar que la pantalla reposiciona editor, toolbar, footer, picker y ActionSheet; la propiedad cambia el contrato global de superposición y no es una simple lectura.

## Estado actual del repositorio

### `ManualCardEditorModal`

El modal mide `visualViewport.height` y `offsetTop`, conserva un máximo como altura de layout y marca “teclado probable” cuando la altura visible cae más de 100 px. El resultado se utiliza para:

- dimensionar y desplazar la superficie fija;
- decidir el padding de safe area del footer;
- ajustar la zona desplazable;
- mostrar una acción para que el usuario retome la escritura.

La estrategia es compatible con iOS porque no depende de VirtualKeyboard API, pero el umbral de 100 px es una **heurística de producto**. No debe exponerse como valor exacto de altura, ni compartirse con nuevos componentes sin reproducir zoom, toolbar y orientación. WebKit registra además que la actualización de VisualViewport puede llegar al final de la animación ([bug 265578](https://bugs.webkit.org/show_bug.cgi?id=265578)).

### `useKeyboardHeight`

El hook calcula `window.innerHeight - document.documentElement.clientHeight` y considera teclado una diferencia superior a 80 px. Con la política `resizes-visual`, ambos valores pueden seguir representando el layout viewport y producir cero mientras el OSK está visible. Se clasifica como fallback heredado de confianza baja; no debe convertirse en fuente común para el editor, el footer o los sheets.

### `ActionSheet` y footer

`90dvh`, `100dvh` o `bottom:0` no prometen estar sobre el teclado. Cuando una hoja se abre desde un textarea enfocado, el contrato debe decidir una de estas conductas y probarla: conservar edición, ocultar explícitamente el OSK o permitir que el contenido interno alcance todas las acciones. No debe emerger de eventos accidentales de foco.

## Modelo permitido para una futura mejora

Si se revisa el manejo de teclado, usar estados observables en vez de un booleano absoluto:

| Estado | Evidencia mínima | Uso permitido |
|---|---|---|
| `unknown` | No hay geometría suficiente o está cambiando | Layout seguro y acción manual de foco |
| `likely-open` | Editable enfocado + reducción visual material y estable | Reubicar controles dentro de límites, sin publicar altura exacta |
| `settling` | `resize`, `scroll` u orientación recientes | Recalcular en animation frame y evitar transiciones contradictorias |
| `likely-closed` | Geometría recuperada de forma estable | Restaurar safe area/footer sin asumir que `blur` ya terminó |

“Estable” debe definirse y probarse; no existe un número universal. Si VirtualKeyboard API está presente, su rectángulo puede elevar la confianza para ese navegador, pero el flujo sin API permanece obligatorio.

## Orden y temporización de eventos

No codificar una secuencia universal `focus → resize → teclado`. Navegador, IME, picker nativo y animación pueden producir órdenes distintos. Como regla:

1. leer geometría en el evento;
2. agrupar escritura de layout en `requestAnimationFrame`;
3. aceptar una segunda actualización;
4. cancelar callbacks al desmontar;
5. no disparar repetidamente `focus()` durante una transición.

Reintentar `focus()` desde un efecto o animation frame puede perder la activación transitoria requerida por WebKit. La política de WebKit está documentada en el [bug 195884](https://bugs.webkit.org/show_bug.cgi?id=195884).

## Instrumentación para una incidencia

Registrar sin datos de contenido:

- dispositivo, SO, navegador y versión; WebView y paquete proveedor si aplica;
- modo navegador/standalone/WebView y orientación;
- `innerWidth/innerHeight`;
- `documentElement.clientWidth/clientHeight`;
- VisualViewport `width`, `height`, `offsetLeft`, `offsetTop`, `scale`;
- elemento activo y tipo de input, nunca su valor;
- evento recibido y timestamp relativo;
- rectángulos de modal, footer y textarea;
- presencia de VirtualKeyboard API y su `boundingRect`, si existe.

Una captura de un único frame no basta para un bug de animación: guardar la secuencia antes, durante y después de abrir/cerrar.

## Criterios de aceptación

- El usuario puede empezar o retomar escritura aunque el foco automático no abra OSK.
- El caret y el área activa siguen alcanzables con teclado abierto.
- Footer, Color Picker y ActionSheet no quedan inaccesibles; no se exige que el OSK permanezca abierto durante UI nativa.
- Cerrar teclado restaura el layout sin salto persistente ni padding inferior duplicado.
- Zoom y toolbar no activan una rama destructiva de “teclado”.
- La experiencia básica funciona sin VisualViewport y sin VirtualKeyboard API, aunque sea menos ajustada.

## Fuentes

- [W3C VirtualKeyboard API](https://www.w3.org/TR/virtual-keyboard/)
- [MDN VirtualKeyboard API](https://developer.mozilla.org/docs/Web/API/VirtualKeyboard_API)
- [CSSOM View: VisualViewport](https://drafts.csswg.org/cssom-view/#the-visualviewport-interface)
- [Chrome: viewport resize behavior](https://developer.chrome.com/blog/viewport-resize-behavior)
- [Chrome: viewport units and virtual keyboard](https://developer.chrome.com/blog/new-in-chrome-108/)
- [WebKit bug 195884: programmatic focus and OSK policy](https://bugs.webkit.org/show_bug.cgi?id=195884)

