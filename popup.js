// LinkGuard popup.js

const scanBanner = document.getElementById('scanBanner');
const bannerIcon = document.getElementById('bannerIcon');
const bannerTitle = document.getElementById('bannerTitle');
const bannerSub = document.getElementById('bannerSub');
const statLinks = document.getElementById('statLinks');
const statThreats = document.getElementById('statThreats');
const statSafe = document.getElementById('statSafe');
const threatList = document.getElementById('threatList');
const threatSectionTitle = document.getElementById('threatSectionTitle');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const saveMsg = document.getElementById('saveMsg');
const rescanBtn = document.getElementById('rescanBtn');
const footerTime = document.getElementById('footerTime');

async function init() {
  // Load saved API key
  const stored = await chrome.storage.local.get(['safeBrowsingKey']);
  if (stored.safeBrowsingKey) {
    apiKeyInput.value = stored.safeBrowsingKey;
  }

  // Load scan result for current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const hostname = new URL(tab.url).hostname;
  const scanKey = `scan_${hostname}`;
  const result = await chrome.storage.local.get([scanKey]);
  const scan = result[scanKey];

  if (!stored.safeBrowsingKey) {
    setBanner('no-key', '🔑', 'no-key', 'API Key Required', 'Enter your Google Safe Browsing API key below');
    setStats('—', '—', '—');
    return;
  }

  if (!scan) {
    setBanner('unknown', '🔍', 'unknown', 'Not scanned yet', 'Refresh the page to trigger a scan');
    setStats('—', '—', '—');
    return;
  }

  renderScanResult(scan);
}

function renderScanResult(scan) {
  const { totalLinks, threatCount, threats, scannedAt } = scan;
  const safe = totalLinks - threatCount;

  setStats(totalLinks, threatCount, safe);

  if (threatCount > 0) {
    setBanner('threat', '🚨', 'threat',
      `${threatCount} Threat${threatCount > 1 ? 's' : ''} Detected!`,
      `${totalLinks} links scanned · ${safe} safe`
    );
    renderThreats(threats);
  } else {
    setBanner('safe', '✅', 'safe',
      'All Links Safe',
      `${totalLinks} links scanned — nothing suspicious`
    );
    threatList.innerHTML = '<div class="no-threats">✓ No threats detected on this page.</div>';
  }

  if (scannedAt) {
    const ago = formatAgo(scannedAt);
    footerTime.textContent = `Last scanned ${ago}`;
  }
}

function renderThreats(threats) {
  if (!threats || threats.length === 0) {
    threatList.innerHTML = '<div class="no-threats">✓ No threats detected.</div>';
    return;
  }

  threatSectionTitle.innerHTML = `<span style="color:#d73a49">⚠ Detected Threats (${threats.length})</span>`;

  threatList.innerHTML = threats.map(t => {
    const shortUrl = t.url.length > 55 ? t.url.slice(0, 52) + '…' : t.url;
    return `
      <div class="threat-item">
        <div class="threat-item-url">${escHtml(shortUrl)}</div>
        <span class="threat-item-type">⚠ ${escHtml(t.label)}</span>
      </div>`;
  }).join('');
}

function setBanner(type, icon, titleClass, title, sub) {
  scanBanner.className = `scan-banner ${type}`;
  bannerIcon.textContent = icon;
  bannerTitle.className = `banner-title ${titleClass}`;
  bannerTitle.textContent = title;
  bannerSub.textContent = sub;
}

function setStats(links, threats, safe) {
  statLinks.textContent = links;
  statThreats.textContent = threats;
  statSafe.textContent = safe;
}

// Save API key
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    saveMsg.textContent = 'Please enter an API key.';
    saveMsg.className = 'save-msg err';
    return;
  }
  await chrome.storage.local.set({ safeBrowsingKey: key });
  saveMsg.textContent = '✓ Saved! Refresh the page to scan.';
  saveMsg.className = 'save-msg ok';
  setTimeout(() => { saveMsg.textContent = ''; }, 3000);
});

// Rescan — reload the active tab
rescanBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    // Clear cached scan
    const hostname = new URL(tab.url).hostname;
    await chrome.storage.local.remove(`scan_${hostname}`);
    chrome.tabs.reload(tab.id);
    window.close();
  }
});

function formatAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
