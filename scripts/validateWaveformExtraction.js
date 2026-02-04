import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseRekordboxXml } from '../src/parser/rekordboxParser.js';

function printUsage() {
  console.log('Usage: node scripts/validateWaveformExtraction.js --xml /path/to/rekordbox.xml');
}

function parseArgs(argv) {
  const options = { xmlPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--xml' && argv[index + 1]) {
      options.xmlPath = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

function toPercent(part, total) {
  if (!total) {
    return '0.00';
  }
  return ((part / total) * 100).toFixed(2);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.xmlPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const xmlPath = path.resolve(options.xmlPath);
  const xml = await fs.readFile(xmlPath, 'utf8');
  const library = parseRekordboxXml(xml);
  const tracks = library.tracks;

  const withTempo = tracks.filter((track) => (track.nestedTempoPoints || []).length > 0);
  const withMarks = tracks.filter((track) => (track.nestedPositionMarks || []).length > 0);
  const withColoredMarks = tracks.filter((track) => (track.nestedPositionMarks || [])
    .some((mark) => Number.isFinite(Number(mark?.color?.red))
      && Number.isFinite(Number(mark?.color?.green))
      && Number.isFinite(Number(mark?.color?.blue))));
  const withLoopMarks = tracks.filter((track) => (track.nestedPositionMarks || [])
    .some((mark) => String(mark?.type || '') === '4'));

  const tempoPointCount = tracks.reduce((sum, track) => sum + (track.nestedTempoPoints || []).length, 0);
  const markCount = tracks.reduce((sum, track) => sum + (track.nestedPositionMarks || []).length, 0);
  const coloredMarkCount = tracks.reduce(
    (sum, track) => sum + (track.nestedPositionMarks || []).filter((mark) => Number.isFinite(Number(mark?.color?.red))
      && Number.isFinite(Number(mark?.color?.green))
      && Number.isFinite(Number(mark?.color?.blue))).length,
    0
  );

  const uppercaseTagCounts = new Map();
  for (const match of xml.matchAll(/<([A-Z_]+)\b/g)) {
    const tag = match[1];
    uppercaseTagCounts.set(tag, (uppercaseTagCounts.get(tag) || 0) + 1);
  }

  const topTags = Array.from(uppercaseTagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const likelyWaveTags = ['WAVEFORM', 'WAVEFORM_PREVIEW', 'WAVE', 'BEATGRID', 'PHRASE']
    .map((tag) => ({ tag, count: uppercaseTagCounts.get(tag) || 0 }));

  console.log(`[wave-validate] xml=${xmlPath}`);
  console.log(`[wave-validate] tracks=${tracks.length}`);
  console.log(`[wave-validate] withTempo=${withTempo.length} (${toPercent(withTempo.length, tracks.length)}%) tempoPoints=${tempoPointCount}`);
  console.log(`[wave-validate] withPositionMarks=${withMarks.length} (${toPercent(withMarks.length, tracks.length)}%) marks=${markCount}`);
  console.log(`[wave-validate] withColoredMarks=${withColoredMarks.length} (${toPercent(withColoredMarks.length, tracks.length)}%) coloredMarks=${coloredMarkCount}`);
  console.log(`[wave-validate] withLoopMarks(Type=4)=${withLoopMarks.length} (${toPercent(withLoopMarks.length, tracks.length)}%)`);

  console.log('[wave-validate] likelyWaveTags');
  for (const entry of likelyWaveTags) {
    console.log(`- ${entry.tag}: ${entry.count}`);
  }

  console.log('[wave-validate] topUppercaseTags');
  for (const [tag, count] of topTags) {
    console.log(`- ${tag}: ${count}`);
  }
}

main().catch((error) => {
  console.error(`[wave-validate] ${error.message}`);
  process.exitCode = 1;
});
