import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadState, saveState } from '../src/state/stateStore.js';

test('stateStore loads defaults and persists updates', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-state-'));
  const statePath = path.join(tempDir, 'app-state.json');

  const defaults = await loadState(statePath);
  assert.deepEqual(defaults, {
    lastLibraryPath: '',
    selectedFolders: [],
    updatedAt: null
  });

  const saved = await saveState(statePath, {
    lastLibraryPath: 'C:/Export/library.xml',
    selectedFolders: ['ROOT/Techno']
  });

  assert.equal(saved.lastLibraryPath, 'C:/Export/library.xml');
  assert.deepEqual(saved.selectedFolders, ['ROOT/Techno']);
  assert.ok(saved.updatedAt);

  const loaded = await loadState(statePath);
  assert.equal(loaded.lastLibraryPath, 'C:/Export/library.xml');

  await fs.rm(tempDir, { recursive: true, force: true });
});
