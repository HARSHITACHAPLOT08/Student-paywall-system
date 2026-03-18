const mongoose = require('mongoose');

const AccessPassSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true },
    contact: { type: String, trim: true }, // email or phone, optional
    razorpayOrderId: { type: String, required: true, index: true, unique: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },
    passcode: { type: String },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// TTL index to auto-remove expired passes
AccessPassSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AccessPass', AccessPassSchema);
