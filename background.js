// LinkGuard Background Service Worker
// Calls Google Safe Browsing API on behalf of content scripts

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_URLS') {
    checkUrls(message.urls).then(sendResponse);
    return true; // Keep channel open for async
  }

  if (message.type === 'UPDATE_BADGE') {
    const count = message.count;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count), tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#d73a49', tabId: sender.tab.id });
    } else {
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    }
  }

  if (message.type === 'GET_API_KEY') {
    chrome.storage.local.get(['safeBrowsingKey'], (r) => {
      sendResponse({ key: r.safeBrowsingKey || '' });
    });
    return true;
  }
});

async function checkUrls(urls) {
  const stored = await chrome.storage.local.get(['safeBrowsingKey']);
  const apiKey = stored.safeBrowsingKey;

  if (!apiKey) {
    return { error: 'NO_KEY', threats: [] };
  }

  // Deduplicate and limit to 500 (API limit)
  const unique = [...new Set(urls)].slice(0, 500);

  const body = {
    client: { clientId: 'linkguard-extension', clientVersion: '1.0.0' },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
        'THREAT_TYPE_UNSPECIFIED'
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: unique.map(url => ({ url }))
    }
  };

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 400) return { error: 'INVALID_KEY', threats: [] };
      return { error: err.error?.message || `HTTP ${res.status}`, threats: [] };
    }

    const data = await res.json();
    const matches = data.matches || [];

    // Build threat map: url -> threat details
    const threatMap = {};
    for (const match of matches) {
      const url = match.threat?.url;
      if (url) {
        threatMap[url] = {
          url,
          threatType: match.threatType,
          platformType: match.platformType,
          label: formatThreatType(match.threatType)
        };
      }
    }

    return { error: null, threats: Object.values(threatMap) };
  } catch (err) {
    return { error: err.message, threats: [] };
  }
}

function formatThreatType(type) {
  const map = {
    MALWARE: 'Malware',
    SOCIAL_ENGINEERING: 'Phishing',
    UNWANTED_SOFTWARE: 'Unwanted Software',
    POTENTIALLY_HARMFUL_APPLICATION: 'Harmful App',
    THREAT_TYPE_UNSPECIFIED: 'Unknown Threat'
  };
  return map[type] || type;
}
