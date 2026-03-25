const express = require('express');
const { requireAuth } = require('./sessionMiddleware');
const { getAssignmentById } = require('./store');

const router = express.Router();

router.get('/file/:id/preview', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }
  // Redirect to the Cloudinary URL; browser will handle viewing
  res.redirect(assignment.fileUrl);
});

router.get('/file/:id/download', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }
  // Let the browser download from Cloudinary directly
  res.redirect(assignment.fileUrl);
});

module.exports = router;
