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
        
        let downloadCount = 0;        const totalCount = uniqueSubmissions.length;
        console.log(`Beginning download of ${totalCount} unique accepted submissions`);
        
        // Track failures separately for reporting
        const failures = [];
        const retryQueue = [];
        
        await chrome.storage.local.set({
            downloadState: {
                inProgress: true,
                username: username,
                progress: 0,
                total: totalCount
            }
        });
        
        // First pass - try to download all submissions
        for (let i = 0; i < uniqueSubmissions.length; i++) {
            const submission = uniqueSubmissions[i];
            const submissionId = submission.id;
            
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
                console.log(`Downloading submission ${submissionId} (${i+1}/${totalCount})`);
                const sourceCode = await getSubmissionSourceCode(submission);
                
                if (!sourceCode || !sourceCode.sourceCode) {
                    console.warn(`Empty source code for submission ${submissionId}, adding to retry queue`);
                    retryQueue.push(submission);
                    continue;
                }
                
                const contestId = submission.contestId || submission.problem.contestId;
                const problemIndex = submission.problem.index;
                const problemName = submission.problem.name.replace(/[^a-zA-Z0-9]/g, '_');
                const filename = `${contestId}_${problemIndex}_${problemName}.${sourceCode.extension}`;
                
                console.log(`Adding file to zip: ${filename}, code length: ${sourceCode.sourceCode.length}`);
                folder.file(filename, sourceCode.sourceCode);
                console.log(`Successfully added file to zip: ${filename}`);
                
                downloadCount++;
            } catch (error) {
                console.error(`Failed to download submission ${submissionId}:`, error);
                retryQueue.push(submission);
                failures.push({
                    id: submissionId,
                    error: error.message
                });
            }
            
            await sleep(500);
        }
        
        // Second pass - retry failed submissions with a different approach
        if (retryQueue.length > 0) {
            console.log(`Retrying ${retryQueue.length} failed submissions with alternate method...`);
            
            for (let j = 0; j < retryQueue.length; j++) {
                const submission = retryQueue[j];
                const submissionId = submission.id;
                
                try {
                    console.log(`Retry attempt for submission ${submissionId} (${j+1}/${retryQueue.length})`);
                    
                    // Try alternative URL format for gym submissions
                    const altSubmissionUrl = submission.contestId >= 100000 
                        ? `https://codeforces.com/gym/${submission.contestId}/submission/${submissionId}`
                        : `https://codeforces.com/contest/${submission.contestId}/submission/${submissionId}`;
                    
                    console.log(`Using alternative URL: ${altSubmissionUrl}`);
                    
                    // Make a direct fetch request
                    const response = await fetch(altSubmissionUrl);
                    if (!response.ok) {
                        throw new Error(`Failed with status ${response.status}`);
                    }
                    
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    const codeElement = doc.querySelector('#program-source-text');
                    if (!codeElement) {
                        throw new Error('Could not find source code element');
                    }
                    
                    const sourceCode = codeElement.textContent || codeElement.innerText;
                    if (!sourceCode) {
                        throw new Error('Empty source code');
                    }
                    
                    const extension = submission.programmingLanguage 
                        ? getFileExtension(submission.programmingLanguage) 
                        : 'txt';
                    
                    const contestId = submission.contestId || submission.problem.contestId;
                    const problemIndex = submission.problem.index;
                    const problemName = submission.problem.name.replace(/[^a-zA-Z0-9]/g, '_');
                    const filename = `${contestId}_${problemIndex}_${problemName}.${extension}`;
                    
                    console.log(`Retry: Adding file to zip: ${filename}, code length: ${sourceCode.length}`);
                    folder.file(filename, sourceCode);
                    console.log(`Successfully added file to zip from retry: ${filename}`);
                    
                    downloadCount++;
                    
                    // Remove from failures if successful
                    const failureIndex = failures.findIndex(f => f.id === submissionId);
                    if (failureIndex !== -1) {
                        failures.splice(failureIndex, 1);
                    }
                } catch (retryError) {
                    console.error(`Retry failed for submission ${submissionId}:`, retryError);
                    // Update failure reason if it exists
                    const failureEntry = failures.find(f => f.id === submissionId);
                    if (failureEntry) {
                        failureEntry.error += `. Retry failed: ${retryError.message}`;
                    } else {
                        failures.push({
                            id: submissionId,
                            error: `Retry failed: ${retryError.message}`
                        });
                    }
                }
                
                await sleep(800); // Slightly longer delay for retries
            }
        }
          console.log(`Download summary: ${downloadCount} successful out of ${totalCount} unique submissions`);
        if (failures.length > 0) {
            console.warn(`${failures.length} submissions failed to download:`, failures);
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
    
    try {
        // First approach: Try to get all submissions with a single large request
        console.log(`Fetching all submissions for ${username} with a single request...`);
        const from = 1;
        const count = 10000; // Using a large count value to get as many submissions as possible in one call
        
        // Add a timestamp to prevent caching issues
        const timestamp = new Date().getTime();
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${username}&from=${from}&count=${count}&_=${timestamp}`);
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'OK') {
            throw new Error(data.comment || 'Failed to fetch submissions from Codeforces API');
        }
        
        const submissions = data.result || [];
        console.log(`Fetched ${submissions.length} submissions in single request`);
        
        // Log some diagnostics about the types of submissions
        const acceptedCount = submissions.filter(sub => sub.verdict === 'OK').length;
        console.log(`Accepted submissions: ${acceptedCount}`);
        
        // Count submission types
        const gymCount = submissions.filter(sub => 
            (typeof sub.contestId === 'number' && sub.contestId >= 100000)
        ).length;
        console.log(`Gym submissions: ${gymCount}`);
        
        // If we got a significant number of submissions but less than the max, 
        // assume we got all of them
        if (submissions.length > 0 && submissions.length < count) {
            console.log(`Total submissions fetched in single request: ${submissions.length}`);
            return submissions;
        }
        
        // If we got exactly 'count' submissions, there might be more
        // Let's switch to pagination approach to be safe
        if (submissions.length === count) {
            console.log(`Got exactly ${count} submissions, there might be more. Switching to pagination...`);
            
            allSubmissions.push(...submissions);
            
            // Start pagination from where we left off
            let currentFrom = from + count;
            const pageSize = 1000; // Smaller page size for pagination
            let hasMore = true;
            
            // Continue fetching with pagination
            while (hasMore) {
                console.log(`Fetching more submissions from=${currentFrom}, count=${pageSize}`);
                
                try {
                    const pageResponse = await fetch(`https://codeforces.com/api/user.status?handle=${username}&from=${currentFrom}&count=${pageSize}`);
                    const pageData = await pageResponse.json();
                    
                    if (pageData.status !== 'OK') {
                        console.error(`API error: ${pageData.comment || 'Unknown error'}`);
                        break;
                    }
                    
                    const pageSubmissions = pageData.result || [];
                    console.log(`Fetched ${pageSubmissions.length} additional submissions`);
                    
                    if (pageSubmissions.length === 0) {
                        hasMore = false;
                    } else {
                        allSubmissions.push(...pageSubmissions);
                        
                        if (pageSubmissions.length < pageSize) {
                            hasMore = false;
                        } else {
                            currentFrom += pageSize;
                            // Add a small delay to avoid hitting rate limits
                            await sleep(1000);
                        }
                    }
                } catch (pageError) {
                    console.error('Error during pagination:', pageError);
                    hasMore = false;
                }
            }
            
            console.log(`Total submissions fetched with pagination: ${allSubmissions.length}`);
            return allSubmissions;
        }
        
        // If first approach didn't indicate more results, return what we got
        return submissions;
        
    } catch (error) {
        console.error('Error fetching submissions:', error);
        throw new Error('Failed to fetch submissions: ' + error.message);
    }
}

function getUniqueAcceptedSubmissions(submissions) {
    // First count the total number of submissions for reporting
    console.log(`Processing ${submissions.length} total submissions`);
    
    const verdictCounts = {};
    submissions.forEach(sub => {
        const verdict = sub.verdict || 'UNKNOWN';
        verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
    });
    console.log('Submission verdict counts:', verdictCounts);
    
    // First filter to find all accepted submissions
    const acceptedSubmissions = submissions.filter(sub => sub.verdict === 'OK');
    const acceptedCount = acceptedSubmissions.length;
    console.log(`Total accepted submissions found: ${acceptedCount}`);
    
    // Count how many problems we have by unique problem ID
    const problemMap = new Map();
    const problemSet = new Set();
    
    // Then map each unique problem to its latest submission
    acceptedSubmissions.forEach(sub => {
        if (!sub.problem) {
            console.warn(`Submission ${sub.id} is missing problem information`);
            return;
        }
        
        // Handle cases where contestId might be in different places
        const contestId = sub.problem.contestId || sub.contestId;
        
        // Skip if we can't identify the problem
        if (!contestId || !sub.problem.index) {
            console.warn(`Submission ${sub.id} has incomplete problem information:`, 
                        `contestId=${contestId}, index=${sub.problem.index}`);
            return;
        }
        
        // Create a unique key for each problem
        const problemKey = `${contestId}-${sub.problem.index}`;
        problemSet.add(problemKey);
        
        console.log(`Processing submission ID ${sub.id} for problem ${problemKey}`);
        
        const existing = problemMap.get(problemKey);
        
        // Keep the most recent submission for each problem
        if (!existing || sub.creationTimeSeconds > existing.creationTimeSeconds) {
            problemMap.set(problemKey, sub);
        }
    });
    
    const uniqueSubmissions = Array.from(problemMap.values());
    console.log(`Found ${acceptedCount} total accepted submissions across ${problemSet.size} unique problems`);
    console.log(`Selected ${uniqueSubmissions.length} submissions for download (latest per problem)`);
    
    if (uniqueSubmissions.length < problemSet.size) {
        console.warn(`Warning: Selected fewer submissions (${uniqueSubmissions.length}) than unique problems (${problemSet.size})`);
    }
    
    // Safety check - ensure we don't have undefined or invalid entries
    const validSubmissions = uniqueSubmissions.filter(sub => {
        if (!sub || !sub.id || !sub.problem || !sub.contestId) {
            console.warn('Filtered out invalid submission:', sub);
            return false;
        }
        return true;
    });
    
    if (validSubmissions.length < uniqueSubmissions.length) {
        console.warn(`Filtered out ${uniqueSubmissions.length - validSubmissions.length} invalid submissions`);
    }
    
    return validSubmissions;
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