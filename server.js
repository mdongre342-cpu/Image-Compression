'use strict';

const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Directories ────────────────────────────────────────────────────────────

const DEFAULT_DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'compress-compare-data') : path.join(__dirname, 'data'));
const DATA_DIR = path.resolve(DEFAULT_DATA_DIR);
process.env.DATA_DIR = DATA_DIR;
const UPLOADS_DIR   = path.join(DATA_DIR, 'uploads');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
[DATA_DIR, UPLOADS_DIR, DOWNLOADS_DIR].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

const auth     = require('./backend/auth');
const { compress } = require('./backend/compressors');
const history  = require('./backend/historyManager');

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Content Security Policy: strict script-src to prevent eval and inline script injection
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' https://fonts.googleapis.com; " +
    "style-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com 'unsafe-inline'; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self'; " +
    "default-src 'self'"
  );
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve compressed file downloads
app.use('/downloads', auth.authMiddleware, express.static(DOWNLOADS_DIR));

// Favicon handler (prevent 404 noise)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// ── Multer ─────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', 'image/tiff']);
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(Object.assign(new Error('Unsupported file type. Use JPEG, PNG, WebP, AVIF, GIF, BMP, or TIFF.'), { status: 400 }));
    }
    cb(null, true);
  }
});

// ── Error handler ──────────────────────────────────────────────────────────

function handleError(err, res) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(`[Error ${status}]`, message);
  res.status(status).json({ error: message });
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/health — simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      console.error('[AUTH] Register: Missing fields', { username: !!username, email: !!email, password: !!password });
      return res.status(400).json({ error: 'All fields are required' });
    }
    const result = await auth.register(username, email, password);
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!password) {
      console.error('[AUTH] Login: Missing password');
      return res.status(400).json({ error: 'Email/username and password are required' });
    }
    const result = await auth.login(username || email, password);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', auth.authMiddleware, (req, res) => {
  const token = req.headers.authorization.slice(7);
  auth.logout(token);
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
app.get('/api/auth/me', auth.authMiddleware, (req, res) => {
  try {
    const user = auth.getProfile(req.user.id);
    res.json(user);
  } catch (err) {
    handleError(err, res);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPRESSION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/compress
// Body: multipart/form-data
//   file: image file
//   algorithm: string (huffman|rle|color_quantize|grayscale|resize|kmeans|deflate|lz77|arithmetic|webp|jpeg|avif)
//   options: JSON string of algorithm-specific options
app.post('/api/compress', auth.authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const algorithm = req.body.algorithm || 'jpeg';
    let options = {};
    try {
      options = req.body.options ? JSON.parse(req.body.options) : {};
    } catch (_) {
      // ignore invalid options JSON
    }

    const result = await compress(algorithm, req.file.buffer, options);

    // Save compressed file to disk for download
    const ext = getOutputExtension(algorithm, result.metadata);
    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(DOWNLOADS_DIR, filename);
    fs.writeFileSync(filePath, result.data);

    const downloadUrl = `/downloads/${filename}`;

    // Save to history (authenticated user)
    const histId = history.saveHistory(req.user.id, {
      filename,
      originalName: req.file.originalname,
      algorithm,
      originalSize: req.file.size,
      compressedSize: result.data.length,
      compressionRatio: result.stats.compressionRatio,
      spaceSaving: result.stats.spaceSaving,
      processingMs: result.stats.processingMs,
      downloadUrl,
      stats: result.stats
    });

    res.json({
      id: histId,
      algorithm,
      originalSize: req.file.size,
      compressedSize: result.data.length,
      compressionRatio: result.stats.compressionRatio,
      spaceSaving: result.stats.spaceSaving,
      processingMs: result.stats.processingMs,
      downloadUrl,
      stats: result.stats,
      metadata: result.metadata
    });

  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/compress/preview — returns base64 preview image (for display)
app.post('/api/compress/preview', auth.authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const algorithm = req.body.algorithm || 'jpeg';
    let options = {};
    try { options = req.body.options ? JSON.parse(req.body.options) : {}; } catch (_) {}

    // For preview, always produce a viewable image format
    const viewableAlgorithms = ['jpeg', 'webp', 'avif', 'grayscale', 'resize', 'color_quantize', 'kmeans'];
    const previewAlgo = viewableAlgorithms.includes(algorithm) ? algorithm : 'jpeg';

    // For binary codecs (huffman, rle, lz77, deflate, arithmetic) produce a JPEG preview
    const sharp = require('sharp');
    let previewBuffer, stats;

    if (viewableAlgorithms.includes(algorithm)) {
      const r = await compress(algorithm, req.file.buffer, options);
      previewBuffer = r.data;
      stats = r.stats;
    } else {
      // Compress then decode for preview
      const r = await compress(algorithm, req.file.buffer, options);
      // For huffman/rle/lz77 etc., just return the compression stats with a JPEG preview
      const jpegPreview = await compress('jpeg', req.file.buffer, { quality: 85 });
      previewBuffer = jpegPreview.data;
      stats = r.stats;
    }

    const b64 = previewBuffer.toString('base64');
    const mime = getMime(algorithm);

    res.json({
      preview: `data:${mime};base64,${b64}`,
      stats
    });

  } catch (err) {
    handleError(err, res);
  }
});

// GET /api/compress/algorithms — list available algorithms
app.get('/api/compress/algorithms', (req, res) => {
  res.json({
    algorithms: [
      { id: 'jpeg',           name: 'JPEG Quality',             category: 'lossy',     description: 'Industry-standard lossy compression using DCT' },
      { id: 'webp',           name: 'WebP',                     category: 'lossy',     description: 'Modern format with superior compression ratios' },
      { id: 'avif',           name: 'AVIF',                     category: 'lossy',     description: 'Next-gen AV1-based codec, better than WebP' },
      { id: 'grayscale',      name: 'Grayscale',                category: 'transform', description: 'Convert to grayscale using luminance formula' },
      { id: 'resize',         name: 'Resize & Compress',        category: 'transform', description: 'Downsample then JPEG encode' },
      { id: 'color_quantize', name: 'Color Quantization',       category: 'lossless',  description: 'Median-cut palette reduction (64 colors)' },
      { id: 'kmeans',         name: 'K-means Clustering',       category: 'lossless',  description: 'ML-based color palette via k-means' },
      { id: 'huffman',        name: 'Huffman Coding',           category: 'lossless',  description: 'Entropy coding using variable-length prefix codes' },
      { id: 'rle',            name: 'Run-Length Encoding',      category: 'lossless',  description: 'Encodes consecutive identical pixels as count-value pairs' },
      { id: 'lz77',           name: 'LZ77',                     category: 'lossless',  description: 'Sliding-window dictionary compression' },
      { id: 'deflate',        name: 'Deflate (LZ77 + Huffman)', category: 'lossless',  description: 'LZ77 back-references + Huffman entropy coding' },
      { id: 'arithmetic',     name: 'Arithmetic Coding',        category: 'lossless',  description: 'Optimal entropy coding approaching Shannon limit' }
    ]
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/history
app.get('/api/history', auth.authMiddleware, (req, res) => {
  try {
    const limit     = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset    = parseInt(req.query.offset) || 0;
    const algorithm = req.query.algorithm || null;

    const items = history.getHistory(req.user.id, { limit, offset, algorithm });
    res.json({ items, limit, offset });
  } catch (err) {
    handleError(err, res);
  }
});

// GET /api/history/analytics
app.get('/api/history/analytics', auth.authMiddleware, (req, res) => {
  try {
    const data = history.getAnalytics(req.user.id);
    res.json(data);
  } catch (err) {
    handleError(err, res);
  }
});

// GET /api/history/:id
app.get('/api/history/:id', auth.authMiddleware, (req, res) => {
  try {
    const item = history.getHistoryItem(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: 'History item not found' });
    res.json(item);
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/history/:id
app.delete('/api/history/:id', auth.authMiddleware, (req, res) => {
  try {
    const deleted = history.deleteHistoryItem(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Item not found' });

    // Remove the file from disk
    const item = history.getHistoryItem(req.params.id, req.user.id);
    if (item && item.filename) {
      const fp = path.join(DOWNLOADS_DIR, item.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/history — clear all
app.delete('/api/history', auth.authMiddleware, (req, res) => {
  try {
    const count = history.clearHistory(req.user.id);
    res.json({ message: `Cleared ${count} history items` });
  } catch (err) {
    handleError(err, res);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DOWNLOAD MANAGER ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/downloads — list user's downloadable files
app.get('/api/downloads', auth.authMiddleware, (req, res) => {
  try {
    const items = history.getHistory(req.user.id, { limit: 100 });
    const downloads = items
      .filter(item => item.download_url)
      .map(item => ({
        id: item.id,
        originalName: item.original_name,
        algorithm: item.algorithm,
        originalSize: item.original_size,
        compressedSize: item.compressed_size,
        spaceSaving: item.space_saving,
        downloadUrl: item.download_url,
        createdAt: item.created_at
      }));
    res.json(downloads);
  } catch (err) {
    handleError(err, res);
  }
});

// GET /api/downloads/:id/file — direct file download
app.get('/api/downloads/:id/file', auth.authMiddleware, (req, res) => {
  try {
    const item = history.getHistoryItem(req.params.id, req.user.id);
    if (!item || !item.filename) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(DOWNLOADS_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File no longer available' });
    }

    const downloadName = `compressed_${item.algorithm}_${item.original_name}`;
    res.download(filePath, downloadName);
  } catch (err) {
    handleError(err, res);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SPA Fallback (serve index.html for all non-API routes)
// ═══════════════════════════════════════════════════════════════════════════

app.get('*path', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/downloads/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Helpers ────────────────────────────────────────────────────────────────

function getOutputExtension(algorithm, metadata) {
  const map = {
    jpeg: 'jpg', webp: 'webp', avif: 'avif',
    grayscale: 'jpg', resize: 'jpg',
    color_quantize: 'bin', kmeans: 'jpg',
    huffman: 'huf', rle: 'rle',
    lz77: 'lz77', deflate: 'dfl', arithmetic: 'ac'
  };
  return map[algorithm] || 'bin';
}

function getMime(algorithm) {
  const map = {
    jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif',
    grayscale: 'image/jpeg', resize: 'image/jpeg',
    color_quantize: 'image/png', kmeans: 'image/jpeg'
  };
  return map[algorithm] || 'image/jpeg';
}

// ── Start ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ╔═══════════════════════════════════════╗`);
    console.log(`  ║  Compress & Compare Server            ║`);
    console.log(`  ║  http://localhost:${PORT}               ║`);
    console.log(`  ╚═══════════════════════════════════════╝\n`);
  });
}

module.exports = app;
