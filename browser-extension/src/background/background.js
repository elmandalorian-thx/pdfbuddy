// Background service worker for PDF Buddy extension

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'capture') {
    handleCapture(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'selectionComplete') {
    handleSelectionCapture(message, sender.tab)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

// Handle page capture
async function handleCapture(message) {
  const { mode, tabId, url, title, settings } = message;

  try {
    // Capture screenshot of visible area
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100,
    });

    if (mode === 'visible') {
      // For visible area, just use the screenshot directly
      const pdfDataUrl = await createPdfFromImage(screenshotDataUrl, title, settings);
      return {
        pdfBlob: pdfDataUrl,
        filename: sanitizeFilename(title) + '.pdf',
      };
    }

    if (mode === 'full') {
      // For full page, need to scroll and capture
      const fullPageDataUrl = await captureFullPage(tabId, settings);
      const pdfDataUrl = await createPdfFromImage(fullPageDataUrl, title, settings);
      return {
        pdfBlob: pdfDataUrl,
        filename: sanitizeFilename(title) + '.pdf',
      };
    }

    throw new Error('Invalid capture mode');
  } catch (error) {
    console.error('Capture error:', error);
    throw error;
  }
}

// Handle selection capture
async function handleSelectionCapture(message, tab) {
  const { imageDataUrl, title } = message;

  try {
    const pdfDataUrl = await createPdfFromImage(imageDataUrl, title, {});

    // Download the PDF
    await chrome.downloads.download({
      url: pdfDataUrl,
      filename: sanitizeFilename(title || 'selection') + '.pdf',
      saveAs: true,
    });

    return { success: true };
  } catch (error) {
    console.error('Selection capture error:', error);
    throw error;
  }
}

// Capture full page by scrolling
async function captureFullPage(tabId, settings) {
  // Inject capture script
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: captureFullPageContent,
    args: [settings],
  });

  if (result && result[0] && result[0].result) {
    return result[0].result;
  }

  throw new Error('Failed to capture full page');
}

// This function runs in the page context
function captureFullPageContent(settings) {
  return new Promise(async (resolve, reject) => {
    try {
      // Dynamically load html2canvas
      if (!window.html2canvas) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        await new Promise((res, rej) => {
          script.onload = res;
          script.onerror = rej;
          document.head.appendChild(script);
        });
      }

      // Capture the page
      const canvas = await window.html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: settings.includeBackground ? null : '#ffffff',
        scale: 2,
        logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      resolve(canvas.toDataURL('image/png'));
    } catch (error) {
      reject(error);
    }
  });
}

// Create PDF from image
async function createPdfFromImage(imageDataUrl, title, settings) {
  // Load jsPDF dynamically in service worker
  if (!self.jspdf) {
    await importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }

  const { jsPDF } = self.jspdf;

  // Get image dimensions
  const img = await loadImage(imageDataUrl);
  const imgWidth = img.width;
  const imgHeight = img.height;

  // Calculate PDF dimensions
  let pdfWidth, pdfHeight;

  if (settings.paperSize === 'auto' || !settings.paperSize) {
    // Use image dimensions (convert pixels to mm at 96 DPI)
    const pixelsPerMm = 96 / 25.4;
    pdfWidth = imgWidth / pixelsPerMm;
    pdfHeight = imgHeight / pixelsPerMm;
  } else {
    // Use standard paper sizes
    const paperSizes = {
      letter: [215.9, 279.4],
      a4: [210, 297],
      legal: [215.9, 355.6],
    };
    [pdfWidth, pdfHeight] = paperSizes[settings.paperSize] || paperSizes.a4;
  }

  // Create PDF
  const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  });

  // Add metadata
  pdf.setProperties({
    title: title || 'Captured Page',
    creator: 'PDF Buddy Extension',
    subject: 'Web page capture',
  });

  // Calculate image placement
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const scaledWidth = imgWidth * ratio * (96 / 25.4);
  const scaledHeight = imgHeight * ratio * (96 / 25.4);

  // Add image to PDF
  pdf.addImage(imageDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

  return pdf.output('dataurlstring');
}

// Load image helper
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Sanitize filename
function sanitizeFilename(name) {
  return (name || 'page')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

// Handle context menu
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'capture-page',
    title: 'Save page as PDF',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'capture-selection',
    title: 'Save selection as PDF',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'capture-image',
    title: 'Save image as PDF',
    contexts: ['image'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'capture-page') {
    // Trigger visible capture
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100,
    });

    const pdfDataUrl = await createPdfFromImage(screenshotDataUrl, tab.title, {});

    await chrome.downloads.download({
      url: pdfDataUrl,
      filename: sanitizeFilename(tab.title) + '.pdf',
      saveAs: true,
    });
  }

  if (info.menuItemId === 'capture-selection') {
    // Send message to content script to capture selection
    await chrome.tabs.sendMessage(tab.id, {
      action: 'captureSelection',
      text: info.selectionText,
    });
  }

  if (info.menuItemId === 'capture-image') {
    // Download and convert image to PDF
    try {
      const response = await fetch(info.srcUrl);
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      const pdfDataUrl = await createPdfFromImage(dataUrl, 'image', {});

      await chrome.downloads.download({
        url: pdfDataUrl,
        filename: 'image.pdf',
        saveAs: true,
      });
    } catch (error) {
      console.error('Failed to capture image:', error);
    }
  }
});

// Convert blob to data URL
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-visible') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 100,
      });

      const pdfDataUrl = await createPdfFromImage(screenshotDataUrl, tab.title, {});

      await chrome.downloads.download({
        url: pdfDataUrl,
        filename: sanitizeFilename(tab.title) + '.pdf',
        saveAs: true,
      });
    }
  }
});
