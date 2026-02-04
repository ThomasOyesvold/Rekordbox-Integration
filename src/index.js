import path from 'node:path';
import process from 'node:process';
import { filterTracksByFolders, summarizeLibrary } from './services/libraryService.js';
import { runBaselineAnalysis } from './services/baselineAnalyzerService.js';
import { startBackgroundParse } from './services/parseService.js';
import { initDatabase } from './state/sqliteStore.js';
import { saveState } from './state/stateStore.js';

function printUsage() {
  console.log('Usage:');
  console.log('  node src/index.js parse <path-to-rekordbox.xml> [folder ...]');
  console.log('  node src/index.js analyze <path-to-rekordbox.xml> [folder ...]');
}

async function runParseCommand(args) {
  const xmlPath = args[0];
  const selectedFolders = args.slice(1);

  if (!xmlPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(`Parsing: ${xmlPath}`);

  let lastPrinted = -1;
  const library = await startBackgroundParse(xmlPath, (progress) => {
    if (progress !== lastPrinted) {
      console.log(`Progress: ${progress}%`);
      lastPrinted = progress;
    }
  });

  const summary = summarizeLibrary(library);
  console.log(`Tracks: ${summary.trackCount}`);
  console.log(`Playlists: ${summary.playlistCount}`);
  console.log(`Folders: ${summary.folderCount}`);

  if (selectedFolders.length > 0) {
    const filteredTracks = filterTracksByFolders(library, selectedFolders);
    console.log(`Selected folders: ${selectedFolders.join(', ')}`);
    console.log(`Filtered tracks: ${filteredTracks.length}`);
  }

  await saveState(path.resolve('.planning/app-state.json'), {
    lastLibraryPath: path.resolve(xmlPath),
    selectedFolders
  });

  console.log('State saved to .planning/app-state.json');
}

async function runAnalyzeCommand(args) {
  const xmlPath = args[0];
  const selectedFolders = args.slice(1);

  if (!xmlPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  initDatabase(path.resolve('.planning/rbfa.db'));
  const library = await startBackgroundParse(xmlPath, () => {});
  const tracks = filterTracksByFolders(library, selectedFolders);

  const summary = runBaselineAnalysis({
    tracks,
    sourceXmlPath: path.resolve(xmlPath),
    selectedFolders,
    maxPairs: 5000,
    topLimit: 10
  });

  console.log(`Analysis run: ${summary.runId}`);
  console.log(`Pairs: ${summary.pairCount}`);
  console.log(`Computed: ${summary.computed}`);
  console.log(`Cache hits: ${summary.cacheHits}`);
  console.log('Top matches:');
  for (const row of summary.topMatches) {
    console.log(`- ${row.trackAId} <> ${row.trackBId}: ${row.score.toFixed(3)} (${row.fromCache ? 'cache' : 'computed'})`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === 'parse') {
    await runParseCommand(args);
    return;
  }

  if (command === 'analyze') {
    await runAnalyzeCommand(args);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
