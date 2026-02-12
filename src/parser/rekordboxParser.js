import { fileURLToPath } from 'node:url';
import { parseXmlAttributes } from './xmlAttributes.js';

const VALIDATION_CODES = {
  missingCollection: 'MISSING_COLLECTION',
  missingRoot: 'MISSING_ROOT',
  invalidCollectionEntries: 'INVALID_COLLECTION_ENTRIES',
  unescapedAmpersand: 'UNESCAPED_AMPERSAND',
  missingTrackIdentity: 'MISSING_TRACK_IDENTITY',
  missingTrackTitle: 'MISSING_TRACK_TITLE',
  missingTrackArtist: 'MISSING_TRACK_ARTIST',
  duplicateTrackId: 'DUPLICATE_TRACK_ID',
  invalidBpm: 'INVALID_BPM',
  invalidDuration: 'INVALID_DURATION',
  invalidBitrate: 'INVALID_BITRATE',
  suspiciousLocationEncoding: 'SUSPICIOUS_LOCATION_ENCODING',
  missingWindowsPath: 'MISSING_WINDOWS_PATH',
  missingNodeName: 'MISSING_NODE_NAME',
  invalidNodeType: 'INVALID_NODE_TYPE',
  playlistWithoutTracks: 'PLAYLIST_WITHOUT_TRACKS',
  danglingTrackReference: 'DANGLING_TRACK_REFERENCE'
};

function createIssue(severity, code, message, context = {}) {
  return { severity, code, message, context };
}

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

  const trimmed = String(rawLocation).trim();

  if (/^file:/i.test(trimmed)) {
    try {
      let pathValue = fileURLToPath(new URL(trimmed));
      if (/^\/[A-Za-z]:\//.test(pathValue)) {
        pathValue = pathValue.slice(1);
      }
      return pathValue;
    } catch {
      // Fall through to manual normalization.
    }
  }

  let value = trimmed
    .replace(/^file:\/\//i, '')
    .replace(/^localhost\//i, '')
    .replace(/\\/g, '/');

  if (/^\/[A-Za-z]:\//.test(value)) {
    value = value.slice(1);
  }

  try {
    value = decodeURIComponent(value);
  } catch {
    // If decoding fails, keep raw value.
  }

  return value;
}

function validateTrackAttributes(rawAttributes, attributes, issues, index) {
  if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(rawAttributes)) {
    issues.push(
      createIssue(
        'warning',
        VALIDATION_CODES.unescapedAmpersand,
        'Track contains a raw ampersand. XML may fail in strict parsers.',
        { trackIndex: index, trackId: attributes.TrackID || null }
      )
    );
  }

  if (!attributes.Name) {
    issues.push(
      createIssue('warning', VALIDATION_CODES.missingTrackTitle, 'Track is missing title (Name).', {
        trackIndex: index,
        trackId: attributes.TrackID || null
      })
    );
  }

  if (!attributes.Artist) {
    issues.push(
      createIssue('warning', VALIDATION_CODES.missingTrackArtist, 'Track is missing artist.', {
        trackIndex: index,
        trackId: attributes.TrackID || null
      })
    );
  }

  if (attributes.AverageBpm !== undefined && parseNumber(attributes.AverageBpm) === null) {
    issues.push(
      createIssue('warning', VALIDATION_CODES.invalidBpm, 'Track BPM is not numeric.', {
        trackIndex: index,
        trackId: attributes.TrackID || null,
        value: attributes.AverageBpm
      })
    );
  }

  if (attributes.TotalTime !== undefined && parseNumber(attributes.TotalTime) === null) {
    issues.push(
      createIssue('warning', VALIDATION_CODES.invalidDuration, 'Track duration is not numeric.', {
        trackIndex: index,
        trackId: attributes.TrackID || null,
        value: attributes.TotalTime
      })
    );
  }

  if (attributes.BitRate !== undefined && parseNumber(attributes.BitRate) === null) {
    issues.push(
      createIssue('warning', VALIDATION_CODES.invalidBitrate, 'Track bitrate is not numeric.', {
        trackIndex: index,
        trackId: attributes.TrackID || null,
        value: attributes.BitRate
      })
    );
  }

  if (attributes.Location && /%[0-9A-F]{2}/i.test(attributes.Location) && !/%20/i.test(attributes.Location)) {
    issues.push(
      createIssue(
        'warning',
        VALIDATION_CODES.suspiciousLocationEncoding,
        'Track path contains encoded characters besides spaces; verify special characters.',
        { trackIndex: index, trackId: attributes.TrackID || null, value: attributes.Location }
      )
    );
  }
}

function parseCollection(xmlText, issues) {
  const collectionMatch = /<COLLECTION\b([^>]*)>([\s\S]*?)<\/COLLECTION>/i.exec(xmlText);
  if (!collectionMatch) {
    issues.push(createIssue('error', VALIDATION_CODES.missingCollection, 'Missing <COLLECTION> section.'));
    return [];
  }

  const collectionAttributes = parseXmlAttributes(collectionMatch[1] || '');
  const collectionBody = collectionMatch[2];
  const trackRegex = /<TRACK\b([^>]*?)(?:\/>|>([\s\S]*?)<\/TRACK>)/gi;
  const tracks = [];
  const seenIds = new Set();
  let match = trackRegex.exec(collectionBody);
  let index = 0;

  while (match) {
    const rawAttributes = match[1];
    const nestedBody = String(match[2] || '');
    const attributes = parseXmlAttributes(rawAttributes);
    validateTrackAttributes(rawAttributes, attributes, issues, index);

    const location = parseLocation(attributes.Location || '');
    const fallbackId = `${attributes.Artist || ''}-${attributes.Name || ''}`.trim();
    const id = attributes.TrackID || location || fallbackId;

    if (!id) {
      issues.push(
        createIssue('error', VALIDATION_CODES.missingTrackIdentity, 'Track missing both TrackID and Location.', {
          trackIndex: index
        })
      );
      match = trackRegex.exec(collectionBody);
      index += 1;
      continue;
    }

    if (seenIds.has(id)) {
      issues.push(
        createIssue('error', VALIDATION_CODES.duplicateTrackId, 'Duplicate track identifier detected.', {
          trackIndex: index,
          trackId: id
        })
      );
    }
    seenIds.add(id);

    if (location && !/^[A-Za-z]:\//.test(location)) {
      issues.push(
        createIssue(
          'warning',
          VALIDATION_CODES.missingWindowsPath,
          'Track location is not a Windows absolute path.',
          { trackIndex: index, trackId: id, value: location }
        )
      );
    }

    const nestedTempoPoints = [];
    const nestedTempoRegex = /<TEMPO\b([^>]*?)\/?>/gi;
    let tempoMatch = nestedTempoRegex.exec(nestedBody);
    while (tempoMatch) {
      const tempoAttributes = parseXmlAttributes(tempoMatch[1] || '');
      nestedTempoPoints.push({
        inizio: parseNumber(tempoAttributes.Inizio),
        bpm: parseNumber(tempoAttributes.Bpm),
        battito: parseNumber(tempoAttributes.Battito)
      });
      tempoMatch = nestedTempoRegex.exec(nestedBody);
    }

    const nestedTempoSummary = (() => {
      if (!nestedTempoPoints.length) {
        return null;
      }
      const bpmValues = nestedTempoPoints
        .map((point) => point.bpm)
        .filter((value) => Number.isFinite(value));
      const beatValues = nestedTempoPoints
        .map((point) => point.battito)
        .filter((value) => Number.isFinite(value));
      const minBpm = bpmValues.length ? Math.min(...bpmValues) : null;
      const maxBpm = bpmValues.length ? Math.max(...bpmValues) : null;
      const avgBpm = bpmValues.length
        ? bpmValues.reduce((sum, value) => sum + value, 0) / bpmValues.length
        : null;
      const avgBeat = beatValues.length
        ? beatValues.reduce((sum, value) => sum + value, 0) / beatValues.length
        : null;
      let tempoChangeCount = 0;
      for (let i = 1; i < nestedTempoPoints.length; i += 1) {
        const prev = nestedTempoPoints[i - 1].bpm;
        const next = nestedTempoPoints[i].bpm;
        if (Number.isFinite(prev) && Number.isFinite(next) && Math.abs(prev - next) >= 0.1) {
          tempoChangeCount += 1;
        }
      }
      const distinctBpm = bpmValues.length
        ? new Set(bpmValues.map((value) => Math.round(value * 10) / 10)).size
        : 0;
      return {
        count: nestedTempoPoints.length,
        minBpm,
        maxBpm,
        avgBpm,
        avgBeat,
        tempoChangeCount,
        distinctBpm
      };
    })();

    const nestedPositionMarks = [];
    const nestedPositionRegex = /<POSITION_MARK\b([^>]*?)\/?>/gi;
    let positionMatch = nestedPositionRegex.exec(nestedBody);
    while (positionMatch) {
      const markAttributes = parseXmlAttributes(positionMatch[1] || '');
      const start = parseNumber(markAttributes.Start);
      const end = parseNumber(markAttributes.End);
      const number = parseNumber(markAttributes.Num);
      const type = markAttributes.Type || '';
      const inferredKind = (() => {
        if (Number.isFinite(end) && end > 0) {
          return 'loop';
        }
        if (Number.isFinite(number) && number >= 0) {
          return 'hotcue';
        }
        if (String(type) === '0') {
          return 'memory';
        }
        return 'unknown';
      })();
      nestedPositionMarks.push({
        name: markAttributes.Name || '',
        type,
        start,
        end,
        number,
        inferredKind,
        color: {
          red: parseNumber(markAttributes.Red),
          green: parseNumber(markAttributes.Green),
          blue: parseNumber(markAttributes.Blue)
        }
      });
      positionMatch = nestedPositionRegex.exec(nestedBody);
    }

    const nestedPositionSummary = (() => {
      if (!nestedPositionMarks.length) {
        return null;
      }
      const types = {};
      const kinds = {};
      let loopCount = 0;
      let hotcueCount = 0;
      let memoryCount = 0;
      let coloredCount = 0;
      for (const mark of nestedPositionMarks) {
        const typeKey = (mark.type || 'Unknown').toString();
        types[typeKey] = (types[typeKey] || 0) + 1;
        const kindKey = (mark.inferredKind || 'unknown').toString();
        kinds[kindKey] = (kinds[kindKey] || 0) + 1;
        if (kindKey === 'loop') {
          loopCount += 1;
        } else if (kindKey === 'hotcue') {
          hotcueCount += 1;
        } else if (kindKey === 'memory') {
          memoryCount += 1;
        }
        if (Number.isFinite(mark.color?.red) || Number.isFinite(mark.color?.green) || Number.isFinite(mark.color?.blue)) {
          coloredCount += 1;
        }
      }
      return {
        count: nestedPositionMarks.length,
        types,
        kinds,
        loopCount,
        hotcueCount,
        memoryCount,
        coloredCount
      };
    })();

    const nestedTagSummary = (() => {
      if (!nestedBody) {
        return null;
      }
      const tagRegex = /<([A-Z0-9_:-]+)\b/gi;
      const counts = {};
      let total = 0;
      let tagMatch = tagRegex.exec(nestedBody);
      while (tagMatch) {
        const tag = tagMatch[1].toUpperCase();
        if (tag !== 'TEMPO' && tag !== 'POSITION_MARK') {
          counts[tag] = (counts[tag] || 0) + 1;
          total += 1;
        }
        tagMatch = tagRegex.exec(nestedBody);
      }
      if (!total) {
        return null;
      }
      return {
        total,
        tags: counts
      };
    })();

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
      location,
      nestedTempoPoints,
      nestedTempoSummary,
      nestedPositionMarks,
      nestedPositionSummary,
      nestedTagSummary
    });

    match = trackRegex.exec(collectionBody);
    index += 1;
  }

  if (collectionAttributes.Entries !== undefined) {
    const declaredEntries = Number(collectionAttributes.Entries);
    if (!Number.isFinite(declaredEntries) || declaredEntries !== tracks.length) {
      issues.push(
        createIssue(
          'warning',
          VALIDATION_CODES.invalidCollectionEntries,
          'COLLECTION Entries attribute does not match parsed track count.',
          {
            declaredEntries: collectionAttributes.Entries,
            parsedTracks: tracks.length
          }
        )
      );
    }
  }

  return tracks;
}

function parsePlaylists(xmlText, issues) {
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
        if (node.trackIds.length === 0) {
          issues.push(
            createIssue(
              'warning',
              VALIDATION_CODES.playlistWithoutTracks,
              'Playlist node has no track references.',
              { playlist: node.path || node.name || null }
            )
          );
        }

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
      const isKnownType = type === '0' || type === '1';

      if (!isKnownType) {
        issues.push(
          createIssue('warning', VALIDATION_CODES.invalidNodeType, 'NODE has unexpected Type value.', {
            type,
            name: name || null
          })
        );
      }

      if (!name) {
        issues.push(
          createIssue('warning', VALIDATION_CODES.missingNodeName, 'NODE is missing Name attribute.', {
            type: type || null
          })
        );
      }

      const parentPath = stack.length > 0 ? stack[stack.length - 1].path : '';
      const currentPath = parentPath && name ? `${parentPath}/${name}` : name;

      const node = {
        name,
        path: currentPath,
        kind: type === '0' ? 'playlist' : 'folder',
        trackIds: []
      };

      if (!isSelfClosing) {
        stack.push(node);
      } else if (node.kind === 'playlist') {
        if (node.trackIds.length === 0) {
          issues.push(
            createIssue(
              'warning',
              VALIDATION_CODES.playlistWithoutTracks,
              'Playlist node has no track references.',
              { playlist: node.path || node.name || null }
            )
          );
        }
        playlists.push(node);
      }

      token = tokenRegex.exec(text);
      continue;
    }

    if (token[2] !== undefined) {
      const attributes = parseXmlAttributes(token[2]);
      const trackRef = attributes.Key || attributes.TrackID || attributes.ID;

      if (trackRef) {
        for (let index = stack.length - 1; index >= 0; index -= 1) {
          if (stack[index].kind === 'playlist') {
            stack[index].trackIds.push(trackRef);
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

function validateTrackReferences(playlists, tracksById, issues) {
  for (const playlist of playlists) {
    for (const trackId of playlist.trackIds) {
      if (!tracksById[trackId]) {
        issues.push(
          createIssue(
            'warning',
            VALIDATION_CODES.danglingTrackReference,
            'Playlist references track not found in collection.',
            { playlist: playlist.path, trackId }
          )
        );
      }
    }
  }
}

export function parseRekordboxXml(xmlText) {
  const issues = [];

  if (!xmlText.includes('<DJ_PLAYLISTS')) {
    issues.push(createIssue('error', VALIDATION_CODES.missingRoot, 'Missing <DJ_PLAYLISTS> root element.'));
    const error = new Error('Not a Rekordbox XML export: missing <DJ_PLAYLISTS> root.');
    error.issues = issues;
    throw error;
  }

  const tracks = parseCollection(xmlText, issues);
  const playlists = parsePlaylists(xmlText, issues);
  const tracksById = Object.fromEntries(tracks.map((track) => [track.id, track]));
  validateTrackReferences(playlists, tracksById, issues);

  const hasFatalError = issues.some((issue) => issue.severity === 'error');
  if (hasFatalError) {
    const error = new Error('Rekordbox XML has validation errors.');
    error.issues = issues;
    throw error;
  }

  return {
    parsedAt: new Date().toISOString(),
    tracks,
    tracksById,
    playlists,
    folders: uniqueParentFolders(playlists),
    validation: {
      issues,
      warningCount: issues.filter((issue) => issue.severity === 'warning').length,
      errorCount: 0
    }
  };
}
