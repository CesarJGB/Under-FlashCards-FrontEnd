Revisión: useMemo y domainPreviews en HomeSection.jsx

Resumen corto
- Sí: usar `domainPreviews` directamente como dependencia del `useMemo` que calcula `enrichedMaterias` puede provocar recomputaciones innecesarias si el objeto cambia de referencia aunque sus valores relevantes sean iguales.
- En el código actual ya hay protecciones (evitas muchos `setDomainPreviews` redundantes), pero endurecer la dependencia evita re-renders/recomputations cuando la referencia cambia sin cambios de valor.

Por qué ocurre
- React compara dependencias por referencia (shallow equality). Si `domainPreviews` es un objeto nuevo (nueva referencia), el `useMemo` se volverá a ejecutar aunque su contenido no haya cambiado.

Recomendación práctica (mínimo cambio, alto beneficio)
- Calcular una "huella" (string) que represente únicamente los valores de mastery que consumirá `enrichedMaterias`. Usar esa huella como dependencia del `useMemo` en lugar del objeto completo.

Implementación sugerida
1) Añadir antes del `useMemo` que genera `enrichedMaterias`:

```js
const domainPreviewsKey = useMemo(() => {
  if (!materias) return '';
  return materias.map(m => {
    const id = String(m._id || m.id || '');
    const ap = m.activeParciales || [1,2,3];
    const isFiltered = ap.length > 0 && ap.length < 3;
    const mastery = isFiltered && typeof domainPreviews[id] === 'number'
      ? domainPreviews[id]
      : (m.analytics?.masteryPercentage ?? 0);
    return `${id}:${mastery}`;
  }).join('|');
}, [materias, domainPreviews]);
```

2) Cambiar la dependencia del `useMemo` de

```js
}, [materias, decks, domainPreviews]);
```

a

```js
}, [materias, decks, domainPreviewsKey]);
```

Por qué esto funciona
- `domainPreviewsKey` reproducirá la misma string cuando los mastery por materia no cambien, incluso si `domainPreviews` cambia de referencia. Así `useMemo` no se recomputa salvo cambios reales en los valores usados.

Coste
- Construir la huella implica iterar `materias` una vez; normalmente es más barato que volver a computar todo `enrichedMaterias` (que hace filtros y reducciones). Si tienes muchas materias/decks, se puede optimizar (ver abajo).

Mejoras adicionales recomendadas
- Agrupar `decks` por `materiaId` en un `useMemo` (de modo que cada materia no haga `decks.filter(...)` repetidamente). Esto cambia la complejidad de O(M*N) a O(M+N).
- Si el número de materias es muy grande, limitar la huella a materias "activas" o filtradas para reducir trabajo.
- Alternativa: usar una comparación deep-equals custom entre el `prev` y el `next` de `domainPreviews` antes de permitir que cambie la referencia, aunque esto tiende a ser más costoso que generar la huella.

¿Quieres que aplique estos cambios ahora?
- Puedo implementar solo la huella (`domainPreviewsKey`) y actualizar las dependencias del `useMemo` (cambio pequeño). 
- O puedo además implementar `decksByMateria` memoizado para mejorar rendimiento si hay muchos decks.

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
