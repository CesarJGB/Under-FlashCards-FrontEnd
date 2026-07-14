import { PDF_LIMITS } from './constants';

const MIME_TO_FORMAT = {
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

function getMimeType(source) {
  if (typeof source !== 'string') return null;

  const dataMatch = source.match(/^data:([^;,]+)[;,]/i);
  if (dataMatch) return dataMatch[1].toLowerCase();

  const extension = source.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}

function normalizeMimeType(mimeType) {
  return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
}

function estimateDataUrlBytes(source) {
  if (!source?.startsWith('data:')) return 0;
  const commaIndex = source.indexOf(',');
  if (commaIndex === -1) return 0;
  const payload = source.slice(commaIndex + 1);
  return Math.max(0, Math.floor((payload.length * 3) / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0));
}

async function readBoundedBlob(response, signal) {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > PDF_LIMITS.maxSingleImageBytes) {
    throw new Error('La imagen supera el límite seguro para exportación.');
  }

  if (!response.body?.getReader) {
    const blob = await response.blob();
    if (blob.size > PDF_LIMITS.maxSingleImageBytes) {
      throw new Error('La imagen supera el límite seguro para exportación.');
    }
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > PDF_LIMITS.maxSingleImageBytes) {
        await reader.cancel();
        throw new Error('La imagen supera el límite seguro para exportación.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
}

async function sourceToBlob(source, signal) {
  const response = await fetch(source, { signal });
  if (!response.ok) throw new Error(`No se pudo cargar la imagen (${response.status}).`);
  return readBoundedBlob(response, signal);
}

function getCachedSourceBlob(source, options) {
  if (!options.sourceBlobCache) return sourceToBlob(source, options.signal);

  const cached = options.sourceBlobCache.get(source);
  if (cached) return cached;

  const task = sourceToBlob(source, options.signal).catch((error) => {
    options.sourceBlobCache.delete(source);
    throw error;
  });
  options.sourceBlobCache.set(source, task);
  return task;
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';

  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }

  return `data:${blob.type};base64,${btoa(binary)}`;
}

function getCanvasSize(width, height, mode, targetRatio) {
  const pixels = width * height;
  const scale = pixels > PDF_LIMITS.maxImagePixels
    ? Math.sqrt(PDF_LIMITS.maxImagePixels / pixels)
    : 1;

  if (mode !== 'cover' || !targetRatio) {
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      sourceX: 0,
      sourceY: 0,
      sourceWidth: width,
      sourceHeight: height,
    };
  }

  const sourceRatio = width / height;
  let sourceWidth = width;
  let sourceHeight = height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = height * targetRatio;
    sourceX = (width - sourceWidth) / 2;
  } else {
    sourceHeight = width / targetRatio;
    sourceY = (height - sourceHeight) / 2;
  }

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
  };
}

async function getImageDimensions(blob, mimeType) {
  const bytes = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer());

  if (mimeType === 'image/png' && bytes.length >= 24) {
    return {
      width: ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0,
      height: ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0,
    };
  }

  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const blockLength = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (marker >= 0xc0 && marker <= 0xc3 && blockLength >= 7) {
        return {
          width: (bytes[offset + 7] << 8) + bytes[offset + 8],
          height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        };
      }
      offset += 2 + blockLength;
    }
  }

  if (mimeType === 'image/webp' && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === 'VP8X') {
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    }
    if (chunk === 'VP8 ') {
      return {
        width: (bytes[26] + (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] + (bytes[29] << 8)) & 0x3fff,
      };
    }
    if (chunk === 'VP8L' && bytes.length >= 25) {
      const bits = (bytes[21]) | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >>> 14) & 0x3fff),
      };
    }
  }

  return null;
}

async function normalizeWithCanvas(blob, { mode, targetRatio }, dimensions) {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return null;

  const bitmap = await createImageBitmap(blob);
  try {
    const canvasSize = getCanvasSize(dimensions.width, dimensions.height, mode, targetRatio);
    const canvas = new OffscreenCanvas(canvasSize.width, canvasSize.height);
    const context = canvas.getContext('2d');
    context.drawImage(
      bitmap,
      canvasSize.sourceX,
      canvasSize.sourceY,
      canvasSize.sourceWidth,
      canvasSize.sourceHeight,
      0,
      0,
      canvasSize.width,
      canvasSize.height
    );

    // Preserve alpha for PNG and WebP assets instead of silently flattening them to JPEG.
    const outputType = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const outputBlob = await canvas.convertToBlob({ type: outputType, quality: 0.84 });
    if (outputBlob.size > PDF_LIMITS.maxNormalizedImageBytes) {
      throw new Error('La imagen normalizada supera el límite seguro para exportación.');
    }
    return {
      data: await blobToDataUrl(outputBlob),
      format: outputType === 'image/png' ? 'PNG' : 'JPEG',
      width: canvasSize.width,
      height: canvasSize.height,
      bytes: outputBlob.size,
    };
  } finally {
    bitmap.close();
  }
}

export function fitContain(asset, maxWidth, maxHeight) {
  const width = asset?.width || maxWidth;
  const height = asset?.height || maxHeight;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, width * scale),
    height: Math.max(1, height * scale),
  };
}

export function estimateDeckImageWeight(cards) {
  const imageSources = cards.flatMap((card) => [card.bgImage, card.contentImage]).filter(Boolean);
  const bytes = imageSources.reduce((total, source) => total + estimateDataUrlBytes(source), 0);

  return {
    count: imageSources.length,
    bytes,
    isHeavy: bytes > PDF_LIMITS.warningImageBytes || cards.length > PDF_LIMITS.warningCardCount,
  };
}

export function validateDeckImageBudget(cards) {
  if (!Array.isArray(cards)) return { count: 0, bytes: 0 };

  const imageSources = cards.flatMap((card) => [card.bgImage, card.contentImage]).filter(Boolean);
  const sourceSizes = imageSources.map((source) => estimateDataUrlBytes(source));
  const oversizedImage = sourceSizes.find((size) => size > PDF_LIMITS.maxSingleImageBytes);
  const totalBytes = sourceSizes.reduce((total, size) => total + size, 0);

  if (oversizedImage) {
    throw new Error('Una imagen del mazo es demasiado pesada para exportarla de forma segura.');
  }

  if (totalBytes > PDF_LIMITS.maxTotalImageBytes) {
    throw new Error('Las imágenes de este mazo superan el límite seguro para una exportación en el navegador.');
  }

  return { count: imageSources.length, bytes: totalBytes };
}

async function prepareImageAssetUncached(source, options = {}) {
  if (!source) return { asset: null, warning: null };

  const mimeType = normalizeMimeType(getMimeType(source));
  if (!mimeType || !MIME_TO_FORMAT[mimeType]) {
    return { asset: null, warning: 'Se omitió una imagen con formato no compatible.' };
  }

  const estimatedBytes = estimateDataUrlBytes(source);
  if (estimatedBytes > PDF_LIMITS.maxSingleImageBytes) {
    return { asset: null, warning: 'Se omitió una imagen demasiado pesada para exportar de forma segura.' };
  }

  try {
    const blob = await getCachedSourceBlob(source, options);
    if (blob.size > PDF_LIMITS.maxSingleImageBytes) {
      return { asset: null, warning: 'Se omitió una imagen demasiado pesada para exportar de forma segura.' };
    }

    const dimensions = await getImageDimensions(blob, mimeType);
    if (!dimensions || !dimensions.width || !dimensions.height) {
      return { asset: null, warning: 'Se omitió una imagen cuyas dimensiones no se pudieron validar.' };
    }
    if ((dimensions.width * dimensions.height) > PDF_LIMITS.maxSourceImagePixels) {
      return { asset: null, warning: 'Se omitió una imagen con demasiados píxeles para exportarla de forma segura.' };
    }

    const normalized = await normalizeWithCanvas(blob, options, dimensions);
    if (normalized) {
      return {
        asset: {
          ...normalized,
          sourceKey: source,
          sourceBytes: blob.size,
        },
        warning: null,
      };
    }

    return {
      asset: {
        data: source,
        format: MIME_TO_FORMAT[mimeType],
        width: dimensions.width,
        height: dimensions.height,
        bytes: blob.size,
        sourceKey: source,
        sourceBytes: blob.size,
      },
      warning: 'La imagen se exportó sin optimización porque el navegador no admite el procesamiento visual en segundo plano.',
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { asset: null, warning: 'Se omitió una imagen que no se pudo procesar.' };
  }
}

export function prepareImageAsset(source, options = {}) {
  if (!source || !options.assetCache) return prepareImageAssetUncached(source, options);

  const variantKey = `${options.mode || 'contain'}:${options.targetRatio || ''}`;
  let variants = options.assetCache.get(source);
  if (!variants) {
    variants = new Map();
    options.assetCache.set(source, variants);
  }

  const cached = variants.get(variantKey);
  if (cached) return cached;

  const task = prepareImageAssetUncached(source, options).catch((error) => {
    variants.delete(variantKey);
    throw error;
  });
  variants.set(variantKey, task);
  return task;
}
