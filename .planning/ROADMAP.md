# Roadmap: Rekordbox Flow Analyzer

## Overview

This roadmap transforms a 12,000+ track DJ library from overwhelming chaos into intelligently organized playlists through multi-factor flow analysis. Six phases build from foundation (XML parsing, data persistence) through analysis engine (BPM, key, waveform, rhythm) to playlist generation, verification workflow, and M3U export. Each phase addresses specific pitfalls identified in research: Rekordbox XML bugs, false positive explosion, memory leaks, and UI blocking. The tool maintains DJ creative control through approve/reject workflow while reducing set preparation time from hours to minutes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Data Layer** - Parse Rekordbox XML, establish persistence, enable folder selection
- [ ] **Phase 2: Analysis Engine & Caching** - Multi-factor similarity analysis with aggressive caching
- [ ] **Phase 3: Playlist Generation** - Cluster tracks and optimize flow for cohesive playlists
- [ ] **Phase 4: Verification Workflow & Playback** - Visualize waveforms and sample audio for verification
- [ ] **Phase 5: Approval & User Control** - Approve/reject workflow with transparent explanations
- [ ] **Phase 6: Export & Integration** - Export approved playlists as M3U files for DJ software

## Phase Details

### Phase 1: Foundation & Data Layer
**Goal**: User can load Rekordbox library, select folders to analyze, and see parsed tracks without UI freezing during long operations
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):
  1. User can import Rekordbox XML library file and see success/error feedback with specific validation messages
  2. User can select specific folders from library hierarchy (not forced to analyze all 12K tracks at once)
  3. User can view parsed track list showing artist, title, BPM, key, and other metadata in responsive UI
  4. Application persists state across sessions (selected folders, imported library path remembered)
  5. Long operations (XML parsing, folder loading) run in background with detailed progress feedback and never freeze the UI
**Plans**:

Plans:
- [x] Build Electron shell + React renderer with secure preload bridge
- [x] Parse Rekordbox XML in background worker with progress events
- [x] Implement folder-tree filtering and track table inspection
- [x] Persist app state and import history (JSON + SQLite)
- [x] Add structured validation issue reporting
- [x] Complete manual QA checklist items (dialog behavior, folder-scope reparse confirmation)

### Phase 2: Analysis Engine & Caching
**Goal**: System can compute multi-factor similarity scores between tracks and cache results to avoid reprocessing 12K+ track libraries
**Depends on**: Phase 1
**Requirements**: ANLY-01, ANLY-02, ANLY-03, ANLY-04, ANLY-05, ANLY-06, ANLY-07, ANLY-08, ANLY-09, ANLY-10, ANLY-11
**Success Criteria** (what must be TRUE):
  1. System extracts BPM, key, and waveform RGB data from Rekordbox XML (uses pre-analyzed Rekordbox data, no re-analysis)
  2. System computes BPM similarity (compatible mixing ranges), key compatibility (Camelot Wheel harmonic mixing), waveform pattern similarity (energy curves), and rhythm pattern similarity (kick patterns)
  3. System combines all analyzers with equal weighting into multi-factor flow score for any track pair
  4. System persists similarity scores in SQLite cache and checks cache before computing new scores (cache-first strategy)
  5. System processes large libraries (12K+ tracks) in batches with memory management (no crashes, no memory leaks)
**Plans**:

Plans:
- [x] Implement baseline multi-factor scoring (BPM, key, waveform proxy, rhythm proxy)
- [x] Persist similarity cache and analysis runs in SQLite
- [x] Add analysis results UI table with score components and reasons
- [x] Add CSV/JSON analysis export
- [x] Replace placeholder waveform/rhythm proxies with full Rekordbox waveform data extraction
- [x] Add batch/memory safeguards and long-run stress tests for 12K+ libraries

### Phase 3: Playlist Generation
**Goal**: System generates multiple cohesive playlist suggestions from analyzed tracks with confidence scoring and transparent reasoning
**Depends on**: Phase 2
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06
**Success Criteria** (what must be TRUE):
  1. System clusters similar tracks into playlist groups using conservative similarity thresholds (prefers false negatives over false positives)
  2. System orders tracks within each playlist for smooth flow (optimized transitions based on BPM, key, energy)
  3. System generates multiple playlist suggestions from analyzed folders (not just one)
  4. Each suggested playlist shows confidence score indicating grouping quality
  5. User can search "find tracks like this one" for any track and see similarity-ranked results
**Plans**: TBD

Plans:
- [x] Phase 3 planning docs created (`.planning/phases/03-playlist-generation`)
- [x] Implement 03-01 playlist generation foundations
- [x] Implement 03-02 flow ordering + confidence model
- [x] Implement 03-03 playlist suggestion UI
- [x] Implement 03-04 conservative clustering presets + tuning

### Phase 4: Verification Workflow & Playback
**Goal**: User can visually and aurally verify suggested playlists through waveform visualization and random sampling playback before approval
**Depends on**: Phase 3
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04
**Success Criteria** (what must be TRUE):
  1. User can view suggested playlists with complete track lists showing all metadata
  2. User can see waveform visualizations for tracks in suggested playlist (RGB energy patterns)
  3. User can play random sampling (10-20 random tracks) from any suggested playlist to verify vibe without listening to all tracks
  4. Audio playback supports common DJ formats (MP3, FLAC, WAV, AAC) with responsive controls
  5. Audio playback works on WSL development environment with proper path mapping (C:/ → /mnt/c/)
  6. File verification shows clear error messages (file not found, permission denied, format unsupported)
**Plans**: TBD

Plans:
- [x] Fix WSL playback path mapping with comprehensive debugging (2026-02-05)
  - Added bridge API methods: checkFileExists, checkFileReadable, resolveAudioPath
  - Enhanced normalizeAudioLocation with debug logging and platform detection
  - Added pre-playback file verification with detailed error messages
  - Implemented case-insensitive drive letter fallback for WSL
  - Added MediaError code mapping for user-friendly error messages
  - Documented in: AUDIO_FIX_IMPLEMENTATION.md, IMPLEMENTATION_COMPLETE.md
- [x] Stabilize playback when rapidly switching tracks (2026-02-05)
  - Added play request guards to prevent stale async play attempts
  - Stopped overlapping playback when switching tracks quickly
  - Added volume control + test tone for verifying audio output
- [x] UI verification polish (2026-02-08)
  - Added Now Playing strip in Quick Preview with timer, BPM/key
  - Added similar-track waveform playhead + seekable large waveform
  - Moved volume controls to Quick Preview header; default volume 50%
- [ ] TBD (remaining verification workflow features planned during phase planning)

### Phase 06: Seamless Library Loading
**Goal**: App restores parsed library instantly on launch; waveforms load automatically without any manual mapping steps
**Depends on**: Phase 4 (ANLZ waveform extraction already works; SQLite infrastructure exists)
**Requirements**: LOAD-01, LOAD-02, LOAD-03, LOAD-04
**Success Criteria** (what must be TRUE):
  1. App opens with library already loaded — no re-parse required on subsequent launches
  2. User clicks "Refresh Library" to re-parse only when they've added new Rekordbox tracks
  3. Stale indicator shows clearly when XML file has changed since last parse
  4. USBANLZ folder auto-detected on first launch from standard Rekordbox install paths (Windows/WSL/macOS)
  5. Waveforms build automatically during parse — no "Build ANLZ Map" button, no user-visible JSON files
  6. Subsequent parses are fast — cached mapping and SQLite waveform cache used automatically

Plans:
- [ ] 06-01: Library state persistence (SQLite cache, load on mount, Refresh Library)
- [ ] 06-02: ANLZ seamless integration (auto-detect, integrated build, remove manual button)
- [ ] 06-03: SetupWizard ANLZ section, AppHeader refresh controls, three-stage parse progress

---

### Phase 5: Approval & User Control
**Goal**: User can approve or reject suggested playlists with meaningful names and understand why tracks were grouped together
**Depends on**: Phase 4
**Requirements**: WORK-05, WORK-06, WORK-07, WORK-08
**Success Criteria** (what must be TRUE):
  1. User can approve or reject each suggested playlist independently
  2. User can name approved playlists based on perceived vibe (e.g., "Deep Techno 125-128", "Melodic Progressive")
  3. User can see transparent explanations for why tracks were grouped (BPM range, key compatibility, waveform similarity scores)
  4. When analyzing new folders, system suggests additions to existing saved playlists (incremental analysis, not full re-analysis)
**Plans**: TBD

Plans:
- [ ] TBD (planned during phase planning)

### Phase 6: Export & Integration
**Goal**: User can export approved playlists as M3U files that load correctly in Rekordbox and other DJ software
**Depends on**: Phase 5
**Requirements**: EXPO-01, EXPO-02, EXPO-03, EXPO-04, EXPO-05
**Success Criteria** (what must be TRUE):
  1. User can export approved playlists as M3U files with relative or absolute file path options
  2. M3U exports handle special characters in file paths correctly (cross-platform compatibility)
  3. Approved playlists persist in SQLite across sessions (user can view saved playlists anytime)
  4. User can re-export or view details of previously saved playlists
  5. Exported M3U files load correctly in Rekordbox, Serato, and Traktor without errors
**Plans**: TBD

Plans:
- [ ] TBD (planned during phase planning)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Data Layer | 6/6 | Completed | Background parse, folder filter, persistence, validation UI, table UX |
| 2. Analysis Engine & Caching | 5/6 | In progress | Baseline analyzer, SQLite cache, export, analysis UI |
| 3. Playlist Generation | 0/TBD | Not started | - |
| 4. Verification Workflow & Playback | 2/TBD | Partial | WSL audio playback fixed + rapid switching guard |
| 06. Seamless Library Loading | 0/3 | Not started | Library persistence + ANLZ auto-detect planned |
| 5. Approval & User Control | 0/TBD | Not started | - |
| 6. Export & Integration | 0/TBD | Not started | - |

---

## Production Packaging & Distribution Strategy

### Overview

This section outlines the roadmap for converting the current WSL development environment into production-ready Windows .exe builds. The audio playback fixes implemented for WSL development need architectural adaptation for packaged Electron apps.

### Phase 7: Windows Production Build

**Goal**: Package application as signed Windows .exe installer with automatic updates and proper production path handling

**Depends on**: Phase 6 (all features complete)

**Key Challenges**:
1. **Path Resolution Differences**: Dev uses `file://` protocol freely; production has stricter security
2. **ASAR Packaging**: Application code is packaged in .asar archive; affects resource loading
3. **User Data Location**: SQLite and state files must use `app.getPath('userData')` not relative paths
4. **Code Signing**: Windows requires signed executables for SmartScreen trust
5. **Auto-Updates**: Need update server and differential update mechanism
6. **File Protocol Security**: Packaged apps have different `file://` access rules

**Success Criteria**:
1. Application builds as Windows .exe installer (NSIS format)
2. Audio playback works in production with Windows paths (C:\Users\...)
3. SQLite database and state files persist in correct user data directory
4. Application is code-signed and passes Windows SmartScreen
5. Auto-update mechanism downloads and installs updates automatically
6. Uninstaller cleanly removes all files except user data (optional preservation)
7. Application works offline after installation (no internet required for core features)

---

### Implementation Plan: Production Build System

#### Step 1: Add Electron Builder

**Package Installation**:
```json
// package.json additions
{
  "devDependencies": {
    "electron-builder": "^24.13.3"
  },
  "build": {
    "appId": "com.rekordbox-flow-analyzer.app",
    "productName": "Rekordbox Flow Analyzer",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "src/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "resources",
        "to": "resources",
        "filter": ["**/*"]
      }
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico",
      "requestedExecutionLevel": "asInvoker",
      "certificateFile": "certs/cert.pfx",
      "certificatePassword": "${WINDOWS_CERT_PASSWORD}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Rekordbox Flow Analyzer"
    },
    "publish": {
      "provider": "github",
      "owner": "yourusername",
      "repo": "rekordbox-flow-analyzer",
      "private": true
    }
  }
}
```

**New Scripts**:
```json
{
  "scripts": {
    "build:win": "npm run build:renderer && electron-builder --win",
    "build:win:portable": "npm run build:renderer && electron-builder --win portable",
    "publish:win": "npm run build:renderer && electron-builder --win --publish always"
  }
}
```

**Files to Create**:
- `build/icon.ico` - Application icon (256x256px)
- `build/icon.png` - macOS icon (512x512px) if expanding later
- `resources/` - Static resources directory

---

#### Step 2: Adapt Path Resolution for Production

**Problem**: Current WSL-focused path resolution assumes `/mnt/c/` paths. Windows production builds use `C:\` paths directly.

**Solution**: Platform-aware path resolution with production/dev detection

**Changes to `electron/main.js`**:

```javascript
import { app } from 'electron';

// Detect if running in packaged app
const isProduction = app.isPackaged;
const isDev = !isProduction;

// Add environment detection utility
function getPlatformInfo() {
  return {
    platform: process.platform,
    isWsl: Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP),
    isProduction,
    isDev,
    userDataPath: app.getPath('userData'),
    appPath: app.getAppPath()
  };
}

// Update audio:resolvePath handler
ipcMain.handle('audio:resolvePath', async (_event, rawPath) => {
  if (!rawPath) {
    return { fsPath: '', exists: false, readable: false, error: 'Empty path' };
  }

  try {
    let fsPath = String(rawPath);
    const platformInfo = getPlatformInfo();

    // Strip file:// protocol
    fsPath = fsPath
      .replace(/^file:\/\/localhost\//i, '/')
      .replace(/^file:\/\//i, '')
      .replace(/^localhost\//i, '/');

    // Platform-specific path handling
    if (platformInfo.platform === 'win32') {
      // Windows production: paths are already correct (C:\Users\...)
      // Remove leading slash if present: /C:/ -> C:/
      if (/^\/[A-Za-z]:\//.test(fsPath)) {
        fsPath = fsPath.slice(1);
      }

      // Normalize to Windows backslashes for consistency
      fsPath = fsPath.replace(/\//g, '\\');

    } else if (platformInfo.isWsl || platformInfo.platform === 'linux') {
      // WSL/Linux development: convert Windows paths to /mnt/
      fsPath = fsPath.replace(/\\/g, '/');

      if (/^\/[A-Za-z]:\//.test(fsPath)) {
        fsPath = fsPath.slice(1);
      }

      if (/^[A-Za-z]:\//.test(fsPath)) {
        const driveLetter = fsPath[0].toLowerCase();
        const rest = fsPath.slice(2);
        fsPath = `/mnt/${driveLetter}${rest}`;
      }
    }

    // Decode URI encoding
    try {
      fsPath = decodeURIComponent(fsPath);
    } catch {
      // Keep raw value if not valid URI encoding
    }

    // Try multiple path variations
    const checkPath = (pathToCheck) => {
      if (!pathToCheck || !fsSync.existsSync(pathToCheck)) {
        return null;
      }

      let readable = false;
      try {
        fsSync.accessSync(pathToCheck, fsSync.constants.R_OK);
        readable = true;
      } catch {
        readable = false;
      }

      return {
        fsPath: pathToCheck,
        exists: true,
        readable,
        error: readable ? null : 'Not readable'
      };
    };

    // Try resolved path
    let result = checkPath(fsPath);
    if (result) return result;

    // Try alternative path formats based on platform
    if (platformInfo.isWsl && fsPath.startsWith('/mnt/')) {
      // Try case variations for WSL
      const match = fsPath.match(/^\/mnt\/([a-zA-Z])(\/.*)/);
      if (match) {
        const [, driveLetter, rest] = match;
        result = checkPath(`/mnt/${driveLetter.toLowerCase()}${rest}`);
        if (result) return result;
        result = checkPath(`/mnt/${driveLetter.toUpperCase()}${rest}`);
        if (result) return result;
      }
    }

    // Path not found
    return {
      fsPath,
      exists: false,
      readable: false,
      error: 'File not found',
      platformInfo // Include for debugging
    };

  } catch (error) {
    return {
      fsPath: '',
      exists: false,
      readable: false,
      error: error.message || String(error)
    };
  }
});
```

**Changes to `electron/preload.cjs`**:

```javascript
// Add production detection to exposed API
contextBridge.exposeInMainWorld('rbfa', {
  platform: process.platform,
  isWsl: Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP),
  isProduction: process.env.NODE_ENV === 'production' || !process.env.VITE_DEV_SERVER_URL,
  // ... existing methods
});
```

**Changes to `renderer/App.jsx`**:

```javascript
function normalizeAudioLocation(rawLocation, options = {}) {
  if (!rawLocation) {
    if (options.debug) {
      console.log('[rbfa] normalizeAudioLocation: empty input');
    }
    return '';
  }

  const bridge = getBridgeApi();
  const platform = bridge?.platform || '';
  const isWsl = Boolean(bridge?.isWsl);
  const isProduction = Boolean(bridge?.isProduction);

  if (options.debug) {
    console.log('[rbfa] normalizeAudioLocation START', {
      rawLocation,
      platform,
      isWsl,
      isProduction
    });
  }

  let cleaned = String(rawLocation)
    .replace(/^file:\/\/localhost\//i, '/')
    .replace(/^file:\/\//i, '')
    .replace(/^localhost\//i, '/');

  // Platform-specific normalization
  if (platform === 'win32') {
    // Windows: normalize to forward slashes for URI encoding
    cleaned = cleaned.replace(/\\/g, '/');

    if (/^\/[A-Za-z]:\//.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }
  } else {
    // Linux/WSL: convert Windows paths to /mnt/
    cleaned = cleaned.replace(/\\/g, '/').trim();

    if (/^\/[A-Za-z]:\//.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }

    if (/^[A-Za-z]:\//.test(cleaned) && (platform === 'linux' || isWsl)) {
      const driveLetter = cleaned[0].toLowerCase();
      const rest = cleaned.slice(2);
      cleaned = `/mnt/${driveLetter}${rest}`;
      if (options.debug) {
        console.log('[rbfa] Mapped to WSL mount path', { cleaned, driveLetter });
      }
    }
  }

  // URI decode
  try {
    const decoded = decodeURIComponent(cleaned);
    if (options.debug && decoded !== cleaned) {
      console.log('[rbfa] URI decoded', { before: cleaned, after: decoded });
    }
    cleaned = decoded;
  } catch {
    if (options.debug) {
      console.log('[rbfa] URI decode failed, keeping raw value');
    }
  }

  if (!cleaned) {
    if (options.debug) {
      console.log('[rbfa] normalizeAudioLocation: empty after processing');
    }
    return '';
  }

  // Encode for file URL
  const encoded = encodeURI(cleaned)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F');

  let fileUrl = '';
  if (platform === 'win32') {
    // Windows: file:///C:/path
    fileUrl = `file:///${encoded}`;
  } else if (cleaned.startsWith('/')) {
    // Unix-like: file:///path
    fileUrl = `file://${encoded}`;
  } else {
    fileUrl = encoded;
  }

  if (options.debug) {
    console.log('[rbfa] normalizeAudioLocation RESULT', {
      fsPath: cleaned,
      fileUrl,
      platform,
      isProduction
    });
  }

  return fileUrl;
}
```

---

#### Step 3: Database and State File Production Paths

**Problem**: SQLite database and app state currently use relative paths which break in packaged apps.

**Solution**: Use `app.getPath('userData')` for all persistent storage.

**Changes to `electron/main.js`**:

```javascript
import path from 'node:path';
import { app } from 'electron';

// Use proper user data directory
const userDataPath = app.getPath('userData');
const statePath = path.join(userDataPath, 'app-state.json');
const dbPath = path.join(userDataPath, 'rbfa.db');

// Log paths in production for debugging
if (app.isPackaged) {
  console.log('[rbfa] Production paths:', {
    userDataPath,
    statePath,
    dbPath
  });
}

// Ensure user data directory exists
import fs from 'node:fs';
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Then use statePath and dbPath in existing handlers
```

**User Data Locations**:
- Windows: `C:\Users\<username>\AppData\Roaming\rekordbox-flow-analyzer\`
- macOS: `~/Library/Application Support/rekordbox-flow-analyzer/`
- Linux: `~/.config/rekordbox-flow-analyzer/`

---

#### Step 4: Code Signing for Windows

**Why**: Unsigned Windows apps trigger SmartScreen warnings and scare users.

**Requirements**:
1. Code signing certificate (from DigiCert, Sectigo, etc.)
2. Certificate stored as .pfx file
3. Password stored in environment variable

**Certificate Acquisition**:
1. Purchase code signing certificate (~$80-300/year)
2. Complete identity verification process
3. Download certificate as .pfx file
4. Store in `certs/cert.pfx` (add to .gitignore!)

**Environment Setup**:
```bash
# .env.local (DO NOT COMMIT)
WINDOWS_CERT_PASSWORD=your-certificate-password
```

**Build Process**:
```bash
# Set certificate password
export WINDOWS_CERT_PASSWORD="your-password"

# Build signed installer
npm run build:win
```

**Electron Builder Auto-Signs**:
- Configured in `build.win.certificateFile` and `build.win.certificatePassword`
- Signing happens automatically during build
- Produces signed .exe installer

**Alternative: GitHub Actions CI**:
```yaml
# .github/workflows/build.yml
name: Build Windows App

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build renderer
        run: npm run build:renderer

      - name: Import certificate
        run: |
          echo "${{ secrets.WINDOWS_CERT_BASE64 }}" | base64 --decode > cert.pfx

      - name: Build Windows installer
        env:
          WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
        run: npm run build:win

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: dist-electron/*.exe
```

---

#### Step 5: Auto-Update System

**Goal**: Users get automatic updates without manual downloads.

**Electron Auto-Updater**:
Built into Electron via `electron-updater` (part of electron-builder).

**Update Server Options**:
1. **GitHub Releases** (simplest, free)
   - Upload .exe to GitHub releases
   - electron-updater checks for new versions
   - Downloads differential updates

2. **Custom Server** (more control)
   - Host update files on your own server
   - Provide `latest.yml` manifest
   - Full control over rollout

**Implementation (GitHub Releases)**:

```javascript
// electron/main.js
import { autoUpdater } from 'electron-updater';

// Configure auto-updater
if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify();

  // Optional: Add update event handlers
  autoUpdater.on('update-available', () => {
    console.log('[rbfa] Update available');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[rbfa] Update downloaded');
    // Optionally notify user
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart to apply update.',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Check for updates every 6 hours
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 6 * 60 * 60 * 1000);
}
```

**Release Process**:
1. Update version in `package.json`
2. Commit and tag: `git tag v1.2.3`
3. Build: `npm run build:win`
4. Create GitHub release with tag `v1.2.3`
5. Upload `Rekordbox-Flow-Analyzer-Setup-1.2.3.exe` to release
6. electron-updater detects new version
7. Users get automatic update notification

**Update Manifest (`latest.yml`)**:
```yaml
version: 1.2.3
releaseDate: 2026-02-05T18:00:00.000Z
path: Rekordbox-Flow-Analyzer-Setup-1.2.3.exe
sha512: <hash>
```

Electron-builder generates this automatically.

---

#### Step 6: Production Testing Strategy

**Test Environments**:
1. Clean Windows 10 VM (no dev tools)
2. Clean Windows 11 VM (no dev tools)
3. Test on different user accounts (admin, standard user)

**Test Checklist**:

**Installation**:
- [ ] Installer runs without SmartScreen warnings (code signing working)
- [ ] User can choose installation directory
- [ ] Desktop shortcut created correctly
- [ ] Start menu entry created correctly
- [ ] Uninstaller entry appears in Windows "Add/Remove Programs"

**First Launch**:
- [ ] Application launches without errors
- [ ] No console/terminal window appears (production mode)
- [ ] Window size and position are reasonable
- [ ] Application icon displays correctly

**Core Functionality**:
- [ ] Browse and select Rekordbox XML file
- [ ] Parse library successfully (test with real 12K+ track library)
- [ ] Audio playback works with C:\ paths (not /mnt/c/)
- [ ] Waveform visualization renders correctly
- [ ] SQLite database created in correct AppData location
- [ ] Application state persists between launches
- [ ] All keyboard shortcuts work

**Edge Cases**:
- [ ] File paths with spaces work correctly
- [ ] File paths with Unicode characters work correctly
- [ ] File paths with special characters (&, #, %, etc.) work correctly
- [ ] Music files on different drives (D:, E:) work correctly
- [ ] Music files on network drives work (\\server\share\)
- [ ] Application works offline (no internet connection)

**Performance**:
- [ ] Parse 12,000+ tracks without crashing
- [ ] UI remains responsive during parsing
- [ ] Memory usage is reasonable (< 500MB for 12K tracks)
- [ ] Application starts in < 5 seconds

**Updates**:
- [ ] Auto-update check happens on launch
- [ ] Update notification displays correctly
- [ ] Update downloads successfully
- [ ] Update installs and restarts correctly
- [ ] User data preserved after update

**Uninstallation**:
- [ ] Uninstaller removes application files
- [ ] Uninstaller optionally preserves user data
- [ ] Desktop shortcut removed
- [ ] Start menu entry removed
- [ ] Registry entries cleaned up

---

#### Step 7: File Protocol Security Considerations

**Problem**: Packaged Electron apps have different `file://` protocol security than dev mode.

**Potential Issues**:
1. `webSecurity: false` is dangerous in production
2. `file://` protocol may be restricted
3. Need to handle file access securely

**Solutions**:

**Option 1: Keep webSecurity enabled, use protocol handler**

```javascript
// electron/main.js
import { protocol } from 'electron';

app.whenReady().then(() => {
  // Register custom protocol for audio files
  protocol.registerFileProtocol('rbfa', (request, callback) => {
    const url = request.url.replace('rbfa://', '');
    const decoded = decodeURIComponent(url);

    // Validate path is for audio files only
    const ext = path.extname(decoded).toLowerCase();
    const allowedExts = ['.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg'];

    if (!allowedExts.includes(ext)) {
      callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
      return;
    }

    // Return file path
    callback({ path: decoded });
  });
});
```

Then modify `normalizeAudioLocation()` to return `rbfa://` URLs instead of `file://`.

**Option 2: Conditional webSecurity based on environment**

```javascript
// electron/main.js
const isDev = !app.isPackaged;

mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: isDev ? false : true // Disable only in dev
  }
});
```

If `webSecurity: true` in production causes issues, implement custom protocol (Option 1).

**Recommendation**: Start with Option 2, implement Option 1 if audio playback fails in production.

---

### Phase 8: Distribution & Maintenance

**Goal**: Set up infrastructure for ongoing releases, user feedback, and crash reporting.

**Distribution Channels**:
1. **GitHub Releases** (primary)
   - Free hosting for .exe files
   - Automatic update support via electron-updater
   - Changelog in release notes

2. **Direct Download** (secondary)
   - Host installer on own website
   - Provide SHA256 checksums
   - Link to GitHub for updates

3. **Future**: Microsoft Store
   - Requires additional packaging (MSIX)
   - $19 one-time registration fee
   - Better discoverability

**Crash Reporting**:

**Option 1: Sentry (recommended)**
```bash
npm install @sentry/electron
```

```javascript
// electron/main.js
import * as Sentry from '@sentry/electron/main';

if (app.isPackaged) {
  Sentry.init({
    dsn: 'your-sentry-dsn',
    release: app.getVersion()
  });
}
```

```javascript
// renderer/main.jsx
import * as Sentry from '@sentry/electron/renderer';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'your-sentry-dsn'
  });
}
```

**Option 2: Custom crash handler**
```javascript
// electron/main.js
import { crashReporter } from 'electron';

if (app.isPackaged) {
  crashReporter.start({
    submitURL: 'https://your-server.com/crashes',
    uploadToServer: true
  });
}
```

**Analytics** (optional):
- Track feature usage
- Monitor performance metrics
- Understand user workflows

Avoid heavy analytics in v1. Focus on crash reporting and error logs.

**User Feedback**:
- Add "Send Feedback" menu item
- Opens email client with template
- Include app version and system info
- Optional: In-app feedback form

**Documentation**:
- User guide (PDF or online)
- FAQ section
- Video tutorials (optional)
- Troubleshooting guide

**Support Channels**:
- GitHub Issues (bug reports, feature requests)
- Email support (optional)
- Discord/Forum (community support)

---

### Implementation Timeline

**Phase 7: Windows Production Build** (Estimated: 2-3 weeks)
- Week 1: Electron builder setup, path resolution adaptation
- Week 2: Code signing, auto-updates, production testing
- Week 3: Bug fixes, performance optimization, documentation

**Phase 8: Distribution & Maintenance** (Ongoing)
- Initial setup: 1 week (crash reporting, distribution channels)
- Ongoing: Release management as features ship

**Dependencies**:
- Must complete Phase 6 (Export & Integration) first
- All core features must be stable
- Testing infrastructure must be in place

---

### Risk Mitigation

**High-Risk Items**:
1. **Audio playback breaking in production**
   - Mitigation: Test on clean Windows VMs early
   - Fallback: Implement custom protocol handler (rbfa://)
   - Verification: Manual testing on multiple Windows versions

2. **Code signing certificate issues**
   - Mitigation: Acquire certificate early in development
   - Backup: Distribute unsigned builds to early testers first
   - Note: Users will see SmartScreen warnings without signing

3. **Large library performance in production**
   - Mitigation: Stress test with 12K+ track libraries
   - Optimization: Implement lazy loading, pagination, virtualization
   - Monitoring: Add performance metrics in production

4. **Update mechanism failures**
   - Mitigation: Test update flow extensively
   - Fallback: Provide manual download links
   - Monitoring: Track update success rates

**Medium-Risk Items**:
1. File path edge cases (network drives, special characters)
2. SQLite database corruption
3. Memory leaks in long-running sessions
4. Windows permission issues (antivirus, UAC)

**Mitigation Strategies**:
- Comprehensive testing checklist
- Beta testing program with real users
- Staged rollout (release to small group first)
- Quick rollback capability
- Clear error messages and logging

---

### Success Metrics

**Technical Metrics**:
- [ ] Build size < 200MB
- [ ] Startup time < 5 seconds
- [ ] Memory usage < 500MB with 12K tracks
- [ ] Update success rate > 95%
- [ ] Crash rate < 0.1% of sessions

**User Metrics**:
- [ ] Installation success rate > 98%
- [ ] No SmartScreen warnings (code signing working)
- [ ] Audio playback works in > 99% of cases
- [ ] User data persists correctly in 100% of cases

**Distribution Metrics**:
- [ ] Update adoption rate > 80% within 7 days
- [ ] User feedback channels established
- [ ] Documentation complete and accessible

---

### Reference Architecture

**Development Environment (Current)**:
```
WSL Ubuntu → /mnt/c/ paths → file:// URLs → Audio HTML5 element
     ↓
Enhanced with file verification, case-insensitive fallback, detailed logging
```

**Production Environment (Target)**:
```
Windows 10/11 → C:\ paths → file:// or rbfa:// URLs → Audio HTML5 element
     ↓
Packaged as .asar → Signed .exe → Auto-updates → User AppData storage
```

**Path Resolution Matrix**:

| Environment | Input Path | Normalized Path | File URL | Protocol |
|-------------|-----------|-----------------|----------|----------|
| WSL Dev | `file://localhost/C:/Music/track.mp3` | `/mnt/c/Music/track.mp3` | `file:///mnt/c/Music/track.mp3` | file:// |
| Windows Prod | `file://localhost/C:/Music/track.mp3` | `C:\Music\track.mp3` | `file:///C:/Music/track.mp3` | file:// |
| Windows Prod (custom) | `file://localhost/C:/Music/track.mp3` | `C:\Music\track.mp3` | `rbfa://C:/Music/track.mp3` | rbfa:// |

---

### Additional Considerations

**Windows Store Distribution** (Future):
- Requires MSIX packaging (different from NSIS)
- Stricter security requirements
- Different update mechanism (Store manages updates)
- Additional testing required
- Benefits: Better visibility, trusted installation source

**macOS Support** (Future):
- Most Rekordbox users are on Windows, but macOS is secondary market
- Requires code signing certificate (~$99/year Apple Developer)
- Different path handling (no drive letters)
- DMG installer instead of NSIS
- Notarization required for Catalina+

**Linux Support** (Future):
- Small market for DJ software
- Package as AppImage, deb, or rpm
- No code signing required
- Different path conventions

**Enterprise Deployment** (Future):
- Silent install option: `installer.exe /S`
- Group Policy support
- Network installation
- License management (if commercializing)

---

### Conclusion

The path from WSL development to Windows production involves:
1. **Platform-aware path resolution** - Detect and handle Windows vs WSL paths
2. **Proper packaging** - electron-builder with NSIS installer
3. **Code signing** - Eliminate SmartScreen warnings
4. **Auto-updates** - Seamless update delivery via electron-updater
5. **Production testing** - Comprehensive testing on clean Windows VMs
6. **User data management** - Proper AppData usage
7. **Error handling** - Graceful failures with clear messages

The audio playback foundation built during WSL development will adapt cleanly to production with conditional path logic based on platform detection. The comprehensive logging and error handling will make production issues diagnosable.

**Next Actions**:
1. Complete Phase 6 (Export & Integration)
2. Set up electron-builder configuration
3. Acquire code signing certificate
4. Adapt path resolution for Windows production
5. Test extensively on clean Windows VMs
6. Ship beta to early users
7. Iterate based on feedback
8. Release v1.0 with auto-update support
