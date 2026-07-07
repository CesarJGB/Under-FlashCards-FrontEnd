
🔴 [Race Condition / Sesión huérfana]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — función `startSession` (líneas ~100–115) y cleanup del useEffect de montaje (líneas ~184–191).
🐛 Problema:
- `startSession()` hace un fetch asíncrono para crear la sesión pero no usa AbortController ni comprueba si el componente fue desmontado antes de escribir `sessionIdRef.current`. El cleanup llama `closeSession(false)` que retorna inmediatamente si `sessionIdRef.current` aún es falsy. Si el POST de creación de sesión resuelve después del unmount, la sesión queda abierta en el servidor (no se cierra).
⚠️ Impacto:
- Sesiones "huérfanas" en backend, pérdida de telemetría asociada, consumo innecesario de recursos, datos de métricas inconsistentes.
✅ Fix concreto (código o patrón sugerido):
- Usar AbortController o un flag `isMounted` / `sessionStartPromiseRef` para coordinar. Mínimo seguro (añadir un controller y verificar antes de setear el id):

```js
const sessionStartController = useRef(null);
const sessionStartPromiseRef = useRef(null);

const startSession = async () => {
  sessionStartController.current = new AbortController();
  sessionStartPromiseRef.current = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deckId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        signal: sessionStartController.current.signal
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Sólo actualizar si no se abortó
      if (!sessionStartController.current.signal.aborted) {
        sessionIdRef.current = data.session?.id ?? null;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      sessionIdRef.current = null;
    }
  })();
};

useEffect(() => {
  startSession();
  loadDeck();

  return () => {
    if (sessionStartController.current) sessionStartController.current.abort();
    // intentar cierre garantizado (ver siguiente hallazgo)
    closeSession(true);
  };
}, [deckId, userId, mode]);
```

🔗 Regla del proyecto violada (si aplica):
- Patrón ya aplicado en HomeSection: falta el patrón `AbortController` + cleanup / requestSeq que mitiga estas carreras.

---

🔴 [Pérdida de telemetría en navegación / flush inseguro]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — `handleAnswer` envía reseñas de forma optimista (líneas ~212–222); `closeSession` y cleanup del useEffect (líneas ~117–126 y ~184–191).
🐛 Problema:
- Las telemetrías (POST por cada respuesta) se envían por `fetch` en caliente sin persistir. En el cleanup se llama `closeSession(false)` (no se espera la cola `/queue-status`) por lo que eventos en tránsito o en cola pueden perderse si el usuario cierra/recarga la app sin usar la ruta de "Salida" que espera la cola.
⚠️ Impacto:
- Pérdida de reviews, métricas de precisión y tiempos erróneos; datos de SR (repetición espaciada) inconsistentes que dañan la calidad del algoritmo de priorización.
✅ Fix concreto (código o patrón sugerido):
- 1) Usar navigator.sendBeacon como preferencia en unload para telemetría crítica y, 2) mantener una cola local persistente (safeLocalStorage) como fallback y flusharla antes de cerrar la sesión:

Ejemplo mínimo para `handleAnswer`:

```js
import { getJSON, setJSON } from '../lib/safeLocalStorage';

const sendReview = (payload) => {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(`${BACKEND_URL}/api/decks/${deckId}/reviews`, blob);
    return;
  }
  // fallback: push a la cola local y disparar un fetch async
  const pending = getJSON(`pending_reviews_${userId}`) || [];
  pending.push(payload);
  setJSON(`pending_reviews_${userId}`, pending);
  fetch(`${BACKEND_URL}/api/decks/${deckId}/reviews`, { method:'POST', headers:{'Content-Type':'application/json'}, body })
    .catch(() => {/* queda en cola para retry */});
};
```

- 2) En `closeSession(true)` (o antes de cerrar) leer la cola local y reintentar enviar (con retries) hasta vaciarla, o al menos esperar `/api/users/:id/queue-status` antes de dar por cerrado en el servidor:

```js
const flushPending = async () => {
  const pending = getJSON(`pending_reviews_${userId}`) || [];
  for (const p of pending) {
    try {
      await fetch(`${BACKEND_URL}/api/decks/${deckId}/reviews`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p) });
    } catch (e) { /* mantener en cola y salir si falla mucho */ }
  }
  setJSON(`pending_reviews_${userId}`, []);
};
```

- Llamar `await flushPending()` y `await fetch('/queue-status')` antes del PATCH de cierre si `showSummary` o en cleanup con un timeout limitado.
🔗 Regla del proyecto violada (si aplica):
- `localStorage` debe usarse a través de `safeLocalStorage` (si se persiste localmente). Falta estrategia de persistencia/flush para telemetría.

---

🟡 [AbortControllers / Memory leaks por fetch no cancelados]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — `loadDeck` (líneas ~152–171) y varios fetches (`startSession`, `handleAnswer`, `notifyBatchCompleted`, `closeSession`).
🐛 Problema:
- Los fetches no usan signal/AbortController. Si el componente se desmonta, las respuestas pendientes pueden intentar actualizar estado (p. ej. `setLoading(false)` en loadDeck) o dejar solicitudes en curso.
⚠️ Impacto:
- Warnings de React por setState en componentes desmontados, requests inútiles y consumo de red, potenciales leaks lógicos.
✅ Fix concreto (código o patrón sugerido):
- Centralizar controladores y abortarlos en cleanup; patrón mínimo:

```js
const controllers = useRef([]);

const makeFetch = (url, opts = {}) => {
  const c = new AbortController();
  controllers.current.push(c);
  return fetch(url, { ...opts, signal: c.signal })
    .finally(() => {
      controllers.current = controllers.current.filter(x => x !== c);
    });
};

useEffect(() => {
  // ...
  return () => {
    controllers.current.forEach(c => c.abort());
    controllers.current = [];
    closeSession(true);
  };
}, [/* deps */]);
```

- Reemplazar llamadas `fetch(...)` por `makeFetch(...)` donde aplique.
🔗 Regla del proyecto violada (si aplica):
- Patrón de mitigación de races (AbortController) aplicado en HomeSection no está reproducido aquí.

---

🟡 [Datos de telemetría inválidos — responseTime NaN]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — `handleAnswer` (cálculo en líneas ~206–209).
🐛 Problema:
- `startTimeRef.current` puede ser null si no se inicializó aún; `responseTimeMs = Math.round(endTime - startTimeRef.current)` produce NaN si `startTimeRef.current` es null/undefined.
⚠️ Impacto:
- Envío de `responseTimeMs: NaN` al backend provoca datos corruptos o errores de validación.
✅ Fix concreto (código o patrón sugerido):
- Proteger el cálculo:

```js
const endTime = performance.now();
const responseTimeMs = startTimeRef.current
  ? Math.round(endTime - startTimeRef.current)
  : 0; // o null para indicar missing
```

- Alternativamente asegurar `startTimeRef.current = performance.now()` al montar del lote y antes de permitir respuestas.
🔗 Regla del proyecto violada (si aplica):
- Integridad de telemetría y robustez frente a estados temporales.

---

🟡 [Batch vacío / edge case en buildBatch]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — `startNewBatch` y `buildBatch` (líneas ~176–182) y render de progreso (línea ~335).
🐛 Problema:
- Si `config.buildBatch(...)` devuelve un array vacío, `cards.length === 0` y el UI muestra `currentIndex + 1 / cards.length` (p. ej. "1 / 0") y `currentCard` quedará undefined; CardFace/FlipCard pueden fallar.
⚠️ Impacto:
- UI incorrecta o crash en tiempo de ejecución, mala UX en mazs con pocos elementos o filtros extremos.
✅ Fix concreto (código o patrón sugerido):
- Añadir guardas y fallback en `startNewBatch`:

```js
let batch = config.buildBatch(allCardsRef.current, { excludeCardId: lastCardIdRef.current });
if (!batch || batch.length === 0) {
  // fallback seguro: usar todo el mazo o rotar el último id
  batch = allCardsRef.current.length ? [...allCardsRef.current] : [];
}
if (batch.length === 0) {
  // no hay tarjetas -> cerrar sesión o setear error
  setError('No hay tarjetas disponibles para repasar.');
  return;
}
setCards(batch);
setCurrentIndex(0);
```

- Y al renderizar usar defensas: `const safeIndex = Math.min(currentIndex, Math.max(0, cards.length - 1)); const currentCard = cards[safeIndex];`
🔗 Regla del proyecto violada (si aplica):
- Robustez del algoritmo de repetición espaciada frente a edge cases (deck vacío).

---

🟡 [Notificar lote incompleto si no hay sessionId]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — `notifyBatchCompleted` (líneas ~143–148) y su uso en `handleAnswer` (líneas ~233–235).
🐛 Problema:
- `notifyBatchCompleted` retorna temprano si `sessionIdRef.current` es falsy. Si el sessionId aún no llegó (race con startSession), se pierde la actualización de lote completado en backend.
⚠️ Impacto:
- Conteo de `batchesCompleted` y métricas del lado servidor pueden ser incorrectas.
✅ Fix concreto (código o patrón sugerido):
- En lugar de retornar inmediatamente, encolar la notificación localmente y reintentar cuando `sessionIdRef.current` esté disponible, o aguardar la promesa de inicio de sesión (ver `sessionStartPromiseRef`) con timeout corto antes de dar por imposible notificar:

```js
const pendingBatchNotifications = useRef([]);

const notifyBatchCompleted = async () => {
  if (!sessionIdRef.current) {
    pendingBatchNotifications.current.push(true);
    return;
  }
  try {
    await fetch(`${BACKEND_URL}/api/sessions/${sessionIdRef.current}/batch-completed`, { method: 'PATCH' });
  } catch (e) { console.error(e); }
};

// Al recibir sessionId (por ejemplo en startSession resultado), flush:
if (sessionIdRef.current && pendingBatchNotifications.current.length) {
  // enviar PATCH por cada item o una sola vez
  pendingBatchNotifications.current = [];
  notifyBatchCompleted();
}
```

🔗 Regla del proyecto violada (si aplica):
- Consistencia de telemetría / dependencia explícita en `requestSeq`/coordinación no implementada aquí.

---

🟡 [Estilos en línea dinámicos — riesgo de inyección y mantenimiento]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — uso de `style={bgStyle}` en FlipCardSection y en sección study (líneas ~38–40, ~54–56, ~351, ~359).
🐛 Problema:
- Uso repetido de `style={bgStyle}` para backgrounds dinámicos. Si `bgStyle` se construye a partir de datos controlables (ej. `currentCard`), puede introducir valores CSS inesperados o dificultar styling centralizado.
⚠️ Impacto:
- Riesgo bajo de inyección CSS si no se valida `bgStyle`, y peor mantenibilidad (Tailwind + estilos inline mezclados).
✅ Fix concreto (código o patrón sugerido):
- Normalizar `bgStyle` a variables seguras o clases generadas y usar CSS custom properties:

```css
/* tailwind / css */
.card-bg { background: var(--card-bg); }
```

```js
// React
const safeBg = { '--card-bg': bgStyle?.backgroundImage || 'none' };
<div style={safeBg} className="card-bg">...</div>
```

- Validar/normalizar cualquier valor derivado de `currentCard` antes de aplicarlo como CSS.
🔗 Regla del proyecto violada (si aplica):
- Posible violación de la pauta de evitar inline styles (criterio de revisión).

---

🟢 [StudySection: diseño sencillo pero hard-coded admin]
📍 Archivo y línea/contexto:
- frontend/src/components/StudySection.jsx — check admin (línea ~42).
🐛 Problema:
- `const isAdmin = userEmail === "cesarjaviervebe@gmail.com";` embebido en el cliente.
⚠️ Impacto:
- Mantenimiento difícil, riesgo de suplantación o privilegios mal asignados si `userEmail` puede ser manipulado; no escalable.
✅ Fix concreto (código o patrón sugerido):
- Delegar roles desde el backend (campo `role` en el user) o usar una lista de admins configurable vía `import.meta.env`:

```js
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
const isAdmin = user?.role === 'admin' || userEmail === ADMIN_EMAIL;
```

- Evitar decisiones de autorización puramente en cliente.
🔗 Regla del proyecto violada (si aplica):
- Seguridad / validación de roles (mejor delegar al servidor).

---

💡 [Code smell / StudySection: array `methods` recreado en cada render]
📍 Archivo y línea/contexto:
- frontend/src/components/StudySection.jsx — definición `methods` (líneas ~8–39).
🐛 Problema:
- `methods` se declara inline en el componente y se recrea en cada render; puede forzar re-render innecesario en hijos si se pasan referencias por prop.
⚠️ Impacto:
- Pequeño impacto de rendimiento; posibles re-renders innecesarios.
✅ Fix concreto (código o patrón sugerido):
- Memoizar la lista:

```js
const methods = useMemo(() => [ /* ... */ ], []);
```

🔗 Regla del proyecto violada (si aplica):
- Code smells / estados derivados no memoizados.

---

🟡 [Riesgo de XSS / renderizado de contenido de tarjetas]
📍 Archivo y línea/contexto:
- frontend/src/components/SessionPlayer.jsx — `CardFace` (uso en líneas ~45, ~61, ~355, ~365) y `img src={currentCard.contentImage}` (líneas ~408–411).
🐛 Problema:
- No podemos ver `CardFace` ni `parseCardStyles` aquí; si `CardFace` renderiza HTML sin sanitizar (p. ej. `dangerouslySetInnerHTML`) o `contentImage` no se valida, hay riesgo de XSS o recursos maliciosos.
⚠️ Impacto:
- Ejecución de código no deseado, robo de sesión/telemetría, contenidos inseguros mostrados a usuarios.
✅ Fix concreto (código o patrón sugerido):
- Revisar `CardFace` y `parseCardStyles` y asegurar:
  - Usar sanitizador (DOMPurify) para HTML entrante.
  - Validar `contentImage` (allowlist de esquemas http/https, bloquear javascript:).
  - Escapar texto por defecto y evitar `dangerouslySetInnerHTML` salvo con sanitización explícita.
🔗 Regla del proyecto violada (si aplica):
- Seguridad básica: validación y sanitización antes de renderizar contenido de tarjetas.

---

📊 Resumen de patrones inconsistentes encontrados
- Falta de coordinación entre creación y cierre de sesión (race entre startSession y cleanup) — riesgo alto de sesiones huérfanas.
- Telemetría enviada de forma optimista sin persistencia/flush fiable (sin sendBeacon ni cola local) — riesgo alto de pérdida de datos.
- Fetches no cancelables (ausencia de AbortController) en varios flujos — riesgo medio de leaks y state updates post-unmount.
- Edge cases de batch (vacío) no defendidos — riesgo medio de UI rota.
- Algunos puntos de seguridad (posible XSS) requieren revisar `CardFace`/`parseCardStyles`.
- Pequeñas code-smells en StudySection (hard-coded admin, recreación de constantes).

🔄 Siguiente archivo que debería auditar y por qué
- frontend/src/App.jsx — razón: App.jsx es el puente de estado de la navegación (regla obligatoria del proyecto). Necesitamos verificar que:
  - El estado global (userId, navegación entre tabs, onExit handlers) está alineado con la forma en que `SessionPlayer` / Study flows esperan cerrar la sesión.
  - `safeLocalStorage` se usa consistentemente a nivel app para persistencia temporal y flushing.
  - No hay navegación que fuerce un unmount sin pasar por el flujo de cierre/flush que implementemos.
Auditar App.jsx ayudará a asegurar que las correcciones de session lifecycle y flush encajen con la navegación real.

⚠️ Advertencias de arquitectura o flujos que requieren contexto adicional
- Necesito revisar estos archivos para completar la auditoría y proponer parches seguros:
  - frontend/src/components/CardFace.jsx — para confirmar sanitización del HTML/Markdown de tarjetas.
  - frontend/src/lib/batchBuilder.js — para validar que `buildBatch` maneja `excludeCardId` y devuelve batches no vacíos en casos límite.
  - frontend/src/lib/safeLocalStorage.js — para ver la API exacta (getJSON/setJSON) que propongo usar en colas locales.
  - Contratos backend: endpoints `/api/decks/:id/sessions`, `/api/decks/:id/reviews`, y `/api/users/:id/queue-status` — necesito saber si el servidor soporta retry/queue o si cerrar sesión sin esperar provoca pérdida definitiva.
- Si quieres, implemento los fixes mínimos (AbortController + sendBeacon + persist queue en safeLocalStorage + guardas en startNewBatch) y hago un PR pequeño. ¿Quieres que lo aplique ahora?
