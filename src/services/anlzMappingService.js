import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const RekordboxAnlz = require('rekordbox-parser');

function normalizeFilename(name) {
  return String(name || '')
    .trim()
    .normalize('NFKC')
    .toLowerCase();
}

function extractFilename(rawPath) {
  const cleaned = String(rawPath || '')
    .replace(/^file:\/\//i, '')
    .replace(/^localhost\//i, '')
    .replace(/\?.*$/, '')
    .replace(/%20/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  const normalizedSlashes = cleaned.replace(/\\/g, '/');
  const parts = normalizedSlashes.split('/').filter(Boolean);
  return parts.length ? parts.at(-1) : '';
}

function fourccToString(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String.fromCharCode(
      (value >> 24) & 0xFF,
      (value >> 16) & 0xFF,
      (value >> 8) & 0xFF,
      value & 0xFF
    );
  }

  return '';
}

function extractPpthPathFromParsed(parsed) {
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
  const ppth = sections.find((section) => fourccToString(section?.fourcc) === 'PPTH');
  const rawPath = ppth?.body?.path;
  if (!rawPath) {
    return null;
  }

  return String(rawPath).replace(/^\?\//, '').trim();
}

function extractPwv5DurationSeconds(parsed) {
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
  const pwv5 = sections.find((section) => fourccToString(section?.fourcc) === 'PWV5');
  const entries = pwv5?.body?.entries;
  if (Array.isArray(entries)) {
    return entries.length / 150;
  }

  const lenEntries = Number(pwv5?.body?.lenEntries);
  if (Number.isFinite(lenEntries) && lenEntries > 0) {
    return lenEntries / 150;
  }

  return null;
}

function toTokens(input) {
  return new Set(
    String(input || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
  );
}

function tokenOverlapScore(left, right) {
  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
}

function chooseBestAnlzForTrack(track, anlzEntries, takenIndexes = new Set()) {
  const trackDuration = Number(track.durationSeconds);
  const trackTokens = toTokens(track.location);
  let best = null;

  for (let index = 0; index < anlzEntries.length; index += 1) {
    if (takenIndexes.has(index)) {
      continue;
    }

    const entry = anlzEntries[index];
    const anlzTokens = toTokens(entry.ppthPath);
    const overlapScore = tokenOverlapScore(trackTokens, anlzTokens);
    const entryDuration = Number(entry.durationSeconds);
    const durationDiff = Number.isFinite(trackDuration) && Number.isFinite(entryDuration)
      ? Math.abs(trackDuration - entryDuration)
      : 30;
    const durationScore = Math.max(0, 1 - (durationDiff / 30));
    const score = (durationScore * 0.7) + (overlapScore * 0.3);

    if (!best || score > best.score) {
      best = { index, score, durationDiff };
    }
  }

  return best;
}

async function walkForExtFiles(rootDir) {
  const stack = [rootDir];
  const found = [];

  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toUpperCase().endsWith('.EXT')) {
        found.push(fullPath);
      }
    }
  }

  return found;
}

function relativeOrAbsolute(filePath, basePath) {
  const relative = path.relative(basePath, filePath);
  if (relative && !relative.startsWith('..')) {
    return relative;
  }
  return filePath;
}

export async function buildAnlzMapping({
  tracks,
  usbAnlzPath,
  outPath,
  onProgress,
  signal
}) {
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  if (!usbAnlzPath) {
    throw new Error('Missing USBANLZ path.');
  }

  const usbPath = path.resolve(usbAnlzPath);
  const outputPath = outPath
    ? path.resolve(outPath)
    : path.resolve('.planning/anlz-track-map.json');

  const tracksByFilename = new Map();
  for (const track of safeTracks) {
    const filename = normalizeFilename(extractFilename(track.location));
    if (!filename) {
      continue;
    }

    const bucket = tracksByFilename.get(filename) || [];
    bucket.push({
      id: track.id,
      trackId: track.trackId,
      location: track.location,
      durationSeconds: track.durationSeconds,
      artist: track.artist || '',
      title: track.title || ''
    });
    tracksByFilename.set(filename, bucket);
  }

  const extFiles = await walkForExtFiles(usbPath);
  if (signal?.aborted) {
    throw new Error('ANLZ mapping canceled.');
  }

  const anlzByFilename = new Map();
  let parsedCount = 0;
  let parseErrors = 0;
  let missingPpth = 0;
  let scanned = 0;
  const total = extFiles.length;

  for (const extPath of extFiles) {
    if (signal?.aborted) {
      throw new Error('ANLZ mapping canceled.');
    }
    try {
      const data = await fs.readFile(extPath);
      const parsed = RekordboxAnlz.parseAnlz(data);
      const ppthPath = extractPpthPathFromParsed(parsed);
      const durationSeconds = extractPwv5DurationSeconds(parsed);
      if (!ppthPath) {
        missingPpth += 1;
        continue;
      }

      const filename = normalizeFilename(extractFilename(ppthPath));
      if (!filename) {
        missingPpth += 1;
        continue;
      }

      const relPath = relativeOrAbsolute(extPath, usbPath);
      const segments = relPath.split(path.sep);
      const bucket = segments.length > 2 ? segments[0] : '';
      const uuid = segments.length > 2 ? segments[1] : '';

      const list = anlzByFilename.get(filename) || [];
      list.push({
        extPath,
        relPath,
        ppthPath,
        durationSeconds,
        bucket,
        uuid
      });
      anlzByFilename.set(filename, list);
      parsedCount += 1;
    } catch {
      parseErrors += 1;
    } finally {
      scanned += 1;
      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'parse-ext',
          scanned,
          total,
          parsedCount,
          parseErrors,
          missingPpth
        });
      }
    }
  }

  const mapping = {};
  const ambiguous = [];
  const unmatchedTrackIds = [];
  const unmatchedAnlz = [];
  let resolvedByDuration = 0;
  let sharedSingleAnlz = 0;

  for (const [filename, xmlTracks] of tracksByFilename) {
    const anlzEntries = anlzByFilename.get(filename) || [];
    if (!anlzEntries.length) {
      for (const track of xmlTracks) {
        unmatchedTrackIds.push(track.id);
      }
      continue;
    }

    if (xmlTracks.length === 1 && anlzEntries.length >= 1) {
      const best = chooseBestAnlzForTrack(xmlTracks[0], anlzEntries);
      const chosen = best ? anlzEntries[best.index] : anlzEntries[0];
      mapping[xmlTracks[0].id] = {
        extPath: chosen.extPath,
        relPath: chosen.relPath,
        ppthPath: chosen.ppthPath,
        filename,
        bucket: chosen.bucket,
        uuid: chosen.uuid,
        durationSeconds: chosen.durationSeconds,
        matchType: anlzEntries.length === 1 ? 'unique-filename' : 'best-of-multi-anlz'
      };
      if (anlzEntries.length > 1) {
        resolvedByDuration += 1;
      }
      continue;
    }

    if (xmlTracks.length > 1 && anlzEntries.length === 1) {
      for (const track of xmlTracks) {
        mapping[track.id] = {
          extPath: anlzEntries[0].extPath,
          relPath: anlzEntries[0].relPath,
          ppthPath: anlzEntries[0].ppthPath,
          filename,
          bucket: anlzEntries[0].bucket,
          uuid: anlzEntries[0].uuid,
          durationSeconds: anlzEntries[0].durationSeconds,
          matchType: 'shared-single-anlz'
        };
      }
      sharedSingleAnlz += xmlTracks.length;
      continue;
    }

    if (xmlTracks.length > 1 && anlzEntries.length > 1) {
      const byDuration = [...xmlTracks].sort(
        (a, b) => (Number(a.durationSeconds) || 0) - (Number(b.durationSeconds) || 0)
      );
      const takenIndexes = new Set();
      let resolvedCount = 0;

      for (const track of byDuration) {
        const best = chooseBestAnlzForTrack(track, anlzEntries, takenIndexes);
        if (!best) {
          continue;
        }
        if (best.score < 0.55) {
          continue;
        }
        takenIndexes.add(best.index);
        const chosen = anlzEntries[best.index];
        mapping[track.id] = {
          extPath: chosen.extPath,
          relPath: chosen.relPath,
          ppthPath: chosen.ppthPath,
          filename,
          bucket: chosen.bucket,
          uuid: chosen.uuid,
          durationSeconds: chosen.durationSeconds,
          matchType: 'duration-token-disambiguated'
        };
        resolvedCount += 1;
      }

      if (resolvedCount === xmlTracks.length) {
        resolvedByDuration += resolvedCount;
        continue;
      }
    }

    ambiguous.push({
      filename,
      xmlTrackCount: xmlTracks.length,
      anlzCount: anlzEntries.length,
      xmlTrackIds: xmlTracks.map((track) => track.id),
      anlzRelPaths: anlzEntries.map((entry) => entry.relPath),
      xmlDurations: xmlTracks.map((track) => Number(track.durationSeconds) || null),
      anlzDurations: anlzEntries.map((entry) => Number(entry.durationSeconds) || null)
    });

    for (const track of xmlTracks) {
      if (!mapping[track.id]) {
        unmatchedTrackIds.push(track.id);
      }
    }
  }

  for (const [filename, entries] of anlzByFilename) {
    if (!tracksByFilename.has(filename)) {
      for (const entry of entries) {
        unmatchedAnlz.push(entry.relPath);
      }
      continue;
    }

    const matchedPaths = new Set(
      Object.values(mapping)
        .filter((item) => item?.filename === filename)
        .map((item) => item.relPath)
    );
    for (const entry of entries) {
      if (!matchedPaths.has(entry.relPath)) {
        unmatchedAnlz.push(entry.relPath);
      }
    }
  }

  const matchedTrackCount = Object.keys(mapping).length;
  const totalTracks = safeTracks.length;
  const matchRate = totalTracks ? ((matchedTrackCount / totalTracks) * 100).toFixed(2) : '0.00';

  const report = {
    generatedAt: new Date().toISOString(),
    usbAnlzPath: usbPath,
    stats: {
      totalTracks,
      extFilesScanned: extFiles.length,
      extFilesParsed: parsedCount,
      parseErrors,
      missingPpth,
      matchedTracks: matchedTrackCount,
      resolvedByDuration,
      sharedSingleAnlz,
      ambiguousFilenames: ambiguous.length,
      unmatchedTracks: unmatchedTrackIds.length,
      unmatchedAnlzFiles: unmatchedAnlz.length,
      matchRatePercent: Number(matchRate)
    },
    mapping,
    ambiguous,
    unmatchedTrackIds,
    unmatchedAnlz
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

  return { outPath: outputPath, ...report };
}
