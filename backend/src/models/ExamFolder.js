const mongoose = require('mongoose');

const examFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamFolder', default: null, index: true },
  },
  { timestamps: true }
);

examFolderSchema.index({ userId: 1, parentId: 1, name: 1 }, { unique: true });

examFolderSchema.methods.serialize = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    userId: this.userId,
    parentId: this.parentId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('ExamFolder', examFolderSchema);
