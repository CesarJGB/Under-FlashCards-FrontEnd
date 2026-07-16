// FILE: backend/src/controllers/userPreferencesController.js
const User = require('../models/User');

const DEFAULT_HOME_SECTION_VISIBILITY = {
  globalStats: false,
  quickView: false,
  detailedView: false,
  unclassifiedDecks: false
};
const DEFAULT_HOME_WIDGET_ORDER = [0, 1, 2, 3];

function normalizeHomeSectionVisibility(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return DEFAULT_HOME_SECTION_VISIBILITY;
  }

  return {
    globalStats: Boolean(input.globalStats),
    quickView: Boolean(input.quickView),
    detailedView: Boolean(input.detailedView),
    unclassifiedDecks: Boolean(input.unclassifiedDecks)
  };
}

function normalizeHomeWidgetOrder(input) {
  if (input == null) return DEFAULT_HOME_WIDGET_ORDER;
  if (!Array.isArray(input)) {
    throw new Error('homeWidgetOrder debe ser un array');
  }

  const allowedIds = new Set(DEFAULT_HOME_WIDGET_ORDER);
  const uniqueIds = [];

  input
    .map(Number)
    .forEach((id) => {
      if (!allowedIds.has(id)) return;
      if (uniqueIds.includes(id)) return;
      uniqueIds.push(id);
    });

  const missingIds = DEFAULT_HOME_WIDGET_ORDER.filter((id) => !uniqueIds.includes(id));
  return [...uniqueIds, ...missingIds];
}

function normalizeStudyMetricsFilters(input) {
  if (input == null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('studyMetricsFilters debe ser un objeto');
  }

  const normalized = {};

  Object.entries(input).forEach(([materiaId, parciales]) => {
    if (!materiaId) return;
    if (!Array.isArray(parciales)) {
      throw new Error(`studyMetricsFilters.${materiaId} debe ser un array`);
    }

    const uniqueValidParciales = [...new Set(
      parciales
        .map(Number)
        .filter((value) => [1, 2, 3].includes(value))
    )].sort((a, b) => a - b);

    if (uniqueValidParciales.length > 0) {
      normalized[materiaId] = uniqueValidParciales;
    }
  });

  return normalized;
}

// GET /api/users/:userId/preferences
exports.getUserPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('quickViewMaterias homeSectionVisibility studyMetricsFilters homeWidgetOrder');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ 
      quickViewMaterias: user.quickViewMaterias || [],
      homeSectionVisibility: normalizeHomeSectionVisibility(user.homeSectionVisibility),
      studyMetricsFilters: normalizeStudyMetricsFilters(user.studyMetricsFilters),
      homeWidgetOrder: normalizeHomeWidgetOrder(user.homeWidgetOrder)
    });
  } catch (error) {
    console.error('Error al obtener preferencias:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// PUT /api/users/:userId/preferences
exports.updateUserPreferences = async (req, res) => {
  try {
    const { quickViewMaterias, homeSectionVisibility, studyMetricsFilters, homeWidgetOrder } = req.body;
    
    const updateData = {};
    
    if (quickViewMaterias !== undefined) {
      if (!Array.isArray(quickViewMaterias)) {
        return res.status(400).json({ error: 'quickViewMaterias debe ser un array' });
      }
      updateData.quickViewMaterias = quickViewMaterias;
    }
    
    if (homeSectionVisibility !== undefined) {
      if (typeof homeSectionVisibility !== 'object' || Array.isArray(homeSectionVisibility)) {
        return res.status(400).json({ error: 'homeSectionVisibility debe ser un objeto' });
      }
      updateData.homeSectionVisibility = normalizeHomeSectionVisibility(homeSectionVisibility);
    }

    if (studyMetricsFilters !== undefined) {
      try {
        updateData.studyMetricsFilters = normalizeStudyMetricsFilters(studyMetricsFilters);
      } catch (error) {
        return res.status(400).json({ error: error.message || 'studyMetricsFilters es inválido' });
      }
    }

    if (homeWidgetOrder !== undefined) {
      try {
        updateData.homeWidgetOrder = normalizeHomeWidgetOrder(homeWidgetOrder);
      } catch (error) {
        return res.status(400).json({ error: error.message || 'homeWidgetOrder es inválido' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).select('quickViewMaterias homeSectionVisibility studyMetricsFilters homeWidgetOrder');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ 
      success: true, 
      quickViewMaterias: user.quickViewMaterias || [],
      homeSectionVisibility: normalizeHomeSectionVisibility(user.homeSectionVisibility),
      studyMetricsFilters: normalizeStudyMetricsFilters(user.studyMetricsFilters),
      homeWidgetOrder: normalizeHomeWidgetOrder(user.homeWidgetOrder)
    });
  } catch (error) {
    console.error('Error al actualizar preferencias:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
