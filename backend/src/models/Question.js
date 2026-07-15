const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['multiple_choice', 'true_false', 'open'],
      required: true,
    },
    prompt: { type: String, required: true, trim: true },
    options: { type: [optionSchema], default: [] },
    correctOptionId: { type: String, default: null, trim: true },
    correctBoolean: { type: Boolean, default: null },
    expectedAnswer: { type: String, default: null, trim: true },
    sourceCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flashcard',
      default: null,
    },
    order: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

questionSchema.index({ examId: 1, order: 1 });

questionSchema.pre('validate', function validateQuestion() {
  const prompt = typeof this.prompt === 'string' ? this.prompt.trim() : '';
  if (!prompt) {
    this.invalidate('prompt', 'El enunciado es obligatorio.');
  } else {
    this.prompt = prompt;
  }

  if (!Number.isInteger(this.order) || this.order < 0) {
    this.invalidate('order', 'El orden debe ser un entero no negativo.');
  }

  if (this.type === 'multiple_choice') {
    const options = Array.isArray(this.options) ? this.options : [];
    const optionIds = new Set();

    if (options.length < 2) {
      this.invalidate('options', 'Las preguntas de opción múltiple requieren al menos dos opciones.');
    }

    options.forEach((option, index) => {
      const id = typeof option?.id === 'string' ? option.id.trim() : '';
      const text = typeof option?.text === 'string' ? option.text.trim() : '';
      if (!id) this.invalidate(`options.${index}.id`, 'Cada opción requiere un identificador.');
      if (!text) this.invalidate(`options.${index}.text`, 'Cada opción requiere texto.');
      if (id && optionIds.has(id)) {
        this.invalidate(`options.${index}.id`, 'Los identificadores de opción deben ser únicos.');
      }
      if (id) optionIds.add(id);
      if (option) {
        option.id = id;
        option.text = text;
      }
    });

    const correctOptionId = typeof this.correctOptionId === 'string'
      ? this.correctOptionId.trim()
      : '';
    if (!correctOptionId || !optionIds.has(correctOptionId)) {
      this.invalidate('correctOptionId', 'La opción correcta debe existir entre las opciones.');
    } else {
      this.correctOptionId = correctOptionId;
    }

    this.correctBoolean = null;
    this.expectedAnswer = null;
  } else if (this.type === 'true_false') {
    if (this.correctBoolean !== true && this.correctBoolean !== false) {
      this.invalidate('correctBoolean', 'Las preguntas verdadero/falso requieren una respuesta booleana.');
    }
    this.options = [];
    this.correctOptionId = null;
    this.expectedAnswer = null;
  } else if (this.type === 'open') {
    const expectedAnswer = typeof this.expectedAnswer === 'string' ? this.expectedAnswer.trim() : '';
    if (!expectedAnswer) {
      this.invalidate('expectedAnswer', 'Las preguntas abiertas requieren una respuesta esperada.');
    } else {
      this.expectedAnswer = expectedAnswer;
    }
    this.options = [];
    this.correctOptionId = null;
    this.correctBoolean = null;
  }
});

questionSchema.methods.serialize = function () {
  return {
    id: this._id ?? null,
    _id: this._id ?? null,
    examId: this.examId ?? null,
    type: this.type ?? null,
    prompt: this.prompt ?? '',
    options: Array.isArray(this.options)
      ? this.options.map((option) => ({
          id: option.id ?? '',
          text: option.text ?? '',
        }))
      : [],
    correctOptionId: this.correctOptionId ?? null,
    correctBoolean: typeof this.correctBoolean === 'boolean' ? this.correctBoolean : null,
    expectedAnswer: this.expectedAnswer ?? null,
    sourceCardId: this.sourceCardId ?? null,
    order: this.order ?? 0,
    createdAt: this.createdAt ?? null,
    updatedAt: this.updatedAt ?? null,
  };
};

module.exports = mongoose.model('Question', questionSchema);
