# Cambios IA y resultados de pruebas

Documento de seguimiento de la primera optimización del pipeline de generación de mazos con IA.

## Objetivo inicial

El pipeline original hacía dos llamadas a DeepSeek por cada lote:

1. Generación de tarjetas preliminares.
2. Auditoría y corrección de esas tarjetas.

Esto provocaba dos rondas de red, reenviaba el mismo segmento de texto al proveedor y duplicaba gran parte de los tokens de entrada. El objetivo fue fusionar ambas etapas en una única llamada manteniendo:

- Generación basada exclusivamente en el texto fuente.
- Una idea por tarjeta.
- Preguntas recuperables y respuestas autocontenidas.
- Validación estricta del JSON.
- Exactamente la cantidad de tarjetas solicitada por lote.
- SSE para mostrar progreso.
- Reintentos, timeout, locks, recuperación y persistencia atómica.

## Primeros cambios implementados

### Servicio combinado

Archivo:

```text
backend/src/services/aiService.js
```

Se creó `generateAndAuditBatch(segment, targetCount, apiKey, context)`.

Características:

- Usa una sola llamada a `deepseek-chat`.
- Usa `temperature: 0.3`.
- Usa `response_format: { type: "json_object" }`.
- Calcula un margen interno de candidatas con `ceil(targetCount * 1.3)`.
- Pide al modelo generar y auditar internamente las candidatas.
- Devuelve únicamente `targetCount` tarjetas.
- Rechaza respuestas con JSON inválido.
- Rechaza cantidades incorrectas.
- Rechaza preguntas o respuestas vacías.
- Mantiene los errores de red, timeout, respuestas truncadas y reintentos de `callDeepSeekJson`.
- Conserva la metadata de request, intentos y uso de tokens.

La estructura esperada por el modelo es:

```json
{
  "cards": [
    {
      "question": "Pregunta",
      "answer": "Respuesta"
    }
  ]
}
```

### Controlador V2

Archivo:

```text
backend/src/controllers/flashcardController.js
```

La lógica original se convirtió en un orquestador compartido que puede trabajar en dos modos:

- V1: `generateRawCards` seguido de `criticizeAndRefineCards`.
- V2: `generateAndAuditBatch` en una sola llamada.

El modo V2 conserva:

- Locks renovables del mazo.
- Límite de concurrencia por solicitud.
- Límite de concurrencia global.
- Recuperación de lotes fallidos.
- Abort y limpieza de tarjetas insertadas.
- Selección distribuida entre segmentos del documento.
- Estilos globales del lote.
- Persistencia final mediante `insertMany`.

Los eventos SSE existentes se mantienen:

- `progress`
- `complete`
- `error`

En V2, `generated` y `audited` representan el mismo resultado porque la auditoría se ejecuta dentro de la misma llamada al modelo.

### Nueva ruta

Archivo:

```text
backend/src/routes/flashcardRoutes.js
```

Ruta añadida:

```http
POST /api/flashcards/generate-ai-v2
```

La ruta usa el middleware `protect` y conserva el mismo contrato de entrada y de SSE que el endpoint anterior.

El endpoint antiguo continúa disponible para rollback y comparación:

```http
POST /api/flashcards/generate-ai
```

### Activación en producción

Archivo:

```text
frontend/src/components/FlashcardCreator.jsx
```

El frontend usa V2 por defecto:

```text
/api/flashcards/generate-ai-v2
```

El modo antiguo puede activarse temporalmente durante un rollback mediante:

```bash
VITE_AI_GENERATION_MODE=v1
```

Si `VITE_AI_GENERATION_MODE` no está definido, se utiliza V2.

### Benchmark A/B

Archivo:

```text
backend/test/benchmarkV2.js
```

El benchmark:

- Busca el primer PDF en `/home/ubuntu/test-fixtures`.
- Extrae el texto con `pdf-parse`.
- Permite seleccionar un usuario concreto mediante `--user-id`.
- Usa `ALLOW_DEV_USER_ID=true` sólo para la prueba local.
- Crea mazos temporales.
- Ejecuta V1 y V2 con el mismo texto.
- Mide tiempo total y tokens reportados por DeepSeek.
- Comprueba las tarjetas realmente persistidas.
- Elimina los mazos y tarjetas temporales al finalizar.
- Alterna el orden de ejecución para reducir sesgo del proveedor.

Comando usado:

```bash
cd backend
npm run benchmark:ai-v2 -- --user-id <USER_ID> --port 8022
```

La dependencia `pdf-parse` se añadió a `backend/package.json` y `backend/package-lock.json`.

## Primera prueba A/B: 60 tarjetas

Datos de la prueba:

- PDF: `Farma EsmeNotas Act20Ene26.pdf`.
- Texto extraído: `336.627` caracteres.
- Objetivo: 60 tarjetas.
- Una ejecución para cada método.
- DeepSeek real, MongoDB real y SSE real.

| Versión | Tiempo total | Tokens totales | Tarjetas aceptadas |
| --- | ---: | ---: | ---: |
| Antigua, generación + auditoría | 18,178 s | 262.516 | 60 |
| Nueva V2, generación y auditoría combinadas | 13,078 s | 126.229 | 60 |

Resultados calculados:

- Reducción de tiempo: `28,06%`.
- Aceleración aproximada: `1,39x`.
- Reducción de tokens: `51,92%`.
- Tokens antiguos por tarjeta: aproximadamente `4.375`.
- Tokens V2 por tarjeta: aproximadamente `2.104`.

## Segunda prueba A/B: cuatro repeticiones con 100 tarjetas

Datos de la prueba:

- PDF: `Farma EsmeNotas Act20Ene26.pdf`.
- Texto extraído: `336.627` caracteres.
- Objetivo: 100 tarjetas por ejecución.
- Cuatro ejecuciones para V1.
- Cuatro ejecuciones para V2.
- Orden alternado entre métodos.
- DeepSeek real, MongoDB real y SSE real.

### Resultados por ejecución

| Prueba | V1 tiempo | V1 tokens | V2 tiempo | V2 tokens |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 29,600 s | 272.221 | 17,982 s | 129.292 |
| 2 | 30,479 s | 272.760 | 17,738 s | 129.991 |
| 3 | 31,149 s | 272.713 | 21,419 s | 130.313 |
| 4 | 30,317 s | 273.213 | 17,891 s | 129.846 |

Las ocho ejecuciones persistieron 100 tarjetas cada una.

### Resumen estadístico

| Métrica | V1 | V2 |
| --- | ---: | ---: |
| Tiempo promedio | 30,386 s | 18,758 s |
| Mediana de tiempo | 30,398 s | 17,937 s |
| Tiempo mínimo | 29,600 s | 17,738 s |
| Tiempo máximo | 31,149 s | 21,419 s |
| Tokens promedio | 272.727 | 129.861 |
| Tokens acumulados | 1.090.907 | 519.442 |
| Tarjetas promedio | 100 | 100 |
| Corridas que alcanzaron el objetivo | 4/4 | 4/4 |

Resultados calculados:

- Reducción media de tiempo: `38,27%`.
- Aceleración aproximada: `1,62x`.
- Reducción media de tokens: `52,38%`.
- Tokens ahorrados en las cuatro repeticiones: `571.465`.
- La ejecución V2 más lenta fue de `21,419 s`.
- La ejecución V1 más rápida fue de `29,600 s`.

## Conclusiones

### Coste

La optimización cumplió el objetivo principal de tokens. En las pruebas de 100 tarjetas, V2 utilizó aproximadamente un `52,38%` menos tokens que V1.

Si el precio por token del modelo se mantiene igual, el coste variable de generación debería reducirse aproximadamente en la misma proporción.

### Latencia

La latencia mejoró de forma consistente, aunque no se redujo exactamente a la mitad.

En la prueba con cuatro repeticiones:

- V1 tardó aproximadamente 30,4 segundos por ejecución.
- V2 tardó aproximadamente 18,8 segundos por ejecución.
- El ahorro medio fue de aproximadamente 11,6 segundos por ejecución.

La ejecución V2 de 21,419 segundos muestra cierta variabilidad normal del proveedor, pero permaneció por debajo de todas las ejecuciones V1.

### Cantidad y persistencia

V1 y V2 alcanzaron el objetivo solicitado en todas las pruebas:

- 60 de 60 en la primera comparación.
- 100 de 100 en cada una de las ocho repeticiones posteriores.

No quedaron mazos ni tarjetas temporales después de las pruebas.

### Calidad pedagógica

La prueba confirma que V2 puede alcanzar la misma cantidad final y pasar las validaciones de formato. Sin embargo, el benchmark no mide por sí solo:

- Corrección factual.
- Calidad pedagógica.
- Cobertura conceptual.
- Dificultad de las preguntas.
- Duplicados semánticos.
- Equivalencia entre las tarjetas V1 y V2.

Para validar la calidad con mayor rigor habría que guardar muestras de ambos resultados y evaluarlas mediante una rúbrica humana o un evaluador independiente.

## Verificaciones técnicas

Después de los cambios se ejecutó:

```bash
cd backend
npm test
```

Resultado:

```text
19 pruebas aprobadas
0 fallos
```

También se ejecutó el build de producción del frontend:

```bash
cd frontend
npm run build
```

Resultado:

```text
Build completado correctamente
```

Vite mostró únicamente el warning informativo existente sobre algunos chunks mayores de 500 kB.

## Estado de Git

Commit de activación de V2:

```text
c5650b8 feat(ai): enable combined deck generation
```

El commit fue subido mediante SSH a `origin/main`.
