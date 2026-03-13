// Content script — injected into every page
// Handles region selection overlay when user picks "Draw region" capture mode

let selectionActive = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SELECTION') {
    if (selectionActive) return;
    startRegionSelection(sendResponse);
    return true; // async response
  }
});

function startRegionSelection(sendResponse) {
  selectionActive = true;

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = '__pixelcheck_overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647;
    cursor: crosshair;
    background: rgba(0,0,0,0.35);
    user-select: none;
  `;

  // Instruction banner
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    background: rgba(15,15,20,0.95); color: #e8e8f0;
    border: 1px solid rgba(167,139,250,0.4);
    border-radius: 8px; padding: 8px 16px;
    font-family: -apple-system, sans-serif; font-size: 13px; font-weight: 500;
    z-index: 2147483648; pointer-events: none;
    letter-spacing: -0.01em;
  `;
  banner.textContent = 'Drag to select region · Esc to cancel';

  // Selection rectangle
  const selRect = document.createElement('div');
  selRect.style.cssText = `
    position: fixed; border: 2px solid #a78bfa;
    background: rgba(167,139,250,0.1);
    pointer-events: none; z-index: 2147483648;
    display: none;
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(banner);
  document.body.appendChild(selRect);

  let startX = 0, startY = 0;
  let isDragging = false;

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selRect.style.left   = startX + 'px';
    selRect.style.top    = startY + 'px';
    selRect.style.width  = '0px';
    selRect.style.height = '0px';
    selRect.style.display = 'block';
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selRect.style.left   = x + 'px';
    selRect.style.top    = y + 'px';
    selRect.style.width  = w + 'px';
    selRect.style.height = h + 'px';
  };

  const cleanup = () => {
    overlay.remove();
    banner.remove();
    selRect.remove();
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('keydown', onKeyDown, true);
    selectionActive = false;
  };

  const onMouseUp = async (e) => {
    if (!isDragging) return;
    isDragging = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 10 || h < 10) {
      cleanup();
      sendResponse({ error: 'Selection too small' });
      return;
    }

    // Hide overlay briefly for clean capture
    overlay.style.display = 'none';
    selRect.style.display = 'none';
    banner.style.display = 'none';

    await new Promise(r => setTimeout(r, 80));

    // Ask background to capture visible tab
    chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, response => {
      cleanup();
      if (!response?.dataUrl) {
        sendResponse({ error: 'Capture failed' });
        return;
      }

      // Crop the full-tab capture to selection bounds
      cropDataUrl(response.dataUrl, x, y, w, h, window.devicePixelRatio || 1)
        .then(cropped => sendResponse({ dataUrl: cropped }))
        .catch(() => sendResponse({ dataUrl: response.dataUrl }));
    });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      cleanup();
      sendResponse({ error: 'Selection cancelled' });
    }
  };

  overlay.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('keydown', onKeyDown, true);
}

function cropDataUrl(dataUrl, x, y, w, h, dpr) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
