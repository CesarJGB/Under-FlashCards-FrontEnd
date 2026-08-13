---
description: Revisa un cambio de Under Flashcards sin editar y emite un veredicto con evidencia
agent: deepseek-reviewer
subtask: false
---

Carga la skill `review-diff` antes de realizar cualquier análisis o acción.

Revisa el siguiente cambio o corte de Under Flashcards:

$ARGUMENTS

No modifiques archivos ni implementes correcciones. Fija la base de comparación, reconstruye el contrato, inspecciona el diff completo, ejecuta las verificaciones deterministas pertinentes y entrega el veredicto definido por la skill.

Si la base o el alcance son materialmente ambiguos, responde `BLOCKED` y solicita solamente la información necesaria para poder revisar.
