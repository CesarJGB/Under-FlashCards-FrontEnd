// FILE: backend/src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    name: String,
    picture: String,
    aiApiKey: { type: String, default: '' },
    quickViewMaterias: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Materia' 
    }],
    studyMetricsFilters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    homeWidgetOrder: {
      type: [Number],
      default: [0, 1, 2, 3]
    },
    homeSectionVisibility: {
      globalStats: { type: Boolean, default: false },
      quickView: { type: Boolean, default: false },
      detailedView: { type: Boolean, default: false },
      unclassifiedDecks: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

// Helper estático para enmascarar llaves
userSchema.statics.maskKey = (key) =>
  key ? `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : '';

module.exports = mongoose.model('User', userSchema);
