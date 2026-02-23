function toFolderSegments(folderPath) {
  return folderPath.split('/').filter(Boolean);
}

export function normalizeFolderPath(folderPath) {
  if (typeof folderPath !== 'string') {
    return '';
  }
  return folderPath
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015\u2212\u00ad]/g, '-')
    .normalize('NFKC')
    .split('/')
    .map((segment) => segment.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter(Boolean)
    .join('/');
}

export function summarizeLibrary(library) {
  return {
    trackCount: library.tracks.length,
    playlistCount: library.playlists.length,
    folderCount: library.folders.length
  };
}

export function filterTracksByFolders(library, selectedFolders) {
  const scopedPlaylists = selectPlaylistsByFolders(library.playlists, selectedFolders);
  const includedTrackIds = new Set();

  for (const playlist of scopedPlaylists) {
    for (const trackId of playlist.trackIds) {
      includedTrackIds.add(trackId);
    }
  }

  if (!Array.isArray(selectedFolders) || selectedFolders.length === 0) {
    return library.tracks;
  }

  return library.tracks.filter((track) => includedTrackIds.has(track.id));
}

export function selectPlaylistsByFolders(playlists, selectedFolders) {
  if (!Array.isArray(selectedFolders) || selectedFolders.length === 0) {
    return playlists;
  }

  const selected = selectedFolders
    .map((folder) => normalizeFolderPath(folder))
    .filter(Boolean);

  return playlists.filter((playlist) => {
    const playlistPath = normalizeFolderPath(playlist.path);
    if (!playlistPath) {
      return false;
    }
    return selected.some((folderPath) => {
      return playlistPath === folderPath || playlistPath.startsWith(`${folderPath}/`);
    });
  });
}

export function buildTrackPlaylistIndex(playlists) {
  const index = {};

  for (const playlist of playlists) {
    for (const trackId of playlist.trackIds) {
      if (!index[trackId]) {
        index[trackId] = [];
      }

      index[trackId].push(playlist.path);
    }
  }

  return index;
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
