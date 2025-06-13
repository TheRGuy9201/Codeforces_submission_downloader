#!/bin/bash

# Script to package the Codeforces Submission Downloader extension

# Create a clean build directory
echo "Creating build directory..."
rm -rf ./build
mkdir -p ./build

# Copy extension files
echo "Copying extension files..."
cp manifest.json ./build/
cp *.js ./build/
cp *.html ./build/
cp *.svg ./build/
cp LICENSE ./build/
cp README.md ./build/

# Create ZIP archive
echo "Creating ZIP archive..."
cd ./build
zip -r ../codeforces-submission-downloader.zip *
cd ..

echo "Build complete: codeforces-submission-downloader.zip"
