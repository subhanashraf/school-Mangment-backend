const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/files/view
 * Proxies a file from Cloudinary (or any other URL stored internally)
 * so the actual storage provider URL is never exposed to the client.
 * Query param: url  (the stored file URL, URL-encoded)
 */
router.get('/view', authenticate, (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: 'No file URL provided' });
  }

  // Only allow URLs from known trusted domains to prevent open-redirect / SSRF
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ message: 'Invalid URL' });
  }

  const allowedHosts = [
    'res.cloudinary.com',
    'localhost',
    '127.0.0.1',
  ];

  const hostOk = allowedHosts.some(
    (h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h)
  );

  if (!hostOk) {
    return res.status(403).json({ message: 'File host not allowed' });
  }

  const lib = parsedUrl.protocol === 'https:' ? https : http;

  lib.get(url, (fileRes) => {
    // Determine a friendly content-type
    const ct = fileRes.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);

    // Forward cache / content-length headers if present
    if (fileRes.headers['content-length']) {
      res.setHeader('Content-Length', fileRes.headers['content-length']);
    }

    // Inline display (browser opens it in-tab), not download
    res.setHeader('Content-Disposition', 'inline');

    fileRes.pipe(res);
  }).on('error', (err) => {
    console.error('File proxy error:', err.message);
    res.status(502).json({ message: 'Failed to fetch file' });
  });
});

module.exports = router;
