# `fixed`, `sticky`, overlays y scroll

## Containing blocks y scrollports

`position: fixed` no significa “pegado a los píxeles visibles sobre el teclado”. Se posiciona respecto a su containing block, normalmente el viewport de layout. Además, un ancestro con `transform` distinto de `none` crea un containing block para descendientes `fixed`, según [CSS Transforms Level 1](https://www.w3.org/TR/css-transforms-1/#transform-rendering). Filtros y otras propiedades también pueden crear contextos y deben revisarse en estilos calculados.

`position: sticky` se limita por su containing block y por el scrollport relevante. Cambiar `overflow` de un ancestro puede cambiar cuál es ese scrollport. La definición normativa de ambos modos está en [CSS Positioned Layout Level 3](https://www.w3.org/TR/css-position-3/).

Consecuencias para el proyecto:

- preferir portales para overlays que deben escapar de contenedores transformados;
- mantener un root de overlays conocido y un orden de capas documentado;
- definir qué nodo se desplaza y cuál permanece fijo;
- inspeccionar ancestros, no solo las clases del overlay;
- no usar `z-index` para intentar escapar de un stacking context ajeno.

## Visual viewport y teclado

Un overlay `fixed; inset:0` puede cubrir el layout viewport y aun así no coincidir con la porción visible mientras el OSK está abierto. WebKit considera esperado que `fixed`/`sticky` se liguen al layout viewport en este modelo ([bug 202120](https://bugs.webkit.org/show_bug.cgi?id=202120)). Chromium 108 adoptó por defecto el redimensionamiento exclusivo del visual viewport para OSK ([Chrome](https://developer.chrome.com/blog/viewport-resize-behavior)).

Cuando el requisito es seguir el área visible, el componente debe usar conjuntamente VisualViewport `height` y `offsetTop`, con fallback. No aplicar esta corrección a todos los `fixed`: un footer de navegación puede tener un contrato distinto a un editor inmersivo.

## Bloqueo de scroll

`scrollLock.js`, `ActionSheet` y `ManualCardEditorModal` usan `overflow:hidden` y `overscroll-behavior` sobre `body`/`html`. Es una primera barrera, no una garantía universal. El [bug WebKit 240860](https://bugs.webkit.org/show_bug.cgi?id=240860) confirma que `body { overflow:hidden }` puede seguir desplazándose cuando el visual viewport es menor por teclado o zoom.

Modelo recomendado:

1. el overlay ocupa su superficie;
2. el fondo se excluye de interacción y foco;
3. un nodo interno explícito posee el scroll del contenido largo;
4. `overscroll-behavior` evita encadenamiento donde está soportado;
5. solo si una prueba real demuestra escape, una guardia `touchmove` no pasiva y acotada evita el gesto concreto;
6. cerrar la última capa restaura exactamente los estilos y scroll anteriores.

Un bloqueo con varios propietarios debe contar capas; quitarlo al cerrar una hoja interior mientras sigue abierto el modal exterior es un defecto de stack, no del navegador.

## `overscroll-behavior`

La propiedad controla encadenamiento y efectos de límite en scroll containers ([Chrome Developers](https://developer.chrome.com/blog/overscroll-behavior/)). No produce scrollability: si el nodo no tiene overflow desplazable, su efecto puede ser parcial. Safari iOS la soporta desde 16; versiones anteriores necesitan una experiencia segura sin ella.

No aplicar `overscroll-behavior:none` indiscriminadamente al documento: puede suprimir navegación/refresh esperados. Under Flashcards ya limita el comportamiento en superficies inmersivas; conservar el alcance mínimo.

## Aplicación por componente

### `ManualCardEditorModal`

- Portal/superficie fija: debe seguir VisualViewport mientras el teclado probable está activo.
- Contenido central: propietario del scroll; textarea y toolbar no deben desplazar el documento de fondo.
- Footer: debe permanecer alcanzable, pero su safe area cambia de estrategia con OSK.
- Cierre: restaura body lock aunque un picker haya interrumpido foco.

El modal no debe recibir un offset estático por iOS. Cualquier corrección debe provenir de geometría y contemplar el evento tardío del [bug 265578](https://bugs.webkit.org/show_bug.cgi?id=265578).

### `ActionSheet`

Se porta a `body`, fija al borde inferior y limita altura a `min(90dvh,720px)`. El contenido interno desplazable es obligatorio cuando teclado, landscape o texto grande reducen espacio. El backdrop debe cubrir la misma geometría visual que la hoja; probar arrastre del fondo, no solo click.

### `ColorPalette`

La paleta portaleada evita ancestros transformados y usa VisualViewport. Su rectángulo debe recalcularse por resize/scroll del viewport, scroll de documento y cambio de tamaño del diálogo. `ResizeObserver` puede agrupar observaciones, pero las escrituras deben programarse para evitar ciclos.

### `ScheduleMobileFooter` y shell

El footer se porta al shell de dashboard. `bottom:0` y safe area son correctos con teclado cerrado, pero el OSK puede superponerlo. La pantalla debe decidir si se oculta o reposiciona; no dejar que el resultado dependa de si Chrome redimensionó `dvh`.

`App.jsx` ya usa un shell fijo con `main` desplazable. Cambiar overflow global puede alterar sticky headers, restauración de scroll y todos los portales: revisar la aplicación completa.

Los controles que conviven con la navegación global no se anclan individualmente al viewport. `DashboardBottomDock` posee el inset inferior y compone en flujo el host flotante, la separación y la navbar real. Esta relación evita que un cambio de altura del navbar, orientación o estabilización tardía de unidades dinámicas deje al FAB en una coordenada distinta. Un control de una pantalla inmersiva solo debe usar otro propietario cuando la navbar global esté realmente oculta.

El editor de mazo aplica el mismo principio localmente: `FlashcardCreator` compone el host de `PdfExtractor` y su footer fijo en un solo flujo. El inset sigue perteneciendo al footer; el FAB solo ocupa el host y no repite su altura ni el inset.

## Checklist de revisión de un overlay

- ¿Qué nodo crea el containing block?
- ¿Qué nodo posee el scroll y tiene overflow real?
- ¿Qué viewport debe seguir con OSK cerrado y abierto?
- ¿Quién aplica cada safe-area inset?
- ¿Qué capa es superior y quién restaura el body lock?
- ¿El fondo queda fuera de foco, puntero y lectura modal?
- ¿Qué ocurre con 200% zoom, landscape y texto largo?
- ¿Qué evento vuelve a medir tras toolbar, orientación y picker?
- ¿Existe una ruta funcional sin VisualViewport u `overscroll-behavior`?

## Fuentes

- [W3C CSS Positioned Layout Level 3](https://www.w3.org/TR/css-position-3/)
- [W3C CSS Transforms Level 1](https://www.w3.org/TR/css-transforms-1/#transform-rendering)
- [CSSOM View](https://www.w3.org/TR/cssom-view-1/)
- [Chrome: `overscroll-behavior`](https://developer.chrome.com/blog/overscroll-behavior/)
- [WebKit bug 240860](https://bugs.webkit.org/show_bug.cgi?id=240860)
- [WebKit bug 202120](https://bugs.webkit.org/show_bug.cgi?id=202120)
