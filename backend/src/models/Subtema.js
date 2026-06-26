// FILE: backend/src/models/Subtema.js

const mongoose = require('mongoose');

const subtemaSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    temaId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Tema', 
      required: true,
      index: true
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

module.exports = mongoose.model('Subtema', subtemaSchema);
