import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalysisCsv,
  buildAnalysisExportRows,
  buildAnalysisJson
} from '../src/services/analysisExportService.js';

const ANALYSIS_RESULT = {
  algorithmVersion: 'flow-baseline-v3',
  pairCount: 2,
  cacheHits: 1,
  computed: 1,
  weights: { bpm: 0.35, key: 0.35, waveform: 0.15, rhythm: 0.15 },
  topMatches: [
    {
      trackAId: '1',
      trackBId: '2',
      score: 0.912345,
      components: { bpm: 0.9, key: 1, waveform: 0.85, rhythm: 0.8 },
      reason: 'BPM strong, key strong',
      fromCache: false
    }
  ]
};

const TRACK_INDEX = {
  '1': { artist: 'Artist A', title: 'Track A', bpm: 128, key: '8A' },
  '2': { artist: 'Artist B', title: 'Track B', bpm: 129, key: '8A' }
};

test('analysis export rows include track metadata and normalized scores', () => {
  const rows = buildAnalysisExportRows(ANALYSIS_RESULT, TRACK_INDEX);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].trackAArtist, 'Artist A');
  assert.equal(rows[0].trackBTitle, 'Track B');
  assert.equal(rows[0].score, '0.912345');
  assert.equal(rows[0].source, 'computed');
});

test('analysis CSV export builds header and escaped rows', () => {
  const csv = buildAnalysisCsv(ANALYSIS_RESULT, TRACK_INDEX);
  assert.match(csv, /trackAId,trackAArtist,trackATitle/);
  assert.match(csv, /Artist A/);
  assert.match(csv, /0.912345/);
  assert.ok(csv.endsWith('\n'));
});

test('analysis JSON export contains run metadata and rows', () => {
  const json = JSON.parse(buildAnalysisJson(ANALYSIS_RESULT, TRACK_INDEX));
  assert.equal(json.algorithmVersion, 'flow-baseline-v3');
  assert.equal(json.pairCount, 2);
  assert.equal(json.rows.length, 1);
  assert.equal(json.rows[0].trackAKey, '8A');
});
