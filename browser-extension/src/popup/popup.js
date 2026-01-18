// Default settings
const DEFAULT_SETTINGS = {
  pdfBuddyUrl: 'http://localhost:5173',
  defaultAction: 'download',
  paperSize: 'auto',
  includeBackground: true,
  includeImages: true,
};

// State
let settings = { ...DEFAULT_SETTINGS };

// DOM Elements
const elements = {
  captureFullBtn: document.getElementById('capture-full'),
  captureVisibleBtn: document.getElementById('capture-visible'),
  captureSelectionBtn: document.getElementById('capture-selection'),
  savePdfBtn: document.getElementById('save-pdf'),
  editInBuddyBtn: document.getElementById('edit-in-buddy'),
  settingsBtn: document.getElementById('settings-btn'),
  backBtn: document.getElementById('back-btn'),
  saveSettingsBtn: document.getElementById('save-settings'),
  settingsPanel: document.getElementById('settings-panel'),
  status: document.getElementById('status'),
  statusIcon: document.getElementById('status-icon'),
  statusText: document.getElementById('status-text'),
  progressBar: document.getElementById('progress-bar'),
  progress: document.getElementById('progress'),
  // Settings inputs
  pdfBuddyUrl: document.getElementById('pdf-buddy-url'),
  defaultAction: document.getElementById('default-action'),
  paperSize: document.getElementById('paper-size'),
  includeBackground: document.getElementById('include-background'),
  includeImages: document.getElementById('include-images'),
};

// Initialize
async function init() {
  await loadSettings();
  setupEventListeners();
  updateUI();
}

// Load settings from storage
async function loadSettings() {
  try {
    const stored = await chrome.storage.sync.get('pdfBuddySettings');
    if (stored.pdfBuddySettings) {
      settings = { ...DEFAULT_SETTINGS, ...stored.pdfBuddySettings };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    await chrome.storage.sync.set({ pdfBuddySettings: settings });
    showStatus('Settings saved!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

// Update UI with current settings
function updateUI() {
  elements.pdfBuddyUrl.value = settings.pdfBuddyUrl;
  elements.defaultAction.value = settings.defaultAction;
  elements.paperSize.value = settings.paperSize;
  elements.includeBackground.checked = settings.includeBackground;
  elements.includeImages.checked = settings.includeImages;
}

// Setup event listeners
function setupEventListeners() {
  // Capture buttons
  elements.captureFullBtn.addEventListener('click', () => captureAndProcess('full'));
  elements.captureVisibleBtn.addEventListener('click', () => captureAndProcess('visible'));
  elements.captureSelectionBtn.addEventListener('click', () => startSelectionMode());

  // Quick action buttons
  elements.savePdfBtn.addEventListener('click', () => captureAndProcess('visible', 'download'));
  elements.editInBuddyBtn.addEventListener('click', () => captureAndProcess('visible', 'edit'));

  // Settings
  elements.settingsBtn.addEventListener('click', showSettings);
  elements.backBtn.addEventListener('click', hideSettings);
  elements.saveSettingsBtn.addEventListener('click', handleSaveSettings);
}

// Show settings panel
function showSettings() {
  elements.settingsPanel.classList.remove('hidden');
}

// Hide settings panel
function hideSettings() {
  elements.settingsPanel.classList.add('hidden');
}

// Handle save settings
function handleSaveSettings() {
  settings.pdfBuddyUrl = elements.pdfBuddyUrl.value.trim() || DEFAULT_SETTINGS.pdfBuddyUrl;
  settings.defaultAction = elements.defaultAction.value;
  settings.paperSize = elements.paperSize.value;
  settings.includeBackground = elements.includeBackground.checked;
  settings.includeImages = elements.includeImages.checked;
  saveSettings();
  hideSettings();
}

// Show status message
function showStatus(message, type = 'loading') {
  elements.status.classList.remove('hidden', 'success', 'error', 'loading');
  elements.status.classList.add(type);
  elements.statusText.textContent = message;

  if (type === 'loading') {
    elements.statusIcon.className = 'status-icon spinner';
  } else {
    elements.statusIcon.className = 'status-icon';
    elements.statusIcon.innerHTML = type === 'success'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  }

  // Auto-hide success/error after 3 seconds
  if (type !== 'loading') {
    setTimeout(() => {
      elements.status.classList.add('hidden');
    }, 3000);
  }
}

// Update progress bar
function showProgress(percent) {
  elements.progressBar.classList.remove('hidden');
  elements.progress.style.width = `${percent}%`;
}

function hideProgress() {
  elements.progressBar.classList.add('hidden');
}

// Capture and process page
async function captureAndProcess(mode, action = null) {
  const finalAction = action || settings.defaultAction;

  try {
    showStatus('Capturing page...', 'loading');
    showProgress(10);

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found');
    }

    showProgress(20);

    // Send message to background script to capture
    const response = await chrome.runtime.sendMessage({
      action: 'capture',
      mode: mode,
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      settings: {
        paperSize: settings.paperSize,
        includeBackground: settings.includeBackground,
        includeImages: settings.includeImages,
      },
    });

    showProgress(70);

    if (response.error) {
      throw new Error(response.error);
    }

    // Process the captured content
    if (finalAction === 'download') {
      showProgress(90);
      await downloadPdf(response.pdfBlob, response.filename);
      showStatus('PDF downloaded!', 'success');
    } else {
      showProgress(90);
      await openInPdfBuddy(response.pdfBlob, response.filename);
      showStatus('Opened in PDF Buddy!', 'success');
    }

    hideProgress();
  } catch (error) {
    console.error('Capture failed:', error);
    showStatus(error.message || 'Capture failed', 'error');
    hideProgress();
  }
}

// Start selection mode
async function startSelectionMode() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found');
    }

    // Send message to content script to start selection
    await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });

    // Close popup
    window.close();
  } catch (error) {
    console.error('Failed to start selection:', error);
    showStatus('Failed to start selection mode', 'error');
  }
}

// Download PDF
async function downloadPdf(dataUrl, filename) {
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true,
    });
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error('Failed to download PDF');
  }
}

// Open in PDF Buddy
async function openInPdfBuddy(dataUrl, filename) {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create form data
    const formData = new FormData();
    formData.append('file', blob, filename);

    // Upload to PDF Buddy backend
    const apiUrl = settings.pdfBuddyUrl.replace(/\/$/, '');
    const backendUrl = apiUrl.includes(':5173')
      ? apiUrl.replace(':5173', ':8000')
      : `${apiUrl}:8000`;

    const uploadResponse = await fetch(`${backendUrl}/api/pdf/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    const result = await uploadResponse.json();

    // Open PDF Buddy with the file
    await chrome.tabs.create({
      url: `${apiUrl}?file=${result.file_id}`,
    });
  } catch (error) {
    console.error('Failed to open in PDF Buddy:', error);
    // Fallback: just open PDF Buddy
    await chrome.tabs.create({ url: settings.pdfBuddyUrl });
    throw new Error('Could not upload to PDF Buddy. Please upload manually.');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
