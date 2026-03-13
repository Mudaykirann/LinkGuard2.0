// LinkGuard — Content Script
// Scans all links on page load, highlights threats, blocks clicks with warning

(function () {
  'use strict';

  if (window.__linkguardInitialized) return;
  window.__linkguardInitialized = true;

  const threatMap = {}; // url -> threat info
  let scanComplete = false;
  let totalLinks = 0;
  let threatCount = 0;

  // ── Entry point ──────────────────────────────────────────────────────────
  async function init() {
    // Small delay to let page fully render
    await sleep(800);

    const links = collectLinks();
    totalLinks = links.length;

    if (links.length === 0) return;

    // Send to background for Safe Browsing check
    const result = await chrome.runtime.sendMessage({
      type: 'CHECK_URLS',
      urls: links
    });

    if (result.error === 'NO_KEY') {
      showToast('⚠', 'No API key set — open LinkGuard icon', 'warn');
      return;
    }

    if (result.error === 'INVALID_KEY') {
      showToast('✕', 'Invalid API key — check settings', 'threat');
      return;
    }

    if (result.error) {
      showToast('⚠', 'Scan error: ' + result.error.slice(0, 40), 'warn');
      return;
    }

    // Build threat map
    for (const threat of result.threats) {
      threatMap[normalizeUrl(threat.url)] = threat;
    }

    threatCount = result.threats.length;
    scanComplete = true;

    // Highlight threats on page
    highlightThreats();

    // Update badge
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: threatCount });

    // Store results for popup
    chrome.storage.local.set({
      [`scan_${location.hostname}`]: {
        url: location.href,
        hostname: location.hostname,
        totalLinks,
        threatCount,
        threats: result.threats,
        scannedAt: Date.now()
      }
    });

    // Show toast
    if (threatCount > 0) {
      showToast('🛡', `${threatCount} threat${threatCount > 1 ? 's' : ''} found on this page!`, 'threat');
    } else {
      showToast('✓', `${totalLinks} links scanned — all safe`, 'safe');
    }

    // Watch for dynamic content (SPAs)
    observeDynamicLinks();
  }

  // ── Collect all links ────────────────────────────────────────────────────
  function collectLinks() {
    const anchors = document.querySelectorAll('a[href]');
    const urls = new Set();

    for (const a of anchors) {
      try {
        const url = new URL(a.href, location.href);
        if (['http:', 'https:'].includes(url.protocol)) {
          urls.add(url.href);
        }
      } catch {}
    }

    return [...urls];
  }

  // ── Highlight threat links ───────────────────────────────────────────────
  function highlightThreats() {
    const anchors = document.querySelectorAll('a[href]');

    for (const a of anchors) {
      if (a.dataset.lgProcessed) continue;
      a.dataset.lgProcessed = '1';

      try {
        const url = new URL(a.href, location.href);
        const threat = threatMap[normalizeUrl(url.href)];

        if (threat) {
          applyThreatStyles(a, threat);
          interceptClick(a, threat);
        }
      } catch {}
    }
  }

  function applyThreatStyles(anchor, threat) {
    anchor.classList.add('lg-threat');

    // Add badge pill
    const badge = document.createElement('span');
    badge.className = 'lg-threat-badge';
    badge.textContent = '⚠ ' + threat.label;
    anchor.appendChild(badge);
  }

  function interceptClick(anchor, threat) {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      showWarningModal(threat, anchor.href);
    }, true);
  }

  // ── Warning modal ────────────────────────────────────────────────────────
  function showWarningModal(threat, url) {
    // Remove any existing modal
    document.getElementById('lg-warning-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'lg-warning-overlay';

    const shortUrl = url.length > 60 ? url.slice(0, 57) + '…' : url;

    overlay.innerHTML = `
      <div id="lg-warning-box">
        <span class="lg-w-icon">🚨</span>
        <div class="lg-w-title">Dangerous Link Blocked</div>
        <div class="lg-w-subtitle">
          Google Safe Browsing has flagged this link.<br/>
          Visiting it may harm your device or steal your data.
        </div>
        <div class="lg-w-url-box">
          <div class="lg-w-url-label">Blocked URL</div>
          <div class="lg-w-url-text">${escHtml(shortUrl)}</div>
        </div>
        <div class="lg-w-threat-badge">
          ⚠ Threat Type: ${escHtml(threat.label)} · ${escHtml(threat.platformType || 'ANY PLATFORM')}
        </div>
        <div class="lg-w-buttons">
          <button class="lg-btn-back" id="lg-go-back">✓ Keep me safe</button>
          <button class="lg-btn-proceed" id="lg-proceed">Proceed anyway</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Back button
    document.getElementById('lg-go-back').addEventListener('click', () => {
      overlay.remove();
    });

    // Proceed anyway (bypass)
    document.getElementById('lg-proceed').addEventListener('click', () => {
      overlay.remove();
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Escape key
    const onKey = (e) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  }

  // ── Toast notification ───────────────────────────────────────────────────
  function showToast(icon, message, type = 'safe') {
    document.getElementById('lg-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'lg-toast';
    toast.innerHTML = `
      <div class="lg-toast-dot ${type}"></div>
      <span>${icon} ${escHtml(message)}</span>`;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('lg-toast-out');
      setTimeout(() => toast.remove(), 300);
    }, type === 'threat' ? 5000 : 3000);
  }

  // ── Watch dynamic content (for SPAs like Twitter, GitHub) ────────────────
  function observeDynamicLinks() {
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        highlightThreats(); // Re-check any new links added to DOM
      }, 500);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      return u.origin + u.pathname + u.search;
    } catch { return url; }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
