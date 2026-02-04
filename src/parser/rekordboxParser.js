import { parseXmlAttributes } from './xmlAttributes.js';

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseLocation(rawLocation) {
  if (!rawLocation) {
    return '';
  }

  return rawLocation
    .replace(/^file:\/\//i, '')
    .replace(/^localhost\//i, '')
    .replace(/%20/g, ' ');
}

function parseCollection(xmlText) {
  const collectionMatch = /<COLLECTION\b[^>]*>([\s\S]*?)<\/COLLECTION>/i.exec(xmlText);
  if (!collectionMatch) {
    throw new Error('Missing <COLLECTION> section in Rekordbox XML.');
  }

  const collectionBody = collectionMatch[1];
  const trackRegex = /<TRACK\b([^>]*?)(?:\/?)>/gi;
  const tracks = [];
  let match = trackRegex.exec(collectionBody);

  while (match) {
    const attributes = parseXmlAttributes(match[1]);
    const location = parseLocation(attributes.Location || '');
    const id = attributes.TrackID || location || `${attributes.Artist || ''}-${attributes.Name || ''}`;

    tracks.push({
      id,
      trackId: attributes.TrackID || null,
      artist: attributes.Artist || '',
      title: attributes.Name || '',
      album: attributes.Album || '',
      genre: attributes.Genre || '',
      bpm: parseNumber(attributes.AverageBpm),
      key: attributes.Tonality || '',
      durationSeconds: parseNumber(attributes.TotalTime),
      bitrate: parseNumber(attributes.BitRate),
      location
    });

    match = trackRegex.exec(collectionBody);
  }

  return tracks;
}

function parsePlaylists(xmlText) {
  const playlistsMatch = /<PLAYLISTS\b[^>]*>([\s\S]*?)<\/PLAYLISTS>/i.exec(xmlText);
  if (!playlistsMatch) {
    return [];
  }

  const text = playlistsMatch[1];
  const tokenRegex = /<NODE\b([^>]*?)\/?>|<\/NODE>|<TRACK\b([^>]*?)\/?>/gi;
  const stack = [];
  const playlists = [];

  let token = tokenRegex.exec(text);
  while (token) {
    if (token[0].startsWith('</NODE')) {
      const node = stack.pop();

      if (node && node.kind === 'playlist') {
        playlists.push({
          name: node.name,
          path: node.path,
          trackIds: node.trackIds
        });
      }

      token = tokenRegex.exec(text);
      continue;
    }

    if (token[1] !== undefined) {
      const attributes = parseXmlAttributes(token[1]);
      const name = attributes.Name || '';
      const type = attributes.Type || '';
      const isSelfClosing = token[0].endsWith('/>');

      const parentPath = stack.length > 0 ? stack[stack.length - 1].path : '';
      const path = parentPath && name ? `${parentPath}/${name}` : name;

      const kind = type === '0' ? 'playlist' : 'folder';

      const node = {
        name,
        path,
        kind,
        trackIds: []
      };

      if (!isSelfClosing) {
        stack.push(node);
      } else if (kind === 'playlist') {
        playlists.push(node);
      }

      token = tokenRegex.exec(text);
      continue;
    }

    if (token[2] !== undefined) {
      const attributes = parseXmlAttributes(token[2]);
      const trackRef = attributes.Key || attributes.TrackID || attributes.ID;

      if (trackRef) {
        for (let i = stack.length - 1; i >= 0; i -= 1) {
          if (stack[i].kind === 'playlist') {
            stack[i].trackIds.push(trackRef);
            break;
          }
        }
      }

      token = tokenRegex.exec(text);
      continue;
    }

    token = tokenRegex.exec(text);
  }

  return playlists.filter((playlist) => playlist.name && playlist.trackIds.length > 0);
}

function uniqueParentFolders(playlists) {
  const folderSet = new Set();

  for (const playlist of playlists) {
    const segments = playlist.path.split('/').filter(Boolean);

    for (let index = 1; index <= segments.length - 1; index += 1) {
      folderSet.add(segments.slice(0, index).join('/'));
    }
  }

  return Array.from(folderSet).sort();
}

export function parseRekordboxXml(xmlText) {
  if (!xmlText.includes('<DJ_PLAYLISTS')) {
    throw new Error('Not a Rekordbox XML export: missing <DJ_PLAYLISTS> root.');
  }

  const tracks = parseCollection(xmlText);
  const playlists = parsePlaylists(xmlText);
  const tracksById = Object.fromEntries(tracks.map((track) => [track.id, track]));
  const folders = uniqueParentFolders(playlists);

  return {
    parsedAt: new Date().toISOString(),
    tracks,
    tracksById,
    playlists,
    folders
  };
}
