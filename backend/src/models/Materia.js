// FILE: backend/src/models/Materia.js

const mongoose = require('mongoose');

const materiaSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

// Evitamos que un mismo estudiante duplique el nombre de una materia
materiaSchema.index({ name: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Materia', materiaSchema);
