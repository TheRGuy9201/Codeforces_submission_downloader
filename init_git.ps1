# PowerShell script to initialize git repository

# Check if git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

# Initialize git repository if .git folder doesn't exist
if (!(Test-Path -Path .\.git)) {
    Write-Host "Initializing git repository..." -ForegroundColor Green
    git init
}

# Set up remote if not already set
$remotes = git remote
if ($remotes -notcontains "origin") {
    Write-Host "Please enter your GitHub repository URL (e.g., https://github.com/yourusername/codeforces-submission-downloader.git):" -ForegroundColor Yellow
    $repoUrl = Read-Host
    
    if ($repoUrl) {
        git remote add origin $repoUrl
        Write-Host "Remote 'origin' added successfully." -ForegroundColor Green
    } else {
        Write-Host "No repository URL provided. You can add it later with 'git remote add origin YOUR_REPO_URL'" -ForegroundColor Yellow
    }
}

# Initial commit if no commits exist
$commitCount = git rev-list --count HEAD 2>$null
if (!$commitCount) {
    git add .
    git commit -m "Initial commit: Codeforces Submission Downloader extension"
    Write-Host "Initial commit created." -ForegroundColor Green
} else {
    Write-Host "Repository already has commits. No initial commit created." -ForegroundColor Yellow
}

Write-Host "`nRepository is ready. You can now push to GitHub with:" -ForegroundColor Green
Write-Host "git push -u origin main" -ForegroundColor Cyan
