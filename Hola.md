# Dossier de generacion de mazos con IA

Este documento describe el metodo actual de generacion de flashcards con IA, sus contratos, evidencia disponible, riesgos y la informacion que necesitara otra IA para proponer mejoras robustas. No contiene secretos, claves API ni valores privados de produccion.

## Contexto para otra IA

```text
Estoy mejorando un pipeline de generacion de flashcards con IA para una aplicacion React + Node/Express + MongoDB.

Objetivo funcional:
- El usuario pega apuntes o extrae texto de un PDF localmente.
- Solicita N flashcards en espanol para un mazo propio.
- Las tarjetas deben basarse exclusivamente en la fuente, ser pedagogicas, no duplicadas y guardarse solo si se alcanza la cantidad solicitada.
- El usuario aporta su propia clave de DeepSeek (BYOK).

Pipeline actual:
1. El frontend recibe texto manual o extraido de PDF en el navegador.
2. Envia POST /api/flashcards/generate-ai mediante SSE.
3. El backend autentica con un Google ID Token y verifica que el mazo pertenece al usuario.
4. Se calcula un margen de candidatas adicional para absorber rechazos de auditoria.
5. El texto se fragmenta por marcadores de pagina, parrafos, frases o espacios.
6. Cada lote hace dos llamadas a DeepSeek:
   - Generacion: crea exactamente N candidatas desde un segmento.
   - Auditoria: valida cada candidata contra el mismo segmento y responde con estado sin_cambios, corregida, fusionada o eliminada.
7. El backend descarta eliminadas/fusionadas, elimina duplicados exactos de pregunta+respuesta, reparte la seleccion final entre segmentos y persiste de una vez las tarjetas finales.
8. Si no se alcanza la cantidad final, responde error 422 y no guarda tarjetas.
9. El frontend muestra progreso SSE y recarga el mazo al terminar.

Quiero una revision tecnica que:
- Distinga hechos demostrables en el codigo de hipotesis.
- Priorice seguridad, consistencia, coste, disponibilidad y calidad pedagogica.
- Proponga mejoras incrementales compatibles con la arquitectura actual antes de recomendar una reescritura.
- Disene una evolucion a jobs durables, idempotentes y cancelables si esta justificada.
- Incluya cambios de modelo, API, validaciones, observabilidad, pruebas y plan de despliegue.
- Defina metricas de exito y experimentos comparables antes de modificar prompts, modelos o concurrencia.
- Preserve la generacion basada en fuente, en espanol, con trazabilidad y evitando persistencias parciales.

Entrega esperada:
1. Riesgos ordenados por impacto y probabilidad, con causa tecnica concreta.
2. Arquitectura objetivo minima y arquitectura escalable.
3. Lista de cambios por archivo/modelo/ruta.
4. Contratos HTTP/SSE y estados de un job de generacion.
5. Estrategia de calidad de tarjetas y revision humana.
6. Pruebas unitarias, integracion, E2E y de carga.
7. Metricas, alertas, limites de coste y plan de rollout/rollback.
```

## Objetivo y alcance

- Generar tarjetas de estudio en espanol a partir de apuntes, lecturas o texto extraido de PDF.
- Limitar la generacion a mazos propiedad del usuario autenticado.
- Mantener una meta exacta de tarjetas finales: si no se alcanza tras la auditoria y recuperacion, no se persiste ningun resultado.
- Usar una clave DeepSeek aportada por cada usuario.
- Ofrecer progreso de larga duracion mediante Server-Sent Events (SSE).

La generacion de mazos es independiente de otras funcionalidades de IA del proyecto, como la generacion de preguntas de examenes.

## Estado actual

| Area | Implementacion |
| --- | --- |
| Entrada | Texto manual o PDF procesado en el navegador; maximo 600.000 caracteres. |
| Proveedor | DeepSeek Chat Completions. |
| Generacion | `deepseek-chat`, temperatura `0.3`, JSON estricto, sin Markdown. |
| Auditoria | `deepseek-chat`, temperatura `0.1`; cambia a `deepseek-reasoner` desde 20 tarjetas por lote. |
| Validacion | JSON valido, campos exactos, strings no vacios, cantidad exacta y estados permitidos. |
| Resiliencia | Timeout de 90 s por llamada, hasta 3 reintentos exponenciales con jitter para errores recuperables. |
| Persistencia | `insertMany` solo tras cumplir la meta; intenta limpiar tarjetas insertadas si se aborta despues. |
| Progreso | SSE con etapas, conteos generados/auditados/aceptados, `runId` y metricas. |
| Concurrencia | Maximo 4 lotes por generacion y 4 globales por proceso Node. |
| Calidad | Auditoria por lote, deduplicacion textual exacta y reparto de seleccion entre fragmentos. |

## Puntos de entrada

1. El usuario inicia sesion con Google. El frontend mantiene temporalmente el Google ID Token en `user.authToken`.
2. En Ajustes puede guardar su clave de DeepSeek con `PUT /api/user/settings`.
3. En un mazo editable, abre el creador de tarjetas y selecciona la pestana IA.
4. Puede pegar texto o abrir el extractor de PDF. PDF.js extrae el texto localmente y agrega marcadores como `--- [Texto de la Pagina N] ---`.
5. El formulario envia el texto, el identificador del mazo, cantidad solicitada y estilos al endpoint de generacion.
6. La interfaz consume el SSE, muestra progreso y recarga el mazo cuando recibe el evento `complete`.

Archivos frontend relevantes:

- `frontend/src/components/FlashcardCreator.jsx`: seleccion de modo IA, envio de la solicitud y visualizacion de progreso.
- `frontend/src/components/creator/FormInputs.jsx`: entrada de texto, limite de 600.000 caracteres, cantidad y carga diferida del extractor PDF.
- `frontend/src/components/creator/PdfExtractor.jsx`: extraccion local de texto desde PDF y seleccion de paginas.
- `frontend/src/lib/aiProgressStream.js`: parser de eventos SSE.

## Contrato HTTP y SSE

### Solicitud

```http
POST /api/flashcards/generate-ai
Authorization: Bearer <Google ID token>
Accept: text/event-stream
Content-Type: application/json
```

```json
{
  "deckId": "id-del-mazo",
  "text": "Apuntes o texto extraido del PDF",
  "count": 15,
  "batchStyles": {
    "bgImage": "opcional",
    "textAlign": "center",
    "fontSize": "text-base"
  }
}
```

El frontend tambien incluye `userId`, pero el controlador de IA usa `req.user`, derivado del token de Google, para identificar al usuario y validar propiedad del mazo.

### Eventos SSE

Durante la ejecucion se emiten eventos `progress` con los conteos y la etapa actual:

```json
{
  "event": "progress",
  "data": {
    "runId": "deck-xxxxxxxx",
    "stage": "generating | auditing | recovering | completed_batch",
    "generated": 12,
    "audited": 12,
    "accepted": 10,
    "target": 10,
    "total": 13,
    "batch": 1,
    "totalBatches": 2
  }
}
```

El exito se confirma asi:

```json
{
  "event": "complete",
  "data": {
    "runId": "deck-xxxxxxxx",
    "createdCount": 10,
    "target": 10,
    "metrics": {}
  }
}
```

Los fallos despues de abrir el stream se envian como evento `error`:

```json
{
  "event": "error",
  "data": {
    "runId": "deck-xxxxxxxx",
    "error": "Mensaje seguro para el usuario"
  }
}
```

Antes de iniciar SSE, el endpoint puede devolver errores HTTP JSON convencionales:

| Estado | Situacion |
| --- | --- |
| `401` | Token ausente, invalido o expirado. |
| `400` | Texto vacio, texto mayor al limite, clave ausente o configuracion invalida. |
| `404` | Mazo inexistente o no perteneciente al usuario. |
| `422` | No se alcanzaron suficientes tarjetas validas despues de recuperacion. |
| `502` | Error no especifico del proveedor. |

## Pipeline de datos

1. El backend valida que exista texto, aplica el limite de 600.000 caracteres y verifica que el usuario tiene una clave API configurada.
2. Busca el mazo por `_id` y `userId` del usuario autenticado.
3. Normaliza la cantidad al intervalo de `1` a `AI_MAX_CARDS`.
4. Calcula tarjetas candidatas adicionales mediante una politica de padding. El valor por defecto es 30% del objetivo, con un maximo de 20 candidatas adicionales.
5. Fragmenta el texto procurando cortar por marcadores de pagina, parrafos, frases y espacios. Cada segmento tiene un maximo configurable de caracteres.
6. Crea lotes de hasta `AI_DECK_BATCH_SIZE` tarjetas. Si hay mas segmentos que tarjetas candidatas, garantiza al menos una candidata por segmento para no ignorar el final del documento.
7. Registra un `runId` y agrega un lock renovable en el mazo para impedir su eliminacion durante la ejecucion.
8. Procesa lotes en paralelo, limitado por concurrencia por solicitud y concurrencia global del proceso.
9. Para cada lote llama al modelo generador y luego al modelo auditor, usando solo el segmento de ese lote como fuente.
10. Acepta tarjetas con estado `sin_cambios` o `corregida`; descarta `eliminada` y `fusionada`.
11. Elimina duplicados exactos, normalizando espacios y mayusculas/minusculas de pregunta y respuesta.
12. Selecciona tarjetas de forma repartida entre los segmentos para cubrir el documento.
13. Si hay menos de la meta solicitada, falla sin insertar tarjetas.
14. Si hay suficientes, agrega el fondo global si aplica y persiste las tarjetas seleccionadas mediante un solo `insertMany`.
15. Emite `complete` por SSE, libera el lock y el frontend recarga el mazo.

## Prompts y proveedor

### Generacion

El prompt actual indica al modelo que es un procesador educativo de alta precision. Exige exactamente la cantidad solicitada de flashcards en espanol, basadas exclusivamente en el segmento recibido, con ideas concretas y sin inventar informacion.

El formato exigido es:

```json
{
  "cards": [
    {
      "question": "Pregunta de texto plano",
      "answer": "Respuesta de texto plano"
    }
  ]
}
```

No permite Markdown, explicaciones ni claves adicionales.

### Auditoria

El segundo prompt trata al modelo como auditor academico. Recibe el segmento fuente y las tarjetas preliminares. Debe devolver una salida por cada tarjeta recibida, manteniendo pregunta y respuesta e incluyendo uno de estos estados:

- `sin_cambios`
- `corregida`
- `fusionada`
- `eliminada`

Debe corregir ambiguedades o datos incompatibles con la fuente, marcar tarjetas redundantes como fusionadas y tarjetas inventadas o falsas como eliminadas. No devuelve explicaciones ni razonamientos globales.

### Parametros actuales

| Variable | Predeterminado | Rango o efecto |
| --- | ---: | --- |
| `AI_MAX_CARDS` | 100 | 1 a 1000 tarjetas finales. |
| `AI_MAX_RAW_CARDS` | maximo final + 20, minimo 120 | Limite de candidatas previas a auditoria. |
| `AI_SOURCE_CHUNK_MAX_CHARS` | 60.000 | 8.000 a 60.000 caracteres por segmento. |
| `AI_DECK_BATCH_SIZE` | 12 | 1 a 20 candidatas por lote. |
| `AI_DECK_CONCURRENCY` | 4 | 1 a 4 lotes paralelos por solicitud. |
| `AI_GLOBAL_DECK_CONCURRENCY` | 4 | 1 a 8 lotes paralelos por proceso. |
| `AI_TARGET_PADDING_FACTOR` | 0,30 | Margen proporcional de candidatas. |
| `AI_TARGET_PADDING_MAX` | 20 | Margen absoluto maximo. |
| `AI_BATCH_RECOVERY_ATTEMPTS` | 1 | Pasadas de recuperacion para lotes fallidos. |
| `AI_REASONER_THRESHOLD` | 20 | Desde esta cantidad, auditoria usa `deepseek-reasoner`. |
| `AI_REQUEST_TIMEOUT_MS` | 90.000 | Timeout por llamada al proveedor. |
| `AI_MAX_RETRIES` | 3 | Reintentos de errores recuperables. |

`AI_DECK_GENERATION_MAX_TOKENS` y `AI_DECK_AUDIT_MAX_TOKENS` tienen por defecto 4096 tokens y estan acotados entre 512 y 16384.

## Validaciones, reintentos y errores

- La respuesta HTTP del proveedor debe ser exitosa y tener JSON valido.
- El modelo debe devolver una opcion, finalizar con `stop` y no una salida truncada por longitud.
- El contenido devuelto debe ser un objeto JSON con `cards`.
- Cada tarjeta debe contener exactamente los campos permitidos.
- Pregunta y respuesta deben ser strings no vacios.
- Generacion y auditoria deben devolver exactamente la cantidad esperada por lote.
- Los errores `408`, `429` y `5xx`, respuestas invalidas, respuestas truncadas y timeouts se consideran recuperables.
- Los reintentos usan espera exponencial, jitter y respetan `Retry-After` cuando el proveedor lo informa.
- Los mensajes mostrados al usuario no exponen detalles sensibles del proveedor.

## Evidencia de rendimiento

Existe un benchmark real en `resultados.md`. Usa un PDF de 78 paginas, 340.340 caracteres, SSE, MongoDB y DeepSeek. No usa mocks para la generacion ni auditoria.

| Corrida | Configuracion | Tiempo total | Aceptadas | Lotes | Concurrencia | Tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Lote 12 | 162,986 s | 520/600 | 52 | 3 | 341.859 |
| 2 | Lote 12 | 118,315 s | 520/600 | 52 | 4 | 342.482 |
| 3 | Lote 20 | 149,467 s | 520/600 | 31 | 4 | 353.941 |

Hallazgos verificables del benchmark:

- Subir la concurrencia de 3 a 4 redujo el tiempo aproximadamente un 27,4% sin causar `429`, reintentos ni aumento material de tokens.
- Aumentar el lote a 20 redujo solicitudes, pero empeoro la latencia un 26,3% respecto a la corrida 2.
- La regresion ocurrio porque los lotes de 20 activaron automaticamente `deepseek-reasoner` durante auditoria.
- Las auditorias con `deepseek-reasoner` tuvieron una media de 22,425 s frente a 6,416 s de `deepseek-chat` en ese experimento.
- La auditoria supone una segunda llamada remota para cada lote y representa una parte importante de la latencia total.
- Empaquetar segmentos hasta el maximo de 60.000 caracteres no garantiza menos llamadas con la planificacion actual; puede repetir mas contexto y aumentar coste y latencia.

El benchmark de 520 tarjetas requiere variables de entorno distintas de los valores predeterminados, ya que `AI_MAX_CARDS` por defecto es 100.

## Fortalezas actuales

- El endpoint de IA usa autenticacion y verifica que el mazo pertenece al usuario autenticado.
- El usuario no recibe tarjetas parciales si no se cumple el objetivo final configurado.
- Las respuestas del modelo se validan estrictamente antes de ser aceptadas.
- Hay timeout, reintentos, recuperacion de lotes y limites de concurrencia.
- Se registran `runId`, duraciones, uso de tokens, errores de proveedor y metricas de lote.
- Se procura cubrir todo el documento mediante fragmentacion y seleccion distribuida.
- El PDF se procesa en el dispositivo del usuario antes de enviar su texto al backend.
- El cliente recibe feedback progresivo en lugar de esperar una respuesta larga sin informacion.

## Riesgos y limitaciones

### Seguridad y autorizacion

- El endpoint de generacion esta protegido, pero varias rutas de usuario, mazos y tarjetas no aplican el middleware `protect`.
- `PUT /api/user/settings` acepta `userId` desde el cuerpo sin autenticar la solicitud. Un tercero podria modificar la configuracion de otro usuario si conoce su identificador.
- La clave `aiApiKey` se almacena como string plano en MongoDB. No hay cifrado en reposo, KMS, rotacion ni auditoria de acceso observables en el codigo.
- El endpoint de saldo tambien acepta un `userId` en ruta sin proteccion y permite consultar indirectamente el saldo de la clave configurada por otra persona.

### Concurrencia y consistencia

- El lock de IA protege contra la eliminacion del mazo, pero no impide iniciar dos generaciones simultaneas para ese mismo mazo. La operacion que agrega el lock no filtra locks activos.
- Dos ejecuciones en paralelo pueden duplicar coste y generar tarjetas similares. La deduplicacion es interna a una ejecucion y exacta.
- La concurrencia global es un singleton del proceso Node. No limita ejecuciones globales si el servicio tiene multiples instancias.
- El trabajo no es durable. Un reinicio de proceso o caida de instancia pierde el estado de ejecucion.
- No hay `idempotencyKey`, por lo que un reintento del cliente puede lanzar una segunda ejecucion.
- No se utiliza una transaccion para actualizar fondos del mazo e insertar flashcards.

### Calidad pedagogica y trazabilidad

- Cada lote ve solo su segmento, por lo que el auditor no puede identificar redundancias semanticas entre segmentos.
- La deduplicacion solo compara la igualdad exacta normalizada de pregunta y respuesta. No detecta sinonimos, reformulaciones ni duplicados ya existentes en el mazo.
- `fusionada` se descarta; no queda una relacion entre tarjetas ni se construye una tarjeta fusionada.
- No se guarda pagina de origen, extracto de fuente, `runId`, version de prompt, modelo ni razon de correccion o descarte por tarjeta.
- No existe una validacion factual determinista adicional al segundo modelo.
- No hay revision humana antes de persistir las tarjetas.
- La seleccion distribuida prioriza cobertura, no calidad o relevancia pedagogica medida.
- El fragmentador usa caracteres y delimitadores, no estructura semantica como titulos, secciones, tablas o jerarquia conceptual.

### Privacidad y experiencia de usuario

- Todo el texto de apuntes o PDF se envia a DeepSeek despues de su extraccion local. No hay consentimiento explicito ni configuracion de retencion visible.
- No hay redaccion o deteccion de datos personales, contenido sensible o restricciones de copyright.
- El extractor de PDF puede omitir paginas con error y solo registrar advertencias de consola; la generacion puede continuar con contenido incompleto.
- No hay OCR para PDF escaneado.
- No existe boton de cancelacion ni `AbortController` gestionado por la interfaz para esta solicitud.
- El resumen de calidad, coste y metricas no persiste para el usuario despues de terminar.
- Los errores SSE solo contienen un mensaje y `runId`, sin codigo estructurado, lote o etapa fallida para una recuperacion de UX precisa.

### Configuracion y pruebas

- El frontend permite hasta 500 tarjetas por defecto si falta `VITE_MAX_AI_CARDS`, mientras el backend limita a 100 por defecto. El backend recorta silenciosamente el valor solicitado.
- El cambio automatico de modelo desde 20 tarjetas por lote puede introducir regresiones de coste y latencia sin una decision explicita del usuario.
- Hay pruebas unitarias de servicios, fragmentacion, concurrencia y recuperacion de lotes.
- No se observan pruebas frontend, integracion HTTP/SSE completa, pruebas E2E, pruebas de carreras ni pruebas de recuperacion tras reinicio.

## Mejoras priorizadas

### 1. Seguridad y propiedad de datos

- Aplicar `protect` a todas las rutas que leen o modifican datos de usuario, mazos y tarjetas.
- Derivar siempre el usuario desde `req.user`; no aceptar `userId` de cliente como autoridad de autorizacion.
- Cifrar las claves BYOK en reposo con cifrado autenticado y una clave administrada fuera de MongoDB, idealmente KMS o gestor de secretos.
- Agregar rotacion, eliminacion segura, validacion de clave, auditoria de acceso y procedimiento ante compromiso de una clave.
- Establecer rate limiting, cuota diaria, concurrencia maxima por usuario y limite de coste por ejecucion.

### 2. Jobs durables e idempotentes

- Crear una coleccion `AiGenerationRun` con usuario, mazo, estado, hash del contenido, configuracion, progreso, errores, tokens, coste y timestamps.
- Usar una adquisicion atomica que permita como maximo un job activo por mazo.
- Exigir una `idempotencyKey` en solicitudes de generacion y devolver el mismo job para reintentos equivalentes.
- Mover ejecuciones largas a una cola y worker durable si el despliegue usa varias instancias o necesita sobrevivir reinicios.
- Definir estados `queued`, `running`, `cancelling`, `completed`, `failed` y `cancelled`.
- Exponer `GET /api/ai-runs/:id`, `GET /api/ai-runs/:id/events` y `POST /api/ai-runs/:id/cancel`.

### 3. Cancelacion y recuperacion

- Agregar boton Cancelar en UI y usar `AbortController` para interrumpir el stream.
- Distinguir entre desconexion del navegador y cancelacion solicitada por usuario.
- Decidir si un job continua en segundo plano tras desconexion o se cancela de forma controlada.
- Garantizar limpieza idempotente y recuperacion de locks o trabajos huerfanos.

### 4. Calidad y trazabilidad

- Guardar por flashcard `runId`, hash de fuente, paginas o segmento de origen, modelo, version de prompt, fecha y estado de auditoria.
- Hacer que el auditor devuelva razones estructuradas para correccion, fusion o eliminacion.
- Implementar deduplicacion semantica y comparacion contra tarjetas existentes en el mazo.
- Transformar el estado `fusionada` en una tarjeta consolidada o conservar una relacion explicable entre sus tarjetas origen.
- Presentar un borrador editable antes de persistir, con aprobacion, descarte y regeneracion selectiva.
- Definir una rubrica de calidad: una idea por tarjeta, pregunta recuperable, respuesta autocontenida, longitud maxima, dificultad, nivel cognitivo, ejemplos y tipos de tarjeta permitidos.

### 5. Planificacion del contenido

- Asignar tarjetas por densidad, relevancia y estructura del contenido, no solo de forma uniforme por fragmento.
- Separar el indice global del documento de la generacion por segmentos para disminuir solapamiento y mejorar cobertura.
- Usar titulos, secciones y paginas como limites semanticos cuando existan.
- Mantener una politica explicita para documentos con mas temas que tarjetas solicitadas.
- No aumentar el tamano de segmentos sin benchmark; la evidencia existente indica que fragmentos mayores no son necesariamente mas rapidos ni baratos.

### 6. UX, privacidad y coste

- Mostrar estimacion de tiempo, cantidad de lotes y rango de coste antes de empezar.
- Persistir un resumen final de tarjetas generadas, corregidas, descartadas, duplicadas, tokens, modelo y duracion.
- Pedir consentimiento informado antes de enviar apuntes o documentos a un proveedor externo.
- Avisar cuando el PDF no tenga texto, requiera OCR o tenga paginas con extraccion fallida.
- Establecer politicas de retencion, contenido sensible y derechos de autor.

### 7. Pruebas y observabilidad

- Agregar pruebas de integracion HTTP para autenticacion, autorizacion, SSE, cancelacion, locks e idempotencia.
- Agregar pruebas E2E de UI para progreso, errores SSE, cierre de pestaña, reintentos y recarga de mazo.
- Probar carreras con dos solicitudes simultaneas sobre el mismo mazo y sobre el mismo usuario.
- Probar fallos entre persistencia y evento `complete`.
- Medir latencia p50/p95, coste, tokens, reintentos, 429, fallos por etapa, tasa de auditoria, duplicados, cancelaciones y abandono.
- Crear alertas para gasto anomalo, trabajos bloqueados, errores de proveedor, locks expirados y acumulacion de colas.

## Decisiones de producto necesarias

Una propuesta definitiva necesita estas decisiones:

- Si el sistema debe generar exactamente N tarjetas o priorizar calidad aunque entregue menos.
- Si el usuario debe revisar el resultado antes de guardarlo.
- Si las tarjetas deben incluir citas de pagina, extractos de origen o ambos.
- Que tipos de tarjeta se admiten: definicion, cloze, caso clinico, comparacion, calculo, imagen u otros.
- Cual es el nivel academico objetivo y como se define una tarjeta buena.
- Si el coste se cubre siempre con BYOK o si existiran creditos/cuotas de plataforma.
- Cuantas instancias de backend habra en produccion y cuales son sus limites de SSE y timeout.
- Que requisitos de privacidad aplican a PDFs, apuntes, datos personales y material protegido.
- Cual es la latencia aceptable para 10, 100 y 500 tarjetas.
- Que debe ocurrir si el navegador se desconecta durante una generacion.

## Archivos de referencia

- `backend/src/controllers/flashcardController.js`: orquestacion completa de generacion, SSE, locks, recuperacion y persistencia.
- `backend/src/services/aiService.js`: prompts, llamadas a DeepSeek, validacion de respuestas, timeout y reintentos.
- `backend/src/utils/aiSourceChunks.js`: fragmentacion, padding, distribucion de candidatas y seleccion por cobertura.
- `backend/src/utils/concurrency.js`: limitador de concurrencia por proceso.
- `backend/src/utils/sse.js`: inicio y envio de eventos SSE.
- `backend/src/models/Deck.js`: mazos y `aiGenerationLocks`.
- `backend/src/models/User.js`: usuario y almacenamiento de `aiApiKey`.
- `backend/src/controllers/authController.js`: autenticacion Google, ajustes de usuario y middleware `protect`.
- `backend/src/routes/flashcardRoutes.js`: endpoint de generacion protegido.
- `frontend/src/components/FlashcardCreator.jsx`: envio de solicitud y progreso de IA.
- `frontend/src/components/creator/FormInputs.jsx`: entrada de IA y limite de tarjetas configurado en frontend.
- `frontend/src/lib/aiProgressStream.js`: consumo SSE en el cliente.
- `backend/test/aiService.test.js`: pruebas de respuesta y validacion del proveedor.
- `backend/test/aiPipelineUtils.test.js`: pruebas de chunking, padding, seleccion y concurrencia.
- `backend/test/deckRecovery.test.js`: pruebas de recuperacion y no persistencia ante objetivo insuficiente.
- `README.md`: variables de entorno de tuning de IA.
- `resultados.md`: resultados del benchmark real con DeepSeek, MongoDB y SSE.
