import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_STATE = {
  lastLibraryPath: '',
  selectedFolders: [],
  updatedAt: null
};

export async function loadState(stateFilePath) {
  try {
    const raw = await fs.readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_STATE,
      ...parsed,
      selectedFolders: Array.isArray(parsed.selectedFolders) ? parsed.selectedFolders : []
    };
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

  const directoryPath = path.dirname(stateFilePath);
  await fs.mkdir(directoryPath, { recursive: true });

  const tempPath = `${stateFilePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(nextState, null, 2), 'utf8');
  await fs.rename(tempPath, stateFilePath);

  return nextState;
}
