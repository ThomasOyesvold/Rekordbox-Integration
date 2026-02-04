import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startBackgroundParse } from '../src/services/parseService.js';

const fixturePath = path.resolve('test/fixtures/rekordbox-sample.xml');

test('startBackgroundParse parses XML in worker and emits progress', async () => {
  const progressPoints = [];
  const library = await startBackgroundParse(fixturePath, (progress) => {
    progressPoints.push(progress);
  });

  assert.equal(library.tracks.length, 2);
  assert.ok(progressPoints.length > 0);
  assert.equal(progressPoints.at(-1), 100);
});
