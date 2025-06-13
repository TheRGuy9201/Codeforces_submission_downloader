/**
 * Codeforces Submission Downloader - Background Script
 * 
 * This script runs in the background and handles:
 * - File downloads
 * - ZIP file generation
 * - Background state management
 * - Notifications
 */

// Listener for messages from content scripts and popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {    if (request.action === 'download') {
        downloadFile(request.url, request.filename, request.sourceCode)
            .then(() => sendResponse({success: true}))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    } else if (request.action === 'downloadZip') {
        console.log('Background script received downloadZip request:', request.filename);
        downloadZipFile(request.content, request.filename)
            .then((downloadId) => {
                console.log('Zip file download started, ID:', downloadId);
                sendResponse({success: true, downloadId});
            })
            .catch(error => {
                console.error('Zip file download failed:', error);
                sendResponse({success: false, error: error.message});
            });
        return true;
    }
    else if (request.action === 'checkDownloadState') {
        chrome.storage.local.get(['downloadState'], function(result) {
            sendResponse(result.downloadState || null);
        });        return true;
    } else if (request.action === 'notifyComplete') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.svg',
            title: 'Download Complete',
            message: `Successfully downloaded ${request.result.count} submissions!`
        });
    }
    else if (request.action === 'testZipDownload') {
        console.log('Testing download functionality');
        
        const textContent = "This is a test file to verify download functionality";
        const blob = new Blob([textContent], {type: 'text/plain'});
        const testUrl = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: testUrl,
            filename: "test_download.txt",
            saveAs: true
        }, (downloadId) => {
            console.log("Test download ID:", downloadId);
            
            setTimeout(() => URL.revokeObjectURL(testUrl), 1000);
            
            if (chrome.runtime.lastError) {
                console.error("Test download error:", chrome.runtime.lastError);
                sendResponse({success: false, error: chrome.runtime.lastError.message});
            } else {
                sendResponse({success: true, downloadId: downloadId});
            }
        });
        
        return true; 
    }
    else if (request.action === 'testZipDownload') {
        console.log('Testing zip download');
        
        const zip = new JSZip();
        zip.file("test.txt", "This is a test file content");
        
        zip.generateAsync({type: "blob"})
            .then(function(content) {
                return downloadZipFile(content, "test_download.zip");
            })
            .then(function(downloadId) {
                console.log("Test download started with ID:", downloadId);
                sendResponse({success: true});
            })
            .catch(function(error) {
                console.error("Test download failed:", error);
                sendResponse({success: false, error: error.message});
            });
        
        return true; 
    }
});

async function downloadFile(url, filename, sourceCode) {
    try {
        const blob = new Blob([sourceCode], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        
        const downloadId = await new Promise((resolve, reject) => {
            chrome.downloads.download({
                url: blobUrl,
                filename: filename,
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(downloadId);
                }
            });
        });
        
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 1000);
        
        return downloadId;
    } catch (error) {
        throw new Error('Download failed: ' + error.message);
    }
}

async function downloadZipFile(content, filename) {
    try {
        console.log('Starting zip file download:', filename);
        
        let blobUrl;
        
        if (content instanceof Blob) {
            console.log('Content is a Blob, size:', content.size);
            blobUrl = URL.createObjectURL(content);
        } else {
            console.log('Content is not a Blob, creating new Blob');
            const blob = new Blob([content], { type: 'application/zip' });
            blobUrl = URL.createObjectURL(blob);
        }
        
        console.log('Created blob URL:', blobUrl);
        
        const downloadId = await new Promise((resolve, reject) => {
            chrome.downloads.download({
                url: blobUrl,
                filename: filename,
                saveAs: true  
            }, (downloadId) => {
                console.log('Chrome downloads API response:', downloadId);
                if (chrome.runtime.lastError) {
                    console.error('Chrome downloads API error:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(downloadId);
                }
            });
        });
        
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 1000);
        
        return downloadId;
    } catch (error) {
        throw new Error('Download failed: ' + error.message);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({downloadState: null});
    chrome.alarms.create('checkDownloadState', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkDownloadState') {
        checkAndContinueDownload();
    }
});

async function checkAndContinueDownload() {
    const state = await new Promise(resolve => {
        chrome.storage.local.get(['downloadState'], result => {
            resolve(result.downloadState);
        });
    });
    
    if (state && state.inProgress) {
        const tabs = await chrome.tabs.query({url: "https://codeforces.com/*"});
        
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'continueDownload',
                state: state
            });
        }
    }
}