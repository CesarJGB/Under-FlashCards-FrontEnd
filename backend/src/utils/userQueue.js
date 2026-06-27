// FILE: backend/src/utils/userQueue.js
//
// Cola serializada en memoria, por usuario.
// Garantiza que las cascadas de recálculo de métricas (Deck -> Subtema -> Tema -> Materia)
// para un mismo userId se ejecuten una a la vez, en orden de llegada, nunca en paralelo.
//
// IMPORTANTE: esto vive en memoria del proceso de Node. Funciona correctamente porque
// el backend corre en una sola instancia. Si en el futuro se escala a múltiples instancias
// o procesos, esta cola dejaría de ser efectiva entre instancias distintas y habría que
// migrar a una solución compartida (ej. Redis + una librería de locks/colas distribuidas).

const queues = new Map(); // userId (string) -> Promise (cola actual de ese usuario)

/**
 * Encola una tarea async para que se ejecute después de que termine
 * la última tarea encolada para ese mismo userId.
 *
 * @param {string} userId
 * @param {() => Promise<any>} task - función async a ejecutar
 * @returns {Promise<any>} resuelve cuando la tarea termina (o fallida, se loguea y no rompe la cola)
 */
function enqueueForUser(userId, task) {
  const key = String(userId);
  const previous = queues.get(key) || Promise.resolve();

  const next = previous
    .then(() => task())
    .catch((err) => {
      console.error(`[userQueue] Error en cascada para userId=${key}:`, err);
      // No relanzamos: si una tarea falla, no debe trabar las siguientes en la cola.
    });

  queues.set(key, next);
  return next;
}

/**
 * Espera a que termine de procesarse todo lo encolado actualmente para un usuario.
 * Útil, por ejemplo, antes de hacer un refresh de datos en el frontend al salir
 * del Reproductor Continuo, para asegurarse de leer métricas ya consolidadas.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
function flushUserQueue(userId) {
  const key = String(userId);
  return queues.get(key) || Promise.resolve();
}

module.exports = { enqueueForUser, flushUserQueue };
