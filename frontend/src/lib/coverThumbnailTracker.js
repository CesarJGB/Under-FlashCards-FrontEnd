// FILE: frontend/src/lib/coverThumbnailTracker.js
// Corte 2 (corrección puntual post-cierre) — rastreador puro de generaciones
// de miniatura en curso. Sin estado React ni APIs del navegador: el componente
// guarda el objeto en un ref y aplica las decisiones devueltas por estas
// funciones (por eso la intercalación es testeable con node --test).
//
// Reglas:
// - Cada selección nueva de archivo invalida la generación anterior (token).
// - Sólo la generación del token vigente puede registrar su promesa, escribir
//   el resultado (coverThumb) o ser esperada por el guardado.
// - La eliminación explícita de portada cancela: invalida el token y
//   neutraliza la promesa pendiente, de modo que una finalización tardía no
//   restaura la miniatura y el guardado envía ambos campos vacíos.

export function createCoverThumbnailTracker() {
  return { token: 0, pending: null, processing: false };
}

// Inicia una generación: invalida cualquier generación anterior (token +1,
// pendiente neutralizada) y marca el procesamiento de la portada (lectura
// FileReader + generación de miniatura) como activo. Devuelve el nuevo token.
export function beginThumbnailGeneration(tracker) {
  tracker.token += 1;
  tracker.pending = null;
  tracker.processing = true;
  return tracker.token;
}

// Registra la promesa de una generación sólo si su token sigue vigente.
export function trackThumbnailPromise(tracker, token, promise) {
  if (token !== tracker.token) return false;
  tracker.pending = promise;
  return true;
}

// ¿La generación del token todavía puede actualizar el estado del componente?
export function isCurrentThumbnailToken(tracker, token) {
  return token === tracker.token;
}

// Cancela cualquier generación pendiente (eliminación explícita de portada):
// invalida el token, neutraliza la promesa y libera el procesamiento. La
// finalización tardía no podrá volver a escribir coverThumb ni ser esperada
// por el guardado.
export function cancelThumbnailGeneration(tracker) {
  tracker.token += 1;
  tracker.pending = null;
  tracker.processing = false;
}

// ¿Hay una lectura/generación de portada en curso? (bloquea Guardar/Listo).
export function isCoverProcessing(tracker) {
  return Boolean(tracker.processing);
}

// Libera el estado de procesamiento sólo si el token sigue vigente: una
// operación obsoleta no puede terminar el procesamiento de una más reciente.
export function releaseCoverProcessing(tracker, token) {
  if (tracker.token !== token) return false;
  tracker.processing = false;
  return true;
}

// Promesa pendiente vigente (o null). Tras cancelar es siempre null.
export function getPendingThumbnail(tracker) {
  return tracker.pending;
}

// Espera la promesa de miniatura pendiente para un guardado iniciado con
// submitToken y decide si ese guardado sigue siendo válido:
// - Sin promesa pendiente: continúa con thumb = fallbackThumb.
// - Con promesa pendiente: espera su resultado; si la portada cambió durante
//   la espera (token distinto al del guardado), el guardado quedó obsoleto y
//   debe abortarse por completo (sin construir payload de portada ni llamar a
//   onSave). El usuario podrá guardar de nuevo el estado actual.
export async function resolveSubmitThumbnail(tracker, submitToken, fallbackThumb = '') {
  const pending = getPendingThumbnail(tracker);
  if (!pending) return { aborted: false, thumb: fallbackThumb };
  const thumb = await pending.catch(() => '');
  if (tracker.token !== submitToken) return { aborted: true, thumb };
  return { aborted: false, thumb };
}
