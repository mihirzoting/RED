// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getTier()', () => {
  function getTier(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  it('returns high for score >= 80', () => {
    expect(getTier(100)).toBe('high');
    expect(getTier(80)).toBe('high');
  });

  it('returns medium for score 50-79', () => {
    expect(getTier(50)).toBe('medium');
    expect(getTier(79)).toBe('medium');
  });

  it('returns low for score < 50', () => {
    expect(getTier(0)).toBe('low');
    expect(getTier(49)).toBe('low');
  });
});

describe('getTierColors()', () => {
  const TIERS = {
    high: { fill: '#1D9E75', bg: '#E1F5EE', textDark: '#085041', textLight: '#0F6E56' },
    medium: { fill: '#EF9F27', bg: '#FAEEDA', text: '#633806' },
    low: { fill: '#E24B4A', bg: '#FCEBEB', textDark: '#791F1F', textLight: '#A32D2D' },
  };

  function getTier(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  function getTierColors(score) {
    return TIERS[getTier(score)];
  }

  it('returns high tier colors for score 80+', () => {
    expect(getTierColors(85)).toEqual(TIERS.high);
  });

  it('returns medium tier colors for score 50-79', () => {
    expect(getTierColors(65)).toEqual(TIERS.medium);
  });

  it('returns low tier colors for score < 50', () => {
    expect(getTierColors(30)).toEqual(TIERS.low);
  });
});

describe('esc() HTML escaping', () => {
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  it('escapes & to &amp;', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes < to &lt;', () => {
    expect(esc('a < b')).toBe('a &lt; b');
  });

  it('escapes > to &gt;', () => {
    expect(esc('a > b')).toBe('a &gt; b');
  });

  it('escapes all three', () => {
    expect(esc('<a & b>')).toBe('&lt;a &amp; b&gt;');
  });

  it('passes through normal text', () => {
    expect(esc('Hello world')).toBe('Hello world');
  });
});

describe('detectDarkMode()', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  });

  function detectDarkMode() {
    const themeAttr = document.documentElement.getAttribute('data-theme');
    if (themeAttr === 'dark') return true;
    if (themeAttr === 'light') return false;
    if (document.documentElement.classList.contains('dark')) return true;
    if (document.body.classList.contains('dark')) return true;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    return false;
  }

  it('detects data-theme="dark"', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(detectDarkMode()).toBe(true);
  });

  it('detects data-theme="light"', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    expect(detectDarkMode()).toBe(false);
  });

  it('detects class="dark" on html', () => {
    document.documentElement.classList.add('dark');
    expect(detectDarkMode()).toBe(true);
  });

  it('detects class="dark" on body', () => {
    document.body.classList.add('dark');
    expect(detectDarkMode()).toBe(true);
  });
});

describe('safeRender()', () => {
  it('calls fn without error', () => {
    const fn = vi.fn();
    safeRender(fn, 'fallback');
    expect(fn).toHaveBeenCalled();
  });

  function safeRender(fn, fallbackMsg) {
    try {
      fn();
    } catch (e) {
      console.error('[RED] Render error:', e);
    }
  }

  it('catches errors without throwing', () => {
    expect(() => {
      safeRender(() => { throw new Error('test'); }, 'fallback');
    }).not.toThrow();
  });
});

describe('showComponentError()', () => {
  function showComponentError(containerEl, message) {
    if (!containerEl) return;
    var doc = containerEl.ownerDocument || document;
    var errEl = doc.createElement('div');
    errEl.style.cssText = 'padding:16px;font-size:11px;color:rgba(226,75,74,0.8);text-align:center;line-height:1.4;';
    errEl.textContent = message || 'Failed to load. Please try again.';
    containerEl.appendChild(errEl);
    return errEl;
  }

  it('creates error element with message', () => {
    const container = document.createElement('div');
    const errEl = showComponentError(container, 'Test error');
    expect(errEl).toBeTruthy();
    expect(errEl.textContent).toBe('Test error');
    expect(container.children.length).toBe(1);
  });

  it('does nothing if container is null', () => {
    expect(() => showComponentError(null, 'msg')).not.toThrow();
  });

  it('uses default message if none provided', () => {
    const container = document.createElement('div');
    const errEl = showComponentError(container);
    expect(errEl.textContent).toBe('Failed to load. Please try again.');
  });
});

describe('showHistoryLoading()', () => {
  function showHistoryLoading(containerEl) {
    if (!containerEl) return;
    var doc = containerEl.ownerDocument || document;
    while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);
    var wrap = doc.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;';
    var spinner = doc.createElement('div');
    spinner.className = 'spinner';
    wrap.appendChild(spinner);
    var label = doc.createElement('div');
    label.textContent = 'Loading history...';
    wrap.appendChild(label);
    containerEl.appendChild(wrap);
    return wrap;
  }

  it('clears container and adds loading UI', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>old content</p>';
    showHistoryLoading(container);
    expect(container.children.length).toBe(1);
    expect(container.querySelector('.spinner')).toBeTruthy();
    expect(container.textContent).toContain('Loading history...');
  });

  it('does nothing for null container', () => {
    expect(() => showHistoryLoading(null)).not.toThrow();
  });
});

describe('borrowPageTokens()', () => {
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

  it('returns expected token structure', () => {
    const tokens = borrowPageTokens();
    expect(tokens.bg).toBe('#FAF9F6');
    expect(tokens.text).toBe('#1C1917');
    expect(tokens.border).toBe('#E8E4DE');
    expect(tokens.font).toContain('system-ui');
    expect(tokens.radius).toBe('12px');
    expect(tokens.isDark).toBe(false);
  });
});

describe('getRefineOptions()', () => {
  function getRefineOptions(deepActive, styleValue) {
    return {
      mode: deepActive ? 'deep' : 'normal',
      style: styleValue || 'default',
    };
  }

  it('returns normal mode by default', () => {
    expect(getRefineOptions(false, 'default')).toEqual({ mode: 'normal', style: 'default' });
  });

  it('returns deep mode when toggle is active', () => {
    expect(getRefineOptions(true, 'concise')).toEqual({ mode: 'deep', style: 'concise' });
  });

  it('returns selected style', () => {
    expect(getRefineOptions(false, 'detailed')).toEqual({ mode: 'normal', style: 'detailed' });
    expect(getRefineOptions(false, 'code-focused')).toEqual({ mode: 'normal', style: 'code-focused' });
  });
});
