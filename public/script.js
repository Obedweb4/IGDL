// ════════════════════════════════════════
//  OBedTech Instagram Downloader  v3
//  PWA + Video Preview + All Media Types
// ════════════════════════════════════════

/* ── Service Worker ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) setPwaInstalled();
      })
      .catch(() => {});
  });
}

/* ── PWA Install Prompt ── */
let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    if (!sessionStorage.getItem('pwa-dismissed')) installBanner.classList.add('show');
  }, 4000);
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBanner.classList.remove('show');
  if (outcome === 'accepted') setPwaInstalled();
});

document.getElementById('installClose')?.addEventListener('click', () => {
  installBanner.classList.remove('show');
  sessionStorage.setItem('pwa-dismissed', '1');
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('show');
  setPwaInstalled();
});

function setPwaInstalled() {
  const p = document.getElementById('pwaPill');
  if (p) { p.textContent = 'Installed'; p.classList.add('show'); }
}

/* ── Offline ── */
const offlineBar = document.getElementById('offlineBar');
function syncOnline() { offlineBar?.classList.toggle('show', !navigator.onLine); }
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();

/* ════════════════════════════════════════
   MAIN APP
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const igUrl    = document.getElementById('igUrl');
  const fetchBtn = document.getElementById('fetchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const errBox   = document.getElementById('errBox');
  const errText  = document.getElementById('errText');
  const loadBox  = document.getElementById('loadBox');
  const loadSteps= document.getElementById('loadSteps');
  const result   = document.getElementById('resultArea');

  /* ── URL input helpers ── */
  igUrl.addEventListener('input', () => {
    clearBtn.classList.toggle('on', igUrl.value.length > 0);
    hideErr();
  });
  clearBtn.addEventListener('click', () => {
    igUrl.value = '';
    clearBtn.classList.remove('on');
    hideErr();
    result.innerHTML = '';
    igUrl.focus();
  });
  igUrl.addEventListener('keydown', e => { if (e.key === 'Enter') fetchBtn.click(); });

  /* ── Fetch click ── */
  fetchBtn.addEventListener('click', async () => {
    const url = igUrl.value.trim();
    if (!url)                         { showErr('Please paste an Instagram URL first.'); return; }
    if (!url.includes('instagram.com')){ showErr("That doesn't look like a valid Instagram URL."); return; }
    if (!navigator.onLine)             { showErr('You are offline. Connect to the internet first.'); return; }
    await doFetch(url);
  });

  /* ── Fetch & render ── */
  async function doFetch(url) {
    setLoading(true);
    hideErr();
    result.innerHTML = '';

    try {
      const res  = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.details || data.error || 'Could not fetch. Post may be private.');
      render(url, data);
    } catch (e) {
      showErr(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /* ════════════════════════════════════════
     RENDER  — builds the result UI
  ════════════════════════════════════════ */
  function render(igUrl, data) {
    const items = data.mediaItems || [];
    if (!items.length) { showErr('No downloadable media found for this post.'); return; }

    const totalVideos = items.filter(m => m.type === 'video').length;
    const totalImages = items.filter(m => m.type !== 'video').length;
    const countLabel  = buildCountLabel(items.length, totalVideos, totalImages);

    /* Header bar */
    let html = `
      <div class="media-count-bar">
        <div class="media-count-label">${countLabel}</div>
        ${items.length > 1
          ? `<a class="dl-all-btn" href="#" id="dlAllBtn"><i class="fas fa-download"></i> Download All</a>`
          : ''}
      </div>
      <div class="media-list" id="mediaList">`;

    items.forEach((m, i) => { html += buildItem(m, i, igUrl); });
    html += '</div>';

    /* Caption */
    if (data.caption) {
      html += `<p class="post-caption">${esc(data.caption)}</p>`;
    }

    result.innerHTML = html;

    /* Wire up video players */
    result.querySelectorAll('.preview-wrap[data-type="video"]').forEach(wrap => {
      const video   = wrap.querySelector('video');
      const overlay = wrap.querySelector('.vid-overlay');

      wrap.addEventListener('click', () => {
        if (video.paused) {
          // Pause all other videos first
          result.querySelectorAll('video').forEach(v => { if (v !== video) { v.pause(); v.classList.remove('playing'); } });
          video.play().catch(() => {});
          video.classList.add('playing');
          if (overlay) overlay.style.opacity = '0';
        } else {
          video.pause();
          video.classList.remove('playing');
          if (overlay) overlay.style.opacity = '1';
        }
      });

      video.addEventListener('ended', () => {
        video.classList.remove('playing');
        if (overlay) overlay.style.opacity = '1';
      });
    });

    /* Download All */
    document.getElementById('dlAllBtn')?.addEventListener('click', e => {
      e.preventDefault();
      items.forEach((m, i) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = `/api/download?url=${encodeURIComponent(igUrl)}&index=${m.index}`;
          a.download = '';
          a.click();
        }, i * 800);
      });
    });
  }

  /* ── Build single media item card ── */
  function buildItem(m, i, igUrl) {
    const isVideo  = m.type === 'video';
    const dlUrl    = `/api/download?url=${encodeURIComponent(igUrl)}&index=${m.index}`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(m.url)}`;
    const proxyThumb = m.thumbnail ? `/api/proxy?url=${encodeURIComponent(m.thumbnail)}` : proxyUrl;
    const label    = isVideo ? 'Video' : 'Photo';
    const icon     = isVideo ? 'fa-film' : 'fa-image';
    const num      = '';  // we'll show item number in badge

    let previewHTML;
    if (isVideo) {
      previewHTML = `
        <div class="preview-wrap" data-type="video">
          <video
            preload="metadata"
            poster="${proxyThumb}"
            playsinline
            webkit-playsinline
            controlslist="nodownload"
          >
            <source src="${proxyUrl}" type="video/mp4">
          </video>
          <div class="vid-overlay"><i class="fas fa-circle-play"></i></div>
          <div class="type-badge"><i class="fas fa-film"></i> Video</div>
        </div>`;
    } else {
      previewHTML = `
        <div class="preview-wrap img-wrap" data-type="image">
          <img src="${proxyThumb}" alt="Instagram photo" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'200\\'%3E%3Crect fill=\\'%23101623\\' width=\\'400\\' height=\\'200\\'/%3E%3Ctext fill=\\'%236B7694\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' font-size=\\'16\\'%3EImage unavailable%3C/text%3E%3C/svg%3E'">
          <div class="type-badge"><i class="fas fa-image"></i> Photo</div>
        </div>`;
    }

    return `
      <div class="media-item">
        ${previewHTML}
        <div class="item-footer">
          <div class="item-meta">
            <div class="item-type-icon"><i class="fas ${icon}"></i></div>
            <div>
              <div class="item-label">${label}${i > 0 ? ' ' + (i + 1) : ''}</div>
              <div class="item-quality">${esc(m.quality || 'Full quality')}</div>
            </div>
          </div>
          <a href="${dlUrl}" class="dl-btn" download>
            <i class="fas fa-arrow-down"></i> Download
          </a>
        </div>
      </div>`;
  }

  /* ── Helpers ── */
  function buildCountLabel(total, videos, images) {
    const parts = [];
    if (videos > 0) parts.push(`${videos} video${videos > 1 ? 's' : ''}`);
    if (images > 0) parts.push(`${images} photo${images > 1 ? 's' : ''}`);
    return `<strong>${total}</strong> item${total > 1 ? 's' : ''} found — ${parts.join(' + ')}`;
  }

  const STEPS = [
    'Connecting to Instagram…',
    'Fetching media metadata…',
    'Processing media items…',
    'Almost ready…'
  ];
  let stepTimer;

  function setLoading(on) {
    loadBox.classList.toggle('on', on);
    fetchBtn.disabled = on;
    document.getElementById('fetchLabel').textContent = on ? 'Fetching…' : 'Fetch';

    if (on) {
      let si = 0;
      loadSteps.innerHTML = `<span class="step active">${STEPS[0]}</span>`;
      stepTimer = setInterval(() => {
        si = Math.min(si + 1, STEPS.length - 1);
        loadSteps.innerHTML = `<span class="step active">${STEPS[si]}</span>`;
      }, 2000);
    } else {
      clearInterval(stepTimer);
    }
  }

  function showErr(msg) { errText.textContent = msg; errBox.classList.add('on'); }
  function hideErr()    { errBox.classList.remove('on'); }
  function esc(s)       { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
});

// ── Share Target: auto-fill URL if opened via share ──
(function handleShareTarget() {
  const params = new URLSearchParams(window.location.search);
  const shared = params.get('shared') || params.get('url') || params.get('text') || '';
  if (shared && shared.includes('instagram.com')) {
    const input = document.getElementById('igUrl');
    if (input) {
      input.value = shared;
      document.getElementById('clearBtn')?.classList.add('on');
      // Auto-fetch after short delay
      setTimeout(() => document.getElementById('fetchBtn')?.click(), 600);
    }
  }
})();
