const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    answer: { type: mongoose.Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, default: null },
  },
  { _id: false }
);

const examAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    perTypeBreakdown: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    answers: { type: [answerSchema], default: [] },
    mode: { type: String, default: 'practice', trim: true },
    durationSeconds: { type: Number, default: null, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

examAttemptSchema.index({ userId: 1, examId: 1, createdAt: -1 });

examAttemptSchema.pre('validate', function validateAttempt() {
  if (this.score > this.total) {
    this.invalidate('score', 'La puntuación no puede superar el total.');
  }
});

examAttemptSchema.methods.serialize = function () {
  return {
    id: this._id ?? null,
    _id: this._id ?? null,
    userId: this.userId ?? null,
    examId: this.examId ?? null,
    score: this.score ?? 0,
    total: this.total ?? 0,
    perTypeBreakdown: this.perTypeBreakdown ?? {},
    answers: Array.isArray(this.answers)
      ? this.answers.map((answer) => ({
          questionId: answer.questionId ?? null,
          answer: answer.answer ?? null,
          isCorrect: typeof answer.isCorrect === 'boolean' ? answer.isCorrect : null,
        }))
      : [],
    mode: this.mode ?? null,
    durationSeconds: this.durationSeconds ?? null,
    createdAt: this.createdAt ?? null,
  };
};

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
