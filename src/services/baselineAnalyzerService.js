import {
  beginAnalysisRun,
  finishAnalysisRun,
  getSimilarityFromCache,
  saveSimilarityToCache,
  upsertTrackSignatures
} from './similarityCacheService.js';

export const DEFAULT_COMPONENT_WEIGHTS = {
  bpm: 0.25,
  key: 0.25,
  waveform: 0.25,
  rhythm: 0.25
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

function parseTempoPoints(track) {
  const points = Array.isArray(track?.nestedTempoPoints) ? track.nestedTempoPoints : [];
  return points
    .map((point) => ({
      inizio: asNumber(point?.inizio),
      bpm: asNumber(point?.bpm),
      battito: asNumber(point?.battito)
    }))
    .filter((point) => point.inizio !== null || point.bpm !== null || point.battito !== null)
    .sort((a, b) => (a.inizio ?? 0) - (b.inizio ?? 0));
}

function parsePositionMarks(track) {
  const marks = Array.isArray(track?.nestedPositionMarks) ? track.nestedPositionMarks : [];
  return marks
    .map((mark) => ({
      start: asNumber(mark?.start),
      red: asNumber(mark?.color?.red),
      green: asNumber(mark?.color?.green),
      blue: asNumber(mark?.color?.blue)
    }))
    .filter((mark) => mark.start !== null || mark.red !== null || mark.green !== null || mark.blue !== null)
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
}

function compareNestedTempoMaps(trackA, trackB) {
  const tempoA = parseTempoPoints(trackA);
  const tempoB = parseTempoPoints(trackB);

  if (!tempoA.length || !tempoB.length) {
    return null;
  }

  const overlap = Math.min(tempoA.length, tempoB.length, 16);
  let bpmScoreSum = 0;
  let phaseScoreSum = 0;
  let timingScoreSum = 0;

  for (let index = 0; index < overlap; index += 1) {
    bpmScoreSum += distanceToScore((tempoA[index].bpm ?? 0) - (tempoB[index].bpm ?? 0), 2);
    phaseScoreSum += distanceToScore((tempoA[index].battito ?? 0) - (tempoB[index].battito ?? 0), 1);
    timingScoreSum += distanceToScore((tempoA[index].inizio ?? 0) - (tempoB[index].inizio ?? 0), 8);
  }

  const bpmScore = bpmScoreSum / overlap;
  const phaseScore = phaseScoreSum / overlap;
  const timingScore = timingScoreSum / overlap;
  const countScore = distanceToScore(tempoA.length - tempoB.length, 3);

  return clamp((bpmScore * 0.45) + (phaseScore * 0.2) + (timingScore * 0.25) + (countScore * 0.1));
}

function compareNestedWaveformMarks(trackA, trackB) {
  const marksA = parsePositionMarks(trackA);
  const marksB = parsePositionMarks(trackB);

  if (!marksA.length || !marksB.length) {
    return null;
  }

  const overlap = Math.min(marksA.length, marksB.length, 16);
  const durationA = asNumber(trackA.durationSeconds);
  const durationB = asNumber(trackB.durationSeconds);
  let colorScoreSum = 0;
  let timingScoreSum = 0;

  for (let index = 0; index < overlap; index += 1) {
    const markA = marksA[index];
    const markB = marksB[index];
    const redDiff = Math.abs((markA.red ?? 0) - (markB.red ?? 0));
    const greenDiff = Math.abs((markA.green ?? 0) - (markB.green ?? 0));
    const blueDiff = Math.abs((markA.blue ?? 0) - (markB.blue ?? 0));
    const avgDiff = (redDiff + greenDiff + blueDiff) / 3;
    colorScoreSum += clamp(1 - (avgDiff / 255));

    if (durationA && durationB && durationA > 0 && durationB > 0) {
      const normalizedA = (markA.start ?? 0) / durationA;
      const normalizedB = (markB.start ?? 0) / durationB;
      timingScoreSum += distanceToScore(normalizedA - normalizedB, 0.08);
    } else {
      timingScoreSum += distanceToScore((markA.start ?? 0) - (markB.start ?? 0), 10);
    }
  }

  const colorScore = colorScoreSum / overlap;
  const timingScore = timingScoreSum / overlap;
  const countScore = distanceToScore(marksA.length - marksB.length, 4);

  return clamp((colorScore * 0.45) + (timingScore * 0.4) + (countScore * 0.15));
}

function compareAnlzWaveformSummaries(trackA, trackB) {
  const waveformA = trackA?.anlzWaveform;
  const waveformB = trackB?.anlzWaveform;
  if (!waveformA || !waveformB) {
    return null;
  }

  const binsA = Array.isArray(waveformA.bins) ? waveformA.bins : [];
  const binsB = Array.isArray(waveformB.bins) ? waveformB.bins : [];
  if (!binsA.length || !binsB.length) {
    return null;
  }

  const overlap = Math.min(binsA.length, binsB.length);
  let diffSum = 0;
  for (let index = 0; index < overlap; index += 1) {
    diffSum += Math.abs((Number(binsA[index]) || 0) - (Number(binsB[index]) || 0));
  }
  const avgHeightDiff = diffSum / overlap;
  const heightScore = clamp(1 - (avgHeightDiff / 31));

  const colorA = waveformA.avgColor || {};
  const colorB = waveformB.avgColor || {};
  const redDiff = Math.abs((Number(colorA.red) || 0) - (Number(colorB.red) || 0));
  const greenDiff = Math.abs((Number(colorA.green) || 0) - (Number(colorB.green) || 0));
  const blueDiff = Math.abs((Number(colorA.blue) || 0) - (Number(colorB.blue) || 0));
  const colorScore = clamp(1 - (((redDiff + greenDiff + blueDiff) / 3) / 255));

  const durationA = asNumber(waveformA.durationSeconds);
  const durationB = asNumber(waveformB.durationSeconds);
  const durationScore = durationA === null || durationB === null
    ? 0.5
    : distanceToScore(durationA - durationB, 45);

  return clamp((heightScore * 0.65) + (colorScore * 0.2) + (durationScore * 0.15));
}

function buildRhythmSignatureFromWaveform(track, segmentCount = 32) {
  const cachedSignature = track?.anlzWaveform?.rhythmSignature;
  if (Array.isArray(cachedSignature) && cachedSignature.length) {
    const cleaned = cachedSignature.map((value) => (
      Number.isFinite(Number(value)) ? Number(value) : 0
    ));
    const magnitude = Math.sqrt(cleaned.reduce((sum, value) => sum + (value * value), 0));
    if (Number.isFinite(magnitude) && magnitude > 0) {
      return cleaned.map((value) => value / magnitude);
    }
  }

  const waveform = track?.anlzWaveform;
  const bins = Array.isArray(waveform?.bins) ? waveform.bins : [];
  if (bins.length < 16) {
    return null;
  }

  const cleaned = bins.map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));
  const maxValue = Math.max(...cleaned);
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return null;
  }

  const normalized = cleaned.map((value) => value / maxValue);
  const onset = normalized.map((value, index) => {
    if (index === 0) {
      return 0;
    }
    return Math.max(0, value - normalized[index - 1]);
  });

  const smoothed = onset.map((value, index) => {
    const prev = onset[index - 1] ?? value;
    const next = onset[index + 1] ?? value;
    return (prev + value + next) / 3;
  });

  const segments = new Array(segmentCount).fill(0);
  const counters = new Array(segmentCount).fill(0);
  const length = smoothed.length;
  for (let index = 0; index < length; index += 1) {
    const bucket = Math.min(segmentCount - 1, Math.floor((index / length) * segmentCount));
    segments[bucket] += smoothed[index];
    counters[bucket] += 1;
  }

  const averaged = segments.map((value, index) => (counters[index] ? value / counters[index] : 0));
  const magnitude = Math.sqrt(averaged.reduce((sum, value) => sum + (value * value), 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return null;
  }

  return averaged.map((value) => value / magnitude);
}

function compareRhythmSignatures(trackA, trackB) {
  const signatureA = buildRhythmSignatureFromWaveform(trackA);
  const signatureB = buildRhythmSignatureFromWaveform(trackB);

  if (!signatureA || !signatureB || signatureA.length !== signatureB.length) {
    return null;
  }

  let dot = 0;
  for (let index = 0; index < signatureA.length; index += 1) {
    dot += signatureA[index] * signatureB[index];
  }

  return clamp(dot, 0, 1);
}

function compareKickPatterns(trackA, trackB) {
  const signatureA = Array.isArray(trackA?.anlzWaveform?.kickSignature)
    ? trackA.anlzWaveform.kickSignature
    : null;
  const signatureB = Array.isArray(trackB?.anlzWaveform?.kickSignature)
    ? trackB.anlzWaveform.kickSignature
    : null;

  if (!signatureA?.length || !signatureB?.length) {
    return null;
  }

  const overlap = Math.min(signatureA.length, signatureB.length);
  let dot = 0;
  let magnitude = 0;
  for (let index = 0; index < overlap; index += 1) {
    const a = Number(signatureA[index]) || 0;
    const b = Number(signatureB[index]) || 0;
    dot += a * b;
    magnitude += (a * a) + (b * b);
  }

  if (!magnitude) {
    return 0.5;
  }

  return clamp((dot / Math.sqrt(magnitude)) ** 0.35);
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
  const anlzScore = compareAnlzWaveformSummaries(trackA, trackB);
  if (anlzScore !== null) {
    return anlzScore;
  }

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

  const baseScore = clamp((durationScore * 0.35) + (bitrateScore * 0.2) + (energyScore * 0.2) + (tokenScore * 0.25));
  const nestedScore = compareNestedWaveformMarks(trackA, trackB);
  if (nestedScore === null) {
    return baseScore;
  }

  return clamp((baseScore * 0.55) + (nestedScore * 0.45));
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
  const baseScore = clamp((bpmScore * 0.55) + (phraseScore * 0.3) + (tokenScore * 0.15));
  const nestedTempoScore = compareNestedTempoMaps(trackA, trackB);
  const rhythmSignatureScore = compareRhythmSignatures(trackA, trackB);
  const kickScore = compareKickPatterns(trackA, trackB);

  if (nestedTempoScore !== null && rhythmSignatureScore !== null && kickScore !== null) {
    return clamp((baseScore * 0.2) + (nestedTempoScore * 0.25) + (rhythmSignatureScore * 0.3) + (kickScore * 0.25));
  }

  if (rhythmSignatureScore !== null && kickScore !== null) {
    return clamp((baseScore * 0.3) + (rhythmSignatureScore * 0.4) + (kickScore * 0.3));
  }

  if (rhythmSignatureScore !== null) {
    return clamp((baseScore * 0.35) + (rhythmSignatureScore * 0.65));
  }

  if (kickScore !== null) {
    return clamp((baseScore * 0.4) + (kickScore * 0.6));
  }

  if (nestedTempoScore !== null) {
    return clamp((baseScore * 0.6) + (nestedTempoScore * 0.4));
  }

  return baseScore;
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

function updateTopMatches(topMatches, row, limit) {
  if (limit <= 0) {
    return;
  }

  if (topMatches.length < limit) {
    topMatches.push(row);
    topMatches.sort((a, b) => b.score - a.score);
    return;
  }

  const last = topMatches[topMatches.length - 1];
  if (row.score <= last.score) {
    return;
  }

  topMatches.push(row);
  topMatches.sort((a, b) => b.score - a.score);
  topMatches.length = limit;
}

export function createAnalyzerVersion(tag = 'baseline-v4') {
  return `flow-${tag}`;
}

async function yieldToEventLoop() {
  if (typeof setImmediate === 'function') {
    await new Promise((resolve) => setImmediate(resolve));
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function getMemoryUsageMb() {
  if (typeof process?.memoryUsage !== 'function') {
    return 0;
  }
  const usage = process.memoryUsage();
  const rss = Number(usage?.rss || 0);
  return rss / (1024 * 1024);
}

function buildAbortError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export async function runBaselineAnalysis({
  tracks,
  sourceXmlPath = null,
  selectedFolders = [],
  componentWeights = DEFAULT_COMPONENT_WEIGHTS,
  algorithmVersion = createAnalyzerVersion(),
  maxPairs = 5000,
  topLimit = 20,
  yieldEveryPairs = 5000,
  maxPairsCap = 100000,
  onProgress = null,
  abortSignal = null,
  memoryLimitMb = 0,
  memoryCheckEveryPairs = 2000
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
  let pairCount = 0;
  const topMatches = [];

  try {
    const memoryLimit = Number.isFinite(memoryLimitMb) ? Math.max(0, memoryLimitMb) : 0;
    const memoryCheckEvery = Number.isFinite(memoryCheckEveryPairs)
      ? Math.max(0, Math.floor(memoryCheckEveryPairs))
      : 0;
    const safeCap = Number.isFinite(maxPairsCap) ? Math.max(0, Math.floor(maxPairsCap)) : Infinity;
    const requested = Number.isFinite(maxPairs) ? Math.max(0, maxPairs) : Infinity;
    const pairLimit = Math.min(requested, safeCap);
    const totalPairs = Math.min(
      pairLimit,
      Math.max(0, (safeTracks.length * (safeTracks.length - 1)) / 2)
    );
    const yieldEvery = Number.isFinite(yieldEveryPairs) ? Math.max(0, Math.floor(yieldEveryPairs)) : 0;
    const reportProgress = (extra = {}) => {
      if (typeof onProgress === 'function') {
        onProgress({
          pairCount,
          totalPairs,
          cacheHits,
          computed,
          ...extra
        });
      }
    };
    const checkAbort = () => {
      if (abortSignal?.aborted) {
        reportProgress({ aborted: true, reason: 'cancelled', done: true });
        throw buildAbortError('Baseline analysis canceled.');
      }
    };
    const checkMemory = () => {
      if (!memoryLimit || !memoryCheckEvery || pairCount % memoryCheckEvery !== 0) {
        return;
      }
      const memoryMb = getMemoryUsageMb();
      reportProgress({ memoryMb });
      if (memoryMb > memoryLimit) {
        reportProgress({ aborted: true, reason: 'memory', memoryMb, done: true });
        const error = new Error(`Memory limit exceeded (${memoryMb.toFixed(0)} MB > ${memoryLimit} MB).`);
        error.name = 'MemoryLimitError';
        throw error;
      }
    };

    for (let i = 0; i < safeTracks.length; i += 1) {
      checkAbort();
      const trackA = safeTracks[i];
      for (let j = i + 1; j < safeTracks.length; j += 1) {
        checkAbort();
        if (pairCount >= pairLimit) {
          break;
        }
        const trackB = safeTracks[j];
        pairCount += 1;
        checkMemory();
        const cached = getSimilarityFromCache({
          trackAId: trackA.id,
          trackBId: trackB.id,
          algorithmVersion
        });

        if (cached) {
          cacheHits += 1;
          const reason = cached.components?.reason
            || summarizeSimilarityComponents(cached.components);
          const row = {
            trackAId: cached.trackAId,
            trackBId: cached.trackBId,
            score: cached.score,
            components: cached.components,
            weights: cached.components?.weights || normalizedWeights,
            reason,
            fromCache: true
          };
          updateTopMatches(topMatches, row, topLimit);
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
        const row = {
          trackAId: String(trackA.id),
          trackBId: String(trackB.id),
          score: result.score,
          components: result.components,
          weights: result.weights,
          reason,
          fromCache: false
        };
        updateTopMatches(topMatches, row, topLimit);

        if (yieldEvery > 0 && pairCount % yieldEvery === 0) {
          reportProgress();
          await yieldToEventLoop();
        }
      }

      if (pairCount >= pairLimit) {
        break;
      }
    }

    reportProgress({ memoryMb: memoryLimit ? getMemoryUsageMb() : undefined, done: true });
    finishAnalysisRun(runId, 'completed', `pairs=${pairCount}, cacheHits=${cacheHits}, computed=${computed}`);

    return {
      runId,
      algorithmVersion,
      pairLimit,
      pairCount,
      cacheHits,
      computed,
      weights: normalizedWeights,
      topMatches
    };
  } catch (error) {
    finishAnalysisRun(runId, 'failed', error.message || 'Baseline analysis failed.');
    throw error;
  }
}
