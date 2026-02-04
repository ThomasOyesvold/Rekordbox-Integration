import path from 'node:path';
import process from 'node:process';
import { filterTracksByFolders, summarizeLibrary } from './services/libraryService.js';
import { startBackgroundParse } from './services/parseService.js';
import { saveState } from './state/stateStore.js';

function printUsage() {
  console.log('Usage: node src/index.js parse <path-to-rekordbox.xml> [folder ...]');
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

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
