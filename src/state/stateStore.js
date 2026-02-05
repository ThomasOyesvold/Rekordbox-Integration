import fs from 'node:fs/promises';
import path from 'node:path';
import { isDatabaseReady, loadAppState, saveAppState } from './sqliteStore.js';

const DEFAULT_STATE = {
  lastLibraryPath: '',
  selectedFolders: [],
  updatedAt: null
};

function normalizeState(state) {
  const safe = state && typeof state === 'object' ? state : {};
  return {
    ...DEFAULT_STATE,
    ...safe,
    selectedFolders: Array.isArray(safe.selectedFolders) ? safe.selectedFolders : []
  };
}

export async function loadState(stateFilePath) {
  if (isDatabaseReady()) {
    try {
      const dbState = loadAppState();
      if (dbState) {
        return normalizeState(dbState);
      }
    } catch (error) {
      console.warn('[state] Failed to load app state from SQLite:', error.message || error);
    }
  }

  try {
    const raw = await fs.readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw);

    return normalizeState(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...DEFAULT_STATE };
    }

    throw error;
  }
}

export async function saveState(stateFilePath, patch) {
  const existing = await loadState(stateFilePath);
  const nextState = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  if (isDatabaseReady()) {
    try {
      saveAppState(nextState);
    } catch (error) {
      console.warn('[state] Failed to save app state to SQLite:', error.message || error);
    }
  }

  const directoryPath = path.dirname(stateFilePath);
  await fs.mkdir(directoryPath, { recursive: true });

  const tempPath = `${stateFilePath}.tmp`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(nextState, null, 2), 'utf8');
    await fs.rename(tempPath, stateFilePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(directoryPath, { recursive: true });
      await fs.writeFile(stateFilePath, JSON.stringify(nextState, null, 2), 'utf8');
      return nextState;
    }

    throw error;
  }

  return nextState;
}
