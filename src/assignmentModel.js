const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema(
  {
    // Keep a stable string id so existing views that use `a.id` keep working
    id: { type: String, required: true, unique: true },
    subjectSlug: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileUrl: { type: String, required: true },
    originalName: { type: String, trim: true },
    fileType: { type: String, enum: ['image', 'pdf'], required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Assignment', AssignmentSchema);
