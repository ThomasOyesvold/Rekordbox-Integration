export function RandomSampler({
  cluster,
  clusterKey,
  samplingState,
  sampleSize,
  onSampleSizeChange,
  samplingCooldownSeconds,
  onCooldownChange,
  onStartSample,
  onStopSample,
  onSkipSample,
  onResumeSample,
  samplingPaused,
  samplingFinished,
  samplingCountdown,
  samplingElapsedLabel,
  getSamplingTrackLabel
}) {
  const isActive = Boolean(samplingState?.active);
  const total = samplingState?.total || 0;
  const currentIndex = samplingState?.currentIndex || 0;

  return (
    <>
      <div className="meta sampling-meta" style={{ marginBottom: '8px' }}>
        <span>Tracks: {cluster.size}</span>
        <span>Avg Score: {cluster.avgScore.toFixed(3)}</span>
        <span>Confidence: {(cluster.confidence ?? 0).toFixed(3)}</span>
        <span>Label: {cluster.confidenceLabel || 'mixed'}</span>
        <span>Ordered: {cluster.ordered ? 'Yes' : 'No'}</span>
        {cluster.summary?.bpm?.min !== null && cluster.summary?.bpm?.max !== null ? (
          <span>
            BPM Range: {cluster.summary.bpm.min.toFixed(1)}–{cluster.summary.bpm.max.toFixed(1)}
          </span>
        ) : null}
        {cluster.warnings?.length ? (
          <span style={{ color: '#f97316' }}>
            {cluster.warnings.join(' · ')}
          </span>
        ) : null}
        <span className="sampling-input">
          Sample
          <input
            type="number"
            min="10"
            max="20"
            step="1"
            value={sampleSize}
            onChange={(event) => onSampleSizeChange?.(event.target.value)}
            style={{ width: '70px', marginLeft: '6px' }}
          />
        </span>
        <span className="sampling-input">
          Cooldown
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={samplingCooldownSeconds}
            onChange={(event) => onCooldownChange?.(event.target.value)}
            style={{ width: '70px', marginLeft: '6px' }}
          />
        </span>
        <span className="sampling-action">
          <button
            type="button"
            className="secondary"
            onClick={() => onStartSample?.(cluster, clusterKey)}
            disabled={!cluster.trackIds.length || isActive}
          >
            {isActive ? 'Sampling…' : 'Sample Playlist'}
          </button>
        </span>
        <span className="sampling-action">
          <button
            type="button"
            className="secondary"
            onClick={() => onStopSample?.()}
            disabled={!isActive}
          >
            Stop Sample
          </button>
        </span>
        <span className="sampling-action">
          <button
            type="button"
            className="secondary"
            onClick={() => onSkipSample?.()}
            disabled={!isActive}
          >
            Skip
          </button>
        </span>
        <span className="sampling-action">
          <button
            type="button"
            className="secondary"
            onClick={() => onResumeSample?.()}
            disabled={!isActive || !samplingPaused}
          >
            Resume
          </button>
        </span>
        {isActive ? (
          <span className={`sampling-badge${samplingPaused ? ' paused' : ''}`}>
            {samplingPaused ? 'Paused' : 'Sampling'}
          </span>
        ) : null}
        {!isActive && samplingFinished ? (
          <span className="sampling-badge finished">Finished</span>
        ) : null}
        {isActive ? (
          <span className="sampling-track-label">{getSamplingTrackLabel?.()}</span>
        ) : null}
        {isActive ? (
          <span>
            {currentIndex + 1}/{total}
          </span>
        ) : null}
        {isActive ? (
          <span>
            Next in {samplingCountdown ?? '--'}s
          </span>
        ) : null}
        {isActive ? (
          <span>
            Elapsed {samplingElapsedLabel || '--:--'}
          </span>
        ) : null}
      </div>
      {isActive ? (
        <div className="sampling-progress" aria-label="Sampling progress">
          <div
            className="sampling-progress-bar"
            style={{
              width: `${total > 0
                ? Math.min(100, Math.max(0, ((currentIndex + 1) / total) * 100))
                : 0}%`
            }}
          />
        </div>
      ) : null}
    </>
  );
}
