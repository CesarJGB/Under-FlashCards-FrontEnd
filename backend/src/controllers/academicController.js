// FILE: backend/src/controllers/academicController.js

const Materia = require('../models/Materia');
const Tema = require('../models/Tema');
const Subtema = require('../models/Subtema');
const Deck = require('../models/Deck');
const Flashcard = require('../models/Flashcard');
const ReviewLog = require('../models/ReviewLog');
const { calculateRadarMetrics } = require('../utils/radarMetrics');
const { randomUUID } = require('crypto');

const ALLOWED_PARCIALES = [1, 2, 3];
const ALLOWED_HISTORY_WINDOWS = [7, 14, 30];

function normalizeParcialesInput(rawParciales) {
  const source = Array.isArray(rawParciales) ? rawParciales : String(rawParciales || '').split(',');
  const normalized = [...new Set(
    source
      .map(Number)
      .filter((value) => ALLOWED_PARCIALES.includes(value))
  )].sort((a, b) => a - b);

  return normalized.length > 0 ? normalized : [...ALLOWED_PARCIALES];
}

function normalizeHistoryWindow(rawValue) {
  const parsed = Number(rawValue);
  return ALLOWED_HISTORY_WINDOWS.includes(parsed) ? parsed : 14;
}

function buildHistoryDateKeys(days) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const labels = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    labels.push(date.toISOString().slice(0, 10));
  }

  return labels;
}

function buildHistoryPoint(date, bucket = null) {
  const reviews = bucket?.reviews || 0;
  const correctCount = bucket?.correctCount || 0;
  const incorrectCount = bucket?.incorrectCount || 0;
  const totalResponseTimeMs = bucket?.totalResponseTimeMs || 0;

  return {
    date,
    reviews,
    correctCount,
    incorrectCount,
    totalResponseTimeMs,
    avgResponseTimeMs: reviews > 0 ? Math.round(totalResponseTimeMs / reviews) : 0,
    accuracyRate: reviews > 0 ? Number((correctCount / reviews).toFixed(2)) : 0
  };
}

function summarizeHistoryPoints(points = []) {
  const totals = points.reduce((acc, point) => {
    acc.reviews += point.reviews || 0;
    acc.correctCount += point.correctCount || 0;
    acc.incorrectCount += point.incorrectCount || 0;
    acc.totalResponseTimeMs += point.totalResponseTimeMs || 0;
    return acc;
  }, {
    reviews: 0,
    correctCount: 0,
    incorrectCount: 0,
    totalResponseTimeMs: 0
  });

  return {
    totalReviews: totals.reviews,
    correctCount: totals.correctCount,
    incorrectCount: totals.incorrectCount,
    totalResponseTimeMs: totals.totalResponseTimeMs,
    avgResponseTimeMs: totals.reviews > 0 ? Math.round(totals.totalResponseTimeMs / totals.reviews) : 0,
    accuracyRate: totals.reviews > 0 ? Number((totals.correctCount / totals.reviews).toFixed(2)) : 0,
    points
  };
}

function serializePublicMateriaProfile(materia, temasByParcial, deckCount, cardsCount) {
  const serialized = materia.serialize();
  const activeParciales = Array.isArray(serialized.activeParciales) && serialized.activeParciales.length
    ? serialized.activeParciales
    : [1, 2, 3];
  const parcialCountMap = new Map(
    temasByParcial.map(item => [Number(item._id), item.count])
  );

  return {
    shareId: serialized.publicProfile?.shareId || null,
    materia: {
      id: serialized.id,
      _id: serialized._id,
      name: serialized.name,
      analytics: serialized.analytics,
      activeParciales,
      metaCalificacion: serialized.metaCalificacion,
      evaluationCriteria: serialized.evaluationCriteria,
      createdAt: serialized.createdAt,
      publicProfile: {
        enabled: !!serialized.publicProfile?.enabled,
        shareId: serialized.publicProfile?.shareId || null,
        sharedAt: serialized.publicProfile?.sharedAt || null
      }
    },
    stats: {
      temasCount: temasByParcial.reduce((sum, item) => sum + (item.count || 0), 0),
      decksCount: deckCount,
      cardsCount,
      parciales: [1, 2, 3].map(number => ({
        number,
        temasCount: parcialCountMap.get(number) || 0,
        isActive: activeParciales.includes(number)
      }))
    }
  };
}

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

exports.enablePublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const materia = await Materia.findById(id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });
    if (String(materia.userId) !== String(userId)) {
      return res.status(403).json({ error: 'No tienes permisos para compartir esta materia.' });
    }

    materia.publicProfile = {
      enabled: true,
      shareId: materia.publicProfile?.shareId || randomUUID().replace(/-/g, ''),
      sharedAt: materia.publicProfile?.sharedAt || new Date()
    };

    await materia.save();

    return res.json({ materia: materia.serialize() });
  } catch (err) {
    console.error('[academic:enablePublicProfile] error:', err.message);
    return res.status(500).json({ error: 'Server error al compartir la materia.' });
  }
};

exports.getPublicMateriaProfile = async (req, res) => {
  try {
    const { shareId } = req.params;

    const materia = await Materia.findOne({
      'publicProfile.shareId': shareId,
      'publicProfile.enabled': true
    });

    if (!materia) {
      return res.status(404).json({ error: 'Perfil público de materia no encontrado.' });
    }

    const deckDocs = await Deck.find({ materiaId: materia._id }).select('_id');
    const deckIds = deckDocs.map(deck => deck._id);

    const [temasByParcial, cardsAgg] = await Promise.all([
      Tema.aggregate([
        { $match: { materiaId: materia._id } },
        { $group: { _id: '$parcialNumber', count: { $sum: 1 } } }
      ]),
      deckIds.length > 0
        ? Flashcard.aggregate([
            { $match: { deckId: { $in: deckIds } } },
            { $group: { _id: null, total: { $sum: 1 } } }
          ])
        : Promise.resolve([])
    ]);

    return res.json(
      serializePublicMateriaProfile(
        materia,
        temasByParcial,
        deckDocs.length,
        cardsAgg[0]?.total || 0
      )
    );
  } catch (err) {
    console.error('[academic:getPublicMateriaProfile] error:', err.message);
    return res.status(500).json({ error: 'Server error al obtener el perfil público de la materia.' });
  }
};

// ✅ MODIFICADO: Soporte para metaCalificacion por defecto
exports.createMateria = async (req, res) => {
  try {
    // 1. Extraemos metaCalificacion (si el usuario la define desde el inicio)
    const { userId, name, metaCalificacion } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la materia es requerido.' });

    const existe = await Materia.findOne({ name: name.trim(), userId });
    if (existe) return res.status(400).json({ error: 'Ya tienes una materia registrada con este nombre.' });

    // 2. Si no mandan una meta, le asignamos 70 por defecto
    const meta = metaCalificacion !== undefined ? Number(metaCalificacion) : 70;

    const materia = await Materia.create({ 
      userId, 
      name: name.trim(),
      metaCalificacion: meta 
    });
    
    return res.status(201).json(materia.serialize());
  } catch (err) {
    console.error('[academic:createMateria] error:', err.message);
    return res.status(500).json({ error: 'Server error al crear materia.' });
  }
};

// 🐛 CORREGIDO: Bug de limpieza en cascada (se obtenían IDs antes de borrar)
exports.deleteMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const materia = await Materia.findByIdAndDelete(id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });

    // FIX: Obtener los IDs de los temas ANTES de eliminarlos
    const temaIds = await Tema.find({ materiaId: id }).distinct('_id');

    // Limpieza en cascada para no corromper la base de datos
    await Subtema.deleteMany({ temaId: { $in: temaIds } });
    await Tema.deleteMany({ materiaId: id });
    
    // Desvincular los mazos (no los borramos para cumplir la regla de negocio de no perder datos)
    await Deck.updateMany(
      { materiaId: id }, 
      { $set: { materiaId: null, parcialNumber: null, temaId: null, subtemaId: null } }
    );

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
      { returnDocument: 'after' }
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
    const parciales = normalizeParcialesInput(req.query.parciales || ALLOWED_PARCIALES);

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

exports.getMetricsHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const parciales = normalizeParcialesInput(req.query.parciales || ALLOWED_PARCIALES);
    const days = normalizeHistoryWindow(req.query.days);

    const materia = await Materia.findById(id).select('_id userId');
    if (!materia) {
      return res.status(404).json({ error: 'Materia no encontrada.' });
    }

    const dateKeys = buildHistoryDateKeys(days);
    const rangeStart = new Date(`${dateKeys[0]}T00:00:00.000Z`);

    const historyBuckets = await ReviewLog.aggregate([
      {
        $match: {
          userId: materia.userId,
          materiaId: materia._id,
          timestamp: { $gte: rangeStart }
        }
      },
      {
        $lookup: {
          from: 'decks',
          let: { reviewDeckId: '$deckId' },
          as: 'deckMeta',
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$reviewDeckId']
                }
              }
            },
            { $project: { parcialNumber: 1 } }
          ]
        }
      },
      {
        $addFields: {
          resolvedParcialNumber: {
            $ifNull: [
              '$parcialNumber',
              { $arrayElemAt: ['$deckMeta.parcialNumber', 0] }
            ]
          }
        }
      },
      {
        $match: {
          resolvedParcialNumber: { $in: parciales }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp',
                timezone: 'UTC'
              }
            },
            parcialNumber: '$resolvedParcialNumber'
          },
          reviews: { $sum: 1 },
          correctCount: {
            $sum: {
              $cond: ['$wasCorrect', 1, 0]
            }
          },
          incorrectCount: {
            $sum: {
              $cond: ['$wasCorrect', 0, 1]
            }
          },
          totalResponseTimeMs: { $sum: '$responseTimeMs' }
        }
      },
      {
        $sort: {
          '_id.date': 1,
          '_id.parcialNumber': 1
        }
      }
    ]);

    const bucketMap = new Map(
      historyBuckets.map((bucket) => [
        `${bucket._id.parcialNumber}::${bucket._id.date}`,
        bucket
      ])
    );

    const series = parciales.map((parcial) => {
      const points = dateKeys.map((date) => buildHistoryPoint(date, bucketMap.get(`${parcial}::${date}`)));
      return {
        parcial,
        ...summarizeHistoryPoints(points)
      };
    });

    const totalPoints = dateKeys.map((date) => {
      const merged = series.reduce((acc, item) => {
        const point = item.points.find((currentPoint) => currentPoint.date === date);
        if (!point) return acc;
        acc.reviews += point.reviews || 0;
        acc.correctCount += point.correctCount || 0;
        acc.incorrectCount += point.incorrectCount || 0;
        acc.totalResponseTimeMs += point.totalResponseTimeMs || 0;
        return acc;
      }, {
        reviews: 0,
        correctCount: 0,
        incorrectCount: 0,
        totalResponseTimeMs: 0
      });

      return buildHistoryPoint(date, merged);
    });

    return res.json({
      materiaId: String(materia._id),
      parciales,
      days,
      series,
      total: summarizeHistoryPoints(totalPoints)
    });
  } catch (err) {
    console.error('[academic:getMetricsHistory] error:', err.message);
    return res.status(500).json({ error: 'Server error al calcular histórico de métricas.' });
  }
};

// =========================================================================
// 5. EDICIÓN DE NOMBRE Y META (Renombrar carpetas académicas + Meta)
// =========================================================================

// ✅ MODIFICADO: Soporte para actualizar metaCalificacion y validación parcial
exports.updateMateria = async (req, res) => {
  try {
    const { id } = req.params;
    // 1. Aceptamos tanto el 'name' como la 'metaCalificacion' en el cuerpo del request
    const { name, metaCalificacion } = req.body || {};

    const materia = await Materia.findById(id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada.' });

    // 2. Si se envía un nuevo nombre, validamos duplicados
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
      
      const duplicado = await Materia.findOne({
        name: name.trim(),
        userId: materia.userId,
        _id: { $ne: id }
      });
      if (duplicado) return res.status(400).json({ error: 'Ya tienes una materia registrada con este nombre.' });
      
      materia.name = name.trim();
    }

    // 3. Si se envía una nueva meta, la validamos y guardamos
    if (metaCalificacion !== undefined) {
      const parsedMeta = Number(metaCalificacion);
      if (isNaN(parsedMeta) || parsedMeta < 0 || parsedMeta > 100) {
        return res.status(400).json({ error: 'La meta de calificación debe ser un número entre 0 y 100.' });
      }
      materia.metaCalificacion = parsedMeta;
    }

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
