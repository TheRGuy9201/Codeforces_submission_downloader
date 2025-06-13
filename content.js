/**
 * Codeforces Submission Downloader - Content Script
 * 
 * This script runs on Codeforces pages and handles:
 * - Downloading submissions for a specified username
 * - Packaging them into a ZIP file
 * - Background processing
 */

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'downloadSubmissions') {
        downloadAllSubmissions(request.username)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    }
    else if (request.action === 'continueDownload') {
        const state = request.state;
        if (state && state.inProgress) {
            console.log('Continuing download for:', state.username);
            downloadAllSubmissions(state.username)
                .then(result => {
                    chrome.runtime.sendMessage({
                        action: 'notifyComplete',
                        result: result
                    });
                })
                .catch(error => console.error('Error continuing download:', error));
        }
    }
});

async function downloadAllSubmissions(username) {
    try {
        console.log('Starting submission download for:', username);
        
        await chrome.storage.local.set({
            downloadState: {
                inProgress: true,
                username: username,
                progress: 0,
                total: 0
            }
        });
        
        const submissions = await fetchAllSubmissions(username);
        
        if (submissions.length === 0) {
            await chrome.storage.local.set({downloadState: null});
            return {success: false, error: 'No submissions found for this user'};
        }

        const uniqueSubmissions = getUniqueAcceptedSubmissions(submissions);
        
        const zip = new JSZip();
        const folder = zip.folder(`CF_${username}`);
        
        let downloadCount = 0;
        const totalCount = uniqueSubmissions.length;
        
        await chrome.storage.local.set({
            downloadState: {
                inProgress: true,
                username: username,
                progress: 0,
                total: totalCount
            }
        });
        
        for (let i = 0; i < uniqueSubmissions.length; i++) {
            const submission = uniqueSubmissions[i];
            chrome.runtime.sendMessage({
                action: 'updateProgress',
                current: i + 1,
                total: totalCount
            });
            
            await chrome.storage.local.set({
                downloadState: {
                    inProgress: true,
                    username: username,
                    progress: i + 1,
                    total: totalCount
                }
            });
            
            try {
                const sourceCode = await getSubmissionSourceCode(submission);
                
                const contestId = submission.contestId || submission.problem.contestId;
                const problemIndex = submission.problem.index;
                const problemName = submission.problem.name.replace(/[^a-zA-Z0-9]/g, '_');
                const filename = `${contestId}_${problemIndex}_${problemName}.${sourceCode.extension}`;
                console.log(`Adding file to zip: ${filename}, code length: ${sourceCode.sourceCode.length}`);
                folder.file(filename, sourceCode.sourceCode);
                console.log(`Successfully added file to zip: ${filename}`);
                
                downloadCount++;
            } catch (error) {
                console.error('Failed to download submission:', submission.id, error);
            }
            
            await sleep(500);
        }    
        console.log('Generating zip file...');
        console.log('Generating zip file...');
        
        try {
            const zipContent = await zip.generateAsync({type: 'blob'});
            console.log('Zip file generated, size:', zipContent.size);

            try {
                const blobUrl = URL.createObjectURL(zipContent);
                console.log('Created blob URL:', blobUrl);
                
                const downloadId = await new Promise((resolve, reject) => {
                    chrome.downloads.download({
                        url: blobUrl,
                        filename: `CF_${username}_submissions.zip`,
                        saveAs: true
                    }, (downloadId) => {
                        console.log('Download started, ID:', downloadId);
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
                  console.log('Download successful with Method 1');
            } catch (method1Error) {
                console.error('Method 1 failed:', method1Error);
                
                console.log('Trying Method 2: Direct download');
                const directResult = await directDownloadZip(zip, `CF_${username}_submissions.zip`);
                
                if (!directResult) {
                    console.error('Method 2 failed, trying Method 3');
                    
                    await new Promise((resolve) => {
                        chrome.runtime.sendMessage({
                            action: 'testZipDownload'
                        }, (response) => {
                            console.log('Test download response:', response);
                            resolve(response);
                        });
                    });
                }
            }
        } catch (zipError) {
            console.error('Error creating zip:', zipError);
        }
        
        await chrome.storage.local.set({downloadState: null});
        
        await chrome.storage.local.set({downloadState: null});
        
        return {
            success: true, 
            count: downloadCount,
            total: totalCount
        };

    } catch (error) {
        console.error('Error in downloadAllSubmissions:', error);
        await chrome.storage.local.set({downloadState: null});
        return {success: false, error: error.message};
    }
}

async function fetchAllSubmissions(username) {
    const allSubmissions = [];
    let from = 1;
    const count = 10000;
    
    try {
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${username}&from=${from}&count=${count}`);
        const data = await response.json();
        
        if (data.status !== 'OK') {
            throw new Error(data.comment || 'Failed to fetch submissions from Codeforces API');
        }
        
        return data.result || [];
    } catch (error) {
        throw new Error('Failed to fetch submissions: ' + error.message);
    }
}

function getUniqueAcceptedSubmissions(submissions) {
    const problemMap = new Map();
    
    submissions
        .filter(sub => sub.verdict === 'OK')
        .forEach(sub => {
            const problemKey = `${sub.problem.contestId}-${sub.problem.index}`;
            const existing = problemMap.get(problemKey);
            
            if (!existing || sub.creationTimeSeconds > existing.creationTimeSeconds) {
                problemMap.set(problemKey, sub);
            }
        });
    
    return Array.from(problemMap.values());
}

function getFileExtension(programmingLanguage) {
    const lang = programmingLanguage.toLowerCase();
    
    if (lang.includes('c++') || lang.includes('cpp')) return 'cpp';
    if (lang.includes('c#')) return 'cs';
    if (lang.includes('java')) return 'java';
    if (lang.includes('python')) return 'py';
    if (lang.includes('javascript')) return 'js';
    if (lang.includes('kotlin')) return 'kt';
    if (lang.includes('rust')) return 'rs';
    if (lang.includes('go')) return 'go';
    if (lang.includes('ruby')) return 'rb';
    if (lang.includes('php')) return 'php';
    if (lang.includes('pascal')) return 'pas';
    if (lang.includes('perl')) return 'pl';
    if (lang.includes('scala')) return 'scala';
    if (lang.includes('haskell')) return 'hs';
    if (lang.includes('c ') || lang.includes('gcc')) return 'c';
    
    return 'txt';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function directDownloadZip(zip, filename) {
  try {
    console.log('Trying direct download');
    
    const content = await zip.generateAsync({type: 'blob'});
    console.log('Generated zip blob:', content.size, 'bytes');
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = filename;
    
    document.body.appendChild(a);
    console.log('Clicking download link');
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('Direct download error:', error);
    return false;
  }
}