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

function tokenize(input) {
  if (typeof input !== 'string') {
    return [];
  }

  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function toTokenSet(track) {
  return new Set([
    ...tokenize(track.genre),
    ...tokenize(track.title),
    ...tokenize(track.artist)
  ]);
}

function jaccardScore(setA, setB) {
  if (!setA.size || !setB.size) {
    return 0.5;
  }

  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) {
      intersection += 1;
    }
  }

  const union = setA.size + setB.size - intersection;
  if (!union) {
    return 0.5;
  }

  return clamp(intersection / union);
}

function distanceToScore(diff, scale) {
  if (!Number.isFinite(diff)) {
    return 0.5;
  }

  return clamp(Math.exp(-Math.abs(diff) / scale));
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

export function computeWaveformScore(trackA, trackB) {
  const durationA = asNumber(trackA.durationSeconds);
  const durationB = asNumber(trackB.durationSeconds);
  const bitrateA = asNumber(trackA.bitrate);
  const bitrateB = asNumber(trackB.bitrate);
  const beatsPerSecondA = asNumber(trackA.bpm) === null ? null : asNumber(trackA.bpm) / 60;
  const beatsPerSecondB = asNumber(trackB.bpm) === null ? null : asNumber(trackB.bpm) / 60;
  const tokenScore = jaccardScore(toTokenSet(trackA), toTokenSet(trackB));

  const durationScore = durationA === null || durationB === null
    ? 0.5
    : distanceToScore(durationA - durationB, 45);
  const bitrateScore = bitrateA === null || bitrateB === null
    ? 0.5
    : distanceToScore(bitrateA - bitrateB, 96);
  const energyScore = beatsPerSecondA === null || beatsPerSecondB === null
    ? 0.5
    : distanceToScore(beatsPerSecondA - beatsPerSecondB, 0.35);

  return clamp((durationScore * 0.35) + (bitrateScore * 0.2) + (energyScore * 0.2) + (tokenScore * 0.25));
}

function computePhraseAlignmentScore(trackA, trackB) {
  const bpmA = asNumber(trackA.bpm);
  const bpmB = asNumber(trackB.bpm);
  const durationA = asNumber(trackA.durationSeconds);
  const durationB = asNumber(trackB.durationSeconds);

  if (bpmA === null || bpmB === null || durationA === null || durationB === null) {
    return 0.5;
  }

  const beatsA = (bpmA * durationA) / 60;
  const beatsB = (bpmB * durationB) / 60;
  const barsA = beatsA / 4;
  const barsB = beatsB / 4;

  return distanceToScore(barsA - barsB, 8);
}

export function computeRhythmScore(trackA, trackB) {
  const bpmScore = computeBpmScore(trackA.bpm, trackB.bpm);
  const phraseScore = computePhraseAlignmentScore(trackA, trackB);
  const tokenScore = jaccardScore(toTokenSet(trackA), toTokenSet(trackB));

  return clamp((bpmScore * 0.55) + (phraseScore * 0.3) + (tokenScore * 0.15));
}

export function computeWaveformPlaceholderScore(trackA, trackB) {
  return computeWaveformScore(trackA, trackB);
}

export function computeRhythmPlaceholderScore(trackA, trackB) {
  return computeRhythmScore(trackA, trackB);
}

export function computeBaselineSimilarity(trackA, trackB, componentWeights = DEFAULT_COMPONENT_WEIGHTS) {
  const weights = normalizeWeights(componentWeights);

  const components = {
    bpm: computeBpmScore(trackA.bpm, trackB.bpm),
    key: computeKeyScore(trackA.key, trackB.key),
    waveform: computeWaveformScore(trackA, trackB),
    rhythm: computeRhythmScore(trackA, trackB)
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

function componentTier(value) {
  if (value >= 0.85) {
    return 'strong';
  }
  if (value >= 0.65) {
    return 'good';
  }
  if (value >= 0.45) {
    return 'mixed';
  }
  return 'weak';
}

export function summarizeSimilarityComponents(components) {
  const bpmTier = componentTier(components?.bpm ?? 0);
  const keyTier = componentTier(components?.key ?? 0);
  const waveformTier = componentTier(components?.waveform ?? 0);
  const rhythmTier = componentTier(components?.rhythm ?? 0);

  return `BPM ${bpmTier}, key ${keyTier}, waveform ${waveformTier}, rhythm ${rhythmTier}`;
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

export function createAnalyzerVersion(tag = 'baseline-v3') {
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
        const reason = cached.components?.reason
          || summarizeSimilarityComponents(cached.components);
        rows.push({
          trackAId: cached.trackAId,
          trackBId: cached.trackBId,
          score: cached.score,
          components: cached.components,
          weights: cached.components?.weights || normalizedWeights,
          reason,
          fromCache: true
        });
        continue;
      }

      const result = computeBaselineSimilarity(trackA, trackB, normalizedWeights);
      const reason = summarizeSimilarityComponents(result.components);
      saveSimilarityToCache({
        trackAId: trackA.id,
        trackBId: trackB.id,
        algorithmVersion,
        score: result.score,
        components: {
          ...result.components,
          reason,
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
        reason,
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
