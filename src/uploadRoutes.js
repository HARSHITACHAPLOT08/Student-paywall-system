const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const { requireAuth, requireOwner } = require('./sessionMiddleware');
const { SUBJECTS } = require('./subjects');
const { addAssignment, deleteAssignment, updateAssignmentFile, getAssignmentById } = require('./store');
const { uploadsRoot } = require('./storage');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

// Use disk storage as a temporary location; files are then pushed to Cloudinary
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const subjectSlug = req.body.subjectSlug || 'general';
    const subjectDir = path.join(uploadsRoot, subjectSlug);
    if (!fs.existsSync(subjectDir)) {
      fs.mkdirSync(subjectDir, { recursive: true });
    }
    cb(null, subjectDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, or PDF files are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/upload', requireAuth, requireOwner, upload.single('file'), async (req, res) => {
  try {
    const { subjectSlug, title, description } = req.body;

    if (!subjectSlug || !title || !req.file) {
      req.flash('error', 'Subject, title and file are required.');
      return res.redirect('/dashboard');
    }

    const subjectExists = SUBJECTS.some((s) => s.slug === subjectSlug);
    if (!subjectExists) {
      req.flash('error', 'Invalid subject selected.');
      return res.redirect('/dashboard');
    }

    const fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';

    // Upload the received file to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'auto',
      folder: `assignment-vault/${subjectSlug}`,
    });

    const fileUrl = uploadResult.secure_url;

    await addAssignment({
      subjectSlug,
      title: title.trim(),
      description: (description || '').trim(),
      fileUrl,
      originalName: req.file.originalname,
      fileType,
    });

    // Best-effort cleanup of the temporary local file
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (_) {}

    req.flash('success', 'Assignment uploaded successfully.');
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', err.message || 'Upload failed. Please try again.');
    res.redirect('/dashboard');
  }
});

router.post('/assignments/:id/delete', requireAuth, requireOwner, async (req, res) => {
  try {
    const assignment = await deleteAssignment(req.params.id);
    if (assignment) {
      // Optionally: delete from Cloudinary if public_id is stored in future
      req.flash('success', 'Assignment deleted.');
    } else {
      req.flash('error', 'Assignment not found.');
    }
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to delete assignment.');
  }
  res.redirect('/dashboard');
});

router.post('/assignments/:id/replace', requireAuth, requireOwner, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'Please select a file to replace.');
      return res.redirect('/dashboard');
    }

    const existing = await getAssignmentById(req.params.id);
    if (!existing) {
      req.flash('error', 'Assignment not found.');
      return res.redirect('/dashboard');
    }

    const fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'auto',
      folder: `assignment-vault/${existing.subjectSlug}`,
    });

    const fileUrl = uploadResult.secure_url;

    await updateAssignmentFile(existing.id, {
      fileUrl,
      originalName: req.file.originalname,
      fileType,
    });

    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (_) {}

    req.flash('success', 'Assignment file replaced.');
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to replace file.');
    res.redirect('/dashboard');
  }
});

module.exports = router;
