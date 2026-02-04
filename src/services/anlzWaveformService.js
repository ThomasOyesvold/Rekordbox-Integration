import fs from 'node:fs/promises';
import path from 'node:path';
import { extractPwv5SummaryFromAnlz } from '../parser/anlzWaveformParser.js';
import { getAnlzWaveformSummary, saveAnlzWaveformSummary } from '../state/sqliteStore.js';

export async function loadAnlzMapping(mappingPath) {
  const filePath = path.resolve(mappingPath);
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed?.mapping || {};
}

export async function attachAnlzWaveformSummaries(tracks, {
  mappingPath,
  maxTracks = Infinity,
  binCount = 96
} = {}) {
  if (!mappingPath) {
    return { attached: 0, attempted: 0, missingMapping: 0 };
  }

  const mapping = await loadAnlzMapping(mappingPath);
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const fileSummaryCache = new Map();

  let attached = 0;
  let attempted = 0;
  let missingMapping = 0;
  let cacheHits = 0;
  let parsedFromFile = 0;
  let cacheWriteErrors = 0;

  for (let index = 0; index < safeTracks.length; index += 1) {
    if (index >= maxTracks) {
      break;
    }

    const track = safeTracks[index];
    const mapEntry = mapping[String(track.id)];
    if (!mapEntry?.extPath) {
      missingMapping += 1;
      continue;
    }

    attempted += 1;
    if (!fileSummaryCache.has(mapEntry.extPath)) {
      let summary = null;

      try {
        summary = getAnlzWaveformSummary(mapEntry.extPath);
      } catch {
        summary = null;
      }

      if (summary) {
        cacheHits += 1;
      } else {
        try {
          const data = await fs.readFile(mapEntry.extPath);
          summary = extractPwv5SummaryFromAnlz(data, { binCount, sampleRate: 150 });
          parsedFromFile += 1;

          if (summary) {
            try {
              saveAnlzWaveformSummary({
                extPath: mapEntry.extPath,
                sampleCount: summary.sampleCount,
                durationSeconds: summary.durationSeconds,
                avgColor: summary.avgColor,
                height: summary.height,
                bins: summary.bins,
                binColors: summary.binColors
              });
            } catch {
              cacheWriteErrors += 1;
            }
          }
        } catch (_error) {
          summary = null;
        }
      }

      fileSummaryCache.set(mapEntry.extPath, summary);
    }

    const summary = fileSummaryCache.get(mapEntry.extPath);
    if (summary) {
      track.anlzWaveform = {
        source: 'anlz-pwv5',
        extPath: mapEntry.extPath,
        sampleCount: summary.sampleCount,
        durationSeconds: summary.durationSeconds,
        avgColor: summary.avgColor,
        height: summary.height,
        bins: summary.bins,
        binColors: summary.binColors
      };
      attached += 1;
    }
  }

  return {
    attached,
    attempted,
    missingMapping,
    cacheHits,
    parsedFromFile,
    cacheWriteErrors
  };
}
