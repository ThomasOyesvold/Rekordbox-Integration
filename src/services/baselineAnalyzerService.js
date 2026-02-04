import {
  beginAnalysisRun,
  finishAnalysisRun,
  getSimilarityFromCache,
  saveSimilarityToCache,
  upsertTrackSignatures
} from './similarityCacheService.js';

export const DEFAULT_COMPONENT_WEIGHTS = {
  bpm: 0.35,
  key: 0.35,
  waveform: 0.15,
  rhythm: 0.15
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCamelot(raw) {
  if (typeof raw !== 'string') {
    return null;
  }

  const match = raw.trim().toUpperCase().match(/^(\d{1,2})(A|B)$/);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  if (number < 1 || number > 12) {
    return null;
  }

  return {
    number,
    letter: match[2]
  };
}

function normalizeWeights(inputWeights = DEFAULT_COMPONENT_WEIGHTS) {
  const merged = {
    ...DEFAULT_COMPONENT_WEIGHTS,
    ...(inputWeights || {})
  };

  const total = Object.values(merged).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if (total <= 0) {
    return { ...DEFAULT_COMPONENT_WEIGHTS };
  }

  return {
    bpm: merged.bpm / total,
    key: merged.key / total,
    waveform: merged.waveform / total,
    rhythm: merged.rhythm / total
  };
}

export function computeBpmScore(bpmA, bpmB) {
  const a = asNumber(bpmA);
  const b = asNumber(bpmB);

  if (a === null || b === null) {
    return 0.5;
  }

  const diff = Math.abs(a - b);
  if (diff <= 1) {
    return 1;
  }

  if (diff <= 2) {
    return 0.9;
  }

  if (diff <= 4) {
    return 0.75;
  }

  if (diff <= 6) {
    return 0.55;
  }

  return 0.2;
}

export function computeKeyScore(keyA, keyB) {
  const a = parseCamelot(keyA);
  const b = parseCamelot(keyB);

  if (!a || !b) {
    return 0.5;
  }

  if (a.number === b.number && a.letter === b.letter) {
    return 1;
  }

  if (a.number === b.number && a.letter !== b.letter) {
    return 0.85;
  }

  const clockwise = (a.number % 12) + 1;
  const counterClockwise = ((a.number + 10) % 12) + 1;
  if ((b.number === clockwise || b.number === counterClockwise) && a.letter === b.letter) {
    return 0.8;
  }

  return 0.25;
}

export function computeWaveformPlaceholderScore(trackA, trackB) {
  const genreA = String(trackA.genre || '').trim().toLowerCase();
  const genreB = String(trackB.genre || '').trim().toLowerCase();
  const genreScore = genreA && genreB ? (genreA === genreB ? 0.75 : 0.5) : 0.55;

  const durationA = asNumber(trackA.durationSeconds);
  const durationB = asNumber(trackB.durationSeconds);
  let durationScore = 0.55;
  if (durationA !== null && durationB !== null) {
    const diff = Math.abs(durationA - durationB);
    if (diff <= 8) {
      durationScore = 0.8;
    } else if (diff <= 20) {
      durationScore = 0.65;
    } else {
      durationScore = 0.45;
    }
  }

  return clamp((genreScore + durationScore) / 2);
}

export function computeRhythmPlaceholderScore(trackA, trackB) {
  const bpmScore = computeBpmScore(trackA.bpm, trackB.bpm);
  const keyScore = computeKeyScore(trackA.key, trackB.key);

  return clamp((bpmScore * 0.7) + (keyScore * 0.3));
}

export function computeBaselineSimilarity(trackA, trackB, componentWeights = DEFAULT_COMPONENT_WEIGHTS) {
  const weights = normalizeWeights(componentWeights);

  const components = {
    bpm: computeBpmScore(trackA.bpm, trackB.bpm),
    key: computeKeyScore(trackA.key, trackB.key),
    waveform: computeWaveformPlaceholderScore(trackA, trackB),
    rhythm: computeRhythmPlaceholderScore(trackA, trackB)
  };

  const score = clamp(
    (components.bpm * weights.bpm)
    + (components.key * weights.key)
    + (components.waveform * weights.waveform)
    + (components.rhythm * weights.rhythm)
  );

  return {
    score,
    components,
    weights
  };
}

export function buildTrackPairs(tracks, maxPairs = Infinity) {
  const pairs = [];
  for (let i = 0; i < tracks.length; i += 1) {
    for (let j = i + 1; j < tracks.length; j += 1) {
      pairs.push([tracks[i], tracks[j]]);
      if (pairs.length >= maxPairs) {
        return pairs;
      }
    }
  }

  return pairs;
}

export function rankSimilarityRows(rows, limit = 20) {
  return [...rows]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function createAnalyzerVersion(tag = 'baseline-v2') {
  return `flow-${tag}`;
}

export function runBaselineAnalysis({
  tracks,
  sourceXmlPath = null,
  selectedFolders = [],
  componentWeights = DEFAULT_COMPONENT_WEIGHTS,
  algorithmVersion = createAnalyzerVersion(),
  maxPairs = 5000,
  topLimit = 20
}) {
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const normalizedWeights = normalizeWeights(componentWeights);
  upsertTrackSignatures(safeTracks);

  const runId = beginAnalysisRun({
    algorithmVersion,
    sourceXmlPath,
    selectedFolders,
    trackCount: safeTracks.length
  });

  let cacheHits = 0;
  let computed = 0;

  try {
    const pairs = buildTrackPairs(safeTracks, maxPairs);
    const rows = [];

    for (const [trackA, trackB] of pairs) {
      const cached = getSimilarityFromCache({
        trackAId: trackA.id,
        trackBId: trackB.id,
        algorithmVersion
      });

      if (cached) {
        cacheHits += 1;
        rows.push({
          trackAId: cached.trackAId,
          trackBId: cached.trackBId,
          score: cached.score,
          components: cached.components,
          weights: cached.components?.weights || normalizedWeights,
          fromCache: true
        });
        continue;
      }

      const result = computeBaselineSimilarity(trackA, trackB, normalizedWeights);
      saveSimilarityToCache({
        trackAId: trackA.id,
        trackBId: trackB.id,
        algorithmVersion,
        score: result.score,
        components: {
          ...result.components,
          weights: result.weights
        },
        analysisRunId: runId
      });

      computed += 1;
      rows.push({
        trackAId: String(trackA.id),
        trackBId: String(trackB.id),
        score: result.score,
        components: result.components,
        weights: result.weights,
        fromCache: false
      });
    }

    finishAnalysisRun(runId, 'completed', `pairs=${rows.length}, cacheHits=${cacheHits}, computed=${computed}`);

    return {
      runId,
      algorithmVersion,
      pairCount: rows.length,
      cacheHits,
      computed,
      weights: normalizedWeights,
      topMatches: rankSimilarityRows(rows, topLimit)
    };
  } catch (error) {
    finishAnalysisRun(runId, 'failed', error.message || 'Baseline analysis failed.');
    throw error;
  }
}
