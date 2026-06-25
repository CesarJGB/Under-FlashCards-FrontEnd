// FILE: backend/src/controllers/academicController.js

const Materia = require('../models/Materia');
const Tema = require('../models/Tema');
const Subtema = require('../models/Subtema');
const Deck = require('../models/Deck');

// =========================================================================
// 1. MATERIAS (Asignaturas principales)
// =========================================================================

exports.getMaterias = async (req, res) => {
  try {
    const { userId } = req.params;
    const materias = await Materia.find({ userId }).sort({ name: 1 });
    return res.json(materias);
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
    return res.status(201).json(materia);
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
    return res.json(temas);
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
    return res.status(201).json(tema);
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
    return res.json(subtemas);
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
    return res.status(201).json(subtema);
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
