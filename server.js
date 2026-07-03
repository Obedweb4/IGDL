require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');
const compression = require('compression');
const { igdl }   = require('ruhend-scraper');

const app  = express();
const PORT = process.env.PORT || 3000;

// Gzip all responses — cuts HTML/CSS/JS size by ~70%
app.use(compression());
app.use(cors());
app.use(express.json());

// Aggressive caching for static assets (CSS, JS, icons — they don't change often)
app.use(express.static('public', {
  maxAge: '7d',
  etag: true,
  lastModified: true,
}));

/* ─────────────────────────────────────────────
   /ping  — keep-alive endpoint
   Use an external cron (cron-job.org, UptimeRobot)
   to GET /ping every 14 min → prevents Render cold starts
───────────────────────────────────────────── */
app.get('/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

// Strict hostname check — replaces old `.includes('instagram.com')`
// substring check, which matched things like "notinstagram.com".
function isInstagramUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
  } catch {
    return false;
  }
}

// Allowlist for /api/proxy — only Instagram/Facebook CDN hosts may be
// fetched server-side. Without this, /api/proxy is an open proxy that
// will happily fetch and stream back ANY url (verified: it fetched
// pypi.org with no restriction at all).
const ALLOWED_PROXY_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i;
function isAllowedProxyUrl(url) {
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === 'https:' && ALLOWED_PROXY_HOSTS.test(hostname);
  } catch {
    return false;
  }
}

function detectType(m) {
  if (m.type) return m.type;                        // trust scraper if present
  const u = (m.url || '').toLowerCase();
  if (u.includes('.mp4') || u.includes('video'))  return 'video';
  if (u.includes('.jpg') || u.includes('.jpeg') ||
      u.includes('.png') || u.includes('.webp') ||
      u.includes('image')) return 'image';
  return 'video';   // default fallback for IG (most unknown = video)
}

function getThumbnail(m) {
  // For videos prefer an explicit thumbnail, else use the URL (which may be image for image posts)
  if (detectType(m) === 'video') return m.thumbnail || m.url || '';
  return m.thumbnail || m.url || '';
}

/* ─────────────────────────────────────────────
   /api/preview  — returns metadata + item list
───────────────────────────────────────────── */
app.get('/api/preview', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !isInstagramUrl(url))
      return res.status(400).json({ error: 'Invalid Instagram URL' });

    const result = await igdl(url);
    if (!result?.data?.length) throw new Error('No media found');

    const mediaItems = result.data.map((m, i) => {
      const type = detectType(m);
      return {
        index    : i,
        type,
        url      : m.url,
        thumbnail: getThumbnail(m),
        quality  : m.quality || (type === 'video' ? 'HD Video' : 'Full Res Image'),
      };
    });

    res.json({
      caption   : result.caption || '',
      thumbnail : mediaItems[0].thumbnail,
      mediaItems,
    });

  } catch (err) {
    console.error('Preview error:', err.message);
    res.status(500).json({ error: 'Preview failed', details: err.message });
  }
});

/* ─────────────────────────────────────────────
   /api/proxy  — proxies Instagram CDN URLs
   ?dl=1  → forces file download (Content-Disposition)
   ?name= → custom filename for the download
   
   WHY: Instagram CDN URLs expire quickly. Re-calling
   igdl() on download causes "not found" errors. Instead
   we use the URL already fetched at preview time and
   stream it directly here.
───────────────────────────────────────────── */
app.get('/api/proxy', async (req, res) => {
  try {
    const { url, dl, name } = req.query;
    if (!url) return res.status(400).send('Missing url');

    // NOTE: req.query.url is already URL-decoded by Express — do not
    // decodeURIComponent() it again. Instagram's signed CDN URLs contain
    // percent-encoded characters inside their query string (e.g. %3D),
    // and decoding twice corrupts the signature, causing intermittent
    // "Proxy failed" errors.
    if (!isAllowedProxyUrl(url)) {
      return res.status(403).send('Forbidden: url must point to an Instagram/Facebook CDN host');
    }

    const upstream = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Referer'   : 'https://www.instagram.com/',
        'Accept'    : '*/*',
      },
      maxRedirects: 10,
    });

    const ct = upstream.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);

    if (dl === '1') {
      // Force-download mode: used by Download buttons
      const filename = name || `obedtech_ig_${Date.now()}.${ct.includes('video') ? 'mp4' : 'jpg'}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      console.log(`⬇  Download: ${filename}`);
    } else {
      // Stream/preview mode: used by <video> and <img> tags
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    if (upstream.headers['content-length'])
      res.setHeader('Content-Length', upstream.headers['content-length']);

    upstream.data.pipe(res);
  } catch (err) {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) res.status(502).send('Proxy failed: ' + err.message);
  }
});


// NOTE: manifest.json's share_target.action is "/" (handled client-side by
// handleShareTarget() in script.js), so a separate /share route is never
// actually invoked by the PWA share sheet — removed to avoid dead code.

app.listen(PORT, () =>
  console.log(`🚀  OBedTech IG Downloader → http://localhost:${PORT}`)
);
