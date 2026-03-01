/**
 * YouTube Player Card for Home Assistant
 * Version: 2.0.0
 */

(function () {
  'use strict';

  const CARD_VERSION = '2.0.0';
  const HISTORY_KEY  = 'ytpc_url_history';
  const AUTH_KEY     = 'ytpc_google_auth';

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
  }

  function saveToHistory(url, desc) {
    const videoId = extractVideoId(url);
    const h = getHistory().filter(i => i.url !== url);
    h.unshift({ url, desc: desc || '', videoId, date: new Date().toLocaleDateString() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30)));
  }

  function clearHistory() { localStorage.removeItem(HISTORY_KEY); }

  function getAuth()   { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
  function saveAuth(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
  function clearAuth() { localStorage.removeItem(AUTH_KEY); }

  // ─── Card Styles ──────────────────────────────────────────────────────────

  const CARD_CSS = `
    :host {
      --accent:  #0a84ff;
      --bg:      #000;
      --text:    #f2f2f7;
      --subtext: rgba(242,242,247,0.5);
      --font: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      display: block;
      font-family: var(--font);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .card {
      position: relative;
      background: var(--bg);
      border-radius: 14px;
      overflow: hidden;
      aspect-ratio: 16 / 9;
    }

    .yt-iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    #ytIframeSlot {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .empty-state {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      background: radial-gradient(ellipse at 50% 60%, #1a1a1e 0%, #0a0a0c 100%);
    }

    .empty-icon { width: 56px; height: 56px; opacity: 0.2; }

    .empty-text {
      color: var(--subtext);
      font-size: 14px;
      font-weight: 400;
    }

    /* Hover overlay — bottom-right corner button */
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 14px;
      opacity: 0;
      transition: opacity 0.22s ease;
      /* Always none so clicks pass straight through to the YouTube iframe */
      pointer-events: none;
      z-index: 10;
    }

    @media (hover: hover) {
      .card:hover .overlay { opacity: 1; }
    }

    .card.overlay-visible .overlay { opacity: 1; }

    /* Only the button itself catches pointer events */
    .open-btn { pointer-events: all; }

    .open-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.18s, border-color 0.18s, transform 0.12s;
      color: white;
    }
    .open-btn:hover {
      background: rgba(0,0,0,0.8);
      border-color: rgba(255,255,255,0.38);
    }
    .open-btn:active { transform: scale(0.9); }
    .open-btn svg { width: 18px; height: 18px; flex-shrink: 0; }

    /* ── Popup backdrop ── */
    .popup-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 9999;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease;
    }
    .popup-backdrop.open { opacity: 1; pointer-events: all; }

    .popup {
      width: 100%;
      max-width: 540px;
      background: #1c1c1e;
      border-radius: 20px 20px 0 0;
      border: 1px solid rgba(255,255,255,0.1);
      border-bottom: none;
      transform: translateY(100%);
      transition: transform 0.36s cubic-bezier(0.32, 1.15, 0.6, 1);
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .popup-backdrop.open .popup { transform: translateY(0); }

    .popup-handle {
      width: 36px; height: 4px;
      background: rgba(255,255,255,0.18);
      border-radius: 4px;
      margin: 12px auto 0;
      flex-shrink: 0;
    }

    .popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px 10px;
      flex-shrink: 0;
    }

    .popup-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.3px;
    }

    .popup-close {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      border: none;
      color: var(--subtext);
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
      font-family: var(--font);
    }
    .popup-close:hover { background: rgba(255,255,255,0.18); color: var(--text); }

    .popup-body {
      padding: 0 20px 4px;
      overflow-y: auto;
      flex: 1;
    }

    .input-group { margin-bottom: 14px; }

    .input-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--subtext);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-bottom: 7px;
      display: block;
    }

    .field-input {
      width: 100%;
      padding: 12px 14px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: var(--text);
      font-size: 15px;
      font-family: var(--font);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .field-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(10,132,255,0.2);
    }
    .field-input::placeholder { color: rgba(242,242,247,0.25); }
    .field-input.error { border-color: #ff453a; box-shadow: 0 0 0 3px rgba(255,69,58,0.2); }
    .field-textarea { resize: vertical; min-height: 68px; line-height: 1.5; }

    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 6px 0 10px;
    }

    .history-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--subtext);
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }

    .clear-btn {
      background: none; border: none;
      color: #ff453a;
      font-size: 12px; font-weight: 500; font-family: var(--font);
      cursor: pointer;
      padding: 3px 8px; border-radius: 5px;
      transition: background 0.15s;
    }
    .clear-btn:hover { background: rgba(255,69,58,0.1); }

    .history-list { display: flex; flex-direction: column; gap: 6px; padding-bottom: 10px; }

    .history-item {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 9px 11px;
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s;
      border: 1px solid transparent;
    }
    .history-item:hover {
      background: rgba(255,255,255,0.09);
      border-color: rgba(255,255,255,0.1);
    }

    .history-thumb {
      width: 42px; height: 30px;
      border-radius: 5px; object-fit: cover;
      background: rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .history-info { flex: 1; overflow: hidden; }

    .history-title {
      font-size: 13px; font-weight: 500; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .history-sub {
      font-size: 11px; color: var(--subtext); margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .history-del {
      background: none; border: none;
      color: rgba(242,242,247,0.25);
      cursor: pointer; font-size: 13px;
      padding: 4px 6px; border-radius: 4px;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0; font-family: var(--font);
    }
    .history-del:hover { color: #ff453a; background: rgba(255,69,58,0.1); }

    .no-history {
      text-align: center;
      color: rgba(242,242,247,0.22);
      font-size: 13px;
      padding: 20px 0 14px;
    }

    .popup-actions {
      display: flex; gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .btn-cancel {
      padding: 13px 18px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: var(--subtext);
      font-size: 14px; font-weight: 500; font-family: var(--font);
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-cancel:hover { background: rgba(255,255,255,0.13); }

    .btn-play {
      flex: 1;
      padding: 13px;
      background: var(--accent);
      border: none; border-radius: 10px;
      color: #fff;
      font-size: 15px; font-weight: 600; font-family: var(--font);
      cursor: pointer;
      transition: filter 0.15s, transform 0.15s;
    }
    .btn-play:hover { filter: brightness(1.1); }
    .btn-play:active { transform: scale(0.98); }
  `;

  // ─── Editor Styles ────────────────────────────────────────────────────────

  const EDITOR_CSS = `
    :host {
      --accent:  #0a84ff;
      --bg:      #1c1c1e;
      --surface: #2c2c2e;
      --surface2:#3a3a3c;
      --border:  rgba(255,255,255,0.1);
      --text:    #f2f2f7;
      --subtext: #8e8e93;
      --red:     #ff453a;
      --green:   #30d158;
      --font: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      display: block; font-family: var(--font); color: var(--text);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .editor { background: var(--bg); border-radius: 12px; overflow: hidden; }

    .tabs {
      display: flex;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid var(--border);
    }
    .tab {
      flex: 1; padding: 11px 8px; text-align: center;
      font-size: 12px; font-weight: 500; color: var(--subtext);
      cursor: pointer; border-bottom: 2px solid transparent;
      transition: color 0.2s;
    }
    .tab:hover { color: var(--text); }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); background: rgba(10,132,255,0.06); }

    .panel { display: none; padding: 18px; }
    .panel.active { display: block; }

    .field { margin-bottom: 16px; }

    .field-label {
      font-size: 11px; font-weight: 600; color: var(--subtext);
      text-transform: uppercase; letter-spacing: 0.5px;
      margin-bottom: 7px; display: block;
    }

    .field-input {
      width: 100%; padding: 11px 13px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text);
      font-size: 14px; font-family: var(--font);
      outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    }
    .field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(10,132,255,0.2); }
    .field-input::placeholder { color: rgba(142,142,147,0.4); }

    .divider { height: 1px; background: var(--border); margin: 16px 0; }

    .section-title {
      font-size: 13px; font-weight: 700; color: var(--text);
      margin-bottom: 12px;
      display: flex; align-items: center; gap: 8px;
    }
    .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

    .toggle-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-name { font-size: 14px; font-weight: 500; color: var(--text); }
    .toggle-desc { font-size: 12px; color: var(--subtext); margin-top: 2px; }

    .toggle {
      width: 44px; height: 26px; border-radius: 13px;
      background: var(--surface2); border: none;
      cursor: pointer; position: relative; transition: background 0.25s; flex-shrink: 0;
    }
    .toggle.on { background: var(--green); }
    .toggle::after {
      content: ''; position: absolute;
      width: 22px; height: 22px; border-radius: 50%;
      background: white; top: 2px; left: 2px;
      transition: transform 0.25s cubic-bezier(0.34,1.5,0.64,1);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .toggle.on::after { transform: translateX(18px); }

    .auth-card { background: var(--surface); border-radius: 12px; padding: 18px; border: 1px solid var(--border); }

    .auth-header { display: flex; align-items: center; gap: 13px; margin-bottom: 14px; }

    .yt-icon {
      width: 38px; height: 38px; background: #ff0000;
      border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .yt-icon svg { width: 20px; height: 20px; fill: white; }

    .auth-title { font-size: 15px; font-weight: 700; }
    .auth-sub { font-size: 12px; color: var(--subtext); margin-top: 2px; }

    .optional-badge {
      display: inline-block; font-size: 10px; font-weight: 500; color: var(--subtext);
      background: rgba(142,142,147,0.15); padding: 2px 6px; border-radius: 4px;
      margin-left: 6px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.4px;
    }

    .info-banner {
      background: rgba(10,132,255,0.08); border: 1px solid rgba(10,132,255,0.18);
      border-radius: 8px; padding: 10px 13px; margin-bottom: 14px;
      font-size: 12px; color: rgba(10,132,255,0.9); line-height: 1.5;
    }

    .status-pill {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 13px; border-radius: 8px;
      font-size: 13px; font-weight: 500; margin-bottom: 13px;
    }
    .status-pill.connected    { background: rgba(48,209,88,0.1);  color: var(--green); border: 1px solid rgba(48,209,88,0.2); }
    .status-pill.disconnected { background: rgba(255,69,58,0.08); color: var(--red);   border: 1px solid rgba(255,69,58,0.18); }
    .status-pill.unconfigured { background: rgba(142,142,147,0.08); color: var(--subtext); border: 1px solid rgba(142,142,147,0.15); }

    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .connected .dot    { background: var(--green); }
    .disconnected .dot { background: var(--red); }
    .unconfigured .dot { background: var(--subtext); }

    .user-pill {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 13px; background: rgba(48,209,88,0.07);
      border-radius: 10px; border: 1px solid rgba(48,209,88,0.14); margin-bottom: 13px;
    }
    .user-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; background: var(--surface2); }
    .user-name { font-size: 13px; font-weight: 600; }
    .user-email { font-size: 11px; color: var(--subtext); }

    .auth-btns { display: flex; gap: 9px; flex-wrap: wrap; }

    .btn-google {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 9px;
      padding: 11px 14px; background: white; color: #1f1f1f;
      border: none; border-radius: 10px;
      font-size: 13px; font-weight: 500; font-family: var(--font);
      cursor: pointer; transition: filter 0.15s, transform 0.15s; min-width: 140px;
    }
    .btn-google:hover { filter: brightness(0.96); }
    .btn-google:active { transform: scale(0.98); }
    .btn-google[disabled] { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
    .btn-google svg { width: 17px; height: 17px; flex-shrink: 0; }

    .btn-signout {
      padding: 11px 14px;
      background: rgba(255,69,58,0.1); border: 1px solid rgba(255,69,58,0.22);
      border-radius: 10px; color: var(--red);
      font-size: 13px; font-weight: 500; font-family: var(--font);
      cursor: pointer; transition: background 0.15s;
    }
    .btn-signout:hover { background: rgba(255,69,58,0.18); }

    .hint { font-size: 12px; color: var(--subtext); margin-top: 8px; line-height: 1.55; }
    .hint a { color: var(--accent); text-decoration: none; }
    .hint a:hover { text-decoration: underline; }

    .swatches { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .swatch {
      width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
      border: 2px solid transparent; transition: transform 0.15s, border-color 0.15s;
    }
    .swatch:hover { transform: scale(1.2); }
    .swatch.selected { border-color: white; transform: scale(1.1); }
  `;

  // ─── Card ─────────────────────────────────────────────────────────────────

  class YoutubePlayerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config         = {};
      this._currentVideoId = null;
      this._overlayTimer   = null;
    }

    static getConfigElement() { return document.createElement('youtube-player-card-editor'); }
    static getStubConfig()    { return { title: 'YouTube Player', accent_color: '#0a84ff' }; }

    setConfig(config) {
      this._config = { ...config };
      this._render();
    }

    set hass(h) { this._hass = h; }
    getCardSize() { return 4; }

    _render() {
      const shadow = this.shadowRoot;
      shadow.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = CARD_CSS;
      shadow.appendChild(style);

      this.style.setProperty('--accent', this._config.accent_color || '#0a84ff');

      const card = document.createElement('ha-card');
      card.className = 'card';

      card.innerHTML = `
        <div class="empty-state" id="emptyState">
          <svg class="empty-icon" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="white" stroke-width="1.5" stroke-opacity="0.5"/>
            <path d="M32 27l22 13-22 13V27z" fill="white" fill-opacity="0.5"/>
          </svg>
          <span class="empty-text">No video playing</span>
        </div>

        <div id="ytIframeSlot"></div>

        <div class="overlay" id="overlay">
          <button class="open-btn" id="openBtn" aria-label="Play YouTube URL" title="Play YouTube URL">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2C2 8.76 2 12 2 12s0 3.24.4 4.8a2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43A2.5 2.5 0 0 0 21.6 16.8C22 15.24 22 12 22 12s0-3.24-.4-4.8z"/>
              <polygon points="10,8.5 16,12 10,15.5" fill="white" stroke="none"/>
            </svg>
          </button>
        </div>
      `;

      shadow.appendChild(card);
      this._buildPopup(shadow);
      this._bindEvents(card);

      if (this._currentVideoId) {
        this._showVideo(this._currentVideoId);
      }
    }

    _bindEvents(card) {
      const shadow = this.shadowRoot;

      shadow.getElementById('openBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._openPopup();
      });

      // Mobile: tap the card (not the button) to toggle overlay visibility
      card.addEventListener('touchend', (e) => {
        if (e.target.closest('.open-btn') || e.target.closest('.popup-backdrop')) return;
        card.classList.toggle('overlay-visible');
        clearTimeout(this._overlayTimer);
        if (card.classList.contains('overlay-visible')) {
          this._overlayTimer = setTimeout(() => card.classList.remove('overlay-visible'), 3500);
        }
      }, { passive: true });
    }

    _buildPopup(shadow) {
      const backdrop = document.createElement('div');
      backdrop.className = 'popup-backdrop';

      backdrop.innerHTML = `
        <div class="popup">
          <div class="popup-handle"></div>
          <div class="popup-header">
            <span class="popup-title">Play YouTube</span>
            <button class="popup-close" id="popupClose" aria-label="Close">✕</button>
          </div>
          <div class="popup-body">
            <div class="input-group">
              <label class="input-label">YouTube URL</label>
              <input class="field-input" type="url" id="urlInput"
                placeholder="https://youtube.com/watch?v=…"
                autocomplete="off" inputmode="url">
            </div>
            <div class="input-group">
              <label class="input-label">
                Note
                <span style="font-weight:400;text-transform:none;letter-spacing:0;opacity:.5;margin-left:4px;">— optional</span>
              </label>
              <textarea class="field-input field-textarea" id="descInput"
                placeholder="Add a note for this video…"></textarea>
            </div>

            <div class="history-header" id="historyHeader" style="display:none;">
              <span class="history-label">Recent</span>
              <button class="clear-btn" id="clearBtn">Clear All</button>
            </div>
            <div class="history-list" id="historyList"></div>
          </div>
          <div class="popup-actions">
            <button class="btn-cancel" id="popupCancel">Cancel</button>
            <button class="btn-play"   id="popupPlay">▶  Play</button>
          </div>
        </div>
      `;

      shadow.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) this._closePopup(); });
      backdrop.querySelector('#popupClose').addEventListener('click',  () => this._closePopup());
      backdrop.querySelector('#popupCancel').addEventListener('click', () => this._closePopup());
      backdrop.querySelector('#popupPlay').addEventListener('click',   () => this._playFromInput());
      backdrop.querySelector('#clearBtn').addEventListener('click',    () => { clearHistory(); this._renderHistory(); });
      backdrop.querySelector('#urlInput').addEventListener('keydown',  (e) => { if (e.key === 'Enter') this._playFromInput(); });
    }

    _openPopup() {
      const shadow = this.shadowRoot;
      shadow.querySelector('#urlInput').value  = '';
      shadow.querySelector('#descInput').value = '';
      shadow.querySelector('#urlInput').classList.remove('error');
      this._renderHistory();
      shadow.querySelector('.popup-backdrop').classList.add('open');
      setTimeout(() => shadow.querySelector('#urlInput').focus(), 360);
    }

    _closePopup() {
      this.shadowRoot.querySelector('.popup-backdrop').classList.remove('open');
    }

    _renderHistory() {
      const shadow  = this.shadowRoot;
      const list    = shadow.getElementById('historyList');
      const header  = shadow.getElementById('historyHeader');
      const history = getHistory();
      if (!list) return;

      if (history.length === 0) {
        list.innerHTML = `<div class="no-history">No recent videos</div>`;
        if (header) header.style.display = 'none';
        return;
      }

      if (header) header.style.display = 'flex';
      list.innerHTML = history.map((item, i) => `
        <div class="history-item" data-url="${item.url}" data-idx="${i}">
          ${item.videoId
            ? `<img class="history-thumb"
                src="https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg"
                onerror="this.style.display='none'">`
            : ''}
          <div class="history-info">
            <div class="history-title">${item.desc || item.url}</div>
            <div class="history-sub">${item.url}${item.date ? ' · ' + item.date : ''}</div>
          </div>
          <button class="history-del" data-idx="${i}" aria-label="Remove">✕</button>
        </div>
      `).join('');

      list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('history-del')) return;
          shadow.querySelector('#urlInput').value  = el.dataset.url;
          const idx = parseInt(el.dataset.idx);
          shadow.querySelector('#descInput').value = getHistory()[idx]?.desc || '';
        });
      });

      list.querySelectorAll('.history-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const h = getHistory();
          h.splice(parseInt(btn.dataset.idx), 1);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
          this._renderHistory();
        });
      });
    }

    _playFromInput() {
      const shadow = this.shadowRoot;
      const urlEl  = shadow.querySelector('#urlInput');
      const descEl = shadow.querySelector('#descInput');
      const url    = urlEl.value.trim();
      urlEl.classList.remove('error');

      if (!url) { urlEl.classList.add('error'); urlEl.focus(); return; }

      const videoId = extractVideoId(url);
      if (!videoId) {
        urlEl.classList.add('error');
        const orig = urlEl.placeholder;
        urlEl.placeholder = 'Invalid YouTube URL — please try again';
        setTimeout(() => { urlEl.classList.remove('error'); urlEl.placeholder = orig; }, 2500);
        return;
      }

      saveToHistory(url, descEl.value.trim());
      this._closePopup();
      this._showVideo(videoId);
    }

    _showVideo(videoId) {
      this._currentVideoId = videoId;
      const shadow = this.shadowRoot;
      const slot   = shadow.getElementById('ytIframeSlot');
      const empty  = shadow.getElementById('emptyState');
      if (!slot) return;

      // Always destroy and recreate the iframe so the allow attribute is set
      // BEFORE any src is assigned — this is critical for autoplay & embed
      // permissions inside shadow DOMs.
      slot.innerHTML = '';

      const iframe = document.createElement('iframe');
      iframe.className = 'yt-iframe';

      // Must be set before src — browsers snapshot permissions at creation time
      iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('referrerpolicy', 'origin');

      // origin= tells YouTube exactly which domain is embedding it — required
      // to avoid Error 153 inside non-standard rendering contexts like HA.
      const params = new URLSearchParams({
        autoplay:       '1',
        rel:            '0',
        modestbranding: '1',
        playsinline:    '1',
        origin:         window.location.origin,
      });
      iframe.src = `https://www.youtube.com/embed/${videoId}?${params}`;

      slot.appendChild(iframe);
      if (empty) empty.style.display = 'none';
    }
  }

  // ─── Editor ───────────────────────────────────────────────────────────────

  class YoutubePlayerCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config    = {};
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
      wrap.className = 'editor';

      const tabs = ['general', 'account', 'appearance'];
      const tabLabels = { general: '⚙ General', account: '👤 Account', appearance: '🎨 Style' };

      wrap.innerHTML = `
        <div class="tabs">
          ${tabs.map(t => `<div class="tab ${this._activeTab === t ? 'active' : ''}" data-tab="${t}">${tabLabels[t]}</div>`).join('')}
        </div>

        <!-- General -->
        <div class="panel ${this._activeTab === 'general' ? 'active' : ''}" data-panel="general">
          <div class="field">
            <label class="field-label">Card Title</label>
            <input class="field-input" type="text" id="cfgTitle"
              placeholder="YouTube Player" value="${this._config.title || ''}">
          </div>

          <div class="divider"></div>
          <div class="section-title">History</div>
          <div class="field">
            <label class="field-label">Max History Entries</label>
            <input class="field-input" type="number" id="cfgMaxHistory"
              min="5" max="50" value="${this._config.max_history || 25}" placeholder="25">
          </div>

          <div class="divider"></div>
          <div class="section-title">Behaviour</div>
          <div class="toggle-row">
            <div>
              <div class="toggle-name">Loop Videos</div>
              <div class="toggle-desc">Replay the video automatically when it ends</div>
            </div>
            <button class="toggle ${this._config.loop_default ? 'on' : ''}" id="toggleLoop"></button>
          </div>
        </div>

        <!-- Account -->
        <div class="panel ${this._activeTab === 'account' ? 'active' : ''}" data-panel="account">
          <div class="auth-card">
            <div class="auth-header">
              <div class="yt-icon">
                <svg viewBox="0 0 24 24"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.5 20.45 12 20.45 12 20.45s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>
              </div>
              <div>
                <div class="auth-title">YouTube Account <span class="optional-badge">optional</span></div>
                <div class="auth-sub">Sign in to access playlists &amp; watch history</div>
              </div>
            </div>

            <div class="info-banner">
              ℹ️ Login is entirely optional. The card plays any YouTube URL without an account. Sign in only if you want playlist access.
            </div>

            <div id="authStatus"></div>
            <div id="userPill"></div>
            <div id="authBtns" class="auth-btns"></div>

            <div class="divider"></div>
            <div class="section-title">API Configuration</div>
            <div class="field">
              <label class="field-label">
                Google Client ID
                <span style="font-weight:400;text-transform:none;opacity:.5;"> — only needed for sign-in</span>
              </label>
              <input class="field-input" type="text" id="cfgClientId"
                placeholder="Leave blank to skip login"
                value="${this._config.google_client_id || ''}">
              <p class="hint">
                To enable sign-in, create a project at
                <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a>,
                enable the YouTube Data API v3, create an OAuth 2.0 Web Client ID,
                and add your Home Assistant URL as an authorised origin.
              </p>
            </div>
          </div>
        </div>

        <!-- Appearance -->
        <div class="panel ${this._activeTab === 'appearance' ? 'active' : ''}" data-panel="appearance">
          <div class="section-title">Accent Color</div>
          <div class="field">
            <label class="field-label">Popup &amp; Button Highlight</label>
            <div class="swatches" id="swatches">
              ${['#0a84ff','#30d158','#ff453a','#ff9f0a','#bf5af2','#64d2ff','#ff375f','#ffd60a'].map(c => `
                <div class="swatch ${(this._config.accent_color || '#0a84ff') === c ? 'selected' : ''}"
                  style="background:${c}" data-color="${c}" title="${c}"></div>
              `).join('')}
            </div>
            <input class="field-input" type="color" id="cfgAccentColor"
              value="${this._config.accent_color || '#0a84ff'}"
              style="margin-top:10px;height:38px;cursor:pointer;padding:4px 8px;">
          </div>
        </div>
      `;

      shadow.appendChild(wrap);
      this._bindEditorEvents();
      this._renderAuth();
    }

    _bindEditorEvents() {
      const s = this.shadowRoot;

      s.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this._activeTab = tab.dataset.tab;
          s.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
          s.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === this._activeTab));
        });
      });

      const bind = (id, key, fn) => {
        const el = s.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
          this._config[key] = fn ? fn(el.value) : el.value;
          this._dispatch();
        });
      };

      bind('cfgTitle',       'title');
      bind('cfgMaxHistory',  'max_history',     v => parseInt(v) || 25);
      bind('cfgClientId',    'google_client_id');
      bind('cfgAccentColor', 'accent_color');

      const bindToggle = (id, key) => {
        const el = s.getElementById(id);
        if (!el) return;
        el.addEventListener('click', () => {
          this._config[key] = !el.classList.contains('on');
          el.classList.toggle('on');
          this._dispatch();
        });
      };
      bindToggle('toggleLoop', 'loop_default');

      s.querySelectorAll('.swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          s.querySelectorAll('.swatch').forEach(s2 => s2.classList.remove('selected'));
          sw.classList.add('selected');
          this._config.accent_color = sw.dataset.color;
          const picker = s.getElementById('cfgAccentColor');
          if (picker) picker.value = sw.dataset.color;
          this._dispatch();
        });
      });
    }

    _renderAuth() {
      const s        = this.shadowRoot;
      const auth     = this._auth;
      const statusEl = s.getElementById('authStatus');
      const pillEl   = s.getElementById('userPill');
      const btnsEl   = s.getElementById('authBtns');
      if (!statusEl) return;

      pillEl.innerHTML = '';

      if (auth && auth.access_token) {
        statusEl.innerHTML = `<div class="status-pill connected"><div class="dot"></div>Connected to YouTube</div>`;
        pillEl.innerHTML   = `
          <div class="user-pill">
            ${auth.avatar ? `<img class="user-avatar" src="${auth.avatar}">` : ''}
            <div>
              <div class="user-name">${auth.name || 'YouTube User'}</div>
              <div class="user-email">${auth.email || ''}</div>
            </div>
          </div>`;
        btnsEl.innerHTML   = `<button class="btn-signout" id="signOutBtn">Sign Out</button>`;
        s.getElementById('signOutBtn').addEventListener('click', () => { clearAuth(); this._renderAuth(); });

      } else if (!this._config.google_client_id) {
        statusEl.innerHTML = `<div class="status-pill unconfigured"><div class="dot"></div>Not configured — enter a Client ID below to enable sign-in</div>`;
        btnsEl.innerHTML   = `<button class="btn-google" disabled>${this._googleSvg()}Sign in with Google</button>`;

      } else {
        statusEl.innerHTML = `<div class="status-pill disconnected"><div class="dot"></div>Not connected</div>`;
        btnsEl.innerHTML   = `<button class="btn-google" id="signInBtn">${this._googleSvg()}Sign in with Google</button>`;
        s.getElementById('signInBtn').addEventListener('click', () => this._initiateGoogleAuth());
      }
    }

    _googleSvg() {
      return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>`;
    }

    _initiateGoogleAuth() {
      const clientId = this._config.google_client_id;
      if (!clientId) return;

      const redirectUri = window.location.origin + window.location.pathname;
      const scope = encodeURIComponent(
        'https://www.googleapis.com/auth/youtube.readonly ' +
        'https://www.googleapis.com/auth/userinfo.profile ' +
        'https://www.googleapis.com/auth/userinfo.email'
      );
      const state = Math.random().toString(36).substring(2);
      sessionStorage.setItem('ytpc_oauth_state', state);

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${scope}` +
        `&state=${state}`;

      const w = 500, h = 600;
      const x = window.screenX + (window.outerWidth  - w) / 2;
      const y = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(authUrl, 'ytpc_oauth', `width=${w},height=${h},left=${x},top=${y}`);

      const poll = setInterval(() => {
        try {
          if (!popup || popup.closed) { clearInterval(poll); return; }
          const url = popup.location.href;
          if (url.includes('access_token')) {
            clearInterval(poll);
            popup.close();
            const hash   = url.split('#')[1] || url.split('?')[1] || '';
            const params = new URLSearchParams(hash);
            const token  = params.get('access_token');
            if (token) this._handleToken(token);
          }
        } catch { /* cross-origin */ }
      }, 500);
    }

    async _handleToken(token) {
      try {
        const res     = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const profile = await res.json();
        saveAuth({
          access_token: token,
          name:  profile.name    || '',
          email: profile.email   || '',
          avatar: profile.picture || '',
        });
        this._renderAuth();
      } catch (err) {
        console.error('[youtube-player-card] Auth error:', err);
        alert('Authentication failed. Please try again.');
      }
    }

    _dispatch() {
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true, composed: true,
      }));
    }
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  customElements.define('youtube-player-card',        YoutubePlayerCard);
  customElements.define('youtube-player-card-editor', YoutubePlayerCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type:        'youtube-player-card',
    name:        'YouTube Player',
    description: 'A minimal YouTube player card with URL history and optional Google account sign-in.',
    preview:     true,
  });

  console.info(
    `%c YOUTUBE-PLAYER-CARD %c v${CARD_VERSION} `,
    'background:#ff0000;color:#fff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:bold',
    'background:#1c1c1e;color:#f2f2f7;padding:2px 6px;border-radius:0 4px 4px 0'
  );

})();
