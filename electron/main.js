import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import {
  buildFolderTree,
  buildTrackPlaylistIndex,
  filterTracksByFolders,
  selectPlaylistsByFolders,
  summarizeLibrary
} from '../src/services/libraryService.js';
import { runBaselineAnalysis } from '../src/services/baselineAnalyzerService.js';
import { buildAnalysisCsv, buildAnalysisJson } from '../src/services/analysisExportService.js';
import { startBackgroundParse } from '../src/services/parseService.js';
import { getRecentImports, initDatabase, saveImportHistory } from '../src/state/sqliteStore.js';
import { loadState, saveState } from '../src/state/stateStore.js';
import { attachAnlzWaveformSummaries } from '../src/services/anlzWaveformService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const statePath = path.resolve(app.getPath('userData'), 'app-state.json');
const dbPath = path.resolve(app.getPath('userData'), 'rbfa.db');
const isSmokeMode = process.env.RBFA_SMOKE === '1';

let mainWindow = null;

function createWindow() {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const isDev = Boolean(devServerUrl);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    show: !isSmokeMode,
    webPreferences: {
      // Keep preload in CommonJS for compatibility with Electron sandboxed renderers.
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow media to load from file:// while running the dev server.
      webSecurity: !isDev
    }
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('dialog:pickXml', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Rekordbox XML export',
    properties: ['openFile'],
    filters: [{ name: 'XML Files', extensions: ['xml'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return '';
  }

  return result.filePaths[0];
});

ipcMain.handle('library:parse', async (_event, payload) => {
  const xmlPath = payload?.xmlPath;
  const selectedFolders = Array.isArray(payload?.selectedFolders) ? payload.selectedFolders : [];
  const anlzMapPath = typeof payload?.anlzMapPath === 'string' ? payload.anlzMapPath.trim() : '';
  const anlzMaxTracksRaw = Number(payload?.anlzMaxTracks);
  const anlzMaxTracks = Number.isFinite(anlzMaxTracksRaw) && anlzMaxTracksRaw > 0
    ? Math.floor(anlzMaxTracksRaw)
    : Infinity;

  if (!xmlPath) {
    throw new Error('Missing xmlPath.');
  }

  let library;
  try {
    library = await startBackgroundParse(xmlPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('library:parseProgress', progress);
      }
    });
  } catch (error) {
    throw new Error(JSON.stringify({
      message: error.message,
      issues: Array.isArray(error.issues) ? error.issues : []
    }));
  }

  const filteredTracks = filterTracksByFolders(library, selectedFolders);
  let anlzAttach = null;
  let anlzAttachError = null;
  if (anlzMapPath) {
    try {
      anlzAttach = await attachAnlzWaveformSummaries(filteredTracks, {
        mappingPath: anlzMapPath,
        maxTracks: anlzMaxTracks
      });
    } catch (error) {
      anlzAttachError = error.message || String(error);
    }
  }

  const scopedPlaylists = selectPlaylistsByFolders(library.playlists, selectedFolders);
  const trackPlaylistIndex = buildTrackPlaylistIndex(scopedPlaylists);
  const summary = summarizeLibrary(library);
  saveImportHistory({
    xmlPath,
    parsedAt: library.parsedAt,
    trackCount: summary.trackCount,
    playlistCount: summary.playlistCount,
    folderCount: summary.folderCount,
    selectedFolders
  });

  return {
    summary,
    folders: library.folders,
    folderTree: buildFolderTree(library.folders),
    playlists: scopedPlaylists,
    trackPlaylistIndex,
    filteredTracks,
    anlzAttach,
    anlzAttachError,
    parsedAt: library.parsedAt,
    validation: library.validation || { issues: [], warningCount: 0, errorCount: 0 }
  };
});

ipcMain.handle('state:load', async () => loadState(statePath));
ipcMain.handle('state:save', async (_event, patch) => saveState(statePath, patch));
ipcMain.handle('imports:recent', async () => getRecentImports(10));
ipcMain.handle('analysis:baseline', async (_event, payload) => {
  const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
  return runBaselineAnalysis({
    tracks,
    sourceXmlPath: payload?.sourceXmlPath || null,
    selectedFolders: Array.isArray(payload?.selectedFolders) ? payload.selectedFolders : [],
    maxPairs: 5000,
    topLimit: 20
  });
});
ipcMain.handle('analysis:export', async (_event, payload) => {
  const format = payload?.format === 'json' ? 'json' : 'csv';
  const analysisResult = payload?.analysisResult || null;
  const trackIndex = payload?.trackIndex && typeof payload.trackIndex === 'object'
    ? payload.trackIndex
    : {};

  if (!analysisResult) {
    throw new Error('Missing analysis result for export.');
  }

  const suggestedPath = path.resolve(
    app.getPath('documents'),
    `rbfa-analysis-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.${format}`
  );

  const selection = await dialog.showSaveDialog(mainWindow, {
    title: `Export analysis as ${format.toUpperCase()}`,
    defaultPath: suggestedPath,
    filters: format === 'json'
      ? [{ name: 'JSON Files', extensions: ['json'] }]
      : [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (selection.canceled || !selection.filePath) {
    return { canceled: true };
  }

  const content = format === 'json'
    ? buildAnalysisJson(analysisResult, trackIndex)
    : buildAnalysisCsv(analysisResult, trackIndex);
  await fs.writeFile(selection.filePath, content, 'utf8');

  return {
    canceled: false,
    filePath: selection.filePath,
    format
  };
});

const isWsl = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);

function decodeRepeatedly(value, maxPasses = 2) {
  let current = value;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) {
        return current;
      }
      current = decoded;
    } catch {
      return current;
    }
  }
  return current;
}

function normalizeRawLocation(rawPath) {
  const trimmed = String(rawPath || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^file:/i.test(trimmed)) {
    try {
      return fileURLToPath(new URL(trimmed));
    } catch {
      // Fall through to manual cleanup.
    }
  }

  let value = trimmed
    .replace(/^file:\/\/localhost\//i, '/')
    .replace(/^file:\/\//i, '')
    .replace(/^localhost\//i, '/')
    .replace(/\\/g, '/');

  if (/^\/[A-Za-z]:\//.test(value)) {
    value = value.slice(1);
  }

  value = decodeRepeatedly(value, 2);
  return value;
}

function fileUrlFromFsPath(fsPath) {
  if (!fsPath) {
    return '';
  }
  const normalized = fsPath.replace(/\\/g, '/');
  const encoded = encodeURI(normalized)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F');

  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encoded}`;
  }
  if (normalized.startsWith('/')) {
    return `file://${encoded}`;
  }
  return encoded;
}

function findExistingParent(pathToCheck, maxDepth = 5) {
  if (!pathToCheck) {
    return '';
  }

  let current = pathToCheck;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const parent = path.posix.dirname(current);
    if (!parent || parent === current) {
      break;
    }
    if (fsSync.existsSync(parent)) {
      return parent;
    }
    current = parent;
  }

  return '';
}

// File verification handlers for audio playback debugging
ipcMain.handle('file:exists', async (_event, filePath) => {
  try {
    return fsSync.existsSync(filePath);
  } catch (error) {
    console.error('[rbfa] file:exists error', { filePath, error: error.message });
    return false;
  }
});

ipcMain.handle('file:readable', async (_event, filePath) => {
  try {
    fsSync.accessSync(filePath, fsSync.constants.R_OK);
    return true;
  } catch (error) {
    console.error('[rbfa] file:readable error', { filePath, error: error.message });
    return false;
  }
});

ipcMain.handle('audio:resolvePath', async (_event, rawPath) => {
  if (!rawPath) {
    return { fsPath: '', fileUrl: '', exists: false, readable: false, error: 'Empty path' };
  }

  try {
    const hadEncodedSegments = /%[0-9A-F]{2}/i.test(String(rawPath));
    let fsPath = normalizeRawLocation(rawPath);

    // If Windows path on Linux/WSL, map to /mnt/<drive>
    if ((process.platform === 'linux' || isWsl) && /^[A-Za-z]:\//.test(fsPath)) {
      const driveLetter = fsPath[0].toLowerCase();
      const rest = fsPath.slice(2);
      fsPath = `/mnt/${driveLetter}${rest}`;
    }

    // Helper function to check a path
    const checkPath = (pathToCheck) => {
      if (!pathToCheck) return null;

      if (fsSync.existsSync(pathToCheck)) {
        let readable = false;
        try {
          fsSync.accessSync(pathToCheck, fsSync.constants.R_OK);
          readable = true;
        } catch {
          readable = false;
        }
        return {
          fsPath: pathToCheck,
          fileUrl: fileUrlFromFsPath(pathToCheck),
          exists: true,
          readable,
          error: readable ? null : 'Not readable',
          parentExists: true,
          parentPath: path.posix.dirname(pathToCheck),
          hadEncodedSegments
        };
      }
      return null;
    };

    // Try the path as-is first
    let result = checkPath(fsPath);
    if (result) return result;

    // If path starts with /mnt/ (WSL mount), try case variations of the drive letter
    if (fsPath.startsWith('/mnt/')) {
      const match = fsPath.match(/^\/mnt\/([a-zA-Z])(\/.*)/);
      if (match) {
        const [, driveLetter, rest] = match;

        // Try lowercase drive letter
        const lowerPath = `/mnt/${driveLetter.toLowerCase()}${rest}`;
        result = checkPath(lowerPath);
        if (result) return result;

        // Try uppercase drive letter
        const upperPath = `/mnt/${driveLetter.toUpperCase()}${rest}`;
        result = checkPath(upperPath);
        if (result) return result;
      }
    }

    // If path looks like a Windows path (C:/...), try converting to WSL mount
    if (/^[A-Za-z]:\//.test(fsPath)) {
      const driveLetter = fsPath[0].toLowerCase();
      const rest = fsPath.slice(2);
      const wslPath = `/mnt/${driveLetter}${rest}`;
      result = checkPath(wslPath);
      if (result) return result;
    }

    // Path not found with any variation
    const parentPath = findExistingParent(fsPath);
    return {
      fsPath,
      fileUrl: fileUrlFromFsPath(fsPath),
      exists: false,
      readable: false,
      error: 'File not found',
      parentExists: Boolean(parentPath),
      parentPath,
      hadEncodedSegments
    };
  } catch (error) {
    return {
      fsPath: '',
      fileUrl: '',
      exists: false,
      readable: false,
      error: error.message || String(error)
    };
  }
});

async function runSmokeTest() {
  const smokeXmlPath = process.env.RBFA_SMOKE_XML
    || path.resolve(__dirname, '../test/fixtures/rekordbox-sample.xml');

  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window not ready in smoke mode.');
  }

  const script = `
    (async () => {
      if (!window.rbfa) {
        throw new Error('window.rbfa bridge missing');
      }

      const parseResult = await window.rbfa.parseLibrary(${JSON.stringify(smokeXmlPath)}, []);
      const tracks = (parseResult.filteredTracks || []).slice(0, 20);
      let analysis = null;
      if (tracks.length >= 2) {
        analysis = await window.rbfa.runBaselineAnalysis(tracks, ${JSON.stringify(smokeXmlPath)}, []);
      }

      return {
        trackCount: Number(parseResult.filteredTracks?.length || 0),
        pairCount: Number(analysis?.pairCount || 0),
        hasValidation: Array.isArray(parseResult.validation?.issues)
      };
    })();
  `;

  const result = await mainWindow.webContents.executeJavaScript(script, true);
  if (!result || result.trackCount <= 0) {
    throw new Error(`Smoke parse failed for ${smokeXmlPath}.`);
  }

  if (result.trackCount >= 2 && result.pairCount <= 0) {
    throw new Error('Smoke analysis failed to produce pair results.');
  }

  console.log(`[smoke] trackCount=${result.trackCount} pairCount=${result.pairCount}`);
}

app.whenReady().then(() => {
  initDatabase(dbPath);
  createWindow();

  if (isSmokeMode && mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      runSmokeTest()
        .then(() => app.exit(0))
        .catch((error) => {
          console.error(`[smoke] ${error.message}`);
          app.exit(1);
        });
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
