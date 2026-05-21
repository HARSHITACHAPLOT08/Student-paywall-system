const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = fs.promises;
// pdf-lib is required lazily inside addWatermarkToPdf so the server can start
// even if the dependency hasn't been installed yet. If it's missing, the
// viewer will still receive the original PDF (watermarking skipped).
const { requireAuth, requirePaid } = require('./sessionMiddleware');
const { getAssignmentById } = require('./store');

const router = express.Router();

const uploadsDir = path.resolve(__dirname, '..', 'uploads');

function getViewerTokenSecret() {
  return process.env.SESSION_SECRET || 'assignment-vault-viewer-secret';
}

function createViewerToken({ assignmentId, sessionId, userName, expiresAt }) {
  const crypto = require('crypto');
  const payload = `${assignmentId}|${sessionId}|${userName || ''}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', getViewerTokenSecret())
    .update(payload)
    .digest('hex');
  return `${expiresAt}.${signature}`;
}

function isViewerTokenValid(token, { assignmentId, sessionId, userName }) {
  if (!token) return false;
  const crypto = require('crypto');
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const expiresAt = Number(parts[0]);
  const signature = parts[1];
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const payload = `${assignmentId}|${sessionId}|${userName || ''}|${expiresAt}`;
  const expected = crypto
    .createHmac('sha256', getViewerTokenSecret())
    .update(payload)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

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

  const expiresAt = Date.now() + 10 * 60 * 1000;
  const viewerToken = createViewerToken({
    assignmentId: assignment.id,
    sessionId: req.sessionID,
    userName: req.session?.user?.name || '',
    expiresAt,
  });

  res.render('secure-view', {
    title: `Secure View | ${assignment.title}`,
    assignment,
    // provide token and id only (no direct URL exposure)
    viewerToken: viewerToken,
    assignmentId: assignment.id,
  });
});

// Stream the actual file content through the server (no redirects/exposed URLs)
router.get('/secure-file/:id/raw', async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment || !assignment.fileUrl) {
    return res.status(404).send('File not found');
  }

  const hasPaidSession = Boolean(
    req.session &&
      req.session.user &&
      req.session.isPaid &&
      (!req.session.expiry || req.session.expiry > Date.now())
  );
  // Accept viewer token from query param or header (Bearer or x-viewer-token)
  const headerToken = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '') || req.get('x-viewer-token') || '';
  const tokenToCheck = req.query.token || headerToken;

  const hasViewerToken = isViewerTokenValid(tokenToCheck, {
    assignmentId: assignment.id,
    sessionId: req.sessionID || '',
    userName: req.session?.user?.name || '',
  });

  if (!hasPaidSession && !hasViewerToken) {
    return res.status(403).send('Forbidden');
  }

  // (debug logs removed)

  // Only allow streaming local uploads stored under /uploads
  // Normalize fileUrl: accept both '/uploads/...' and 'uploads/...'
  let url = assignment.fileUrl || '';
  if (url && !url.startsWith('/')) url = '/' + url;
  const isPdf = assignment.fileType === 'pdf';

  // Helper: apply security headers (tighten CORS to same-origin)
  function setSecurityHeaders() {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Content-Disposition set later when we know it's a PDF
    const origin = req.get('origin');
    const hostOrigin = `${req.protocol}://${req.get('host')}`;
    // Only allow same-origin CORS
    if (origin && origin === hostOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', hostOrigin);
    }
    // Prevent embedding
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; default-src 'self';");
  }

  // Local file stored under /uploads/
  if (!url.startsWith('/uploads/')) {
    console.warn('secure-file: rejected non-local fileUrl', { assignmentId: assignment.id, fileUrl: assignment.fileUrl });
    // We no longer proxy remote URLs. Require local uploads only.
    return res.status(404).send('File not found');
  }

  // Resolve and ensure path is within uploadsDir
  const localPath = path.resolve(__dirname, '..', '.' + url);
  // resolved local path check
  if (!localPath.startsWith(uploadsDir + path.sep) && localPath !== uploadsDir) {
    console.error('Attempted path traversal or invalid upload path', localPath);
    return res.status(400).send('Invalid file path');
  }

  try {
    if (!fs.existsSync(localPath)) {
      console.error('secure-file: local file missing', { localPath, assignmentId: assignment.id });
      return res.status(404).send('File not found');
    }
    const data = await fsp.readFile(localPath);
    if (isPdf) {
      setSecurityHeaders();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      // Apply watermark but fallback to original if anything fails
      try {
        const pdfBytes = await addWatermarkToPdf(data, req);
        return res.send(Buffer.from(pdfBytes));
      } catch (wmErr) {
        console.error('watermark failed, sending original PDF', wmErr);
        return res.send(data);
      }
    }
    // Non-PDF
    setSecurityHeaders();
    const ct = proxyContentType(localPath) || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    return res.send(data);
  } catch (err) {
    console.error('local read error', err);
    try { res.status(500).send('Unable to read file'); } catch(_) {}
    return;
  }

  // Helper: determine basic content type for local files
  function proxyContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    return null;
  }

  // Add watermark using pdf-lib
  async function addWatermarkToPdf(inputBytes, req) {
    try {
      let pdfLib;
      try {
        pdfLib = require('pdf-lib');
      } catch (e) {
        console.warn('pdf-lib not installed; skipping server-side watermarking');
        return inputBytes; // fallback: return original PDF unmodified
      }

      const { PDFDocument, rgb, degrees, StandardFonts } = pdfLib;
      const pdfDoc = await PDFDocument.load(inputBytes);
      const pages = pdfDoc.getPages();
      const siteName = 'Assignment Vault';
      const userId = (req.session && req.session.user && req.session.user.name) ? req.session.user.name : (req.sessionID || 'unknown');
      const timestamp = new Date().toLocaleString();
      const markText = `${siteName} — ${userId} — ${timestamp}`;
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const page of pages) {
        const { width, height } = page.getSize();
        const fontSize = Math.max(24, Math.min(width, height) / 12);
        for (let y = -fontSize * 6; y < height + fontSize * 6; y += fontSize * 6) {
          page.drawText(markText, {
            x: -width * 0.15,
            y: y,
            size: fontSize,
            font: helv,
            color: rgb(0.6, 0.6, 0.6),
            rotate: degrees(-30),
            opacity: 0.12,
          });
        }
      }

      const modified = await pdfDoc.save();
      return modified;
    } catch (err) {
      console.error('addWatermarkToPdf failed', err);
      return inputBytes; // on error, return original PDF to avoid breaking viewer
    }
  }
});

module.exports = router;
