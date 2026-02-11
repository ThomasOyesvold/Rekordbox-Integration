import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseRekordboxXml } from '../src/parser/rekordboxParser.js';

const fixturePath = path.resolve('test/fixtures/rekordbox-sample.xml');
const edgeFixturePath = path.resolve('test/fixtures/rekordbox-edge-playlists.xml');
const duplicateTrackFixturePath = path.resolve('test/fixtures/rekordbox-duplicate-trackid.xml');
const nestedTrackFixturePath = path.resolve('test/fixtures/rekordbox-nested-track.xml');

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

test('parseRekordboxXml parses edge playlist fixture and keeps non-fatal warnings', async () => {
  const xml = await fs.readFile(edgeFixturePath, 'utf8');
  const library = parseRekordboxXml(xml);

  assert.equal(library.tracks.length, 3);
  assert.equal(library.playlists.length, 2);
  assert.deepEqual(library.folders, ['ROOT', 'ROOT/Warmup']);
  assert.ok(library.validation.issues.some((issue) => issue.code === 'DANGLING_TRACK_REFERENCE'));
});

test('parseRekordboxXml reports non-fatal warnings for malformed fields', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <COLLECTION Entries="2">
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
  assert.ok(codes.includes('INVALID_COLLECTION_ENTRIES'));
  assert.ok(codes.includes('DANGLING_TRACK_REFERENCE'));
});

test('parseRekordboxXml treats duplicate track ids as fatal', async () => {
  const xml = await fs.readFile(duplicateTrackFixturePath, 'utf8');

  assert.throws(() => parseRekordboxXml(xml), (error) => {
    assert.match(error.message, /validation errors/i);
    assert.ok(Array.isArray(error.issues));
    assert.ok(error.issues.some((issue) => issue.code === 'DUPLICATE_TRACK_ID' && issue.severity === 'error'));
    return true;
  });
});

test('parseRekordboxXml parses nested track metadata blocks', async () => {
  const xml = await fs.readFile(nestedTrackFixturePath, 'utf8');
  const library = parseRekordboxXml(xml);
  assert.equal(library.validation.issues.some((issue) => issue.code === 'NESTED_TRACK_DATA_UNSUPPORTED'), false);
  assert.equal(library.tracks.length, 1);
  assert.equal(library.tracks[0].nestedTempoPoints.length, 1);
  assert.equal(library.tracks[0].nestedTempoPoints[0].bpm, 126);
  assert.equal(library.tracks[0].nestedPositionMarks.length, 1);
  assert.equal(library.tracks[0].nestedPositionMarks[0].name, 'Cue');
  assert.equal(library.tracks[0].nestedTagSummary.total, 1);
  assert.equal(library.tracks[0].nestedTagSummary.tags.CUE, 1);
});

test('parseRekordboxXml reports playlist node structure warnings', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <COLLECTION Entries="1">
    <TRACK TrackID="1" Name="T" Artist="A" Location="file://localhost/C:/Music/Track.mp3" />
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="1" Name="ROOT" Count="1">
      <NODE Type="7" Name="" Count="1">
        <NODE Type="0" Name="Empty Playlist" Entries="0"></NODE>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

  const library = parseRekordboxXml(xml);
  const codes = library.validation.issues.map((issue) => issue.code);

  assert.ok(codes.includes('INVALID_NODE_TYPE'));
  assert.ok(codes.includes('MISSING_NODE_NAME'));
  assert.ok(codes.includes('PLAYLIST_WITHOUT_TRACKS'));
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
