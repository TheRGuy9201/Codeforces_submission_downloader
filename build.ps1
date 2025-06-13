# PowerShell script to package the Codeforces Submission Downloader extension

# Create a clean build directory
Write-Host "Creating build directory..." -ForegroundColor Green
if (Test-Path -Path .\build) {
    Remove-Item -Path .\build -Recurse -Force
}
New-Item -ItemType Directory -Path .\build | Out-Null

# Copy extension files
Write-Host "Copying extension files..." -ForegroundColor Green
Copy-Item -Path manifest.json -Destination .\build\
Copy-Item -Path *.js -Destination .\build\
Copy-Item -Path *.html -Destination .\build\
Copy-Item -Path *.svg -Destination .\build\
Copy-Item -Path LICENSE -Destination .\build\
Copy-Item -Path README.md -Destination .\build\

# Create ZIP archive
Write-Host "Creating ZIP archive..." -ForegroundColor Green
Compress-Archive -Path .\build\* -DestinationPath .\codeforces-submission-downloader.zip -Force

Write-Host "Build complete: codeforces-submission-downloader.zip" -ForegroundColor Green
