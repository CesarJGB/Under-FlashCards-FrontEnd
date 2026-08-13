// FILE: frontend/src/lib/coverThumbnail.js
// Corte 2 — generación de miniaturas de portada en el frontend.
// Sólo APIs nativas del navegador: FileReader, Image, canvas y toDataURL.
// Sin dependencias nuevas y sin procesamiento de imágenes en el backend.
//
// Contrato de la utilidad:
// - Mantiene la relación de aspecto y nunca amplía imágenes pequeñas.
// - Lado mayor inicial 320 px; formato preferido WebP; calidad inicial 0.78.
// - Presupuesto objetivo de la Data URL final: ~24 KiB (THUMB_BUDGET_CHARS).
// - Si supera el presupuesto, reduce calidad o dimensiones dentro de límites
//   razonables (plan de intentos); el último intento se devuelve aunque
//   exceda el presupuesto: nunca se produce una imagen ilegible sólo por
//   cumplirlo.
// - Si el navegador no puede producir una miniatura válida, devuelve '' sin
//   lanzar: la portada completa se conserva y el guardado no se bloquea.
//
// Las funciones puras (targetThumbDimensions, planThumbnailAttempts,
// isReasonableImageDataUrl, THUMB_BUDGET_CHARS) son testeables en Node; el
// pipeline de canvas se valida con el build y su contrato de fallo ('' sin
// excepción) está cubierto por el diseño y por buildDeckCoverPayload.

// Presupuesto objetivo de la Data URL final (~24 KiB en caracteres).
export const THUMB_BUDGET_CHARS = 24 * 1024;

// Plan de intentos: reduce calidad manteniendo dimensiones y, al final,
// reduce dimensiones con calidad conservadora. El último intento garantiza
// legibilidad razonable (128 px, 0.35).
export const THUMBNAIL_ATTEMPT_PLAN = [
  { maxSide: 320, quality: 0.78 },
  { maxSide: 320, quality: 0.6 },
  { maxSide: 320, quality: 0.45 },
  { maxSide: 256, quality: 0.45 },
  { maxSide: 192, quality: 0.4 },
  { maxSide: 128, quality: 0.35 },
];

// Data URL de imagen raster (png/jpeg/webp) con payload, dentro de un límite
// razonable. Se usa antes de enviar o persistir una miniatura.
export function isReasonableImageDataUrl(value) {
  return (
    typeof value === 'string' &&
    value.length > 26 &&
    value.length <= 256 * 1024 &&
    /^data:image\/(png|jpe?g|webp);base64,/.test(value)
  );
}

// Dimensiones objetivo conservando la relación de aspecto y sin ampliar
// imágenes pequeñas (si ambos lados caben, se devuelven los originales).
// Entradas inválidas => { width: 0, height: 0 } sin excepción.
export function targetThumbDimensions(originalWidth, originalHeight, maxSide = 320) {
  const width = Number(originalWidth);
  const height = Number(originalHeight);
  const side = Number(maxSide);
  if (
    !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
    !Number.isFinite(side) || side <= 0
  ) {
    return { width: 0, height: 0 };
  }
  if (width <= side && height <= side) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = side / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Convierte el plan de intentos en dimensiones concretas para una imagen.
export function planThumbnailAttempts(originalWidth, originalHeight, plan = THUMBNAIL_ATTEMPT_PLAN) {
  return (Array.isArray(plan) ? plan : []).map(({ maxSide, quality }) => {
    const { width, height } = targetThumbDimensions(originalWidth, originalHeight, maxSide);
    return { width, height, quality };
  });
}

// Lee un archivo como Data URL mediante FileReader.
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const isFile = typeof File !== 'undefined' && file instanceof File;
    const isBlob = typeof Blob !== 'undefined' && file instanceof Blob;
    if (!isFile && !isBlob) {
      reject(new Error('Archivo inválido.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

// Decodifica la imagen en un objeto Image del navegador.
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
    image.src = source;
  });
}

// Codifica el canvas preferentemente en WebP; si el navegador no lo soporta
// (toDataURL devuelve PNG), cae a JPEG y finalmente a PNG.
function encodeCanvas(canvas, quality) {
  const webp = canvas.toDataURL('image/webp', quality);
  if (typeof webp === 'string' && webp.startsWith('data:image/webp')) return webp;
  const jpeg = canvas.toDataURL('image/jpeg', quality);
  if (typeof jpeg === 'string' && jpeg.startsWith('data:image/jpeg')) return jpeg;
  return canvas.toDataURL();
}

// Genera la miniatura de un archivo de imagen. Devuelve la Data URL de la
// miniatura o '' si el navegador no puede producirla; nunca lanza y nunca
// bloquea el guardado (la portada completa sigue disponible).
export async function generateCoverThumbnail(file, options = {}) {
  try {
    if (typeof document === 'undefined' || typeof window === 'undefined' || typeof Image === 'undefined') {
      return '';
    }
    const dataUrl = await readFileAsDataURL(file);
    const image = await loadImage(dataUrl);
    const naturalWidth = image.naturalWidth || 0;
    const naturalHeight = image.naturalHeight || 0;
    if (!naturalWidth || !naturalHeight) return '';

    const budget = Number.isFinite(options.budgetChars) ? options.budgetChars : THUMB_BUDGET_CHARS;
    const attempts = planThumbnailAttempts(
      naturalWidth,
      naturalHeight,
      Array.isArray(options.attempts) ? options.attempts : THUMBNAIL_ATTEMPT_PLAN,
    );
    if (!attempts.length) return '';

    let lastValid = '';
    for (let i = 0; i < attempts.length; i += 1) {
      const attempt = attempts[i];
      const canvas = document.createElement('canvas');
      canvas.width = attempt.width;
      canvas.height = attempt.height;
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.drawImage(image, 0, 0, attempt.width, attempt.height);
      let encoded = '';
      try {
        encoded = encodeCanvas(canvas, attempt.quality);
      } catch {
        continue;
      }
      if (!isReasonableImageDataUrl(encoded)) continue;
      lastValid = encoded;
      if (encoded.length <= budget) return encoded;
      if (i === attempts.length - 1) return encoded; // esfuerzo final: nunca ilegible
    }
    return lastValid;
  } catch {
    return '';
  }
}
