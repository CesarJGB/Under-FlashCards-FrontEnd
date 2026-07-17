const mongoose = require('mongoose');

const inviteCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['unused', 'active', 'revoked'],
      default: 'unused',
      index: true,
    },
    redeemedByGoogleId: { type: String, default: null, index: true },
    redeemedByEmail: { type: String, default: null },
    redeemedAt: { type: Date, default: null },
    label: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InviteCode', inviteCodeSchema);
