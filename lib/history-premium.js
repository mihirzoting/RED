console.log('[RED] history-premium.js loaded, constants:', {
  url: window.__RED_CONFIG.SUPABASE_URL ? 'set' : 'MISSING',
  anonKey: window.__RED_CONFIG.SUPABASE_ANON_KEY ? 'set' : 'MISSING',
});

var _premiumContainer = null;
var _premiumFilter = '30d';
var _premiumData = [];
var _chartInstance = null;

function getScoreTierP(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function tierColorsP(tier) {
  if (tier === 'high') return { bg: '#E1F5EE', text: '#085041' };
  if (tier === 'medium') return { bg: '#FAEEDA', text: '#633806' };
  return { bg: '#FCEBEB', text: '#791F1F' };
}

function formatRelTimeP(isoStr) {
  var d = new Date(isoStr);
  var now = new Date();
  var diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function filterDateRange(filter) {
  var now = new Date();
  switch (filter) {
    case '1d':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

async function fetchPremiumData(filter) {
  var result = await chrome.storage.local.get(['supabase_user']);
  var user = result.supabase_user;
  var token = await window.__RED.getValidToken();

  console.log('[RED Premium] fetchPremiumData called', {
    user: user ? user.id : null,
    token: token ? 'set (' + token.slice(0, 10) + '...)' : 'MISSING',
    url: window.__RED_CONFIG.SUPABASE_URL ? 'set' : 'MISSING',
    anonKey: window.__RED_CONFIG.SUPABASE_ANON_KEY ? 'set' : 'MISSING',
    filter: filter,
  });

  if (!user || !token) {
    console.warn('[RED] Premium history: no auth');
    return [];
  }

  var startDate = filterDateRange(filter);
  var url = window.__RED_CONFIG.SUPABASE_URL + '/rest/v1/refine_history?user_id=eq.' + user.id + '&order=created_at.desc&limit=200';
  if (startDate) {
    url += '&created_at=gte.' + startDate.toISOString();
  }

  console.log('[RED Premium] Fetching URL:', url);

  try {
    var res = await fetch(url, {
      headers: {
        apikey: window.__RED_CONFIG.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
      },
    });

    console.log('[RED Premium] Response status:', res.status);

    if (res.status === 401) {
      console.warn('[RED Premium] 401 — attempting token refresh and retry');
      var newToken = await window.__RED.refreshAccessToken();
      if (newToken) {
        res = await fetch(url, {
          headers: {
            apikey: window.__RED_CONFIG.SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + newToken,
          },
        });
      } else {
        showPremiumError('Session expired. Please log in again via the extension icon.');
        return [];
      }
    }

    if (res.status === 401) {
      console.warn('[RED Premium] 401 after retry — token expired');
      showPremiumError('Session expired. Please log in again via the extension icon.');
      return [];
    }

    if (!res.ok) {
      var errBody = await res.text().catch(function () { return 'unreadable'; });
      console.warn('[RED Premium] Fetch failed:', res.status, errBody);
      return [];
    }

    var rows = await res.json();
    return rows.map(function (r) {
      var prompt = r.original_prompt || '';
      var score = r.score || 0;
      if (!score && prompt && prompt.trim().length > 0 && window.__RED && window.__RED.countTokens) {
        try {
          var tokens = window.__RED.countTokens(prompt);
          if (window.__RED.analyzePrompt) {
            var result = window.__RED.analyzePrompt(prompt, tokens);
            if (result && result.scores) score = result.scores.overall || 0;
          }
        } catch (e) { score = 0; }
      }
      return {
        id: r.id,
        prompt: prompt,
        score: score,
        tokens: r.token_count_before || 0,
        refined: !!(r.refined_prompt && r.refined_prompt.trim()),
        refinedScore: !!(r.refined_prompt && r.refined_prompt.trim()) ? Math.min(15, 100 - score) : null,
        createdAt: r.created_at,
      };
    }).filter(function (r) { return r.prompt && r.prompt !== '(empty)' && r.prompt.trim(); });
  } catch (e) {
    console.warn('[RED] Premium history fetch error:', e);
    return [];
  }
}

function showPremiumError(msg) {
  if (!_premiumContainer) return;
  while (_premiumContainer.firstChild) {
    _premiumContainer.removeChild(_premiumContainer.firstChild);
  }
  var doc = _premiumContainer.ownerDocument;
  var errWrap = doc.createElement('div');
  errWrap.style.cssText = 'padding:16px;text-align:center;';
  var errEl = doc.createElement('div');
  errEl.style.cssText = 'font-size:11px;color:rgba(226,75,74,0.8);margin-bottom:8px;line-height:1.4;';
  errEl.textContent = msg;
  errWrap.appendChild(errEl);
  var retryBtn = doc.createElement('button');
  retryBtn.style.cssText = 'font-size:11px;background:none;border:1px solid rgba(28,25,23,0.15);border-radius:6px;padding:4px 12px;cursor:pointer;color:rgba(28,25,23,0.6);';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', async function () {
    if (_premiumContainer) {
      while (_premiumContainer.firstChild) _premiumContainer.removeChild(_premiumContainer.firstChild);
      var loadWrap = doc.createElement('div');
      loadWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;';
      var spin = doc.createElement('div');
      spin.className = 'spinner';
      spin.style.cssText = 'width:20px;height:20px;border-width:2.5px;';
      loadWrap.appendChild(spin);
      _premiumContainer.appendChild(loadWrap);
      _premiumData = await fetchPremiumData(_premiumFilter);
      if (_premiumData && _premiumData.length > 0) {
        while (_premiumContainer.firstChild) _premiumContainer.removeChild(_premiumContainer.firstChild);
        buildPremiumDashboard(_premiumContainer, doc, _premiumData, _premiumFilter);
      } else {
        showPremiumError('Still unable to load. Please check your connection and login status.');
      }
    }
  });
  errWrap.appendChild(retryBtn);
  _premiumContainer.appendChild(errWrap);
}

async function renderPremiumHistory(containerEl) {
  _premiumContainer = containerEl;

  while (containerEl.firstChild) {
    containerEl.removeChild(containerEl.firstChild);
  }

  var doc = containerEl.ownerDocument;

  var loadingEl = doc.createElement('div');
  loadingEl.style.cssText = 'padding:16px;font-size:11px;color:rgba(28,25,23,0.3);text-align:center;';
  loadingEl.textContent = 'Loading premium analytics...';
  containerEl.appendChild(loadingEl);

  _premiumData = await fetchPremiumData(_premiumFilter);

  while (containerEl.firstChild) {
    containerEl.removeChild(containerEl.firstChild);
  }

  buildPremiumDashboard(containerEl, doc, _premiumData, _premiumFilter);
}

function buildPremiumDashboard(container, doc, data, filter) {
  var metrics = computeMetrics(data);

  var filterRow = doc.createElement('div');
  filterRow.style.cssText = 'display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;';
  var filters = ['1d', '7d', '30d', 'All'];
  for (var fi = 0; fi < filters.length; fi++) {
    (function (f) {
      var pill = doc.createElement('span');
      var isActive = f === filter || (f === 'All' && filter === 'all') || (f.toLowerCase() === filter);
      pill.style.cssText =
        'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;padding:4px 12px;border-radius:6px;transition:all 150ms ease-out;' +
        (isActive
          ? 'background:#534AB7;color:#FFF;'
          : 'border:1px solid rgba(28,25,23,0.15);color:rgba(28,25,23,0.45);');
      pill.textContent = f;
      pill.addEventListener('click', async function () {
        _premiumFilter = f === 'All' ? 'all' : f.toLowerCase();
        while (container.firstChild) container.removeChild(container.firstChild);
        var loadingWrap = doc.createElement('div');
        loadingWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;';
        var spinEl = doc.createElement('div');
        spinEl.className = 'spinner';
        spinEl.style.cssText = 'width:20px;height:20px;border-width:2.5px;';
        loadingWrap.appendChild(spinEl);
        var loadLabel = doc.createElement('div');
        loadLabel.style.cssText = 'font-size:11px;color:rgba(28,25,23,0.35);';
        loadLabel.textContent = 'Loading...';
        loadingWrap.appendChild(loadLabel);
        container.appendChild(loadingWrap);
        _premiumData = await fetchPremiumData(_premiumFilter);
        while (container.firstChild) container.removeChild(container.firstChild);
        buildPremiumDashboard(container, doc, _premiumData, _premiumFilter);
      });
      filterRow.appendChild(pill);
    })(filters[fi]);
  }
  container.appendChild(filterRow);

  var metricsGrid = doc.createElement('div');
  metricsGrid.style.cssText =
    'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;';

  var metricDefs = [
    { label: 'Avg Score', value: metrics.avgScore, delta: metrics.avgScoreDelta },
    { label: 'Prompts', value: String(metrics.totalPrompts), delta: '' },
    { label: 'Tokens Saved', value: String(metrics.tokensSaved), delta: '' },
    { label: 'Refinements', value: String(metrics.refinements), delta: '' },
  ];

  for (var mi = 0; mi < metricDefs.length; mi++) {
    var m = metricDefs[mi];
    var cell = doc.createElement('div');
    cell.style.cssText =
      'padding:10px;background:rgba(28,25,23,0.03);border:1px solid rgba(28,25,23,0.06);border-radius:8px;';

    var mlabel = doc.createElement('div');
    mlabel.style.cssText = 'font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:rgba(28,25,23,0.35);margin-bottom:4px;';
    mlabel.textContent = m.label;
    cell.appendChild(mlabel);

    var mval = doc.createElement('div');
    mval.style.cssText = 'font-size:18px;font-weight:700;color:#1C1917;';
    mval.textContent = m.value;
    cell.appendChild(mval);

    if (m.delta) {
      var mdelta = doc.createElement('div');
      mdelta.style.cssText = 'font-size:9px;color:#1D9E75;margin-top:2px;';
      mdelta.textContent = m.delta;
      cell.appendChild(mdelta);
    }

    metricsGrid.appendChild(cell);
  }
  container.appendChild(metricsGrid);

  var chartSection = doc.createElement('div');
  chartSection.style.cssText = 'margin-bottom:14px;';

  var chartLabel = doc.createElement('div');
  chartLabel.style.cssText =
    'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(28,25,23,0.4);margin-bottom:6px;';
  chartLabel.innerHTML = '<img src="' + chrome.runtime.getURL('assets/toggle_star.svg') + '" style="width:12px;height:12px;margin-right:4px;vertical-align:middle;display:inline-block" alt=""> SCORE TREND';
  chartSection.appendChild(chartLabel);

  var canvasWrap = doc.createElement('div');
  canvasWrap.style.cssText = 'position:relative;width:100%;height:140px;';
  var canvas = doc.createElement('canvas');
  canvas.id = 'red-score-chart';
  canvas.style.cssText = 'width:100%;height:100%;';
  canvasWrap.appendChild(canvas);
  chartSection.appendChild(canvasWrap);

  container.appendChild(chartSection);

  renderChart(canvas, data);

  var listSection = doc.createElement('div');

  var listLabel = doc.createElement('div');
  listLabel.style.cssText =
    'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(28,25,23,0.4);margin-bottom:6px;';
  listLabel.innerHTML = '<img src="' + chrome.runtime.getURL('assets/toggle_star.svg') + '" style="width:12px;height:12px;margin-right:4px;vertical-align:middle;display:inline-block" alt=""> RECENT PROMPTS';
  listSection.appendChild(listLabel);

  var listWrap = doc.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  listSection.appendChild(listWrap);

  if (!data || data.length === 0) {
    var emptyEl = doc.createElement('div');
    emptyEl.style.cssText = 'text-align:center;padding:16px;font-size:11px;color:rgba(28,25,23,0.3);';
    emptyEl.textContent = 'No data in this period.';
    listWrap.appendChild(emptyEl);
  } else {
    for (var ri = 0; ri < data.length; ri++) {
      var r = data[ri];
      var row = buildPremiumRow(doc, r);
      listWrap.appendChild(row);
    }
  }
  container.appendChild(listSection);

  var footerRow = doc.createElement('div');
  footerRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;';
  container.appendChild(footerRow);

  var footers = [
    { label: 'Insights \u2197', cls: 'btn--outline', action: insightsAction },
    { label: 'Export CSV', cls: 'btn--outline', action: exportCsvAction },
    { label: 'Clear history', cls: 'btn--filled-danger', action: clearHistoryAction },
  ];

  for (var bi = 0; bi < footers.length; bi++) {
    (function (fb) {
      var btn = doc.createElement('button');
      var baseStyle =
        'font-size:12px;padding:8px 0;cursor:pointer;text-align:center;border-radius:6px;transition:opacity 150ms ease-out;flex:1;';
      if (fb.cls === 'btn--filled-danger') {
        btn.style.cssText =
          baseStyle +
          'background:#E24B4A;border:none;color:#FFF;font-weight:500;';
      } else {
        btn.style.cssText =
          baseStyle +
          'background:transparent;border:1px solid rgba(28,25,23,0.2);color:rgba(28,25,23,0.8);';
      }
      btn.textContent = fb.label;
      btn.addEventListener('click', fb.action);
      footerRow.appendChild(btn);
    })(footers[bi]);
  }
}

function computeMetrics(data) {
  var totalPrompts = data.length;
  var refinements = 0;
  var totalTokens = 0;
  var totalScore = 0;

  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    if (d.refined) refinements++;
    if (d.tokens > 0) totalTokens += d.tokens;
    totalScore += d.score || 0;
  }

  return {
    avgScore: totalPrompts > 0 ? Math.round(totalScore / totalPrompts) : '—',
    avgScoreDelta: '',
    totalPrompts: totalPrompts,
    tokensSaved: totalTokens,
    refinements: refinements,
  };
}

function buildPremiumRow(doc, entry) {
  var row = doc.createElement('div');
  row.style.cssText =
    'display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(28,25,23,0.03);border:1px solid rgba(28,25,23,0.06);border-radius:6px;';

  var score = entry.score || 0;
  var tier = getScoreTierP(score);
  var tc = tierColorsP(tier);

  var badge = doc.createElement('div');
  badge.style.cssText =
    'width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:' +
    tc.bg +
    ';color:' +
    tc.text +
    ';';
  badge.textContent = String(score || '—');
  row.appendChild(badge);

  var info = doc.createElement('div');
  info.style.cssText = 'flex:1;min-width:0;';

  var promptText = doc.createElement('div');
  promptText.style.cssText =
    'font-size:12px;color:rgba(28,25,23,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;';
  promptText.textContent = entry.prompt ? (entry.prompt.length > 50 ? entry.prompt.slice(0, 50) + '\u2026' : entry.prompt) : '(empty)';
  info.appendChild(promptText);

  var meta = doc.createElement('div');
  meta.style.cssText = 'font-size:10px;color:rgba(28,25,23,0.3);margin-top:1px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
  meta.textContent = formatRelTimeP(entry.createdAt) + ' \u00B7 ' + (entry.tokens || 0) + ' tok';

  if (entry.refined) {
    var refBadge = doc.createElement('span');
    refBadge.style.cssText =
      'font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(29,158,117,0.15);color:#1D9E75;';
    refBadge.textContent = 'Refined';
    meta.appendChild(refBadge);
  }

  if (entry.refinedScore) {
    var ptsBadge = doc.createElement('span');
    ptsBadge.style.cssText =
      'font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(83,74,183,0.2);color:#534AB7;';
    ptsBadge.textContent = '+' + entry.refinedScore + ' pts';
    meta.appendChild(ptsBadge);
  }

  info.appendChild(meta);
  row.appendChild(info);

  var chevron = doc.createElement('i');
  chevron.className = 'ti ti-chevron-right';
  chevron.style.cssText = 'font-size:14px;color:rgba(28,25,23,0.2);flex-shrink:0;';
  row.appendChild(chevron);

  return row;
}

function showChartFallback(canvas, msg) {
  var parent = canvas.parentNode;
  if (!parent) return;
  canvas.style.display = 'none';
  var existing = parent.querySelector('.chart-fallback');
  if (existing) return;
  var fb = canvas.ownerDocument.createElement('div');
  fb.className = 'chart-fallback';
  fb.style.cssText = 'display:flex;align-items:center;justify-content:center;height:140px;font-size:11px;color:rgba(28,25,23,0.3);text-align:center;';
  fb.textContent = msg || 'Score trend unavailable.';
  parent.appendChild(fb);
}

async function renderChart(canvas, data) {
  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  if (!data || data.length === 0) {
    showChartFallback(canvas, 'No data yet for this period.');
    return;
  }

  if (!window.Chart) {
    try {
      var code = await fetch(chrome.runtime.getURL('lib/vendor/chart.min.js')).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
      if (!code || code.length < 100) throw new Error('Empty or truncated chart.js');
      var fn = new Function(code);
      fn();
      window.Chart = globalThis.Chart || window.Chart;
      if (!window.Chart) throw new Error('Chart did not initialize');
    } catch (e) {
      console.warn('[RED] Failed to load Chart.js:', e.message);
      showChartFallback(canvas, 'Chart library failed to load.');
      return;
    }
  }

  if (typeof window.Chart !== 'function' && typeof window.Chart !== 'object') {
    showChartFallback(canvas, 'Chart library failed to initialize.');
    return;
  }

  var dayMap = {};
  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    var day = d.createdAt ? d.createdAt.slice(0, 10) : '';
    if (!day) continue;
    if (!dayMap[day]) dayMap[day] = { scores: [], total: 0 };
    if (d.score > 0) dayMap[day].scores.push(d.score);
    dayMap[day].total++;
  }

  var labels = Object.keys(dayMap).sort();
  var avgScores = [];
  for (var li = 0; li < labels.length; li++) {
    var dayData = dayMap[labels[li]];
    if (dayData.scores.length > 0) {
      var sum = 0;
      for (var si = 0; si < dayData.scores.length; si++) sum += dayData.scores[si];
      avgScores.push(Math.round(sum / dayData.scores.length));
    } else {
      avgScores.push(null);
    }
  }

  if (labels.length === 0 || avgScores.every(function (s) { return s === null || s === 0; })) {
    showChartFallback(canvas, 'No data yet for this period.');
    return;
  }

  var ctx = canvas.getContext('2d');
  if (!ctx) {
    showChartFallback(canvas, 'Canvas not available.');
    return;
  }

  try {
    _chartInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Avg Score',
            data: avgScores,
            borderColor: '#534AB7',
            backgroundColor: 'rgba(83,74,183,0.1)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#534AB7',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#FFFFFF',
            titleColor: 'rgba(28,25,23,0.7)',
            bodyColor: '#1C1917',
            borderColor: '#E8E4DE',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            display: true,
            ticks: {
              color: 'rgba(28,25,23,0.3)',
              font: { size: 9 },
              maxTicksLimit: 5,
            },
            grid: { display: false },
          },
          y: {
            display: true,
            min: 0,
            max: 100,
            ticks: {
              color: 'rgba(28,25,23,0.3)',
              font: { size: 9 },
              stepSize: 25,
            },
            grid: {
              color: 'rgba(28,25,23,0.05)',
            },
          },
        },
      },
    });
  } catch (e) {
    console.warn('[RED] Chart render error:', e.message);
    showChartFallback(canvas, 'Chart render failed.');
  }
}

function insightsAction() {
  var text =
    'What patterns do you see in my prompt writing based on my history?';
  if (window.__RED.insertPromptText) {
    window.__RED.insertPromptText(text);
  }
}

function exportCsvAction() {
  if (!_premiumData || _premiumData.length === 0) return;

  var header = 'Date,Prompt,Score,Tokens,Refined\n';
  var rows = '';
  for (var i = 0; i < _premiumData.length; i++) {
    var d = _premiumData[i];
    var date = d.createdAt ? d.createdAt.slice(0, 10) : '';
    var prompt = (d.prompt || '').replace(/"/g, '""');
    rows +=
      '"' +
      date +
      '","' +
      prompt.slice(0, 100) +
      '",' +
      (d.score || 0) +
      ',' +
      (d.tokens || 0) +
      ',' +
      (d.refined ? 'Yes' : 'No') +
      '\n';
  }

  var blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'red-history-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

async function clearHistoryAction() {
  if (!_premiumData || _premiumData.length === 0) return;
  if (!confirm('Clear all history? This cannot be undone.')) return;

  var result = await chrome.storage.local.get(['supabase_user']);
  var user = result.supabase_user;
  var token = await window.__RED.getValidToken();
  if (!user || !token) return;

  var clearBtn = null;
  if (_premiumContainer) {
    var btns = _premiumContainer.querySelectorAll('button');
    for (var bi = 0; bi < btns.length; bi++) {
      if (btns[bi].textContent.indexOf('Clear') !== -1) {
        clearBtn = btns[bi];
        break;
      }
    }
  }
  if (clearBtn) { clearBtn.disabled = true; clearBtn.textContent = 'Clearing...'; }

  try {
    var res = await fetch(
      window.__RED_CONFIG.SUPABASE_URL + '/rest/v1/refine_history?user_id=eq.' + user.id,
        {
          method: 'DELETE',
          headers: {
            apikey: window.__RED_CONFIG.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + token,
          Prefer: 'return=minimal',
        },
      }
    );

    if (res.ok || res.status === 204) {
      _premiumData = [];
      if (_premiumContainer) {
        var doc = _premiumContainer.ownerDocument;
        while (_premiumContainer.firstChild) {
          _premiumContainer.removeChild(_premiumContainer.firstChild);
        }
        buildPremiumDashboard(_premiumContainer, doc, [], _premiumFilter);
      }
    } else {
      console.warn('[RED] Clear history failed:', res.status);
      showPremiumError('Failed to clear history. Make sure you are logged in and the DELETE RLS policy is applied on your Supabase project.');
    }
  } catch (e) {
    console.warn('[RED] Clear history error:', e);
    showPremiumError('Network error. Please try again.');
  } finally {
    if (clearBtn) { clearBtn.disabled = false; clearBtn.textContent = 'Clear history'; }
  }
}

window.__RED = window.__RED || {};
window.__RED.renderPremiumHistory = renderPremiumHistory;
console.log('[RED] renderPremiumHistory exported:', typeof window.__RED.renderPremiumHistory);
