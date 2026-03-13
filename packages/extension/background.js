// Background service worker for PixelCheck extension
// Handles tab capture relay and message routing

chrome.runtime.onInstalled.addListener(() => {
  console.log('PixelCheck extension installed');
});

// Relay messages between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(
      sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT,
      { format: 'png', quality: 100 },
      dataUrl => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl });
        }
      }
    );
    return true; // async
  }

  if (message.type === 'SELECTION_COMPLETE') {
    // Forward selection result back to popup
    chrome.runtime.sendMessage({ type: 'SELECTION_RESULT', dataUrl: message.dataUrl });
  }
});

// Badge on extension icon when capture is in progress
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CAPTURE_START') {
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#a78bfa' });
  }
  if (msg.type === 'CAPTURE_DONE') {
    chrome.action.setBadgeText({ text: '' });
  }
  if (msg.type === 'CAPTURE_ERROR') {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f87171' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
});
