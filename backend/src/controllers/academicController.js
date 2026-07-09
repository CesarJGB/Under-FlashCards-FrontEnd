// FILE: backend/src/controllers/academicController.js

const Materia = require('../models/Materia');
const Tema = require('../models/Tema');
const Subtema = require('../models/Subtema');
const Deck = require('../models/Deck');
const { calculateRadarMetrics } = require('../utils/radarMetrics');

// =========================================================================
// 1. MATERIAS (Asignaturas principales)
// =========================================================================

exports.getMaterias = async (req, res) => {
  try {
    const { userId } = req.params;
    const materias = await Materia.find({ userId }).sort({ name: 1 });
    return res.json(materias.map(m => m.serialize()));
  } catch (err) {
    console.error('[academic:getMaterias] error:', err.message);
    return res.status(500).json({ error: 'Server error al obtener materias.' });
  }
};

exports.createMateria = async (req, res) => {
  try {
    const { userId, name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la materia es requerido.' });

    // Validar duplicados por usuario de forma preventiva
    const existe = await Materia.findOne({ name: name.trim(), userId });
    if (existe) return res.status(400).json({ error: 'Ya tienes una materia registrada con este nombre.' });

    const materia = await Materia.create({ userId, name: name.trim() });
    return res.status(201).json(materia.serialize());
  } catch (err) {
    console.error('[academic:createMateria] error:', err.message);
    return res.status(500).json({ error: 'Server error al crear materia.' });
  }
};

exports.deleteMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const materia = await Materia.findByIdAndDelete(id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });

    // Limpieza en cascada para no corromper la base de datos
    await Tema.deleteMany({ materiaId: id });
    await Subtema.deleteMany({ temaId: { $in: await Tema.find({ materiaId: id }).distinct('_id') } });
    
    // Desvincular los mazos (no los borramos para cumplir la regla de negocio de no perder datos)
    await Deck.updateMany({ materiaId: id }, { $set: { materiaId: null, parcialNumber: null, temaId: null, subtemaId: null } });

    return res.json({ success: true, message: 'Materia eliminada y mazos desvinculados.' });
  } catch (err) {
    console.error('[academic:deleteMateria] error:', err.message);
    return res.status(500).json({ error: 'Server error al eliminar materia.' });
  }
};

// =========================================================================
// 2. TEMAS (Vinculados a una Materia y a un Parcial Fijo [1, 2, 3])
// =========================================================================

exports.getTemas = async (req, res) => {
  try {
    const { materiaId } = req.params;
    const { parcialNumber } = req.query; // Opcional: filtrar por parcial directo

    const filter = { materiaId };
    if (parcialNumber) filter.parcialNumber = Number(parcialNumber);

    const temas = await Tema.find(filter).sort({ name: 1 });
    const temaIds = temas.map(t => t._id);
    const subtemaCountsRaw = await Subtema.aggregate([
      { $match: { temaId: { $in: temaIds } } },
      { $group: { _id: '$temaId', count: { $sum: 1 } } }
    ]);
    const subtemaCountMap = Object.fromEntries(
      subtemaCountsRaw.map(r => [r._id.toString(), r.count])
    );

    return res.json(temas.map(t => ({
      ...t.serialize(),
      subtemaCount: subtemaCountMap[t._id.toString()] || 0
    })));
  } catch (err) {
    console.error('[academic:getTemas] error:', err.message);
    return res.status(500).json({ error: 'Server error al obtener temas.' });
  }
};

exports.createTema = async (req, res) => {
  try {
    const { userId, name, materiaId, parcialNumber } = req.body || {};
    if (!name?.trim() || !materiaId || !parcialNumber) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (name, materiaId, parcialNumber).' });
    }

    if (![1, 2, 3].includes(Number(parcialNumber))) {
      return res.status(400).json({ error: 'El número de parcial debe ser exactamente 1, 2 o 3.' });
    }

    const tema = await Tema.create({
      userId,
      name: name.trim(),
      materiaId,
      parcialNumber: Number(parcialNumber)
    });
    return res.status(201).json(tema.serialize());
  } catch (err) {
    console.error('[academic:createTema] error:', err.message);
    return res.status(500).json({ error: 'Server error al crear tema.' });
  }
};

exports.deleteTema = async (req, res) => {
  try {
    const { id } = req.params;
    const tema = await Tema.findByIdAndDelete(id);
    if (!tema) return res.status(404).json({ error: 'Tema no encontrado.' });

    // Limpieza en cascada de subtemas dependientes
    await Subtema.deleteMany({ temaId: id });
    
    // Desvincular mazos asociados a este tema
    await Deck.updateMany({ temaId: id }, { $set: { temaId: null, subtemaId: null } });

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[academic:deleteTema] error:', err.message);
    return res.status(500).json({ error: 'Server error al eliminar tema.' });
  }
};

// =========================================================================
// 3. SUBTEMAS (Opcionales, vinculados a un Tema)
// =========================================================================

exports.getSubtemas = async (req, res) => {
  try {
    const { temaId } = req.params;
    const subtemas = await Subtema.find({ temaId }).sort({ name: 1 });
    return res.json(subtemas.map(s => s.serialize()));
  } catch (err) {
    console.error('[academic:getSubtemas] error:', err.message);
    return res.status(500).json({ error: 'Server error al obtener subtemas.' });
  }
};

exports.createSubtema = async (req, res) => {
  try {
    const { userId, name, temaId } = req.body || {};
    if (!name?.trim() || !temaId) {
      return res.status(400).json({ error: 'El nombre y el temaId son obligatorios.' });
    }

    const subtema = await Subtema.create({
      userId,
      name: name.trim(),
      temaId
    });
    return res.status(201).json(subtema.serialize());
  } catch (err) {
    console.error('[academic:createSubtema] error:', err.message);
    return res.status(500).json({ error: 'Server error al crear subtema.' });
  }
};

exports.deleteSubtema = async (req, res) => {
  try {
    const { id } = req.params;
    const subtema = await Subtema.findByIdAndDelete(id);
    if (!subtema) return res.status(404).json({ error: 'Subtema no encontrado.' });

    // Desvincular mazos asociados a este subtema únicamente
    await Deck.updateMany({ subtemaId: id }, { $set: { subtemaId: null } });

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[academic:deleteSubtema] error:', err.message);
    return res.status(500).json({ error: 'Server error al eliminar subtema.' });
  }
};

// =========================================================================
// 4. ACTIVE PARCIALES (Toggle de parciales para cálculo de dominio)
// =========================================================================

exports.updateActiveParciales = async (req, res) => {
  try {
    const { id } = req.params;
    const { activeParciales } = req.body;

    if (!Array.isArray(activeParciales) || !activeParciales.every(n => [1, 2, 3].includes(n))) {
      return res.status(400).json({ error: 'activeParciales debe ser un array con valores en [1, 2, 3].' });
    }

    const materia = await Materia.findByIdAndUpdate(
      id,
      { activeParciales },
      { new: true }
    );
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });

    return res.json(materia.serialize());
  } catch (err) {
    console.error('[academic:updateActiveParciales] error:', err.message);
    return res.status(500).json({ error: 'Server error al actualizar parciales activos.' });
  }
};

exports.getDomainPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const parciales = req.query.parciales
      ? req.query.parciales.split(',').map(Number).filter(n => [1, 2, 3].includes(n))
      : [1, 2, 3];

    const filteredTemas = await Tema.find({ materiaId: id, parcialNumber: { $in: parciales } });
    const metrics = calculateRadarMetrics(filteredTemas, false);

    return res.json({
      materiaId: id,
      parciales,
      mastery: metrics.mastery,
      metrics
    });
  } catch (err) {
    console.error('[academic:getDomainPreview] error:', err.message);
    return res.status(500).json({ error: 'Server error al calcular preview de dominio.' });
  }
};

// =========================================================================
// 5. EDICIÓN DE NOMBRE (Renombrar carpetas académicas)
// =========================================================================

exports.updateMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};

    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido.' });
    }

    const materia = await Materia.findById(id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });

    // Validar duplicados por usuario (excluyendo el documento actual)
    const duplicado = await Materia.findOne({
      name: name.trim(),
      userId: materia.userId,
      _id: { $ne: id }
    });
    if (duplicado) {
      return res.status(400).json({ error: 'Ya tienes una materia registrada con este nombre.' });
    }

    materia.name = name.trim();
    await materia.save();

    return res.json(materia.serialize());
  } catch (err) {
    console.error('[academic:updateMateria] error:', err.message);
    return res.status(500).json({ error: 'Server error al actualizar materia.' });
  }
};

exports.updateTema = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};

    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido.' });
    }

    const tema = await Tema.findById(id);
    if (!tema) return res.status(404).json({ error: 'Tema no encontrado.' });

    // Validar duplicados dentro de la misma materia y parcial
    const duplicado = await Tema.findOne({
      name: name.trim(),
      materiaId: tema.materiaId,
      parcialNumber: tema.parcialNumber,
      _id: { $ne: id }
    });
    if (duplicado) {
      return res.status(400).json({ error: 'Ya existe un tema con este nombre en el mismo parcial.' });
    }

    tema.name = name.trim();
    await tema.save();

    return res.json(tema.serialize());
  } catch (err) {
    console.error('[academic:updateTema] error:', err.message);
    return res.status(500).json({ error: 'Server error al actualizar tema.' });
  }
};

exports.updateSubtema = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};

    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido.' });
    }

    const subtema = await Subtema.findById(id);
    if (!subtema) return res.status(404).json({ error: 'Subtema no encontrado.' });

    // Validar duplicados dentro del mismo tema padre
    const duplicado = await Subtema.findOne({
      name: name.trim(),
      temaId: subtema.temaId,
      _id: { $ne: id }
    });
    if (duplicado) {
      return res.status(400).json({ error: 'Ya existe un subtema con este nombre en el mismo tema.' });
    }

    subtema.name = name.trim();
    await subtema.save();

    return res.json(subtema.serialize());
  } catch (err) {
    console.error('[academic:updateSubtema] error:', err.message);
    return res.status(500).json({ error: 'Server error al actualizar subtema.' });
  }
};

// =========================================================================
// 6. ACTUALIZAR CRITERIOS DE EVALUACIÓN (Árbol recursivo con validación server-side)
// =========================================================================
const { randomUUID } = require('crypto');

// Valida y normaliza recursivamente el árbol de criterios.
// Reglas importantes aplicadas:
// - Cada nodo tiene id (genera con crypto.randomUUID() si falta)
// - type: 'folder' | 'item'
// - weight: number 0..100
// - Para folders: sum(children.weight) <= folder.weight (bloqueante)
// - Profundidad máxima 3 niveles. Nivel 3 solo puede ser 'item'
function validateAndNormalizeNode(node, depth = 1) {
  if (!node || typeof node !== 'object') throw new Error('Nodo inválido en el árbol de evaluación.');

  // Ensure id
  if (!node.id) node.id = randomUUID();

  // Basic shape validations
  if (!node.name || typeof node.name !== 'string') throw new Error(`Nodo ${node.id} falta name.`);
  if (!['folder', 'item'].includes(node.type)) throw new Error(`Nodo ${node.id} tiene type inválido.`);
  if (typeof node.weight !== 'number' || node.weight < 0 || node.weight > 100) throw new Error(`Nodo ${node.id} tiene weight inválido (0-100).`);

  // Depth rules
  if (depth > 3) throw new Error('Profundidad máxima (3) excedida en criterios de evaluación.');
  if (depth === 3 && node.type === 'folder') {
    throw new Error('Regla de profundidad: nivel 3 solo puede contener ítems (type === "item").');
  }

  if (node.type === 'item') {
    // Items no deben tener children
    if (node.children && node.children.length) throw new Error(`Item ${node.id} no puede tener children.`);
    // grade puede ser null o number 0..100
    if (node.grade != null && (typeof node.grade !== 'number' || node.grade < 0 || node.grade > 100)) {
      throw new Error(`Item ${node.id} tiene grade inválido.`);
    }
    // Normalize fields
    return {
      id: String(node.id),
      name: node.name,
      type: 'item',
      weight: node.weight,
      grade: node.grade == null ? null : node.grade
    };
  }

  // Folder handling
  const children = Array.isArray(node.children) ? node.children : [];
  // Sum children weights and validate <= node.weight
  const sumChildren = children.reduce((acc, c) => acc + (typeof c.weight === 'number' ? c.weight : 0), 0);
  if (sumChildren > node.weight) {
    // Throw a specific error message expected by frontend to rollback
    throw new Error('Validación fallida: La suma de los subcriterios excede el peso asignado al elemento padre.');
  }

  const normalizedChildren = children.map((ch) => validateAndNormalizeNode(ch, depth + 1));

  return {
    id: String(node.id),
    name: node.name,
    type: 'folder',
    weight: node.weight,
    children: normalizedChildren
  };
}

exports.updateEvaluationCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const materia = await Materia.findById(id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });
    if (String(materia.userId) !== String(userId)) {
      return res.status(403).json({ error: 'No tienes permisos para modificar esta materia.' });
    }

    const { evaluationCriteria } = req.body || {};
    if (!Array.isArray(evaluationCriteria)) {
      return res.status(400).json({ error: 'Payload inválido: evaluationCriteria debe ser un array.' });
    }

    // Validar y normalizar cada nodo de primer nivel
    const normalized = evaluationCriteria.map((n) => validateAndNormalizeNode(n, 1));

    materia.evaluationCriteria = normalized;
    await materia.save();

    return res.status(200).json({ materia: materia.serialize() });
  } catch (err) {
    console.error('[academic:updateEvaluationCriteria] error:', err.message);
    // Si es un error de validación esperado, retornar 400 con mensaje legible
    if (err.message && err.message.startsWith('Validación')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && (err.message.includes('Profundidad') || err.message.includes('inválido') || err.message.includes('Item'))) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Server error al actualizar criterios de evaluación.' });
  }
};
