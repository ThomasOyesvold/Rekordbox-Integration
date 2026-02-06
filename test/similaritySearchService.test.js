import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, initDatabase } from '../src/state/sqliteStore.js';
import { findSimilarTracks } from '../src/services/similaritySearchService.js';

test('similarity search returns top matches for a target track', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-similar-'));
  const dbPath = path.join(tempDir, 'rbfa.db');
  initDatabase(dbPath);

  const tracks = [
    { id: 's1', artist: 'A', title: 'One', bpm: 126, key: '8A', durationSeconds: 320, genre: 'Techno' },
    { id: 's2', artist: 'A', title: 'Two', bpm: 126.4, key: '8A', durationSeconds: 322, genre: 'Techno' },
    { id: 's3', artist: 'B', title: 'Three', bpm: 138, key: '2B', durationSeconds: 280, genre: 'House' }
  ];

  const result = findSimilarTracks({
    tracks,
    targetId: 's1',
    limit: 5,
    minScore: 0.6
  });

  assert.ok(result.matches.length >= 1);
  assert.equal(result.targetId, 's1');
  assert.ok(result.matches[0].score >= result.minScore);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});
