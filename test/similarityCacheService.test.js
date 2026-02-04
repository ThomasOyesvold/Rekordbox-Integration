import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initDatabase, closeDatabase } from '../src/state/sqliteStore.js';
import {
  beginAnalysisRun,
  createTrackSignature,
  finishAnalysisRun,
  getSimilarityFromCache,
  saveSimilarityToCache,
  upsertTrackSignatures
} from '../src/services/similarityCacheService.js';

test('similarity cache service creates signatures and reuses cache keys', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-sim-'));
  const dbPath = path.join(tempDir, 'rbfa.db');
  initDatabase(dbPath);

  const signatureResult = createTrackSignature({
    artist: 'Artist A',
    title: 'Track One',
    bpm: 126,
    key: '8A',
    durationSeconds: 322,
    genre: 'Techno'
  });

  assert.equal(signatureResult.signature.length, 40);

  upsertTrackSignatures([
    { id: '1', artist: 'Artist A', title: 'Track One', bpm: 126, key: '8A', durationSeconds: 322, genre: 'Techno' },
    { id: '2', artist: 'Artist B', title: 'Track Two', bpm: 124, key: '9A', durationSeconds: 301, genre: 'House' }
  ]);

  const runId = beginAnalysisRun({
    algorithmVersion: 'flow-v1',
    sourceXmlPath: 'C:/Exports/library.xml',
    selectedFolders: ['ROOT/Techno'],
    trackCount: 2
  });

  saveSimilarityToCache({
    trackAId: '2',
    trackBId: '1',
    algorithmVersion: 'flow-v1',
    score: 0.77,
    components: { bpm: 0.8, key: 0.7 },
    analysisRunId: runId
  });

  const cached = getSimilarityFromCache({
    trackAId: '1',
    trackBId: '2',
    algorithmVersion: 'flow-v1'
  });

  assert.ok(cached);
  assert.equal(cached.score, 0.77);
  assert.equal(cached.components.key, 0.7);

  finishAnalysisRun(runId, 'completed', 'service test done');

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});
