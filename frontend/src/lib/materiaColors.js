// FILE: frontend/src/lib/materiaColors.js

// Paleta de acentos por materia. Se usa tanto para el color automático
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

// Si la materia tiene un color guardado (elegido a mano), se respeta.
// Si no, se calcula uno determinístico a partir del _id/nombre.
export function getMateriaColor(materia) {
  if (materia?.color) return materia.color;
  const key = String(materia?._id || materia?.name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return MATERIA_PALETTE[hash % MATERIA_PALETTE.length];
}

export function getMateriaInitial(materia) {
  const name = (materia?.name || '').trim();
  return name ? name.charAt(0).toUpperCase() : '?';
}
