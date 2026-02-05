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
  computeRhythmScore,
  summarizeSimilarityComponents,
  computeWaveformScore,
  computeRhythmPlaceholderScore,
  computeWaveformPlaceholderScore,
  runBaselineAnalysis
} from '../src/services/baselineAnalyzerService.js';

const SAMPLE_TRACKS = [
  { id: '1', artist: 'A', title: 'One', bpm: 126, key: '8A', durationSeconds: 320, genre: 'Techno' },
  { id: '2', artist: 'B', title: 'Two', bpm: 127, key: '8A', durationSeconds: 310, genre: 'Techno' },
  { id: '3', artist: 'C', title: 'Three', bpm: 132, key: '11B', durationSeconds: 330, genre: 'House' }
];

const NESTED_TRACKS = [
  {
    id: 'n1',
    artist: 'Nested A',
    title: 'Driver',
    bpm: 128,
    key: '9A',
    durationSeconds: 360,
    nestedTempoPoints: [
      { inizio: 0, bpm: 128, battito: 1 },
      { inizio: 90, bpm: 128, battito: 1 }
    ],
    nestedPositionMarks: [
      { start: 32, color: { red: 40, green: 120, blue: 220 } },
      { start: 128, color: { red: 80, green: 140, blue: 200 } }
    ]
  },
  {
    id: 'n2',
    artist: 'Nested B',
    title: 'Follower',
    bpm: 128.2,
    key: '9A',
    durationSeconds: 362,
    nestedTempoPoints: [
      { inizio: 0, bpm: 128.1, battito: 1 },
      { inizio: 90.5, bpm: 128.2, battito: 1 }
    ],
    nestedPositionMarks: [
      { start: 33, color: { red: 44, green: 119, blue: 219 } },
      { start: 129, color: { red: 79, green: 138, blue: 202 } }
    ]
  },
  {
    id: 'n3',
    artist: 'Nested C',
    title: 'Contrast',
    bpm: 136,
    key: '2B',
    durationSeconds: 300,
    nestedTempoPoints: [
      { inizio: 0, bpm: 136, battito: 3 },
      { inizio: 60, bpm: 136, battito: 2 }
    ],
    nestedPositionMarks: [
      { start: 10, color: { red: 220, green: 60, blue: 40 } },
      { start: 200, color: { red: 200, green: 70, blue: 20 } }
    ]
  }
];

test('baseline analyzer score functions behave as expected', () => {
  assert.equal(computeBpmScore(126, 126), 1);
  assert.equal(computeBpmScore(126, 130), 0.75);
  assert.equal(computeKeyScore('8A', '8A'), 1);
  assert.equal(computeKeyScore('8A', '8B'), 0.85);
  assert.ok(computeWaveformScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]) > computeWaveformScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[2]));
  assert.ok(computeRhythmScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]) > computeRhythmScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[2]));
  assert.ok(computeWaveformPlaceholderScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]) >= 0);
  assert.ok(computeRhythmPlaceholderScore(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]) >= 0);

  const result = computeBaselineSimilarity(SAMPLE_TRACKS[0], SAMPLE_TRACKS[1]);
  assert.ok(result.score >= 0 && result.score <= 1);
  assert.equal(result.components.key, 1);
  assert.ok(result.components.waveform >= 0);
  assert.ok(result.components.rhythm >= 0);
  assert.equal(result.weights.bpm, DEFAULT_COMPONENT_WEIGHTS.bpm);
  assert.match(summarizeSimilarityComponents(result.components), /BPM/i);
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
  assert.equal(first.algorithmVersion, 'flow-baseline-v3');
  assert.ok(first.topMatches[0].components.waveform >= 0);
  assert.ok(first.topMatches[0].components.rhythm >= 0);
  assert.equal(typeof first.topMatches[0].reason, 'string');

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

test('baseline analyzer uses nested Rekordbox metadata in waveform and rhythm scores', () => {
  const waveformClose = computeWaveformScore(NESTED_TRACKS[0], NESTED_TRACKS[1]);
  const waveformFar = computeWaveformScore(NESTED_TRACKS[0], NESTED_TRACKS[2]);
  const rhythmClose = computeRhythmScore(NESTED_TRACKS[0], NESTED_TRACKS[1]);
  const rhythmFar = computeRhythmScore(NESTED_TRACKS[0], NESTED_TRACKS[2]);

  assert.ok(waveformClose > waveformFar);
  assert.ok(rhythmClose > rhythmFar);
});

test('baseline analyzer uses ANLZ waveform rhythm signature when available', () => {
  const trackA = {
    id: 'r1',
    bpm: 128,
    key: '8A',
    durationSeconds: 360,
    anlzWaveform: {
      bins: [0, 2, 6, 12, 6, 2, 0, 2, 7, 13, 7, 2, 0, 1, 5, 11],
      avgColor: { red: 20, green: 40, blue: 200 },
      durationSeconds: 360
    }
  };

  const trackB = {
    id: 'r2',
    bpm: 128,
    key: '8A',
    durationSeconds: 362,
    anlzWaveform: {
      bins: [0, 2, 7, 11, 6, 2, 0, 2, 6, 12, 7, 2, 0, 1, 4, 10],
      avgColor: { red: 19, green: 41, blue: 198 },
      durationSeconds: 362
    }
  };

  const trackC = {
    id: 'r3',
    bpm: 128,
    key: '8A',
    durationSeconds: 300,
    anlzWaveform: {
      bins: [12, 11, 9, 7, 5, 4, 3, 2, 3, 4, 6, 8, 9, 10, 11, 12],
      avgColor: { red: 220, green: 80, blue: 10 },
      durationSeconds: 300
    }
  };

  const rhythmClose = computeRhythmScore(trackA, trackB);
  const rhythmFar = computeRhythmScore(trackA, trackC);

  assert.ok(rhythmClose > rhythmFar);
});

test('baseline analyzer prefers ANLZ waveform summaries when present', () => {
  const trackA = {
    id: 'a',
    bpm: 125,
    key: '8A',
    durationSeconds: 360,
    anlzWaveform: {
      bins: [2, 4, 8, 12, 8, 4, 2],
      avgColor: { red: 20, green: 40, blue: 200 },
      durationSeconds: 360
    }
  };

  const trackB = {
    id: 'b',
    bpm: 125,
    key: '8A',
    durationSeconds: 361,
    anlzWaveform: {
      bins: [2, 5, 8, 11, 8, 4, 2],
      avgColor: { red: 18, green: 41, blue: 198 },
      durationSeconds: 361
    }
  };

  const trackC = {
    id: 'c',
    bpm: 125,
    key: '8A',
    durationSeconds: 300,
    anlzWaveform: {
      bins: [25, 22, 20, 18, 16, 14, 12],
      avgColor: { red: 220, green: 80, blue: 10 },
      durationSeconds: 300
    }
  };

  assert.ok(computeWaveformScore(trackA, trackB) > computeWaveformScore(trackA, trackC));
});
