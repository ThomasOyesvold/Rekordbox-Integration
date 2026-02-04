import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseRekordboxXml } from '../src/parser/rekordboxParser.js';
import {
  buildFolderTree,
  buildTrackPlaylistIndex,
  filterTracksByFolders,
  selectPlaylistsByFolders,
  summarizeLibrary
} from '../src/services/libraryService.js';

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

test('buildFolderTree builds nested folder nodes', () => {
  const tree = buildFolderTree(['ROOT', 'ROOT/Techno', 'ROOT/Techno/Peak Time']);
  const rootNode = tree.children.find((node) => node.path === 'ROOT');

  assert.ok(rootNode);
  assert.equal(rootNode.children.length, 1);
  assert.equal(rootNode.children[0].path, 'ROOT/Techno');
  assert.equal(rootNode.children[0].children[0].path, 'ROOT/Techno/Peak Time');
});

test('selectPlaylistsByFolders scopes playlist set correctly', async () => {
  const xml = await fs.readFile(fixturePath, 'utf8');
  const library = parseRekordboxXml(xml);
  const scoped = selectPlaylistsByFolders(library.playlists, ['ROOT/Techno']);

  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].path, 'ROOT/Techno/Peak Time');
});

test('buildTrackPlaylistIndex maps track ids to playlist paths', async () => {
  const xml = await fs.readFile(fixturePath, 'utf8');
  const library = parseRekordboxXml(xml);
  const index = buildTrackPlaylistIndex(library.playlists);

  assert.deepEqual(index['1'], ['ROOT/Techno/Peak Time']);
  assert.deepEqual(index['2'], ['ROOT/Techno/Peak Time']);
});
