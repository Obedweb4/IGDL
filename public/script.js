// ═══════════════════════════════════
//  OBedTech Instagram Downloader
//  PWA + Core Logic
// ═══════════════════════════════════

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('SW registered:', reg.scope);
        // Show "Installed" badge if running as standalone PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
          const status = document.getElementById('pwaStatus');
          if (status) { status.textContent = 'App Installed'; status.classList.add('show'); }
        }
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ── PWA Install Prompt ──
let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');
const installBtn    = document.getElementById('installBtn');
const installClose  = document.getElementById('installClose');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show banner after 3 seconds
  setTimeout(() => {
    if (!localStorage.getItem('pwa-dismissed')) {
      installBanner.classList.add('show');
    }
  }, 3000);
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBanner.classList.remove('show');
  if (outcome === 'accepted') {
    const status = document.getElementById('pwaStatus');
    if (status) { status.textContent = 'App Installed'; status.classList.add('show'); }
  }
});

installClose?.addEventListener('click', () => {
  installBanner.classList.remove('show');
  localStorage.setItem('pwa-dismissed', '1');
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('show');
  const status = document.getElementById('pwaStatus');
  if (status) { status.textContent = 'App Installed'; status.classList.add('show'); }
});

// ── Offline Detection ──
const offlineBar = document.getElementById('offlineBar');
function updateOnlineStatus() {
  if (offlineBar) offlineBar.classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ═══════════════════════════════════
//  MAIN APP LOGIC
// ═══════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const urlInput   = document.getElementById('igUrl');
  const previewBtn = document.getElementById('previewBtn');
  const clearBtn   = document.getElementById('clearBtn');
  const errorBox   = document.getElementById('errorBox');
  const errorText  = document.getElementById('errorText');
  const loadingEl  = document.getElementById('loadingState');
  const resultEl   = document.getElementById('previewResult');

  // Show/hide clear button
  urlInput.addEventListener('input', () => {
    clearBtn.classList.toggle('visible', urlInput.value.length > 0);
    hideError();
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.classList.remove('visible');
    hideError();
    resultEl.innerHTML = '';
    urlInput.focus();
  });

  // Allow Enter key
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') previewBtn.click();
  });

  previewBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { showError('Please paste an Instagram URL first.'); return; }
    if (!url.includes('instagram.com')) {
      showError("That doesn't look like an Instagram URL. Please check and try again.");
      return;
    }
    if (!navigator.onLine) {
      showError('You are offline. Please connect to the internet to fetch media.');
      return;
    }
    await fetchPreview(url);
  });

  async function fetchPreview(url) {
    showLoading(true);
    hideError();
    resultEl.innerHTML = '';

    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.details || data.error || 'Could not fetch media. The post may be private or unavailable.');
      }
      renderPreview(url, data);
    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      showLoading(false);
    }
  }

  function renderPreview(igUrl, data) {
    const { title, thumbnail, mediaItems = [] } = data;
    if (!mediaItems.length) { showError('No downloadable media found for this post.'); return; }

    const dlItemsHTML = mediaItems.map((m, i) => {
      const isVideo = m.type === 'video';
      const icon    = isVideo ? 'fa-film' : 'fa-image';
      const label   = isVideo ? 'Video' : 'Image';
      const dlUrl   = `/api/download?url=${encodeURIComponent(igUrl)}&index=${m.index}`;
      return `
        <div class="dl-item">
          <div class="dl-info">
            <div class="dl-type-icon"><i class="fas ${icon}"></i></div>
            <div>
              <div class="dl-label">${label}${mediaItems.length > 1 ? ' ' + (i+1) : ''}</div>
              <div class="dl-sub">${m.quality || 'Full quality'}</div>
            </div>
          </div>
          <a href="${dlUrl}" class="dl-btn" download>
            <i class="fas fa-arrow-down"></i> Download
          </a>
        </div>`;
    }).join('');

    const firstIsVideo = mediaItems[0].type === 'video';
    resultEl.innerHTML = `
      <div class="media-preview">
        <div class="media-hero">
          <img src="${thumbnail}" alt="Media preview" onerror="this.style.display='none'">
          <div class="media-badge">
            <i class="fas ${firstIsVideo ? 'fa-play-circle' : 'fa-images'}"></i>
            ${mediaItems.length > 1 ? mediaItems.length + ' items' : (firstIsVideo ? 'Video' : 'Photo')}
          </div>
        </div>
        ${title && title !== 'Instagram Post' ? `<p class="media-caption">${escapeHtml(title)}</p>` : ''}
        <div class="download-section">${dlItemsHTML}</div>
      </div>`;
  }

  function showError(msg)  { errorText.textContent = msg; errorBox.classList.add('visible'); }
  function hideError()     { errorBox.classList.remove('visible'); }
  function showLoading(on) {
    loadingEl.classList.toggle('visible', on);
    previewBtn.disabled = on;
    const span = previewBtn.querySelector('span span');
    if (span) span.textContent = on ? 'Fetching…' : 'Fetch';
  }
  function escapeHtml(s)   { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
});
