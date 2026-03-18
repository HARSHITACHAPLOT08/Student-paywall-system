const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const { requireAuth, requireOwner } = require('./sessionMiddleware');
const { SUBJECTS } = require('./subjects');
const { addAssignment, deleteAssignment, updateAssignmentFile, getAssignmentById } = require('./store');
const { uploadsRoot } = require('./storage');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const subjectSlug = req.body.subjectSlug;
    const subjectDir = path.join(uploadsRoot, subjectSlug || 'general');
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

    await addAssignment({
      subjectSlug,
      title: title.trim(),
      description: (description || '').trim(),
      filename: path.relative(uploadsRoot, req.file.path),
      originalName: req.file.originalname,
      fileType,
    });

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
      const filePath = path.join(uploadsRoot, assignment.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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

    const oldPath = path.join(uploadsRoot, existing.filename);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }

    const fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';

    await updateAssignmentFile(existing.id, {
      filename: path.relative(uploadsRoot, req.file.path),
      originalName: req.file.originalname,
      fileType,
    });

    req.flash('success', 'Assignment file replaced.');
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to replace file.');
    res.redirect('/dashboard');
  }
});

module.exports = router;
