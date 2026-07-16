# Resultados del benchmark de generación IA

## Alcance y control experimental

- PDF usado: `/home/ubuntu/test-fixtures/Farma EsmeNotas Act20Ene26.pdf`.
- Se procesaron las 78 de 78 páginas y se extrajeron 340,340 caracteres en cada corrida.
- Se utilizó el documento completo, sin selección de páginas.
- Objetivo fijo: 520 tarjetas finales. El plan generó 600 candidatas en cada corrida.
- Cada corrida creó un mazo temporal, comprobó que se hubieran persistido 520 tarjetas y lo eliminó al finalizar.
- El benchmark usa el endpoint real, SSE, MongoDB y DeepSeek. No usa mocks para la generación ni para la auditoría.

## Artefactos guardados

Los logs completos y los eventos aislados `run_completed` se encuentran en `test_reports/ai-benchmark/`:

- `run-1.server.log`, `run-2.server.log`, `run-3.server.log`: telemetría completa del servidor.
- `run-1.run_completed.log`, `run-2.run_completed.log`, `run-3.run_completed.log`: evento `run_completed` exacto de cada corrida.
- `run-*.client.jsonl`: eventos SSE del cliente de benchmark.
- `run-*.summary.json`: resumen de cada corrida, incluidos el objetivo, las páginas y el conteo de tarjetas persistidas.

## Comparativa

| Corrida | Configuración activa | Tiempo total | Aceptadas | Chunks / lotes / olas | Concurrencia | Tokens totales | Rechazo de auditoría / correcciones |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Baseline, lote 12 | 162.986 s | 520/600, 86.7% | 52 / 52 / 18 | 3 | 341,859 | 8, 1.3% / 25, 4.2% |
| 2 | Concurrencia 4, lote 12 | 118.315 s | 520/600, 86.7% | 52 / 52 / 13 | 4 | 342,482 | 9, 1.5% / 15, 2.5% |
| 3 | Concurrencia 4, experimento lote 20 | 149.467 s | 520/600, 86.7% | 31 / 31 / 8 | 4 | 353,941 | 7, 1.2% / 10, 1.7% |

La tasa `accepted/generated` es 86.7% en las tres corridas, pero no representa solamente rechazos de auditoría. El selector final limita el resultado a 520 tarjetas:

- Corrida 1: la auditoría rechazó 8; 72 candidatas válidas quedaron fuera por llegar al objetivo de 520.
- Corrida 2: la auditoría rechazó 9; 71 candidatas válidas quedaron fuera por el mismo límite.
- Corrida 3: la auditoría rechazó 7; 73 candidatas válidas quedaron fuera por el mismo límite.

## Corrida 1: baseline

- Configuración efectiva: `AI_DECK_CONCURRENCY=3`, `AI_DECK_BATCH_SIZE=12` y `AI_SOURCE_CHUNK_MAX_CHARS=60000`.
- Promedio nominal por chunk: `340340 / 52 = 6545` caracteres. Los chunks emitidos promediaron 6,543.8 caracteres por el recorte de espacios en los bordes.
- Uso del límite de 60,000 caracteres: 10.9%. Cada chunk dejó aproximadamente 53,455 caracteres de capacidad sin usar.
- Hubo 52 lotes. Con concurrencia 3, `52 / 3 = 17.33`, por lo que se necesitaron 18 olas de procesamiento.
- Se hicieron 104 solicitudes al proveedor: 52 de generación y 52 de auditoría. Sus duraciones medias fueron 4.672 s y 4.543 s, respectivamente.
- Las 25 tarjetas con estado `corregida` procedieron de la auditoría remota. No hubo una tercera solicitud por tarjeta corregida ni una corrección local: todos los lotes reciben una llamada de auditoría de todos modos.
- No hubo errores, retries, `429`, lotes fallidos ni corridas fallidas. Las 104 solicitudes iniciadas fueron exitosas.

### Decisión posterior

Se elevó solamente la concurrencia predeterminada de 3 a 4. Era la mejora de menor riesgo y mayor impacto esperado: reducir las olas de 18 a 13 sin aumentar el contexto ni el número de solicitudes.

## Corrida 2: concurrencia 4

- Se mantuvieron 52 chunks de 6,545 caracteres nominales, equivalentes a 10.9% del límite de 60,000.
- Los 52 lotes con concurrencia 4 completaron 13 olas.
- El tiempo bajó de 162.986 s a 118.315 s: 44.671 s menos, una mejora de 27.4%.
- Los tokens cambiaron de 341,859 a 342,482: 623 tokens adicionales, 0.18%.
- La aceptación final se mantuvo en 86.7%; hubo 15 correcciones.
- No hubo errores, retries ni `429`: las 104 solicitudes iniciadas fueron exitosas.

### Decisión posterior

No se aplicó un empaquetado ingenuo de chunks hacia 60,000 caracteres. Con la implementación actual, reducir sólo la cantidad de chunks no reduce necesariamente las llamadas: `buildGenerationBatches` exige al menos `ceil(candidateTarget / batchSize)` tareas para obtener las 600 candidatas. Empaquetar segmentos grandes sin rediseñar esa relación repetiría más contexto por llamada y aumentaría costo y latencia.

En su lugar se probó un único cambio nuevo: elevar temporalmente `AI_DECK_BATCH_SIZE` de 12 a 20. El objetivo era reducir lotes y olas sin cambiar la meta de 600 candidatas.

## Corrida 3: lote 20

- Los chunks y lotes se redujeron de 52 a 31.
- Promedio nominal por chunk: `340340 / 31 = 10978.7` caracteres, 18.3% del límite de 60,000.
- Los chunks emitidos estuvieron entre 9,278 y 11,341 caracteres, una distribución más uniforme que la baseline.
- Con concurrencia 4 se necesitaron 8 olas: `31 / 4 = 7.75`.
- Las solicitudes al proveedor se redujeron de 104 a 62.
- Los prompt tokens bajaron de 275,323 a 266,290, pero los completion tokens subieron de 67,159 a 87,651.
- La corrida empeoró de 118.315 s a 149.467 s, un aumento de 26.3% frente a la corrida 2.

### Causa de la regresión

La distribución de 600 candidatas entre 31 lotes produjo 11 lotes de 20 tarjetas y 20 lotes de 19. Los lotes de 20 activaron `AI_REASONER_THRESHOLD=20`, por lo que su auditoría cambió automáticamente de `deepseek-chat` a `deepseek-reasoner`.

- Auditorías `deepseek-reasoner`: 11 llamadas, 22.425 s de media.
- Auditorías `deepseek-chat`: 20 llamadas, 6.416 s de media.
- La activación del razonador explica el incremento de completion tokens de 30.5% y la regresión del tiempo total.
- No hubo errores, retries ni `429`: las 62 solicitudes iniciadas fueron exitosas.

El cambio de lote 20 fue revertido después de la corrida. No se deja una regresión de rendimiento como configuración predeterminada.

## Cambio retenido

El único cambio de rendimiento retenido es elevar la concurrencia predeterminada:

- `backend/src/controllers/flashcardController.js`: `AI_DECK_CONCURRENCY` cambia de 3 a 4.
- `README.md`: documenta el nuevo valor predeterminado de 4.
- `AI_DECK_BATCH_SIZE` permanece con predeterminado 12.

El cambio de concurrencia fue el de mayor impacto positivo: redujo el tiempo 27.4%, mantuvo la tasa de aceptación y no causó rate limits ni aumento material de tokens.

## Problemas y riesgos detectados

- El estimado de lotes del padding no representa exactamente los lotes reales. La baseline estimó 50 y produjo 52; con lote 20 estimó 30 y produjo 31.
- El chunker sigue lejos del límite de 60,000 caracteres. Incluso la corrida con lote 20 sólo llegó a 18.3% de uso. Resolverlo correctamente requiere desacoplar tamaño de contexto y distribución de candidatas por tarea.
- `AI_DECK_BATCH_SIZE=20` y `AI_REASONER_THRESHOLD=20` introducen un cambio silencioso de modelo con impacto alto de tiempo y tokens.
- La baseline tenía chunks entre 2,657 y 6,806 caracteres. El último chunk pequeño recibía una cuota de tarjetas similar a chunks mucho mayores, lo que puede producir cobertura desigual.
- El servidor emitió una advertencia deprecada de Mongoose sobre `new: true`. No interrumpió ninguna corrida.
- PDF.js emitió dos advertencias de CMap durante la extracción de benchmark. Aun así, se extrajeron las 78 páginas y no hubo pérdida de texto.

## Siguiente prueba recomendada

La siguiente prueba acotada debería elevar `AI_REASONER_THRESHOLD` a 21, o garantizar lotes de 19 como máximo, para impedir que un lote de 20 tarjetas active involuntariamente `deepseek-reasoner`. Esto aislaría la regresión observada en la tercera corrida.

Para acercarse a una referencia de aproximadamente 30 segundos, la palanca estructural posterior es consolidar generación y auditoría en una sola llamada remota, con validación local de formato y duplicados, o con auditoría por muestreo. La auditoría actual agrega una segunda vuelta de red por cada lote y constituye una parte sustancial de la latencia.

## Reproducción y verificación

Se agregó `backend/scripts/benchmarkAiDeck.js` y el comando:

```bash
cd backend
npm run benchmark:ai -- run-1 8011
```

El ejecutor inicia un servidor temporal en el puerto indicado, extrae el PDF con la lógica de PDF.js usada por el frontend, consume el SSE real, guarda los logs y limpia el mazo de prueba al finalizar.

Verificaciones ejecutadas:

- `npm test`: 10 pruebas aprobadas.
- `node --check scripts/benchmarkAiDeck.js`: correcto.
- Se validó que los tres eventos `run_completed` existen, usan 340,340 caracteres y registran 520 tarjetas creadas.
- Los servidores temporales de los puertos 8011, 8012 y 8013 fueron detenidos al finalizar.
