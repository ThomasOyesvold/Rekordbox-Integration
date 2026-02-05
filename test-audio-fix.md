# Audio Playback Fix Testing Guide

## Phase 1 Complete: Enhanced Debugging & Diagnostics

The following changes have been implemented:

### 1. Bridge API Extensions (electron/preload.cjs)
- ✅ `checkFileExists(filePath)` - Verify file existence
- ✅ `checkFileReadable(filePath)` - Check read permissions
- ✅ `resolveAudioPath(rawPath)` - Complete path resolution with verification

### 2. Main Process Handlers (electron/main.js)
- ✅ `file:exists` - File existence check
- ✅ `file:readable` - Permission check
- ✅ `audio:resolvePath` - Smart path resolver with:
  - Case-insensitive drive letter matching
  - Automatic Windows → WSL path conversion
  - Multiple path variation attempts

### 3. Renderer Enhancements (renderer/App.jsx)
- ✅ Enhanced `normalizeAudioLocation()` with debug logging
- ✅ Complete playback logging in `playTrack()`
- ✅ File verification before playback
- ✅ Detailed error messages with MediaError code mapping
- ✅ Comprehensive console logging with `[rbfa]` prefix

## How to Test

### 1. Start the Application
```bash
# Terminal 1: Dev server (already running)
npm run dev:renderer

# Terminal 2: Electron
npm run start:electron:safe
```

### 2. Load a Rekordbox XML File
1. Click "Browse XML" and select your rekordbox-export.xml
2. Click "Parse Library"
3. Wait for parsing to complete

### 3. Try Playing a Track
1. Select a track in the table
2. Click the "Play" button
3. Open DevTools Console (F12) to see detailed logs

### 4. What to Look For in Console

**Successful playback will show:**
```
[rbfa] playTrack START { trackId, title, rawLocation, ... }
[rbfa] normalizeAudioLocation START { rawLocation, platform, isWsl }
[rbfa] After initial cleaning { cleaned }
[rbfa] Mapped to WSL mount path { cleaned, driveLetter }
[rbfa] normalizeAudioLocation RESULT { fsPath, fileUrl }
[rbfa] File verification result { fsPath, exists: true, readable: true, error: null }
[rbfa] File verification passed { trackId, fsPath, exists, readable }
[rbfa] Setting audio src { trackId, fileUrl }
[rbfa] ensureAudio { trackId, rawLocation, normalizedSrc, hasExisting }
[rbfa] Attempting audio.play() { trackId, readyState, src }
[rbfa] audio.play() succeeded { trackId }
```

**Failed playback will show:**
- File not found error with exact path
- Permission denied error
- MediaError code with user-friendly message

### 5. Common Issues to Diagnose

**Issue: "File not found"**
- Check the `fsPath` in console logs
- Verify the path exists on your system
- Check if the XML has outdated paths

**Issue: "Permission denied"**
- Run: `ls -la /path/to/file` to check permissions
- Try: `chmod +r /path/to/file`

**Issue: "Audio source not found or not accessible" (MediaError code 4)**
- File exists but browser can't access it
- May need custom protocol handler (Phase 3)

### 6. Test with Different Path Formats

Test tracks with:
- ✅ Spaces in filename: `My Track Name.mp3`
- ✅ Special characters: `Track (2024) [Mix].mp3`
- ✅ Unicode: `Café — Track.mp3`
- ✅ Different drives: C:, D:, E:
- ✅ Deep paths: `C:/Users/Name/Music/Genre/Artist/Album/Track.mp3`

## Expected Path Transformations

### Example 1: Simple C: drive path
```
Input:  file://localhost/C:/Music/track.mp3
Output: file:///mnt/c/Music/track.mp3
fsPath: /mnt/c/Music/track.mp3
```

### Example 2: Path with spaces
```
Input:  file://localhost/C:/My Music/My Track.mp3
Output: file:///mnt/c/My%20Music/My%20Track.mp3
fsPath: /mnt/c/My Music/My Track.mp3
```

### Example 3: D: drive
```
Input:  file://localhost/D:/DJ/tracks/song.mp3
Output: file:///mnt/d/DJ/tracks/song.mp3
fsPath: /mnt/d/DJ/tracks/song.mp3
```

## Next Steps

If files are found and readable but playback still fails:
- Proceed to Phase 3: Custom Protocol Handler (`rbfa://`)
- This handles Electron/Chromium security restrictions

## Verification Checklist

- [ ] Dev server running on http://localhost:5173
- [ ] Electron app launches successfully
- [ ] XML file loads and parses
- [ ] Console shows `[rbfa]` debug logs
- [ ] File verification shows `exists: true, readable: true`
- [ ] Audio plays successfully OR shows specific error
- [ ] Waveform seeking works
- [ ] Play/pause toggles correctly
