# Checklist de pruebas móviles

Este checklist valida comportamiento observable, no presencia de clases CSS. Cada caso debe registrar dispositivo real, resultado y evidencia. La emulación puede ejecutarse antes, pero no sustituye los casos marcados como físicos.

## Registro obligatorio de ejecución

| Campo | Valor a registrar |
|---|---|
| Build | SHA/URL/entorno; para esta base: `697d6f62f0276f444e58adaf9fbb53f2f8966e1f` |
| Dispositivo | Marca, modelo, tamaño y presencia de notch/Dynamic Island |
| Software | SO, navegador y versión completa; en WebView, paquete proveedor y versión |
| Modo | Safari/Chrome/Samsung normal, Home Screen, Android WebView o escritorio |
| UI | Barra superior/inferior y estado expandido/retraído |
| Entrada | Teclado/IME, idioma, autocorrección, teclado físico sí/no |
| Accesibilidad | Zoom de página/texto, VoiceOver/TalkBack si aplica |
| Evidencia | Vídeo desde antes del gesto hasta estabilización, capturas y log geométrico sin contenido del usuario |
| Resultado | `PASS`, `FAIL`, `BLOCKED` o `NOT APPLICABLE`, con issue si falla |

Para bugs de viewport, el log mínimo incluye `innerHeight`, `documentElement.clientHeight`, VisualViewport `height`, `offsetTop` y `scale`, elemento activo y rectángulos del modal/footer. No registrar texto de tarjetas.

## Matriz mínima de dispositivos

| Prioridad | Entorno físico | Razón |
|---|---|---|
| P0 | iPhone con Dynamic Island, iOS estable soportado, Safari, portrait/landscape | Recortes, safe area, toolbar inferior, WebKit y OSK reales |
| P0 | iPhone pequeño o con notch/home indicator, Safari | Altura crítica y texto/teclado con poco espacio |
| P0 | Android Pixel o equivalente, Chrome estable, Gboard | Política `resizes-visual`, VisualViewport y picker Chromium |
| P0 | Samsung Galaxy, Samsung Internet estable | Calendario Chromium propio; no inferible desde Chrome |
| P1 | Android host con System WebView; registrar si es anterior/posterior a M139 | Resize de VisualViewport por IME depende de WebView/host |
| P1 | iPhone Safari añadido a Home Screen | Sin browser chrome y contexto standalone distinto |
| P1 | iPad Safari si está soportado | Split view, hardware keyboard y fullscreen parcial |
| P2 | Safari y Chrome de escritorio | Teclado/foco accesible; nunca sustituye móvil |

La versión “estable soportada” y la versión mínima declarada por producto deben probarse. Si no existe política mínima, eso es un bloqueo para afirmar compatibilidad completa.

## Viewport, safe area y orientación

| ID / entorno | Objetivo | Pasos | Resultado esperado |
|---|---|---|---|
| VP-01 · iPhone Dynamic Island, Safari, portrait, físico | Verificar safe area con teclado cerrado | 1. Cargar desde URL nueva con toolbar visible.<br>2. Abrir calendario y editor manual.<br>3. Inspeccionar encabezado, footer y acciones de borde.<br>4. Repetir tras scroll que retraiga toolbar. | Fondos pueden llegar al borde; texto y controles no quedan bajo Dynamic Island/home indicator. No hay doble padding inferior ni salto al retraer toolbar. |
| VP-02 · iPhone Safari, toolbar inferior expandido/retraído | Detectar la temporización del bug WK-265578 | 1. Con toolbar expandido abrir editor y tocar textarea.<br>2. Grabar apertura/cierre de OSK y métricas.<br>3. Retraer toolbar mediante scroll y repetir.<br>4. Comparar último frame estable. | Puede existir una medida transitoria, pero el modal termina alineado al VisualViewport, sin hueco persistente, footer perdido ni oscilación. |
| VP-03 · Android Chrome, portrait | Confirmar modelo Chrome 108+ | 1. Registrar `innerHeight`, `clientHeight`, `visualViewport.height`.<br>2. Abrir/cerrar OSK en editor.<br>3. Observar modal y footer. | VisualViewport puede reducirse sin cambiar layout viewport. El editor termina utilizable y ninguna decisión depende de que `dvh` o `innerHeight` se reduzcan. |
| VP-04 · iPhone y Android, landscape, físico | Validar espacio crítico horizontal | 1. Abrir editor con teclado cerrado en portrait.<br>2. Rotar a landscape.<br>3. Abrir OSK, desplazar textarea y abrir estilos.<br>4. Cerrar OSK y volver a portrait. | No se pierde texto/selección guardable. Encabezado, campo y acción de salida siguen alcanzables mediante scroll interno; paleta queda dentro del viewport y no aparece hueco persistente al volver. |
| VP-05 · iPhone Dynamic Island, ambas orientaciones | Validar insets laterales | 1. Abrir editor, ActionSheet y calendario en portrait.<br>2. Rotar a landscape en ambos sentidos.<br>3. Tocar los controles más cercanos a cada borde. | Ningún control queda bajo recorte o gesto del sistema; no hay offset fijo que sea correcto solo para un lado. |
| VP-06 · Safari Home Screen | Comparar modo standalone | 1. Añadir a Home Screen.<br>2. Lanzar desde icono, no desde Safari.<br>3. Repetir VP-01, KB-01 y AS-01.<br>4. Volver a Safari y comparar. | Sin toolbar, las superficies usan el espacio extra sin padding fantasma. Datos y comportamiento modal no dependen de que exista chrome del navegador. |
| VP-07 · Zoom/pinch en iPhone y Android | Separar zoom de “teclado” | 1. Con teclado cerrado ampliar con pinch.<br>2. Desplazar el visual viewport.<br>3. Abrir/cerrar editor y paleta sin escribir.<br>4. Restablecer zoom. | El zoom no dispara un layout destructivo de teclado: modal y paleta siguen accesibles, el fondo no queda atrapado y se puede restablecer zoom. |

## Teclado, foco, textarea y selección

| ID / entorno | Objetivo | Pasos | Resultado esperado |
|---|---|---|---|
| KB-01 · iPhone Safari, portrait, carga limpia | Validar entrada inicial sin asumir `autofocus` | 1. Abrir creador y editor manual desde un gesto.<br>2. No tocar de nuevo durante 2 s.<br>3. Registrar foco, OSK y CTA de reanudación.<br>4. Si no hay OSK, tocar la CTA/textarea. | O bien el teclado aparece con textarea activo, o existe una ruta táctil clara que lo abre. Nunca queda una pantalla aparentemente editable sin forma de escribir. |
| KB-02 · iPhone Safari, OSK abierto/cerrado | Validar transición y safe area | 1. Abrir OSK y escribir.<br>2. Cerrarlo con “Done” sin cambiar de pantalla.<br>3. Esperar a que termine la animación.<br>4. Reabrir y repetir tres veces. | El contenido se conserva; footer/padding terminan en posición correcta cada vez. No queda el hueco de safe area ni altura reducida persistente. |
| KB-03 · Android Chrome/Gboard | Validar OSK y botón Atrás | 1. Abrir editor y Gboard.<br>2. Pulsar/gesticular Atrás una vez.<br>3. Volver a tocar textarea.<br>4. Abrir ActionSheet y repetir Atrás. | Primer Atrás cierra la capa esperada según estado, no dos capas; scroll lock y foco quedan coherentes. Reanudar escritura no mueve permanentemente el shell. |
| KB-04 · Android WebView | Validar resize según proveedor | 1. Registrar paquete/versión WebView y configuración del host.<br>2. Abrir/cerrar IME en editor.<br>3. Repetir en landscape.<br>4. Si <M139, comparar con Chrome del mismo dispositivo. | En >=M139 el visual viewport inferior se actualiza y el contenido es alcanzable. En versiones anteriores, el fallback interno permite editar sin depender de esa medida; cualquier diferencia queda documentada. |
| FO-01 · Chrome Android y Samsung Internet | Detectar fallo de `preventScroll` | 1. Desplazar el contenedor del creador a una posición reconocible.<br>2. Abrir editor/enfocar cada textarea.<br>3. Abrir/cerrar ActionSheet.<br>4. Comparar scroll antes/después y visibilidad de caret. | Puede existir ajuste necesario para mostrar caret, pero no salto persistente del shell ni pérdida de posición al cerrar. La llamada sin excepción no se considera prueba de soporte. |
| FO-02 · iPhone/Android | Alternar pregunta y respuesta | 1. Escribir texto distinto en ambos lados.<br>2. Colocar caret a mitad de pregunta.<br>3. Cambiar a respuesta y volver.<br>4. Aplicar formato/preset y continuar escribiendo. | Se conserva cada valor; foco y rango vuelven al campo lógico sin insertar en posición incorrecta. Si OSK se cierra, la reanudación es explícita y no pierde selección posible. |
| IN-01 · iPhone pequeño y Android, textarea largo | Validar caret y doble scroll | 1. Pegar o escribir al menos 30 líneas.<br>2. Mover caret al inicio, mitad y final con manejadores.<br>3. Escribir en cada posición con OSK abierto.<br>4. Desplazar modal y textarea. | El caret activo puede hacerse visible. Solo desplaza el contenedor previsto; no hay scroll de fondo, bucle de auto-scroll ni footer inalcanzable. |
| IN-02 · iOS y Gboard, composición/acentos | Evitar corrupción IME | 1. Escribir palabras con acentos/autocorrección.<br>2. Introducir emoji y una secuencia compuesta.<br>3. Corregir una sugerencia.<br>4. Aplicar formato después de terminar composición. | Valor final coincide con lo introducido; no hay duplicados, caracteres cortados, caret desplazado ni formato aplicado durante preedición. |
| IN-03 · iPhone/Android, selección | Validar selección y toolbar | 1. Seleccionar una palabra con manejadores.<br>2. Aplicar negrita/cursiva o color preset.<br>3. Deshacer/editar texto alrededor.<br>4. Cambiar de lado y regresar. | Acción usa el rango capturado válido; no selecciona texto de otro campo ni lanza error si el valor cambió. Menú nativo y scroll siguen utilizables. |
| IN-04 · teclado físico en iPad/Android | Separar foco de OSK | 1. Conectar teclado físico.<br>2. Abrir editor y navegar con Tab si aplica.<br>3. Escribir y abrir ActionSheet.<br>4. Cerrar con Escape. | El layout no inventa una altura de OSK por tener foco. Orden de foco, trampa y Escape son operables; no aparece CTA falsa que impida escribir. |

## Color Picker y gestos

| ID / entorno | Objetivo | Pasos | Resultado esperado |
|---|---|---|---|
| CP-01 · iPhone Safari y Chrome Android, OSK abierto | Aplicar preset sin perder contexto | 1. Colocar caret/selección en textarea y abrir OSK.<br>2. Abrir estilos y tocar tres presets.<br>3. Continuar escribiendo sin tocar otro campo cuando el UA lo permita.<br>4. Cerrar estilos. | Cada color se aplica una vez; selección/contexto del editor se conserva. Preservar foco no se confunde con una garantía de OSK, pero existe reanudación sin pérdida. |
| CP-02 · iPhone Safari, color custom | Validar fallback sin `showPicker()` | 1. Con texto escrito abrir color custom desde un gesto.<br>2. Elegir un color; repetir cancelando.<br>3. Volver al editor y escribir.<br>4. Reabrir para comprobar valor. | El picker nativo se abre mediante fallback o los presets quedan disponibles. Elegir aplica el color; cancelar no lo cambia ni cierra el editor. Se puede retomar escritura aunque OSK se haya cerrado. |
| CP-03 · Chrome Android/Samsung, color custom | Validar activación transitoria y retorno | 1. Abrir custom directamente con tap.<br>2. Elegir, cerrar y repetir tras scroll.<br>3. Pulsar Atrás en el picker si el UA lo permite.<br>4. Volver al textarea. | No hay `NotAllowedError` visible ni doble apertura. `input/change` aplica una vez; cancelación no altera datos; sheet/body lock se mantienen. |
| CP-04 · móvil, paleta horizontal | Validar `pan-x` y cancelación | 1. Arrastrar horizontalmente sobre swatches.<br>2. Hacer gesto diagonal.<br>3. Iniciar scroll vertical fuera y dentro del strip.<br>4. Tocar un swatch tras cada gesto. | Pan horizontal fluido; el scroll vertical del sheet sigue posible; un drag cancelado no selecciona color accidental ni deja estado pressed. |
| TG-01 · iPhone/Android, bordes | Convivir con gestos del sistema | 1. Abrir modal y sheet.<br>2. Iniciar gestos desde bordes y home indicator.<br>3. Volver/cancelar navegación.<br>4. Comprobar contenido y locks. | El sistema puede ganar el gesto, pero no se guardan acciones parciales, no se cierra doble capa y el documento no queda bloqueado al regresar. |

## ActionSheet, overlays, calendario y footer

| ID / entorno | Objetivo | Pasos | Resultado esperado |
|---|---|---|---|
| AS-01 · iPhone Safari, OSK abierto | Validar sheet normal y scroll interno | 1. Enfocar un input largo.<br>2. Abrir un ActionSheet normal.<br>3. Recorrer contenido hasta última acción.<br>4. Intentar arrastrar backdrop/fondo y cerrar. | Todas las acciones son alcanzables; solo se desplaza el interior del sheet; fondo no acciona ni se desplaza. Cierre restaura un foco lógico sin salto persistente. |
| AS-02 · editor, ActionSheet de estilos | Validar `preserveFocus` | 1. Enfocar textarea y colocar caret.<br>2. Abrir estilos.<br>3. Navegar controles por touch y teclado físico.<br>4. Cerrar y escribir. | Herramienta opera sin activar contenido ajeno. Foco/selección del editor son recuperables; Tab no escapa a controles invisibles y la semántica anunciada no contradice la interacción. |
| AS-03 · calendario, sheets consecutivos | Validar stack y lock por propietarios | 1. Abrir `ScheduleCalendar`.<br>2. Abrir una hoja y desde ella otra superficie disponible.<br>3. Cerrar solo la superior con Escape/Atrás/backdrop.<br>4. Cerrar las restantes. | Se cierra una capa por acción; la inferior permanece modal y con scroll lock. Al final se restauran body, footer y foco exactamente una vez. |
| AS-04 · texto al 200%, landscape | Mantener acción final alcanzable | 1. Aumentar texto/zoom al 200%.<br>2. Rotar a landscape.<br>3. Abrir cada tipo de ActionSheet.<br>4. Llegar a título, opciones y cierre. | Nada queda recortado sin scroll; título/nombre accesible y cierre existen; acciones no se solapan con safe area u OSK. |
| SC-01 · iOS Safari, modal con OSK y zoom | Reproducir WK-240860 | 1. Desplazar página antes de abrir editor.<br>2. Abrir modal y OSK.<br>3. Arrastrar repetidamente fondo y bordes.<br>4. Hacer pinch zoom y repetir; cerrar modal. | El fondo no revela contenido fuera de su posición ni ejecuta controles. El scroll interno funciona. Al cerrar se recuperan zoom/scroll sin lock huérfano. |
| FT-01 · calendario, footer móvil | Verificar pie fijo y safe area | 1. Abrir calendario en portrait y recorrer hasta el final.<br>2. Abrir/cerrar sheets.<br>3. Rotar y volver.<br>4. Enfocar cualquier input disponible y cerrar OSK. | Footer no tapa días/acciones, queda dentro del inset y se oculta/muestra según capa sin flash sobre el teclado. El padding de contenido coincide con su altura una sola vez. |
| MD-01 · editor, picker de imagen | Validar transición a UI del sistema | 1. Escribir y seleccionar texto.<br>2. Abrir picker de imagen.<br>3. Cancelar; repetir eligiendo archivo válido.<br>4. Volver y continuar editando. | Cancelar no altera tarjeta. Elegir conserva texto y monta la imagen según flujo actual. Modal, focus fallback, scroll y lock siguen operables. |

## Accesibilidad y salida

| ID / entorno | Objetivo | Pasos | Resultado esperado |
|---|---|---|---|
| AX-01 · VoiceOver iOS / TalkBack Android | Validar modalidad y nombres | 1. Activar lector.<br>2. Abrir editor y cada ActionSheet.<br>3. Recorrer hacia delante/atrás.<br>4. Cerrar y localizar activador. | Se anuncia nombre/rol; la navegación no entra en fondo modal; Color Picker tiene nombre/estado; al cerrar se vuelve a un destino lógico. |
| AX-02 · teclado físico | Validar trampa y Escape | 1. Abrir sheet normal.<br>2. Pulsar Tab/Shift+Tab varias vueltas.<br>3. Pulsar Escape.<br>4. Repetir en sheet con `preserveFocus`. | Sheet normal contiene foco y lo restaura. La excepción preserveFocus cumple su contrato documentado sin focos invisibles. Escape cierra una capa. |
| AX-03 · zoom/texto 200% | Preservar ampliación | 1. Ampliar texto o página al 200%.<br>2. Ejecutar editor, paleta, calendario y sheet.<br>3. Abrir OSK.<br>4. Cerrar todo. | Sin controles truncados ni solapados; scroll permite acceder a todo; no se desactiva pinch zoom ni se pierde contenido. |

## Criterio de cierre

Una entrega móvil no está validada si falta un P0, si un `FAIL` no tiene issue o si solo se probó emulación. Los bugs conocidos pueden producir una diferencia transitoria, pero el resultado esperado final sigue siendo obligatorio. Toda nueva mitigación debe añadir un caso que falle sin ella y pasar con ella; su issue y condición de retirada deben quedar en `known-browser-bugs.md`.
