# PDF Buddy Browser Extension

Capture web pages as PDFs and edit them with PDF Buddy.

## Features

- **Full Page Capture**: Capture the entire scrollable page as a PDF
- **Visible Area Capture**: Capture only what's currently visible
- **Selection Capture**: Draw a rectangle to capture a specific area
- **Text Selection**: Right-click selected text to save as PDF
- **Image Capture**: Right-click any image to save as PDF
- **PDF Buddy Integration**: Send captures directly to PDF Buddy for editing

## Installation

### Chrome / Edge / Brave (Chromium browsers)

1. Open `chrome://extensions/` (or `edge://extensions/` for Edge)
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `browser-extension` folder

### Firefox (coming soon)

Firefox support requires additional manifest modifications for Manifest V2 compatibility.

## Usage

### Popup Menu

1. Click the PDF Buddy extension icon in your browser toolbar
2. Choose a capture mode:
   - **Full Page**: Captures the entire page including scrollable content
   - **Visible Area**: Captures only what you can see
   - **Selection**: Lets you draw a rectangle to capture

### Quick Actions

- **Save as PDF**: Download the capture immediately
- **Edit in PDF Buddy**: Send to PDF Buddy for annotations, editing, etc.

### Context Menu

Right-click anywhere on a page to access:
- **Save page as PDF**: Quick capture of visible area
- **Save selection as PDF**: Capture selected text as formatted PDF
- **Save image as PDF**: Convert clicked image to PDF

### Keyboard Shortcuts

Configure in `chrome://extensions/shortcuts`:
- Default: `Ctrl+Shift+S` - Capture visible area

## Settings

Access settings from the gear icon in the popup:

- **PDF Buddy URL**: URL of your PDF Buddy instance (default: `http://localhost:5173`)
- **Default Action**: Choose between download or edit in PDF Buddy
- **Paper Size**: Auto, Letter, A4, or Legal
- **Include Background**: Whether to capture background colors
- **Include Images**: Whether to capture images

## Icons

The extension includes placeholder icons. To generate proper icons:

1. Open `src/icons/generate-icons.html` in a browser
2. Click each download button to save the icons
3. Replace the placeholder files in `src/icons/`

## Development

### Project Structure

```
browser-extension/
├── manifest.json           # Extension manifest (Manifest V3)
├── src/
│   ├── popup/             # Popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── background/        # Service worker
│   │   └── background.js
│   ├── content/           # Content scripts
│   │   ├── content.js
│   │   └── content.css
│   └── icons/             # Extension icons
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
└── README.md
```

### Building for Production

For production distribution:

1. Update version in `manifest.json`
2. Replace placeholder icons with proper ones
3. Zip the extension folder (excluding README and development files)
4. Submit to Chrome Web Store or distribute directly

## Troubleshooting

### "Cannot capture this page"

Some pages cannot be captured due to browser security restrictions:
- Browser internal pages (`chrome://`, `edge://`, etc.)
- Extension pages
- Some banking/secure sites

### "PDF Buddy connection failed"

Ensure:
1. PDF Buddy is running at the configured URL
2. The backend server is accessible (usually port 8000)
3. CORS is properly configured

### Icons not showing

Replace placeholder icons by opening `src/icons/generate-icons.html` in your browser and downloading the generated icons.

## Privacy

- Page content is processed locally using html2canvas
- PDFs are generated locally using jsPDF
- No data is sent to external servers unless you choose "Edit in PDF Buddy"
- When editing in PDF Buddy, content is sent only to your configured PDF Buddy instance

## License

Part of the PDF Buddy project.
