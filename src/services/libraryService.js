function toFolderSegments(folderPath) {
  return folderPath.split('/').filter(Boolean);
}

export function summarizeLibrary(library) {
  return {
    trackCount: library.tracks.length,
    playlistCount: library.playlists.length,
    folderCount: library.folders.length
  };
}

export function filterTracksByFolders(library, selectedFolders) {
  if (!Array.isArray(selectedFolders) || selectedFolders.length === 0) {
    return library.tracks;
  }

  const selected = selectedFolders.map((folder) => folder.trim()).filter(Boolean);
  const includedTrackIds = new Set();

  for (const playlist of library.playlists) {
    const includePlaylist = selected.some((folderPath) => {
      return playlist.path === folderPath || playlist.path.startsWith(`${folderPath}/`);
    });

    if (!includePlaylist) {
      continue;
    }

    for (const trackId of playlist.trackIds) {
      includedTrackIds.add(trackId);
    }
  }

  return library.tracks.filter((track) => includedTrackIds.has(track.id));
}

export function buildFolderTree(folders) {
  const root = {
    name: 'ROOT',
    path: '',
    children: []
  };

  const pathToNode = new Map([['', root]]);

  for (const folderPath of folders) {
    const segments = toFolderSegments(folderPath);
    let currentPath = '';

    for (const segment of segments) {
      const nextPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!pathToNode.has(nextPath)) {
        const node = {
          name: segment,
          path: nextPath,
          children: []
        };

        pathToNode.set(nextPath, node);
        pathToNode.get(currentPath).children.push(node);
      }

      currentPath = nextPath;
    }
  }

  return root;
}
