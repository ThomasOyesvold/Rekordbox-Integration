import { useMemo } from 'react';
import { Pause, Play } from 'lucide-react';
import './WaveformPlayer.css';

export function WaveformPlayer({
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onTogglePlay,
  children
}) {
  const formattedCurrent = useMemo(() => formatTime(currentTime), [currentTime]);
  const formattedDuration = useMemo(() => formatTime(duration), [duration]);

  return (
    <div className="waveform-player">
      <div className="waveform-container">
        <div className="waveform">
          {children}
        </div>
      </div>
      <div className="waveform-controls">
        <button type="button" className="waveform-play-btn" onClick={onTogglePlay}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <div className="waveform-time">
          <span className="time-current">{formattedCurrent}</span>
          <span className="time-separator">/</span>
          <span className="time-duration">{formattedDuration}</span>
        </div>
      </div>
    </div>
  );
}

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00';
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
