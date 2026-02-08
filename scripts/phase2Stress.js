import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { filterTracksByFolders } from '../src/services/libraryService.js';
import { runBaselineAnalysis } from '../src/services/baselineAnalyzerService.js';
import { startBackgroundParse } from '../src/services/parseService.js';
import { closeDatabase, initDatabase } from '../src/state/sqliteStore.js';

function parseArgs(argv) {
  const options = {
    xmlPath: null,
    folders: [],
    maxPairs: 200000,
    topLimit: 50,
    dbPath: path.resolve('.planning/rbfa-stress.db')
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--xml' && argv[index + 1]) {
      options.xmlPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--folders' && argv[index + 1]) {
      options.folders = argv[index + 1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (token === '--max-pairs' && argv[index + 1]) {
      options.maxPairs = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--top-limit' && argv[index + 1]) {
      options.topLimit = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--db' && argv[index + 1]) {
      options.dbPath = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

function formatDurationMs(value) {
  const totalMs = Math.round(value);
  const seconds = Math.floor(totalMs / 1000);
  const remainingMs = totalMs % 1000;
  return `${seconds}.${String(remainingMs).padStart(3, '0')}s`;
}

function memorySnapshot(label) {
  const usage = process.memoryUsage();
  const toMb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
  console.log(`[memory:${label}] rss=${toMb(usage.rss)}MB heapUsed=${toMb(usage.heapUsed)}MB heapTotal=${toMb(usage.heapTotal)}MB`);
}

function printUsage() {
  console.log('Phase 2 Stress Usage:');
  console.log('  node scripts/phase2Stress.js --xml /path/to/rekordbox.xml [--folders "ROOT/Techno,ROOT/House"] [--max-pairs 200000] [--top-limit 50] [--db .planning/rbfa-stress.db]');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.xmlPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!Number.isFinite(options.maxPairs) || options.maxPairs <= 0) {
    throw new Error('max-pairs must be a positive number.');
  }

  const xmlPath = path.resolve(options.xmlPath);
  initDatabase(options.dbPath);

  console.log(`[stress] xml=${xmlPath}`);
  console.log(`[stress] db=${options.dbPath}`);
  console.log(`[stress] folders=${options.folders.length ? options.folders.join(', ') : '(all)'}`);
  console.log(`[stress] maxPairs=${options.maxPairs} topLimit=${options.topLimit}`);

  memorySnapshot('start');

  const parseStart = performance.now();
  const library = await startBackgroundParse(xmlPath, () => {});
  const parseEnd = performance.now();
  memorySnapshot('after-parse');

  const tracks = filterTracksByFolders(library, options.folders);
  const totalPairs = (tracks.length * (tracks.length - 1)) / 2;
  console.log(`[stress] tracks=${tracks.length} totalPairs=${totalPairs}`);

  const coldStart = performance.now();
  const cold = await runBaselineAnalysis({
    tracks,
    sourceXmlPath: xmlPath,
    selectedFolders: options.folders,
    maxPairs: options.maxPairs,
    topLimit: options.topLimit
  });
  const coldEnd = performance.now();
  memorySnapshot('after-cold');

  const warmStart = performance.now();
  const warm = await runBaselineAnalysis({
    tracks,
    sourceXmlPath: xmlPath,
    selectedFolders: options.folders,
    maxPairs: options.maxPairs,
    topLimit: options.topLimit
  });
  const warmEnd = performance.now();
  memorySnapshot('after-warm');

  console.log(`[timing] parse=${formatDurationMs(parseEnd - parseStart)} cold=${formatDurationMs(coldEnd - coldStart)} warm=${formatDurationMs(warmEnd - warmStart)}`);
  console.log(`[cold] pairs=${cold.pairCount} computed=${cold.computed} cacheHits=${cold.cacheHits}`);
  console.log(`[warm] pairs=${warm.pairCount} computed=${warm.computed} cacheHits=${warm.cacheHits}`);

  closeDatabase();
}

main().catch((error) => {
  console.error(`[stress] ${error.message}`);
  closeDatabase();
  process.exitCode = 1;
});
