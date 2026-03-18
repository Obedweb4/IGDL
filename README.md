# OBedTech Instagram Downloader — PWA

A Progressive Web App (PWA) for downloading Instagram Reels, posts, and carousels.
Built by **Mr Obed Tech**.

---

## 🚀 Features
- Download Instagram Videos, Reels, Photos & Carousels
- **PWA** — installable on Android, iOS, Windows, Mac, Linux
- Offline-capable UI with Service Worker caching
- Works as a standalone app (no browser chrome)
- Install banner prompt for mobile users

---

## 🛠 Setup & Run

```bash
npm install
npm start
# App runs at http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

> ⚠️ **HTTPS required for PWA features.** In production, always serve over HTTPS.
> For local testing, Chrome allows localhost as a secure origin.

---

## 📁 Project Structure

```
├── server.js              # Express backend
├── package.json
├── public/
│   ├── index.html         # Main app (PWA meta tags included)
│   ├── style.css          # Styles
│   ├── script.js          # App logic + SW registration + install prompt
│   ├── sw.js              # Service Worker (caching + offline)
│   ├── manifest.json      # Web App Manifest
│   ├── favicon.png        # Browser favicon
│   └── icons/             # PWA icons (all sizes)
│       ├── icon-72x72.png
│       ├── icon-96x96.png
│       ├── icon-128x128.png
│       ├── icon-144x144.png
│       ├── icon-152x152.png
│       ├── icon-192x192.png
│       ├── icon-384x384.png
│       ├── icon-512x512.png
│       └── apple-touch-icon.png
```

---

## 📱 How to Install the App

### Android (Chrome)
1. Open the site in Chrome
2. Tap the 3-dot menu (⋮)
3. Tap **"Add to Home screen"**
4. Tap **"Install"**

### iPhone / iPad (Safari)
1. Open the site in Safari
2. Tap the **Share** button (□↑)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**

### Windows / Mac (Chrome or Edge)
1. Open the site in Chrome or Edge
2. Click the **install icon** (⊕) in the address bar
3. Click **"Install"**

---

## 🌐 Deploy to the Web

### Option 1 — Railway (Recommended, Free)
1. Push code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Node.js
4. Add env var `PORT=3000` if needed
5. Railway gives you a free HTTPS URL — PWA works perfectly!

### Option 2 — Render (Free)
1. Go to https://render.com → New Web Service
2. Connect your GitHub repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Free HTTPS URL included

### Option 3 — Fly.io (Free tier)
```bash
npm install -g flyctl
fly auth login
fly launch
fly deploy
```

---

## 📲 Submit to Free App Directories

Once deployed with HTTPS, submit your PWA to these directories:

| Directory | URL | Notes |
|-----------|-----|-------|
| **PWADirectory** | https://pwadirectory.com | Free listing |
| **Progressier** | https://progressier.com/pwa-directory | Popular PWA index |
| **AppScope** | https://appsco.pe | Curated PWA showcase |
| **Outweb** | https://outweb.io | Web app directory |
| **AlternativeTo** | https://alternativeto.net | Add as web app |
| **Product Hunt** | https://producthunt.com | Launch for visibility |

### For Google Play (TWA — Trusted Web Activity)
You can wrap your PWA as an Android APK using **Bubblewrap** or **PWABuilder**:
1. Go to https://www.pwabuilder.com
2. Enter your deployed HTTPS URL
3. Click **"Package for stores"**
4. Download the Android APK / AAB
5. Submit to Google Play (free for PWAs via TWA)

### For Microsoft Store
PWABuilder also generates a Windows MSIX package — submit to Microsoft Store for free.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Server port |

---

## 📄 License
For personal / educational use. Respect Instagram's Terms of Service and creators' rights.
