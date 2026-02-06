import { computeBaselineSimilarity, createAnalyzerVersion, summarizeSimilarityComponents } from './baselineAnalyzerService.js';
import {
  beginAnalysisRun,
  finishAnalysisRun,
  getSimilarityFromCache,
  saveSimilarityToCache,
  upsertTrackSignatures
} from './similarityCacheService.js';

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

export function findSimilarTracks({
  tracks,
  targetId,
  sourceXmlPath = null,
  selectedFolders = [],
  algorithmVersion = createAnalyzerVersion(),
  limit = 20,
  minScore = 0.6
} = {}) {
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const target = safeTracks.find((track) => String(track.id) === String(targetId));
  if (!target) {
    throw new Error('Target track not found.');
  }

  const safeLimit = Math.max(1, Math.floor(toNumber(limit, 20)));
  const scoreFloor = clamp(toNumber(minScore, 0.6));

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
  const matches = [];

  try {
    for (const candidate of safeTracks) {
      if (String(candidate.id) === String(target.id)) {
        continue;
      }

      pairCount += 1;
      const cached = getSimilarityFromCache({
        trackAId: target.id,
        trackBId: candidate.id,
        algorithmVersion
      });

      if (cached) {
        cacheHits += 1;
        const reason = cached.components?.reason
          || summarizeSimilarityComponents(cached.components);
        if (cached.score >= scoreFloor) {
          updateTopMatches(matches, {
            trackId: cached.trackBId,
            score: cached.score,
            components: cached.components,
            weights: cached.components?.weights || null,
            reason,
            fromCache: true
          }, safeLimit);
        }
        continue;
      }

      const result = computeBaselineSimilarity(target, candidate);
      const reason = summarizeSimilarityComponents(result.components);
      saveSimilarityToCache({
        trackAId: target.id,
        trackBId: candidate.id,
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

      if (result.score >= scoreFloor) {
        updateTopMatches(matches, {
          trackId: String(candidate.id),
          score: result.score,
          components: result.components,
          weights: result.weights,
          reason,
          fromCache: false
        }, safeLimit);
      }
    }

    finishAnalysisRun(runId, 'completed', `pairs=${pairCount}, matches=${matches.length}`);

    return {
      runId,
      algorithmVersion,
      targetId: String(target.id),
      pairCount,
      cacheHits,
      computed,
      limit: safeLimit,
      minScore: scoreFloor,
      matches
    };
  } catch (error) {
    finishAnalysisRun(runId, 'failed', error.message || 'Similarity search failed.');
    throw error;
  }
}
