import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initDatabase, closeDatabase } from '../src/state/sqliteStore.js';
import { attachAnlzWaveformSummaries } from '../src/services/anlzWaveformService.js';

function encodeWord(red3, green3, blue3, height) {
  return ((red3 & 0x07) << 13)
    | ((green3 & 0x07) << 10)
    | ((blue3 & 0x07) << 7)
    | ((height & 0x1F) << 2);
}

function createCompactPwv5Ext(words) {
  const payload = Buffer.alloc(words.length * 2);
  words.forEach((word, index) => payload.writeUInt16BE(word, index * 2));
  const section = Buffer.alloc(8 + payload.length);
  section.write('PWV5', 0, 'ascii');
  section.writeUInt32BE(payload.length, 4);
  payload.copy(section, 8);
  return Buffer.concat([Buffer.from('PMAI', 'ascii'), Buffer.alloc(4), section]);
}

test('ANLZ waveform service reuses SQLite cache between calls', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbfa-anlz-'));
  const dbPath = path.join(tempDir, 'rbfa.db');
  const extPath = path.join(tempDir, 'ANLZ0000.EXT');
  const mapPath = path.join(tempDir, 'map.json');

  initDatabase(dbPath);

  const extData = createCompactPwv5Ext([
    encodeWord(7, 0, 0, 31),
    encodeWord(0, 7, 0, 16),
    encodeWord(0, 0, 7, 8),
    encodeWord(7, 7, 7, 4)
  ]);
  await fs.writeFile(extPath, extData);
  await fs.writeFile(
    mapPath,
    JSON.stringify({
      mapping: {
        t1: { extPath }
      }
    }),
    'utf8'
  );

  const tracksFirst = [{ id: 't1' }];
  const first = await attachAnlzWaveformSummaries(tracksFirst, { mappingPath: mapPath });
  assert.equal(first.attached, 1);
  assert.equal(first.cacheHits, 0);
  assert.equal(first.parsedFromFile, 1);
  assert.ok(tracksFirst[0].anlzWaveform);
  assert.ok(Array.isArray(tracksFirst[0].anlzWaveform.rhythmSignature));
  assert.ok(Array.isArray(tracksFirst[0].anlzWaveform.kickSignature));

  const tracksSecond = [{ id: 't1' }];
  const second = await attachAnlzWaveformSummaries(tracksSecond, { mappingPath: mapPath });
  assert.equal(second.attached, 1);
  assert.equal(second.cacheHits, 1);
  assert.equal(second.parsedFromFile, 0);
  assert.ok(tracksSecond[0].anlzWaveform);

  closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});
