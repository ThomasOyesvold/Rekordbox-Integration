import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseRekordboxXml } from '../src/parser/rekordboxParser.js';
import { filterTracksByFolders, summarizeLibrary } from '../src/services/libraryService.js';

const fixturePath = path.resolve('test/fixtures/rekordbox-sample.xml');

test('summarizeLibrary reports collection counts', async () => {
  const xml = await fs.readFile(fixturePath, 'utf8');
  const library = parseRekordboxXml(xml);
  const summary = summarizeLibrary(library);

  assert.deepEqual(summary, {
    trackCount: 2,
    playlistCount: 1,
    folderCount: 2
  });
});

test('filterTracksByFolders filters tracks by folder prefix', async () => {
  const xml = await fs.readFile(fixturePath, 'utf8');
  const library = parseRekordboxXml(xml);
  const filtered = filterTracksByFolders(library, ['ROOT/Techno']);

  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].artist, 'Artist A');
});
