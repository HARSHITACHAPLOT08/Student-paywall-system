const express = require('express');
const { requireAuth } = require('./sessionMiddleware');
const { getAssignmentById } = require('./store');

const router = express.Router();

router.get('/file/:id/preview', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }
  
  // For PDFs (raw files), append ?fl=attachment:false to force inline viewing
  let previewUrl = assignment.fileUrl;
  if (assignment.fileType === 'pdf') {
    previewUrl = assignment.fileUrl.includes('?') 
      ? `${assignment.fileUrl}&fl=attachment:false`
      : `${assignment.fileUrl}?fl=attachment:false`;
  }
  
  res.redirect(previewUrl);
});

router.get('/file/:id/download', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }
  
  // Append ?dl=true to force download behavior
  let downloadUrl = assignment.fileUrl.includes('?')
    ? `${assignment.fileUrl}&dl=true`
    : `${assignment.fileUrl}?dl=true`;
  
  res.redirect(downloadUrl);
});

module.exports = router;
