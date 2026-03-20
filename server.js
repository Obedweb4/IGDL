require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const { igdl } = require('ruhend-scraper');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
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
    if (!url || !url.includes('instagram.com'))
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
   /api/proxy  — proxies a media URL to browser
   (needed so <video> src / <img> src can load
    cross-origin Instagram CDN URLs)
───────────────────────────────────────────── */
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url');

    const upstream = await axios.get(decodeURIComponent(url), {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer'   : 'https://www.instagram.com/',
      },
      maxRedirects: 10,
    });

    const ct = upstream.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (upstream.headers['content-length'])
      res.setHeader('Content-Length', upstream.headers['content-length']);

    upstream.data.pipe(res);
  } catch (err) {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) res.status(502).send('Proxy failed');
  }
});

/* ─────────────────────────────────────────────
   /api/download  — forces file download
───────────────────────────────────────────── */
app.get('/api/download', async (req, res) => {
  try {
    const { url, index } = req.query;
    if (!url || !url.includes('instagram.com'))
      return res.status(400).json({ error: 'Invalid Instagram URL' });

    const result = await igdl(url);
    if (!result?.data?.length) throw new Error('No media found');

    const idx   = Math.max(0, parseInt(index || '0', 10));
    const media = result.data[idx];
    if (!media?.url) throw new Error('Media not found at that index');

    const type        = detectType(media);
    const isVideo     = type === 'video';
    const ext         = isVideo ? 'mp4' : 'jpg';
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
    const filename    = `obedtech_ig_${Date.now()}_${idx}.${ext}`;

    const upstream = await axios.get(media.url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer'   : 'https://www.instagram.com/',
      },
      maxRedirects: 10,
    });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    if (upstream.headers['content-length'])
      res.setHeader('Content-Length', upstream.headers['content-length']);

    console.log(`⬇  ${filename}`);
    upstream.data.pipe(res);

  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent)
      res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀  OBedTech IG Downloader → http://localhost:${PORT}`)
);

// Share Target handler — when user shares IG URL from phone directly to the app
app.get('/share', (req, res) => {
  const sharedUrl = req.query.url || req.query.text || '';
  // Redirect to homepage with URL pre-filled via hash
  res.redirect(`/?shared=${encodeURIComponent(sharedUrl)}`);
});
