require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { igdl } = require('ruhend-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ Preview endpoint
app.get('/api/preview', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !url.includes('instagram.com')) {
      return res.status(400).json({ error: 'Invalid Instagram URL' });
    }

    const result = await igdl(url);
    if (!result?.data?.length) throw new Error('No media found');

    res.json({
      title: result.caption || 'Instagram Post',
      thumbnail: result.data[0].thumbnail || result.data[0].url,
      mediaCount: result.data.length,
      mediaItems: result.data.map((m, i) => ({
        index: i,
        url: m.url,
        thumbnail: m.thumbnail || m.url,
        type: m.type || (m.url && m.url.includes('.mp4') ? 'video' : 'image'),
        quality: m.quality || `Media ${i + 1}`
      }))
    });

  } catch (error) {
    console.error('Instagram preview error:', error);
    res.status(500).json({ error: 'Preview failed', details: error.message });
  }
});

// ✅ Download endpoint — streams media as attachment
app.get('/api/download', async (req, res) => {
  try {
    const { url, index } = req.query;
    if (!url || !url.includes('instagram.com')) {
      return res.status(400).json({ error: 'Invalid Instagram URL' });
    }

    const result = await igdl(url);
    if (!result?.data?.length) throw new Error('No media found');

    const mediaIndex = index ? parseInt(index, 10) : 0;
    if (mediaIndex < 0 || mediaIndex >= result.data.length) {
      return res.status(400).json({ error: 'Invalid media index' });
    }

    const media = result.data[mediaIndex];
    if (!media?.url) throw new Error('Media URL not found');

    const isVideo = media.url.includes('.mp4') || media.type === 'video';
    const ext = isVideo ? 'mp4' : 'jpg';
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
    const filename = `instagram_${Date.now()}_${mediaIndex}.${ext}`;

    const mediaResponse = await axios.get(media.url, {
      responseType: 'stream',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    const contentLength = mediaResponse.headers['content-length'];
    if (contentLength) res.setHeader('Content-Length', contentLength);

    console.log(`Downloading: ${filename}`);
    mediaResponse.data.pipe(res);

  } catch (error) {
    console.error('Instagram download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed', details: error.message });
    }
  }
});

app.listen(PORT, () => console.log(`Instagram Downloader running at http://localhost:${PORT}`));
