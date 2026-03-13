# 🛡 LinkGuard — Malicious Link Detector

> A Chrome extension that automatically scans every webpage for dangerous links using the **Google Safe Browsing API**, highlights threats in red, and blocks clicks with a full warning modal.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=flat)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)
![Safe Browsing](https://img.shields.io/badge/Google-Safe%20Browsing%20API-red?style=flat&logo=google)

---

## 📸 What It Does

| Feature | Description |
|---|---|
| 🔍 **Auto Scan** | Scans all links on every page 0.8s after it loads |
| 🚨 **Highlight Threats** | Malicious links get a red border, strikethrough, and a ⚠ badge |
| 🚫 **Block Clicks** | Clicking a flagged link shows a full-screen warning modal |
| ✅ **Toast Notifications** | Shows a scan summary toast after every page scan |
| 📊 **Popup Dashboard** | View total links, threats found, and a full list of flagged URLs |
| ↻ **Rescan** | One-click rescan of any page |
| 🔁 **SPA Support** | Watches for dynamic content on sites like Twitter, GitHub, Reddit |

---

## 🗂 Project Structure

```
linkguard/
├── manifest.json       # Extension config (Manifest V3)
├── background.js       # Service worker — calls Safe Browsing API
├── content.js          # Injected into every page — scans & highlights links
├── content.css         # Injected styles — threat highlights, modal, toast
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic — shows scan results & manages API key
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## ⚙️ How It Works

```
Page Loads
    │
    ▼
content.js wakes up (after 0.8s delay)
    │
    ▼
Collects all <a href="..."> links on the page
    │
    ▼
Sends URLs to background.js via chrome.runtime.sendMessage
    │
    ▼
background.js calls Google Safe Browsing API v4
    │        (threatMatches:find endpoint)
    ▼
Threat results returned → stored in chrome.storage.local
    │
    ├─── Threats found?
    │       ├── YES → Highlight links in red + inject ⚠ badges
    │       │         Intercept all clicks → show warning modal
    │       │         Show red toast: "X threats found!"
    │       │         Update extension badge count
    │       │
    │       └── NO  → Show green toast: "X links scanned — all safe"
    │
    └─── Popup opened → reads cached scan result & displays dashboard
```

---

## 🚀 Setup Guide

### Step 1 — Get a Google Safe Browsing API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. In the search bar, type **"Safe Browsing API"** and click it
4. Click **Enable**
5. Go to **APIs & Services → Credentials**
6. Click **+ Create Credentials → API Key**
7. Copy the generated key (starts with `AIza...`)

> 💡 The Safe Browsing API has a **free tier of 10,000 requests/day** — more than enough for personal use.

---

### Step 2 — Install the Extension in Chrome

1. Download and **unzip** `linkguard-extension.zip`
2. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```
3. Toggle **Developer Mode** ON (top-right corner)
4. Click **Load unpacked**
5. Select the `linkguard/` folder
6. The 🛡 LinkGuard icon will appear in your Chrome toolbar

---

### Step 3 — Add Your API Key

1. Click the 🛡 **LinkGuard icon** in the Chrome toolbar
2. Scroll to the **"Google Safe Browsing API Key"** section
3. Paste your API key into the input field
4. Click **Save**
5. You'll see: `✓ Saved! Refresh the page to scan.`

---

### Step 4 — Start Browsing Safely

- **Refresh any webpage** — LinkGuard will automatically scan all links
- A **toast notification** appears in the bottom-right corner:
  - 🟢 `✓ 47 links scanned — all safe`
  - 🔴 `🛡 2 threats found on this page!`
- Dangerous links will be **highlighted in red** with a strikethrough
- Clicking a flagged link shows a **full warning modal**

---

## 🖥 Extension Popup

Click the 🛡 icon at any time to see:

| Section | What you see |
|---|---|
| **Scan Banner** | Green (safe) or Red (threats found) status for the current page |
| **Stats Row** | Total links scanned / Threats found / Safe links |
| **Threat List** | Full list of flagged URLs with their threat type |
| **Rescan Button** | Clears cache and reloads the page for a fresh scan |
| **API Key Field** | Manage your Safe Browsing API key |

---

## ⚠️ Threat Types Detected

LinkGuard checks for all major threat categories via Google Safe Browsing:

| Threat Type | Description |
|---|---|
| `MALWARE` | Pages that install malicious software |
| `SOCIAL_ENGINEERING` | Phishing and deceptive sites |
| `UNWANTED_SOFTWARE` | Pages that push unwanted programs |
| `POTENTIALLY_HARMFUL_APPLICATION` | Apps that may harm your device |

---

## 🔒 Privacy

- **No data is sent to any third-party server** except Google's Safe Browsing API
- URLs are sent to Google Safe Browsing in batches — this is the same service used by Chrome, Firefox, and Safari natively
- Your API key is stored locally in `chrome.storage.local` and never transmitted anywhere else
- Scan results are cached locally per hostname and cleared on rescan

---

## 🛠 Development

### Prerequisites
- Google Chrome (or any Chromium-based browser)
- A Google Cloud account (free)

### Load in Developer Mode
```bash
# Clone or unzip the extension
cd linkguard/

# Open Chrome → chrome://extensions → Developer Mode ON → Load unpacked → select this folder
```

### Key Files to Edit

**Add new threat types** — edit `background.js`:
```javascript
threatTypes: [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
  // Add more here
]
```

**Change highlight styles** — edit `content.css`:
```css
.lg-threat {
  outline: 2px solid #d73a49 !important;
  background-color: rgba(215, 58, 73, 0.12) !important;
  /* Customise colours here */
}
```

**Change scan delay** — edit `content.js`:
```javascript
await sleep(800); // Change to 0 for instant scan, or 2000 for slower pages
```

---

## 🐛 Troubleshooting

**Extension icon shows no badge after page load**
- Make sure your API key is saved in the popup
- Check that the page finished loading (the scan fires 0.8s after `document_idle`)
- Try clicking **↻ Rescan this page** in the popup

**"Invalid API key" error in toast**
- Double-check the key in the popup — it should start with `AIza`
- Make sure the **Safe Browsing API** is enabled in your Google Cloud project, not just created

**No toast appearing at all**
- Some pages (e.g. Chrome internal pages like `chrome://extensions`) block content scripts — this is expected
- On `file://` pages, you may need to enable "Allow access to file URLs" in the extension settings

**Toast says "No API key set"**
- Open the extension popup and enter your API key, then click Save

**Links not being highlighted on a site**
- The site may load links dynamically after the scan fires — click **Rescan** to re-check
- Some sites use `<span>` or `<div>` elements styled as links — these won't be caught (only `<a href>` tags are scanned)

---

## 📋 Permissions Explained

| Permission | Why It's Needed |
|---|---|
| `activeTab` | To read the current page's URL for the popup dashboard |
| `storage` | To save your API key and cache scan results locally |
| `tabs` | To update the extension badge count per tab |
| `host_permissions: <all_urls>` | To inject the scanner into every webpage |
| `host_permissions: safebrowsing.googleapis.com` | To call the Safe Browsing API from the background worker |

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙌 Built With

- [Google Safe Browsing API v4](https://developers.google.com/safe-browsing/v4)
- Chrome Extensions Manifest V3
- Vanilla JS — no frameworks or build tools needed
