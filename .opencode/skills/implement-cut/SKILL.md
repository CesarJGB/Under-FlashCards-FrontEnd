---
name: implement-cut
description: Implementa una fase o corte técnico previamente definido en Under Flashcards, respetando estrictamente su alcance, documentación autoritativa, criterios de aceptación y verificaciones. Úsala cuando el usuario solicite implementar un corte, fase, migración delimitada o plan ya aprobado.
compatibility: opencode
metadata:
  project: under-flashcards
  workflow: implementation
---

# Implement Cut

Implementa exclusivamente el corte o fase solicitado. No adelantes trabajo perteneciente a cortes posteriores.

## 1. Establecer la base

Antes de editar:

- Lee el `AGENTS.md` del repositorio.
- Ejecuta `git status --short`.
- Registra el HEAD efectivo con `git rev-parse HEAD`.
- Si el usuario proporcionó un HEAD esperado, compáralo con el HEAD efectivo.
- Identifica cambios existentes en el árbol de trabajo.
- Preserva cualquier cambio ajeno a la tarea.
- No uses comandos destructivos para limpiar el repositorio.
- Si existe drift que afecta los archivos del corte, detente y explícalo con evidencia.

## 2. Extraer el contrato del corte

Identifica explícitamente:

- objetivo;
- alcance autorizado;
- archivos o componentes afectados;
- elementos fuera de alcance;
- criterios de aceptación;
- documentación autoritativa;
- verificaciones requeridas;
- autorización o prohibición de commit y push.

Si falta información no esencial, investígala en el repositorio.

Pregunta al usuario solamente cuando una decisión ausente pueda cambiar materialmente el resultado o ampliar el alcance.

## 3. Investigar antes de editar

Antes de modificar código:

- Lee completa la documentación que el encargo declare obligatoria.
- Lee la implementación actual relevante.
- Busca consumidores, importaciones, pruebas y contratos relacionados.
- Comprueba cualquier supuesto mediante código, documentación, pruebas o logs.
- Distingue hechos verificados de inferencias.
- Explica brevemente la estrategia de implementación antes de editar.

No repitas auditorías ya cerradas salvo que exista drift relevante o nueva evidencia.

## 4. Implementar

Durante la implementación:

- Realiza el cambio cohesivo más pequeño que cumpla el contrato.
- Mantente dentro del corte solicitado.
- No implementes funciones de cortes posteriores.
- No realices refactors, migraciones ni limpiezas no solicitadas.
- No agregues dependencias salvo que sean imprescindibles y estén autorizadas.
- Conserva contratos y comportamiento existente fuera del cambio solicitado.
- Lee cada archivo antes de modificarlo.
- Busca consumidores antes de mover, renombrar o eliminar código.
- No modifiques pruebas únicamente para obtener un resultado verde.
- Si una prueba describe un contrato antiguo, demuestra primero cuál es el contrato vigente.
- No repitas exactamente un comando que acaba de fallar.
- Después de tres fallos por el mismo bloqueo, detente y presenta la evidencia.

## 5. Verificar

Ejecuta primero las comprobaciones más estrechamente relacionadas con el cambio.

Cuando corresponda:

- pruebas unitarias enfocadas;
- pruebas de contrato;
- build del paquete afectado;
- suites más amplias justificadas por el alcance.

No ejecutes benchmarks que consuman tokens, pruebas con servicios externos o comandos que requieran credenciales sin autorización explícita.

Antes de finalizar ejecuta:

```text
git diff --check
git status --short
git diff --stat
```

Después revisa el diff completo de todos los archivos modificados por el corte.

No declares PASS si:

- una verificación requerida no pudo ejecutarse;
- una prueba relevante falla;
- el comportamiento solicitado no fue comprobado;
- existe drift conflictivo;
- quedan cambios fuera del alcance.

En esos casos utiliza PASS PARCIAL, BLOCKED o FAIL y explica el motivo exacto.

## 6. Git

- No hagas commit ni push salvo solicitud explícita.
- Si el usuario autoriza commit, incluye únicamente archivos del corte.
- Antes de cualquier push, confirma la rama, el diff y los archivos incluidos.
- Nunca uses `git reset --hard`, `git clean` ni operaciones destructivas para resolver drift.

## 7. Entrega

La respuesta final debe incluir:

- estado: PASS, PASS PARCIAL, BLOCKED o FAIL;
- HEAD base efectivo;
- resumen de lo implementado;
- lista completa de archivos modificados;
- verificaciones ejecutadas y resultados reales;
- verificaciones no ejecutadas y motivo;
- riesgos o comportamiento no verificado;
- estado de commit y push.

No afirmes resultados que no estén respaldados por comandos o evidencia observada.
