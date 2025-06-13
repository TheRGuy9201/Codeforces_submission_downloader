document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('username');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusDiv = document.getElementById('status');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    chrome.storage.sync.get(['cfUsername'], function(result) {
        if (result.cfUsername) {
            usernameInput.value = result.cfUsername;
        }
    });
    
    chrome.runtime.sendMessage({action: 'checkDownloadState'}, function(state) {
        if (state && state.inProgress) {
            const percent = (state.progress / state.total) * 100;
            progressContainer.style.display = 'block';
            progressBar.style.width = percent + '%';
            showStatus(`Processing ${state.progress}/${state.total} submissions for ${state.username}...`, 'info');
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Downloading...';
        }
    });

    usernameInput.addEventListener('input', function() {
        chrome.storage.sync.set({cfUsername: usernameInput.value});
    });

    downloadBtn.addEventListener('click', async function() {
        const username = usernameInput.value.trim();
        
        if (!username) {
            showStatus('Please enter a username', 'error');
            return;
        }

        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';
        progressContainer.style.display = 'block';
        showStatus('Fetching submissions...', 'info');

        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            if (!tab.url.includes('codeforces.com')) {
                showStatus('Please navigate to codeforces.com first', 'error');
                resetButton();
                return;
            }

            chrome.tabs.sendMessage(tab.id, {
                action: 'downloadSubmissions',
                username: username
            }, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: Please refresh the Codeforces page and try again', 'error');
                    resetButton();
                    return;
                }

                if (response && response.success) {
                    showStatus(`Successfully downloaded ${response.count} submissions!`, 'success');
                } else {
                    showStatus(response ? response.error : 'Unknown error occurred', 'error');
                }
                resetButton();
            });

        } catch (error) {
            showStatus('Error: ' + error.message, 'error');
            resetButton();
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
    }

    function resetButton() {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download All Submissions';
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        }
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateProgress') {
            const percent = (request.current / request.total) * 100;
            progressBar.style.width = percent + '%';
            showStatus(`Processing ${request.current}/${request.total} submissions...`, 'info');
        }
        else if (request.action === 'notifyComplete') {
            if (request.result && request.result.success) {
                showStatus(`Successfully downloaded ${request.result.count} submissions!`, 'success');
            } else {
                showStatus(request.result ? request.result.error : 'Unknown error occurred', 'error');
            }
            resetButton();
        }
    });
});