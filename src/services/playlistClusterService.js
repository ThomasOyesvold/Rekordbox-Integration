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

export function generatePlaylistClusters({
  tracks,
  sourceXmlPath = null,
  selectedFolders = [],
  algorithmVersion = createAnalyzerVersion(),
  similarityThreshold = 0.78,
  maxPairs = 15000,
  minClusterSize = 3,
  maxClusters = 25
} = {}) {
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const trackIndexById = new Map(safeTracks.map((track, index) => [String(track.id), index]));
  const threshold = Math.max(0, Math.min(1, toNumber(similarityThreshold, 0.78)));
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

    clusters.sort((a, b) => {
      if (b.size !== a.size) {
        return b.size - a.size;
      }
      return b.avgScore - a.avgScore;
    });

    const limitedClusters = clusters.slice(0, clusterLimit);
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
