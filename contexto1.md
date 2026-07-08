Resumen rápido (qué revisé)

- Revisé las partes relevantes del repositorio relacionadas con "materias" (frontend y backend) y consolidé el contexto necesario para trabajar en esa área: modelos, controladores, rutas, validaciones, cachés, componentes UI y lógica de métricas.

Contenido técnico (contexto para trabajar en "materias")

1) Contexto general
- "Materias" = carpeta académica raíz (asignatura). Soporta subniveles: temas (parcial 1|2|3) y subtemas.
- El sistema guarda metadatos analíticos por materia (knowledgeMetrics) que alimentan la UI (porcentaje de dominio, etc).
- El frontend usa cache local (safeLocalStorage) para evitar flicker y para funcionamiento offline.

2) Backend — archivos clave
- backend/src/models/Materia.js
  - Schema:
    - name: String (required, trim)
    - userId: ObjectId (required, index)
    - activeParciales: [Number] default [1,2,3]
    - knowledgeMetrics: subdocumento (radar/analytics)
  - Métodos:
    - serialize() → devuelve { id, _id, name, userId, activeParciales, analytics: { masteryPercentage, avgResponseTime, totalReviewsCount, velocityIndex, lastCalculatedAt }, createdAt }
  - Índice único: { name, userId }

- backend/src/controllers/academicController.js
  - Rutas/handlers principales:
    - GET /api/academic/materias/:userId → getMaterias() (devuelve materias ordenadas por name)
    - POST /api/academic/materias → createMateria({ userId, name })
      - valida name no vacío y duplicados por userId
      - retorna 201 + materia.serialize()
    - PUT /api/academic/materias/:id → updateMateria({ name })
      - valida name no vacío, evita duplicados para mismo user (excluye id actual)
    - DELETE /api/academic/materias/:id → deleteMateria()
      - Borra la materia y:
        - elimina temas con materiaId
        - elimina subtemas cuya temaId esté en los temas eliminados
        - no borra mazos; en su lugar los desvincula: set { materiaId: null, parcialNumber: null, temaId: null, subtemaId: null }
    - PATCH /api/academic/materias/:id/active-parciales → updateActiveParciales({ activeParciales: [1,2] })
      - Valida que sea array con valores exactamente en [1,2,3]
    - GET /api/academic/materias/:id/domain-preview?parciales=1,2 → getDomainPreview()
      - Filtra temas por parciales y calcula métricas via calculateRadarMetrics (utils)

3) Backend — comportamiento importante / reglas de negocio
- Parciales permitidos: exactamente 1, 2 o 3. Backend valida estrictamente.
- Al eliminar materia se hace limpieza en cascada de temas/subtemas pero los mazos se conservan (desvinculados).
- knowledgeMetrics en Materia se usa para el frontend (serialize() incluye analytics).

4) Frontend — archivos clave y flujo
- frontend/src/App.jsx
  - loadMaterias(user.id) fetches GET /api/academic/materias/:userId
  - Datos se guardan en safeLocalStorage: key `materias_${user.id}`
  - Estado global mantiene materias y las pasa a LibrarySection.

- frontend/src/components/LibrarySection.jsx
  - Llama a loadMaterias() y loadDecks() en mount.
  - Handlers para crear/editar/eliminar carpetas académicas (materia/tema/subtema): POST/PUT/DELETE a /api/academic/*
  - Tras mutaciones actualiza setMaterias y setJSON(`materias_${userId}`, nextMaterias)
  - onActiveParcialesChange: actualiza activeParciales localmente, prefetch a /domain-preview y guarda previews en `domainPreviews_${userId}`, además dispara CustomEvent para listeners.

- frontend/src/hooks/useLibraryState.js
  - Centraliza el path actual: { materiaId, parcialNumber, temaId, subtemaId, filterActiveParciales }
  - sortedMaterias = sortFolders(materias, sortBy, decks, m => decks.filter(d => d.materiaId === m._id))
  - processedDecks filtra decks según currentPath y searchQuery
  - refreshTemas() → GET /api/academic/temas/:materiaId

- frontend/src/components/library/MateriasLevel.jsx
  - UI para mostrar lista/grid de materias; soporta editar nombre (abre AcademicFolderModal)

- frontend/src/components/library/AcademicFolderModal.jsx
  - Modal para crear/editar materia/tema/subtema. Llama a handlers pasados desde LibrarySection.

- frontend/src/lib/metricsEngine.js (cliente)
  - calculateCollectionAnalytics(cards) → calcula masteryPercentage, avgResponseTime, totalReviewsCount, velocityIndex, lastCalculatedAt
  - syncOptimisticMateriaAnalytics(materiaId, updatedDecks) → actualiza localStorage `materias_${userId}` con promedios de mazos mutados

5) Cachés / localStorage / eventos
- Keys usadas:
  - `materias_${userId}` → lista de materias serializadas
  - `decks_${userId}` → decks
  - `domainPreviews_${userId}` → map materiaId → { mastery, parciales, timestamp }
- Eventos CustomEvent para notificar previews:
  - 'domainPreviews:update' detail { userId, materiaId, preview }
  - 'domainPreviews:invalidate'

6) Formatos/payloads de API (ejemplos)
- Crear materia:
  - POST /api/academic/materias
  - body: { userId: "<userId>", name: "Matemáticas" }
  - success: 201 + body: materia.serialize()
- Actualizar active parciales:
  - PATCH /api/academic/materias/:id/active-parciales
  - body: { activeParciales: [1,3] }
- Obtener domain preview:
  - GET /api/academic/materias/:id/domain-preview?parciales=1,3
  - resp: { materiaId, parciales: [1,3], mastery: <num>, metrics: { ... } }

7) Detalles útiles y "trampas"
- IDs: la API y el frontend usan a veces `_id` y otras `id`. serialize() incluye ambos; normaliza al añadir código nuevo.
- activeParciales default [1,2,3] en modelo. Backend valida.
- Al borrar una materia, decks quedan sin materia; UI actualiza estado local y vuelve a cargar decks.
- Biblioteca usa cache local y actualiza setJSON tras mutaciones para evitar flicker; mantén esa consistencia.
- domain-preview se prefetcha cuando cambias activeParciales; la UI confía en esa caché para HomeSection.
- metricsEngine.js en frontend es la fuente de pesos y cálculos del dominio en cliente.

8) Archivos para editar si trabajas en "materias"
- Backend: backend/src/controllers/academicController.js, backend/src/models/Materia.js, utils/radarMetrics
- Frontend: frontend/src/components/library/MateriasLevel.jsx, frontend/src/components/LibrarySection.jsx, frontend/src/hooks/useLibraryState.js, frontend/src/lib/metricsEngine.js, frontend/src/components/home/*

9) Sugerencias de trabajo (pasos prácticos)
- Si añades/cambias campos en Materia: actualizar schema, serialize(), migración/defaults, y front donde se guarda/lee `materias_${userId}`.
- Si tocas activeParciales: mantener validación backend y actualizar prefetch/cache en LibrarySection.
- Si tocas UX de MateriasLevel: persistir setJSON(`materias_${userId}`, nextMaterias) tras mutaciones.
- Para cambios de cálculo de dominio: preferible ajustar metricsEngine.js y mantener consistencia con server-side calculateRadarMetrics.

10) Riesgos / pruebas que ejecutar
- Prueba creación con mismo nombre: backend debe retornar 400.
- Prueba update nombre a uno existente: backend 400.
- Prueba delete materia: verificar que temas/subtemas desaparecen y decks quedan con materiaId null.
- Probar toggles de activeParciales: prefetch / eventos y que HomeSection refleje el preview.
- Pruebas de cache: limpiar localStorage y verificar carga desde API.

---

Archivo generado automáticamente: contexto1.md
