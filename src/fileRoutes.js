const path = require('path');
const fs = require('fs');
const express = require('express');
const { requireAuth } = require('./sessionMiddleware');
const { getAssignmentById } = require('./store');
const { uploadsRoot } = require('./storage');

const router = express.Router();

router.get('/file/:id/preview', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment) {
    return res.status(404).send('File not found');
  }
  const filePath = path.join(uploadsRoot, assignment.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File missing');
  }
  res.sendFile(filePath);
});

router.get('/file/:id/download', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment) {
    return res.status(404).send('File not found');
  }
  const filePath = path.join(uploadsRoot, assignment.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File missing');
  }
  res.download(filePath, assignment.originalName || undefined);
});

module.exports = router;
