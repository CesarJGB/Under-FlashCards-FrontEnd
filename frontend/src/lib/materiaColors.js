// FILE: frontend/src/lib/materiaColors.js

// Paleta de acentos por materia. Se usa tanto para el color automÃ¡tico
// (hash del _id/nombre) como para las opciones del selector manual.
export const MATERIA_PALETTE = [
  '#6366F1', // indigo
  '#EC4899', // rose
  '#10B981', // emerald
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EF4444', // coral
  '#14B8A6'  // teal
];

/**
 * Normaliza un nombre para que las variaciones de mayÃºsculas, acentos y
 * espacios compartan identidad visual. La funciÃ³n es deliberadamente
 * pequeÃ±a para poder reutilizarla desde el calendario sin acoplarlo a la
 * entidad completa de materias.
 */
export function normalizeMateriaName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value.trim());
}

export function getDeterministicColor(value) {
  const key = normalizeMateriaName(value);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return MATERIA_PALETTE[hash % MATERIA_PALETTE.length];
}

// Si la materia tiene un color guardado (elegido a mano), se respeta.
// Si no, se calcula uno determinÃ­stico a partir del _id/nombre.
export function getMateriaColor(materia) {
  if (isValidHexColor(materia?.color)) return materia.color;
  const key = String(materia?._id || materia?.name || '');
  return getDeterministicColor(key);
}

// =========================================================================
// ðŸŽ¨ Utilidades de color para el look "carpeta" (tab + cuerpo con degradado + glow)
// =========================================================================
function hexToRgb(hex) {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function getReadableTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = ((0.299 * r) + (0.587 * g) + (0.114 * b)) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
}

export function mixWithWhite(hex, amount = 0.84) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel) => Math.round(channel + ((255 - channel) * amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function getMateriaPastelColor(materia, amount = 0.78) {
  return mixWithWhite(getMateriaColor(materia), amount);
}

export function lightenColor(hex, amount = 0.25) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function darkenColor(hex, amount = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c * (1 - amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function hexToRgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
