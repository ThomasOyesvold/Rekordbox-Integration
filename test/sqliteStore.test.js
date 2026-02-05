import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  closeDatabase,
  completeAnalysisRun,
  createAnalysisRun,
  getAnlzWaveformSummary,
  getAnalysisRun,
  getCachedSimilarity,
  getRecentImports,
  getTrackSignature,
  initDatabase,
  loadAppState,
  saveAnlzWaveformSummary,
  saveAppState,
  saveImportHistory,
  saveSimilarityScore,
  upsertTrackSignature
} from '../src/state/sqliteStore.js';

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

test('sqlite store caches signatures and similarity scores with analysis runs', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-sqlite-'));
  const dbPath = path.join(tempDir, 'rbfa.db');

  initDatabase(dbPath);

  const runId = createAnalysisRun({
    algorithmVersion: 'flow-v1',
    sourceXmlPath: 'C:/Exports/library.xml',
    selectedFolders: ['ROOT/Techno'],
    trackCount: 2
  });

  upsertTrackSignature({
    trackId: '2',
    signature: 'sig-two',
    signatureVersion: 'v1',
    bpm: 124,
    musicalKey: '9A',
    durationSeconds: 301
  });

  upsertTrackSignature({
    trackId: '1',
    signature: 'sig-one',
    signatureVersion: 'v1',
    bpm: 126,
    musicalKey: '8A',
    durationSeconds: 322
  });

  const savedSignature = getTrackSignature('1');
  assert.equal(savedSignature.signature, 'sig-one');

  saveSimilarityScore({
    trackAId: '2',
    trackBId: '1',
    algorithmVersion: 'flow-v1',
    score: 0.88,
    components: { bpm: 0.9, key: 0.8 },
    analysisRunId: runId
  });

  const cached = getCachedSimilarity({
    trackAId: '1',
    trackBId: '2',
    algorithmVersion: 'flow-v1'
  });

  assert.ok(cached);
  assert.equal(cached.trackAId, '1');
  assert.equal(cached.trackBId, '2');
  assert.equal(cached.score, 0.88);
  assert.equal(cached.components.bpm, 0.9);

  completeAnalysisRun(runId, 'completed', 'ok');
  const run = getAnalysisRun(runId);
  assert.equal(run.status, 'completed');
  assert.ok(run.completedAt);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('sqlite store persists app state', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-sqlite-'));
  const dbPath = path.join(tempDir, 'rbfa.db');

  initDatabase(dbPath);

  const state = {
    lastLibraryPath: 'C:/Exports/library.xml',
    selectedFolders: ['ROOT/Techno'],
    updatedAt: '2026-02-05T00:00:00.000Z'
  };

  saveAppState(state);
  const loaded = loadAppState();

  assert.ok(loaded);
  assert.equal(loaded.lastLibraryPath, 'C:/Exports/library.xml');
  assert.deepEqual(loaded.selectedFolders, ['ROOT/Techno']);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('sqlite store caches ANLZ waveform summaries by ext path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-sqlite-'));
  const dbPath = path.join(tempDir, 'rbfa.db');

  initDatabase(dbPath);

  saveAnlzWaveformSummary({
    extPath: '/tmp/USBANLZ/000/abc/ANLZ0000.EXT',
    sampleCount: 12000,
    durationSeconds: 80,
    avgColor: { red: 12, green: 18, blue: 180 },
    height: { avg: 11.3, max: 31 },
    bins: [1, 2, 3, 4],
    binColors: [
      { red: 1, green: 2, blue: 3 },
      { red: 4, green: 5, blue: 6 }
    ]
  });

  const cached = getAnlzWaveformSummary('/tmp/USBANLZ/000/abc/ANLZ0000.EXT');
  assert.ok(cached);
  assert.equal(cached.sampleCount, 12000);
  assert.equal(cached.avgColor.blue, 180);
  assert.equal(cached.height.max, 31);
  assert.deepEqual(cached.bins, [1, 2, 3, 4]);
  assert.equal(cached.binColors[0].blue, 3);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});
