import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, initDatabase } from '../src/state/sqliteStore.js';
import { generatePlaylistClusters } from '../src/services/playlistClusterService.js';

test('playlist clustering groups similar tracks', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-cluster-'));
  const dbPath = path.join(tempDir, 'rbfa.db');
  initDatabase(dbPath);

  const tracks = [
    { id: 't1', artist: 'A', title: 'One', bpm: 126, key: '8A', durationSeconds: 320, genre: 'Techno' },
    { id: 't2', artist: 'A', title: 'Two', bpm: 126.5, key: '8A', durationSeconds: 318, genre: 'Techno' },
    { id: 't3', artist: 'A', title: 'Three', bpm: 127, key: '8A', durationSeconds: 322, genre: 'Techno' },
    { id: 't4', artist: 'B', title: 'Four', bpm: 140, key: '2B', durationSeconds: 280, genre: 'House' }
  ];

  const result = generatePlaylistClusters({
    tracks,
    similarityThreshold: 0.7,
    minClusterSize: 3,
    maxPairs: 100
  });

  assert.ok(result.clusters.length >= 1);
  const first = result.clusters[0];
  assert.ok(first.size >= 3);
  assert.ok(first.trackIds.includes('t1'));
  assert.ok(first.ordered);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});
