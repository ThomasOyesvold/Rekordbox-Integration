#!/bin/bash

# Audio Fix Verification Script
# This script helps verify the audio playback fixes are working

echo "========================================"
echo "Audio Playback Fix Verification"
echo "========================================"
echo ""

# Check WSL environment
echo "1. Checking WSL environment..."
if [ -n "$WSL_DISTRO_NAME" ] || [ -n "$WSL_INTEROP" ]; then
    echo "   ✅ Running in WSL: $WSL_DISTRO_NAME"
else
    echo "   ⚠️  Not detected as WSL (may still work)"
fi
echo ""

# Check if music directory exists
echo "2. Checking music directory..."
if [ -d "/mnt/c/Users/Thoma/Music/Imported/Contents" ]; then
    echo "   ✅ Music directory exists"
    SAMPLE_COUNT=$(find "/mnt/c/Users/Thoma/Music/Imported/Contents" -name "*.mp3" | head -5 | wc -l)
    echo "   ✅ Found sample MP3 files: $SAMPLE_COUNT"
else
    echo "   ❌ Music directory not found"
    echo "      Expected: /mnt/c/Users/Thoma/Music/Imported/Contents"
fi
echo ""

# Check XML file
echo "3. Checking Rekordbox XML..."
if [ -f "/home/thomas/rekordbox_backup.xml" ]; then
    echo "   ✅ XML file exists: /home/thomas/rekordbox_backup.xml"
    TRACK_COUNT=$(grep -c '<TRACK ' /home/thomas/rekordbox_backup.xml)
    echo "   ✅ Contains approximately $TRACK_COUNT tracks"
else
    echo "   ❌ XML file not found"
fi
echo ""

# Check if Vite dev server is running
echo "4. Checking dev server..."
if pgrep -f "vite" > /dev/null; then
    echo "   ✅ Vite dev server is running"
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "   ✅ Dev server responding on http://localhost:5173"
    else
        echo "   ⚠️  Dev server running but not responding yet"
    fi
else
    echo "   ❌ Vite dev server not running"
    echo "      Run: npm run dev:renderer"
fi
echo ""

# Check modified files
echo "5. Checking modified source files..."
FILES_TO_CHECK=(
    "electron/preload.cjs"
    "electron/main.js"
    "renderer/App.jsx"
)

for FILE in "${FILES_TO_CHECK[@]}"; do
    if [ -f "/home/thomas/Rekordbox-Integration/$FILE" ]; then
        echo "   ✅ $FILE exists"
    else
        echo "   ❌ $FILE not found"
    fi
done
echo ""

# Check for new bridge methods
echo "6. Checking for new bridge API methods..."
if grep -q "checkFileExists" /home/thomas/Rekordbox-Integration/electron/preload.cjs; then
    echo "   ✅ checkFileExists found in preload.cjs"
else
    echo "   ❌ checkFileExists not found"
fi

if grep -q "resolveAudioPath" /home/thomas/Rekordbox-Integration/electron/preload.cjs; then
    echo "   ✅ resolveAudioPath found in preload.cjs"
else
    echo "   ❌ resolveAudioPath not found"
fi
echo ""

# Check for IPC handlers
echo "7. Checking for new IPC handlers..."
if grep -q "audio:resolvePath" /home/thomas/Rekordbox-Integration/electron/main.js; then
    echo "   ✅ audio:resolvePath handler found in main.js"
else
    echo "   ❌ audio:resolvePath handler not found"
fi
echo ""

# Sample path transformation test
echo "8. Sample path transformation test..."
SAMPLE_PATH="file://localhost/C:/Users/Thoma/Music/test.mp3"
echo "   Input:  $SAMPLE_PATH"
echo "   Expected WSL path: /mnt/c/Users/Thoma/Music/test.mp3"
echo "   Expected file URL: file:///mnt/c/Users/Thoma/Music/test.mp3"
echo ""

echo "========================================"
echo "Next Steps:"
echo "========================================"
echo ""
echo "1. If dev server is not running:"
echo "   npm run dev:renderer"
echo ""
echo "2. Start Electron (in a new terminal):"
echo "   npm run start:electron:safe"
echo ""
echo "3. In the app:"
echo "   - Click 'Browse XML' and select /home/thomas/rekordbox_backup.xml"
echo "   - Click 'Parse Library'"
echo "   - Open DevTools (F12)"
echo "   - Click Play on any track"
echo "   - Check console for [rbfa] logs"
echo ""
echo "4. Look for these log messages:"
echo "   [rbfa] File verification result { exists: true, readable: true }"
echo "   [rbfa] audio.play() succeeded"
echo ""

# Check if a sample file is actually accessible
echo "========================================"
echo "Quick File Access Test:"
echo "========================================"
SAMPLE_FILE="/mnt/c/Users/Thoma/Music/Imported/Contents/Nico & Vinz/EDM Playlist Vol. 23 __ September 2014/Nico & Vinz - Am I Wrong (CID Remix) - 5A - 126.mp3"
if [ -f "$SAMPLE_FILE" ]; then
    echo "✅ Sample file exists and is accessible:"
    echo "   $SAMPLE_FILE"
    ls -lh "$SAMPLE_FILE"
    echo ""
    echo "✅ This file should play successfully!"
else
    echo "⚠️  Sample file not found (paths may have changed)"
    echo "   Try any track from your library instead"
fi
echo ""
