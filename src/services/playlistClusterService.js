import {
  computeBaselineSimilarity,
  computeBpmScore,
  computeKeyScore,
  createAnalyzerVersion
} from './baselineAnalyzerService.js';
import {
  beginAnalysisRun,
  finishAnalysisRun,
  getSimilarityFromCache,
  saveSimilarityToCache,
  upsertTrackSignatures
} from './similarityCacheService.js';

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_value, index) => index);
    this.rank = new Array(size).fill(0);
  }

  find(index) {
    let current = index;
    while (this.parent[current] !== current) {
      current = this.parent[current];
    }
    let root = current;
    current = index;
    while (this.parent[current] !== current) {
      const next = this.parent[current];
      this.parent[current] = root;
      current = next;
    }
    return root;
  }

  union(left, right) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) {
      return false;
    }
    if (this.rank[leftRoot] < this.rank[rightRoot]) {
      this.parent[leftRoot] = rightRoot;
    } else if (this.rank[leftRoot] > this.rank[rightRoot]) {
      this.parent[rightRoot] = leftRoot;
    } else {
      this.parent[rightRoot] = leftRoot;
      this.rank[leftRoot] += 1;
    }
    return true;
  }
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function sortTracksDeterministically(tracks) {
  return [...tracks].sort((a, b) => {
    const bpmA = Number.isFinite(Number(a.bpm)) ? Number(a.bpm) : Infinity;
    const bpmB = Number.isFinite(Number(b.bpm)) ? Number(b.bpm) : Infinity;
    if (bpmA !== bpmB) {
      return bpmA - bpmB;
    }
    const keyA = String(a.key || '').toUpperCase();
    const keyB = String(b.key || '').toUpperCase();
    if (keyA !== keyB) {
      return keyA.localeCompare(keyB);
    }
    const titleA = String(a.title || '');
    const titleB = String(b.title || '');
    if (titleA !== titleB) {
      return titleA.localeCompare(titleB);
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

function computeAdjacencyScore(trackA, trackB) {
  const bpmScore = computeBpmScore(trackA.bpm, trackB.bpm);
  const keyScore = computeKeyScore(trackA.key, trackB.key);
  return clamp((bpmScore * 0.6) + (keyScore * 0.4));
}

function buildClusterSummary(trackIds, trackById) {
  const tracks = trackIds.map((trackId) => trackById.get(String(trackId))).filter(Boolean);
  const bpmValues = tracks.map((track) => Number(track.bpm)).filter((value) => Number.isFinite(value));
  const bpmMin = bpmValues.length ? Math.min(...bpmValues) : null;
  const bpmMax = bpmValues.length ? Math.max(...bpmValues) : null;
  const bpmAvg = bpmValues.length ? bpmValues.reduce((sum, value) => sum + value, 0) / bpmValues.length : null;
  const keyCounts = {};
  let waveformCount = 0;
  let rhythmCount = 0;
  for (const track of tracks) {
    const key = String(track.key || '').trim();
    if (key) {
      keyCounts[key] = (keyCounts[key] || 0) + 1;
    }
    if (track.anlzWaveform?.bins?.length) {
      waveformCount += 1;
    }
    if (track.anlzWaveform?.rhythmSignature?.length || track.anlzWaveform?.kickSignature?.length || track.nestedTempoPoints?.length) {
      rhythmCount += 1;
    }
  }

  const topKey = Object.entries(keyCounts).sort((a, b) => b[1] - a[1])[0] || null;

  return {
    bpm: {
      min: bpmMin,
      max: bpmMax,
      avg: bpmAvg
    },
    key: {
      top: topKey ? { key: topKey[0], count: topKey[1] } : null,
      counts: keyCounts
    },
    coverage: {
      waveform: { count: waveformCount, total: tracks.length },
      rhythm: { count: rhythmCount, total: tracks.length }
    }
  };
}

function buildClusterReasons(summary) {
  if (!summary) {
    return [];
  }
  const reasons = [];
  if (Number.isFinite(summary.bpm?.min) && Number.isFinite(summary.bpm?.max)) {
    reasons.push(`BPM ${summary.bpm.min.toFixed(1)}–${summary.bpm.max.toFixed(1)}`);
  }
  if (summary.key?.top?.key) {
    reasons.push(`Key focus ${summary.key.top.key}`);
  }
  if (summary.coverage?.waveform?.total) {
    reasons.push(`Waveform data ${summary.coverage.waveform.count}/${summary.coverage.waveform.total}`);
  }
  if (summary.coverage?.rhythm?.total) {
    reasons.push(`Rhythm data ${summary.coverage.rhythm.count}/${summary.coverage.rhythm.total}`);
  }
  return reasons;
}

function computeClusterConfidence(cluster) {
  const sizeScore = 1 - Math.exp(-((cluster.size || 0) / 6));
  const density = cluster.size > 1
    ? cluster.edgeCount / ((cluster.size * (cluster.size - 1)) / 2)
    : 0;
  const densityScore = clamp(density);
  const avgScore = clamp(cluster.avgScore || 0);
  const minScore = clamp(cluster.minScore || 0);
  const variancePenalty = Math.max(0, (avgScore - minScore) * 0.6);

  const base = (avgScore * 0.5) + (densityScore * 0.2) + (sizeScore * 0.2) + (minScore * 0.1);
  return clamp(base - variancePenalty);
}

function buildClusterLabel(confidence) {
  if (confidence >= 0.85) {
    return 'strong';
  }
  if (confidence >= 0.7) {
    return 'good';
  }
  if (confidence >= 0.55) {
    return 'mixed';
  }
  return 'weak';
}

function buildClusterWarnings(cluster) {
  const warnings = [];
  if ((cluster.minScore ?? 1) < 0.55) {
    warnings.push('Contains low-score outliers');
  }
  if ((cluster.summary?.coverage?.waveform?.count || 0) < (cluster.size || 0) * 0.4) {
    warnings.push('Limited waveform coverage');
  }
  if ((cluster.summary?.coverage?.rhythm?.count || 0) < (cluster.size || 0) * 0.4) {
    warnings.push('Limited rhythm coverage');
  }
  return warnings;
}

function getSimilarityScore(trackA, trackB, algorithmVersion, runId, cacheStats) {
  const cached = getSimilarityFromCache({
    trackAId: trackA.id,
    trackBId: trackB.id,
    algorithmVersion
  });

  if (cached) {
    cacheStats.cacheHits += 1;
    return cached.score;
  }

  const result = computeBaselineSimilarity(trackA, trackB);
  saveSimilarityToCache({
    trackAId: trackA.id,
    trackBId: trackB.id,
    algorithmVersion,
    score: result.score,
    components: result.components,
    analysisRunId: runId
  });
  cacheStats.computed += 1;
  return result.score;
}

function orderClusterTracks({ trackIds, trackById, algorithmVersion, runId }) {
  const cacheStats = { cacheHits: 0, computed: 0 };
  const tracks = trackIds.map((trackId) => trackById.get(String(trackId))).filter(Boolean);
  if (tracks.length <= 2) {
    return tracks.map((track) => String(track.id));
  }

  const sortedTracks = sortTracksDeterministically(tracks);
  let bestStart = sortedTracks[0];
  let bestStartScore = -Infinity;

  for (const candidate of sortedTracks) {
    let total = 0;
    for (const other of sortedTracks) {
      if (candidate === other) {
        continue;
      }
      const similarity = getSimilarityScore(candidate, other, algorithmVersion, runId, cacheStats);
      const adjacency = computeAdjacencyScore(candidate, other);
      total += (similarity * 0.7) + (adjacency * 0.3);
    }
    if (total > bestStartScore) {
      bestStartScore = total;
      bestStart = candidate;
    }
  }

  const remaining = new Set(sortedTracks);
  remaining.delete(bestStart);
  const ordered = [bestStart];

  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1];
    let bestNext = null;
    let bestScore = -Infinity;
    const remainingSorted = sortTracksDeterministically(Array.from(remaining));
    for (const candidate of remainingSorted) {
      const similarity = getSimilarityScore(last, candidate, algorithmVersion, runId, cacheStats);
      const adjacency = computeAdjacencyScore(last, candidate);
      const score = (similarity * 0.7) + (adjacency * 0.3);
      if (score > bestScore) {
        bestScore = score;
        bestNext = candidate;
      }
    }
    if (!bestNext) {
      break;
    }
    ordered.push(bestNext);
    remaining.delete(bestNext);
  }

  return ordered.map((track) => String(track.id));
}

export function generatePlaylistClusters({
  tracks,
  sourceXmlPath = null,
  selectedFolders = [],
  algorithmVersion = createAnalyzerVersion(),
  similarityThreshold = 0.82,
  strictMode = true,
  maxPairs = 15000,
  minClusterSize = 3,
  maxClusters = 25,
  optimizeFlow = true
} = {}) {
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const trackIndexById = new Map(safeTracks.map((track, index) => [String(track.id), index]));
  const trackById = new Map(safeTracks.map((track) => [String(track.id), track]));
  const baseThreshold = Math.max(0, Math.min(1, toNumber(similarityThreshold, 0.82)));
  const threshold = strictMode ? clamp(baseThreshold + 0.03, 0, 0.98) : baseThreshold;
  const pairLimit = Number.isFinite(maxPairs) ? Math.max(0, Math.floor(maxPairs)) : Infinity;
  const minSize = Math.max(2, Math.floor(toNumber(minClusterSize, 3)));
  const clusterLimit = Number.isFinite(maxClusters) ? Math.max(1, Math.floor(maxClusters)) : Infinity;

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
  const edges = [];

  const dsu = new DisjointSet(safeTracks.length);

  try {
    for (let i = 0; i < safeTracks.length; i += 1) {
      const trackA = safeTracks[i];
      for (let j = i + 1; j < safeTracks.length; j += 1) {
        if (pairCount >= pairLimit) {
          break;
        }
        const trackB = safeTracks[j];
        pairCount += 1;

        const cached = getSimilarityFromCache({
          trackAId: trackA.id,
          trackBId: trackB.id,
          algorithmVersion
        });

        let score;
        let components;

        if (cached) {
          cacheHits += 1;
          score = cached.score;
          components = cached.components;
        } else {
          const result = computeBaselineSimilarity(trackA, trackB);
          score = result.score;
          components = result.components;
          saveSimilarityToCache({
            trackAId: trackA.id,
            trackBId: trackB.id,
            algorithmVersion,
            score,
            components,
            analysisRunId: runId
          });
          computed += 1;
        }

        if (score >= threshold) {
          dsu.union(i, j);
          edges.push({
            a: String(trackA.id),
            b: String(trackB.id),
            score,
            components
          });
        }
      }

      if (pairCount >= pairLimit) {
        break;
      }
    }

    const groups = new Map();
    for (let index = 0; index < safeTracks.length; index += 1) {
      const root = dsu.find(index);
      const entry = groups.get(root) || [];
      entry.push(String(safeTracks[index].id));
      groups.set(root, entry);
    }

    const clusterStats = new Map();
    for (const edge of edges) {
      const index = trackIndexById.get(edge.a);
      if (index === undefined) {
        continue;
      }
      const root = dsu.find(index);
      const stat = clusterStats.get(root) || { sum: 0, count: 0, max: 0, min: 1 };
      stat.sum += edge.score;
      stat.count += 1;
      stat.max = Math.max(stat.max, edge.score);
      stat.min = Math.min(stat.min, edge.score);
      clusterStats.set(root, stat);
    }

    const clusters = [];
    for (const [root, trackIds] of groups.entries()) {
      if (trackIds.length < minSize) {
        continue;
      }
      const stats = clusterStats.get(root) || { sum: 0, count: 0, max: 0, min: 0 };
      const summary = buildClusterSummary(trackIds, trackById);
      clusters.push({
        id: `cluster-${root}`,
        trackIds,
        size: trackIds.length,
        edgeCount: stats.count,
        avgScore: stats.count ? stats.sum / stats.count : 0,
        maxScore: stats.max || 0,
        minScore: stats.count ? stats.min : 0,
        summary,
        reasons: buildClusterReasons(summary)
      });
    }

    for (const cluster of clusters) {
      cluster.confidence = computeClusterConfidence(cluster);
      cluster.confidenceLabel = buildClusterLabel(cluster.confidence);
      cluster.warnings = buildClusterWarnings(cluster);
    }

    clusters.sort((a, b) => {
      if (b.size !== a.size) {
        return b.size - a.size;
      }
      return b.confidence - a.confidence;
    });

    const limitedClusters = clusters.slice(0, clusterLimit).map((cluster) => {
      if (!optimizeFlow || cluster.trackIds.length < 2) {
        return cluster;
      }

      const ordered = orderClusterTracks({
        trackIds: cluster.trackIds,
        trackById,
        algorithmVersion,
        runId
      });

      return {
        ...cluster,
        trackIds: ordered,
        ordered: true
      };
    });
    finishAnalysisRun(runId, 'completed', `pairs=${pairCount}, clusters=${limitedClusters.length}`);

    return {
      runId,
      algorithmVersion,
      pairCount,
      cacheHits,
      computed,
      similarityThreshold: threshold,
      minClusterSize: minSize,
      clusters: limitedClusters
    };
  } catch (error) {
    finishAnalysisRun(runId, 'failed', error.message || 'Playlist clustering failed.');
    throw error;
  }
}
