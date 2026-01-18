// Content script for PDF Buddy extension
// Handles selection capture and page interactions

let selectionOverlay = null;
let isSelecting = false;
let startX = 0;
let startY = 0;

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startSelection') {
    startSelectionMode();
    sendResponse({ success: true });
  }

  if (message.action === 'captureSelection') {
    captureTextSelection(message.text);
    sendResponse({ success: true });
  }

  return true;
});

// Start selection mode
function startSelectionMode() {
  if (isSelecting) return;
  isSelecting = true;

  // Create overlay
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'pdf-buddy-overlay';
  selectionOverlay.innerHTML = `
    <div class="pdf-buddy-instructions">
      <div class="pdf-buddy-instructions-content">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 3h4M15 3h4M3 5v4M21 5v4M3 15v4M21 15v4M5 21h4M15 21h4"/>
        </svg>
        <span>Click and drag to select an area</span>
        <small>Press ESC to cancel</small>
      </div>
    </div>
    <div class="pdf-buddy-selection"></div>
  `;
  document.body.appendChild(selectionOverlay);

  // Add event listeners
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);

  // Update cursor
  document.body.style.cursor = 'crosshair';
}

// End selection mode
function endSelectionMode() {
  isSelecting = false;

  // Remove overlay
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }

  // Remove event listeners
  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);

  // Reset cursor
  document.body.style.cursor = '';
}

// Handle mouse down
function handleMouseDown(e) {
  if (!isSelecting) return;

  startX = e.pageX;
  startY = e.pageY;

  const selection = selectionOverlay.querySelector('.pdf-buddy-selection');
  selection.style.left = `${startX}px`;
  selection.style.top = `${startY}px`;
  selection.style.width = '0';
  selection.style.height = '0';
  selection.style.display = 'block';

  // Hide instructions
  const instructions = selectionOverlay.querySelector('.pdf-buddy-instructions');
  instructions.style.opacity = '0';
}

// Handle mouse move
function handleMouseMove(e) {
  if (!isSelecting || startX === 0) return;

  const selection = selectionOverlay.querySelector('.pdf-buddy-selection');
  const currentX = e.pageX;
  const currentY = e.pageY;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selection.style.left = `${left}px`;
  selection.style.top = `${top}px`;
  selection.style.width = `${width}px`;
  selection.style.height = `${height}px`;
}

// Handle mouse up
async function handleMouseUp(e) {
  if (!isSelecting || startX === 0) return;

  const endX = e.pageX;
  const endY = e.pageY;

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // Minimum selection size
  if (width < 10 || height < 10) {
    endSelectionMode();
    return;
  }

  try {
    // Capture the selection
    await captureAreaSelection(left, top, width, height);
  } catch (error) {
    console.error('Selection capture failed:', error);
    showNotification('Capture failed: ' + error.message, 'error');
  }

  endSelectionMode();
}

// Handle key down
function handleKeyDown(e) {
  if (e.key === 'Escape') {
    endSelectionMode();
  }
}

// Capture area selection using html2canvas
async function captureAreaSelection(left, top, width, height) {
  // Load html2canvas if not present
  if (!window.html2canvas) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }

  // Hide our overlay temporarily
  selectionOverlay.style.display = 'none';

  // Capture the selected area
  const canvas = await window.html2canvas(document.body, {
    useCORS: true,
    allowTaint: true,
    scale: 2,
    logging: false,
    x: left + window.scrollX,
    y: top + window.scrollY,
    width: width,
    height: height,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
  });

  // Show overlay again
  selectionOverlay.style.display = 'block';

  const imageDataUrl = canvas.toDataURL('image/png');

  // Send to background script for PDF creation
  await chrome.runtime.sendMessage({
    action: 'selectionComplete',
    imageDataUrl: imageDataUrl,
    title: document.title + ' (selection)',
  });

  showNotification('Selection captured!', 'success');
}

// Capture text selection as styled HTML
async function captureTextSelection(text) {
  if (!text) return;

  // Create a temporary element with the selected text
  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 800px;
    padding: 40px;
    background: white;
    font-family: Georgia, serif;
    font-size: 16px;
    line-height: 1.6;
    color: #333;
    z-index: 999999;
  `;
  tempDiv.innerHTML = `
    <h1 style="font-size: 18px; margin-bottom: 20px; color: #666;">
      Selected from: ${document.title}
    </h1>
    <div style="white-space: pre-wrap;">${escapeHtml(text)}</div>
    <p style="margin-top: 30px; font-size: 12px; color: #999;">
      Captured on ${new Date().toLocaleDateString()} from ${window.location.href}
    </p>
  `;
  document.body.appendChild(tempDiv);

  // Load html2canvas if not present
  if (!window.html2canvas) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }

  // Capture the element
  const canvas = await window.html2canvas(tempDiv, {
    useCORS: true,
    scale: 2,
    logging: false,
  });

  // Remove temporary element
  tempDiv.remove();

  const imageDataUrl = canvas.toDataURL('image/png');

  // Send to background script for PDF creation
  await chrome.runtime.sendMessage({
    action: 'selectionComplete',
    imageDataUrl: imageDataUrl,
    title: document.title + ' (text)',
  });

  showNotification('Text captured!', 'success');
}

// Load external script
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `pdf-buddy-notification pdf-buddy-notification-${type}`;
  notification.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success'
        ? '<path d="M20 6L9 17l-5-5"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
      }
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);

  // Animate in
  requestAnimationFrame(() => {
    notification.classList.add('pdf-buddy-notification-visible');
  });

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('pdf-buddy-notification-visible');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Log that content script is loaded
console.log('PDF Buddy content script loaded');
