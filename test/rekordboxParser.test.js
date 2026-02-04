import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseRekordboxXml } from '../src/parser/rekordboxParser.js';

const fixturePath = path.resolve('test/fixtures/rekordbox-sample.xml');

test('parseRekordboxXml parses collection tracks and playlists', async () => {
  const xml = await fs.readFile(fixturePath, 'utf8');
  const library = parseRekordboxXml(xml);

  assert.equal(library.tracks.length, 2);
  assert.equal(library.playlists.length, 1);
  assert.deepEqual(library.folders, ['ROOT', 'ROOT/Techno']);

  const trackTwo = library.tracks.find((track) => track.id === '2');
  assert.equal(trackTwo.title, 'Track & Two');
  assert.equal(trackTwo.bpm, 124.5);
  assert.equal(trackTwo.location, 'C:/Music/Artist B/Track Two.mp3');
});

test('parseRekordboxXml rejects non-Rekordbox XML', () => {
  assert.throws(() => parseRekordboxXml('<root></root>'), /Not a Rekordbox XML export/);
});
