# Trazabilidad de la arquitectura V2 del editor manual

**Base auditada en Fase 2:** `bc541f930f7fc6e3eb055adb0cb4a232d5099b5c`.  
**Código revalidado para este diseño:** `ba3027f0d34fa9297f4224235eef263f3d387671`.  
**Resultado de drift:** ningún archivo de producción revalidado cambió; véase [`manual-editor-v2-drift-report.md`](manual-editor-v2-drift-report.md).

**Corte 5:** código revalidado sobre `origin/main` `9a775679b882469ab7c998b5d4233a6087af56cf`. La implementación/migración estática de V2 queda terminada; la certificación física y de UA/IME permanece pendiente.
**G5:** **`BLOCKED — DEVICE REQUIRED`**. No se asigna `PASS` a Safari iOS, Android, WebView, OSK, picker nativo, cutouts ni Back físico sin resultados físicos reales.

Esta matriz es normativa para la implementación. “Cubierto” significa que existe una decisión, un corte y una prueba diseñada; **no** significa que el código exista ni que la prueba haya pasado. Los estados de ejecución están en [`manual-editor-v2-test-plan.md`](manual-editor-v2-test-plan.md).

## 1. Leyenda

| Sigla | Módulo provisional |
|---|---|
| GEO | `editorGeometry` + `useEditorGeometry` |
| SES | `manualEditorSessionReducer` + `useManualEditorSession` |
| LAY | `editorLayerReducer` + `useEditorLayerStack`/`OverlayScope` |
| SCR | `scrollLock` evolucionado con leases por nodo e inertness |
| CSS | contrato CSS de superficie/safe area del editor; no módulo JS |
| INT | integración del propietario: `FlashcardCreator`, `ManualCardEditorModal` o `DeckInterior` |

Los riesgos se expresan como `A` (alto), `M` (medio) o `B` (bajo). Un ID puede tener un epic primario y dependencias en otro; la tabla evita duplicarlo como refactor independiente.

## 2. Hallazgos P0

| ID | Epic | Decisión arquitectónica | Responsable | Corte | Prueba de cobertura | Código antiguo que se retirará | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| `EDITOR-KB-001` | A | Publicar rectángulos/fase/oclusión observable; nunca `keyboardOpen` factual ni umbral causal. | GEO + consumidores | 2, retiro 5 | `UT-GEO-005`, `PW-GEO-001`, `DEV-IOS-001`, `DEV-AND-001` | booleano `keyboardOpen`, umbral `100`, atributo/historia derivados | A | Cubierto |
| `EDITOR-VV-001` | A | Invalidar el epoch al cambiar orientación/clase geométrica y estabilizar con dos muestras rAF iguales. | GEO | 2, retiro 5 | `UT-GEO-003`, `PW-GEO-002`, `DEV-IOS-003` | máximo histórico usado como baseline | A | Cubierto |
| `EDITOR-SAFE-001` | A | Un propietario CSS por borde; safe area no depende de una supuesta apertura de OSK. | CSS + GEO | 2 | `UT-GEO-005`, `PW-VIS-001`, `DEV-IOS-001`, `DEV-CUTOUT-001` | rama que pone/elimina inset por `keyboardOpen` | A | Cubierto |
| `EDITOR-COLOR-001` | B | Activar color personalizado por `click` semántico; `showPicker()` solo por feature detection y `input.click()` como fallback en el mismo gesto. | SES + `StylePanel` | 1 | `UT-PICK-004`, `PW-PICK-001`, `DEV-IOS-002`, `DEV-AND-001` | apertura desde `pointerdown` y ruta solo táctil | A | Cubierto |
| `EDITOR-COLOR-002` | B | Tratar el picker nativo como transacción externa; preservar datos/rango y ofrecer reanudación explícita, sin promesa de OSK. | SES | 1 | `UT-PICK-002`, `PW-PICK-001`, `DEV-IOS-002` | reintentos que equiparan foco con teclado conservado | A | Cubierto |
| `EDITOR-COLOR-004` | B | Separar `PRESET_APPLIED`/menús DOM de `PICKER_REQUESTED`; un preset solo aplica y cierra su capa. | SES + LAY | 1 y 3 | `UT-SES-004`, `UT-LAY-001`, `PW-MENU-001` | `guardKeyboardResumeAfterMenu`, su historia y timer `450 ms` | A | Cubierto |
| `EDITOR-FOCUS-003` | C; habilita B | Modalidad real: shell inert, foco contenido, owner válido y retorno seguro; el picker externo no se modela como foco interno. | LAY + SCR | 3 | `UT-LAY-005`, `UT-LAY-006`, `PW-A11Y-001`, `DEV-IPAD-002`, `DEV-AX-AND-001` | listener/foco modal incompleto e inertness ausente | A | Cubierto |
| `EDITOR-COLOR-005` | C | Mantener la paleta portaleada dentro de la raíz propietaria; preset/alineación son popovers no modales, no `dialog` independiente. | LAY + `StylePanel` | 3; compatibilidad 4 | `UT-LAY-002`, `PW-A11Y-001`, `DEV-IPAD-002` | portal directo a `body` y `aria-modal` contradictorio de la paleta | A | Cubierto |
| `EDITOR-OVERLAY-002` | C | Registro ordenado de capas; toggle atómico; Escape/Back/backdrop despachan una sola vez a la capa superior. | LAY | 3; ActionSheet 4 | `UT-LAY-001`–`004`, `PW-ESC-001`, `PW-BACK-001` | listeners y z-index de cierre dispersos | A | Cubierto |
| `EDITOR-AS-001` | C | Migrar `ActionSheet` a registro/scope común y retirar `preserveFocus`; no declarar modalidad con foco fuera. | LAY + `ActionSheet` | 4 | `UT-AS-001`, `UT-AS-002`, `PW-AS-001`–`004`, `DEV-AS-001` | trampa/restauración privada, portal `body`, `preserveFocus` | A | Cubierto; corte compartido aislado |
| `EDITOR-SCROLL-001` | C | Lease por propietario bloquea/inertiza el scroll owner real del App shell; conserva scrollers permitidos. | SCR | 3; ActionSheet 4 | `UT-SCR-001`–`003`, `PW-SCROLL-001`, `DEV-IOS-004` | lock inline de `body` del modal | A | Cubierto |
| `EDITOR-STATE-001` | D | Reducers explícitos para sesión/capas/geometría; refs solo para nodos/IDs y ningún timer como transición de certeza. | SES + GEO + LAY | 1–3, retiro 5 | `UT-SES-001`–`006`, `UT-PICK-001`–`003`, `UT-LIFE-001`–`002` | refs que mantienen historia paralela, detectores duplicados, timers `80/250/450 ms` | A | Cubierto |

### Comprobación P0

- 12 de 12 IDs P0 de Fase 2 aparecen arriba.
- Se agrupan en cuatro epics, no en doce subsistemas: A (3), B (3), C (5) y D (1).
- `EDITOR-FOCUS-003` se resuelve primariamente en C y constituye una precondición de accesibilidad para los flujos de B; no se duplica su autoridad.
- Ningún P0 queda diferido ni fuera de alcance. La validación física permanece `PENDING — DEVICE REQUIRED` y condiciona el release, no el diseño.

## 3. Hallazgos P1

| ID | Epic | Decisión arquitectónica | Responsable | Corte | Prueba de cobertura | Código antiguo que se retirará | Riesgo | Estado |
|---|---|---|---|---|---|---|---|---|
| `EDITOR-KB-002` | D | Una sola secuencia de snapshot + reducer; CTA derivado de intención/retorno, no de detectores. | GEO + SES | 1–2, retiro 5 | `UT-SES-005`, `UT-GEO-002`, `UT-LIFE-001` | segundo detector a `450 ms`, `keyboardWasOpenRef`, historia paralela | A | Cubierto |
| `EDITOR-KB-003` | B | Superficie contextual dentro del textarea y bloque desplazado abajo por decisión de producto; tap explícito reanuda sin inferir teclado físico. | SES + UI modal | 1 + corrección posterior a Corte 5 | `UT-SES-005`, contratos estáticos, `PW-OPEN-001`, `DEV-IOS-005`, `DEV-AND-HW-001` | CTA separado que no reproducía la UX validada | A | Cubierto |
| `EDITOR-VV-002` | A | Snapshot completo usa `width`, `height`, ambos offsets y `scale`. | GEO | 2 | `UT-GEO-005`, `PW-GEO-001`, `DEV-CUTOUT-001` | estado parcial `height/top` | M | Cubierto |
| `EDITOR-VV-003` | A | Coalescer rAF y comparación semántica evitan publicar muestras iguales. | GEO | 2 | `UT-GEO-002`, `PW-LIFE-001` | `setState` por cada evento VV | M | Cubierto |
| `EDITOR-VV-004` | A | Sin VV se usa layout viewport + scroll interno, con oclusión `unknown`; nunca se bloquea la edición. | GEO + CSS | 2 | `UT-GEO-001`, `DEV-WV-002` | degradación implícita/altura supuesta | A | Cubierto |
| `EDITOR-SAFE-002` | A | La superficie posee también insets izquierdo/derecho y compone footer/controles una vez. | CSS | 2 | `PW-VIS-001`, `DEV-IOS-003`, `DEV-CUTOUT-001` | padding lateral incompleto/disperso | A | Cubierto |
| `EDITOR-FOCUS-001` | B/D | `OPEN` emite una sola intención de foco; observación posterior no desencadena bucles. | SES | 1 | `UT-SES-001`, `PW-OPEN-001` | `autoFocus` + layout effect + rAF competitivos | M | Cubierto |
| `EDITOR-FOCUS-002` | B | Guardar `{start,end,direction,valueLength,valueRevision}` por `question` y `answer`; validar antes de restaurar. | SES | 1 | `UT-SES-002`, `UT-SES-003`, `PW-SIDE-001` | única `selectionRef` compartida | A | Cubierto |
| `EDITOR-FOCUS-004` | B/D | Restaurar selección por intención y gesto; `preventScroll` es mejora, no garantía ni señal de OSK. | SES | 1 | `UT-SES-003`, `PW-SIDE-001`, `DEV-AND-002` | restauración rAF usada como promesa de OSK | M | Cubierto |
| `EDITOR-FOCUS-005` | B/D | Un fallo de `setSelectionRange` invalida rango y termina; no reintenta foco automáticamente. | SES | 1 | `UT-SES-003`, `UT-LIFE-002` | catch que vuelve a enfocar sin contrato | M | Cubierto |
| `EDITOR-COLOR-003` | B/D | Resolver por `input/change`, `cancel` si existe o retorno `unknown`; no esperar `blur` ni tiempo fijo. | SES + `StylePanel` | 1 | `UT-PICK-001`, `UT-PICK-002`, `PW-PICK-001` | secuencia `change → blur → 80 ms` | A | Cubierto |
| `EDITOR-COLOR-006` | A/C | El posicionador común publica rect final que la paleta aplica realmente, incluyendo width/clamp. | GEO + LAY | 2–3 | `PW-MENU-001`, `PW-VIS-001` | ancho calculado pero no aplicado | M | Cubierto |
| `EDITOR-OVERLAY-001` | A/C | Color y alineación comparten anclaje/portal/scope, manteniendo semántica no modal. | GEO + LAY | 3 | `UT-LAY-001`, `PW-MENU-001`, `PW-GEO-002` | dos modelos de posicionamiento incompatibles | M | Cubierto |
| `EDITOR-AS-002` | A/C | ActionSheet usa espacio disponible de la superficie/scope y scroll interno; `dvh` no representa OSK. | GEO + LAY + `ActionSheet` | 4 | `PW-AS-003`, `DEV-AS-001` | `max-height: 90dvh` como única restricción | A | Cubierto |
| `EDITOR-SCROLL-002` | C | Efectos de plataforma viven en un lease central reversible; no se añade touchmove global. | SCR | 3–4 | `UT-SCR-002`, `PW-SCROLL-001`, `DEV-IOS-004` | escrituras aisladas `body overflow:hidden` | A | Cubierto |
| `EDITOR-SCROLL-003` | C/D | El propietario suspende/cancela el smooth scroll antes de abrir modal; modal no corrige con `window.scrollTo`. | INT + SCR | 3 | `PW-SCROLL-001`, `DEV-IOS-004` | carrera `DeckInterior` smooth scroll + autoapertura | M | Cubierto |
| `EDITOR-PICKER-001` | B/D | File picker comparte submáquina de transacción: `change`, `cancel` si existe y retorno desconocido idempotente. | SES + `FlashcardCreator` | 1 | `UT-PICK-003`, `PW-PICK-002`, `DEV-PICK-IMG-001` | certeza por `window.focus + 250 ms` | A | Cubierto |
| `EDITOR-HOOK-001` | A/D | Prohibición arquitectónica y test de dependencias: el editor no importa `useKeyboardHeight`; su refactor global no se mezcla con V2. | regla + `UT-ARCH-001` | 0 y 5 | `UT-ARCH-001` | ninguno dentro del editor; hook global permanece | B | Diferido justificadamente: limpieza global fuera de alcance |

### Hallazgos P2/P3

No forman parte de la tabla obligatoria P0/P1, pero tampoco se pierden:

- `EDITOR-COLOR-007` y `EDITOR-PERF-001`: el coalescer/posicionador puede reducirlos; su optimización final requiere perfil y queda para estabilización.
- `EDITOR-NAV-001`: el contrato de Back queda diseñado en el Epic C y se prueba desde Corte 3 aunque la auditoría lo clasificó P2.
- `EDITOR-DEAD-001`: se confirmó que `onFooterHeightChange` no tenía callers y se retiró en Corte 5 junto con `footerRef`, `ResizeObserver` y su fallback de `resize`.

## 4. Conservación de `KEEP-001` a `KEEP-013`

| ID | Decisión que permanece | Cómo se conserva en V2 | Corte/prueba de protección |
|---|---|---|---|
| `KEEP-001` | `textarea` nativo y selección explícita | Se mantienen ambos textareas y `selectionStart/End/Direction`; SES solo añade ownership por lado/versión. | 1; `UT-SES-002/003`, `PW-SIDE-001` |
| `KEEP-002` | Feature detection y fallback del picker | `showPicker` se detecta en activación; `click()` estándar es fallback inmediato. | 1; `UT-PICK-004`, `PW-PICK-001` |
| `KEEP-003` | Color input no controlado mientras está abierto | La transacción no re-renderiza ni sustituye el nodo durante UI nativa; commit actualiza después. | 1; `UT-PICK-001`, `DEV-IOS-002` |
| `KEEP-004` | Portales cuando deben escapar clipping | Se conserva el portal, pero a `OverlayScope` propietario en vez de `body` sin relación. | 3–4; `UT-LAY-002`, `PW-A11Y-001` |
| `KEEP-005` | VisualViewport y sus eventos como geometría | GEO conserva resize/scroll y añade todos los campos, rAF y fallback; nunca lo convierte en detector absoluto. | 2; `UT-GEO-001/005` |
| `KEEP-006` | Footer dentro de superficie medida | Sigue en el layout/scroll del editor y participa en el cálculo CSS; no se fija contra altura ficticia. | 2; `PW-VIS-001`, `DEV-IOS-001` |
| `KEEP-007` | Scroll interno y overscroll acotado | El contenido, textarea, ActionSheet y paleta horizontal continúan como scrollers permitidos. | 3–4; `PW-SCROLL-001`, `DEV-AS-001` |
| `KEEP-008` | Lock de scroll con propietarios | Se evoluciona el `Set`/API compatible a leases por nodo; el último owner restaura. | 3; `UT-SCR-001/003` |
| `KEEP-009` | Reanudación mediante gesto explícito | La superficie contextual de la textarea dispara una única intención de foco, muestra el estado específico tras imagen y no promete detectar OSK. | 1 + corrección posterior a Corte 5; `UT-SES-005`, `UT-PICK-003`, `PW-OPEN-001` |
| `KEEP-010` | Presets DOM preservan foco | El preset aplica en DOM, conserva rango cuando válido y no inicia una transacción nativa. | 1; `UT-SES-004`, `PW-MENU-001` |
| `KEEP-011` | Sin hacks destructivos | No hay zoom desactivado, blur forzado, scroll global forzado, UA sniffing ni touchmove global. | 0/5; `UT-ARCH-001`, revisión estática |
| `KEEP-012` | `viewport-fit=cover` y 16 px táctiles | `index.html`/`index.css` no cambian salvo necesidad demostrada; los nuevos controles heredan tamaño accesible. | 2; `PW-VIS-001`, `DEV-CUTOUT-001` |
| `KEEP-013` | Preview/estilo de fondo suspendidos | `FlashcardCreator` mantiene exclusión mutua al abrir manual; LAY añade inertness al resto del shell. | 3; `PW-LIFE-001`, prueba de montaje existente |

Ninguna fila `KEEP` autoriza conservar su implementación incidental si contradice el nuevo ownership. Se conserva el principio observable: por ejemplo, el portal permanece (`KEEP-004`), pero deja de estar huérfano respecto de la raíz modal.

## 5. Gates de trazabilidad

Un corte no puede integrarse si:

1. introduce un P0 sin módulo responsable o sin prueba;
2. elimina una conducta `KEEP` antes de que su prueba de protección pase;
3. marca como resuelto un riesgo físico con emulación;
4. añade una segunda fuente de verdad durante la coexistencia sin adaptador y fecha/condición de retirada;
5. amplía un módulo compartido antes de pasar el gate del editor aislado.

Al finalizar Corte 5, la búsqueda estática confirmó ausencia en el editor de `keyboardOpen`, umbral `100`, baseline máximo, `guardKeyboardResumeAfterMenu`, timers `80/250/450` usados como certeza, lock inline y `useKeyboardHeight`; el hook compartido permanece con sus consumidores externos. Las ocurrencias documentales y los tiempos puramente visuales no cuentan como fallo si están clasificados explícitamente.

## 6. Cierre del Corte 5

- **Código/migración:** terminado para el alcance V2; no queda el adaptador del reducer y `common/overlays/layerStack.js` es la única implementación real.
- **Contratos conservados:** `useKeyboardHeight.js` externo, API heredada de `scrollLock.js`, `useModalAccessibility`, textarea y selección, `showPicker`/fallback `click`, input color no controlado, portales, scroll interno, safe areas, `-webkit-fill-available`, leases, tokens, inert, sentinel y registro global.
- **Certificación:** no terminada. `G5` es **`BLOCKED — DEVICE REQUIRED`** hasta ejecutar evidencia en hardware/UA/IME real; ningún resultado físico se infiere de build, node:test, inspección estática o emulación.
