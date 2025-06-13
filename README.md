# Codeforces Submissions Downloader

A Chrome extension that allows you to download all your accepted submissions from Codeforces in a single ZIP file.

## Features

- Download all accepted submissions for any Codeforces user
- Automatically packages submissions into a single ZIP file
- Continues downloading in the background if popup is closed
- Shows download progress
- Saves each submission with a descriptive filename
- Proper file extensions based on programming language

## Installation

### From Chrome Web Store (Coming Soon)

The extension will be available in the Chrome Web Store soon.

### Manual Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now appear in your extensions list and browser toolbar

## Usage

1. Navigate to any Codeforces page
2. Click the extension icon in your browser toolbar
3. Enter the Codeforces username you want to download submissions for
4. Click "Download All Submissions"
5. Wait for the download process to complete
6. Choose where to save the ZIP file when prompted

## How It Works

1. The extension fetches all submissions for the specified user from the Codeforces API
2. It filters for accepted submissions and keeps only the latest acceptance for each problem
3. For each submission, it retrieves the source code from the submission page
4. All submissions are collected and packaged into a ZIP file
5. The ZIP file is downloaded to your computer

## Background Downloads

If you close the popup during a download, the process will continue in the background. When the download is complete, you'll receive a notification. You can always reopen the popup to see the current progress.

## Files

- `manifest.json`: Extension configuration
- `popup.html` & `popup.js`: UI for the extension popup
- `content.js`: Main script that runs on Codeforces pages
- `background.js`: Background service worker for handling downloads
- `getSubmissionSourceCode.js`: Helper functions for retrieving submission code
- `jszip.min.js`: Library for creating ZIP files

## License

MIT License. See [LICENSE](LICENSE) for details.
