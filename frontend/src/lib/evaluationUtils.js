// FILE: frontend/src/lib/evaluationUtils.js
// Utilidades para manejo y validación del árbol de criterios de evaluación

export function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function validateSiblingsWeight(siblings = [], newWeight = 0, replacingId = null) {
  const sum = siblings.reduce((acc, s) => {
    if (replacingId && (s.id === replacingId || s._id === replacingId)) {
      return acc + (typeof newWeight === 'number' ? newWeight : (s.weight || 0));
    }
    return acc + (typeof s.weight === 'number' ? s.weight : 0);
  }, 0);
  return { ok: sum <= 100, sum };
}

// Validación recursiva: suma de hijos <= peso del padre y profundidad máxima 3
export function validateTreeRecursively(nodes, depth = 1) {
  if (!Array.isArray(nodes)) return { ok: true };
  for (const node of nodes) {
    if (!node || typeof node !== 'object') return { ok: false, error: 'Nodo inválido' };
    if (typeof node.weight !== 'number' || node.weight < 0 || node.weight > 100) return { ok: false, error: 'Peso inválido' };
    if (!['folder', 'item'].includes(node.type)) return { ok: false, error: 'Tipo inválido' };
    if (depth > 3) return { ok: false, error: 'Profundidad máxima excedida' };
    if (node.type === 'folder') {
      const children = node.children || [];
      const sum = children.reduce((a, c) => a + (typeof c.weight === 'number' ? c.weight : 0), 0);
      if (sum > node.weight) return { ok: false, error: 'Validación fallida: La suma de los subcriterios excede el peso asignado al elemento padre.' };
      const sub = validateTreeRecursively(children, depth + 1);
      if (!sub.ok) return sub;
    }
  }
  return { ok: true };
}

// Calcula los puntos absolutos ganados por cada criterio en base a su escala
function aggregate(node) {
  if (!node) return 0;
  
  if (node.type === 'item') {
    if (node.grade == null) return 0; // Si no está evaluado, aporta 0 puntos al global actual
    
    // 🎯 LEEMOS LA BASE CONFIGURADA (ej: base 10, base 100). Por defecto será base 100 si no existe.
    const base = Number(node.gradingBase) || 100;
    
    // Rendimiento va de 0 a 1 (ej: 10/10 = 1 | 30/30 = 1 | 50/100 = 0.5)
    const performanceRatio = Number(node.grade) / base;
    
    // Puntos reales aportados al global de la materia
    return performanceRatio * (Number(node.weight) || 0);
  }
  
  let totalGained = 0;
  for (const child of node.children || []) {
    totalGained += aggregate(child);
  }
  return totalGained;
}

export function computeAccumulatedPercent(node) {
  if (!node) return 0;
  // Retorna la suma lineal directa de los puntos acumulados de la materia (0 a 100%)
  return aggregate(node);
}

/**
 * Calcula el estado de rendimiento actual frente a la meta del usuario.
 * @param {number} currentProgress - Puntos acumulados actuales calculados por el motor (ej. 45.5)
 * @param {number} targetGrade - Meta de calificación guardada en la materia (ej. 70)
 * @returns {object} { reached: boolean, pointsDifference: number, message: string }
 */
export const calculateGoalMetrics = (currentProgress, targetGrade = 70) => {
  const current = typeof currentProgress === 'number' ? currentProgress : 0;
  const target = typeof targetGrade === 'number' ? targetGrade : 70;

  const diff = current - target;
  // Redondeamos a 2 decimales para evitar los clásicos errores de coma flotante de JavaScript (ej. 0.1 + 0.2 = 0.30000000000000004)
  const pointsDifference = parseFloat(Math.abs(diff).toFixed(2));
  const reached = diff >= 0;

  return {
    reached,
    pointsDifference,
    message: reached
      ? `¡Meta alcanzada! Llevas +${pointsDifference} pts de más`
      : `Te faltan ${pointsDifference} pts para tu meta`
  };
};

export default { 
  cloneDeep, 
  validateSiblingsWeight, 
  validateTreeRecursively, 
  computeAccumulatedPercent,
  calculateGoalMetrics 
};
