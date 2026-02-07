import { motion } from 'framer-motion';
import './TrackTable.css';

export function TrackTable({ tracks, onTrackClick, playingTrackId }) {
  return (
    <div className="track-table-container">
      <div className="track-table">
        <div className="track-table-header">
          <div className="track-col track-col-status" />
          <div className="track-col track-col-id">#</div>
          <div className="track-col track-col-title">Title</div>
          <div className="track-col track-col-artist">Artist</div>
          <div className="track-col track-col-bpm">BPM</div>
          <div className="track-col track-col-key">Key</div>
          <div className="track-col track-col-duration">Duration</div>
          <div className="track-col track-col-waveform">Waveform</div>
        </div>

        <div className="track-table-body">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id || track.trackId || index}
              track={track}
              index={index}
              isPlaying={track.id === playingTrackId || track.trackId === playingTrackId}
              onClick={() => onTrackClick?.(track)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackRow({ track, index, isPlaying, onClick }) {
  return (
    <motion.div
      className={`track-row ${isPlaying ? 'playing' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      whileHover={{ x: 4 }}
      onClick={onClick}
    >
      <div className="track-col track-col-status">
        {isPlaying ? <div className="status-indicator" /> : null}
      </div>
      <div className="track-col track-col-id">{track.TrackID || track.trackId || index + 1}</div>
      <div className="track-col track-col-title">{track.Name || track.title || 'Unknown'}</div>
      <div className="track-col track-col-artist">{track.Artist || track.artist || 'Unknown'}</div>
      <div className="track-col track-col-bpm">
        {track.AverageBpm || track.bpm ? (
          <>
            <span className="bpm-value">{Math.round(track.AverageBpm || track.bpm)}</span>
            <span className="bpm-unit">BPM</span>
          </>
        ) : (
          '-'
        )}
      </div>
      <div className="track-col track-col-key">{track.tonality?.key || track.key || '-'}</div>
      <div className="track-col track-col-duration">
        {track.TotalTime || track.durationSeconds
          ? formatDuration(track.TotalTime || track.durationSeconds)
          : '-'}
      </div>
      <div className="track-col track-col-waveform">
        {track.anlzWaveform ? <MiniWaveform waveform={track.anlzWaveform} /> : null}
      </div>
    </motion.div>
  );
}

function MiniWaveform({ waveform }) {
  if (!waveform?.binColors) {
    return null;
  }

  return (
    <div className="mini-waveform">
      {waveform.binColors.slice(0, 40).map((color, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            background: `rgb(${color.r}, ${color.g}, ${color.b})`,
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
