var FREESTORAGE = chrome.storage.local;

function getScoreTier(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function tierColors(tier) {
  if (tier === 'high') return { bg: '#E1F5EE', text: '#085041' };
  if (tier === 'medium') return { bg: '#FAEEDA', text: '#633806' };
  return { bg: '#FCEBEB', text: '#791F1F' };
}

async function saveToFreeHistory(entry) {
  var promptTrunc = entry.prompt || '';
  if (promptTrunc.length > 200) promptTrunc = promptTrunc.slice(0, 200);

  var item = {
    id: Date.now(),
    prompt: promptTrunc,
    score: entry.score || 0,
    tokens: entry.tokens || 0,
    refined: !!entry.refined,
    refinedScore: entry.refinedScore || null,
    issues: Array.isArray(entry.issues) ? entry.issues.slice(0, 3) : [],
    createdAt: new Date().toISOString(),
  };

  try {
    var result = await FREESTORAGE.get('red_history');
    var list = result.red_history || [];
    list.unshift(item);
    if (list.length > 20) list.length = 20;
    await FREESTORAGE.set({ red_history: list });
  } catch (e) {
    console.warn('[RED] Failed to save free history:', e);
  }
}

async function loadFreeHistory() {
  try {
    var result = await FREESTORAGE.get('red_history');
    return result.red_history || [];
  } catch (e) {
    return [];
  }
}

function renderFreeHistory(containerEl) {
  while (containerEl.firstChild) {
    containerEl.removeChild(containerEl.firstChild);
  }

  var doc = containerEl.ownerDocument;

  var loadingWrap = doc.createElement('div');
  loadingWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;';
  var spinEl = doc.createElement('div');
  spinEl.className = 'spinner';
  spinEl.style.cssText = 'width:20px;height:20px;border-width:2.5px;';
  loadingWrap.appendChild(spinEl);
  var loadLabel = doc.createElement('div');
  loadLabel.style.cssText = 'font-size:11px;color:rgba(28,25,23,0.35);';
  loadLabel.textContent = 'Loading history...';
  loadingWrap.appendChild(loadLabel);
  containerEl.appendChild(loadingWrap);

  loadFreeHistory().then(function (entries) {
    while (containerEl.firstChild) {
      containerEl.removeChild(containerEl.firstChild);
    }

    if (!entries || entries.length === 0) {
      var emptyEl = doc.createElement('div');
      emptyEl.style.cssText = 'text-align:center;padding:24px;font-size:11px;color:rgba(28,25,23,0.3);';
      emptyEl.textContent = 'No prompts yet. Start typing to see history.';
      containerEl.appendChild(emptyEl);
    } else {
      var listWrap = doc.createElement('div');
      listWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e.prompt || e.prompt === '(empty)' || !e.prompt.trim()) continue;
        var row = buildFreeRow(doc, e);
        listWrap.appendChild(row);
      }

      containerEl.appendChild(listWrap);
    }

    var banner = doc.createElement('div');
    banner.style.cssText =
      'margin-top:12px;padding:10px 14px;background:rgba(83,74,183,0.06);border:1px solid rgba(83,74,183,0.15);border-radius:8px;font-size:12px;color:#534AB7;cursor:pointer;';
    banner.textContent = '\u26A1 Upgrade to Premium for full analytics \u2192';
    banner.addEventListener('click', function () {
      if (window.__RED && window.__RED.startUpgrade) {
        window.__RED.startUpgrade();
      } else {
        window.open('https://rzp.io/i/upgrade-red', '_blank');
      }
    });
    containerEl.appendChild(banner);
  }).catch(function (e) {
    console.warn('[RED] Free history render error:', e);
    while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);
    var errEl = doc.createElement('div');
    errEl.style.cssText = 'padding:16px;text-align:center;';
    var errMsg = doc.createElement('div');
    errMsg.style.cssText = 'font-size:11px;color:rgba(226,75,74,0.8);margin-bottom:8px;line-height:1.4;';
    errMsg.textContent = 'Failed to load history.';
    errEl.appendChild(errMsg);
    var retryBtn = doc.createElement('button');
    retryBtn.style.cssText = 'font-size:11px;background:none;border:1px solid rgba(28,25,23,0.15);border-radius:6px;padding:4px 12px;cursor:pointer;color:rgba(28,25,23,0.6);';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', function () { renderFreeHistory(containerEl); });
    errEl.appendChild(retryBtn);
    containerEl.appendChild(errEl);
  });
}

function buildFreeRow(doc, entry) {
  var row = doc.createElement('div');
  row.style.cssText =
    'display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(28,25,23,0.03);border:1px solid rgba(28,25,23,0.06);border-radius:6px;cursor:pointer;transition:background 150ms ease-out;';
  row.addEventListener('mouseenter', function () {
    row.style.background = 'rgba(28,25,23,0.04)';
  });
  row.addEventListener('mouseleave', function () {
    row.style.background = 'rgba(28,25,23,0.03)';
  });

  var score = entry.score || 0;
  var tier = getScoreTier(score);
  var tc = tierColors(tier);

  var badge = doc.createElement('div');
  badge.style.cssText =
    'width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:' +
    tc.bg +
    ';color:' +
    tc.text +
    ';';
  badge.textContent = String(score);
  row.appendChild(badge);

  var info = doc.createElement('div');
  info.style.cssText = 'flex:1;min-width:0;';

  var promptText = doc.createElement('div');
  promptText.style.cssText =
    'font-size:12px;color:rgba(28,25,23,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;';
  promptText.textContent = entry.prompt || '(empty)';
  info.appendChild(promptText);

  var meta = doc.createElement('div');
  meta.style.cssText = 'font-size:10px;color:rgba(28,25,23,0.3);margin-top:1px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
  var metaText = doc.createTextNode(formatRelTime(entry.createdAt) + ' \u00B7 ' + (entry.tokens || 0) + ' tok');
  meta.appendChild(metaText);

  if (entry.refined === true) {
    var refBadge = doc.createElement('span');
    refBadge.style.cssText = 'font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(29,158,117,0.15);color:#1D9E75;';
    refBadge.textContent = 'Refined';
    meta.appendChild(refBadge);
  }

  info.appendChild(meta);

  if (entry.issues && entry.issues.length > 0) {
    var issueRow = doc.createElement('div');
    issueRow.style.cssText =
      'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;';
    for (var j = 0; j < entry.issues.length; j++) {
      var chip = doc.createElement('span');
      chip.style.cssText =
        'font-size:9px;padding:1px 6px;border-radius:3px;background:rgba(239,159,39,0.15);color:#EF9F27;';
      chip.textContent = entry.issues[j];
      issueRow.appendChild(chip);
    }
    info.appendChild(issueRow);
  }

  row.appendChild(info);

  var chevron = doc.createElement('i');
  chevron.className = 'ti ti-chevron-right';
  chevron.style.cssText = 'font-size:14px;color:rgba(28,25,23,0.2);flex-shrink:0;';
  row.appendChild(chevron);

  return row;
}

function formatRelTime(isoStr) {
  var d = new Date(isoStr);
  var now = new Date();
  var diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

window.__RED = window.__RED || {};
window.__RED.saveToFreeHistory = saveToFreeHistory;
window.__RED.renderFreeHistory = renderFreeHistory;
window.__RED.loadFreeHistory = loadFreeHistory;
