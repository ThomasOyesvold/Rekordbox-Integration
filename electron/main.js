import path from 'node:path';
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
import { startBackgroundParse } from '../src/services/parseService.js';
import { getRecentImports, initDatabase, saveImportHistory } from '../src/state/sqliteStore.js';
import { loadState, saveState } from '../src/state/stateStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const statePath = path.resolve(app.getPath('userData'), 'app-state.json');
const dbPath = path.resolve(app.getPath('userData'), 'rbfa.db');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      // Keep preload in CommonJS for compatibility with Electron sandboxed renderers.
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

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

app.whenReady().then(() => {
  initDatabase(dbPath);
  createWindow();

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
