# Modales y hojas de acciones

## Contrato modal, no apariencia modal

Un backdrop y `z-index` no crean una interacción modal. El patrón de [WAI-ARIA Authoring Practices para modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) exige que el contenido debajo sea inerte, que el foco permanezca dentro, que Escape cierre cuando corresponda y que el foco vuelva a un destino lógico.

`aria-modal="true"` comunica modalidad a tecnologías asistivas, pero no bloquea pointer, scroll ni foco por sí solo. Under Flashcards debe implementar esas propiedades o usar una primitiva que lo haga.

## Implementación actual de `ActionSheet`

`frontend/src/components/common/ActionSheet.jsx`:

- crea un portal en `document.body`;
- usa `role="dialog"` y `aria-modal="true"`;
- bloquea scroll de body con propietarios;
- cierra con Escape;
- atrapa Tab;
- enfoca el diálogo salvo `preserveFocus`;
- intenta restaurar el foco anterior al cerrar;
- dispone backdrop fijo y contenido interno con scroll;
- limita altura con `min(90dvh,720px)` y aplica safe area.

Esto es un diálogo custom, no `<dialog>`. Su accesibilidad depende de que cada comportamiento siga funcionando en capas anidadas, con portales y al desmontar.

## `preserveFocus`

El ActionSheet de estilos del creador usa `preserveFocus` para no quitar foco al textarea. Esta opción cambia el contrato modal: el foco permanece técnicamente detrás de la hoja aunque la hoja sea `aria-modal`. Solo es aceptable para una herramienta visual íntimamente asociada al editor si:

- los controles del sheet siguen operables y etiquetados;
- el fondo no puede ejecutar acciones ajenas;
- el lector de pantalla no recibe una estructura contradictoria;
- cerrar no restaura un foco distinto ni mueve el scroll;
- la ruta de teclado físico se prueba explícitamente.

No reutilizar `preserveFocus` en otros sheets sin justificar esa relación de herramienta-editor.

## Diálogo nativo frente a custom

`<dialog>.showModal()` coloca el elemento en top layer y vuelve inerte el resto del documento conforme a [WHATWG HTML](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element). `inert` también tiene un contrato propio en [WHATWG](https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute). Ambos están soportados en las versiones móviles modernas de la matriz, pero una migración no es neutra.

| Decisión | Ventaja | Riesgo para Under Flashcards |
|---|---|---|
| Mantener custom | Conserva layout, portales y comportamiento actual | El proyecto mantiene foco, inertness, stack, backdrop y scroll lock |
| Migrar a `<dialog>` | Top layer e inertness nativos | Cambia foco inicial/retorno, stacking con pickers, animación, backdrop, sheets anidados y bugs del UA |

No migrar como “limpieza” sin casos equivalentes de editor, Color Picker, calendario, teclado y accesibilidad.

## Stack de capas

Las superficies reales pueden anidarse:

1. shell de aplicación;
2. `ManualCardEditorModal`;
3. ActionSheet de estilos;
4. ColorPalette portaleada;
5. picker nativo de color o archivo.

El picker nativo está fuera del stack DOM. No se controla con `z-index` ni con trampa de foco. Al regresar, la capa que abrió el picker debe seguir montada y con datos intactos.

Para capas DOM:

- una sola capa responde a Escape/backdrop;
- el propietario superior recibe puntero y foco;
- scroll lock se libera al cerrar el último propietario;
- el foco se restaura al activador si aún existe y sigue siendo lógico;
- desmontaje por navegación libera listeners aunque no haya animación de cierre.

## Teclado y scroll

`90dvh` no garantiza una hoja por encima del OSK. En landscape o con texto grande, una hoja debe permitir scroll interno hasta la acción final. Si se conserva el foco de un textarea detrás, el componente debe probar la geometría con teclado visible y no depender de que `blur` ocurra accidentalmente.

En iOS, body scroll lock puede fallar cuando el visual viewport es menor ([WebKit bug 240860](https://bugs.webkit.org/show_bug.cgi?id=240860)). Por eso modalidad requiere además superficie interna de scroll e inertness/intercepción del fondo. `overscroll-behavior` ayuda, pero no sustituye estas capas.

## Contratos por superficie

| Superficie | Foco inicial | Scroll | Cierre/retorno | Riesgo móvil principal |
|---|---|---|---|---|
| `ManualCardEditorModal` | Textarea si el UA permite OSK; fallback táctil | Centro/textarea, nunca documento | Vuelve al creador sin pérdida | VisualViewport, safe area, teclado y picker |
| ActionSheet normal | Contenedor o control lógico | Interior del sheet | Escape/backdrop/acción; restaura activador | Altura con OSK y body lock |
| ActionSheet de estilos | Preserva editor por diseño actual | Sheet/paleta | Vuelve al mismo editor | Semántica modal con foco detrás |
| Sheets de `ScheduleCalendar` | Título/control inicial apropiado | Interior | Vuelve a día/acción lógica | Stack de sheets y footer inferior |
| `ColorPalette` | Herramienta contextual | Horizontal en móvil | Preset o cierre; editor recuperable | Portal visual y pointer cancellation |
| Picker nativo | Controlado por el UA | Controlado por SO | Evento `input/change` o cancelación | Foco/visibilidad fuera del DOM |

## Etiquetado y foco inicial

Todo diálogo necesita nombre accesible mediante título referenciado o `aria-label`. Para contenido largo, WAI-ARIA APG recomienda a veces enfocar un elemento estático inicial para que el comienzo no quede fuera de vista; no enfocar automáticamente la acción destructiva. El ActionSheet debe elegir foco según contenido, no siempre el primer botón.

Al cerrar, si el activador fue desmontado, el destino debe ser otro elemento lógico del flujo. Llamar `focus()` sobre una ref obsoleta no cumple restauración.

## Criterios de aceptación

- Fondo no accionable, no desplazable y no navegable por Tab mientras la modalidad lo exige.
- Escape/Atrás/click de backdrop cierran como máximo una capa.
- Todo contenido y acción final son alcanzables con OSK, landscape y texto al 200%.
- La apertura no desplaza permanentemente el editor.
- Cerrar devuelve foco lógico sin depender de `preventScroll` en Android.
- Picker nativo puede cancelarse y volver sin pérdida de datos ni lock huérfano.
- La capa superior conserva prioridad aun cuando todas usan portales.

## Fuentes

- [WAI-ARIA APG: Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WHATWG HTML: `<dialog>`](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)
- [WHATWG HTML: inert](https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute)
- [WCAG Technique H102: HTML `inert`](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
- [WebKit bug 240860](https://bugs.webkit.org/show_bug.cgi?id=240860)
