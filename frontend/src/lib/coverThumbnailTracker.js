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
  return { token: 0, pending: null };
}

// Inicia una generación: invalida cualquier generación anterior (token +1,
// pendiente neutralizada) y devuelve el nuevo token vigente.
export function beginThumbnailGeneration(tracker) {
  tracker.token += 1;
  tracker.pending = null;
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
// invalida el token y neutraliza la promesa. La finalización tardía no podrá
// volver a escribir coverThumb ni ser esperada por el guardado.
export function cancelThumbnailGeneration(tracker) {
  tracker.token += 1;
  tracker.pending = null;
}

// Promesa pendiente vigente (o null). Tras cancelar es siempre null.
export function getPendingThumbnail(tracker) {
  return tracker.pending;
}
