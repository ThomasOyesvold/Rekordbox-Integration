import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, getRecentImports, initDatabase, saveImportHistory } from '../src/state/sqliteStore.js';

test('sqlite store writes and reads import history', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-sqlite-'));
  const dbPath = path.join(tempDir, 'rbfa.db');

  initDatabase(dbPath);

  saveImportHistory({
    xmlPath: 'C:/Exports/library.xml',
    parsedAt: '2026-02-04T17:00:00.000Z',
    trackCount: 123,
    playlistCount: 11,
    folderCount: 6,
    selectedFolders: ['ROOT/Techno']
  });

  const recent = getRecentImports(5);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].xmlPath, 'C:/Exports/library.xml');
  assert.deepEqual(recent[0].selectedFolders, ['ROOT/Techno']);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});
