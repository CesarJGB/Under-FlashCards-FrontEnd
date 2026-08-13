---
name: review-diff
description: Revisa de forma independiente y sin editar los cambios de código, documentación o pruebas de Under Flashcards. Úsala cuando el usuario pida revisar, verificar, auditar o aprobar un cambio, corrección, fase, corte, commit o diff antes de declararlo terminado.
---

# Review Diff

Revisar el cambio con evidencia. No modificar archivos, no corregir hallazgos y no ampliar el alcance hacia una implementación.

## 1. Fijar el objeto de revisión

- Leer `AGENTS.md`.
- Ejecutar `git status --short` y `git rev-parse HEAD`.
- Identificar la base indicada por el usuario: commit, rama, corte anterior o estado previo.
- Si no se indicó una base, distinguir entre cambios sin commit, cambios staged y commits nuevos antes de elegir la comparación.
- No ejecutar `git fetch` salvo que el encargo requiera comprobar el estado remoto.
- Enumerar todos los archivos incluidos en el objeto de revisión.
- Separar cambios del encargo de cambios previos o ajenos.
- Detenerse como BLOCKED si la base o el alcance siguen siendo ambiguos y esa ambigüedad puede cambiar el veredicto.

## 2. Reconstruir el contrato

Extraer del encargo y de la documentación autoritativa:

- objetivo;
- alcance autorizado;
- exclusiones;
- criterios de aceptación;
- contratos que deben conservarse;
- verificaciones exigidas;
- autorización o prohibición de commit y push.

No inventar requisitos nuevos. No tratar preferencias personales como defectos si no forman parte del contrato.

## 3. Inspeccionar el cambio

- Leer el diff completo, no solamente `--stat` ni fragmentos aislados.
- Leer el contexto suficiente de cada archivo modificado.
- Buscar consumidores, importaciones, rutas, contratos y pruebas afectados.
- Verificar eliminaciones y renombres buscando referencias restantes.
- Comparar el comportamiento implementado con cada criterio de aceptación.
- Revisar estados normales, vacíos, error, carga y límites relevantes al cambio.
- Para UI móvil, leer primero la documentación indicada por `docs/platform-limitations/README.md`.
- Distinguir hechos comprobados, inferencias y comportamiento no verificado.

Priorizar defectos que puedan causar:

- comportamiento incorrecto o regresiones;
- pérdida o corrupción de datos;
- fallos de autenticación, seguridad o privacidad;
- contratos frontend/backend incompatibles;
- problemas de concurrencia, caché o estado obsoleto;
- accesibilidad o interacción móvil rota;
- pruebas que ya no comprueban el comportamiento real;
- cambios fuera del alcance.

No reportar problemas puramente hipotéticos sin una ruta concreta de fallo.

## 4. Verificar sin editar

- Ejecutar primero las pruebas deterministas más estrechas relacionadas con el diff.
- Ejecutar suites amplias o build solamente cuando el alcance lo justifique.
- No ejecutar benchmarks con coste, servicios externos ni comandos que requieran credenciales sin autorización explícita.
- No instalar dependencias ni navegadores automáticamente.
- Ejecutar `git diff --check` sobre el objeto de revisión aplicable.
- Volver a ejecutar `git status --short` al finalizar para detectar efectos secundarios.
- No modificar código, pruebas, documentación ni configuración aunque la corrección parezca evidente.
- Si una comprobación genera archivos rastreados o modifica el árbol, reportarlo y no ocultarlo.
- Nunca afirmar que una prueba pasó si no se ejecutó con éxito.

## 5. Clasificar hallazgos

Ordenar los hallazgos por severidad:

- `P0` — pérdida de datos, vulnerabilidad grave o fallo crítico inmediato;
- `P1` — bug funcional importante o regresión con alta probabilidad;
- `P2` — problema real de alcance limitado, mantenibilidad o caso borde relevante;
- `P3` — mejora menor no bloqueante.

Para cada hallazgo incluir:

- severidad;
- archivo y ubicación precisa;
- comportamiento observado;
- condición que lo activa;
- impacto;
- evidencia que demuestra el problema;
- corrección mínima sugerida, sin implementarla.

No inflar el reporte con estilo, gustos o recomendaciones ajenas al encargo.

## 6. Emitir el veredicto

Usar exactamente uno:

- `PASS` — cumple el contrato y las verificaciones relevantes ejecutadas pasan;
- `PASS PARCIAL` — lo comprobado cumple, pero queda una validación importante no ejecutable;
- `BLOCKED` — falta una base, dependencia o evidencia necesaria para decidir;
- `FAIL` — existe al menos un incumplimiento confirmado que impide aprobar.

Un bloqueo ambiental no convierte automáticamente el código en FAIL. Un build exitoso tampoco demuestra por sí solo que el comportamiento sea correcto.

## 7. Entregar

Presentar en este orden:

1. Veredicto.
2. Hallazgos, de mayor a menor severidad.
3. Criterios de aceptación comprobados.
4. Comandos ejecutados y resultados reales.
5. Verificaciones no ejecutadas y motivo.
6. Riesgo residual.
7. Confirmación de que no se modificaron archivos.

Si no hay hallazgos, decirlo explícitamente y mencionar cualquier límite de la revisión.
