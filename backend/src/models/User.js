const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    name: String,
    picture: String,
    aiApiKey: { type: String, default: '' },
  },
  { timestamps: true }
);

// Helper estático para enmascarar llaves
userSchema.statics.maskKey = (key) =>
  key ? `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : '';

module.exports = mongoose.model('User', userSchema);
