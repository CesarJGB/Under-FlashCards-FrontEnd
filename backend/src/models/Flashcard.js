const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
      index: true,
    },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    easeFactor: { type: Number, default: 2.5 },
    bgImageIndex: { type: Number, default: -1 },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    fontSize: { type: String, default: 'text-base' },
    contentImage: { type: String, default: '' },
    imageSide: { type: String, enum: ['question', 'answer', ''], default: '' }
  },
  { timestamps: true }
);

// Serializador nativo adjunto al esquema
flashcardSchema.methods.serialize = function (cardBackgrounds = []) {
  return {
    id: this._id,
    userId: this.userId,
    deckId: this.deckId,
    question: this.question,
    answer: this.answer,
    easeFactor: this.easeFactor,
    bgImage: (cardBackgrounds && this.bgImageIndex >= 0) ? (cardBackgrounds[this.bgImageIndex] || '') : '',
    textAlign: this.textAlign,
    fontSize: this.fontSize,
    contentImage: this.contentImage || '', 
    imageSide: this.imageSide || '',       
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Flashcard', flashcardSchema);
