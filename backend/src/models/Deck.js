// FILE: backend/src/models/Deck.js

const mongoose = require('mongoose');

const deckSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    coverColor: { type: String, default: '#ffffff' },
    coverImage: { type: String, default: '' },
    cardBackgrounds: { type: [String], default: [] },
    isStarred: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    isPublicReadOnly: { type: Boolean, default: false },

    // ==========================================
    // NUEVOS CAMPOS DE JERARQUÍA ACADÉMICA
    // ==========================================
    materiaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Materia',
      default: null,
      index: true,
    },
    parcialNumber: {
      type: Number,
      enum: [1, 2, 3],
      default: null,
      index: true,
    },
    temaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tema',
      default: null,
      index: true,
    },
    subtemaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subtema',
      default: null,
      index: true,
    }
  },
  { timestamps: true }
);

// Serializador nativo adjunto al esquema actualizado
deckSchema.methods.serialize = function (cardCount) {
  return {
    id: this._id,
    userId: this.userId,
    title: this.title,
    coverColor: this.coverColor,
    coverImage: this.coverImage,
    cardCount: typeof cardCount === 'number' ? cardCount : undefined,
    cardBackgrounds: this.cardBackgrounds || [], 
    isStarred: this.isStarred || false,
    isDefault: this.isDefault || false,
    isPublicReadOnly: this.isPublicReadOnly || false,
    
    // Inyección en la serialización para el cliente
    materiaId: this.materiaId || null,
    parcialNumber: this.parcialNumber || null,
    temaId: this.temaId || null,
    subtemaId: this.subtemaId || null,
    
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Deck', deckSchema);
