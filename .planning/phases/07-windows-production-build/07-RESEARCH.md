# Phase 7: Windows Production Build - Research

**Researched:** 2026-02-28
**Domain:** Electron packaging, custom protocol handlers, electron-builder NSIS, auto-updates
**Confidence:** HIGH (all critical findings verified against official docs and GitHub issues)

## Summary

Phase 7 has five distinct problems to solve, with one critical blocker (audio playback) and one critical risk (Electron 37.2.0 SQLite regression). The good news: most of the heavy lifting is already done. `app.getPath('userData')` is already used everywhere. There are no native `.node` modules in the project — `node:sqlite` is Node.js built-in (no ASAR unpacking needed). The `rollup` `.node` files in node_modules are dev-only and will not be included in the production build.

The blocking problem: in production, `webSecurity: true` prevents the HTML `<audio>` element from loading `file://` URLs served from the renderer. The fix is `protocol.handle()` with a custom `rbfa-audio://` scheme registered via `protocol.registerSchemesAsPrivileged()` with `stream: true`. This is the only correct approach in Electron 35+.

The critical risk: the project's `package.json` pins `"electron": "^37.2.0"`, but Electron 37.2.0 has a confirmed regression where `require('node:sqlite')` throws "No such binding: sqlite". The fix is in 37.2.3+. The electron version must be bumped before the build will work at all.

**Primary recommendation:** Upgrade Electron to `^37.2.3` (or latest 37.x), implement `rbfa-audio://` custom protocol for audio, then build with `npm run build:win` from WSL (NSIS works on Linux without Wine).

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| electron | ^37.2.0 — UPGRADE TO ^37.2.3 | App shell | 37.2.0 has sqlite bug; 37.2.3+ fixes it |
| electron-builder | ^24.13.3 | Package + installer | Already configured for NSIS |
| vite | ^7.1.4 | Renderer build | `base: './'` already set |

### To Add
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| electron-updater | ^6.x | Auto-updates | Paired with electron-builder for GitHub Releases |

### Not Needed
| Concern | Verdict | Reason |
|---------|---------|--------|
| better-sqlite3 | Not needed | Project uses `node:sqlite` (Node.js built-in) |
| @electron/rebuild | Not needed | No native `.node` modules in production deps |
| asarUnpack | Not needed | No native binaries; node:sqlite is built into Node.js runtime |
| wine (for NSIS builds) | Not needed | electron-builder NSIS target builds on Linux without Wine |

**Installation (additions only):**
```bash
npm install --save-dev electron-updater
```

Then bump electron in package.json:
```json
"electron": "^37.2.3"
```

## Architecture Patterns

### Recommended Project Structure Changes
```
electron/
├── main.js           # Add: registerSchemesAsPrivileged + protocol.handle
├── preload.cjs       # Add: isProduction flag exposed via contextBridge
build/
├── icon.png          # Create: 256x256 PNG (electron-builder accepts PNG for Windows)
```

### Pattern 1: Custom Protocol for Audio (THE Critical Fix)

**What:** Register `rbfa-audio://` as a privileged scheme before app.ready(), then handle requests in app.whenReady() by converting the URL to a filesystem path and serving via `net.fetch()`.

**When to use:** Production always. Dev keeps `webSecurity: false` (unchanged).

**Implementation — register BEFORE app module code, at module top level:**
```javascript
// electron/main.js — MUST be at module top level, before any app.whenReady()
import { protocol, net } from 'electron';
import { pathToFileURL } from 'node:url';

// Must be called before app is ready — before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'rbfa-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true  // REQUIRED for HTML <audio> seeking/buffering
    }
  }
]);
```

**Implementation — register handler inside app.whenReady():**
```javascript
// Source: https://www.electronjs.org/docs/latest/api/protocol
app.whenReady().then(() => {
  // Register audio protocol handler for production builds
  // In production, webSecurity:true blocks file:// from renderer
  // rbfa-audio:// serves files securely through main process
  protocol.handle('rbfa-audio', (request) => {
    // URL format: rbfa-audio://local/C:/Users/thomas/Music/track.mp3
    // or:         rbfa-audio://local/%2Fmnt%2Fc%2FMusic%2Ftrack.mp3
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname.slice(1)); // remove leading /

    // Only allow known audio extensions
    const ext = filePath.split('.').pop().toLowerCase();
    const allowed = ['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'mp4'];
    if (!allowed.includes(ext)) {
      return new Response('Forbidden', { status: 403 });
    }

    // net.fetch with pathToFileURL handles range requests (seeking)
    return net.fetch(pathToFileURL(filePath).toString());
  });

  getDb();
  createWindow();
  // ... rest of whenReady
});
```

**Renderer side — update normalizeAudioLocation() for production:**
```javascript
// In renderer/App.jsx — normalizeAudioLocation()
// When platform === 'win32' (production), return rbfa-audio:// URL
// When platform === 'linux'/isWsl (dev), return file:// URL unchanged

function normalizeAudioLocation(rawLocation, options = {}) {
  // ... existing cleaning logic ...

  const bridge = getBridgeApi();
  const platform = bridge?.platform || '';
  const isProduction = Boolean(bridge?.isProduction);

  // In production Windows, use custom protocol instead of file://
  if (platform === 'win32' && isProduction) {
    // cleaned is the Windows path like C:/Users/thomas/Music/track.mp3
    const encoded = encodeURIComponent(cleaned);
    return `rbfa-audio://local/${encoded}`;
  }

  // Dev (WSL/Linux): keep existing file:// behavior
  // ... rest of existing logic ...
}
```

**preload.cjs — expose isProduction:**
```javascript
contextBridge.exposeInMainWorld('rbfa', {
  platform: process.platform,
  isWsl: Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP),
  isProduction: app.isPackaged,  // NOTE: import { app } from 'electron' at top
  // ... existing methods
});
```

Wait — preload.cjs uses CommonJS. Access app.isPackaged like:
```javascript
// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');
// app is not available in preload — derive from environment instead:
const isProduction = !process.env.VITE_DEV_SERVER_URL;

contextBridge.exposeInMainWorld('rbfa', {
  platform: process.platform,
  isWsl: Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP),
  isProduction,
  // ... existing methods
});
```

### Pattern 2: Vite Base Path for Production

**What:** `vite.config.js` already has `base: './'` — this is correct. The production renderer is loaded via `mainWindow.loadFile()` which handles relative paths.

**Verification:** The current `electron/main.js` uses:
```javascript
mainWindow.loadFile(path.resolve(__dirname, '../dist/index.html'));
```
This path assumes the built app has `dist/` at `../dist/` relative to `electron/main.js`. Under ASAR packaging, `__dirname` refers to the path inside the ASAR archive, so `path.resolve(__dirname, '../dist/index.html')` resolves correctly to `app.asar/dist/index.html`. No change needed.

### Pattern 3: Electron Version Fix

The pinned version `"electron": "^37.2.0"` will resolve to 37.2.0 if already installed. Electron 37.2.0 has a confirmed regression where `require('node:sqlite')` throws "No such binding: sqlite" (GitHub issue #47671, fixed in 37.2.3).

Action: Update package.json and reinstall:
```bash
npm install electron@latest  # or specify "electron": "^37.2.3"
```

### Pattern 4: Icon Creation (Minimal Path)

electron-builder accepts `build/icon.png` (256x256+) for Windows — it does NOT auto-convert PNG to ICO. For a proper .ico, use electron-icon-builder or GIMP. For a placeholder that unblocks the build, the default Electron icon will be used if no icon file exists.

**Minimal working approach:**
- Create `build/icon.png` as a 256x256 PNG (any color/image)
- electron-builder will attempt to use it; if conversion fails on Linux, the build still succeeds with default Electron icon
- For production quality, generate a real .ico using: `npx electron-icon-builder --input=icon-source.png --output=build`

### Pattern 5: Auto-Updater (Deferrable)

electron-updater pairs with electron-builder GitHub Releases. Minimum viable setup:
```javascript
// electron/main.js — production only
import { autoUpdater } from 'electron-updater';

if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify();
}
```

Requires in `package.json` build config:
```json
"publish": {
  "provider": "github",
  "owner": "your-github-username",
  "repo": "rekordbox-flow-analyzer",
  "private": false
}
```

**Deferral verdict:** Auto-updater requires a public GitHub repo with releases. It can be wired in Phase 7 but does not block the installer from working. Defer to Phase 8 if no GitHub repo exists yet.

### Anti-Patterns to Avoid
- **Setting `webSecurity: false` in production:** Disables all Chromium security. Electron docs explicitly warn against this. Use protocol handler instead.
- **Using `protocol.registerFileProtocol()`:** Deprecated since Electron 25. Removed in Electron 37. Use `protocol.handle()`.
- **Calling `protocol.registerSchemesAsPrivileged()` inside `app.whenReady()`:** Must be called before `app` emits `ready`. Call it at module top level.
- **Using `__dirname` for userData paths:** `app.getPath('userData')` is already used throughout — this is correct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME type detection for streaming audio | Custom MIME guesser | `net.fetch()` with `stream: true` privilege | net.fetch handles range requests and MIME negotiation |
| Icon file generation | Script to create ICO | `electron-icon-builder` npm package | ICO format requires multi-resolution embedding; rename trick fails |
| Update manifest (latest.yml) | Hand-craft YAML | electron-builder generates automatically | Hash/signature generation is complex |
| Code signing on Windows | Custom signtool wrapper | electron-builder `win.certificateFile` config | Handles pfx import, SHA256+SHA1 dual signing |

**Key insight:** `net.fetch(pathToFileURL(path).toString())` automatically handles HTTP range requests needed for audio seeking. Don't implement range-request logic manually — net.fetch does it.

## Common Pitfalls

### Pitfall 1: Electron 37.2.0 sqlite "No such binding" Regression
**What goes wrong:** App crashes on launch with `Error: No such binding: sqlite` — the `node:sqlite` module is unavailable even though Node.js 22 supports it.
**Why it happens:** Electron 37.2.0 introduced a regression (PR #47555) that dropped the SQLite native binding from the bundled Node.js. Fixed in 37.2.3.
**How to avoid:** Pin `"electron": "^37.2.3"` or higher in package.json. Run `npm update electron` before building.
**Warning signs:** Build succeeds but app crashes at startup; check for "No such binding: sqlite" in stderr.

### Pitfall 2: protocol.registerSchemesAsPrivileged Called Too Late
**What goes wrong:** `Error: Cannot register custom protocol after app is ready` or protocol silently fails to work.
**Why it happens:** `registerSchemesAsPrivileged()` must be called before Electron emits `ready`. Calling it inside `app.whenReady()` or `app.on('ready')` is too late.
**How to avoid:** Place `protocol.registerSchemesAsPrivileged([...])` at module top level in `main.js`, before any `app.whenReady()` call.
**Warning signs:** Custom protocol URLs return network errors; `<audio>` element fires `onerror` immediately.

### Pitfall 3: Missing `stream: true` for Audio Seeking
**What goes wrong:** Audio plays but seeking (scrubbing) doesn't work. Or audio fails to load entirely with "The element has no supported sources."
**Why it happens:** The `<audio>` and `<video>` elements expect streaming protocol responses. Without `stream: true` in privileges, the browser tries to buffer the entire file before playback.
**How to avoid:** Always include `stream: true` in the privileges object for any scheme serving audio/video.
**Warning signs:** Audio plays from beginning but scrubbing causes buffering errors; works for short files but fails for long ones.

### Pitfall 4: WSL Build Produces Linux Binary for electron.exe
**What goes wrong:** `npm run build:win` from WSL downloads Linux Electron binaries and builds a Linux app, not Windows.
**Why it happens:** WSL runs Linux; `npm install` fetches Linux Electron binaries. electron-builder uses whatever Electron binary is installed to determine target arch.
**How to avoid:** electron-builder handles cross-compilation for Windows NSIS from Linux — it downloads the Windows Electron binaries separately during the build. Do NOT run `electron-builder --platform=win32` — just use `--win` flag as already configured.
**Warning signs:** Output is `.AppImage` or missing `.exe`; check that NSIS target is specified in package.json `build.win.target`.

### Pitfall 5: Path Handling in Production — Windows vs WSL
**What goes wrong:** Audio files not found in production. `normalizeAudioLocation()` maps `C:/Users/...` to `/mnt/c/Users/...` which doesn't exist on Windows.
**Why it happens:** The current `normalizeAudioLocation()` in `App.jsx` maps Windows drive paths to WSL `/mnt/` paths when `platform === 'linux' || isWsl`. In production, `platform === 'win32'` — so this branch is not triggered and `C:/...` paths pass through as-is. This is actually correct for Windows production, but the `rbfa-audio://` URL must be constructed from the `C:/...` path, not a `/mnt/` path.
**How to avoid:** The `normalizeAudioLocation()` function already handles `platform === 'win32'` correctly (no WSL mapping). The only change needed is returning `rbfa-audio://local/C%3A/path...` instead of `file:///C:/path...` in production.
**Warning signs:** Test by checking `window.rbfa.platform` in production — it should be `'win32'`, not `'linux'`.

### Pitfall 6: ASAR and `__dirname` for App Resources
**What goes wrong:** Path to `dist/index.html` or `electron/preload.cjs` resolves incorrectly in production.
**Why it happens:** Under ASAR, `__dirname` works but paths outside the ASAR (like `extraResources`) use `process.resourcesPath`.
**How to avoid:**
- `dist/index.html` (inside ASAR): `path.resolve(__dirname, '../dist/index.html')` — correct, already in code.
- `preload.cjs` (inside ASAR): `path.join(__dirname, 'preload.cjs')` — correct, already in code.
- userData files: `app.getPath('userData')` — already in code.
- `extraResources`: `path.join(process.resourcesPath, 'resources', 'filename')`.
**Warning signs:** "Cannot find module" or "ENOENT" for known files.

### Pitfall 7: No Icon File Causes Build Warning (Not Error)
**What goes wrong:** Build proceeds but uses the default Electron icon. Users see the Electron logo, not the app icon.
**Why it happens:** No `build/icon.ico` or `build/icon.png` exists.
**How to avoid:** Create a minimal 256x256 PNG at `build/icon.png`. For production, generate a proper ICO.
**Warning signs:** electron-builder logs "Application icon is not set" or similar; built installer uses Electron alien icon.

## Code Examples

Verified patterns from official sources:

### Complete Protocol Registration (main.js)
```javascript
// Source: https://www.electronjs.org/docs/latest/api/protocol
import { app, BrowserWindow, protocol, net } from 'electron';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// MUST be before app.whenReady() — at module top level
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'rbfa-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true  // enables seeking in <audio> element
    }
  }
]);

// Inside app.whenReady():
app.whenReady().then(() => {
  protocol.handle('rbfa-audio', (request) => {
    // URL format: rbfa-audio://local/<encoded-path>
    const encodedPath = request.url.slice('rbfa-audio://local/'.length);
    const fsPath = decodeURIComponent(encodedPath);

    // Security: only allow audio file extensions
    const ext = path.extname(fsPath).slice(1).toLowerCase();
    if (!['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg'].includes(ext)) {
      return new Response('Forbidden', { status: 403 });
    }

    // net.fetch handles range requests automatically (needed for seeking)
    return net.fetch(pathToFileURL(fsPath).toString());
  });

  // ... rest of whenReady
});
```

### normalizeAudioLocation Production Branch (renderer/App.jsx)
```javascript
// Source: project-specific — informed by Electron protocol docs
function normalizeAudioLocation(rawLocation, options = {}) {
  const bridge = getBridgeApi();
  const platform = bridge?.platform || '';
  const isWsl = Boolean(bridge?.isWsl);
  const isProduction = Boolean(bridge?.isProduction);

  // ... existing cleaning logic (no changes to cleaning) ...

  // Production Windows: use custom protocol
  if (platform === 'win32' && isProduction) {
    // cleaned is C:/Users/thomas/Music/track.mp3
    return `rbfa-audio://local/${encodeURIComponent(cleaned)}`;
  }

  // Dev (WSL/Linux): existing file:// logic unchanged
  // platform === 'win32' dev mode (running from source on Windows): use file://
  // ... existing file:// URL construction ...
}
```

### electron-builder package.json (current config is correct, additions only)
```json
{
  "build": {
    "appId": "com.rekordbox-flow-analyzer.app",
    "productName": "Rekordbox Flow Analyzer",
    "directories": { "output": "dist-electron" },
    "files": ["dist/**/*", "electron/**/*", "src/**/*", "package.json"],
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "build/icon.png",
      "requestedExecutionLevel": "asInvoker"
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
      "owner": "GITHUB_USERNAME_PLACEHOLDER",
      "repo": "rekordbox-flow-analyzer"
    }
  }
}
```

### electron-updater Minimum Integration
```javascript
// Source: https://www.electron.build/auto-update.html
// electron/main.js — add after imports
import { autoUpdater } from 'electron-updater';

// Inside app.whenReady(), after createWindow():
if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify();
}
```

### preload.cjs — expose isProduction
```javascript
// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

// VITE_DEV_SERVER_URL is set only during vite dev server
// In packaged app, it is always undefined
const isProduction = !process.env.VITE_DEV_SERVER_URL;

contextBridge.exposeInMainWorld('rbfa', {
  platform: process.platform,
  isWsl: Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP),
  isProduction,
  // ... existing methods unchanged
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `protocol.registerFileProtocol()` | `protocol.handle()` | Electron 25 (deprecated), removed in later versions | Must use new API |
| `better-sqlite3` native module | `node:sqlite` (built-in) | Node.js 22.5+ (available without flag since 22.13) | No native module rebuild needed |
| `--experimental-sqlite` flag | Not needed | Node.js 22.13.0 / Electron 35.0.2 | node:sqlite works out of the box in Electron 35+ |
| `electron-updater` only option | `update-electron-app` (simpler) | Electron official alternative | For public repos, 2-line setup; electron-updater still valid for private repos |

**Deprecated/outdated (in this project's context):**
- `webSecurity: false` in production: dangerous, use protocol handler
- `protocol.registerFileProtocol`: removed in Electron 35+, use `protocol.handle()`
- `registerBufferProtocol`, `registerStringProtocol`: same — use `protocol.handle()`

## Open Questions

1. **Icon generation toolchain**
   - What we know: `build/icon.png` (256x256+) is sufficient for electron-builder to produce a working Windows build; quality ICO requires `electron-icon-builder` or GIMP
   - What's unclear: Whether the build environment (WSL) has ImageMagick available for ICO conversion
   - Recommendation: Create a minimal placeholder PNG to unblock the build; iterate on icon quality separately

2. **Auto-updater deferral decision**
   - What we know: electron-updater needs a GitHub repo with releases and `publish` config in package.json
   - What's unclear: Whether a public GitHub repo exists or will be created for this project
   - Recommendation: Wire the electron-updater import and `checkForUpdatesAndNotify()` call behind `app.isPackaged`, but leave `publish` config with a placeholder until GitHub repo is set up. The build works without it; updater only runs in packaged mode.

3. **Code signing deferral**
   - What we know: Windows code signing requires a certificate (~$80-300/year); without signing, users see SmartScreen "Unknown publisher" warning but app still installs and runs
   - What's unclear: Whether code signing should block v1 release
   - Recommendation: Defer code signing. The app works unsigned. Add a note to first-launch UI that SmartScreen may warn and users can click "More info > Run anyway."

4. **Electron version in package.json uses `^37.2.0`**
   - What we know: `^37.2.0` resolves to 37.2.0 if package-lock.json pins it; the sqlite bug is in 37.2.0 and fixed in 37.2.3
   - What's unclear: Whether `node_modules/electron` is currently at 37.2.0 or if it was already updated
   - Recommendation: Run `npm list electron` before building; if 37.2.0, run `npm install electron@^37.2.3`

## Sources

### Primary (HIGH confidence)
- https://www.electronjs.org/docs/latest/api/protocol — `protocol.handle()`, `registerSchemesAsPrivileged()`, privileges object, timing requirement
- https://github.com/electron/electron/issues/47671 — Confirmed 37.2.0 sqlite regression, fixed in 37.2.3
- https://github.com/electron/electron/issues/45532 — node:sqlite flag history, confirmed working without flag in Electron 35.0.2+
- https://releases.electronjs.org/release/v37.2.3 — Confirms sqlite fix: "Fixed an issue where require('node:sqlite') didn't work"
- https://nodejs.org/api/sqlite.html — node:sqlite stability: no flag needed since Node.js 22.13.0

### Secondary (MEDIUM confidence)
- https://www.electron.build/multi-platform-build.html — NSIS builds work on Linux without Wine
- https://www.electron.build/auto-update.html — electron-updater minimum setup (2 lines)
- https://www.electron.build/icons.html — icon requirements: 256x256, `build/icon.png` accepted
- https://dev.to/bme/building-a-secure-local-video-player-in-electron-3ki9 — protocol.handle with net.fetch pattern for media files

### Tertiary (LOW confidence — not directly verified)
- Multiple community sources agree: NSIS target on Linux does not require Wine (Squirrel.Windows does)
- Community consensus: electron-builder 24.x has more stable asarUnpack behavior than 25.x

## Metadata

**Confidence breakdown:**
- Electron version / sqlite bug: HIGH — confirmed by official GitHub issue and release notes
- Protocol handler approach: HIGH — verified against official Electron docs
- Audio protocol pattern with stream:true: HIGH — official docs + multiple sources confirm
- WSL cross-compile for NSIS: MEDIUM — official docs confirm, community confirms, but not tested in this environment
- Auto-updater: MEDIUM — official docs confirm setup, but GitHub repo config is project-specific
- Icon behavior: MEDIUM — official docs say PNG accepted; ICO preferred but PNG works

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (Electron releases frequently; verify electron version before building)
