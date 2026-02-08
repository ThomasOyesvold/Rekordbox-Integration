import { motion } from 'framer-motion';
import './TrackTable.css';

export function TrackTable({
  tracks,
  onTrackClick,
  onTogglePlay,
  getPlaybackState,
  disablePlay = false
}) {
  return (
    <div className="track-list-container">
      <div className="track-list">
        <div className="track-list-header">
          <div className="track-cell track-cell-play">Play</div>
          <div className="track-cell track-cell-title">Title</div>
          <div className="track-cell track-cell-bpm">BPM</div>
          <div className="track-cell track-cell-key">Key</div>
          <div className="track-cell track-cell-waveform">Waveform</div>
          <div className="track-cell track-cell-genre">Genre</div>
          <div className="track-cell track-cell-duration">Duration</div>
          <div className="track-cell track-cell-artist">Artist</div>
        </div>

        <div className="track-list-body">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id || track.trackId || index}
              track={track}
              index={index}
              onClick={() => onTrackClick?.(track)}
              onTogglePlay={onTogglePlay}
              getPlaybackState={getPlaybackState}
              disablePlay={disablePlay}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackRow({ track, index, onClick, onTogglePlay, getPlaybackState, disablePlay }) {
  const trackId = String(track.id || track.trackId || track.TrackID || '');
  const playback = trackId ? getPlaybackState?.(trackId) : null;
  const isPlaying = playback?.status === 'playing';
  const isLoading = playback?.loading;
  const title = track.title || track.Name || 'Unknown';
  const artist = track.artist || track.Artist || 'Unknown';
  const genre = track.genre || track.Genre || '-';
  const bpmValue = track.bpm ?? track.AverageBpm;
  const bpmLabel = Number.isFinite(Number(bpmValue)) ? Math.round(bpmValue) : '-';
  const keyValue = track.key || track.tonality?.key || '-';
  const durationValue = track.durationSeconds || track.TotalTime;

  return (
    <motion.div
      className={`track-list-row ${isPlaying ? 'playing' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015, duration: 0.2 }}
      whileHover={{ x: 2 }}
      onClick={onClick}
    >
      <div className="track-cell track-cell-play">
        <button
          type="button"
          className="play-button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePlay?.(track);
          }}
          disabled={disablePlay || !trackId || isLoading}
        >
          {isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
        </button>
        {playback?.status === 'error' ? (
          <div className="playback-error">{playback.error}</div>
        ) : null}
      </div>
      <div className="track-cell track-cell-title">{title}</div>
      <div className="track-cell track-cell-bpm">
        {bpmLabel !== '-' ? (
          <>
            <span className="bpm-value">{bpmLabel}</span>
            <span className="bpm-unit">BPM</span>
          </>
        ) : (
          '-'
        )}
      </div>
      <div className="track-cell track-cell-key">{keyValue}</div>
      <div className="track-cell track-cell-waveform">
        {track.anlzWaveform ? <MiniWaveform waveform={track.anlzWaveform} /> : <span>-</span>}
      </div>
      <div className="track-cell track-cell-genre">{genre}</div>
      <div className="track-cell track-cell-duration">
        {durationValue ? formatDuration(durationValue) : '-'}
      </div>
      <div className="track-cell track-cell-artist">{artist}</div>
    </motion.div>
  );
}

function MiniWaveform({ waveform }) {
  if (!waveform?.bins?.length && !waveform?.binColors?.length) {
    return null;
  }

  const binColors = Array.isArray(waveform?.binColors) ? waveform.binColors : [];
  const bins = Array.isArray(waveform?.bins) ? waveform.bins : [];
  const fallbackColor = waveform?.avgColor || { red: 0, green: 170, blue: 255 };
  const step = Math.max(1, Math.ceil((bins.length || binColors.length) / 40));
  const bars = [];

  for (let i = 0; i < Math.max(bins.length, binColors.length); i += step) {
    const color = binColors[i] || fallbackColor;
    const red = Math.max(0, Math.min(255, Number(color.red ?? color.r) || 0));
    const green = Math.max(0, Math.min(255, Number(color.green ?? color.g) || 0));
    const blue = Math.max(0, Math.min(255, Number(color.blue ?? color.b) || 0));
    bars.push({ red, green, blue });
  }

  return (
    <div className="mini-waveform">
      {bars.map((color, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            background: `rgb(${color.red}, ${color.green}, ${color.blue})`,
            opacity: 0.8
          }}
        />
      ))}
    </div>
  );
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
