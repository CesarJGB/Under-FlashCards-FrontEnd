Resumen breve
- Sí: mantener TTL en 15 minutos está bien como política general — es un buen balance entre frescura y carga.
- No es estrictamente necesario invalidar todo el caché inmediatamente porque el código ya detecta cambios en activeParciales y fuerza un refetch para la materia afectada.
- Si quieres que la UI refleje el cambio de forma instantánea (sin esperar al refetch), puedes invalidar sólo la entrada de la materia o prefetchear el preview inmediatamente.

Qué hace el código ahora (rápido)
- HomeSection.jsx define DOMAIN_PREVIEWS_TTL_MS = 15 * 60 * 1000 (15 min).
- fetchDomainPreviews lee localStorage domainPreviews_{userId} y decide hacer fetch si:
  - no hay caché,
  - el timestamp excede el TTL,
  - O los parciales almacenados en la caché no coinciden con materia.activeParciales (la comparación ordenada) — ver la lógica en fetchDomainPreviews (HomeSection.jsx, ~líneas 123–146).
- Cuando el usuario cambia activeParciales:
  - ParcialesLevel hace PATCH al backend y LibrarySection actualiza materias en estado local y en localStorage (no elimina explícitamente domainPreviews).
  - El cambio de materias hace que HomeSection vuelva a ejecutar fetchDomainPreviews; como la caché para esa materia contiene parciales distintos, la función detecta el desajuste y refetch inmediatamente esa materia.

Consecuencias prácticas
- Correcto desde consistencia: el sistema ya fuerza refresco cuando los parciales cambian, por lo que no hay “staleness” prolongado más allá del tiempo que tome el fetch.
- UX: puede verse la métrica antigua durante unas decenas/centenas de ms mientras el nuevo preview se obtiene y setDomainPreviews actualiza el estado. Si te molesta ese parpadeo, puedes mejorar la UX con invalidación selectiva o prefetch.

Opciones recomendadas (ordenadas por mínimo cambio → más completo)

1) (Recomendado, cambio mínimo) Invalidar sólo la entrada de la materia en localStorage cuando el usuario actualiza activeParciales.
- Efecto: HomeSection al ejecutar su lógica verá que falta la entrada y hará fetch inmediato para esa materia. Es barato (no borras todo el caché) y elimina la posibilidad de mostrar una metric vieja mientras llega el refetch.
- Implementación (sugerencia, poner junto al setMaterias/localStorage en LibrarySection.onActiveParcialesChange):

```js
// después de setMaterias(updated) y localStorage.setItem(`materias_${userId}`, ...)
try {
  const key = `domainPreviews_${userId}`;
  const cached = JSON.parse(localStorage.getItem(key) || '{}');
  const id = String(materiaId);
  if (cached[id]) {
    delete cached[id];
    localStorage.setItem(key, JSON.stringify(cached));
  }
} catch (err) {
  console.error('[LibrarySection] Error invalidando domainPreviews cache', err);
}
```

2) (Mejora UX) Prefetch y actualizar caché inmediatamente tras el PATCH:
- Tras la actualización exitosa, llamar al endpoint `/api/academic/materias/:id/domain-preview?parciales=...`, guardar la respuesta en localStorage y opcionalmente notificar al HomeSection para que actualice su estado en memoria.
- Pros: la UI muestra el valor correcto instantáneamente; Contras: más llamadas al servidor (pero sólo la materia afectada).

3) Ajustar TTL global (no recomendado por defecto)
- Reducir TTL (ej. 1–5 min) hace la caché más fresca, pero aumenta carga en el backend. Dado que ya se detectan cambios por parciales, no hace falta bajar el TTL para resolver el problema de coherencia cuando el usuario cambia parciales.

Consideraciones operativas
- Invalidar sólo la entrada por materia es la opción menos disruptiva.
- Si los usuarios hacen toggles muy rápidos en los parciales, añade un debounce (cliente) o dedup en el servidor para evitar ráfagas de requests.
- Si quieres que el HomeSection actualice su estado en memoria inmediatamente tras la invalidación (sin esperar al efecto por cambio de materias), puedes emitir un CustomEvent y hacer que HomeSection escuche para forzar fetchDomainPreviews; o pasar una función de invalidación/recarga desde el componente padre.

¿Quieres que lo implemente?
- Puedo aplicar la invalidación mínima (opción 1) ahora en LibrarySection.jsx y/o añadir el prefetch (opción 2). ¿Cuál prefieres?
