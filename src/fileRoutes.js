const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const { requireAuth, requirePaid } = require('./sessionMiddleware');
const { getAssignmentById } = require('./store');

const router = express.Router();

// Keep preview link but redirect to secure viewer page
router.get('/file/:id/preview', requireAuth, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment) {
    return res.status(404).send('Assignment not found');
  }
  return res.redirect(`/secure-view/${assignment.id}`);
});

// Disable direct downloads while keeping UI button present
router.get('/file/:id/download', requireAuth, (req, res) => {
  if (req.accepts('html')) {
    req.flash('error', 'Download disabled for security');
    return res.redirect('/dashboard');
  }
  return res.status(403).json({ error: 'Download disabled for security' });
});

// Render a secure viewer page with watermark overlay
router.get('/secure-view/:id', requireAuth, requirePaid, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment) {
    req.flash('error', 'Assignment not found');
    return res.redirect('/dashboard');
  }

  res.render('secure-view', {
    title: `Secure View | ${assignment.title}`,
    assignment,
    viewerUrl: `/secure-file/${assignment.id}/raw`,
  });
});

// Stream the actual file content through the server (no redirects/exposed URLs)
router.get('/secure-file/:id/raw', requireAuth, requirePaid, async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }

  // Only allow streaming local uploads stored under /uploads
  const url = assignment.fileUrl;
  if (!url.startsWith('/uploads/')) {
    console.error('Blocked non-local file access attempt for', url);
    return res.status(404).send('File not found');
  }

  const localPath = path.join(__dirname, '..', url);
  const isPdf = assignment.fileType === 'pdf';
  if (isPdf) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
  }

  return res.sendFile(localPath, (err) => {
    if (err) {
      console.error('sendFile error', err);
      try {
        res.status(404).send('File not found');
      } catch (_) {}
    }
  });
});

module.exports = router;
