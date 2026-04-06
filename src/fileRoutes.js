const express = require('express');
const { requireAuth } = require('./sessionMiddleware');
const { getAssignmentById } = require('./store');

const router = express.Router();

router.get('/file/:id/preview', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }
  
  // URL already includes fl_attachment:false in path from upload
  // Redirect to Cloudinary URL for inline viewing
  res.redirect(assignment.fileUrl);
});

router.get('/file/:id/download', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }
  
  // Append ?dl=true to force download behavior
  const downloadUrl = assignment.fileUrl.includes('?')
    ? `${assignment.fileUrl}&dl=true`
    : `${assignment.fileUrl}?dl=true`;
  
  res.redirect(downloadUrl);
});

module.exports = router;
