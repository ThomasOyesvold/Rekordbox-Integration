import { computeBaselineSimilarity, createAnalyzerVersion } from './baselineAnalyzerService.js';
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

function computeClusterConfidence(cluster) {
  const sizeScore = 1 - Math.exp(-((cluster.size || 0) / 6));
  const density = cluster.size > 1
    ? cluster.edgeCount / ((cluster.size * (cluster.size - 1)) / 2)
    : 0;
  const densityScore = clamp(density);
  const avgScore = clamp(cluster.avgScore || 0);

  return clamp((avgScore * 0.55) + (densityScore * 0.25) + (sizeScore * 0.2));
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

  let bestStart = tracks[0];
  let bestStartScore = -Infinity;

  for (const candidate of tracks) {
    let total = 0;
    for (const other of tracks) {
      if (candidate === other) {
        continue;
      }
      total += getSimilarityScore(candidate, other, algorithmVersion, runId, cacheStats);
    }
    if (total > bestStartScore) {
      bestStartScore = total;
      bestStart = candidate;
    }
  }

  const remaining = new Set(tracks);
  remaining.delete(bestStart);
  const ordered = [bestStart];

  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1];
    let bestNext = null;
    let bestScore = -Infinity;
    for (const candidate of remaining) {
      const score = getSimilarityScore(last, candidate, algorithmVersion, runId, cacheStats);
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
      const stat = clusterStats.get(root) || { sum: 0, count: 0, max: 0 };
      stat.sum += edge.score;
      stat.count += 1;
      stat.max = Math.max(stat.max, edge.score);
      clusterStats.set(root, stat);
    }

    const clusters = [];
    for (const [root, trackIds] of groups.entries()) {
      if (trackIds.length < minSize) {
        continue;
      }
      const stats = clusterStats.get(root) || { sum: 0, count: 0, max: 0 };
    clusters.push({
      id: `cluster-${root}`,
      trackIds,
      size: trackIds.length,
      edgeCount: stats.count,
      avgScore: stats.count ? stats.sum / stats.count : 0,
      maxScore: stats.max
    });
  }

    for (const cluster of clusters) {
      cluster.confidence = computeClusterConfidence(cluster);
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
