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
    isPublicReadOnly: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Serializador nativo adjunto al esquema
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
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Deck', deckSchema);
