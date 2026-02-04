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
  assert.equal(library.validation.warningCount, 0);
});

test('parseRekordboxXml rejects non-Rekordbox XML', () => {
  assert.throws(() => parseRekordboxXml('<root></root>'), /Not a Rekordbox XML export/);
});

test('parseRekordboxXml reports non-fatal warnings for malformed fields', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <COLLECTION Entries="1">
    <TRACK TrackID="1" Name="T" Artist="A" AverageBpm="fast" TotalTime="NaN" BitRate="x" Location="file://localhost/C:/Music/Track%2FOne.mp3" />
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="1" Name="ROOT" Count="1">
      <NODE Type="0" Name="Set 1" Entries="1">
        <TRACK Key="99"/>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

  const library = parseRekordboxXml(xml);
  const codes = library.validation.issues.map((issue) => issue.code);

  assert.ok(codes.includes('INVALID_BPM'));
  assert.ok(codes.includes('INVALID_DURATION'));
  assert.ok(codes.includes('INVALID_BITRATE'));
  assert.ok(codes.includes('SUSPICIOUS_LOCATION_ENCODING'));
  assert.ok(codes.includes('DANGLING_TRACK_REFERENCE'));
});

test('parseRekordboxXml throws structured validation error for missing collection', () => {
  try {
    parseRekordboxXml('<DJ_PLAYLISTS></DJ_PLAYLISTS>');
    assert.fail('Expected parser to throw.');
  } catch (error) {
    assert.match(error.message, /validation errors/i);
    assert.ok(Array.isArray(error.issues));
    assert.equal(error.issues[0].code, 'MISSING_COLLECTION');
  }
});
