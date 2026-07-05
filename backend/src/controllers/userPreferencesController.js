// FILE: backend/src/controllers/userPreferencesController.js
const User = require('../models/User');

// GET /api/users/:userId/preferences
exports.getUserPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('quickViewMaterias homeSectionVisibility');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ 
      quickViewMaterias: user.quickViewMaterias || [],
      homeSectionVisibility: user.homeSectionVisibility || {
        quickView: true,
        detailedView: false,
        unclassifiedDecks: false
      }
    });
  } catch (error) {
    console.error('Error al obtener preferencias:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// PUT /api/users/:userId/preferences
exports.updateUserPreferences = async (req, res) => {
  try {
    const { quickViewMaterias, homeSectionVisibility } = req.body;
    
    const updateData = {};
    
    if (quickViewMaterias !== undefined) {
      if (!Array.isArray(quickViewMaterias)) {
        return res.status(400).json({ error: 'quickViewMaterias debe ser un array' });
      }
      updateData.quickViewMaterias = quickViewMaterias;
    }
    
    if (homeSectionVisibility !== undefined) {
      if (typeof homeSectionVisibility !== 'object') {
        return res.status(400).json({ error: 'homeSectionVisibility debe ser un objeto' });
      }
      updateData.homeSectionVisibility = homeSectionVisibility;
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('quickViewMaterias homeSectionVisibility');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ 
      success: true, 
      quickViewMaterias: user.quickViewMaterias || [],
      homeSectionVisibility: user.homeSectionVisibility || {
        quickView: true,
        detailedView: false,
        unclassifiedDecks: false
      }
    });
  } catch (error) {
    console.error('Error al actualizar preferencias:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

