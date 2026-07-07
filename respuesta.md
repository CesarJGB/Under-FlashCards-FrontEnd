Resumen: cambios aplicados y explicación técnica

Objetivo
- Eliminar el parpadeo mínimo (flicker) al cambiar activeParciales y volver al Home, y evitar condiciones de carrera entre fetches concurrentes sin introducir memory leaks.

Cambios principales implementados

1) frontend/src/components/LibrarySection.jsx — invalidación selectiva + prefetch
- Al cambiar activeParciales ahora:
  - Actualizamos inmediatamente el estado `materias` y su copia en localStorage.
  - Hacemos un prefetch del nuevo `/api/academic/materias/:id/domain-preview?parciales=...`.
    - Si el prefetch responde OK, escribimos el `preview` en la caché local `domainPreviews_{userId}` (merge) y disparamos un evento global `domainPreviews:update` con detail { userId, materiaId, preview }.
    - Si el prefetch falla, eliminamos la entrada correspondiente en `domainPreviews_{userId}` (si existía) y disparamos `domainPreviews:invalidate` con detail { userId, materiaId }.

Código relevante (resumen):

```js
// después de setMaterias(updated)
const res = await fetch(`${BACKEND_URL}/api/academic/materias/${id}/domain-preview?parciales=${newActive.join(',')}`);
if (res.ok) {
  const data = await res.json();
  cached[id] = { mastery: data.mastery, parciales: data.parciales, timestamp: Date.now(), metrics: data.metrics };
  localStorage.setItem(key, JSON.stringify(cached));
  window.dispatchEvent(new CustomEvent('domainPreviews:update', { detail: { userId, materiaId: id, preview: cached[id] }}));
} else {
  delete cached[id];
  localStorage.setItem(key, JSON.stringify(cached));
  window.dispatchEvent(new CustomEvent('domainPreviews:invalidate', { detail: { userId, materiaId: id }}));
}
```

2) frontend/src/components/HomeSection.jsx — requestSeq + controller por petición + listeners
- Añadí `const requestSeq = useRef(0)` y, en cada ejecución de `fetchDomainPreviews`, incremento y capturo `myRequestId`.
- Creo un AbortController por ejecución (`const controller = new AbortController()`), lo asigno a `abortController.current`, y uso `controller.signal` en los fetches.
- Tras completar `Promise.all`, guardo en localStorage y actualizo `domainPreviews` solo si `requestSeq.current === myRequestId` y `isMounted.current` es true. Esto evita sobrescrituras por respuestas tardías.
- Limpio `abortController.current = null` si sigue apuntando al controller local y en el cleanup del `useEffect` abortamos y seteamos `abortController.current = null`.
- Añadí listeners para `domainPreviews:update` y `domainPreviews:invalidate` que actualizan el estado en memoria de `domainPreviews` inmediatamente (o eliminan la entrada). Los listeners se agregan y remueven en useEffect, evitando leaks.

Código relevante (resumen):

```js
const myRequestId = ++requestSeq.current;
if (abortController.current) abortController.current.abort();
const controller = new AbortController();
abortController.current = controller;

// usar controller.signal en los fetches

// después de Promise.all:
if (hasChanges && isMounted.current && requestSeq.current === myRequestId) {
  localStorage.setItem(`domainPreviews_${user.id}`, JSON.stringify(results));
  setDomainPreviews(/* ... */);
}

if (abortController.current === controller) abortController.current = null;

// cleanup useEffect:
if (abortController.current) { abortController.current.abort(); abortController.current = null; }
```

Por qué el parpadeo persistía antes
- La invalidación selectiva sola elimina la entrada en localStorage, pero HomeSection sigue mostrando la información en memoria hasta que el fetch de refresco termina y actualiza `domainPreviews`. Ese pequeño lapso provoca el parpadeo.

Por qué la solución nueva reduce/elimina el parpadeo
- Prefetch: la sección que realiza el cambio obtiene el nuevo preview antes de volver al Home y lo escribe en la caché; así al volver, Home lee/cache en memoria el valor nuevo (o recibe el evento para actualizar en memoria inmediatamente).
- Event dispatch: Home escucha el evento y actualiza su estado en memoria inmediatamente, sin esperar a que el fetch global vuelva a correr.
- requestSeq + controller por petición: evita que respuestas antiguas sobrescriban valores más nuevos.

Riesgo de memory leaks y condición de carrera — estado actual
- Memory leak: no hay evidencia de fuga. Los listeners se registran/remueven, AbortControllers se limpian y `isMounted` evita setState tras unmount.
- Condición de carrera: mitigada por `requestSeq` y el uso de controller local; ahora una respuesta tardía no podrá sobrescribir datos más recientes.

Costes y trade-offs
- Prefetch añade una llamada extra al backend por cada cambio de parciales; si los usuarios hacen toggles rápidos conviene debouncear la acción (100–300ms) o agregar dedup en servidor.
- Event-based sync es una solución simple y eficaz entre secciones del cliente, pero introduce dependencia de eventos globales; está encapsulado y removido correctamente en los cleanup.

Recomendaciones siguientes
1. Debounce en LibrarySection para evitar ráfagas cuando el usuario pulsa varias veces rápido.
2. Añadir tests (unit + integration) que simulen respuestas fuera de orden y verifiquen que no hay sobrescrituras.
3. Considerar cálculo optimista en cliente (si se pueden derivar métricas localmente) para eliminar llamadas al servidor.

Estado actual (commits + build)
- Implementación hecha y commiteada. Build de `frontend` pasó correctamente con Vite (advertencia sobre chunks grandes, no bloqueante).

¿Quieres que implemente un debounce corto (100–250ms) en el prefetch para reducir la carga en el backend en caso de toggles rápidos? 

// definiciones a nivel de componente
const isMounted = useRef(true);
const abortController = useRef(null);
const requestSeq = useRef(0);

// dentro de fetchDomainPreviews
const myRequestId = ++requestSeq.current;

// reemplazar la lógica de controller actual por un controller local
if (abortController.current) abortController.current.abort();
const controller = new AbortController();
abortController.current = controller;

// usar controller.signal en los fetches
const res = await fetch(url, { signal: controller.signal });

// después de Promise.all y antes de aplicar resultados
if (hasChanges && isMounted.current && requestSeq.current === myRequestId) {
  try {
    localStorage.setItem(`domainPreviews_${user.id}`, JSON.stringify(results));
  } catch (e) { /* handle */ }

  setDomainPreviews(prev => { /* ... */ });
}

// limpiar controller si sigue siendo el actual
if (abortController.current === controller) abortController.current = null;

// cleanup del useEffect que lanza fetchDomainPreviews
return () => {
  isMounted.current = false;
  if (abortController.current) {
    abortController.current.abort();
    abortController.current = null;
  }
};

Por qué esto es suficiente
- requestSeq asegura que solo el resultado de la última ejecución modifica el estado/localStorage, eliminando sobrescrituras por respuestas tardías.
- controller local + limpieza evita referencias residuales y facilita el GC.
- isMounted sigue siendo la última línea de defensa para prevenir setState después del unmount.

¿Quieres que aplique estos cambios en HomeSection.jsx ahora? Puedo implementarlo, probar que no rompa la lógica actual y hacer commit/push con un mensaje claro.
