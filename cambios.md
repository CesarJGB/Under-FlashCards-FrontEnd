Cambios recientes implementados
=============================

Resumen breve
- Objetivo: eliminar el parpadeo al cambiar `activeParciales`, evitar condiciones de carrera entre fetches concurrentes y mejorar eficiencia del cálculo en memoria.
- Implementé invalidación selectiva + prefetch en LibrarySection, mitigación de race conditions en HomeSection y optimizaciones de memo para el cálculo de `enrichedMaterias`.

Detalles por archivo
- frontend/src/components/LibrarySection.jsx
  - Al cambiar `activeParciales` ahora:
    - Actualizamos inmediatamente el estado `materias` y su copia en `localStorage`.
    - Hacemos un prefetch a `/api/academic/materias/:id/domain-preview?parciales=...`.
      - Si responde OK: escribimos el `preview` reducido (mastery, parciales, timestamp) en `localStorage` bajo `domainPreviews_{userId}` (merge) usando `safeLocalStorage.setJSON`, y disparamos un evento global `domainPreviews:update` con `{ userId, materiaId, preview }`.
      - Si falla: eliminamos la entrada correspondiente en `domainPreviews_{userId}` (si existía) usando `safeLocalStorage.setJSON` y disparamos `domainPreviews:invalidate` con `{ userId, materiaId }`.
    - Si por cualquier motivo el prefetch falla, la caché se invalida para forzar refetch en background desde Home; además se mantiene un fallback en memoria (safeLocalStorage).

- frontend/src/components/HomeSection.jsx
  - Evitar sobrescrituras por respuestas fuera de orden:
    - Añadido `requestSeq` (useRef) y captura `myRequestId` en cada ejecución de `fetchDomainPreviews`.
    - Se crea un `AbortController` por ejecución (`controller`) y se usa `controller.signal` en los fetches; además se asigna a `abortController.current` y se limpia (`null`) cuando corresponde.
    - Al aplicar resultados se comprueba `requestSeq.current === myRequestId` y `isMounted.current` antes de escribir en `localStorage` o actualizar `domainPreviews` en estado.
  - Comunicación inmediata entre secciones:
    - Se añadieron listeners a `window` para `domainPreviews:update` y `domainPreviews:invalidate`.
      - `update`: actualiza inmediatamente `domainPreviews[materiaId] = preview.mastery` en memoria.
      - `invalidate`: elimina la entrada en memoria para forzar comportamiento de refetch/fallback.
    - Los listeners se registran y remueven en `useEffect` para evitar leaks.
  - Limpieza y robustez:
    - El cleanup del efecto aborta y limpia `abortController.current` y marca `isMounted.current = false`.

- frontend/src/components/HomeSection.jsx (optimización de memo)
  - `decksByMateria` (useMemo): agrupa los mazos por `materiaId` para evitar hacer `decks.filter(...)` repetidamente dentro del map de materias (mejora la complejidad de O(M*N) a O(M+N)).
  - `domainPreviewsKey` (useMemo): `JSON.stringify(domainPreviews)` como huella estable para detectar cambios reales en los valores usados por `enrichedMaterias`.
  - El `useMemo` que construye `enrichedMaterias` ahora depende de `domainPreviewsKey` y usa `decksByMateria[currentMateriaId]`.

SafeLocalStorage
- Se agregó `frontend/src/lib/safeLocalStorage.js` con `getJSON`, `setJSON` y `remove`, que:
  - Maneja JSON.parse corrupto (elimina la clave corrupta y devuelve fallback en memoria).
  - Captura `QuotaExceededError` y cae a un fallback en memoria (Map).
  - Mantiene una copia en memoria sincronizada para permitir continuidad cuando `localStorage` no está disponible.

Aplicaciones del helper
- App.jsx: ahora usa `getJSON` para inicializar `decks` y `materias` (evita crash en render por JSON corrupto).
- HomeSection.jsx: ahora persiste `domainPreviews` con `setJSON`.
- LibrarySection.jsx: usa `setJSON` para persistir previews (payload reducido) y para invalidaciones.

Otros cambios
- Se actualizaron y añadieron handlers para invalidación selectiva y prefetch en LibrarySection.
- Se actualizaron los listeners en HomeSection para sincronizar inmediatamente la UI cuando Library escribe el preview en caché.

Verificación
- Ejecuté `vite build` en `frontend/` — build exitoso (advertencia: algunos chunks grandes >500KB, es informativa).

Trade-offs y recomendaciones
- El prefetch añade una petición extra por cambio de parciales. Si los usuarios hacen toggles rápidos, conviene añadir un debounce (100–300ms) o deduplicación de requests en el servidor.
- Recomiendo añadir tests que simulen respuestas fuera de orden (A responde después de B) y verifiquen que no hay sobrescrituras.
- Opcional: considerar cálculo optimista en cliente para evitar la llamada al backend en casos donde sea seguro derivar la métrica localmente.

Commits relevantes
- Implementación principal (optimización + race fixes): commit reciente en main.

Si quieres, puedo:
1) Añadir debounce en LibrarySection para reducir prefetches en toggles rápidos.
2) Añadir tests unitarios que cubran races y el flujo de eventos.
3) Empezar a splittear chunks grandes para mejorar tiempo de carga.
