async function getSubmissionSourceCode(submission) {
    try {
        const submissionUrl = `https://codeforces.com/contest/${submission.contestId}/submission/${submission.id}`;
        const response = await fetch(submissionUrl);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const codeElement = doc.querySelector('#program-source-text');
        if (!codeElement) {
            throw new Error('Could not find source code in submission page');
        }
        
        const sourceCode = codeElement.textContent || codeElement.innerText;
        
        const extension = getFileExtension(submission.programmingLanguage);
        
        return {
            sourceCode,
            extension
        };
    } catch (error) {
        throw new Error(`Failed to get submission ${submission.id}: ${error.message}`);
    }
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
