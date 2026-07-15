const mongoose = require('mongoose');
const ExamFolder = require('../models/ExamFolder');

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

exports.getExamFolders = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId)) {
      return res.status(400).json({ error: 'Usuario inválido.' });
    }

    const folders = await ExamFolder.find({ userId }).sort({ name: 1 });
    return res.json(folders.map((folder) => folder.serialize()));
  } catch (err) {
    console.error('[examFolders:get] error:', err.message);
    return res.status(500).json({ error: 'No se pudieron obtener las carpetas de exámenes.' });
  }
};

exports.createExamFolder = async (req, res) => {
  try {
    const { userId, name, parentId = null } = req.body || {};
    if (!isValidId(userId) || !name?.trim()) {
      return res.status(400).json({ error: 'El usuario y el nombre de la carpeta son obligatorios.' });
    }

    let resolvedParentId = null;
    if (parentId) {
      if (!isValidId(parentId)) {
        return res.status(400).json({ error: 'Carpeta padre inválida.' });
      }

      const parent = await ExamFolder.findOne({ _id: parentId, userId });
      if (!parent) {
        return res.status(404).json({ error: 'La carpeta padre no existe.' });
      }
      if (parent.parentId) {
        return res.status(400).json({ error: 'No se pueden crear subcarpetas dentro de otra subcarpeta.' });
      }
      resolvedParentId = parent._id;
    }

    const duplicate = await ExamFolder.findOne({
      userId,
      parentId: resolvedParentId,
      name: name.trim(),
    });
    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
    }

    const folder = await ExamFolder.create({
      userId,
      name: name.trim(),
      parentId: resolvedParentId,
    });
    return res.status(201).json(folder.serialize());
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
    }
    console.error('[examFolders:create] error:', err.message);
    return res.status(500).json({ error: 'No se pudo crear la carpeta de exámenes.' });
  }
};

exports.updateExamFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name } = req.body || {};
    if (!isValidId(id) || !isValidId(userId) || !name?.trim()) {
      return res.status(400).json({ error: 'El usuario y el nombre de la carpeta son obligatorios.' });
    }

    const folder = await ExamFolder.findOne({ _id: id, userId });
    if (!folder) {
      return res.status(404).json({ error: 'Carpeta de exámenes no encontrada.' });
    }

    const duplicate = await ExamFolder.findOne({
      userId,
      parentId: folder.parentId || null,
      name: name.trim(),
      _id: { $ne: folder._id },
    });
    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
    }

    folder.name = name.trim();
    await folder.save();
    return res.json(folder.serialize());
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
    }
    console.error('[examFolders:update] error:', err.message);
    return res.status(500).json({ error: 'No se pudo renombrar la carpeta de exámenes.' });
  }
};
