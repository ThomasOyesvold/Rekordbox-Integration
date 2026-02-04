import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { buildFolderTree, filterTracksByFolders, summarizeLibrary } from '../src/services/libraryService.js';
import { startBackgroundParse } from '../src/services/parseService.js';
import { loadState, saveState } from '../src/state/stateStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const statePath = path.resolve(app.getPath('userData'), 'app-state.json');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

  const library = await startBackgroundParse(xmlPath, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('library:parseProgress', progress);
    }
  });

  const filteredTracks = filterTracksByFolders(library, selectedFolders);
  const summary = summarizeLibrary(library);

  return {
    summary,
    folders: library.folders,
    folderTree: buildFolderTree(library.folders),
    playlists: library.playlists,
    filteredTracks,
    parsedAt: library.parsedAt
  };
});

ipcMain.handle('state:load', async () => loadState(statePath));
ipcMain.handle('state:save', async (_event, patch) => saveState(statePath, patch));

app.whenReady().then(() => {
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
