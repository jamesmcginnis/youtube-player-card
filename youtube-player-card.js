/**
 * YouTube Player Card for Home Assistant
 * Version: 1.0.0
 * A Mac-style YouTube media player with URL history and YouTube OAuth login
 */

(function () {
  'use strict';

  const CARD_VERSION = '1.0.0';
  const HISTORY_KEY = 'ytpc_url_history';
  const AUTH_KEY = 'ytpc_google_auth';
  const PREFS_KEY = 'ytpc_prefs';

  // ─── Utilities ────────────────────────────────────────────────────────────

  function extractVideoId(url) {
    if (!url) return null;
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /\/embed\/([a-zA-Z0-9_-]{11})/,
      /\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
  }

  function saveToHistory(url, desc, title) {
    const h = getHistory().filter(i => i.url !== url);
    h.unshift({
      url,
      desc: desc || '',
      title: title || url,
      videoId: extractVideoId(url),
      date: new Date().toLocaleDateString()
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30)));
  }

  function clearHistory() { localStorage.removeItem(HISTORY_KEY); }

  function getAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
    catch { return null; }
  }

  function saveAuth(auth) { localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); }
  function clearAuth() { localStorage.removeItem(AUTH_KEY); }

  // ─── YouTube IFrame API Loader ─────────────────────────────────────────────

  let _ytApiReady = false;
  let _ytCallbacks = [];

  function loadYTApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    return new Promise(resolve => {
      _ytCallbacks.push(resolve);
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          _ytApiReady = true;
          if (prev) prev();
          _ytCallbacks.forEach(cb => cb());
          _ytCallbacks = [];
        };
      }
    });
  }

  // ─── Card Styles ──────────────────────────────────────────────────────────

  const CARD_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600&display=swap');

    :host {
      --mac-bg: #1c1c1e;
      --mac-surface: #2c2c2e;
      --mac-surface2: #3a3a3c;
      --mac-border: rgba(255,255,255,0.1);
      --mac-text: #f2f2f7;
      --mac-subtext: #8e8e93;
      --mac-accent: #0a84ff;
      --mac-red: #ff453a;
      --mac-yellow: #ffd60a;
      --mac-green: #30d158;
      --mac-glass: rgba(44,44,46,0.85);
      --mac-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 8px 32px rgba(0,0,0,0.5);
      --radius: 16px;
      --font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
      display: block;
      font-family: var(--font);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .card-wrapper {
      background: linear-gradient(145deg, #1c1c1e 0%, #111113 100%);
      border-radius: var(--radius);
      border: 1px solid var(--mac-border);
      box-shadow: var(--mac-shadow);
      overflow: hidden;
      position: relative;
      user-select: none;
    }

    /* Title Bar */
    .titlebar {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid var(--mac-border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }



    .titlebar-title {
      flex: 1;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
      color: var(--mac-subtext);
      letter-spacing: 0.3px;
    }

    .titlebar-right {
      width: 60px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .titlebar-btn {
      background: none;
      border: none;
      color: var(--mac-subtext);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: color 0.15s, background 0.15s;
      font-size: 14px;
      line-height: 1;
    }
    .titlebar-btn:hover { color: var(--mac-text); background: rgba(255,255,255,0.08); }

    /* Video Area */
    .video-container {
      position: relative;
      width: 100%;
      padding-top: 56.25%;
      background: #000;
      overflow: hidden;
    }

    .video-container iframe,
    .video-placeholder {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
    }

    .video-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at 50% 60%, #1f1f22 0%, #0d0d0f 100%);
      gap: 16px;
      cursor: pointer;
    }

    .video-placeholder svg {
      width: 72px;
      height: 72px;
      opacity: 0.25;
    }

    .placeholder-text {
      color: var(--mac-subtext);
      font-size: 15px;
      font-weight: 400;
    }

    .placeholder-hint {
      color: rgba(142,142,147,0.5);
      font-size: 12px;
    }

    .play-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.3);
      opacity: 0;
      transition: opacity 0.2s;
      cursor: pointer;
    }
    .video-container:hover .play-overlay { opacity: 1; }

    .play-overlay-btn {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      font-size: 24px;
      transition: transform 0.15s, background 0.15s;
    }
    .play-overlay-btn:hover { transform: scale(1.1); background: rgba(0,0,0,0.8); }

    /* Info Panel */
    .info-panel {
      padding: 16px 20px 4px;
    }

    .track-info {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 44px;
    }

    .track-thumb {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      object-fit: cover;
      background: var(--mac-surface);
      flex-shrink: 0;
      border: 1px solid var(--mac-border);
    }

    .track-thumb.empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mac-subtext);
      font-size: 18px;
    }

    .track-meta {
      flex: 1;
      overflow: hidden;
    }

    .track-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--mac-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.2px;
    }

    .track-channel {
      font-size: 13px;
      color: var(--mac-subtext);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .love-btn {
      background: none;
      border: none;
      color: var(--mac-subtext);
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      transition: color 0.2s, transform 0.2s;
      border-radius: 50%;
    }
    .love-btn:hover { transform: scale(1.2); }
    .love-btn.active { color: var(--mac-red); }

    /* Progress Bar */
    .progress-section {
      padding: 12px 20px 4px;
    }

    .progress-bar-wrap {
      position: relative;
      height: 4px;
      background: var(--mac-surface2);
      border-radius: 4px;
      cursor: pointer;
      overflow: hidden;
      transition: height 0.2s;
    }
    .progress-bar-wrap:hover { height: 6px; }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--mac-accent), #5ac8fa);
      border-radius: 4px;
      transition: width 0.5s linear;
      width: 0%;
    }

    .progress-times {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
    }

    .time-label {
      font-size: 11px;
      color: var(--mac-subtext);
      font-variant-numeric: tabular-nums;
    }

    /* Controls */
    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 20px 16px;
      gap: 4px;
    }

    .ctrl-btn {
      background: none;
      border: none;
      color: var(--mac-subtext);
      cursor: pointer;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s, transform 0.15s;
      font-size: 18px;
    }
    .ctrl-btn:hover { color: var(--mac-text); background: rgba(255,255,255,0.07); }
    .ctrl-btn:active { transform: scale(0.9); }
    .ctrl-btn.primary {
      width: 54px;
      height: 54px;
      font-size: 22px;
      background: rgba(255,255,255,0.1);
      color: var(--mac-text);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
    }
    .ctrl-btn.primary:hover { background: rgba(255,255,255,0.16); }
    .ctrl-btn.active { color: var(--mac-accent); }

    /* Volume */
    .volume-row {
      display: flex;
      align-items: center;
      padding: 0 20px 14px;
      gap: 10px;
    }

    .vol-icon {
      color: var(--mac-subtext);
      font-size: 14px;
      width: 20px;
      text-align: center;
    }

    .vol-slider {
      flex: 1;
      -webkit-appearance: none;
      height: 4px;
      border-radius: 4px;
      background: var(--mac-surface2);
      outline: none;
      cursor: pointer;
    }
    .vol-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--mac-text);
      cursor: pointer;
      transition: transform 0.15s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }
    .vol-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }

    /* URL Button */
    .url-btn-row {
      padding: 0 20px 20px;
    }

    .url-open-btn {
      width: 100%;
      padding: 12px 16px;
      background: rgba(10,132,255,0.15);
      border: 1px solid rgba(10,132,255,0.3);
      border-radius: 10px;
      color: var(--mac-accent);
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font);
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      letter-spacing: 0.1px;
    }
    .url-open-btn:hover {
      background: rgba(10,132,255,0.25);
      border-color: rgba(10,132,255,0.5);
    }
    .url-open-btn:active { transform: scale(0.98); }

    /* ─── POPUP ──────────────────────────────────────────────────── */

    .popup-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 1000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
      backdrop-filter: blur(4px);
    }

    .popup-backdrop.open {
      opacity: 1;
      pointer-events: all;
    }

    .popup {
      width: 100%;
      max-width: 520px;
      background: rgba(28,28,30,0.97);
      border-radius: 20px 20px 0 0;
      border: 1px solid var(--mac-border);
      border-bottom: none;
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      box-shadow: 0 -20px 60px rgba(0,0,0,0.8);
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .popup-backdrop.open .popup {
      transform: translateY(0);
    }

    .popup-handle {
      width: 36px;
      height: 4px;
      background: rgba(255,255,255,0.2);
      border-radius: 4px;
      margin: 12px auto 0;
      flex-shrink: 0;
    }

    .popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 12px;
      flex-shrink: 0;
    }

    .popup-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--mac-text);
      letter-spacing: -0.3px;
    }

    .popup-close {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--mac-surface2);
      border: none;
      color: var(--mac-subtext);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: background 0.15s, color 0.15s;
    }
    .popup-close:hover { background: var(--mac-surface); color: var(--mac-text); }

    .popup-body {
      padding: 0 20px;
      overflow-y: auto;
      flex: 1;
    }

    .input-group {
      margin-bottom: 14px;
    }

    .input-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--mac-subtext);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 8px;
      display: block;
    }

    .mac-input {
      width: 100%;
      padding: 12px 14px;
      background: var(--mac-surface);
      border: 1px solid var(--mac-border);
      border-radius: 10px;
      color: var(--mac-text);
      font-size: 15px;
      font-family: var(--font);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .mac-input:focus {
      border-color: var(--mac-accent);
      box-shadow: 0 0 0 3px rgba(10,132,255,0.2);
    }
    .mac-input::placeholder { color: rgba(142,142,147,0.5); }

    .mac-textarea {
      resize: vertical;
      min-height: 72px;
      line-height: 1.5;
    }

    .popup-actions {
      display: flex;
      gap: 10px;
      padding: 16px 20px;
      flex-shrink: 0;
      border-top: 1px solid var(--mac-border);
    }

    .btn-primary {
      flex: 1;
      padding: 13px;
      background: var(--mac-accent);
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 15px;
      font-weight: 600;
      font-family: var(--font);
      cursor: pointer;
      transition: filter 0.15s, transform 0.15s;
    }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-primary:active { transform: scale(0.98); }

    .btn-secondary {
      padding: 13px 18px;
      background: var(--mac-surface2);
      border: 1px solid var(--mac-border);
      border-radius: 10px;
      color: var(--mac-subtext);
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .btn-secondary:hover { background: var(--mac-surface); color: var(--mac-text); }

    /* History Section */
    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 4px 0 10px;
    }

    .history-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--mac-subtext);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .clear-btn {
      background: none;
      border: none;
      color: var(--mac-red);
      font-size: 12px;
      font-family: var(--font);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: background 0.15s;
      font-weight: 500;
    }
    .clear-btn:hover { background: rgba(255,69,58,0.1); }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
    }

    .history-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: var(--mac-surface);
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s;
      border: 1px solid transparent;
    }
    .history-item:hover {
      background: var(--mac-surface2);
      border-color: var(--mac-border);
      transform: translateX(2px);
    }

    .history-thumb {
      width: 40px;
      height: 28px;
      border-radius: 5px;
      object-fit: cover;
      background: var(--mac-surface2);
      flex-shrink: 0;
    }

    .history-info { flex: 1; overflow: hidden; }

    .history-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--mac-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .history-sub {
      font-size: 11px;
      color: var(--mac-subtext);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .history-delete {
      background: none;
      border: none;
      color: rgba(142,142,147,0.4);
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .history-delete:hover { color: var(--mac-red); background: rgba(255,69,58,0.1); }

    .no-history {
      text-align: center;
      color: rgba(142,142,147,0.4);
      font-size: 13px;
      padding: 24px 0;
    }
  `;

  // ─── Editor Styles ────────────────────────────────────────────────────────

  const EDITOR_CSS = `
    :host {
      --mac-bg: #1c1c1e;
      --mac-surface: #2c2c2e;
      --mac-surface2: #3a3a3c;
      --mac-border: rgba(255,255,255,0.1);
      --mac-text: #f2f2f7;
      --mac-subtext: #8e8e93;
      --mac-accent: #0a84ff;
      --mac-red: #ff453a;
      --mac-green: #30d158;
      --mac-yellow: #ffd60a;
      --font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
      display: block;
      font-family: var(--font);
      color: var(--mac-text);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .editor-wrap {
      background: var(--mac-bg);
      border-radius: 14px;
      overflow: hidden;
    }

    /* Tabs */
    .tab-bar {
      display: flex;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid var(--mac-border);
    }

    .tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
      color: var(--mac-subtext);
      cursor: pointer;
      transition: color 0.2s, background 0.2s;
      border-bottom: 2px solid transparent;
    }
    .tab:hover { color: var(--mac-text); }
    .tab.active {
      color: var(--mac-accent);
      border-bottom-color: var(--mac-accent);
      background: rgba(10,132,255,0.06);
    }

    .tab-panel { display: none; padding: 20px; }
    .tab-panel.active { display: block; }

    /* Form */
    .field { margin-bottom: 18px; }

    .field-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--mac-subtext);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .field-desc {
      font-size: 11px;
      color: rgba(142,142,147,0.6);
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
    }

    .field-input {
      width: 100%;
      padding: 11px 14px;
      background: var(--mac-surface);
      border: 1px solid var(--mac-border);
      border-radius: 10px;
      color: var(--mac-text);
      font-size: 14px;
      font-family: var(--font);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .field-input:focus {
      border-color: var(--mac-accent);
      box-shadow: 0 0 0 3px rgba(10,132,255,0.2);
    }
    .field-input::placeholder { color: rgba(142,142,147,0.4); }

    .field-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238e8e93' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 36px;
      cursor: pointer;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .toggle-row:last-child { border-bottom: none; }

    .toggle-info { flex: 1; }
    .toggle-name { font-size: 14px; font-weight: 500; color: var(--mac-text); }
    .toggle-desc { font-size: 12px; color: var(--mac-subtext); margin-top: 2px; }

    .mac-toggle {
      width: 44px;
      height: 26px;
      border-radius: 13px;
      background: var(--mac-surface2);
      border: none;
      cursor: pointer;
      position: relative;
      transition: background 0.25s;
      flex-shrink: 0;
    }
    .mac-toggle.on { background: var(--mac-green); }
    .mac-toggle::after {
      content: '';
      position: absolute;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: white;
      top: 2px;
      left: 2px;
      transition: transform 0.25s cubic-bezier(0.34,1.5,0.64,1);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .mac-toggle.on::after { transform: translateX(18px); }

    /* Auth Card */
    .auth-card {
      background: var(--mac-surface);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid var(--mac-border);
    }

    .auth-card-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }

    .yt-logo {
      width: 40px;
      height: 40px;
      background: #ff0000;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .yt-logo svg { width: 22px; height: 22px; fill: white; }

    .auth-card-title { font-size: 16px; font-weight: 700; color: var(--mac-text); }
    .auth-card-sub { font-size: 12px; color: var(--mac-subtext); margin-top: 2px; }

    .auth-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 14px;
    }

    .auth-status.connected {
      background: rgba(48,209,88,0.12);
      color: var(--mac-green);
      border: 1px solid rgba(48,209,88,0.2);
    }

    .auth-status.disconnected {
      background: rgba(255,69,58,0.1);
      color: var(--mac-red);
      border: 1px solid rgba(255,69,58,0.2);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .connected .status-dot { background: var(--mac-green); }
    .disconnected .status-dot { background: var(--mac-red); }

    .auth-btns { display: flex; gap: 10px; flex-wrap: wrap; }

    .btn-google {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 16px;
      background: white;
      color: #1f1f1f;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font);
      cursor: pointer;
      transition: filter 0.15s, transform 0.15s;
      min-width: 160px;
    }
    .btn-google:hover { filter: brightness(0.96); }
    .btn-google:active { transform: scale(0.98); }
    .btn-google svg { width: 18px; height: 18px; flex-shrink: 0; }

    .btn-signout {
      padding: 12px 16px;
      background: rgba(255,69,58,0.1);
      border: 1px solid rgba(255,69,58,0.25);
      border-radius: 10px;
      color: var(--mac-red);
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font);
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-signout:hover { background: rgba(255,69,58,0.18); }

    .scopes-note {
      margin-top: 14px;
      padding: 10px 14px;
      background: rgba(10,132,255,0.08);
      border-radius: 8px;
      border: 1px solid rgba(10,132,255,0.15);
    }
    .scopes-note p { font-size: 12px; color: rgba(142,142,147,0.8); line-height: 1.5; }
    .scopes-note strong { color: var(--mac-accent); }

    .client-id-wrap {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--mac-border);
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--mac-text);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--mac-border);
    }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: rgba(48,209,88,0.08);
      border-radius: 10px;
      border: 1px solid rgba(48,209,88,0.15);
      margin-bottom: 14px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--mac-surface2);
    }

    .user-name { font-size: 14px; font-weight: 600; color: var(--mac-text); }
    .user-email { font-size: 11px; color: var(--mac-subtext); }

    .hint {
      font-size: 12px;
      color: var(--mac-subtext);
      margin-top: 8px;
      line-height: 1.5;
    }

    .hint a { color: var(--mac-accent); text-decoration: none; }
    .hint a:hover { text-decoration: underline; }

    .divider {
      height: 1px;
      background: var(--mac-border);
      margin: 18px 0;
    }

    .color-swatch-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      transition: transform 0.15s, border-color 0.15s;
    }
    .color-swatch:hover { transform: scale(1.2); }
    .color-swatch.selected { border-color: white; }
  `;

  // ─── Main Card Class ───────────────────────────────────────────────────────

  class YoutubePlayerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._currentVideoId = null;
      this._player = null;
      this._playerReady = false;
      this._isPlaying = false;
      this._config = {};
      this._hass = null;
      this._duration = 0;
      this._currentTime = 0;
      this._volume = 80;
      this._progressTimer = null;
      this._popupOpen = false;
      this._shuffleOn = false;
      this._repeatOn = false;
      this._loved = false;
      this._videoTitle = '';
      this._videoChannel = '';
      this._muted = false;
    }

    static get properties() {
      return { hass: {} };
    }

    static getConfigElement() {
      return document.createElement('youtube-player-card-editor');
    }

    static getStubConfig() {
      return { title: 'YouTube Player', show_volume: true, show_controls: true, accent_color: '#0a84ff' };
    }

    setConfig(config) {
      this._config = { ...config };
      if (!this._rendered) {
        this._buildCard();
        this._rendered = true;
      }
      this._applyConfig();
    }

    set hass(hass) {
      this._hass = hass;
    }

    getCardSize() { return 6; }

    _buildCard() {
      const shadow = this.shadowRoot;
      shadow.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = CARD_CSS;
      shadow.appendChild(style);

      // ── Wrapper ──
      const wrap = document.createElement('ha-card');
      wrap.classList.add('card-wrapper');
      shadow.appendChild(wrap);

      // ── Title Bar ──
      wrap.innerHTML = `
        <div class="titlebar">
          <div class="titlebar-title" id="cardTitle">${this._config.title || 'YouTube Player'}</div>
          <div class="titlebar-right">
            <button class="titlebar-btn" id="settingsBtn" title="Settings">⚙</button>
          </div>
        </div>

        <!-- Video Area -->
        <div class="video-container" id="videoContainer">
          <div class="video-placeholder" id="videoPlaceholder">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="38" stroke="white" stroke-width="2" stroke-opacity="0.3"/>
              <path d="M30 27L55 40L30 53V27Z" fill="white" fill-opacity="0.3"/>
            </svg>
            <div class="placeholder-text">No video playing</div>
            <div class="placeholder-hint">Click "Play YouTube URL" to begin</div>
          </div>
          <div id="ytPlayerDiv"></div>
        </div>

        <!-- Track Info -->
        <div class="info-panel">
          <div class="track-info">
            <div class="track-thumb empty" id="trackThumb">♪</div>
            <div class="track-meta">
              <div class="track-title" id="trackTitle">No video selected</div>
              <div class="track-channel" id="trackChannel">Open a YouTube URL to start</div>
            </div>
            <button class="love-btn" id="loveBtn" title="Favourite">♡</button>
          </div>
        </div>

        <!-- Progress -->
        <div class="progress-section">
          <div class="progress-bar-wrap" id="progressBar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-times">
            <span class="time-label" id="timeElapsed">0:00</span>
            <span class="time-label" id="timeDuration">0:00</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button class="ctrl-btn" id="shuffleBtn" title="Shuffle">⇄</button>
          <button class="ctrl-btn" id="prevBtn" title="Previous">⏮</button>
          <button class="ctrl-btn primary" id="playBtn" title="Play/Pause">▶</button>
          <button class="ctrl-btn" id="nextBtn" title="Next">⏭</button>
          <button class="ctrl-btn" id="repeatBtn" title="Repeat">↻</button>
        </div>

        <!-- Volume -->
        <div class="volume-row" id="volumeRow">
          <span class="vol-icon" id="volIcon">🔈</span>
          <input type="range" class="vol-slider" id="volSlider" min="0" max="100" value="80">
          <span class="vol-icon">🔊</span>
        </div>

        <!-- URL Button -->
        <div class="url-btn-row">
          <button class="url-open-btn" id="urlOpenBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6v2H5v11h11v-5h2v7H3V7h7zm7-3h4v4h-2V5.414l-7.293 7.293-1.414-1.414L17.586 4H16V3z"/>
            </svg>
            Play YouTube URL
          </button>
        </div>

        <!-- URL Popup (backdrop appended to body separately) -->
      `;

      // Bind events
      this._bindCardEvents();

      // Build popup (separate from shadow for full-screen backdrop)
      this._buildPopup();
    }

    _bindCardEvents() {
      const s = this.shadowRoot;

      s.getElementById('playBtn').addEventListener('click', () => this._togglePlay());
      s.getElementById('prevBtn').addEventListener('click', () => this._seekRelative(-10));
      s.getElementById('nextBtn').addEventListener('click', () => this._seekRelative(10));

      s.getElementById('shuffleBtn').addEventListener('click', (e) => {
        this._shuffleOn = !this._shuffleOn;
        e.currentTarget.classList.toggle('active', this._shuffleOn);
      });

      s.getElementById('repeatBtn').addEventListener('click', (e) => {
        this._repeatOn = !this._repeatOn;
        e.currentTarget.classList.toggle('active', this._repeatOn);
        if (this._player && this._playerReady) {
          this._player.setLoop(this._repeatOn);
        }
      });

      s.getElementById('loveBtn').addEventListener('click', (e) => {
        this._loved = !this._loved;
        e.currentTarget.textContent = this._loved ? '♥' : '♡';
        e.currentTarget.classList.toggle('active', this._loved);
      });

      s.getElementById('volSlider').addEventListener('input', (e) => {
        this._volume = parseInt(e.target.value);
        this._updateVolIcon();
        if (this._player && this._playerReady) {
          this._player.setVolume(this._volume);
          if (this._muted && this._volume > 0) {
            this._muted = false;
            this._player.unMute();
          }
        }
      });

      s.getElementById('volIcon').addEventListener('click', () => {
        this._muted = !this._muted;
        if (this._player && this._playerReady) {
          this._muted ? this._player.mute() : this._player.unMute();
        }
        this._updateVolIcon();
      });

      s.getElementById('urlOpenBtn').addEventListener('click', () => this._openPopup());

      s.getElementById('progressBar').addEventListener('click', (e) => {
        if (!this._player || !this._playerReady || !this._duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const seekTo = pct * this._duration;
        this._player.seekTo(seekTo, true);
      });


    }

    _buildPopup() {
      // Build popup as a div inside shadow root (will overlay the card)
      const backdrop = document.createElement('div');
      backdrop.className = 'popup-backdrop';
      backdrop.id = 'popupBackdrop';
      backdrop.innerHTML = `
        <div class="popup" id="popup">
          <div class="popup-handle"></div>
          <div class="popup-header">
            <span class="popup-title">▶ Play YouTube</span>
            <button class="popup-close" id="popupClose">✕</button>
          </div>
          <div class="popup-body" id="popupBody">
            <div class="input-group">
              <label class="input-label">YouTube URL</label>
              <input class="mac-input" type="url" id="urlInput" placeholder="https://youtube.com/watch?v=...">
            </div>
            <div class="input-group">
              <label class="input-label">Description <span style="color:rgba(142,142,147,0.4);font-weight:400;text-transform:none;">— optional</span></label>
              <textarea class="mac-input mac-textarea" id="descInput" placeholder="Add a note about this video..."></textarea>
            </div>

            <div class="history-header" id="historyHeader">
              <span class="history-label">Recent</span>
              <button class="clear-btn" id="clearHistoryBtn">Clear All</button>
            </div>
            <div class="history-list" id="historyList"></div>
          </div>
          <div class="popup-actions">
            <button class="btn-secondary" id="popupCancel">Cancel</button>
            <button class="btn-primary" id="popupPlay">▶  Play Now</button>
          </div>
        </div>
      `;

      this.shadowRoot.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this._closePopup();
      });

      backdrop.getElementById('popupClose').addEventListener('click', () => this._closePopup());
      backdrop.getElementById('popupCancel').addEventListener('click', () => this._closePopup());
      backdrop.getElementById('popupPlay').addEventListener('click', () => this._playFromInput());
      backdrop.getElementById('clearHistoryBtn').addEventListener('click', () => {
        clearHistory();
        this._renderHistoryList();
      });

      backdrop.getElementById('urlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._playFromInput();
      });
    }

    _applyConfig() {
      const s = this.shadowRoot;
      if (!s) return;
      const title = s.getElementById('cardTitle');
      if (title) title.textContent = this._config.title || 'YouTube Player';

      // Accent color
      const accent = this._config.accent_color || '#0a84ff';
      this.style.setProperty('--mac-accent', accent);

      // Toggle volume
      const volRow = s.getElementById('volumeRow');
      if (volRow) volRow.style.display = (this._config.show_volume === false) ? 'none' : 'flex';
    }

    _openPopup() {
      const backdrop = this.shadowRoot.getElementById('popupBackdrop');
      if (!backdrop) return;
      this._renderHistoryList();
      this.shadowRoot.getElementById('urlInput').value = '';
      this.shadowRoot.getElementById('descInput').value = '';
      backdrop.classList.add('open');
      this._popupOpen = true;
      setTimeout(() => this.shadowRoot.getElementById('urlInput').focus(), 400);
    }

    _closePopup() {
      const backdrop = this.shadowRoot.getElementById('popupBackdrop');
      if (!backdrop) return;
      backdrop.classList.remove('open');
      this._popupOpen = false;
    }

    _renderHistoryList() {
      const list = this.shadowRoot.getElementById('historyList');
      const header = this.shadowRoot.getElementById('historyHeader');
      if (!list) return;
      const history = getHistory();

      if (history.length === 0) {
        list.innerHTML = `<div class="no-history">No recent videos yet</div>`;
        if (header) header.style.display = 'none';
        return;
      }

      if (header) header.style.display = 'flex';
      list.innerHTML = history.map((item, i) => `
        <div class="history-item" data-url="${item.url}" data-idx="${i}">
          ${item.videoId
            ? `<img class="history-thumb" src="https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg" onerror="this.style.display='none'">`
            : ''}
          <div class="history-info">
            <div class="history-title">${item.desc || item.title || item.url}</div>
            <div class="history-sub">${item.url} &middot; ${item.date || ''}</div>
          </div>
          <button class="history-delete" data-idx="${i}" title="Remove">✕</button>
        </div>
      `).join('');

      list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('history-delete')) return;
          const url = el.getAttribute('data-url');
          this.shadowRoot.getElementById('urlInput').value = url;
          const hist = getHistory();
          const idx = parseInt(el.getAttribute('data-idx'));
          if (hist[idx]) {
            this.shadowRoot.getElementById('descInput').value = hist[idx].desc || '';
          }
        });
      });

      list.querySelectorAll('.history-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-idx'));
          const h = getHistory();
          h.splice(idx, 1);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
          this._renderHistoryList();
        });
      });
    }

    _playFromInput() {
      const urlInput = this.shadowRoot.getElementById('urlInput');
      const descInput = this.shadowRoot.getElementById('descInput');
      const url = urlInput.value.trim();
      if (!url) {
        urlInput.style.borderColor = 'var(--mac-red)';
        setTimeout(() => (urlInput.style.borderColor = ''), 1500);
        return;
      }
      const videoId = extractVideoId(url);
      if (!videoId) {
        urlInput.style.borderColor = 'var(--mac-red)';
        urlInput.placeholder = 'Invalid YouTube URL — try again';
        setTimeout(() => {
          urlInput.style.borderColor = '';
          urlInput.placeholder = 'https://youtube.com/watch?v=...';
        }, 2000);
        return;
      }
      const desc = descInput.value.trim();
      saveToHistory(url, desc, url);
      this._closePopup();
      this._loadVideo(videoId);
    }

    _loadVideo(videoId) {
      this._currentVideoId = videoId;
      this._videoTitle = 'Loading…';
      this._videoChannel = '';
      this._updateTrackInfo();
      this._showVideoArea();

      // Update thumbnail
      const thumb = this.shadowRoot.getElementById('trackThumb');
      if (thumb) {
        thumb.innerHTML = '';
        thumb.className = 'track-thumb';
        const img = document.createElement('img');
        img.style.cssText = 'width:44px;height:44px;object-fit:cover;border-radius:8px;';
        img.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        img.onerror = () => { thumb.className = 'track-thumb empty'; thumb.textContent = '♪'; };
        thumb.appendChild(img);
      }

      loadYTApi().then(() => {
        this._initPlayer(videoId);
      });
    }

    _showVideoArea() {
      const placeholder = this.shadowRoot.getElementById('videoPlaceholder');
      if (placeholder) placeholder.style.display = 'none';
    }

    _initPlayer(videoId) {
      const container = this.shadowRoot.getElementById('ytPlayerDiv');
      if (!container) return;

      if (this._player) {
        this._player.loadVideoById(videoId);
        return;
      }

      this._player = new window.YT.Player(container, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e) => this._onPlayerReady(e),
          onStateChange: (e) => this._onPlayerStateChange(e),
        }
      });

      // Style the iframe
      setTimeout(() => {
        const iframe = container.querySelector('iframe');
        if (iframe) {
          iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
        }
      }, 500);
    }

    _onPlayerReady(event) {
      this._playerReady = true;
      event.target.setVolume(this._volume);
      event.target.playVideo();

      // Fetch video title (from the player)
      setTimeout(() => {
        try {
          const data = event.target.getVideoData();
          if (data) {
            this._videoTitle = data.title || 'YouTube Video';
            this._videoChannel = data.author || '';
            this._updateTrackInfo();
          }
        } catch {}
      }, 1500);
    }

    _onPlayerStateChange(event) {
      const state = event.data;
      this._isPlaying = (state === window.YT.PlayerState.PLAYING);
      this._updatePlayBtn();

      if (state === window.YT.PlayerState.PLAYING) {
        this._duration = this._player.getDuration() || 0;
        this._updateTrackInfo();
        this._startProgressTimer();

        // Fetch title again
        try {
          const data = this._player.getVideoData();
          if (data && data.title) {
            this._videoTitle = data.title;
            this._videoChannel = data.author || '';
            this._updateTrackInfo();
          }
        } catch {}
      } else {
        this._stopProgressTimer();
      }

      // Repeat
      if (state === window.YT.PlayerState.ENDED && this._repeatOn) {
        this._player.playVideo();
      }
    }

    _startProgressTimer() {
      this._stopProgressTimer();
      this._progressTimer = setInterval(() => {
        if (!this._player || !this._playerReady) return;
        this._currentTime = this._player.getCurrentTime() || 0;
        this._duration = this._player.getDuration() || 0;
        this._updateProgress();
      }, 1000);
    }

    _stopProgressTimer() {
      if (this._progressTimer) {
        clearInterval(this._progressTimer);
        this._progressTimer = null;
      }
    }

    _updateProgress() {
      const fill = this.shadowRoot.getElementById('progressFill');
      const elapsed = this.shadowRoot.getElementById('timeElapsed');
      const duration = this.shadowRoot.getElementById('timeDuration');
      if (!fill) return;

      const pct = this._duration > 0 ? (this._currentTime / this._duration) * 100 : 0;
      fill.style.width = `${Math.min(pct, 100)}%`;
      if (elapsed) elapsed.textContent = formatTime(this._currentTime);
      if (duration) duration.textContent = formatTime(this._duration);
    }

    _togglePlay() {
      if (!this._player || !this._playerReady) {
        this._openPopup();
        return;
      }
      if (this._isPlaying) {
        this._player.pauseVideo();
      } else {
        this._player.playVideo();
      }
    }

    _seekRelative(seconds) {
      if (!this._player || !this._playerReady) return;
      const t = this._player.getCurrentTime();
      this._player.seekTo(t + seconds, true);
    }

    _updatePlayBtn() {
      const btn = this.shadowRoot.getElementById('playBtn');
      if (btn) btn.textContent = this._isPlaying ? '⏸' : '▶';
    }

    _updateTrackInfo() {
      const title = this.shadowRoot.getElementById('trackTitle');
      const channel = this.shadowRoot.getElementById('trackChannel');
      if (title) title.textContent = this._videoTitle || 'Loading…';
      if (channel) channel.textContent = this._videoChannel || '';
      const cardTitle = this.shadowRoot.getElementById('cardTitle');
      if (cardTitle && this._videoTitle && this._videoTitle !== 'Loading…') {
        cardTitle.textContent = this._config.title || 'YouTube Player';
      }
    }

    _updateVolIcon() {
      const icon = this.shadowRoot.getElementById('volIcon');
      if (!icon) return;
      if (this._muted || this._volume === 0) icon.textContent = '🔇';
      else if (this._volume < 40) icon.textContent = '🔈';
      else if (this._volume < 70) icon.textContent = '🔉';
      else icon.textContent = '🔊';
    }

    disconnectedCallback() {
      this._stopProgressTimer();
    }
  }

  // ─── Editor Class ─────────────────────────────────────────────────────────

  class YoutubePlayerCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {};
      this._activeTab = 'general';
    }

    setConfig(config) {
      this._config = { ...config };
      this._render();
    }

    get _auth() { return getAuth(); }

    _render() {
      const shadow = this.shadowRoot;
      shadow.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = EDITOR_CSS;
      shadow.appendChild(style);

      const wrap = document.createElement('div');
      wrap.className = 'editor-wrap';
      wrap.innerHTML = `
        <!-- Tab Bar -->
        <div class="tab-bar">
          <div class="tab ${this._activeTab === 'general' ? 'active' : ''}" data-tab="general">⚙ General</div>
          <div class="tab ${this._activeTab === 'account' ? 'active' : ''}" data-tab="account">👤 YouTube Account</div>
          <div class="tab ${this._activeTab === 'appearance' ? 'active' : ''}" data-tab="appearance">🎨 Appearance</div>
        </div>

        <!-- General Tab -->
        <div class="tab-panel ${this._activeTab === 'general' ? 'active' : ''}" data-panel="general">
          <p class="section-title">Card Settings</p>

          <div class="field">
            <label class="field-label">Card Title</label>
            <input class="field-input" type="text" id="cfgTitle" placeholder="YouTube Player"
              value="${this._config.title || ''}">
          </div>

          <div class="divider"></div>
          <p class="section-title">Playback Options</p>

          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-name">Show Volume Control</div>
              <div class="toggle-desc">Display volume slider below the playback controls</div>
            </div>
            <button class="mac-toggle ${this._config.show_volume !== false ? 'on' : ''}" id="toggleVolume"></button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-name">Autoplay on URL Entry</div>
              <div class="toggle-desc">Immediately start playing when a URL is submitted</div>
            </div>
            <button class="mac-toggle ${this._config.autoplay !== false ? 'on' : ''}" id="toggleAutoplay"></button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-name">Loop by Default</div>
              <div class="toggle-desc">Videos will repeat when they end</div>
            </div>
            <button class="mac-toggle ${this._config.loop_default ? 'on' : ''}" id="toggleLoop"></button>
          </div>

          <div class="divider"></div>
          <p class="section-title">History</p>

          <div class="field">
            <label class="field-label">Max History Entries
              <span class="field-desc">— number of recent URLs to remember</span>
            </label>
            <input class="field-input" type="number" id="cfgMaxHistory"
              min="5" max="50" value="${this._config.max_history || 25}"
              placeholder="25">
          </div>
        </div>

        <!-- Account Tab -->
        <div class="tab-panel ${this._activeTab === 'account' ? 'active' : ''}" data-panel="account">
          <div class="auth-card">
            <div class="auth-card-header">
              <div class="yt-logo">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <div>
                <div class="auth-card-title">YouTube Account</div>
                <div class="auth-card-sub">Sign in to access your playlists & watch history</div>
              </div>
            </div>

            <div id="authStatus"></div>
            <div id="userPill"></div>
            <div class="auth-btns" id="authBtns"></div>

            <div class="scopes-note">
              <p>Signing in lets the card access your <strong>YouTube playlists</strong>, <strong>watch history</strong>, and <strong>liked videos</strong>. Your credentials are stored securely in your browser's local storage and are never sent to any external server.</p>
            </div>

            <div class="client-id-wrap">
              <div class="section-title">Google API Configuration</div>
              <div class="field">
                <label class="field-label">Google Client ID
                  <span class="field-desc">— from Google Cloud Console</span>
                </label>
                <input class="field-input" type="text" id="cfgClientId"
                  placeholder="123456789.apps.googleusercontent.com"
                  value="${this._config.google_client_id || ''}">
                <p class="hint">
                  Create a project at <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a>,
                  enable the <strong>YouTube Data API v3</strong>, and create an OAuth 2.0 Client ID (Web application type).
                  Add your Home Assistant URL as an authorised origin.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Appearance Tab -->
        <div class="tab-panel ${this._activeTab === 'appearance' ? 'active' : ''}" data-panel="appearance">
          <div class="section-title">Accent Color</div>
          <div class="field">
            <label class="field-label">Player Accent</label>
            <div class="color-swatch-row" id="colorSwatches">
              ${[
                { color: '#0a84ff', name: 'Sapphire Blue' },
                { color: '#30d158', name: 'Mint Green' },
                { color: '#ff453a', name: 'Coral Red' },
                { color: '#ff9f0a', name: 'Amber' },
                { color: '#bf5af2', name: 'Grape' },
                { color: '#64d2ff', name: 'Sky Blue' },
                { color: '#ff375f', name: 'Pink' },
                { color: '#ffd60a', name: 'Gold' },
              ].map(s => `
                <div class="color-swatch ${(this._config.accent_color || '#0a84ff') === s.color ? 'selected' : ''}"
                  style="background:${s.color}"
                  data-color="${s.color}"
                  title="${s.name}">
                </div>
              `).join('')}
            </div>
            <input class="field-input" type="color" id="cfgAccentColor"
              value="${this._config.accent_color || '#0a84ff'}"
              style="margin-top:10px;height:40px;cursor:pointer;">
          </div>

          <div class="divider"></div>
          <div class="section-title">Player Style</div>

          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-name">Show Progress Bar</div>
              <div class="toggle-desc">Display the time scrubber below the video</div>
            </div>
            <button class="mac-toggle ${this._config.show_progress !== false ? 'on' : ''}" id="toggleProgress"></button>
          </div>


        </div>
      `;

      shadow.appendChild(wrap);
      this._bindEditorEvents();
      this._renderAuth();
    }

    _bindEditorEvents() {
      const s = this.shadowRoot;

      // Tabs
      s.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this._activeTab = tab.getAttribute('data-tab');
          s.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
          s.querySelectorAll('.tab-panel').forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-panel') === this._activeTab);
          });
        });
      });

      // General fields
      const bindInput = (id, key, transform) => {
        const el = s.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
          this._config[key] = transform ? transform(el.value) : el.value;
          this._dispatch();
        });
      };

      bindInput('cfgTitle', 'title');
      bindInput('cfgMaxHistory', 'max_history', v => parseInt(v) || 25);
      bindInput('cfgClientId', 'google_client_id');
      bindInput('cfgAccentColor', 'accent_color');

      // Toggles
      const bindToggle = (id, key, defaultVal) => {
        const el = s.getElementById(id);
        if (!el) return;
        el.addEventListener('click', () => {
          this._config[key] = !el.classList.contains('on');
          el.classList.toggle('on');
          this._dispatch();
        });
      };

      bindToggle('toggleVolume', 'show_volume', true);
      bindToggle('toggleAutoplay', 'autoplay', true);
      bindToggle('toggleLoop', 'loop_default', false);
      bindToggle('toggleProgress', 'show_progress', true);


      // Color swatches
      s.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          s.querySelectorAll('.color-swatch').forEach(s2 => s2.classList.remove('selected'));
          sw.classList.add('selected');
          const color = sw.getAttribute('data-color');
          this._config.accent_color = color;
          const picker = s.getElementById('cfgAccentColor');
          if (picker) picker.value = color;
          this._dispatch();
        });
      });
    }

    _renderAuth() {
      const auth = this._auth;
      const statusEl = this.shadowRoot.getElementById('authStatus');
      const pillEl = this.shadowRoot.getElementById('userPill');
      const btnsEl = this.shadowRoot.getElementById('authBtns');
      if (!statusEl) return;

      if (auth && auth.access_token) {
        statusEl.innerHTML = `
          <div class="auth-status connected">
            <div class="status-dot"></div>
            Connected to YouTube
          </div>
        `;
        pillEl.innerHTML = `
          <div class="user-pill">
            ${auth.avatar ? `<img class="user-avatar" src="${auth.avatar}">` : ''}
            <div>
              <div class="user-name">${auth.name || 'YouTube User'}</div>
              <div class="user-email">${auth.email || ''}</div>
            </div>
          </div>
        `;
        btnsEl.innerHTML = `
          <button class="btn-signout" id="signOutBtn">Sign Out</button>
        `;
        this.shadowRoot.getElementById('signOutBtn').addEventListener('click', () => {
          clearAuth();
          this._renderAuth();
        });
      } else {
        statusEl.innerHTML = `
          <div class="auth-status disconnected">
            <div class="status-dot"></div>
            Not connected
          </div>
        `;
        pillEl.innerHTML = '';
        btnsEl.innerHTML = `
          <button class="btn-google" id="signInBtn">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        `;

        this.shadowRoot.getElementById('signInBtn').addEventListener('click', () => {
          this._initiateGoogleAuth();
        });
      }
    }

    _initiateGoogleAuth() {
      const clientId = this._config.google_client_id;
      if (!clientId) {
        alert('Please enter your Google Client ID first in the "Google API Configuration" section below.');
        return;
      }

      const redirectUri = window.location.origin + window.location.pathname;
      const scope = encodeURIComponent(
        'https://www.googleapis.com/auth/youtube.readonly ' +
        'https://www.googleapis.com/auth/userinfo.profile ' +
        'https://www.googleapis.com/auth/userinfo.email'
      );

      const state = Math.random().toString(36).substring(2);
      sessionStorage.setItem('ytpc_oauth_state', state);

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${scope}` +
        `&state=${state}` +
        `&include_granted_scopes=true`;

      // Open popup for OAuth
      const w = 500, h = 600;
      const x = window.screenX + (window.outerWidth - w) / 2;
      const y = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(authUrl, 'yt_oauth', `width=${w},height=${h},left=${x},top=${y}`);

      // Poll for redirect
      const poll = setInterval(() => {
        try {
          if (!popup || popup.closed) { clearInterval(poll); return; }
          const url = popup.location.href;
          if (url.includes('access_token=') || url.includes('#access_token')) {
            clearInterval(poll);
            popup.close();
            const hash = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
            const params = new URLSearchParams(hash);
            const token = params.get('access_token');
            if (token) this._handleAuthToken(token);
          }
        } catch { /* cross-origin, still loading */ }
      }, 500);
    }

    async _handleAuthToken(token) {
      try {
        // Fetch user profile
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const profile = await res.json();
        const auth = {
          access_token: token,
          name: profile.name || '',
          email: profile.email || '',
          avatar: profile.picture || '',
          granted_at: Date.now()
        };
        saveAuth(auth);
        this._renderAuth();
      } catch (err) {
        console.error('[YouTube Player Card] Auth error:', err);
        alert('Authentication failed. Please try again.');
      }
    }

    _dispatch() {
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }));
    }
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  customElements.define('youtube-player-card', YoutubePlayerCard);
  customElements.define('youtube-player-card-editor', YoutubePlayerCardEditor);

  // Register with Lovelace
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'youtube-player-card',
    name: 'YouTube Player',
    description: 'A Mac-style YouTube media player with URL history and Google account integration.',
    preview: true,
    documentationURL: 'https://github.com/your-username/youtube-player-card',
  });

  console.info(
    `%c YOUTUBE-PLAYER-CARD %c v${CARD_VERSION} `,
    'background:#ff0000;color:white;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:bold',
    'background:#1c1c1e;color:#f2f2f7;padding:2px 6px;border-radius:0 4px 4px 0'
  );

})();
