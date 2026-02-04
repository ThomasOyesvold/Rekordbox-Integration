import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, initDatabase } from '../src/state/sqliteStore.js';
import {
  DEFAULT_COMPONENT_WEIGHTS,
  computeBaselineSimilarity,
  computeBpmScore,
  computeKeyScore,
  computeRhythmPlaceholderScore,
  computeWaveformPlaceholderScore,
  runBaselineAnalysis
} from '../src/services/baselineAnalyzerService.js';

const SAMPLE_TRACKS = [
  { id: '1', artist: 'A', title: 'One', bpm: 126, key: '8A', durationSeconds: 320, genre: 'Techno' },
  { id: '2', artist: 'B', title: 'Two', bpm: 127, key: '8A', durationSeconds: 310, genre: 'Techno' },
  { id: '3', artist: 'C', title: 'Three', bpm: 132, key: '11B', durationSeconds: 330, genre: 'House' }
];

test('baseline analyzer score functions behave as expected', () => {
  assert.equal(computeBpmScore(126, 126), 1);
  assert.equal(computeBpmScore(126, 130), 0.75);
  assert.equal(computeKeyScore('8A', '8A'), 1);
  assert.equal(computeKeyScore('8A', '8B'), 0.85);
  assert.ok(computeWaveformPlaceholderScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]) >= 0);
  assert.ok(computeRhythmPlaceholderScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]) >= 0);

  const result = computeBaselineSimilarity(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]);
  assert.ok(result.score >= 0 && result.score <= 1);
  assert.equal(result.components.key, 1);
  assert.ok(result.components.waveform >= 0);
  assert.ok(result.components.rhythm >= 0);
  assert.equal(result.weights.bpm, DEFAULT_COMPONENT_WEIGHTS.bpm);
});

test('baseline analyzer computes then reuses cache entries', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-baseline-'));
  const dbPath = path.join(tempDir, 'rbfa.db');
  initDatabase(dbPath);

  const first = runBaselineAnalysis({
    tracks: SAMPLE_TRACKS,
    sourceXmlPath: 'C:/Exports/library.xml',
    selectedFolders: ['ROOT/Techno'],
    maxPairs: 10,
    topLimit: 5
  });

  assert.equal(first.pairCount, 3);
  assert.equal(first.cacheHits, 0);
  assert.equal(first.computed, 3);
  assert.equal(first.topMatches.length, 3);
  assert.equal(first.algorithmVersion, 'flow-baseline-v2');
  assert.ok(first.topMatches[0].components.waveform >= 0);
  assert.ok(first.topMatches[0].components.rhythm >= 0);

  const second = runBaselineAnalysis({
    tracks: SAMPLE_TRACKS,
    sourceXmlPath: 'C:/Exports/library.xml',
    selectedFolders: ['ROOT/Techno'],
    maxPairs: 10,
    topLimit: 5
  });

  assert.equal(second.pairCount, 3);
  assert.equal(second.cacheHits, 3);
  assert.equal(second.computed, 0);
  assert.ok(second.topMatches[0].fromCache);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});
