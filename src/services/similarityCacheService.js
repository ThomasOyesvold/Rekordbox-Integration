import crypto from 'node:crypto';
import {
  completeAnalysisRun,
  createAnalysisRun,
  getCachedSimilarity,
  saveSimilarityScore,
  upsertTrackSignature
} from '../state/sqliteStore.js';

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function createTrackSignature(track, signatureVersion = 'v1') {
  const source = JSON.stringify({
    artist: track.artist || '',
    title: track.title || '',
    bpm: normalizeNumber(track.bpm),
    key: track.key || '',
    durationSeconds: normalizeNumber(track.durationSeconds),
    genre: track.genre || ''
  });

  return {
    signature: crypto.createHash('sha1').update(`${signatureVersion}:${source}`).digest('hex'),
    signatureVersion
  };
}

export function upsertTrackSignatures(tracks, signatureVersion = 'v1') {
  for (const track of tracks) {
    const { signature } = createTrackSignature(track, signatureVersion);
    upsertTrackSignature({
      trackId: track.id,
      signature,
      signatureVersion,
      bpm: normalizeNumber(track.bpm),
      musicalKey: track.key || null,
      durationSeconds: normalizeNumber(track.durationSeconds)
    });
  }
}

export function beginAnalysisRun({ algorithmVersion, sourceXmlPath, selectedFolders, trackCount }) {
  return createAnalysisRun({
    algorithmVersion,
    sourceXmlPath,
    selectedFolders,
    trackCount,
    status: 'running'
  });
}

export function finishAnalysisRun(runId, status = 'completed', notes = null) {
  completeAnalysisRun(runId, status, notes);
}

export function getSimilarityFromCache({ trackAId, trackBId, algorithmVersion }) {
  return getCachedSimilarity({ trackAId, trackBId, algorithmVersion });
}

export function saveSimilarityToCache({ trackAId, trackBId, algorithmVersion, score, components, analysisRunId }) {
  saveSimilarityScore({
    trackAId,
    trackBId,
    algorithmVersion,
    score,
    components,
    analysisRunId
  });
}
