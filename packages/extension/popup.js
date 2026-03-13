// ── State ─────────────────────────────────────────────────────
let currentTab = null;
let serverUrl = 'http://localhost:3001';
let captureMode = 'viewport';

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const captureBtn   = $('captureBtn');
const statusLoading = $('statusLoading');
const statusSuccess = $('statusSuccess');
const statusError   = $('statusError');
const statusText   = $('statusText');
const scoreBadge   = $('scoreBadge');
const serverDot    = $('serverDot');

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedState();
  await getCurrentTab();
  await checkServerHealth();
  renderRecentCaptures();
  attachListeners();
});

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  $('tabUrl').textContent = tab.url ?? 'Unknown URL';
  if (tab.favIconUrl) {
    $('tabFavicon').src = tab.favIconUrl;
  }
}

async function checkServerHealth() {
  try {
    const res = await fetch(`${serverUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      serverDot.className = 'server-dot connected';
      serverDot.title = 'PixelCheck API connected';
    } else {
      serverDot.className = 'server-dot error';
    }
  } catch {
    serverDot.className = 'server-dot error';
    serverDot.title = 'PixelCheck API not reachable — is it running?';
  }
}

// ── Load / save state ─────────────────────────────────────────
async function loadSavedState() {
  const data = await chrome.storage.local.get([
    'storyId', 'screenName', 'designSource',
    'figmaFileId', 'figmaNodeId',
    'zeplinProjectId', 'zeplinScreenId',
    'serverUrl', 'captureMode', 'cssSelector',
  ]);

  if (data.storyId)        $('storyId').value = data.storyId;
  if (data.screenName)     $('screenName').value = data.screenName;
  if (data.figmaFileId)    $('figmaFileId').value = data.figmaFileId;
  if (data.figmaNodeId)    $('figmaNodeId').value = data.figmaNodeId;
  if (data.zeplinProjectId) $('zeplinProjectId').value = data.zeplinProjectId;
  if (data.zeplinScreenId) $('zeplinScreenId').value = data.zeplinScreenId;
  if (data.cssSelector)    $('cssSelector').value = data.cssSelector;
  if (data.serverUrl)      { serverUrl = data.serverUrl; $('serverUrl').value = serverUrl; }

  if (data.designSource) {
    $('designSource').value = data.designSource;
    toggleDesignSource(data.designSource);
  }

  if (data.captureMode) {
    captureMode = data.captureMode;
    selectCaptureMode(captureMode);
  }
}

function saveState() {
  chrome.storage.local.set({
    storyId: $('storyId').value,
    screenName: $('screenName').value,
    designSource: $('designSource').value,
    figmaFileId: $('figmaFileId').value,
    figmaNodeId: $('figmaNodeId').value,
    zeplinProjectId: $('zeplinProjectId').value,
    zeplinScreenId: $('zeplinScreenId').value,
    cssSelector: $('cssSelector').value,
    serverUrl,
    captureMode,
  });
}

// ── Listeners ─────────────────────────────────────────────────
function attachListeners() {
  captureBtn.addEventListener('click', handleCapture);

  $('designSource').addEventListener('change', e => {
    toggleDesignSource(e.target.value);
    saveState();
  });

  $('serverUrl').addEventListener('change', e => {
    serverUrl = e.target.value.replace(/\/$/, '');
    saveState();
    checkServerHealth();
  });

  // Capture mode radio buttons
  document.querySelectorAll('.capture-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const radio = opt.querySelector('input[type=radio]');
      captureMode = radio.value;
      selectCaptureMode(captureMode);
      saveState();
    });
  });

  // Auto-save all inputs
  ['storyId','screenName','figmaFileId','figmaNodeId',
   'zeplinProjectId','zeplinScreenId','cssSelector'].forEach(id => {
    $(id)?.addEventListener('input', saveState);
  });
}

function toggleDesignSource(source) {
  $('figmaFields').style.display = source === 'figma' ? 'block' : 'none';
  $('zeplinFields').style.display = source === 'zeplin' ? 'block' : 'none';
}

function selectCaptureMode(mode) {
  document.querySelectorAll('.capture-opt').forEach(opt => {
    const radio = opt.querySelector('input[type=radio]');
    opt.classList.toggle('selected', radio.value === mode);
  });
  $('selectorField').style.display = mode === 'element' ? 'block' : 'none';
}

// ── Main capture flow ─────────────────────────────────────────
async function handleCapture() {
  const storyId = $('storyId').value.trim();
  const screenName = $('screenName').value.trim();
  const designSource = $('designSource').value;

  if (!storyId) { showError('Please enter a Story / Ticket ID'); return; }
  if (!screenName) { showError('Please enter a screen name'); return; }

  // Validate design IDs
  if (designSource === 'figma') {
    if (!$('figmaFileId').value.trim() || !$('figmaNodeId').value.trim()) {
      showError('Please enter Figma File ID and Node ID'); return;
    }
  } else {
    if (!$('zeplinProjectId').value.trim() || !$('zeplinScreenId').value.trim()) {
      showError('Please enter Zeplin Project ID and Screen ID'); return;
    }
  }

  captureBtn.disabled = true;
  hideStatus();
  showLoading('Capturing screenshot...');

  try {
    // Step 1: Capture screenshot of the active tab
    const screenshotDataUrl = await captureActiveTab();
    showLoading('Sending to PixelCheck...');

    // Step 2: Build payload and POST to API
    const payload = {
      storyId,
      screenName,
      platform: 'web',
      designSource,
      figmaFileId:     $('figmaFileId').value.trim() || undefined,
      figmaNodeId:     $('figmaNodeId').value.trim() || undefined,
      zeplinProjectId: $('zeplinProjectId').value.trim() || undefined,
      zeplinScreenId:  $('zeplinScreenId').value.trim() || undefined,
      cssSelector:     captureMode === 'element' ? $('cssSelector').value.trim() || undefined : undefined,
      screenshotDataUrl,
      viewport: { width: currentTab?.width ?? 1440, height: currentTab?.height ?? 900 },
      captureMode,
      tabUrl: currentTab?.url,
    };

    showLoading('Fetching design & running comparison...');

    const res = await fetch(`${serverUrl}/api/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }

    const result = await res.json();

    // Save to recent
    saveRecentCapture({ storyId, screenName, score: result.accuracyScore, reportId: result.reportId, ts: Date.now() });

    hideStatus();
    showScore(result);

  } catch (err) {
    hideStatus();
    showError(String(err).replace('Error: ', ''));
  } finally {
    captureBtn.disabled = false;
  }
}

// ── Screenshot capture ────────────────────────────────────────
async function captureActiveTab() {
  // Use Chrome's built-in tab capture API (works without extra permissions)
  if (captureMode === 'viewport') {
    // captureVisibleTab captures exactly what the user sees
    return new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(
        currentTab.windowId,
        { format: 'png', quality: 100 },
        dataUrl => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(dataUrl);
          }
        }
      );
    });
  }

  if (captureMode === 'fullpage') {
    // Inject content script to scroll-capture full page
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: captureFullPageScript,
    });
    return result.result;
  }

  if (captureMode === 'element') {
    const selector = $('cssSelector').value.trim();
    if (!selector) throw new Error('Enter a CSS selector to capture a specific element');

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: captureElementScript,
      args: [selector],
    });

    if (result.result?.error) throw new Error(result.result.error);
    return result.result;
  }

  if (captureMode === 'selection') {
    // Inject region-selection overlay
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['content.js'],
    });

    return new Promise((resolve, reject) => {
      // Tell content script to start region selection
      chrome.tabs.sendMessage(currentTab.id, { type: 'START_SELECTION' }, response => {
        if (chrome.runtime.lastError || !response?.dataUrl) {
          reject(new Error('Selection cancelled or failed'));
        } else {
          resolve(response.dataUrl);
        }
      });
    });
  }

  throw new Error(`Unknown capture mode: ${captureMode}`);
}

// Injected into page for full-page capture (scrolls and stitches)
function captureFullPageScript() {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = document.documentElement.scrollWidth * dpr;
    canvas.height = document.documentElement.scrollHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Use html2canvas-like approach via foreignObject SVG
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${document.documentElement.scrollWidth}" height="${document.documentElement.scrollHeight}">
      <foreignObject width="100%" height="100%">
        <body xmlns="http://www.w3.org/1999/xhtml">${document.documentElement.outerHTML}</body>
      </foreignObject>
    </svg>`;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null); // Fallback to viewport
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  });
}

// Injected into page for element capture
function captureElementScript(selector) {
  const el = document.querySelector(selector);
  if (!el) return { error: `Element "${selector}" not found on page` };
  const rect = el.getBoundingClientRect();
  return {
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scrollX: window.scrollX, scrollY: window.scrollY }
  };
}

// ── Recent captures ───────────────────────────────────────────
async function saveRecentCapture(item) {
  const data = await chrome.storage.local.get(['recentCaptures']);
  const recent = data.recentCaptures ?? [];
  recent.unshift(item);
  await chrome.storage.local.set({ recentCaptures: recent.slice(0, 5) });
  renderRecentCaptures();
}

async function renderRecentCaptures() {
  const data = await chrome.storage.local.get(['recentCaptures']);
  const recent = data.recentCaptures ?? [];
  if (recent.length === 0) return;

  $('recentSection').style.display = 'block';
  $('recentList').innerHTML = recent.map(r => {
    const color = r.score >= 85 ? '#34d399' : r.score >= 65 ? '#fbbf24' : '#f87171';
    const time = new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="recent-item">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;color:var(--text)">${r.screenName}</div>
          <div style="font-size:10.5px;color:var(--text3)">${r.storyId} · ${time}</div>
        </div>
        <div class="recent-score" style="color:${color}">${r.score}/100</div>
      </div>
    `;
  }).join('');
}

// ── UI helpers ────────────────────────────────────────────────
function showLoading(msg) {
  statusText.textContent = msg;
  statusLoading.className = 'status loading show';
  statusSuccess.className = 'status success';
  statusError.className = 'status error';
  scoreBadge.className = 'score-badge';
}

function showError(msg) {
  $('errorText').textContent = msg;
  statusError.className = 'status error show';
  statusLoading.className = 'status loading';
  statusSuccess.className = 'status success';
}

function hideStatus() {
  statusLoading.className = 'status loading';
  statusSuccess.className = 'status success';
  statusError.className = 'status error';
}

function showScore(result) {
  const score = result.accuracyScore ?? 0;
  const color = score >= 85 ? '#34d399' : score >= 65 ? '#fbbf24' : '#f87171';
  $('scoreNum').textContent = score;
  $('scoreNum').style.color = color;
  $('scoreIssues').textContent = `${result.totalIssues ?? 0} issues found`;
  $('scoreMismatch').textContent = `${result.mismatchPercent?.toFixed(1) ?? '0.0'}% pixel mismatch`;
  $('scoreLink').href = `${serverUrl.replace('3001', '5173')}/report/${result.reportId}`;
  scoreBadge.className = 'score-badge show';
}
