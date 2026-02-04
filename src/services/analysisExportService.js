function toSafeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function csvEscape(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

export function buildAnalysisExportRows(analysisResult, trackIndex = {}) {
  const topMatches = Array.isArray(analysisResult?.topMatches) ? analysisResult.topMatches : [];

  return topMatches.map((match) => {
    const trackA = trackIndex[String(match.trackAId)] || null;
    const trackB = trackIndex[String(match.trackBId)] || null;

    return {
      trackAId: String(match.trackAId ?? ''),
      trackAArtist: trackA?.artist || '',
      trackATitle: trackA?.title || '',
      trackABpm: trackA?.bpm ?? '',
      trackAKey: trackA?.key || '',
      trackBId: String(match.trackBId ?? ''),
      trackBArtist: trackB?.artist || '',
      trackBTitle: trackB?.title || '',
      trackBBpm: trackB?.bpm ?? '',
      trackBKey: trackB?.key || '',
      score: toSafeNumber(match.score).toFixed(6),
      componentBpm: toSafeNumber(match.components?.bpm).toFixed(6),
      componentKey: toSafeNumber(match.components?.key).toFixed(6),
      componentWaveform: toSafeNumber(match.components?.waveform).toFixed(6),
      componentRhythm: toSafeNumber(match.components?.rhythm).toFixed(6),
      reason: match.reason || '',
      source: match.fromCache ? 'cache' : 'computed'
    };
  });
}

export function buildAnalysisCsv(analysisResult, trackIndex = {}) {
  const headers = [
    'trackAId',
    'trackAArtist',
    'trackATitle',
    'trackABpm',
    'trackAKey',
    'trackBId',
    'trackBArtist',
    'trackBTitle',
    'trackBBpm',
    'trackBKey',
    'score',
    'componentBpm',
    'componentKey',
    'componentWaveform',
    'componentRhythm',
    'reason',
    'source'
  ];

  const rows = buildAnalysisExportRows(analysisResult, trackIndex);
  const csvRows = [headers.join(',')];

  for (const row of rows) {
    csvRows.push(headers.map((key) => csvEscape(row[key])).join(','));
  }

  return `${csvRows.join('\n')}\n`;
}

export function buildAnalysisJson(analysisResult, trackIndex = {}) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    algorithmVersion: analysisResult?.algorithmVersion || '',
    pairCount: Number(analysisResult?.pairCount || 0),
    cacheHits: Number(analysisResult?.cacheHits || 0),
    computed: Number(analysisResult?.computed || 0),
    weights: analysisResult?.weights || null,
    rows: buildAnalysisExportRows(analysisResult, trackIndex)
  }, null, 2);
}
