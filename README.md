# YouTube Player Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
![Version](https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge)
![HA Minimum Version](https://img.shields.io/badge/HA-%3E%3D2023.9-blue?style=for-the-badge&logo=homeassistant)

A minimal, clean YouTube player card for Home Assistant Lovelace dashboards. Play any YouTube URL directly inside your dashboard — no media player entity required.

---

## ✨ Preview

![Preview 1](preview1.png)

![Preview 2](preview2.png)

![Preview 3](preview3.png)

---

## 📦 Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=YOUR_GITHUB_USERNAME&repository=youtube-player-card&category=plugin)

1. Open **HACS** in your Home Assistant sidebar
2. Click **Frontend**
3. Click the **⊕ Explore & Download Repositories** button
4. Search for **YouTube Player Card**
5. Click **Download**
6. Reload your browser

### Manual

1. Download `youtube-player-card.js` from the [latest release](https://github.com/YOUR_GITHUB_USERNAME/youtube-player-card/releases/latest)
2. Copy it to `/config/www/youtube-player-card/youtube-player-card.js`
3. In Home Assistant go to **Settings → Dashboards → Resources**
4. Click **+ Add Resource**
5. Set URL to `/local/youtube-player-card/youtube-player-card.js`
6. Set Resource type to **JavaScript Module**
7. Click **Create** then reload your browser

---

## 🚀 Usage

1. Edit your dashboard and click **+ Add Card**
2. Search for **YouTube Player**
3. Add the card — no YAML required
4. Hover over the card (desktop) or tap it (mobile) to reveal the **▶ YouTube icon** in the bottom-right corner
5. Click the icon, paste a YouTube URL, and hit **▶ Play**

The card remembers your recent videos so you can replay them in one click.

---

## ⚙️ Configuration

All settings are available in the built-in Visual Editor. No YAML needed.

### YAML Reference

```yaml
type: custom:youtube-player-card
title: YouTube Player        # Card title (used internally)
accent_color: "#0a84ff"      # Accent colour for buttons and highlights
loop_default: false          # Loop video when it ends (default: false)
max_history: 25              # Maximum number of recent URLs to remember (default: 25)
google_client_id: ""         # Optional: Google OAuth Client ID for account sign-in
```

---

## 🎨 Visual Editor

The card includes a full visual editor with three tabs:

**⚙ General** — set the card title, history limit, and loop behaviour  
**👤 Account** — optional Google sign-in for playlist access  
**🎨 Style** — choose an accent colour from presets or a colour picker

---

## 🔑 YouTube Account Sign-in (Optional)

Sign-in is completely optional. The card plays any YouTube URL without an account.

If you want to sign in to access your playlists and watch history:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **YouTube Data API v3**
4. Go to **APIs & Services → Credentials**
5. Create an **OAuth 2.0 Client ID** → Web application
6. Add your Home Assistant URL as an **Authorised JavaScript origin**
   (e.g. `http://homeassistant.local:8123`)
7. Copy the Client ID into the **Visual Editor → Account tab**
8. Click **Sign in with Google**

Your credentials are stored in the browser's `localStorage` and never leave your device.

---

## 📱 Desktop & Mobile

| Interaction | Result |
|---|---|
| Hover over player | YouTube icon appears |
| Click YouTube icon | URL input popup opens |
| Tap player (mobile) | YouTube icon appears for 3.5 seconds |
| Tap YouTube icon | URL input popup opens |
| Click any YouTube control | Works normally inside the player |

---

## 🗂 URL History

- Up to 30 recent videos are saved automatically
- Each entry shows a thumbnail, your optional note, the URL, and the date
- Click any history item to pre-fill the URL field
- Remove individual entries with the **✕** button
- Clear all history with **Clear All**

---

## 🐛 Troubleshooting

**Video won't play / Error 153**
- Check your browser allows `youtube.com` embeds
- Make sure your HA instance is accessible at a stable URL (not a random IP that changes)
- Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

**Autoplay blocked**
- Some browsers block autoplay — interact with the page first, then press play inside the YouTube player

**Google sign-in popup doesn't open**
- Check your browser isn't blocking popups from your HA URL
- Verify the Client ID is correct and your HA URL is listed as an authorised origin

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Contributing

Pull requests and issues are welcome on [GitHub](https://github.com/YOUR_GITHUB_USERNAME/youtube-player-card).
