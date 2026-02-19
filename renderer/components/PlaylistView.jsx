import React from 'react';
import { PlaylistCard } from './PlaylistCard';

export function PlaylistView({
  playlistSuggestions,
  isParsing,
  isAnalyzing,
  isClustering,
  tracks,
  runPlaylistClustering,
  clusterPreset,
  applyClusterPreset,
  clusterThreshold,
  setClusterThreshold,
  clusterMinSize,
  setClusterMinSize,
  clusterMaxPairs,
  setClusterMaxPairs,
  clusterStrictMode,
  setClusterStrictMode,
  playlistCardItems,
  startSampling,
  setExpandedClusterKey,
  expandedClusterKey,
  trackIndexById,
  getClusterDecision,
  updateClusterDecision,
  samplingState,
  setSelectedTrackId,
  togglePlayPause,
  seekFromWaveform,
  getPlaybackState,
  ClusterDetailsComponent,
  sampleSize,
  handleSampleSizeChange,
  stopSampling,
  skipSample,
  resumeSampling
}) {
  const renderClusterTable = (clusters, clusterKeyPrefix = '') => {
    if (!clusters.length) {
      return <p>No clusters met the threshold in this folder.</p>;
    }

    return (
      <table className="track-table" style={{ marginTop: '10px' }}>
        <thead>
          <tr>
            <th>Cluster</th>
            <th>Tracks</th>
            <th>BPM Range</th>
            <th>Key Focus</th>
            <th>Avg Score</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Top Tracks</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((cluster, index) => {
            const preview = cluster.trackIds.slice(0, 5).map((trackId) => {
              const track = trackIndexById.get(String(trackId));
              return track ? `${track.artist || ''} ${track.title || ''}`.trim() : trackId;
            }).filter(Boolean);
            const clusterKey = `${clusterKeyPrefix}${cluster.id || index}`;
            const isExpanded = expandedClusterKey === clusterKey;
            const decision = getClusterDecision(clusterKey);
            const clusterSamplingState = samplingState.active && samplingState.clusterKey === clusterKey
              ? samplingState
              : { active: false, currentIndex: 0, total: 0 };

            return (
              <React.Fragment key={cluster.id || String(index)}>
                <tr>
                  <td>#{index + 1}</td>
                  <td>{cluster.size}</td>
                  <td>
                    {cluster.summary?.bpm?.min !== null && cluster.summary?.bpm?.max !== null
                      ? `${cluster.summary.bpm.min.toFixed(1)}–${cluster.summary.bpm.max.toFixed(1)}`
                      : '-'}
                  </td>
                  <td>{cluster.summary?.key?.top?.key || '-'}</td>
                  <td>{cluster.avgScore.toFixed(3)}</td>
                  <td>
                    {(cluster.confidence ?? 0).toFixed(3)} {cluster.confidenceLabel ? `(${cluster.confidenceLabel})` : ''}
                  </td>
                  <td>
                    <div className={`status-pill status-${decision.status}`}>
                      {decision.status}
                    </div>
                    <div className="cluster-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => updateClusterDecision(clusterKey, { status: 'approved' })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => updateClusterDecision(clusterKey, { status: 'rejected' })}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => updateClusterDecision(clusterKey, { status: 'pending', name: '' })}
                      >
                        Reset
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Name playlist"
                      value={decision.name}
                      disabled={decision.status !== 'approved'}
                      onChange={(event) => updateClusterDecision(clusterKey, { name: event.target.value })}
                      style={{ width: '100%', marginTop: '6px' }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setExpandedClusterKey(isExpanded ? null : clusterKey)}
                      style={{ marginRight: '8px' }}
                    >
                      {isExpanded ? 'Hide' : 'View'}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => startSampling(cluster, clusterKey)}
                      disabled={samplingState?.active}
                      style={{ marginRight: '8px' }}
                    >
                      Sample
                    </button>
                    {preview.join(', ') || '-'}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr>
                    <td colSpan={8}>
                      <ClusterDetailsComponent
                        cluster={cluster}
                        trackIndexById={trackIndexById}
                        onSelectTrack={(trackId) => setSelectedTrackId(trackId)}
                        onTogglePlay={togglePlayPause}
                        onSeek={seekFromWaveform}
                        getPlaybackState={getPlaybackState}
                        clusterKey={clusterKey}
                        onStartSample={startSampling}
                        onStopSample={stopSampling}
                        onSkipSample={skipSample}
                        onResumeSample={resumeSampling}
                        samplingState={clusterSamplingState}
                        sampleSize={sampleSize}
                        onSampleSizeChange={handleSampleSizeChange}
                        disablePlay={samplingState?.active}
                      />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Playlist Suggestions</h3>
        <button
          type="button"
          className="secondary"
          onClick={runPlaylistClustering}
          disabled={isParsing || isAnalyzing || isClustering || tracks.length < 2}
        >
          {isClustering ? 'Building...' : 'Generate Suggestions'}
        </button>
      </div>
      <div className="meta">
        {playlistSuggestions?.result?.preset ? (
          <span>Preset: {playlistSuggestions.result.preset}</span>
        ) : null}
        <label>
          Preset
          <select
            value={clusterPreset}
            onChange={(event) => applyClusterPreset(event.target.value)}
            style={{ marginLeft: '6px' }}
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="exploratory">Exploratory</option>
          </select>
        </label>
        <label>
          Threshold
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={clusterThreshold}
            onChange={(event) => setClusterThreshold(event.target.value)}
            style={{ width: '90px', marginLeft: '6px' }}
          />
        </label>
        <label>
          Min Size
          <input
            type="number"
            min="2"
            step="1"
            value={clusterMinSize}
            onChange={(event) => setClusterMinSize(event.target.value)}
            style={{ width: '70px', marginLeft: '6px' }}
          />
        </label>
        <label>
          Max Pairs
          <input
            type="number"
            min="0"
            step="1000"
            value={clusterMaxPairs}
            onChange={(event) => setClusterMaxPairs(event.target.value)}
            style={{ width: '110px', marginLeft: '6px' }}
          />
        </label>
        <label>
          Strict
          <input
            type="checkbox"
            checked={clusterStrictMode}
            onChange={(event) => setClusterStrictMode(event.target.checked)}
            style={{ marginLeft: '6px' }}
          />
        </label>
      </div>
      {playlistCardItems.length ? (
        <div className="playlist-card-grid">
          {playlistCardItems.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onSample={() => startSampling(playlist.cluster, playlist.clusterKey)}
              onViewDetails={() => setExpandedClusterKey(playlist.clusterKey)}
            />
          ))}
        </div>
      ) : null}
      {playlistSuggestions ? (
        <>
          {playlistSuggestions.mode === 'grouped' ? (
            <>
              <div className="meta">
                <span>Groups: {playlistSuggestions.groups?.length || 0}</span>
              </div>
              {playlistSuggestions.groups?.length ? (
                playlistSuggestions.groups.map((group, groupIndex) => {
                  const clusters = group.result?.clusters || [];
                  return (
                    <div key={`${group.name}-${groupIndex}`} style={{ marginTop: '14px' }}>
                      <h4 style={{ marginBottom: '6px' }}>{group.name} ({group.trackCount} tracks)</h4>
                      <div className="meta">
                        <span>Clusters: {clusters.length}</span>
                        <span>Pairs: {group.result?.pairCount ?? 0}</span>
                        <span>Computed: {group.result?.computed ?? 0}</span>
                        <span>Cache Hits: {group.result?.cacheHits ?? 0}</span>
                      </div>
                      {renderClusterTable(clusters, `${group.name}-`)}
                    </div>
                  );
                })
              ) : (
                <p>No clusters met the threshold. Try lowering it a bit.</p>
              )}
            </>
          ) : (
            <>
              <div className="meta">
                <span>Clusters: {playlistSuggestions.result?.clusters?.length || 0}</span>
                <span>Pairs: {playlistSuggestions.result?.pairCount ?? 0}</span>
                <span>Computed: {playlistSuggestions.result?.computed ?? 0}</span>
                <span>Cache Hits: {playlistSuggestions.result?.cacheHits ?? 0}</span>
              </div>
              {renderClusterTable(playlistSuggestions.result?.clusters || [], 'all-')}
            </>
          )}
        </>
      ) : (
        <p>Generate suggestions to see clustered playlists.</p>
      )}
    </div>
  );
}
