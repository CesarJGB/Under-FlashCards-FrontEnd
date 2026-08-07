# Foco, entrada y selección

## Contratos distintos

| Operación | Garantía web | No garantiza |
|---|---|---|
| `element.focus()` | Ejecuta los pasos de foco del elemento si puede enfocarse | Teclado visible, ausencia de scroll ni conservación de activación de usuario |
| `focus({preventScroll:true})` | Solicita no desplazar el elemento al enfocarlo | Implementación efectiva en Chrome Android/WebView/Samsung |
| `element.blur()` | Solicita quitar el foco del elemento | Cierre inmediato del OSK o viewport ya restaurado |
| `autofocus` | Declara candidato inicial de foco | Apertura automática del teclado móvil |
| `selectionStart/End` | Índices de selección de un control de texto compatible | Selección del documento, foco o geometría del caret |
| `setSelectionRange()` | Actualiza rango/dirección del control | Visualización de la selección si el control no tiene foco |

Los algoritmos de foco están definidos por [WHATWG HTML](https://html.spec.whatwg.org/multipage/interaction.html#focus). WebKit documenta como política que el foco programático no debe abrir el teclado de software sin una activación de usuario adecuada ([bug 195884](https://bugs.webkit.org/show_bug.cgi?id=195884)). Por tanto, un resultado sin excepción no prueba la respuesta del OSK.

## `preventScroll` en móvil

El editor y el ActionSheet usan `focus({preventScroll:true})` con un `catch` que recurre a `focus()`. Esa defensa cubre navegadores que rechazan la forma con opciones, pero no los que aceptan y omiten la opción. MDN Browser Compatibility Data marca la opción como no soportada en Chrome Android, Android WebView y Samsung Internet; el [issue Chromium 41453122](https://issues.chromium.org/issues/41453122) está cerrado como obsoleto/Won't fix.

No añadir una restauración global de `window.scrollY`: Under Flashcards desplaza principalmente contenedores internos. Una futura mitigación debe:

1. identificar el scroll container propietario;
2. guardar su posición antes del foco;
3. enfocar en el gesto correcto;
4. restaurar solo si la plataforma produjo un desplazamiento no deseado;
5. confirmar que el caret sigue visible.

Restaurar siempre puede luchar contra el ajuste legítimo del navegador para mostrar el campo.

## `textarea` del editor manual

`ManualCardEditorModal` usa controles `textarea`, guarda `selectionStart`/`selectionEnd` y restaura con `setSelectionRange()`. Es la API correcta para controles de texto; la Selection API del documento (`getSelection()`/`Range`) no modela su selección interna. WHATWG especifica la selección de controles en [Forms: APIs for the text control selections](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection).

Reglas para conservar selección:

- capturar el rango inmediatamente antes de abrir una superficie que pueda mover foco;
- acotar índices a la longitud actual después de editar el valor;
- restaurar dirección si el comportamiento del formato depende de ella;
- no llamar `setSelectionRange()` repetidamente durante composición IME;
- separar “rango restaurado” de “foco restaurado” y de “OSK visible”.

Para texto largo, la selección puede estar fuera del área visible del propio `textarea`. El criterio no es conservar `scrollTop` a cualquier precio, sino mantener caret y contexto editado alcanzables sin desplazar el modal completo.

## Composición, autocorrección y eventos

Los teclados móviles pueden usar composición para producir el valor final. Los eventos `compositionstart`, `compositionupdate`, `compositionend`, `beforeinput` e `input` tienen contratos propios en [UI Events](https://www.w3.org/TR/uievents/) e [Input Events Level 2](https://www.w3.org/TR/input-events-2/). No reescribir el valor controlado en mitad de una composición para aplicar formato, porque puede invalidar la preedición del IME.

Las pruebas deben incluir:

- texto con acentos y autocorrección;
- pulsación larga y selección por manejadores;
- pegar texto multilínea;
- emoji y caracteres representados por más de una unidad UTF-16;
- dictado si forma parte del soporte del producto;
- Gboard y teclado iOS, no solo teclado de hardware.

## `contenteditable`

`contenteditable` está ampliamente disponible, pero delega al navegador edición, DOM generado, selección, pegado, undo y composición. No es un reemplazo equivalente de `textarea`. Under Flashcards debe conservar `textarea` para contenido plano. Adoptar edición rica requiere un modelo de documento, normalización de input y una matriz de pruebas propia; la mera presencia del atributo no basta. Véanse [WHATWG: editing hosts](https://html.spec.whatwg.org/multipage/interaction.html#editing-host) e [Input Events Level 2](https://www.w3.org/TR/input-events-2/).

## Color Picker

`StylePanel` ofrece presets y un `<input type="color">` oculto. Intenta `input.showPicker()` y recurre a `click()`. Este es el patrón de degradación correcto porque:

- `showPicker()` requiere activación transitoria y puede lanzar `NotAllowedError` ([WHATWG HTML](https://html.spec.whatwg.org/multipage/input.html#dom-input-showpicker));
- Safari iOS no ofrece soporte para `showPicker()` en el tipo color según [MDN BCD](https://github.com/mdn/browser-compat-data);
- la UI concreta del color es controlada por el agente de usuario.

No existe un contrato que obligue al picker nativo a conservar el foco o el teclado. Resultado esperado de producto:

1. el gesto abre un medio de selección o deja disponibles los presets;
2. `input`/`change` aplica el color elegido;
3. cerrar o cancelar no pierde el contenido;
4. el usuario puede volver al mismo campo y rango mediante la ruta de reanudación.

`pointerdown.preventDefault()` en los presets intenta evitar un cambio de foco antes del click. Debe comprobarse con Pointer Events y teclado real; no documentarlo como garantía de OSK.

## `blur`, pickers y retorno a la app

Pickers de color/archivo y UI del sistema pueden suspender temporalmente la página o devolver foco en un orden dependiente del agente de usuario. Escuchar `window.blur` o `visibilitychange` puede ayudar a observar, pero no identifica qué picker se abrió. No cerrar un modal ni guardar una tarjeta solo porque la ventana perdió foco.

En el flujo de imagen del editor se debe validar que cancelar, elegir y volver preservan texto, selección posible y scroll. La operación de archivo se considera una transición externa; el OSK puede cerrarse legítimamente.

## Tamaño de fuente y zoom

`index.css` establece `font-size:16px` para `input`, `textarea` y `select` bajo `pointer:coarse`. Se conserva como decisión preventiva del proyecto, no como contrato universal del navegador. No añadir `maximum-scale=1` ni `user-scalable=no`; [WCAG 2.2, 1.4.4](https://www.w3.org/TR/WCAG22/#resize-text) exige que el contenido pueda ampliarse sin pérdida de funcionalidad.

## Mapa de impacto

| Componente | Foco requerido | Riesgo principal |
|---|---|---|
| `ManualCardEditorModal` | Entrada inicial, alternar pregunta/respuesta, volver de toolbar/picker | Foco sin OSK, scroll inesperado, rango obsoleto |
| `ColorPalette` | Preservar editor al aplicar preset; recuperar tras picker | `showPicker` ausente, UI nativa cambia foco |
| `ActionSheet` | Foco del diálogo o `preserveFocus`; restauración al cerrar | Fondo aún interactivo, restauración que desplaza scroll |
| `ScheduleCalendar` | Formularios dentro de sheets | Teclado reduce área, foco atrapado en capa equivocada |
| Editor de texto | Selección y composición | Mutación durante IME, caret fuera de vista |

## Fuentes

- [WHATWG HTML: Focus](https://html.spec.whatwg.org/multipage/interaction.html#focus)
- [WHATWG HTML: text control selections](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection)
- [WHATWG HTML: `showPicker()`](https://html.spec.whatwg.org/multipage/input.html#dom-input-showpicker)
- [WebKit bug 195884](https://bugs.webkit.org/show_bug.cgi?id=195884)
- [W3C Input Events Level 2](https://www.w3.org/TR/input-events-2/)
- [MDN: `HTMLElement.focus()`](https://developer.mozilla.org/docs/Web/API/HTMLElement/focus)

