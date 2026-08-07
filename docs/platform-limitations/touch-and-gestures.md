# Touch y gestos

## Modelo de eventos

Pointer Events unifica mouse, pluma y touch y es la opción predeterminada para nuevas interacciones. El navegador puede cancelar una secuencia con `pointercancel` cuando decide ejecutar scroll, zoom u otra manipulación. `touch-action` participa en esa decisión **antes** de que comience el gesto; modificarlo durante la secuencia no rescata el gesto actual. Estos contratos están en [Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/).

Touch Events sigue disponible por compatibilidad y para necesidades táctiles específicas, pero mezclar listeners pointer y touch sobre la misma acción puede duplicarla. Toda excepción debe indicar por qué Pointer Events no basta.

## `touch-action`

| Valor | Cede al navegador | Riesgo para Under Flashcards |
|---|---|---|
| `auto` | Gestos definidos por el UA | Un drag custom puede cancelarse al iniciar scroll |
| `manipulation` | Pan y pinch zoom; desactiva gestos no estándar como doble tap donde aplica | No equivale a “solo click” ni bloquea zoom |
| `pan-x` | Pan horizontal; el eje inicial queda decidido para la secuencia | La paleta debe seguir permitiendo scroll vertical fuera de su strip |
| `pan-y` | Pan vertical | No usar en una superficie que necesita arrastre horizontal |
| `none` | El elemento reclama los gestos, sujeto a reglas del UA | Puede romper scroll y zoom; prohibido como arreglo global |

`StylePanel` aplica `touch-action: pan-x` y `overflow-x:auto` a la paleta horizontal. Debe recibir `pointercancel`, no impedir el scroll vertical del sheet al iniciar fuera del strip y no depender de una inversión de eje después de empezar.

## Listeners pasivos y `preventDefault`

Un listener pasivo promete no cancelar el scroll y permite al navegador comenzar antes. Chrome convierte ciertos listeners `touchstart`/`touchmove` en targets raíz en pasivos por defecto como intervención de rendimiento ([Chrome Developers](https://developer.chrome.com/blog/scrolling-intervention)). Cuando una superficie necesita `preventDefault()`, debe registrar explícitamente `{passive:false}` en el nodo más local posible.

`useImmersiveScrollGuard` intercepta `touchmove` y `wheel` en el documento y permite excepciones con `data-immersive-allow-scroll`. Es código de alto riesgo porque actúa sobre todo el documento mientras está activo. Cualquier cambio debe probar:

- scroll dentro de editor/textarea;
- scroll fuera del área permitida;
- arrastre desde los bordes;
- pinch zoom;
- cierre del modal y eliminación de listeners;
- dos overlays que se solapan.

No añadir más listeners globales para resolver un componente local.

## Preservación de foco en controles

Los presets del Color Picker cancelan `pointerdown` para evitar que el gesto cambie foco antes de aplicar el estilo. Es una técnica observable que debe cumplir accesibilidad:

- el `click` debe seguir ejecutándose;
- teclado físico y tecnologías asistivas necesitan activación equivalente;
- `pointercancel` no debe aplicar el color;
- el elemento debe seguir teniendo nombre y estado accesibles;
- preservar foco DOM no se documenta como preservar OSK.

El backdrop de `ActionSheet` también cancela `pointerdown`. Validar que un tap deliberado cierre una sola capa y que un drag iniciado dentro del sheet no se interprete como click del backdrop.

## Objetivos táctiles

WCAG 2.2 nivel AA exige normalmente un objetivo de al menos 24 × 24 CSS px o separación/equivalente mediante excepciones ([SC 2.5.8 Target Size (Minimum)](https://www.w3.org/TR/WCAG22/#target-size-minimum)). El criterio mejorado de 44 × 44 está en [SC 2.5.5](https://www.w3.org/TR/WCAG22/#target-size-enhanced). Under Flashcards usa controles móviles de 44 px en varias superficies; conservarlo como objetivo de calidad del proyecto, sin etiquetarlo erróneamente como mínimo AA universal.

Para swatches pequeños, el hit area puede ser mayor que el círculo visual. Debe existir foco visible y la proximidad entre colores no puede hacer ambiguo el tap.

## Gestos reservados y navegación

El navegador y el sistema conservan gestos de navegación, zoom y selección. Under Flashcards no debe reclamar los bordes de pantalla ni desactivar zoom para obtener un drag. Si un gesto custom colisiona, ofrecer controles explícitos.

En Android, probar Atrás con teclado, picker y sheet. En iOS, probar swipe de navegación y arrastre desde los bordes sin pérdida de estado. El resultado exacto puede pertenecer al UA; el contrato del producto es no corromper ni ejecutar dos acciones.

## Mapa de componentes

| Componente | Gestos | Fallo a detectar |
|---|---|---|
| `ManualCardEditorModal` | tap de textarea/toolbar/footer, scroll vertical, selección | click perdido, scroll de fondo, teclado que se cierra al aplicar formato |
| `ColorPalette` | tap de swatch, pan horizontal, gesto diagonal | color accidental, `pointercancel` ignorado, sheet vertical bloqueado |
| `ActionSheet` | tap de opción/backdrop, scroll interno | backdrop cierra durante drag, doble cierre, fondo desplazable |
| `ScheduleCalendar` | tap de día, navegación, sheets | targets pequeños, footer intercepta día inferior |
| `ScheduleMobileFooter` | botones de 44 px cerca del borde | safe area insuficiente, gesto del sistema interceptado |
| Editor | selección larga, manejadores, copiar/pegar | guardia global impide selección o auto-scroll del caret |

## Pruebas mínimas por gesto

Para cada control touch nuevo registrar:

1. **Tap:** una activación por gesto y feedback visible.
2. **Movimiento mínimo:** no activar si se convirtió en scroll.
3. **Drag en eje permitido:** desplazamiento continuo sin click final accidental.
4. **Drag diagonal:** convivencia con el scroll del contenedor padre.
5. **Cancelación:** `pointercancel` limpia estado pressed/drag.
6. **Multitouch/zoom:** no bloquear ampliación del documento.
7. **Teclado físico/screen reader:** existe activación no táctil equivalente.
8. **Borde y safe area:** el sistema puede tomar el gesto sin pérdida de datos.

## Fuentes

- [W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/)
- [W3C Touch Events](https://www.w3.org/TR/touch-events/)
- [Chrome: passive scrolling intervention](https://developer.chrome.com/blog/scrolling-intervention)
- [Chrome: passive event listener guidance](https://developer.chrome.com/docs/lighthouse/best-practices/uses-passive-event-listeners/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

