// frontend/src/lib/evaluationUtils.js
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

// Cálculo de nota acumulada según items evaluados
function aggregate(node) {
  if (!node) return { gained: 0, weightEvaluated: 0 };
  if (node.type === 'item') {
    if (node.grade == null) return { gained: 0, weightEvaluated: 0 };
    return { gained: node.grade * node.weight, weightEvaluated: node.weight };
  }
  let gained = 0, weightEvaluated = 0;
  for (const child of node.children || []) {
    const a = aggregate(child);
    gained += a.gained;
    weightEvaluated += a.weightEvaluated;
  }
  return { gained, weightEvaluated };
}

export function computeAccumulatedPercent(node) {
  const { gained, weightEvaluated } = aggregate(node);
  if (!weightEvaluated) return null;
  // gained is sum(grade * weight). Dividir por weightEvaluated recupera el promedio ponderado (0..100)
  return gained / weightEvaluated;
}

export default { cloneDeep, validateSiblingsWeight, validateTreeRecursively, computeAccumulatedPercent };
