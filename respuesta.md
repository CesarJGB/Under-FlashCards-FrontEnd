Auditoría: CardFace.jsx, batchBuilder.js, App.jsx

Contexto breve
- Reglas clave respetadas: React 18 + Vite, safeLocalStorage obligatorio, mobile-first, no autoFocus, evitar inline styles salvo valores dinámicos.

1) frontend/src/components/CardFace.jsx

🔴 [Seguridad XSS]
📍 Archivo y línea/contexto: frontend/src/components/CardFace.jsx — uso de imágenes y background sin validación (img src en líneas ~52–56; getCardBackgroundStyle → backgroundImage en líneas ~81–88).
🐛 Problema: card.contentImage y card.bgImage se usan directamente en atributos y styles sin validar. Un valor malicioso (ej. `javascript:` o data: URI no segura) puede provocar ejecución/recarga de recursos inseguros.
⚠️ Impacto: ejecución de código malicioso, carga de recursos no deseados, robo de telemetría o phishing visual (alto riesgo en producción).
✅ Fix concreto (código o patrón sugerido):
- Añadir validador central en `lib/utils.js` (isSafeImageUrl) que permita solo `http:`, `https:` y `data:image/*` si se quiere permitir inline images; rechazar `javascript:` y otros esquemas.
- Usar el validador antes de renderizar:
```js
const safeImg = isSafeImageUrl(card.contentImage) ? card.contentImage : null;
{safeImg && <img src={safeImg} .../>}
```
- En getCardBackgroundStyle, solo incluir `backgroundImage` si la URL es segura.
🔗 Regla del proyecto violada: Seguridad básica (renderizar contenido de tarjetas sin sanitizar).

🟡 [Estilo / mantenimiento]
📍 Archivo y línea/contexto: inline styles en <p> y background style (líneas ~40–44 y ~85–88).
🐛 Problema: uso de `style` dinámico con valores no validados (fontSize, color, backgroundImage). Aunque los inline styles están permitidos para valores dinámicos, deben validarse.
⚠️ Impacto: inyección CSS, rompimiento de layout, riesgo menor que XSS.
✅ Fix concreto: validar `size` y `color` (regexp para hex/rgb) y normalizar `backgroundImage`.
🔗 Regla del proyecto violada: Mobile-first / evitar inline styles excepto valores dinámicos — cumplimiento parcial.

🟢 [Sanidad / Texto]
📍 Archivo y línea/contexto: render de texto (líneas ~39–47)
🐛 Problema: ninguno (no se usa dangerouslySetInnerHTML).
⚠️ Impacto: bajo. React escapa el texto por defecto.
✅ Fix concreto: mantener esta práctica.


2) frontend/src/lib/batchBuilder.js

🟡 [Robustez / Edge-cases]
📍 Archivo y línea/contexto: buildContinuousBatch (líneas ~38–75), buildNormalBatch (líneas ~81–89).
🐛 Problema:
- Falta de guardas para `allCards` null/undefined → posibles exceptions.
- buildNormalBatch re-adiciona `excludeCardId` al final si existe; semántica ambigua (excluir vs evitar repetición inmediata).
⚠️ Impacto: crashes en casos de datos corruptos o comportamiento inesperado (medio).
✅ Fix concreto:
- Añadir defensas al inicio: `allCards = Array.isArray(allCards) ? allCards : []` y retornar `[]` si vacío.
- Cambiar buildNormalBatch para no re-agregar excluded por defecto; si se desea evitar lote vacío, devolver solo excluded como fallback con comentario claro.
🔗 Regla del proyecto violada: Robustez frente a edge-cases.

🟡 [Performance]
📍 Archivo y línea/contexto: shuffleByWeight y selección por peso (líneas ~17–22, ~47–51).
🐛 Problema: ordenamiento completo O(n log n) para priorización; para decks grandes (1000+) puede ser costoso en CPU/memoria en móviles.
⚠️ Impacto: peor experiencia en dispositivos low-end, posibles stutters (medio).
✅ Fix concreto: usar selección parcial ponderada (reservoir sampling ponderado) o selección por muestreo cuando `allCards.length >> BATCH_SIZE`.

🟢 [Calidad]
📍 Archivo y línea/contexto: applyLocalAnswer (líneas ~97–112)
🐛 Problema: ninguno — implementado correctamente (inmutabilidad, límites).
⚠️ Impacto: positivo.


3) frontend/src/App.jsx

🔴 [Performance / Lazy-load misuse]
📍 Archivo y línea/contexto: DebugPanel lazy-load e inclusión (líneas ~271–274 y cambios recientes).
🐛 Problema: DebugPanel importado con React.lazy pero renderizado incondicionalmente dentro Suspense. Aunque lazy, React intentará cargar módulo cuando el component tree renders it; por ello, la intención de cargar solo con ?debug=true se rompe.
⚠️ Impacto: módulo de debug descargado en usuarios normales, aumento de bundle y latencia (alto en producción móvil).
✅ Fix concreto:
- Evaluar isDebugMode en App.jsx antes de renderizar el Suspense/DebugPanel:
```js
const isDebugMode = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('debug') === 'true' || import.meta.env.DEV);
{isDebugMode && (
  <Suspense fallback={null}><DebugPanel .../></Suspense>
)}
```
🔗 Regla del proyecto violada: Lazy load obligatorio / minimizar impacto en producción.

🟡 [Race conditions / cleanup]
📍 Archivo y línea/contexto: loadDecks/loadMaterias in DashboardScreen (líneas ~37–65; useEffect ~67–69).
🐛 Problema: uso directo de `fetch` en callbacks sin AbortController ni cleanup en el useEffect que llama ambos. Si el componente se desmonta (navegación rápida) las resoluciones de fetch pueden provocar setState en componente desmontado.
⚠️ Impacto: Warnings React (setState on unmounted), fetches innecesarios, y potencial race conditions. 
✅ Fix concreto: añadir AbortController en useEffect y pasar `signal` a fetch, o refactorizar loadDecks/loadMaterias para aceptar un signal.
🔗 Regla del proyecto violada: falta patrón de mitigación (AbortController) presente en HomeSection.

🟢 [safeLocalStorage uso correcto]
📍 Archivo y línea/contexto: App.jsx inicializadores (líneas ~24–31)
🐛 Problema: ninguno — getJSON/setJSON usados correctamente para inicialización de estado y persistencia.
⚠️ Impacto: Reduce riesgo de crash por JSON corrupto en render (positivo).
✅ Fix concreto: Mantener el patrón; asegurarse que todos los nuevos accesos a localStorage (incluyendo hooks de debug) usen safeLocalStorage (nota: useDebugLogs actualmente usa localStorage directo en algunas partes; considerar migrar esas operaciones a safeLocalStorage).
🔗 Regla del proyecto violada: Ninguna en App.jsx; cumplimiento con safeLocalStorage correcto.

💡 Observability / integración del flush global
📍 Archivo y línea/contexto: integración de usePendingReviewsFlush en FlashcardsApp (línea ~289).
🐛 Problema: el hook hace flush y loggea en consola; no está conectado con DebugPanel pushLog (opcional).
⚠️ Impacto: logs de flush no aparecen en DebugPanel a menos que integremos pushLog.
✅ Fix concreto: pasar `pushLog` desde un debug context o exponer evento global (window.dispatchEvent) para capturar logs en DebugPanel.
🔗 Regla del proyecto violada: No aplica (es mejora).


Resumen de patrones inconsistentes encontrados
- Falta sanitización de recursos externos (images/background) — riesgo alto.
- DebugPanel lazy-import se carga indebidamente — impacto en performance.
- Fetches en App.jsx sin AbortController — riesgo de setState post-unmount.
- batchBuilder necesita guardas y posible optimización para mazos grandes.
- Debug utilities usan localStorage directo y parchean window.fetch (aceptable para debug, pero viola la regla de uso centralizado de localStorage).

Prioridad de fixes (Top 3)
1. Sanitize images/background in CardFace.jsx (XSS) — urgente.
2. Conditional lazy-load DebugPanel (only load when isDebugMode) — alta prioridad para production performance.
3. Add AbortController to app-level fetches (loadDecks/loadMaterias) — para evitar warnings y races.

Advertencias de arquitectura que requieren contexto adicional
- Contrato de `excludeCardId` en batchBuilder: necesito confirmar la intención (excluir permanentemente vs evitar repetición inmediata) antes de cambiar comportamiento.
- Backend contract for reviews/session reconciliation: flush can send reviews without sessionId; verify backend accepts it or implement server-side reconciliation.
- Debug tooling patches global window.fetch — ensure not included in production accidentally.

Veredicto final: ¿listo para producción con estos 3 archivos?
- No. Antes de producción corregir al menos los puntos críticos: sanitización de imágenes en CardFace.jsx, condicional lazy-loading del DebugPanel, y añadir AbortControllers/cancelación en fetches críticos.

Si quieres, implemento los fixes prioritarios ahora (1) sanitizar image/bg en CardFace.jsx y (2) hacer la carga condicional del DebugPanel. ¿Cuál prefieres que aplique primero?
