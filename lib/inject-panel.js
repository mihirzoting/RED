const BRAND = { fill: '#534AB7', light: '#EEEDFE', text: '#3C3489' };
const TIERS = {
  high: { fill: '#1D9E75', bg: '#E1F5EE', textDark: '#085041', textLight: '#0F6E56' },
  medium: { fill: '#EF9F27', bg: '#FAEEDA', text: '#633806' },
  low: { fill: '#E24B4A', bg: '#FCEBEB', textDark: '#791F1F', textLight: '#A32D2D' },
};
const INFO = { bg: '#E6F1FB', text: '#0C447C' };

function getTier(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function getTierColors(score) {
  return TIERS[getTier(score)];
}

function detectDarkMode() {
  const themeAttr = document.documentElement.getAttribute('data-theme');
  if (themeAttr === 'dark') return true;
  if (themeAttr === 'light') return false;
  if (document.documentElement.classList.contains('dark')) return true;
  if (document.body.classList.contains('dark')) return true;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
  const el = document.querySelector('[contenteditable="true"]') || document.querySelector('main') || document.body;
  const bg = getComputedStyle(el).backgroundColor;
  const m = bg ? bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/) : null;
  if (m) {
    const l = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 * 100;
    if (l < 50) return true;
  }
  return false;
}

function borrowPageTokens() {
  return {
    bg: '#FAF9F6',
    text: '#1C1917',
    border: '#E8E4DE',
    muted: 'rgba(28,25,23,0.45)',
    font: "system-ui, -apple-system, sans-serif",
    radius: '12px',
    shadow: '0 4px 24px rgba(0,0,0,0.10)',
    isDark: false,
  };
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildStyles(tokens) {
  const { bg, text, border, muted, font, shadow } = tokens;
  return `
    :host {
      all: initial;
      box-sizing: border-box;
      display: block;
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 9999;
      font-family: ${font};
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }

    #red-indicator {
      position: fixed;
      top: 60px; right: 8px;
      width: 36px; height: 36px;
      border-radius: 50%;
      background: #FAF9F6;
      border: 1px solid #E8E4DE;
      cursor: pointer;
      pointer-events: auto;
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: box-shadow 300ms ease-out;
    }
    #red-indicator.has-analysis {
      box-shadow: 0 0 0 2px #FAF9F6, 0 0 0 4px transparent;
    }
    .indicator-star {
      width: 20px;
      height: 20px;
      display: block;
      pointer-events: none;
    }

    #red-panel {
      position: fixed;
      top: 110px; right: 12px;
      width: 320px;
      max-width: min(320px, calc(100vw - 24px));
      height: auto;
      max-height: calc(100vh - 130px);
      box-sizing: border-box;
      background: #FAF9F6;
      border: 1px solid #E8E4DE;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      pointer-events: auto;
      z-index: 999999;
      overflow-y: auto;
      overflow-x: hidden;
      transform: translateX(100%);
      transition: transform 200ms ease-out;
    }
    #red-panel.panel--open {
      transform: translateX(0);
    }

    .card-inner {
      padding: 0 8px;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      width: 100%;
    }
    .header-left, .header-right {
      width: 30px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .header-left { justify-content: flex-start; }
    .header-right { justify-content: flex-end; }
    .header-logo-wrap {
      position: relative;
      flex: 1;
      display: flex;
      justify-content: center;
      padding: 0;
      margin: 0;
    }
    .header-logo-img {
      display: block;
      width: 40%;
      max-width: 120px;
      height: auto;
      margin: 6px auto 4px auto;
    }
    .header-star {
      position: absolute;
      width: 14px;
      height: 14px;
      pointer-events: none;
    }
    .header-star--tl { top: 2px; left: -22px; }
    .header-star--tr { top: 2px; right: -22px; }
    .header-star--bl { bottom: -2px; left: -18px; }
    .header-star--br { bottom: -2px; right: -18px; }
 
    .score-section-wrap {
      width: 100%;
      padding: 12px 8px 6px 8px;
    }
    .score-section {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .score-circle-wrap {
      position: relative;
      flex-shrink: 0;
      width: 80px;
      height: 80px;
    }
    .score-circle-container {
      width: 80px;
      height: 80px;
    }
    .score-svg-ring-bg {
      fill: none;
      stroke: #E8E4DE;
      stroke-width: 5;
    }
    .score-svg-ring-fill {
      fill: none;
      stroke-width: 5;
      stroke-linecap: round;
      transition: stroke 300ms ease-out;
    }

    .score-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .score-grid {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .metric-row {
      display: flex;
      align-items: center;
    }
    .metric-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: rgba(28,25,23,0.5);
      text-transform: uppercase;
      width: 80px;
      flex-shrink: 0;
    }
    .metric-bar-track {
      flex: 1;
      height: 5px;
      background: #E8E4DE;
      border-radius: 3px;
      overflow: hidden;
      margin: 0 8px;
    }
    .metric-bar-fill {
      height: 100%;
      width: 0%;
      border-radius: 3px;
      transition: width 200ms ease-out, background-color 200ms ease-out;
    }
    .metric-value {
      font-size: 12px;
      font-weight: 600;
      width: 28px;
      text-align: right;
      flex-shrink: 0;
      transition: color 200ms ease-out;
    }

    .tier-summary-wrap {
      width: 100%;
      padding: 0 8px 12px 8px;
    }
    .tier-label-row {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
      line-height: 1.3;
    }
    .summary-sentence {
      font-size: 11px;
      color: rgba(28,25,23,0.45);
      font-weight: 400;
      line-height: 1.4;
    }

    .section-pad {
      width: 100%;
      padding: 0 8px;
    }
    .section-pad-bot {
      width: 100%;
      padding: 0 8px 8px 8px;
    }
    .section-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      color: rgba(28,25,23,0.45);
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .section-label strong {
      font-weight: 700;
      color: #1C1917;
    }
    .section-star {
      width: 12px;
      height: 12px;
      margin-right: 4px;
      vertical-align: middle;
      display: inline-block;
    }

    .prompt-box {
      background: #FFFFFF;
      border: 1px solid #E8E4DE;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.5;
      color: #1C1917;
      max-height: 120px;
      overflow-y: auto;
      word-break: break-word;
      font-family: inherit;
    }
    .prompt-box .hl-vague {
      color: #EF9F27;
      background: rgba(239,159,39,0.1);
      padding: 1px 2px;
      border-radius: 3px;
    }
    .prompt-box .hl-redundant {
      color: #E24B4A;
      background: rgba(226,75,74,0.08);
      text-decoration: line-through;
      padding: 1px 2px;
      border-radius: 3px;
    }

    .token-line {
      font-size: 11px;
      color: rgba(28,25,23,0.4);
      margin: 6px 8px 12px 8px;
      line-height: 1.4;
    }

    .red-issues-row {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .red-issue-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      line-height: 1.3;
      width: auto;
      align-self: flex-start;
    }
    .red-issue-chip.issue-warning {
      background: #FFF3DC;
      color: #B45309;
      border: 1px solid #F5D78E;
    }
    .red-issue-chip.issue-info {
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
    }
    .issue-dot {
      font-size: 8px;
      line-height: 1;
    }
    .issue-dot.issue-dot-warning {
      color: #EF9F27;
    }
    .issue-dot.issue-dot-info {
      color: #60A5FA;
    }

    #red-premium-controls {
      display: none;
      width: 100%;
      align-items: center;
      gap: 12px;
      padding: 6px 8px;
      border-top: 1px solid #E8E4DE;
      border-bottom: 1px solid #E8E4DE;
      margin: 0 0 8px 0;
    }
    .premium-toggle-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .premium-select-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .premium-label {
      font-size: 10px;
      letter-spacing: 0.1em;
      font-weight: 600;
      color: rgba(28,25,23,0.45);
    }
    .toggle-track {
      width: 32px;
      height: 18px;
      border-radius: 9px;
      background: #E8E4DE;
      cursor: pointer;
      position: relative;
      transition: background 200ms;
      flex-shrink: 0;
    }
    .toggle-track.active {
      background: #534AB7;
    }
    .toggle-knob {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: white;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: left 200ms;
    }
    .toggle-track.active .toggle-knob {
      left: 16px;
    }
    .premium-select-group select {
      font-size: 12px;
      border: 1px solid #E8E4DE;
      border-radius: 6px;
      padding: 3px 8px;
      background: white;
      color: #1C1917;
      cursor: pointer;
      font-family: inherit;
    }
    .btn--refine {
      display: none;
      width: 100%;
      margin-top: 10px;
      margin-bottom: 4px;
      background: ${BRAND.fill};
      border: none;
      border-radius: 6px;
      color: #FFF;

      font-size: 12px;
      font-weight: 500;
      padding: 8px 0;
      cursor: pointer;
      text-align: center;
      transition: opacity 150ms ease-out;
    }
    .btn--refine--visible {
      display: block;
    }
    .btn--refine:hover { opacity: 0.9; }
    .btn--refine:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .refined-section {
      display: none;
    }
    .refined-section--visible { display: block; }

    .refined-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .refined-badge {
      background: #E1F5EE;
      color: #0F6E56;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
      padding: 2px 8px;
      display: none;
    }
    .refined-badge--visible {
      display: inline;
    }

    .refined-box {
      background: #FFFFFF;
      border: 1px solid #E8E4DE;
      border-left: 3px solid #534AB7;
      border-radius: 0 8px 8px 0;
      padding: 12px 14px;
      font-size: 13px;
      color: #1C1917;
      line-height: 1.5;
      word-break: break-word;
      max-height: 200px;
      overflow-y: auto;
    }

    .footer-actions {
      display: none;
      width: 100%;
      gap: 10px;
      padding: 12px 8px;
    }
    .footer-actions--visible { display: flex; }
    .btn--outline {
      flex: 1;
      background: #FFFFFF;
      border: 1px solid #E8E4DE;
      border-radius: 8px;
      color: #1C1917;

      font-size: 13px;
      font-weight: 400;
      padding: 10px 0;
      cursor: pointer;
      text-align: center;
      transition: background 150ms ease-out;
    }
    .btn--outline:hover { background: #F5F2EE; }
    .btn--filled {
      flex: 1;
      background: ${BRAND.fill};
      border: none;
      border-radius: 8px;
      color: #FFF;

      font-size: 13px;
      font-weight: 500;
      padding: 10px 0;
      cursor: pointer;
      text-align: center;
      transition: opacity 150ms ease-out;
    }
    .btn--filled:hover { opacity: 0.9; }
    .btn--filled:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 12px; height: 12px;
      border: 2px solid #D4D0C8;
      border-top-color: #534AB7;
      border-radius: 50%;
      animation: redSpin 0.6s linear infinite;
      margin-right: 4px;
      vertical-align: middle;
    }
    @keyframes redSpin { to { transform: rotate(360deg); } }

    .error-banner {
      display: none;
      font-size: 11px;
      color: #1C1917;
      margin: 0 8px 12px 8px;
      padding: 8px 12px;
      background: rgba(226,75,74,0.08);
      border: 1px solid rgba(226,75,74,0.2);
      border-radius: 6px;

      line-height: 1.4;
    }
    .error-banner--visible { display: block; }
    .error-banner .upgrade-link {
      color: ${BRAND.fill};
      font-weight: 500;
      cursor: pointer;
      text-decoration: underline;
      margin-top: 4px;
      display: inline-block;
    }

    #red-panel::-webkit-scrollbar { width: 4px; }
    #red-panel::-webkit-scrollbar-track { background: transparent; }
    #red-panel::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
    .prompt-box::-webkit-scrollbar { width: 3px; }
    .prompt-box::-webkit-scrollbar-track { background: transparent; }
    .prompt-box::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
    .refined-box::-webkit-scrollbar { width: 3px; }
    .refined-box::-webkit-scrollbar-track { background: transparent; }
    .refined-box::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

    #red-view-history {
      min-height: 60px;
      padding: 0 8px 16px 8px;
    }
    #red-view-history > div[style*="flex-wrap"] {
      gap: 6px !important;
      margin: 0 0 8px 0 !important;
    }
    #red-view-history div[style*="grid-template-columns"] {
      gap: 8px !important;
      margin-bottom: 10px !important;
    }
    #red-view-history div[style*="grid-template-columns"] > div {
      padding: 8px 10px !important;
      border-radius: 6px !important;
    }
    #red-view-history div[style*="text-align"][style*="padding"] {
      padding: 16px 16px !important;
      font-size: 12px !important;
    }
  `;
}

let panelRef = null;

function safeRender(fn, fallbackMsg) {
  try {
    fn();
  } catch (e) {
    console.error('[RED] Render error:', e);
    if (panelRef && panelRef.shadow) {
      var banner = panelRef.shadow.getElementById('error-banner');
      if (banner) {
        banner.classList.add('error-banner--visible');
        banner.style.display = 'block';
        banner.textContent = fallbackMsg || 'Something went wrong. Try refreshing the page.';
      }
    }
  }
}

function showComponentError(containerEl, message) {
  if (!containerEl) return;
  var doc = containerEl.ownerDocument || document;
  var errEl = doc.createElement('div');
  errEl.style.cssText = 'padding:16px;font-size:11px;color:rgba(226,75,74,0.8);text-align:center;line-height:1.4;';
  errEl.textContent = message || 'Failed to load. Please try again.';
  containerEl.appendChild(errEl);
}

function showHistoryLoading(containerEl) {
  if (!containerEl) return;
  var doc = containerEl.ownerDocument || document;
  while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);
  var wrap = doc.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;';
  var spinner = doc.createElement('div');
  spinner.className = 'spinner';
  spinner.style.cssText = 'width:20px;height:20px;border-width:2.5px;';
  wrap.appendChild(spinner);
  var label = doc.createElement('div');
  label.style.cssText = 'font-size:11px;color:rgba(28,25,23,0.35);';
  label.textContent = 'Loading history...';
  wrap.appendChild(label);
  containerEl.appendChild(wrap);
}

function injectPanel() {
  const tokens = borrowPageTokens();
  const host = document.createElement('div');
  host.id = 'red-host';
  const shadow = host.attachShadow({ mode: 'closed' });

  const tablerLink = document.createElement('link');
  tablerLink.rel = 'stylesheet';
  tablerLink.href = chrome.runtime.getURL('lib/vendor/tabler-icons/tabler-icons.css');
  shadow.appendChild(tablerLink);

  const style = document.createElement('style');
  style.textContent = buildStyles(tokens);
  shadow.appendChild(style);

  const indicator = document.createElement('div');
  indicator.id = 'red-indicator';
  var starImg = document.createElement('img');
  starImg.src = chrome.runtime.getURL('assets/toggle_star.svg');
  starImg.alt = '';
  starImg.className = 'indicator-star';
  indicator.appendChild(starImg);
  shadow.appendChild(indicator);

  var starFiles = ['toggle_star.svg', 'teal_star.svg', 'blue_star.svg'];
  var starPositions = ['tl', 'tr', 'br'];

  const panel = document.createElement('div');
  panel.id = 'red-panel';
  panel.innerHTML = `
    <div class="card-inner">
      <div class="card-header">
        <div class="header-left">
          <button id="red-nav-back" style="background:none;border:none;cursor:pointer;padding:5px;display:none;align-items:center;flex-shrink:0;opacity:0.5"><img src="${chrome.runtime.getURL('assets/back.png')}" width="20" height="20" alt="Back"/></button>
        </div>
        <div class="header-logo-wrap">
          <img class="header-star header-star--${starPositions[0]}" src="${chrome.runtime.getURL(starFiles[0])}" alt="">
          <img class="header-star header-star--${starPositions[1]}" src="${chrome.runtime.getURL(starFiles[1])}" alt="">
          <img class="header-logo-img" src="${chrome.runtime.getURL('assets/panel_logo.svg')}" alt="RED">
          <img class="header-star header-star--${starPositions[2]}" src="${chrome.runtime.getURL(starFiles[2])}" alt="">
        </div>
        <div class="header-right">
          <button id="red-nav-history" style="background:none;border:none;cursor:pointer;padding:5px;display:flex;align-items:center"><img src="${chrome.runtime.getURL('assets/history.png')}" width="20" height="20" alt="History"/></button>
          <div id="red-nav-rspacer" style="width:30px;height:30px;flex-shrink:0;visibility:hidden;display:none"></div>
        </div>
      </div>
      <div class="error-banner" id="error-banner"></div>

      <div id="red-view-analysis">
        <div class="score-section-wrap">
          <div class="score-section">
            <div class="score-circle-wrap">
              <div class="score-circle-container">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="39" fill="#FFFFFF" stroke="#E8E4DE" stroke-width="1"/>
                  <circle cx="40" cy="40" r="37.5" class="score-svg-ring-bg"/>
                  <circle id="score-ring" cx="40" cy="40" r="37.5" class="score-svg-ring-fill"/>
                  <text x="40" y="33" text-anchor="middle" fill="#1C1917" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" id="score-value">—</text>
                  <text x="40" y="48" text-anchor="middle" fill="rgba(28,25,23,0.35)" font-size="8" letter-spacing="0.15em">SCORE</text>
                </svg>
              </div>
            </div>
            <div class="score-info">
              <div class="score-grid">
                <div class="metric-row">
                  <span class="metric-label">CLARITY</span>
                  <div class="metric-bar-track"><div class="metric-bar-fill" data-key="clarity"></div></div>
                  <span class="metric-value" data-key="clarity">—</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">CONTEXT</span>
                  <div class="metric-bar-track"><div class="metric-bar-fill" data-key="context"></div></div>
                  <span class="metric-value" data-key="context">—</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">EFFICIENCY</span>
                  <div class="metric-bar-track"><div class="metric-bar-fill" data-key="efficiency"></div></div>
                  <span class="metric-value" data-key="efficiency">—</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">SPECIFICITY</span>
                  <div class="metric-bar-track"><div class="metric-bar-fill" data-key="specificity"></div></div>
                  <span class="metric-value" data-key="specificity">—</span>
                </div>
              </div>
              <div class="tier-summary-wrap">
                <div class="tier-label-row" id="tier-label-row"></div>
                <div class="summary-sentence" id="summary-sentence"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-pad">
          <div class="section-label"><img class="section-star" src="${chrome.runtime.getURL('assets/toggle_star.svg')}" alt=""> PROMPT</div>
          <div class="prompt-box" id="prompt-box">
            <span id="prompt-content"><span style="color:rgba(28,25,23,0.35)">Waiting for input...</span></span>
          </div>
        </div>
        <div class="token-line" id="token-line"></div>
        <div class="section-pad-bot">
          <div class="section-label"><img class="section-star" src="${chrome.runtime.getURL('assets/toggle_star.svg')}" alt=""> ISSUES <span id="issue-count">0</span></div>
          <div class="red-issues-row" id="issues-list"></div>
        </div>
        <div class="premium-controls" id="red-premium-controls" style="display:none;">
          <div class="premium-toggle-group">
            <span class="premium-label">DEEP</span>
            <div class="toggle-track" id="red-deep-toggle">
              <div class="toggle-knob"></div>
            </div>
          </div>
          <div class="premium-select-group">
            <span class="premium-label">STYLE</span>
            <select id="red-style-select">
              <option value="default">Default</option>
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
              <option value="code-focused">Code-focused</option>
            </select>
          </div>
        </div>
        <div class="section-pad">
          <button class="btn--refine" id="refine-btn">Refine</button>
          <p id="red-login-msg" style="font-size:11px;color:rgba(28,25,23,0.45);text-align:center;margin:4px 0 0 0;display:none;">Sign in to refine prompts</p>
          <button id="red-signin-btn" style="display:none;width:100%;margin-top:6px;padding:8px 0;background:#534AB7;border:none;border-radius:6px;color:#FFF;font-size:12px;font-weight:500;cursor:pointer;text-align:center;">Sign In</button>
          <div class="refined-section" id="refined-section">
            <div class="refined-header-row">
              <div class="section-label"><img class="section-star" src="${chrome.runtime.getURL('assets/toggle_star.svg')}" alt=""> REFINED PROMPT</div>
              <span class="refined-badge" id="refine-delta"></span>
            </div>
            <div class="refined-box" id="refined-box"></div>
          </div>
          <div class="footer-actions" id="footer-actions">
            <button class="btn--outline" id="paste-btn">Paste</button>
            <button class="btn--filled" id="rerefine-btn">Re-refine</button>
          </div>
        </div>
      </div>

      <div id="red-view-history" style="display:none"></div>
    </div>
  `;
  shadow.appendChild(panel);

  document.body.appendChild(host);

  shadow.addEventListener('error', function (e) {
    console.error('[RED] Panel error:', e);
    var banner = shadow.getElementById('error-banner');
    if (banner) {
      banner.classList.add('error-banner--visible');
      banner.style.display = 'block';
      banner.textContent = 'An error occurred. Try refreshing the page.';
    }
    e.preventDefault();
  });

  let isOpen = false;

  function openPanel() {
    isOpen = true;
    panel.classList.add('panel--open');
  }
  function closePanel() {
    isOpen = false;
    panel.classList.remove('panel--open');
  }

  indicator.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  function reapplyTokens() {
    style.textContent = buildStyles(borrowPageTokens());
  }

  let themeCheckTimer = null;
  if (document.documentElement) {
    const themeObserver = new MutationObserver(() => {
      clearTimeout(themeCheckTimer);
      themeCheckTimer = setTimeout(reapplyTokens, 200);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  }

  const refineBtn = shadow.getElementById('refine-btn');
  const pasteBtn = shadow.getElementById('paste-btn');
  const rerefineBtn = shadow.getElementById('rerefine-btn');

  refineBtn.addEventListener('click', () => {
    if (refineBtn.disabled) return;
    if (window.__RED.refinePrompt) window.__RED.refinePrompt();
  });
  pasteBtn.addEventListener('click', () => {
    if (window.__RED.pasteToInput) window.__RED.pasteToInput();
  });
  rerefineBtn.addEventListener('click', () => {
    if (window.__RED.refinePrompt) window.__RED.refinePrompt();
  });

  var signinBtn = shadow.getElementById('red-signin-btn');
  if (signinBtn) {
    signinBtn.addEventListener('click', function () {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
  }

  panelRef = {
    shadow, host, indicator, panel, refineBtn,
    close: closePanel,
  };

  return { host, shadow };
}

function renderPromptWithSpans(text, spans) {
  const allSpans = [
    ...(spans.highlight || []).map(s => ({ ...s, type: 'highlight' })),
    ...(spans.redundant || []).map(s => ({ ...s, type: 'redundant' })),
  ].sort((a, b) => a.start - b.start);

  if (allSpans.length === 0) return esc(text);

  let merged = [];
  for (const s of allSpans) {
    if (merged.length > 0 && s.start <= merged[merged.length - 1].end) {
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, s.end);
      if (s.type === 'redundant') last.type = 'redundant';
    } else {
      merged.push({ ...s });
    }
  }

  let result = '';
  let pos = 0;
  for (const s of merged) {
    if (s.start > pos) result += esc(text.slice(pos, s.start));
    if (s.type === 'highlight') {
      result += `<span class="hl-vague">${esc(text.slice(s.start, s.end))}</span>`;
    } else {
      result += `<span class="hl-redundant">${esc(text.slice(s.start, s.end))}</span>`;
    }
    pos = s.end;
  }
  if (pos < text.length) result += esc(text.slice(pos));
  return result;
}

function updateAnalysis(analysis) {
  safeRender(function () {
    if (!panelRef || !panelRef.shadow) return;
    const shadow = panelRef.shadow;

  const indicator = panelRef.indicator;
  const promptBox = shadow.getElementById('prompt-box');
  const promptContent = shadow.getElementById('prompt-content');

  const scoreVal = shadow.getElementById('score-value');
  const scoreRing = shadow.getElementById('score-ring');
  const tokenLine = shadow.getElementById('token-line');
  const issuesList = shadow.getElementById('issues-list');
  const issueCount = shadow.getElementById('issue-count');
  const refineBtn = shadow.getElementById('refine-btn');
  const errorBanner = shadow.getElementById('error-banner');
  const tierLabel = shadow.getElementById('tier-label-row');
  const summarySent = shadow.getElementById('summary-sentence');

  errorBanner.classList.remove('error-banner--visible');
  errorBanner.style.display = 'none';

  const { tokenCount, totalWords, scores, issues, spans } = analysis;
  const hasAnalysis = totalWords > 0;

  if (!hasAnalysis) {
    indicator.classList.remove('has-analysis');
    indicator.style.boxShadow = '0 0 0 2px #FAF9F6, 0 0 0 4px transparent';
    scoreVal.textContent = '—';
    scoreVal.style.color = 'rgba(28,25,23,0.35)';
    if (scoreRing) {
      scoreRing.style.stroke = '#E8E4DE';
      scoreRing.style.strokeDasharray = '0 235.62';
    }
    const fills = shadow.querySelectorAll('.metric-bar-fill');
    fills.forEach(b => { b.style.width = '0%'; b.style.background = TIERS.medium.fill; });
    const vals = shadow.querySelectorAll('.metric-value');
    vals.forEach(v => {
      v.textContent = '';
      v.style.color = 'rgba(28,25,23,0.45)';
    });
    if (tierLabel) tierLabel.innerHTML = '';
    if (summarySent) summarySent.textContent = '';
    if (tokenLine) tokenLine.textContent = '';
    if (issuesList) issuesList.innerHTML = '';
    if (issueCount) issueCount.textContent = '0';
    if (promptContent) promptContent.innerHTML = '<span style="color:rgba(28,25,23,0.35)">Waiting for input...</span>';
    refineBtn.classList.remove('btn--refine--visible');
    refineBtn.style.display = 'none';
    return;
  }

  indicator.classList.add('has-analysis');
  const tier = getTier(scores.overall);
  const tc = TIERS[tier];
  indicator.style.boxShadow = `0 0 0 2px #FAF9F6, 0 0 0 4px ${tc.fill}`;

  if (scoreVal) scoreVal.textContent = scores.overall;
  if (scoreRing && scores.overall > 0) {
    const circumference = 2 * Math.PI * 37.5;
    const dash = circumference * (scores.overall / 100);
    const gap = circumference - dash;
    scoreRing.style.stroke = tc.fill;
    scoreRing.style.strokeDasharray = `${dash} ${gap}`;
  }

  const barMetrics = [
    { key: 'clarity', label: 'Clarity', value: scores.clarity },
    { key: 'context', label: 'Context', value: scores.contextRichness },
    { key: 'efficiency', label: 'Efficiency', value: scores.tokenEfficiency },
    { key: 'specificity', label: 'Specificity', value: scores.specificity },
  ];

  for (const m of barMetrics) {
    const fill = shadow.querySelector(`.metric-bar-fill[data-key="${m.key}"]`);
    const val = shadow.querySelector(`.metric-value[data-key="${m.key}"]`);
    if (fill && val) {
      const mtier = getTierColors(m.value);
      fill.style.width = `${Math.round(m.value)}%`;
      fill.style.background = mtier.fill;
      val.textContent = Math.round(m.value);
      val.style.color = mtier.fill;
    }
  }

  if (tierLabel) {
    const tierText = tier === 'high' ? 'HIGH ≥ 80  ·  GOOD'
      : tier === 'medium' ? 'MED ≥ 50  ·  WARNING'
      : 'LOW  ·  ISSUE';
    tierLabel.innerHTML = `<span style="color:${tc.fill}">${tierText}</span>`;
  }

  if (summarySent) {
    const atTarget = barMetrics.filter(m => m.value >= 80).length;
    if (atTarget === 4) {
      summarySent.textContent = 'All metrics at target. Prompt looks great.';
    } else {
      const lowest = barMetrics.reduce((a, b) => a.value < b.value ? a : b);
      summarySent.textContent = `${atTarget} of 4 metrics at target. ${lowest.label} at ${Math.round(lowest.value)} — needs improvement.`;
    }
  }

  if (tokenLine) {
    var costs = (analysis.costEstimate || []).map(function (c) { return parseFloat(c.inputCost); }).filter(function (n) { return !isNaN(n) && n > 0; });
    var costStr = '';
    if (costs.length > 0) {
      var min = Math.min.apply(null, costs);
      var max = Math.max.apply(null, costs);
      costStr = min === max ? '$' + min.toFixed(6) : '$' + min.toFixed(6) + '–$' + max.toFixed(6);
    }
    var line = tokenCount + ' tokens';
    if (costStr) line += ' · ~' + costStr + '/req';
    tokenLine.textContent = line;
  }

  if (issuesList) {
    issuesList.innerHTML = issues.map(issue => {
      var chipClass = issue.type === 'warning' ? 'issue-warning' : 'issue-info';
      var dotClass = issue.type === 'warning' ? 'issue-dot-warning' : 'issue-dot-info';
      return `<span class="red-issue-chip ${chipClass}"><span class="issue-dot ${dotClass}">●</span> ${esc(issue.label)}</span>`;
    }).join('');
  }
  if (issueCount) issueCount.textContent = issues.length;

  if (promptContent) {
    if (analysis._rawText) {
      promptContent.innerHTML = renderPromptWithSpans(analysis._rawText, spans);
    } else {
      promptContent.innerHTML = '<span style="color:rgba(28,25,23,0.35)">Waiting for input...</span>';
    }
  }

  const refinedSection = shadow.getElementById('refined-section');
  const refinedVisible = refinedSection && refinedSection.classList.contains('refined-section--visible');
  if (hasAnalysis && !refinedVisible) {
    refineBtn.classList.add('btn--refine--visible');
    refineBtn.style.display = 'block';
  } else {
    refineBtn.classList.remove('btn--refine--visible');
    refineBtn.style.display = 'none';
  }
  }, 'Analysis display error. Try refreshing the page.');
}

function setRefineLoading(loading) {
  if (!panelRef || !panelRef.shadow) return;
  const shadow = panelRef.shadow;

  const refineBtn = shadow.getElementById('refine-btn');
  const rerefineBtn = shadow.getElementById('rerefine-btn');

  if (refineBtn) {
    refineBtn.disabled = loading;
    if (loading) {
      refineBtn.innerHTML = '<span class="spinner"></span>Refining...';
    } else {
      refineBtn.innerHTML = 'Refine';
    }
  }

  if (rerefineBtn) {
    rerefineBtn.disabled = loading;
      rerefineBtn.innerHTML = loading
        ? '<span class="spinner"></span>Refining...'
        : 'Re-refine';
  }
}

function showRefineResult(original, refined, streamInProgress) {
  safeRender(function () {
    if (!panelRef || !panelRef.shadow) return;
    const shadow = panelRef.shadow;
  const section = shadow.getElementById('refined-section');
  const box = shadow.getElementById('refined-box');
  const actions = shadow.getElementById('footer-actions');
  const delta = shadow.getElementById('refine-delta');
  const errBanner = shadow.getElementById('error-banner');

  if (!section || !box) return;

  errBanner.classList.remove('error-banner--visible');
  errBanner.style.display = 'none';

  section.classList.add('refined-section--visible');
  section.style.display = 'block';

  const refineBtn = shadow.getElementById('refine-btn');
  if (refineBtn) {
    refineBtn.classList.remove('btn--refine--visible');
    refineBtn.style.display = 'none';
  }

  if (!streamInProgress) {
    actions.classList.add('footer-actions--visible');
    actions.style.display = 'flex';
  }

  box.innerHTML = esc(refined);
  panelRef._lastRefined = refined;

  if (delta) {
    delta.style.display = 'none';
    delta.classList.remove('refined-badge--visible');
    delta.textContent = '';

    const scoreEl = shadow.getElementById('score-value');
    const origScore = scoreEl ? parseInt(scoreEl.textContent, 10) : 0;
    const newScore = Math.min(origScore + 15, 100);
    const ptDelta = newScore - origScore;
    if (!streamInProgress && refined && isFinite(ptDelta) && ptDelta > 0) {
      delta.textContent = `+${ptDelta} pts`;
      delta.style.display = 'inline';
      delta.classList.add('refined-badge--visible');
    }
  }
  }, 'Failed to display refined prompt.');
}

function appendRefineChunk(chunk) {
  if (!panelRef || !panelRef.shadow) return;
  panelRef._lastRefined = (panelRef._lastRefined || '') + chunk;
  const box = panelRef.shadow.getElementById('refined-box');
  if (box) {
    box.innerHTML = esc(panelRef._lastRefined);
  }
}

function showRefineError(message, isQuota) {
  safeRender(function () {
    if (!panelRef || !panelRef.shadow) return;
    const shadow = panelRef.shadow;
  const errBanner = shadow.getElementById('error-banner');
  const section = shadow.getElementById('refined-section');
  const actions = shadow.getElementById('footer-actions');

  if (!errBanner) return;

  errBanner.classList.add('error-banner--visible');
  errBanner.style.display = 'block';

  if (isQuota) {
    errBanner.innerHTML = `${esc(message)} <span class="upgrade-link">Upgrade</span>`;
    var upgradeLink = errBanner.querySelector('.upgrade-link');
    if (upgradeLink) {
      upgradeLink.addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.__RED.startUpgrade) window.__RED.startUpgrade();
      });
    }
  } else {
    errBanner.textContent = message;
  }

  if (section) { section.classList.remove('refined-section--visible'); section.style.display = 'none'; }
  if (actions) { actions.classList.remove('footer-actions--visible'); actions.style.display = 'none'; }
  }, 'Failed to display error message.');
}

function pasteToInput() {
  var refined = panelRef?._lastRefined;
  if (!refined) return;
  var input = document.querySelector('[contenteditable="true"], textarea');
  if (!input) return;
  if (input.tagName === 'TEXTAREA') {
    input.value = refined;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    input.textContent = refined;
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: refined,
    }));
  }
  if (panelRef && panelRef.shadow) {
    const pasteBtn = panelRef.shadow.getElementById('paste-btn');
    if (pasteBtn) {
      var orig = pasteBtn.textContent;
      pasteBtn.textContent = 'Pasted!';
      pasteBtn.disabled = true;
      setTimeout(function () {
        pasteBtn.textContent = orig;
        pasteBtn.disabled = false;
      }, 1200);
    }
  }
}

async function startUpgrade() {
  try {
    const token = await window.__RED.getValidToken();
    if (!token) {
      showToast('Please sign in first to upgrade.');
      return;
    }
    const result = await chrome.storage.local.get('supabase_user');
    const supabaseUser = result.supabase_user;
    if (!supabaseUser) {
      showToast('Please sign in first to upgrade.');
      return;
    }

    const res = await fetch(window.__RED_CONFIG.SUPABASE_URL + '/functions/v1/create-payment-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ user_id: supabaseUser.id, email: supabaseUser.email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create payment link');

    window.open(data.url, '_blank');
    showToast('Payment link opened. Complete payment, then check the RED popup.');
  } catch (e) {
    console.error('[RED] Upgrade error:', e);
    showToast('Could not create payment link. Please try again.');
  }
}

function showToast(msg) {
  if (!panelRef || !panelRef.shadow) return;
  var toast = panelRef.shadow.getElementById('red-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'red-toast';
    toast.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1C1917;color:#FFF;padding:10px 18px;border-radius:8px;font-size:12px;z-index:999999;max-width:320px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.2);opacity:0;transition:opacity 250ms ease;';
    panelRef.shadow.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(function () { toast.style.opacity = '0'; }, 4000);
}

function setAuthState(isLoggedIn) {
  if (!panelRef || !panelRef.shadow) return;
  var shadow = panelRef.shadow;
  var refineBtn = shadow.getElementById('refine-btn');
  var loginMsg = shadow.getElementById('red-login-msg');
  var signinBtn = shadow.getElementById('red-signin-btn');
  var refineSection = shadow.getElementById('refined-section');
  var pasteBtn = shadow.getElementById('paste-btn');
  var rerefineBtn = shadow.getElementById('rerefine-btn');

  if (isLoggedIn) {
    refineBtn.disabled = false;
    refineBtn.style.opacity = '1';
    refineBtn.style.cursor = 'pointer';
    if (loginMsg) loginMsg.style.display = 'none';
    if (signinBtn) signinBtn.style.display = 'none';
    if (pasteBtn) pasteBtn.style.display = '';
    if (rerefineBtn) rerefineBtn.style.display = '';
  } else {
    refineBtn.disabled = true;
    refineBtn.style.opacity = '0.5';
    refineBtn.style.cursor = 'not-allowed';
    if (loginMsg) loginMsg.style.display = 'block';
    if (signinBtn) signinBtn.style.display = 'block';
    if (refineSection) { refineSection.style.display = 'none'; refineSection.classList.remove('refined-section--visible'); }
    if (pasteBtn) pasteBtn.style.display = 'none';
    if (rerefineBtn) rerefineBtn.style.display = 'none';
  }
}

window.__RED = window.__RED || {};
window.__RED.injectPanel = injectPanel;
window.__RED.setAuthState = setAuthState;
window.__RED.updateAnalysis = updateAnalysis;
window.__RED.setRefineLoading = setRefineLoading;
window.__RED.showRefineResult = showRefineResult;
window.__RED.startUpgrade = startUpgrade;
window.__RED.showRefineError = showRefineError;
window.__RED.appendRefineChunk = appendRefineChunk;
window.__RED.pasteToInput = pasteToInput;
window.__RED.updatePromptPreview = function (text) {
  if (!panelRef || !panelRef.shadow) return;
  var shadow = panelRef.shadow;
  var promptContent = shadow.getElementById('prompt-content');
  if (!promptContent) return;
  if (text && text.trim()) {
    promptContent.innerHTML = esc(text);
  } else {
    promptContent.innerHTML = '<span style="color:rgba(28,25,23,0.35)">Waiting for input...</span>';
  }
};

var _viewNavInitialized = false;

function initViewNav() {
  if (!panelRef || !panelRef.shadow || _viewNavInitialized) return;
  _viewNavInitialized = true;

  var shadow = panelRef.shadow;
  var analysisView = shadow.getElementById('red-view-analysis');
  var historyView = shadow.getElementById('red-view-history');
  var navHistory = shadow.getElementById('red-nav-history');
  var navBack = shadow.getElementById('red-nav-back');

  if (!analysisView || !historyView || !navHistory) return;

  navHistory.addEventListener('click', function () {
    switchView('history');
  });

  if (navBack) {
    navBack.addEventListener('click', function () {
      switchView('analysis');
    });
  }

  var deepToggleEl = shadow.querySelector('#red-deep-toggle');
  if (deepToggleEl) {
    deepToggleEl.addEventListener('click', function () {
      this.classList.toggle('active');
    });
  }

  chrome.storage.local.get(['user_type'], function (result) {
    var premiumControls = shadow.querySelector('#red-premium-controls');
    if (premiumControls) {
      premiumControls.style.display = result.user_type === 'premium' ? 'flex' : 'none';
    }
  });

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.user_type) {
      var pc = shadow.querySelector('#red-premium-controls');
      if (pc) {
        pc.style.display = changes.user_type.newValue === 'premium' ? 'flex' : 'none';
      }
    }
  });
}

function switchView(viewName) {
  if (!panelRef || !panelRef.shadow) return;
  var shadow = panelRef.shadow;
  var analysisView = shadow.getElementById('red-view-analysis');
  var historyView = shadow.getElementById('red-view-history');
  var navHistoryBtn = shadow.getElementById('red-nav-history');
  var navBackBtn = shadow.getElementById('red-nav-back');
  var navRspacer = shadow.getElementById('red-nav-rspacer');
  var navHistoryImg = navHistoryBtn ? navHistoryBtn.querySelector('img') : null;

  if (!analysisView || !historyView) return;

  if (viewName === 'analysis') {
    analysisView.style.display = 'block';
    historyView.style.display = 'none';
    if (navBackBtn) navBackBtn.style.display = 'none';
    if (navHistoryBtn) { navHistoryBtn.style.display = 'flex'; navHistoryBtn.style.opacity = '0.5'; }
    if (navHistoryImg) navHistoryImg.style.filter = 'none';
    if (navRspacer) navRspacer.style.display = 'none';
  } else {
    analysisView.style.display = 'none';
    historyView.style.display = 'block';
    if (navBackBtn) navBackBtn.style.display = 'flex';
    if (navHistoryBtn) navHistoryBtn.style.display = 'none';
    if (navRspacer) navRspacer.style.display = 'block';
    renderHistoryView(historyView);
  }
}

async function renderHistoryView(containerEl) {
  if (!containerEl) return;

  showHistoryLoading(containerEl);

  var result = await chrome.storage.local.get(['supabase_user']);
  var user = result.supabase_user;
  var token = await window.__RED.getValidToken();

  var isPremium = false;
  if (user && token) {
    try {
      var res = await fetch(window.__RED_CONFIG.SUPABASE_URL + '/rest/v1/users?id=eq.' + user.id + '&select=user_type', {
        headers: {
          apikey: window.__RED_CONFIG.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + token,
        },
      });

      if (res.status === 401) {
        var newToken = await window.__RED.refreshAccessToken();
        if (newToken) {
          res = await fetch(window.__RED_CONFIG.SUPABASE_URL + '/rest/v1/users?id=eq.' + user.id + '&select=user_type', {
            headers: {
              apikey: window.__RED_CONFIG.SUPABASE_ANON_KEY,
              Authorization: 'Bearer ' + newToken,
            },
          });
        }
      }

      if (res.ok) {
        var rows = await res.json();
        isPremium = rows && rows[0] && rows[0].user_type === 'premium';
      }
    } catch (e) {
      console.warn('[RED] renderHistoryView fetch error:', e);
    }
  }

  while (containerEl.firstChild) {
    containerEl.removeChild(containerEl.firstChild);
  }

  safeRender(function () {
    if (isPremium) {
      if (window.__RED.renderPremiumHistory) {
        window.__RED.renderPremiumHistory(containerEl);
      } else {
        showComponentError(containerEl, 'Premium analytics unavailable.');
      }
    } else {
      if (window.__RED.renderFreeHistory) {
        window.__RED.renderFreeHistory(containerEl);
      } else {
        showComponentError(containerEl, 'History unavailable.');
      }
    }
  }, 'Failed to load history.');
}

function insertPromptText(text) {
  var input = document.querySelector('[contenteditable="true"], textarea');
  if (!input) return;
  if (input.tagName === 'TEXTAREA') {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }));
  }
}

window.__RED.getRefineOptions = function () {
  if (!panelRef || !panelRef.shadow) return { mode: 'normal', style: 'default' };
  var shadow = panelRef.shadow;
  var deepToggle = shadow.querySelector('#red-deep-toggle');
  var styleSelect = shadow.querySelector('#red-style-select');
  return {
    mode: deepToggle && deepToggle.classList.contains('active') ? 'deep' : 'normal',
    style: styleSelect ? styleSelect.value : 'default',
  };
};

window.__RED.initViewNav = initViewNav;
window.__RED.renderHistory = function () {
  if (!panelRef || !panelRef.shadow) return;
  var hv = panelRef.shadow.getElementById('red-view-history');
  if (hv) renderHistoryView(hv);
};
window.__RED.insertPromptText = insertPromptText;
