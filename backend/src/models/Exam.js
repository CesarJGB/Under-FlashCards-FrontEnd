const mongoose = require('mongoose');

const sourceDeckSchema = new mongoose.Schema(
  {
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
    },
    questionCount: { type: Number, required: true, min: 1, max: 100 },
  },
  { _id: false }
);

const folderPathSchema = new mongoose.Schema(
  {
    materiaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', default: null },
    temaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tema', default: null },
    subtemaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subtema', default: null },
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamFolder',
      default: null,
      index: true,
    },
    folderPath: { type: folderPathSchema, default: null },
    sourceType: {
      type: String,
      enum: ['scratch', 'from_deck'],
      required: true,
      default: 'scratch',
    },
    sourceDecks: { type: [sourceDeckSchema], default: [] },
    questionCount: { type: Number, required: true, default: 0, min: 0, max: 100 },
    isStarred: { type: Boolean, default: false },
  },
  { timestamps: true }
);

examSchema.index({ userId: 1, folderId: 1, createdAt: -1 });

examSchema.pre('validate', function validateExam() {
  const sourceDecks = Array.isArray(this.sourceDecks) ? this.sourceDecks : [];
  const sourceTotal = sourceDecks.reduce(
    (total, sourceDeck) => total + (Number(sourceDeck.questionCount) || 0),
    0
  );

  if (this.sourceType === 'scratch' && sourceDecks.length > 0) {
    this.invalidate('sourceDecks', 'Los exámenes desde cero no pueden tener mazos de origen.');
  }
  if (this.sourceType === 'from_deck' && sourceDecks.length === 0) {
    this.invalidate('sourceDecks', 'Selecciona al menos un mazo de origen.');
  }
  if (sourceTotal > 100) {
    this.invalidate('sourceDecks', 'La suma de preguntas de los mazos no puede superar 100.');
  }
});

examSchema.methods.serialize = function () {
  const folderPath = this.folderPath
    ? {
        materiaId: this.folderPath.materiaId ?? null,
        temaId: this.folderPath.temaId ?? null,
        subtemaId: this.folderPath.subtemaId ?? null,
      }
    : null;

  return {
    id: this._id ?? null,
    _id: this._id ?? null,
    userId: this.userId ?? null,
    title: this.title ?? '',
    folderId: this.folderId ?? null,
    folderPath,
    sourceType: this.sourceType ?? 'scratch',
    sourceDecks: Array.isArray(this.sourceDecks)
      ? this.sourceDecks.map((sourceDeck) => ({
          deckId: sourceDeck.deckId ?? null,
          questionCount: sourceDeck.questionCount ?? 0,
        }))
      : [],
    questionCount: this.questionCount ?? 0,
    isStarred: this.isStarred ?? false,
    createdAt: this.createdAt ?? null,
    updatedAt: this.updatedAt ?? null,
  };
};

module.exports = mongoose.model('Exam', examSchema);
