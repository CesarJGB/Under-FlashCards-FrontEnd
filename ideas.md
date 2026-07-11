# Ideas con ventaja real de aprendizaje para Under-FlashCards

## Objetivo

Este documento propone funciones nuevas para Under-FlashCards que aporten una ventaja de aprendizaje real y medible, apoyadas en lo que el codigo ya hace hoy y no en ideas genericas de engagement.

La exploracion se hizo leyendo backend, frontend del modo estudio, metricas por materia y el pipeline de IA con DeepSeek.

## Base verificada en el repo

### Lo que ya existe y conviene no duplicar

- Registro atomico de reviews en `backend/src/controllers/reviewController.js`.
- Estado micro por tarjeta en `backend/src/models/Flashcard.js` con `difficulty`, `easeFactor`, `totalReviews`, `consecutiveErrors` y `lastReviewedAt`.
- Ledger historico en `backend/src/models/ReviewLog.js` con `sessionId`, `responseTimeMs`, `materiaId`, `temaId`, `subtemaId` y `parcialNumber`.
- Sesiones agregadas en `backend/src/models/StudySession.js` con precision, tiempo medio, conteo de correctas e incorrectas y lotes completados.
- Cola serializada por usuario en `backend/src/utils/userQueue.js` para recalculo en cascada.
- Motor de metricas multicriterio en `backend/src/utils/radarMetrics.js` con pesos para accuracy, retention, fluidity, volume y resilience.
- Preview filtrado por parciales con `activeParciales`, `domain-preview` y `metrics-history` en `backend/src/controllers/academicController.js`.
- Reproductor real de sesion en `frontend/src/components/SessionPlayer.jsx`.
- Construccion local de lotes en `frontend/src/lib/batchBuilder.js`.
- Pipeline de IA en 2 fases con DeepSeek en `backend/src/services/aiService.js` y `backend/src/controllers/flashcardController.js`.

### Limitaciones importantes detectadas

- El modo continuo actual no es repeticion espaciada real. No hay `nextReviewAt`, `interval`, `lapses` ni cola de tarjetas vencidas en `Flashcard`.
- La seleccion de tarjetas hoy prioriza por `difficulty` y `consecutiveErrors`, con mezcla 60/40 entre nuevas y repasadas, pero no por agenda de vencimiento.
- `SessionPlayer` si deja telemetria real, pero `frontend/src/components/ReviewMode.jsx` no parece registrar reviews ni sesiones.
- `StudySession` hoy es por `deckId`, no por materia, parcial o sesiones cross-deck.
- Las metricas ya son mas sofisticadas que el scheduler actual: el radar conoce retencion y fluidez, pero el batching no las usa como fuente de verdad.
- Hay un placeholder visible para `anki-review` en `frontend/src/components/StudySection.jsx`, pero no existe el backend que lo soporte.
- La IA hoy se usa casi solo para generar y auditar tarjetas; no para feedback de estudio o correccion guiada.

## Criterios para priorizar ideas

- Deben mejorar retencion, transferencia o diagnostico real del dominio.
- Deben poder medirse con señales ya disponibles o faciles de agregar.
- Deben reutilizar el stack actual antes de inventar subsistemas nuevos.
- Deben evitar duplicar funciones que ya existen con otro nombre.

## Propuestas por categoria

## 1. Retencion y repeticion espaciada

### 1.1 Repaso del dia con SRS real

**Que es**

Un modo de estudio nuevo que muestre tarjetas vencidas hoy, proximas a vencer y backlog acumulado. En la practica, el usuario entraria a `Metodo Anki Estricto`, veria un contador diario y calificaria cada tarjeta con 4 niveles de recuerdo, por ejemplo `Again`, `Hard`, `Good` y `Easy`.

**Como se veria en la app**

- Nueva vista en `StudySection` para iniciar una sesion basada en tarjetas due, no en un deck completo aleatorio.
- En el resumen de sesion se mostraria: tarjetas vencidas atendidas, nuevas aprendidas, lapsos y carga de manana.
- En Home podria aparecer un CTA del tipo `Tienes 37 tarjetas para hoy`.

**Por que ayuda al aprendizaje**

Aplica repeticion espaciada real. La app ya guarda senales utiles para estimar olvido, pero aun no las usa para decidir cuando tocar cada tarjeta. Pasar de priorizacion heuristica a agenda due-based reduce sobreestudio y mejora retencion a mediano plazo.

**Que principio lo respalda**

Repeticion espaciada.

**Como medir impacto**

- Retencion a 7, 14 y 30 dias.
- Tasa de lapsos por tarjeta.
- Backlog diario.
- Porcentaje de reviews completados en fecha.

**Esfuerzo tecnico aproximado**

Alto.

**Piezas reutilizables o extensibles**

- `Flashcard.easeFactor` y `Flashcard.lastReviewedAt` en `backend/src/models/Flashcard.js`.
- `registerReview` en `backend/src/controllers/reviewController.js` para aplicar el nuevo estado por tarjeta.
- `StudySession` y `ReviewLog` para telemetria y comparacion de resultados.
- Placeholder existente en `frontend/src/components/StudySection.jsx`.

**Notas de implementacion**

- Conviene unificar la fuente de verdad del scheduler en backend y dejar al frontend solo la reproduccion de la cola.
- Hoy `batchBuilder.js` y `reviewController.js` duplican logica; un SRS serio no deberia depender de dos implementaciones paralelas.

### 1.2 Reaprendizaje de tarjetas fragiles

**Que es**

Cuando una tarjeta entra en zona de fragilidad, por ejemplo por varios errores seguidos o por tiempo de respuesta muy alto, la app la envia a un mini-circuito de recuperacion dentro de la misma sesion. No reaparece de inmediato de forma obvia, pero si vuelve antes que el resto hasta confirmarse que se recupero.

**Como se veria en la app**

- Si el usuario falla una tarjeta, la tarjeta queda marcada como `fragil` durante la sesion.
- En el resumen se mostraria `3 tarjetas recuperadas` y `2 siguen fragiles`.
- Puede existir un boton opcional al final: `Reforzar solo mis fragiles`.

**Por que ayuda al aprendizaje**

Pone practica deliberada justo sobre el error fresco. Hoy la app ya aumenta la prioridad de una tarjeta dificil, pero no tiene un carril explicito de relearning. Ese mini-circuito mejora consolidacion rapida y reduce que el error se pierda dentro del lote siguiente.

**Que principio lo respalda**

Practica deliberada y feedback inmediato.

**Como medir impacto**

- Exito en el segundo intento dentro de la misma sesion.
- Disminucion de `consecutiveErrors`.
- Menor tasa de error en la proxima sesion para tarjetas intervenidas.

**Esfuerzo tecnico aproximado**

Bajo a medio.

**Piezas reutilizables o extensibles**

- `consecutiveErrors`, `difficulty` y `totalReviews` en `Flashcard`.
- `handleAnswer` en `frontend/src/components/SessionPlayer.jsx`.
- `applyLocalAnswer` y el armado de lotes en `frontend/src/lib/batchBuilder.js`.

### 1.3 Sesiones intercaladas por materia, parcial o tema debil

**Que es**

Un modo que construya una sesion mezclando tarjetas de varios mazos de una misma materia o parcial, con foco en temas de bajo dominio. En vez de elegir solo un deck, el usuario podria elegir `Practicar Parcial 2` o `Practicar mis temas mas debiles de Farmacologia`.

**Como se veria en la app**

- Nuevo selector de estudio desde `StudySection` por alcance: deck, parcial, materia o temas debiles.
- Cada tarjeta mostraria contexto minimo: materia, parcial y tema.
- El resumen cerraria con rendimiento por tema mezclado.

**Por que ayuda al aprendizaje**

El interleaving mejora discriminacion entre conceptos y se parece mas a la exigencia de examen que el estudio en bloques puros. Hoy la estructura academica ya existe, pero el modo estudio sigue amarrado a `deckId`.

**Que principio lo respalda**

Interleaving.

**Como medir impacto**

- Desempeno en sesiones mixtas vs sesiones por deck.
- Mejora en temas debiles despues de sesiones intercaladas.
- Cobertura de parciales en una misma semana de estudio.

**Esfuerzo tecnico aproximado**

Medio.

**Piezas reutilizables o extensibles**

- `Materia`, `Tema`, `Subtema` y `parcialNumber` ya persistidos en backend.
- `activeParciales`, `domain-preview` y `metrics-history`.
- `ReviewLog` ya guarda contexto academico por review.

**Notas de implementacion**

- `StudySession` hoy es por deck. Probablemente haya que agregar un modo o un scope de sesion mas flexible.

## 2. Analitica y autoconocimiento del estudiante

### 2.1 Separar reconocimiento de recuperacion

**Que es**

La app deberia distinguir entre dos tipos de dominio: el dominio por recuerdo sin apoyo y el dominio por reconocimiento con respuesta visible. Hoy `continuous` y `normal` terminan alimentando metricas parecidas, pero no miden la misma exigencia cognitiva.

**Como se veria en la app**

- En metricas apareceria una brecha del tipo `Recuperacion sin apoyo: 58%` vs `Reconocimiento con apoyo: 83%`.
- El resumen de sesion mostraria claramente el modo de practica usado.
- Home podria alertar: `Reconoces bien, pero recuperas poco sin ayuda`.

**Por que ayuda al aprendizaje**

Reduce la ilusion de competencia. Ver la respuesta y sentir familiaridad no equivale a recordarla desde memoria. Si la app no separa esas senales, el estudiante puede creer que domina mas de lo que realmente recupera.

**Que principio lo respalda**

Metacognicion y retrieval practice.

**Como medir impacto**

- Brecha entre ambos tipos de dominio.
- Capacidad predictiva del dominio por recuperacion sobre resultados futuros.
- Uso de modos mas exigentes despues de mostrar la brecha.

**Esfuerzo tecnico aproximado**

Bajo a medio.

**Piezas reutilizables o extensibles**

- `SessionPlayer` ya sabe en que modo esta.
- `ReviewMode.jsx` puede instrumentarse.
- `ReviewLog` y `StudySession` pueden ampliarse con `mode`.
- `MetricsLevel.jsx` ya tiene una UI de metricas rica donde esta distincion entraria natural.

### 2.2 Siguiente mejor accion orientada a examen

**Que es**

En vez de solo mostrar dashboards, la app recomendaria la accion con mayor retorno esperado. Ejemplo: `Si estudias 15 minutos, te conviene atacar Tema X del Parcial 2 porque combina baja retencion, alta dificultad y alto peso academico`.

**Como se veria en la app**

- Un modulo en Home con 1 recomendacion principal y 2 secundarias.
- En `MetricsLevel` un CTA para abrir una sesion directamente desde el tema sugerido.
- En materias con criterios de evaluacion, la recomendacion podria considerar peso academico y meta de nota.

**Por que ayuda al aprendizaje**

Convierte metricas en accion. Hoy el sistema ya mide varias dimensiones, pero el usuario aun tiene que interpretar solo por donde avanzar. Una recomendacion bien calculada mejora metacognicion y tiempo de estudio efectivo.

**Que principio lo respalda**

Metacognicion y practica deliberada enfocada en puntos debiles.

**Como medir impacto**

- CTR sobre la recomendacion.
- Mejora por minuto estudiado.
- Avance hacia `metaCalificacion`.
- Reduccion del tiempo perdido en temas ya dominados.

**Esfuerzo tecnico aproximado**

Bajo a medio.

**Piezas reutilizables o extensibles**

- `backend/src/utils/radarMetrics.js`.
- `Materia.metaCalificacion` y `evaluationCriteria` en `backend/src/models/Materia.js`.
- `frontend/src/lib/evaluationUtils.js`.
- `HomeSection.jsx` y `MetricsLevel.jsx`.

### 2.3 Termometro de estabilidad real

**Que es**

Una vista simple por tema o materia que no solo muestre dominio actual, sino estabilidad del conocimiento. Por ejemplo: `alto pero fragil`, `medio pero estable`, `bajo y en deterioro`. El objetivo es que el estudiante vea no solo cuanto sabe hoy, sino cuan sostenible es ese conocimiento.

**Como se veria en la app**

- Chips o estados sinteticos junto al mastery actual.
- Tendencias como `mejorando`, `estable`, `cayendo` basadas en `metrics-history`.
- Alertas suaves si un tema lleva dias sin repaso y su retencion estimada cae.

**Por que ayuda al aprendizaje**

Mejora el juicio metacognitivo. Muchos estudiantes confunden rendimiento actual con retencion futura. Esta capa ayuda a leer mejor el riesgo de olvido.

**Que principio lo respalda**

Metacognicion y repeticion espaciada.

**Como medir impacto**

- Menor abandono de temas de alto riesgo.
- Mayor distribucion del estudio en el tiempo.
- Menor sorpresa entre autopercepcion y desempeno real.

**Esfuerzo tecnico aproximado**

Bajo.

**Piezas reutilizables o extensibles**

- `retention` y `lastReview` que ya forman parte del radar.
- `metrics-history` para tendencia.
- `domain-preview` para estado actual.

## 3. IA aplicada al estudio, no solo a la generacion

### 3.1 Feedback IA post-error y post-sesion

**Que es**

Una capa de IA que explique por que una tarjeta probablemente se fallo, que concepto corregir, y cual es la siguiente pregunta util para comprobar si ya se entendio. No seria un chat abierto primero, sino feedback acotado a errores reales de la sesion.

**Como se veria en la app**

- Al final de la sesion: `Tus 3 errores mas costosos` con explicacion corta.
- En tarjetas muy problematicas: boton `Explicamelo mejor`.
- El feedback podria incluir una microcomparacion: `confundiste mecanismo con consecuencia`, `confundiste definicion con ejemplo`, etc.

**Por que ayuda al aprendizaje**

La retroalimentacion especifica acelera mucho mas el aprendizaje que solo marcar `incorrecto`. La app ya tiene los datos del error, pero no cierra el loop pedagogico con explicacion.

**Que principio lo respalda**

Retroalimentacion inmediata y especifica.

**Como medir impacto**

- Tasa de acierto en la siguiente exposicion de la tarjeta intervenida.
- Reduccion de errores repetidos en el mismo concepto.
- Mejora de tiempo de respuesta despues de ver feedback.

**Esfuerzo tecnico aproximado**

Medio a alto.

**Piezas reutilizables o extensibles**

- `aiService.js` y la integracion DeepSeek ya existente.
- `StudySession` y `ReviewLog` para construir el contexto.
- `ChatSection.jsx` como superficie futura.

**Notas de implementacion**

- Para hacerlo confiable conviene guardar mejor la procedencia del contenido de tarjetas generadas por IA.
- El feedback deberia priorizar grounded prompts y evitar respuestas libres sin contexto suficiente.

### 3.2 Generacion de tarjetas de refuerzo desde puntos debiles

**Que es**

Cuando una tarjeta acumula friccion real, la app ofrece generar 2 o 3 tarjetas de refuerzo con otro angulo: cloze, comparacion, ejemplo, contraejemplo o reformulacion mas atomica.

**Como se veria en la app**

- CTA `Crear refuerzo` al detectar tarjeta dificil.
- Las tarjetas nuevas se agregarian al mismo deck o a un mini-deck de refuerzo.
- El usuario podria aprobar o rechazar esas tarjetas antes de guardarlas.

**Por que ayuda al aprendizaje**

No todos los fallos se arreglan repitiendo la misma pregunta. Variar la pista de recuperacion o cambiar el angulo de practica aumenta transferencia y corrige puntos ciegos.

**Que principio lo respalda**

Retrieval practice y practica deliberada.

**Como medir impacto**

- Mejora posterior en la tarjeta original.
- Disminucion de dificultad percibida y errores consecutivos.
- Uso real de tarjetas de refuerzo y supervivencia de esas tarjetas en sesiones futuras.

**Esfuerzo tecnico aproximado**

Medio.

**Piezas reutilizables o extensibles**

- Pipeline actual de generacion y auditoria en 2 fases.
- Insercion de tarjetas en `flashcardController.js`.
- `difficulty`, `consecutiveErrors` y `ReviewLog` como disparadores.

### 3.3 Tutor contextual por materia y parcial

**Que es**

Un tutor acotado al contexto academico del usuario, capaz de responder preguntas del tipo `que parcial conviene reforzar primero`, `que criterio pesa mas para llegar a 70`, o `que tema se me esta cayendo aunque tenga buen promedio`.

**Como se veria en la app**

- `ChatSection` deja de ser placeholder y se vuelve un asistente contextual.
- El chat no responde en abstracto: usa materia, parciales activos, metricas historicas y criterios de evaluacion.
- La primera version puede ser solo lectura y sugerencias, sin ejecutar acciones.

**Por que ayuda al aprendizaje**

Ayuda a tomar mejores decisiones de estudio y a interpretar senales complejas. La ventaja no es `tener chat`, sino tener explicaciones conectadas con evidencia real del propio progreso.

**Que principio lo respalda**

Metacognicion y feedback especifico.

**Como medir impacto**

- Preguntas resueltas por sesion.
- Conversion desde sugerencia a sesion iniciada.
- Mejora en foco de estudio segun recomendacion del tutor.

**Esfuerzo tecnico aproximado**

Medio a alto.

**Piezas reutilizables o extensibles**

- `ChatSection.jsx`.
- `domain-preview`, `metrics-history`, `evaluationCriteria`, `metaCalificacion`.
- Integracion DeepSeek ya resuelta para autenticacion de key y saldo.

## 4. Practica visual y accesibilidad cognitiva

### 4.1 Image occlusion para diagramas y esquemas

**Que es**

Un modo de tarjeta visual donde partes de una imagen se ocultan y el estudiante tiene que recordar la etiqueta, estructura o proceso correcto antes de revelar.

**Como se veria en la app**

- Editor con zonas tapadas sobre `contentImage`.
- En estudio, el usuario toca o responde mentalmente antes de revelar.
- Muy util para anatomia, bioquimica, histologia, circuitos, mapas o procesos visuales.

**Por que ayuda al aprendizaje**

Convierte la imagen en objeto de recuperacion activa. Hoy la app ya soporta imagenes adjuntas y zoom, pero la imagen es pasiva; esta funcion la vuelve evaluativa.

**Que principio lo respalda**

Retrieval practice.

**Como medir impacto**

- Precision en tarjetas visuales.
- Velocidad en reconocimiento de estructuras.
- Transferencia a examenes con laminas o esquemas.

**Esfuerzo tecnico aproximado**

Medio.

**Piezas reutilizables o extensibles**

- `contentImage` e `imageSide` ya soportados por `CardFace.jsx`.
- Zoom existente en `CardFace`, `ReviewMode` y `SessionPlayer`.

### 4.2 Modo de recuperacion escalonada para tarjetas densas

**Que es**

Para tarjetas largas o con respuestas complejas, la app podria revelar por capas: primero pista, luego estructura, luego respuesta completa. No para todas las tarjetas, sino para las que tienden a producir bloqueos excesivos.

**Como se veria en la app**

- Botones `Pista`, `Estructura`, `Respuesta completa`.
- La sesion registraria si el usuario uso ayudas.
- En metricas, las respuestas correctas con ayuda no valen lo mismo que las correctas sin ayuda.

**Por que ayuda al aprendizaje**

Mejora feedback sin convertir el estudio en pura lectura. Es un andamiaje util cuando la distancia entre no recordar nada y ver la respuesta completa es demasiado grande.

**Que principio lo respalda**

Retroalimentacion especifica y practica deliberada.

**Como medir impacto**

- Uso de pistas por tarjeta.
- Reduccion progresiva de ayudas necesarias.
- Mejora posterior sin ayudas.

**Esfuerzo tecnico aproximado**

Medio.

**Piezas reutilizables o extensibles**

- `CardFace.jsx` y `FlipCard.jsx` para el reveal escalonado.
- `ReviewLog` si se amplia con `hintUsed` o nivel de ayuda.

## Ideas que NO priorizaria ahora

- Rachas, puntos o insignias sin relacion directa con retencion.
- Leaderboards genericos.
- Mas dashboards pasivos sin CTA directo a una sesion accionable.
- Mas variaciones esteticas del player sin cambiar el loop de aprendizaje.

## Quick wins recomendados

### Quick win 1. Reaprendizaje de tarjetas fragiles

**Por que primero**

- Alto impacto pedagogico.
- Reutiliza señales ya presentes.
- No exige rehacer el modelo entero de scheduling.

**Costo aproximado**

Bajo a medio.

### Quick win 2. Separar reconocimiento de recuperacion

**Por que primero**

- Hace las metricas mas honestas.
- Evita que el usuario sobreestime su dominio.
- Requiere ampliar telemetria mas que redisenar todo el player.

**Costo aproximado**

Bajo a medio.

### Quick win 3. Siguiente mejor accion orientada a examen

**Por que primero**

- Convierte metricas existentes en decision practica.
- Aprovecha `radarMetrics`, `activeParciales`, `metrics-history`, `metaCalificacion` y `evaluationCriteria`.
- Diferencia producto sin gran deuda tecnica nueva.

**Costo aproximado**

Bajo a medio.

## Apuestas de mediano plazo

### Apuesta 1. Anki estricto real

**Valor esperado**

Es la mejora mas clara en retencion a mediano plazo y una promesa ya insinuada en la UI.

**Costo aproximado**

Alto.

### Apuesta 2. Sesiones intercaladas cross-deck por materia y parcial

**Valor esperado**

Acerca la practica a la realidad del examen y aprovecha la estructura academica que ya tiene el producto.

**Costo aproximado**

Medio.

### Apuesta 3. Feedback IA grounded y generacion de refuerzo

**Valor esperado**

Puede transformar a Under-FlashCards en un sistema que no solo pregunta, sino que diagnostica y corrige mejor.

**Costo aproximado**

Medio a alto.

## Priorizacion sugerida

Si hubiera que ordenar por combinacion de impacto real y costo razonable, priorizaria asi:

1. Reaprendizaje de tarjetas fragiles.
2. Separar reconocimiento de recuperacion e instrumentar `ReviewMode`.
3. Siguiente mejor accion orientada a examen.
4. Sesiones intercaladas por materia o parcial.
5. Anki estricto real.
6. Feedback IA post-error y tarjetas de refuerzo.

## Conclusiones

Under-FlashCards ya tiene una base mucho mejor que una app de flashcards comun:

- telemetria por respuesta,
- sesiones de estudio,
- metricas jerarquicas por materia,
- filtros por parciales,
- y una tuberia de IA ya integrada.

La oportunidad principal no es agregar mas interfaz, sino cerrar mejor el loop de aprendizaje:

- decidir mejor que estudiar ahora,
- distinguir mejor que tan real es el dominio,
- insistir inteligentemente en lo fragil,
- y usar la IA para explicar y reforzar, no solo para fabricar tarjetas.

Ese es el camino con mayor ventaja real y medible para estudiantes.
