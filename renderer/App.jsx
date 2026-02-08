import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { SetupWizard } from './components/SetupWizard';
import { PlaylistCard } from './components/PlaylistCard';
import { StatCard } from './components/StatCard';
import { TrackTable } from './components/TrackTable';
import { Toast, ToastContainer } from './components/ui/Toast';
import { FolderOpen, ListMusic, Music2, Waves } from 'lucide-react';

const DESKTOP_BRIDGE_ERROR = 'Desktop bridge unavailable. Relaunch from Electron (not browser-only mode).';
const TRACK_COLUMN_ORDER = ['play', 'id', 'title', 'bpm', 'key', 'waveformPreview', 'genre', 'durationSeconds', 'artist', 'playlists'];
const TRACK_COLUMN_WIDTHS = {
  play: 90,
  id: 110,
  title: 380,
  bpm: 84,
  key: 80,
  waveformPreview: 160,
  genre: 130,
  durationSeconds: 96,
  artist: 220,
  playlists: 84
};
const PAGE_SIZE_OPTIONS = [50, 100, 250, 500];
const TABLE_VIEWPORT_HEIGHT = 620;
const VIRTUAL_OVERSCAN_ROWS = 8;
const AUDIO_DEBUG_STORAGE_KEY = 'rbfa.debug.audio';
const TRACK_COLUMN_LABELS = {
  play: 'Play',
  id: 'ID',
  title: 'Title',
  bpm: 'BPM',
  key: 'Key',
  waveformPreview: 'Waveform',
  genre: 'Genre',
  durationSeconds: 'Duration',
  artist: 'Artist',
  playlists: 'Playlists'
};
const DEFAULT_VISIBLE_TRACK_COLUMNS = {
  play: true,
  id: false,
  title: true,
  bpm: true,
  key: true,
  waveformPreview: true,
  genre: true,
  durationSeconds: true,
  artist: true,
  playlists: false
};

function getBridgeApi() {
  return window.rbfa || window.electron?.rbfa || null;
}

function isAudioDebugEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.RBFA_DEBUG_AUDIO === true) {
    return true;
  }

  const stored = window.localStorage?.getItem(AUDIO_DEBUG_STORAGE_KEY);
  return stored === '1' || stored === 'true';
}

function useParseProgress() {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.onParseProgress) {
      return undefined;
    }

    const dispose = bridgeApi.onParseProgress((value) => {
      setProgress(value);
    });

    return () => dispose();
  }, []);

  return [progress, setProgress];
}

function parseErrorPayload(error) {
  const fallback = {
    message: error?.message || String(error),
    issues: []
  };

  if (!error?.message) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message);
    return {
      message: parsed?.message || fallback.message,
      issues: Array.isArray(parsed?.issues) ? parsed.issues : []
    };
  } catch {
    return fallback;
  }
}

function formatDuration(seconds) {
  const numericValue = Number(seconds);
  if (!Number.isFinite(numericValue)) {
    return '-';
  }

  const totalSeconds = Math.max(0, Math.round(numericValue));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatBinPreview(bins, maxItems = 20) {
  if (!Array.isArray(bins) || bins.length === 0) {
    return '-';
  }

  return bins
    .slice(0, maxItems)
    .map((value) => Number(value).toFixed(1))
    .join(', ');
}

function getBuildTag() {
  const bridge = getBridgeApi();
  return bridge?.buildInfo?.buildTag || '';
}

function normalizeAudioLocation(rawLocation, options = {}) {
  if (!rawLocation) {
    if (options.debug) {
      console.log('[rbfa] normalizeAudioLocation: empty input');
    }
    return '';
  }

  const bridge = getBridgeApi();
  const platform = bridge?.platform || '';
  const isWsl = Boolean(bridge?.isWsl);

  if (options.debug) {
    console.log('[rbfa] normalizeAudioLocation START', {
      rawLocation,
      platform,
      isWsl
    });
  }

  let cleaned = String(rawLocation)
    .replace(/^file:\/\/localhost\//i, '/')
    .replace(/^file:\/\//i, '')
    .replace(/^localhost\//i, '/')
    .replace(/\\/g, '/')
    .trim();

  if (options.debug) {
    console.log('[rbfa] After initial cleaning', { cleaned });
  }

  if (/^\/[A-Za-z]:\//.test(cleaned)) {
    cleaned = cleaned.slice(1);
    if (options.debug) {
      console.log('[rbfa] Removed leading slash before drive letter', { cleaned });
    }
  }

  // Map Windows drive paths to WSL mounts when running on Linux/WSL.
  if (/^[A-Za-z]:\//.test(cleaned) && (platform === 'linux' || isWsl)) {
    const driveLetter = cleaned[0].toLowerCase();
    const rest = cleaned.slice(2); // keep leading /
    cleaned = `/mnt/${driveLetter}${rest}`;
    if (options.debug) {
      console.log('[rbfa] Mapped to WSL mount path', { cleaned, driveLetter });
    }
  }

  try {
    const decoded = decodeURIComponent(cleaned);
    if (options.debug && decoded !== cleaned) {
      console.log('[rbfa] URI decoded', { before: cleaned, after: decoded });
    }
    cleaned = decoded;
  } catch {
    // Keep raw value if it is not valid URI encoding.
    if (options.debug) {
      console.log('[rbfa] URI decode failed, keeping raw value');
    }
  }

  if (!cleaned) {
    if (options.debug) {
      console.log('[rbfa] normalizeAudioLocation: empty after processing');
    }
    return '';
  }

  const encoded = encodeURI(cleaned)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F');

  let fileUrl = '';
  if (/^[A-Za-z]:\//.test(cleaned)) {
    fileUrl = `file:///${encoded}`;
  } else if (cleaned.startsWith('/')) {
    fileUrl = `file://${encoded}`;
  } else {
    const hasScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(encoded);
    if (!hasScheme) {
      if (/^[A-Za-z]:\//.test(encoded)) {
        fileUrl = `file:///${encoded}`;
      } else if (encoded.startsWith('/')) {
        fileUrl = `file://${encoded}`;
      } else {
        fileUrl = encoded;
      }
    } else {
      fileUrl = encoded;
    }
  }

  if (options.debug) {
    console.log('[rbfa] normalizeAudioLocation RESULT', {
      fsPath: cleaned,
      fileUrl
    });
  }

  return fileUrl;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function waitForEvent(target, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timeout);
      target.removeEventListener(eventName, onEvent);
    };

    target.addEventListener(eventName, onEvent, { once: true });
  });
}

function formatClock(seconds) {
  const numericValue = Number(seconds);
  if (!Number.isFinite(numericValue)) {
    return '--:--';
  }
  const totalSeconds = Math.max(0, Math.floor(numericValue));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getTrackId(track) {
  if (!track) {
    return '';
  }
  const rawId = track.id ?? track.trackId ?? track.TrackID ?? track.ID;
  return rawId !== undefined && rawId !== null ? String(rawId) : '';
}

function WaveformPreview({ waveform, onSeek, seekLabel = 'Seek waveform', progress = null }) {
  const bins = Array.isArray(waveform?.bins) ? waveform.bins : [];
  if (!bins.length) {
    return <p style={{ marginTop: '6px' }}>No waveform bins available.</p>;
  }

  const binColors = Array.isArray(waveform?.binColors) ? waveform.binColors : [];
  const fallbackColor = waveform?.avgColor || { red: 0, green: 170, blue: 255 };
  const maxHeight = 31;

  const handleSeek = (event) => {
    if (!onSeek || typeof onSeek !== 'function') {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    onSeek(ratio);
  };

  const progressPercent = Number.isFinite(progress) ? clamp(progress, 0, 1) * 100 : null;

  return (
    <div
      className="waveform-preview"
      role={onSeek ? 'button' : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? handleSeek : undefined}
      onKeyDown={
        onSeek
          ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleSeek(event);
            }
          }
          : undefined
      }
      title={onSeek ? seekLabel : undefined}
    >
      {bins.map((rawHeight, index) => {
        const height = Math.max(0, Math.min(maxHeight, Number(rawHeight) || 0));
        const normalized = height / maxHeight;
        const color = binColors[index] || fallbackColor;
        const red = Math.max(0, Math.min(255, Number(color.red) || 0));
        const green = Math.max(0, Math.min(255, Number(color.green) || 0));
        const blue = Math.max(0, Math.min(255, Number(color.blue) || 0));

        return (
          <div
            key={`wave-bin-${index}`}
            className="waveform-bin"
            title={`Bin ${index + 1}: h=${height.toFixed(2)} rgb(${red}, ${green}, ${blue})`}
            style={{
              height: `${Math.max(4, normalized * 100)}%`,
              backgroundColor: `rgb(${red}, ${green}, ${blue})`
            }}
            />
          );
        })}
      {progressPercent !== null ? (
        <div className="waveform-playhead" style={{ left: `${progressPercent}%` }} />
      ) : null}
    </div>
  );
}

function MiniWaveform({ waveform, progress = 0, isActive = false, onSeek }) {
  const bins = Array.isArray(waveform?.bins) ? waveform.bins : [];
  if (!bins.length) {
    return <span className="mini-waveform-empty">-</span>;
  }

  const binColors = Array.isArray(waveform?.binColors) ? waveform.binColors : [];
  const fallbackColor = waveform?.avgColor || { red: 0, green: 170, blue: 255 };
  const maxHeight = 31;
  const step = Math.max(1, Math.ceil(bins.length / 36));
  const compactBins = [];
  for (let index = 0; index < bins.length; index += step) {
    compactBins.push({
      height: bins[index],
      color: binColors[index] || fallbackColor
    });
  }

  const progressPercent = clamp(progress, 0, 1) * 100;

  return (
    <div className="mini-waveform" onClick={onSeek} role="button" tabIndex={0}>
      {compactBins.map((item, index) => {
        const height = Math.max(0, Math.min(maxHeight, Number(item.height) || 0));
        const normalized = height / maxHeight;
        const red = Math.max(0, Math.min(255, Number(item.color.red) || 0));
        const green = Math.max(0, Math.min(255, Number(item.color.green) || 0));
        const blue = Math.max(0, Math.min(255, Number(item.color.blue) || 0));
        return (
          <div
            key={`mini-bin-${index}`}
            className="mini-waveform-bin"
            style={{
              height: `${Math.max(2, normalized * 100)}%`,
              backgroundColor: `rgb(${red}, ${green}, ${blue})`
            }}
          />
        );
      })}
      {isActive ? (
        <div className="mini-waveform-playhead" style={{ left: `${progressPercent}%` }} />
      ) : null}
    </div>
  );
}

function normalizeVisibleTrackColumns(value) {
  const next = { ...DEFAULT_VISIBLE_TRACK_COLUMNS };
  if (!value || typeof value !== 'object') {
    return next;
  }

  for (const key of TRACK_COLUMN_ORDER) {
    if (typeof value[key] === 'boolean') {
      next[key] = value[key];
    }
  }

  return next;
}

function ClusterDetails({
  cluster,
  trackIndexById,
  onSelectTrack,
  onTogglePlay,
  onSeek,
  getPlaybackState,
  clusterKey,
  onStartSample,
  onStopSample,
  onSkipSample,
  onResumeSample,
  samplingState,
  sampleSize,
  onSampleSizeChange,
  disablePlay
}) {
  const [focusedWaveformId, setFocusedWaveformId] = useState(null);
  const trackRows = cluster.trackIds.map((trackId) => {
    const track = trackIndexById.get(String(trackId));
    if (!track) {
      return {
        id: String(trackId),
        track: null,
        artist: '',
        title: '',
        bpm: null,
        key: '',
        waveform: null,
        durationSeconds: null
      };
    }

    return {
      id: String(track.id),
      track,
      artist: track.artist || '',
      title: track.title || '',
      bpm: track.bpm,
      key: track.key || '',
      waveform: track.anlzWaveform,
      durationSeconds: track.durationSeconds
    };
  });
  const playingRow = trackRows.find((row) => getPlaybackState?.(row.id).status === 'playing');
  const focusedRow = useMemo(() => {
    const explicit = trackRows.find((row) => row.id === focusedWaveformId);
    if (explicit) {
      return explicit;
    }
    if (playingRow) {
      return playingRow;
    }
    return trackRows.find((row) => row.waveform) || trackRows[0] || null;
  }, [focusedWaveformId, playingRow, trackRows]);

  return (
    <div>
      <div className="meta" style={{ marginBottom: '8px' }}>
        <span>Tracks: {cluster.size}</span>
        <span>Avg Score: {cluster.avgScore.toFixed(3)}</span>
        <span>Confidence: {(cluster.confidence ?? 0).toFixed(3)}</span>
        <span>Ordered: {cluster.ordered ? 'Yes' : 'No'}</span>
        <span>
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
        <span>
          Cooldown
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={(samplingCooldownMsRef.current || 0) / 1000}
            onChange={(event) => {
              const seconds = Number(event.target.value);
              if (!Number.isFinite(seconds)) {
                return;
              }
              samplingCooldownMsRef.current = Math.max(0, Math.min(2, seconds)) * 1000;
            }}
            style={{ width: '70px', marginLeft: '6px' }}
          />
        </span>
        <span>
          <button
            type="button"
            className="secondary"
            onClick={() => onStartSample?.(cluster, clusterKey)}
            disabled={!cluster.trackIds.length || samplingState?.active}
          >
            {samplingState?.active ? 'Sampling…' : 'Sample Playlist'}
          </button>
        </span>
        <span>
          <button
            type="button"
            className="secondary"
            onClick={() => onStopSample?.()}
            disabled={!samplingState?.active}
          >
            Stop Sample
          </button>
        </span>
        <span>
          <button
            type="button"
            className="secondary"
            onClick={() => onSkipSample?.()}
            disabled={!samplingState?.active}
          >
            Skip
          </button>
        </span>
        <span>
          <button
            type="button"
            className="secondary"
            onClick={() => onResumeSample?.()}
            disabled={!samplingState?.active || !samplingPausedRef.current}
          >
            Resume
          </button>
        </span>
        {samplingState?.active ? (
          <span className={`sampling-badge${samplingPausedRef.current ? ' paused' : ''}`}>
            {samplingPausedRef.current ? 'Paused' : 'Sampling'}
          </span>
        ) : null}
        {!samplingState?.active && samplingFinished ? (
          <span className="sampling-badge finished">Finished</span>
        ) : null}
        {samplingState?.active ? (
          <span className="sampling-track-label">{getSamplingTrackLabel()}</span>
        ) : null}
        {samplingState?.active ? (
          <span>
            {samplingState.currentIndex + 1}/{samplingState.total}
          </span>
        ) : null}
        {samplingState?.active ? (
          <span>
            Next in {samplingCountdown ?? '--'}s
          </span>
        ) : null}
        {samplingState?.active ? (
          <span>
            Elapsed {formatClock(samplingElapsed)}
          </span>
        ) : null}
      </div>
      {samplingState?.active ? (
        <div className="sampling-progress" aria-label="Sampling progress">
          <div
            className="sampling-progress-bar"
            style={{
              width: `${samplingState.total > 0
                ? Math.min(100, Math.max(0, ((samplingState.currentIndex + 1) / samplingState.total) * 100))
                : 0}%`
            }}
          />
        </div>
      ) : null}
      {focusedRow ? (
        <div className="cluster-waveform">
          <div className="meta" style={{ marginBottom: '6px' }}>
            <span>Waveform Preview</span>
            <span>{focusedRow.artist || '-'} — {focusedRow.title || focusedRow.id}</span>
          </div>
          <WaveformPreview waveform={focusedRow.waveform} />
        </div>
      ) : null}
      <table className="track-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Play</th>
            <th>Waveform</th>
            <th>Artist</th>
            <th>Title</th>
            <th>BPM</th>
            <th>Key</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {trackRows.map((row, index) => (
            <tr
              key={row.id}
              className={row.id === focusedRow?.id ? 'selected-row' : ''}
              onClick={() => setFocusedWaveformId(row.id)}
            >
              <td>{index + 1}</td>
              <td>
                <div className="playback-cell">
                    <button
                      type="button"
                      className="playback-button"
                      onClick={() => row.track && onTogglePlay?.(row.track)}
                      disabled={disablePlay || !row.track || getPlaybackState?.(row.id).loading}
                    >
                    {getPlaybackState?.(row.id).loading
                      ? 'Loading'
                      : getPlaybackState?.(row.id).status === 'playing'
                        ? 'Pause'
                        : 'Play'}
                  </button>
                  <span className="playback-time">
                    {formatClock(getPlaybackState?.(row.id).currentTime)}
                  </span>
                </div>
                {getPlaybackState?.(row.id).status === 'error' ? (
                  <div className="playback-error">{getPlaybackState?.(row.id).error}</div>
                ) : null}
              </td>
              <td>
                <MiniWaveform
                  waveform={row.waveform}
                  progress={getPlaybackState?.(row.id).duration
                    ? getPlaybackState?.(row.id).currentTime / getPlaybackState?.(row.id).duration
                    : 0}
                  isActive={getPlaybackState?.(row.id).status === 'playing'
                    || getPlaybackState?.(row.id).status === 'paused'}
                  onSeek={(event) => row.track && onSeek?.(row.track, event)}
                />
                {getPlaybackState?.(row.id).status === 'error' ? (
                  <div className="playback-error">{getPlaybackState?.(row.id).error}</div>
                ) : null}
              </td>
              <td>{row.artist || '-'}</td>
              <td>{row.title || '-'}</td>
              <td>{row.bpm ?? '-'}</td>
              <td>{row.key || '-'}</td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setFocusedWaveformId(row.id);
                    onSelectTrack?.(row.id);
                  }}
                >
                  Focus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function App() {
  const [xmlPath, setXmlPath] = useState('');
  const [anlzMapPath, setAnlzMapPath] = useState('');
  const [folders, setFolders] = useState([]);
  const [folderTree, setFolderTree] = useState(null);
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [tracks, setTracks] = useState([]);
  const [trackPlaylistIndex, setTrackPlaylistIndex] = useState({});
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [trackQuery, setTrackQuery] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleTrackColumns, setVisibleTrackColumns] = useState(DEFAULT_VISIBLE_TRACK_COLUMNS);
  const [tableDensity, setTableDensity] = useState('cozy');
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [recentImports, setRecentImports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [anlzAttachSummary, setAnlzAttachSummary] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [analysisMaxPairs, setAnalysisMaxPairs] = useState(5000);
  const [analysisPairCap, setAnalysisPairCap] = useState(100000);
  const [analysisYieldEvery, setAnalysisYieldEvery] = useState(5000);
  const [similarResults, setSimilarResults] = useState(null);
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [similarMinScore, setSimilarMinScore] = useState(0.6);
  const [similarLimit, setSimilarLimit] = useState(12);
  const [playlistSuggestions, setPlaylistSuggestions] = useState(null);
  const [sampleSize, setSampleSize] = useState(12);
  const [samplingState, setSamplingState] = useState({
    active: false,
    clusterKey: null,
    trackIds: [],
    currentIndex: 0,
    total: 0
  });
  const samplingStateRef = useRef(samplingState);
  const samplingTimerRef = useRef(null);
  const samplingSessionRef = useRef(0);
  const samplingAdvanceRef = useRef({ trackId: null, index: null });
  const samplingEndAtRef = useRef(null);
  const samplingIntervalRef = useRef(null);
  const [samplingCountdown, setSamplingCountdown] = useState(null);
  const samplingPausedRef = useRef(false);
  const samplingCooldownMsRef = useRef(1200);
  const [samplingFinished, setSamplingFinished] = useState(false);
  const samplingStartedAtRef = useRef(null);
  const [samplingElapsed, setSamplingElapsed] = useState(0);
  const [samplingToast, setSamplingToast] = useState(null);
  const isSamplingActive = samplingState.active;
  const [clusterDecisions, setClusterDecisions] = useState({});
  const [playlistDecisionsByContext, setPlaylistDecisionsByContext] = useState({});
  const [decisionContextKey, setDecisionContextKey] = useState('');
  const [expandedClusterKey, setExpandedClusterKey] = useState(null);
  const [isClustering, setIsClustering] = useState(false);
  const [clusterThreshold, setClusterThreshold] = useState(0.82);
  const [clusterMinSize, setClusterMinSize] = useState(3);
  const [clusterMaxPairs, setClusterMaxPairs] = useState(15000);
  const [clusterStrictMode, setClusterStrictMode] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [usbAnlzPath, setUsbAnlzPath] = useState('');
  const [anlzBuildSummary, setAnlzBuildSummary] = useState(null);
  const [anlzBuildProgress, setAnlzBuildProgress] = useState(null);
  const [isBuildingAnlzMap, setIsBuildingAnlzMap] = useState(false);
  const [issueSeverityFilter, setIssueSeverityFilter] = useState('all');
  const [showValidationIssues, setShowValidationIssues] = useState(false);
  const [showTrackMeta, setShowTrackMeta] = useState(false);
  const [showTrackLocation, setShowTrackLocation] = useState(false);
  const [showTrackAnlzMeta, setShowTrackAnlzMeta] = useState(false);
  const [showTrackPlaylists, setShowTrackPlaylists] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useParseProgress();
  const trackFilterInputRef = useRef(null);
  const tableViewportRef = useRef(null);
  const sharedAudioRef = useRef(null);
  const sharedAudioTrackIdRef = useRef(null);
  const [playbackStates, setPlaybackStates] = useState({});
  const playbackStateRef = useRef({});
  const lastPlaybackUiUpdateRef = useRef({});
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [playbackVolume, setPlaybackVolume] = useState(0.5);
  const playbackVolumeRef = useRef(0.5);
  const [audioStatus, setAudioStatus] = useState({ level: 'idle', message: '' });
  const audioDebugEnabled = useMemo(() => isAudioDebugEnabled(), []);
  const playRequestIdRef = useRef(0);
  const lastPlayAttemptRef = useRef({ trackId: null, at: 0 });

  const logAudio = (...args) => {
    if (audioDebugEnabled) {
      console.log(...args);
    }
  };

  const warnAudio = (...args) => {
    if (audioDebugEnabled) {
      console.warn(...args);
    }
  };

  const applyVolumeToAll = (value) => {
    if (sharedAudioRef.current) {
      sharedAudioRef.current.volume = value;
      sharedAudioRef.current.muted = false;
    }
  };

  const handleVolumeChange = (value) => {
    const next = clamp(Number(value), 0, 1);
    playbackVolumeRef.current = next;
    setPlaybackVolume(next);
    applyVolumeToAll(next);
  };

  const playTestTone = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        warnAudio('[rbfa] Web Audio API not available');
        setAudioStatus({ level: 'blocked', message: 'Web Audio unavailable' });
        return;
      }
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 440;
      gain.gain.value = Math.max(0.05, Math.min(1, playbackVolumeRef.current));
      oscillator.connect(gain);
      gain.connect(context.destination);

      const startTone = () => {
        oscillator.start();
        oscillator.stop(context.currentTime + 0.25);
        oscillator.onended = () => {
          context.close();
        };
        logAudio('[rbfa] test tone played', { volume: playbackVolume });
        setAudioStatus({ level: 'playing', message: 'Test tone played' });
      };

      if (context.state === 'suspended') {
        context.resume().then(startTone).catch((error) => {
          console.error('[rbfa] test tone resume failed', { error });
          setAudioStatus({ level: 'blocked', message: 'Audio context blocked' });
        });
      } else {
        startTone();
      }
    } catch (error) {
      console.error('[rbfa] test tone failed', { error });
      setAudioStatus({ level: 'error', message: 'Test tone failed' });
    }
  };

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = playbackVolumeRef.current;
    audio.muted = false;
    sharedAudioRef.current = audio;

    let lastTimeUpdate = 0;
    const onLoadedMeta = () => {
      const trackId = sharedAudioTrackIdRef.current;
      if (!trackId) {
        return;
      }
      updatePlaybackState(trackId, {
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        loading: false,
        error: ''
      });
    };

    const onTimeUpdate = () => {
      const trackId = sharedAudioTrackIdRef.current;
      if (!trackId) {
        return;
      }
      const now = performance.now();
      if (now - lastTimeUpdate < 200) {
        return;
      }
      lastTimeUpdate = now;
      updatePlaybackState(trackId, {
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : getPlaybackState(trackId).duration
      });
    };

    const onPlay = () => {
      const trackId = sharedAudioTrackIdRef.current;
      if (!trackId) {
        return;
      }
      updatePlaybackState(trackId, {
        status: 'playing',
        loading: false,
        error: ''
      });
      setActiveTrackId(trackId);
      setAudioStatus({ level: 'playing', message: 'Playing' });
    };

    const onPause = () => {
      const trackId = sharedAudioTrackIdRef.current;
      if (!trackId) {
        return;
      }
      updatePlaybackState(trackId, {
        status: 'paused'
      });
      setAudioStatus({ level: 'paused', message: 'Paused' });
    };

    const onEnded = () => {
      const trackId = sharedAudioTrackIdRef.current;
      if (!trackId) {
        return;
      }
      updatePlaybackState(trackId, {
        status: 'idle',
        currentTime: 0
      });
      setAudioStatus({ level: 'idle', message: 'Ended' });
      handleSamplingEnded(trackId);
    };

    const onError = () => {
      const trackId = sharedAudioTrackIdRef.current;
      if (!trackId) {
        return;
      }
      const mediaError = audio.error;
      const errorCode = mediaError?.code;
      let errorMsg = 'Audio unavailable or failed to load';
      if (errorCode === 1) {
        errorMsg = 'Audio loading aborted';
      } else if (errorCode === 2) {
        errorMsg = 'Network error loading audio';
      } else if (errorCode === 3) {
        errorMsg = 'Audio format not supported or file corrupted';
      } else if (errorCode === 4) {
        errorMsg = 'Audio source not found or not accessible';
      } else if (errorCode) {
        errorMsg = `${errorMsg} (code ${errorCode})`;
      }
      updatePlaybackState(trackId, {
        status: 'error',
        loading: false,
        error: errorMsg
      });
      setAudioStatus({ level: 'error', message: 'Playback failed' });
      console.error('[rbfa] audio error', {
        trackId,
        src: audio.src,
        error: errorMsg
      });
    };

    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.loadState) {
      return;
    }

    bridgeApi.loadState().then((state) => {
      if (state?.lastLibraryPath) {
        setXmlPath(state.lastLibraryPath);
      }

      if (typeof state?.anlzMapPath === 'string') {
        setAnlzMapPath(state.anlzMapPath);
      }

      if (typeof state?.usbAnlzPath === 'string') {
        setUsbAnlzPath(state.usbAnlzPath);
      }

      if (Array.isArray(state?.selectedFolders)) {
        setSelectedFolders(state.selectedFolders);
      }

      if (state?.playlistDecisionsByContext && typeof state.playlistDecisionsByContext === 'object') {
        setPlaylistDecisionsByContext(state.playlistDecisionsByContext);
      } else if (state?.playlistDecisions && typeof state.playlistDecisions === 'object') {
        setPlaylistDecisionsByContext({ legacy: state.playlistDecisions });
      }

      if (typeof state?.tableSortBy === 'string') {
        setSortBy(state.tableSortBy);
      }

      if (state?.tableSortDirection === 'asc' || state?.tableSortDirection === 'desc') {
        setSortDirection(state.tableSortDirection);
      }

      const normalizedColumns = normalizeVisibleTrackColumns(state?.visibleTrackColumns);
      const looksLegacy =
        normalizedColumns.id &&
        normalizedColumns.playlists &&
        !normalizedColumns.waveformPreview;
      setVisibleTrackColumns(looksLegacy ? DEFAULT_VISIBLE_TRACK_COLUMNS : normalizedColumns);

      if (state?.tableDensity === 'compact' || state?.tableDensity === 'cozy') {
        setTableDensity(state.tableDensity);
      }

      const parsedPageSize = Number(state?.tablePageSize);
      if (PAGE_SIZE_OPTIONS.includes(parsedPageSize)) {
        setPageSize(parsedPageSize);
      }
    }).catch(() => {
      // best-effort state load
    });

    bridgeApi.getRecentImports().then((rows) => {
      setRecentImports(Array.isArray(rows) ? rows : []);
    }).catch(() => {
      // best-effort import history load
    });
  }, []);

  useEffect(() => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.onAnlzProgress) {
      return undefined;
    }

    const dispose = bridgeApi.onAnlzProgress((progress) => {
      setAnlzBuildProgress(progress || null);
    });

    return () => dispose();
  }, []);

  useEffect(() => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.onAnalysisProgress) {
      return undefined;
    }

    const dispose = bridgeApi.onAnalysisProgress((progress) => {
      setAnalysisProgress(progress || null);
    });

    return () => dispose();
  }, []);

  const selectedSet = useMemo(() => new Set(selectedFolders), [selectedFolders]);

  const toggleFolder = (folderPath) => {
    setSelectedFolders((current) => {
      if (current.includes(folderPath)) {
        return current.filter((value) => value !== folderPath);
      }

      return [...current, folderPath];
    });
  };

  const toggleExpanded = (folderPath) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const pickFile = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.pickXmlFile) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    const picked = await bridgeApi.pickXmlFile();
    if (picked) {
      setXmlPath(picked);
      setError('');
    }
  };

  const handleWizardFileSelect = (payload) => {
    if (!payload) {
      return;
    }

    if (typeof payload === 'string') {
      setXmlPath(payload);
      setError('');
      return;
    }

    if (payload?.xmlPath) {
      applyRecentImport(payload);
      return;
    }

    if (payload?.path) {
      setXmlPath(payload.path);
      setError('');
      return;
    }

    if (payload?.name) {
      setError('Selected file, but no path available. Use Browse XML to pick the file.');
    }
  };

  const pickUsbAnlzFolder = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.pickFolder) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    const picked = await bridgeApi.pickFolder();
    if (picked) {
      setUsbAnlzPath(picked);
      setError('');
    }
  };

  const applyRecentImport = (row) => {
    setXmlPath(row.xmlPath || '');
    setSelectedFolders(Array.isArray(row.selectedFolders) ? row.selectedFolders : []);
    setError('Loaded import settings from history. Click Parse Library to reload.');
  };

  const buildAnlzMap = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.buildAnlzMapping) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    if (!usbAnlzPath.trim()) {
      setError('Choose the Rekordbox USBANLZ folder first.');
      return;
    }

    if (!tracks.length) {
      setError('Parse your library first so we know which tracks to map.');
      return;
    }

    setIsBuildingAnlzMap(true);
    setError('');
    setAnlzBuildSummary(null);
    setAnlzBuildProgress({ stage: 'parse-ext', scanned: 0, total: 0 });

    try {
      const result = await bridgeApi.buildAnlzMapping(tracks, usbAnlzPath.trim(), anlzMapPath.trim());
      if (result?.outPath) {
        setAnlzMapPath(result.outPath);
      }
      if (result?.stats) {
        setAnlzBuildSummary(result.stats);
      }

      await bridgeApi.saveState({
        usbAnlzPath: usbAnlzPath.trim(),
        anlzMapPath: result?.outPath || anlzMapPath.trim()
      });
    } catch (buildError) {
      const message = buildError?.message || String(buildError);
      if (message.toLowerCase().includes('canceled')) {
        setError('ANLZ mapping canceled.');
      } else {
        setError(message);
      }
    } finally {
      setIsBuildingAnlzMap(false);
      setAnlzBuildProgress(null);
    }
  };

  const cancelAnlzMapBuild = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.cancelAnlzMapping) {
      return;
    }
    await bridgeApi.cancelAnlzMapping();
    setAnlzBuildProgress(null);
    setIsBuildingAnlzMap(false);
  };

  const parse = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.parseLibrary) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    if (!xmlPath.trim()) {
      setError('Choose an XML export first.');
      setValidationIssues([]);
      return;
    }

    setIsParsing(true);
    setError('');
    setValidationIssues([]);
    setAnlzAttachSummary(null);
    setProgress(0);

    try {
      const result = await bridgeApi.parseLibrary(xmlPath.trim(), selectedFolders, {
        anlzMapPath: anlzMapPath.trim(),
        anlzMaxTracks: 5000
      });
      setFolders(result.folders || []);
      setFolderTree(result.folderTree || null);
      if (result.folderTree?.children?.length) {
        const defaultExpanded = new Set(result.folderTree.children.map((node) => node.path));
        setExpandedFolders(defaultExpanded);
      }
      setTracks(result.filteredTracks || []);
      setTrackPlaylistIndex(result.trackPlaylistIndex || {});
      const firstTrackId = result.filteredTracks?.[0]?.id || null;
      setSelectedTrackId(firstTrackId);
      setSummary(result.summary || null);
      setAnlzAttachSummary(result.anlzAttach || null);
      setValidationIssues(Array.isArray(result.validation?.issues) ? result.validation.issues : []);
      setAnalysisResult(null);
      setPlaylistSuggestions(null);
      setExpandedClusterKey(null);

      if (result.anlzAttachError) {
        setError(`Parsed XML, but ANLZ attach failed: ${result.anlzAttachError}`);
      }

      await bridgeApi.saveState({
        lastLibraryPath: xmlPath.trim(),
        selectedFolders,
        anlzMapPath: anlzMapPath.trim(),
        usbAnlzPath: usbAnlzPath.trim()
      });
      const rows = await bridgeApi.getRecentImports();
      setRecentImports(Array.isArray(rows) ? rows : []);
    } catch (parseError) {
      const parsedError = parseErrorPayload(parseError);
      setError(parsedError.message);
      setValidationIssues(parsedError.issues);
    } finally {
      setIsParsing(false);
    }
  };

  const runAnalysis = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.runBaselineAnalysis) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    if (tracks.length < 2) {
      setError('Need at least 2 tracks to run baseline analysis.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setAnalysisProgress(null);
    try {
      const result = await bridgeApi.runBaselineAnalysis(tracks, xmlPath.trim(), selectedFolders, {
        maxPairs: analysisMaxPairs,
        maxPairsCap: analysisPairCap,
        yieldEveryPairs: analysisYieldEvery
      });
      setAnalysisResult(result);
    } catch (analysisError) {
      setError(analysisError.message || String(analysisError));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const buildFolderGroups = () => {
    const groups = new Map();

    if (selectedFolders.length > 0) {
      for (const folder of selectedFolders) {
        groups.set(folder, new Set());
      }

      for (const track of tracks) {
        const playlistPaths = trackPlaylistIndex[track.id] || [];
        for (const folder of selectedFolders) {
          if (playlistPaths.some((path) => path === folder || path.startsWith(`${folder}/`))) {
            groups.get(folder)?.add(String(track.id));
          }
        }
      }
    } else {
      for (const track of tracks) {
        const playlistPaths = trackPlaylistIndex[track.id] || [];
        if (!playlistPaths.length) {
          const entry = groups.get('Unsorted') || new Set();
          entry.add(String(track.id));
          groups.set('Unsorted', entry);
          continue;
        }
        for (const playlistPath of playlistPaths) {
          const [root] = String(playlistPath).split('/').filter(Boolean);
          const key = root || 'Unsorted';
          const entry = groups.get(key) || new Set();
          entry.add(String(track.id));
          groups.set(key, entry);
        }
      }
    }

    return Array.from(groups.entries()).map(([name, trackIds]) => ({
      name,
      trackIds: Array.from(trackIds)
    }));
  };

  const buildDecisionContextKey = () => {
    const payload = {
      xmlPath: xmlPath.trim(),
      selectedFolders: [...selectedFolders].sort(),
      threshold: Number(clusterThreshold),
      minSize: Number(clusterMinSize),
      maxPairs: Number(clusterMaxPairs),
      strictMode: Boolean(clusterStrictMode),
      mode: playlistSuggestions?.mode || 'default'
    };
    return JSON.stringify(payload);
  };

  const runPlaylistClustering = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.generatePlaylists) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    if (tracks.length < 2) {
      setError('Need at least 2 tracks to generate playlist suggestions.');
      return;
    }

    setIsClustering(true);
    setError('');
    try {
      const folderGroups = buildFolderGroups();
      const result = await bridgeApi.generatePlaylists({
        tracks,
        sourceXmlPath: xmlPath.trim(),
        selectedFolders,
        similarityThreshold: Number(clusterThreshold),
        minClusterSize: Number(clusterMinSize),
        maxPairs: Number(clusterMaxPairs),
        strictMode: clusterStrictMode,
        folderGroups
      });
      setPlaylistSuggestions(result);
      const contextKey = buildDecisionContextKey();
      setDecisionContextKey(contextKey);
      setClusterDecisions(playlistDecisionsByContext[contextKey] || {});
    } catch (clusterError) {
      setError(clusterError.message || String(clusterError));
    } finally {
      setIsClustering(false);
    }
  };

  const runSimilarSearch = async () => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.findSimilarTracks) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    if (!selectedTrack) {
      setError('Select a track first.');
      return;
    }

    setIsFindingSimilar(true);
    setError('');
    try {
      const result = await bridgeApi.findSimilarTracks({
        targetId: getTrackId(selectedTrack),
        sourceXmlPath: xmlPath.trim(),
        selectedFolders,
        limit: Number(similarLimit),
        minScore: Number(similarMinScore)
      });
      setSimilarResults(result);
    } catch (searchError) {
      setError(searchError.message || String(searchError));
    } finally {
      setIsFindingSimilar(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented) {
        return;
      }

      const targetTag = String(event.target?.tagName || '').toLowerCase();
      const isTextInput = targetTag === 'input' || targetTag === 'textarea';

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        trackFilterInputRef.current?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!isParsing) {
          parse();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (!isParsing && !isAnalyzing && tracks.length >= 2) {
          runAnalysis();
        }
        return;
      }

      if (event.key === 'Escape' && isTextInput && trackQuery) {
        setTrackQuery('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnalyzing, isParsing, parse, runAnalysis, trackQuery, tracks.length]);

  const selectedTrack = useMemo(() => {
    return tracks.find((track) => track.id === selectedTrackId) || null;
  }, [tracks, selectedTrackId]);

  useEffect(() => {
    setSimilarResults(null);
  }, [selectedTrackId]);

  useEffect(() => {
    samplingStateRef.current = samplingState;
  }, [samplingState]);

  const visibleTracks = useMemo(() => {
    const query = trackQuery.trim().toLowerCase();
    if (!query) {
      return tracks;
    }

    return tracks.filter((track) => {
      const haystack = [
        track.trackId,
        track.artist,
        track.title,
        track.genre,
        track.key
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [tracks, trackQuery]);

  const updatePlaybackState = (trackId, patch) => {
    if (!trackId) {
      return;
    }
    const current = playbackStateRef.current[trackId] || {
      status: 'idle',
      currentTime: 0,
      duration: 0,
      loading: false,
      error: ''
    };
    const next = { ...current, ...patch };
    playbackStateRef.current = { ...playbackStateRef.current, [trackId]: next };

    if (
      patch?.status === 'error'
      && samplingStateRef.current.active
      && String(trackId) === String(samplingStateRef.current.trackIds?.[samplingStateRef.current.currentIndex])
    ) {
      samplingPausedRef.current = false;
      clearSamplingTimer();
      clearSamplingInterval();
      handleSamplingEnded(trackId);
    }

    const patchKeys = Object.keys(patch || {});
    const timeOnly = patchKeys.every((key) => key === 'currentTime' || key === 'duration');
    if (
      timeOnly
      && String(trackId) !== String(activeTrackId)
      && String(trackId) !== String(sharedAudioTrackIdRef.current)
    ) {
      return;
    }

    if (timeOnly) {
      const now = performance.now();
      const last = lastPlaybackUiUpdateRef.current[trackId] || 0;
      if (now - last < 500) {
        return;
      }
      lastPlaybackUiUpdateRef.current = {
        ...lastPlaybackUiUpdateRef.current,
        [trackId]: now
      };
    }

    setPlaybackStates((prev) => ({
      ...prev,
      [trackId]: next
    }));
  };

  const getPlaybackState = (trackId) => {
    return playbackStates[trackId] || { status: 'idle', currentTime: 0, duration: 0, loading: false, error: '' };
  };

  const stopPlayback = (trackId) => {
    if (!trackId) {
      return;
    }
    const audio = sharedAudioRef.current;
    if (audio && String(sharedAudioTrackIdRef.current) === String(trackId)) {
      audio.pause();
      audio.currentTime = 0;
    }
    updatePlaybackState(trackId, {
      status: 'idle',
      currentTime: 0,
      loading: false
    });
  };

  const stopAllPlayback = (keepTrackId = null) => {
    const audio = sharedAudioRef.current;
    if (!audio) {
      return;
    }
    const currentTrackId = sharedAudioTrackIdRef.current;
    if (keepTrackId && String(currentTrackId) === String(keepTrackId)) {
      return;
    }
    if (currentTrackId) {
      stopPlayback(currentTrackId);
    }
  };

  const disposeAudio = (trackId) => {
    if (!trackId) {
      return;
    }
    const audio = sharedAudioRef.current;
    if (audio && String(sharedAudioTrackIdRef.current) === String(trackId)) {
      audio.pause();
      audio.currentTime = 0;
      sharedAudioTrackIdRef.current = null;
    }
  };

  const clearSamplingTimer = () => {
    if (samplingTimerRef.current) {
      clearTimeout(samplingTimerRef.current);
      samplingTimerRef.current = null;
    }
  };

  const clearSamplingInterval = () => {
    if (samplingIntervalRef.current) {
      clearInterval(samplingIntervalRef.current);
      samplingIntervalRef.current = null;
    }
    samplingEndAtRef.current = null;
    setSamplingCountdown(null);
    setSamplingElapsed(0);
    samplingStartedAtRef.current = null;
  };

  const stopSampling = () => {
    clearSamplingTimer();
    clearSamplingInterval();
    samplingSessionRef.current += 1;
    samplingAdvanceRef.current = { trackId: null, index: null };
    samplingPausedRef.current = false;
    const active = samplingStateRef.current;
    const currentTrackId = active?.trackIds?.[active?.currentIndex];
    if (active?.active && currentTrackId) {
      disposeAudio(currentTrackId);
    }
    setSamplingState({
      active: false,
      clusterKey: null,
      trackIds: [],
      currentIndex: 0,
      total: 0
    });
    setSamplingFinished(true);
  };

  const skipSample = async () => {
    const state = samplingStateRef.current;
    if (!state.active) {
      return;
    }
    samplingPausedRef.current = false;
    const currentTrackId = state.trackIds[state.currentIndex];
    if (currentTrackId) {
      disposeAudio(currentTrackId);
    }
    clearSamplingTimer();
    clearSamplingInterval();
    await handleSamplingEnded(currentTrackId);
  };

  const resumeSampling = async () => {
    const state = samplingStateRef.current;
    if (!state.active || !samplingPausedRef.current) {
      return;
    }
    const currentTrackId = state.trackIds[state.currentIndex];
    const track = trackIndexById.get(String(currentTrackId));
    if (!track) {
      return;
    }
    samplingPausedRef.current = false;
    await playTrack(track, getPlaybackState(getTrackId(track)).currentTime || 0);
    scheduleSamplingAdvance(getTrackId(track));
  };

  const pickSampleStartSeconds = (track) => {
    const duration = Number(track?.durationSeconds)
      || Number(track?.anlzWaveform?.durationSeconds)
      || 0;
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    const introCut = Math.min(45, duration * 0.2);
    const outroCut = Math.min(45, duration * 0.2);
    const preferredStart = duration * 0.35;
    const preferredEnd = duration * 0.7;
    const minStart = Math.max(introCut, preferredStart);
    const maxStart = Math.min(duration - outroCut, preferredEnd);
    if (maxStart <= minStart) {
      const mid = duration * 0.5;
      return Math.max(introCut, Math.min(duration - outroCut, mid));
    }
    const start = minStart + (Math.random() * (maxStart - minStart));
    return Math.max(introCut, Math.min(duration - outroCut, start));
  };

  const handleSampleSizeChange = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setSampleSize(12);
      return;
    }
    setSampleSize(Math.max(10, Math.min(20, Math.floor(parsed))));
  };

  const getClusterDecision = (clusterKey) => {
    return clusterDecisions[clusterKey] || { status: 'pending', name: '' };
  };

  const getSamplingTrackLabel = () => {
    const state = samplingStateRef.current;
    if (!state.active || !state.trackIds?.length) {
      return '';
    }
    const trackId = state.trackIds[state.currentIndex];
    const track = trackIndexById.get(String(trackId));
    if (!track) {
      return '';
    }
    const artist = track.artist || track.Artist || 'Unknown';
    const title = track.title || track.Name || 'Unknown';
    return `${artist} — ${title}`;
  };

  const persistClusterDecisions = (nextDecisions) => {
    if (!decisionContextKey) {
      return;
    }
    const nextMap = {
      ...playlistDecisionsByContext,
      [decisionContextKey]: nextDecisions
    };
    setPlaylistDecisionsByContext(nextMap);
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.saveState) {
      return;
    }
    bridgeApi.saveState({ playlistDecisionsByContext: nextMap }).catch(() => {
      // best-effort decision save
    });
  };

  const updateClusterDecision = (clusterKey, patch) => {
    setClusterDecisions((current) => {
      const existing = current[clusterKey] || { status: 'pending', name: '' };
      const next = {
        ...current,
        [clusterKey]: {
          ...existing,
          ...patch
        }
      };
      persistClusterDecisions(next);
      return next;
    });
  };

  const scheduleSamplingAdvance = (trackId) => {
    clearSamplingTimer();
    if (samplingPausedRef.current) {
      return;
    }
    const seconds = 30 + Math.random() * 15;
    const now = Date.now();
    if (!samplingStartedAtRef.current) {
      samplingStartedAtRef.current = now;
    }
    samplingEndAtRef.current = now + (seconds * 1000);
    setSamplingCountdown(Math.ceil(seconds));
    clearSamplingInterval();
    samplingIntervalRef.current = setInterval(() => {
      if (!samplingEndAtRef.current) {
        return;
      }
      const remainingMs = samplingEndAtRef.current - Date.now();
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      setSamplingCountdown(remaining);
      if (samplingStartedAtRef.current) {
        const elapsedMs = Date.now() - samplingStartedAtRef.current;
        setSamplingElapsed(Math.max(0, Math.floor(elapsedMs / 1000)));
      }
      if (remaining <= 0) {
        clearSamplingInterval();
      }
    }, 1000);
    const sessionId = samplingSessionRef.current;
    samplingTimerRef.current = setTimeout(() => {
      if (sessionId !== samplingSessionRef.current) {
        return;
      }
      handleSamplingEnded(trackId);
    }, seconds * 1000);
  };

  const startSampling = async (cluster, clusterKey) => {
    const limit = Math.max(10, Math.min(20, Number(sampleSize) || 12));
    const candidates = cluster.trackIds
      .map((trackId) => String(trackId))
      .filter((trackId) => trackIndexById.has(trackId));
    if (!candidates.length) {
      return;
    }
    if (samplingStateRef.current.active) {
      stopSampling();
    }
    setSamplingFinished(false);
    samplingSessionRef.current += 1;
    samplingAdvanceRef.current = { trackId: null, index: null };
    const queue = candidates.slice(0, Math.min(limit, candidates.length));
    stopAllPlayback();
    setSamplingState({
      active: true,
      clusterKey,
      trackIds: queue,
      currentIndex: 0,
      total: queue.length
    });

    const firstTrack = trackIndexById.get(queue[0]);
    if (firstTrack) {
      await playTrack(firstTrack, pickSampleStartSeconds(firstTrack));
      scheduleSamplingAdvance(getTrackId(firstTrack));
    }
  };

  const handleSamplingEnded = async (trackId) => {
    clearSamplingTimer();
    const state = samplingStateRef.current;
    if (!state.active) {
      return;
    }
    samplingPausedRef.current = false;
    const expected = state.trackIds[state.currentIndex];
    if (String(trackId) !== String(expected)) {
      return;
    }
    const advanceKey = { trackId: String(trackId), index: state.currentIndex };
    if (
      samplingAdvanceRef.current.trackId === advanceKey.trackId
      && samplingAdvanceRef.current.index === advanceKey.index
    ) {
      return;
    }
    samplingAdvanceRef.current = advanceKey;
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.total) {
      disposeAudio(expected);
      setSamplingToast('Sampling finished.');
      stopSampling();
      return;
    }
    clearSamplingInterval();
    const nextTrackId = state.trackIds[nextIndex];
    const nextTrack = trackIndexById.get(String(nextTrackId));
    setSamplingState((current) => ({
      ...current,
      currentIndex: nextIndex
    }));
    if (nextTrack) {
      disposeAudio(expected);
      const cooldownMs = samplingCooldownMsRef.current || 0;
      if (cooldownMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, cooldownMs));
      }
      await playTrack(nextTrack, pickSampleStartSeconds(nextTrack));
      scheduleSamplingAdvance(getTrackId(nextTrack));
    }
  };

  const ensureAudio = (track, srcOverride = '') => {
    const trackId = getTrackId(track);
    if (!trackId) {
      warnAudio('[rbfa] ensureAudio missing track id', { track });
      return null;
    }
    const location = track?.location || track?.Location || track?.LOCATION || '';
    const src = srcOverride || normalizeAudioLocation(location);
    const audio = sharedAudioRef.current;
    if (!audio) {
      warnAudio('[rbfa] shared audio unavailable', { trackId });
      return null;
    }

    logAudio('[rbfa] ensureAudio(shared)', {
      trackId,
      rawLocation: location,
      normalizedSrc: src
    });

    if (!src) {
      warnAudio('[rbfa] empty audio src', { trackId, location });
    }

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }
    audio.volume = playbackVolumeRef.current;
    audio.muted = false;
    sharedAudioTrackIdRef.current = trackId;
    updatePlaybackState(trackId, { loading: true });
    return audio;
  };

  useEffect(() => {
    playbackVolumeRef.current = playbackVolume;
    if (playbackVolume === 0) {
      setAudioStatus({ level: 'muted', message: 'Muted (volume 0)' });
    }
  }, [playbackVolume]);

  const playTrack = async (track, seekSeconds = null) => {
    const requestId = playRequestIdRef.current + 1;
    playRequestIdRef.current = requestId;
    const trackId = getTrackId(track);
    const now = Date.now();
    if (lastPlayAttemptRef.current.trackId === trackId && (now - lastPlayAttemptRef.current.at) < 250) {
      return;
    }
    lastPlayAttemptRef.current = { trackId, at: now };

    const location = track?.location || track?.Location || track?.LOCATION;
    if (!trackId || !location) {
      updatePlaybackState(trackId || track?.id, { status: 'error', error: 'Missing audio path.' });
      setAudioStatus({ level: 'error', message: 'Missing audio path' });
      console.error('[rbfa] playTrack: missing location', { trackId: trackId || track?.id });
      return;
    }

    logAudio('[rbfa] playTrack START', {
      trackId,
      title: track.title,
      rawLocation: location,
      seekSeconds
    });

    stopAllPlayback(trackId);

    // Get normalized file URL and filesystem path
    const bridgeApi = getBridgeApi();
    setAudioStatus({ level: 'loading', message: 'Loading audio…' });
    let fileUrl = normalizeAudioLocation(location, { debug: audioDebugEnabled });

    // Verify file exists and is readable using bridge API
    let pathInfo = null;
    if (bridgeApi?.resolveAudioPath) {
      pathInfo = await bridgeApi.resolveAudioPath(location);
      if (requestId !== playRequestIdRef.current) {
        return;
      }
      logAudio('[rbfa] File verification result', pathInfo);

      if (pathInfo?.fileUrl) {
        fileUrl = pathInfo.fileUrl;
      }

      if (!pathInfo.exists) {
        let errorMsg = `File not found: ${pathInfo.fsPath || location}`;
        if (pathInfo.parentExists) {
          errorMsg += ' (Parent folder exists; filename or encoding may not match.)';
        }
        if (pathInfo.hadEncodedSegments) {
          errorMsg += ' (Path contains encoded characters; verify Rekordbox XML matches actual folder names.)';
        }
        updatePlaybackState(trackId, {
          status: 'error',
          loading: false,
          error: errorMsg
        });
        setAudioStatus({ level: 'error', message: 'File not found' });
        console.error('[rbfa] File does not exist', {
          trackId,
          rawLocation: location,
          fsPath: pathInfo.fsPath,
          fileUrl
        });
        return;
      }

      if (!pathInfo.readable) {
        const errorMsg = `Permission denied: ${pathInfo.fsPath}`;
        updatePlaybackState(trackId, {
          status: 'error',
          loading: false,
          error: errorMsg
        });
        setAudioStatus({ level: 'error', message: 'File not readable' });
        console.error('[rbfa] File not readable', {
          trackId,
          fsPath: pathInfo.fsPath,
          fileUrl
        });
        return;
      }

      logAudio('[rbfa] File verification passed', {
        trackId,
        fsPath: pathInfo.fsPath,
        exists: pathInfo.exists,
        readable: pathInfo.readable
      });
    } else {
      warnAudio('[rbfa] Bridge API not available for file verification');
    }

    logAudio('[rbfa] Setting audio src', { trackId, fileUrl });
    const audio = ensureAudio(track, fileUrl);
    if (!audio) {
      updatePlaybackState(trackId, { status: 'error', error: 'Audio setup failed.' });
      setAudioStatus({ level: 'error', message: 'Audio setup failed' });
      return;
    }
    audio.muted = false;
    audio.volume = playbackVolumeRef.current;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(track.durationSeconds) || 0;

    if (seekSeconds !== null && Number.isFinite(seekSeconds)) {
      const target = clamp(seekSeconds, 0, duration || seekSeconds);
      audio.currentTime = target;
      updatePlaybackState(trackId, { currentTime: target });
      logAudio('[rbfa] Seeking to', { trackId, target });
    }

    updatePlaybackState(trackId, { loading: audio.readyState < 1, error: '' });
    if (audio.readyState < 1) {
      try {
        await waitForEvent(audio, 'loadedmetadata', 3000);
      } catch (error) {
        warnAudio('[rbfa] audio metadata not loaded', {
          trackId,
          src: audio.src,
          error: error?.message || error
        });
      }
    }
    if (requestId !== playRequestIdRef.current) {
      return;
    }
    try {
      logAudio('[rbfa] Attempting audio.play()', {
        trackId,
        readyState: audio.readyState,
        src: audio.src
      });
      await audio.play();
      logAudio('[rbfa] audio.play() succeeded', { trackId });
    } catch (error) {
      if (error?.name === 'AbortError' || error?.code === 20) {
        warnAudio('[rbfa] audio play aborted', {
          trackId,
          src: audio.src
        });
        updatePlaybackState(trackId, {
          status: 'paused',
          loading: false
        });
        return;
      }
      const name = error?.name ? ` (${error.name})` : '';
      const message = error?.message ? ` ${error.message}` : '';
      updatePlaybackState(trackId, {
        status: 'error',
        loading: false,
        error: `Unable to start playback${name}.${message}`
      });
      if (error?.name === 'NotAllowedError') {
        setAudioStatus({ level: 'blocked', message: 'Playback blocked by OS or policy' });
      } else {
        setAudioStatus({ level: 'error', message: 'Playback failed' });
      }
      console.error('[rbfa] audio play failed', {
        trackId,
        src: audio.src,
        error: {
          name: error?.name,
          message: error?.message,
          code: error?.code
        }
      });
    }
  };

  const togglePlayPause = async (track) => {
    const trackId = getTrackId(track);
    const state = getPlaybackState(trackId);
    const audio = sharedAudioRef.current;
    if (state.status === 'playing' && audio && String(sharedAudioTrackIdRef.current) === String(trackId)) {
      audio.pause();
      if (samplingStateRef.current.active && String(trackId) === String(samplingStateRef.current.trackIds?.[samplingStateRef.current.currentIndex])) {
        samplingPausedRef.current = true;
        clearSamplingTimer();
        clearSamplingInterval();
      }
      return;
    }

    if (samplingStateRef.current.active) {
      if (state.status === 'paused' && audio && String(sharedAudioTrackIdRef.current) === String(trackId)) {
        samplingPausedRef.current = false;
      } else {
        stopSampling();
      }
    }
    if (state.status === 'paused' && audio && String(sharedAudioTrackIdRef.current) === String(trackId)) {
      try {
        await audio.play();
        if (samplingStateRef.current.active && String(trackId) === String(samplingStateRef.current.trackIds?.[samplingStateRef.current.currentIndex])) {
          scheduleSamplingAdvance(trackId);
        }
        return;
      } catch {
        // fallback to full playTrack
      }
    }
    await playTrack(track, state.currentTime || 0);
  };

  const seekFromWaveform = async (track, event) => {
    const trackId = getTrackId(track);
    const state = getPlaybackState(trackId);
    const container = event.currentTarget;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const duration = Number(state.duration) || Number(track.durationSeconds) || 0;
    const target = ratio * duration;
    await playTrack(track, target);
  };

  const sortedTracks = useMemo(() => {
    const values = [...visibleTracks];
    const factor = sortDirection === 'asc' ? 1 : -1;

    values.sort((a, b) => {
      if (sortBy === 'play' || sortBy === 'waveformPreview') {
        return 0;
      }
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      const aNumber = typeof aValue === 'number' ? aValue : Number.NaN;
      const bNumber = typeof bValue === 'number' ? bValue : Number.NaN;
      const bothNumeric = Number.isFinite(aNumber) && Number.isFinite(bNumber);

      if (bothNumeric) {
        return (aNumber - bNumber) * factor;
      }

      return String(aValue || '').localeCompare(String(bValue || '')) * factor;
    });

    return values;
  }, [visibleTracks, sortBy, sortDirection]);

  const totalPages = useMemo(() => {
    if (!sortedTracks.length) {
      return 1;
    }

    return Math.max(1, Math.ceil(sortedTracks.length / pageSize));
  }, [pageSize, sortedTracks.length]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pagedTracks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedTracks.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, sortedTracks]);

  const trackIndexById = useMemo(() => {
    return new Map(
      tracks
        .map((track) => {
          const trackId = getTrackId(track);
          return trackId ? [trackId, track] : null;
        })
        .filter(Boolean)
    );
  }, [tracks]);

  const nowPlayingTrack = useMemo(() => {
    if (!activeTrackId) {
      return null;
    }
    return trackIndexById.get(String(activeTrackId)) || null;
  }, [activeTrackId, trackIndexById]);

  const similarMatches = useMemo(() => {
    if (!Array.isArray(similarResults?.matches)) {
      return [];
    }
    const seen = new Set();
    return similarResults.matches.filter((match) => {
      const key = String(match.trackId ?? match.id ?? match.TrackID ?? '');
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [similarResults]);

  const rowHeight = tableDensity === 'compact' ? 30 : 40;
  const virtualWindowSize = Math.ceil(TABLE_VIEWPORT_HEIGHT / rowHeight) + (VIRTUAL_OVERSCAN_ROWS * 2);
  const virtualStartIndex = Math.max(0, Math.floor(tableScrollTop / rowHeight) - VIRTUAL_OVERSCAN_ROWS);
  const virtualEndIndex = Math.min(pagedTracks.length, virtualStartIndex + virtualWindowSize);
  const virtualRows = pagedTracks.slice(virtualStartIndex, virtualEndIndex);
  const topSpacerHeight = virtualStartIndex * rowHeight;
  const bottomSpacerHeight = Math.max(0, (pagedTracks.length - virtualEndIndex) * rowHeight);
  const visibleTrackColumnCount = TRACK_COLUMN_ORDER.filter((columnKey) => visibleTrackColumns[columnKey]).length;

  const filteredIssues = useMemo(() => {
    if (issueSeverityFilter === 'all') {
      return validationIssues;
    }

    return validationIssues.filter((issue) => issue.severity === issueSeverityFilter);
  }, [issueSeverityFilter, validationIssues]);

  const libraryStats = useMemo(() => {
    if (!tracks.length) {
      return null;
    }

    const bpmValues = tracks.map((track) => Number(track.bpm)).filter((value) => Number.isFinite(value));
    const durationValues = tracks.map((track) => Number(track.durationSeconds)).filter((value) => Number.isFinite(value));
    const withKeyCount = tracks.filter((track) => String(track.key || '').trim()).length;
    const genreCount = new Set(
      tracks
        .map((track) => String(track.genre || '').trim().toLowerCase())
        .filter(Boolean)
    ).size;

    return {
      bpmMin: bpmValues.length ? Math.min(...bpmValues) : null,
      bpmMax: bpmValues.length ? Math.max(...bpmValues) : null,
      avgDuration: durationValues.length
        ? (durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
        : null,
      keyCoverage: tracks.length ? withKeyCount / tracks.length : 0,
      genreCount
    };
  }, [tracks]);

  const toggleSort = (nextSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection('asc');
  };

  const toggleTrackColumn = (columnKey) => {
    setVisibleTrackColumns((current) => {
      const enabledCount = Object.values(current).filter(Boolean).length;
      if (enabledCount <= 1 && current[columnKey]) {
        return current;
      }

      return {
        ...current,
        [columnKey]: !current[columnKey]
      };
    });
  };

  useEffect(() => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.saveState) {
      return;
    }

    bridgeApi.saveState({
      tableSortBy: sortBy,
      tableSortDirection: sortDirection,
      visibleTrackColumns,
      tableDensity,
      tablePageSize: pageSize
    }).catch(() => {
      // best-effort UI preference save
    });
  }, [sortBy, sortDirection, visibleTrackColumns, tableDensity, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [trackQuery, sortBy, sortDirection]);

  useEffect(() => {
    if (tableViewportRef.current) {
      tableViewportRef.current.scrollTop = 0;
    }
    setTableScrollTop(0);
  }, [currentPage, pageSize, tableDensity, visibleTrackColumns, trackQuery, sortBy, sortDirection]);

  const onTableScroll = (event) => {
    setTableScrollTop(event.currentTarget.scrollTop || 0);
  };

  const exportAnalysis = async (format) => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.exportAnalysis) {
      setError(DESKTOP_BRIDGE_ERROR);
      return;
    }

    if (!analysisResult) {
      setError('No analysis result to export.');
      return;
    }

    try {
      const result = await bridgeApi.exportAnalysis({
        format,
        analysisResult,
        trackIndex: Object.fromEntries(trackIndexById)
      });

      if (!result?.canceled && result?.filePath) {
        setError(`Exported analysis to ${result.filePath}`);
      }
    } catch (exportError) {
      setError(exportError.message || String(exportError));
    }
  };

  const playlistCardItems = useMemo(() => {
    if (!playlistSuggestions?.result?.clusters?.length) {
      return [];
    }

    return playlistSuggestions.result.clusters.slice(0, 6).map((cluster, index) => {
      const tracksInCluster = cluster.trackIds
        .map((trackId) => trackIndexById.get(String(trackId)))
        .filter(Boolean);
      const bpmValues = tracksInCluster
        .map((track) => Number(track.bpm))
        .filter((value) => Number.isFinite(value));
      const bpmRange = bpmValues.length
        ? { min: Math.min(...bpmValues), max: Math.max(...bpmValues) }
        : null;
      const clusterKey = `all-${cluster.id || index}`;
      const decision = getClusterDecision(clusterKey);

      return {
        id: cluster.id || index,
        name: decision?.name || `Cluster #${index + 1}`,
        confidence: (cluster.confidence ?? 0) * 100,
        tracks: tracksInCluster,
        bpmRange,
        clusterKey,
        cluster
      };
    });
  }, [playlistSuggestions, trackIndexById, getClusterDecision]);

  return (
    <div className="app-shell">
      <AppHeader onSettingsClick={() => console.log('Settings')} />

      <main className="app-main">
        {!xmlPath.trim() ? (
          <SetupWizard
            onFileSelect={handleWizardFileSelect}
            isLoading={isParsing}
            recentImports={recentImports}
          />
        ) : (
          <div className="app-content">
            <div className="header">
              <h1>Rekordbox Flow Analyzer</h1>
              <p>Phase 1 shell: import XML, choose folders, inspect parsed tracks.</p>
              {getBuildTag() ? <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Build: {getBuildTag()}</p> : null}
            </div>

            <div className="card">
              <div className="row">
                <input
                  type="text"
                  placeholder="C:/path/to/rekordbox-export.xml"
                  value={xmlPath}
                  onChange={(event) => setXmlPath(event.target.value)}
                />
                <button type="button" className="secondary" onClick={pickFile} disabled={isParsing}>Browse XML</button>
                <button type="button" onClick={parse} disabled={isParsing}>Parse Library</button>
                <button type="button" onClick={runAnalysis} disabled={isParsing || isAnalyzing || tracks.length < 2}>
                  {isAnalyzing ? 'Analyzing...' : 'Run Baseline Analysis'}
                </button>
              </div>
              <div className="row" style={{ marginTop: '8px' }}>
                <label>
                  Max Pairs
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={analysisMaxPairs}
                    onChange={(event) => setAnalysisMaxPairs(Number(event.target.value))}
                    style={{ width: '120px', marginLeft: '6px' }}
                  />
                </label>
                <label>
                  Pair Cap
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={analysisPairCap}
                    onChange={(event) => setAnalysisPairCap(Number(event.target.value))}
                    style={{ width: '120px', marginLeft: '6px' }}
                  />
                </label>
                <label>
                  Yield Every
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={analysisYieldEvery}
                    onChange={(event) => setAnalysisYieldEvery(Number(event.target.value))}
                    style={{ width: '120px', marginLeft: '6px' }}
                  />
                </label>
              </div>
              <div className="row" style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Optional ANLZ map path (.planning/anlz-track-map.json)"
                  value={anlzMapPath}
                  onChange={(event) => setAnlzMapPath(event.target.value)}
                />
              </div>
              <div className="row" style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Rekordbox USBANLZ folder (e.g., PIONEER/USBANLZ)"
                  value={usbAnlzPath}
                  onChange={(event) => setUsbAnlzPath(event.target.value)}
                />
                <button type="button" className="secondary" onClick={pickUsbAnlzFolder} disabled={isBuildingAnlzMap}>
                  Browse USBANLZ
                </button>
                <button
                  type="button"
                  onClick={buildAnlzMap}
                  disabled={isBuildingAnlzMap || !tracks.length}
                >
                  {isBuildingAnlzMap ? 'Building...' : 'Build ANLZ Map'}
                </button>
                {isBuildingAnlzMap ? (
                  <button type="button" className="secondary" onClick={cancelAnlzMapBuild}>
                    Cancel
                  </button>
                ) : null}
              </div>
              {anlzBuildProgress ? (
                <div className="meta" style={{ marginTop: '6px' }}>
                  <span>
                    ANLZ Progress: {anlzBuildProgress.scanned || 0}/{anlzBuildProgress.total || 0} EXT files
                  </span>
                  <span>Parsed: {anlzBuildProgress.parsedCount || 0}</span>
                  <span>Errors: {anlzBuildProgress.parseErrors || 0}</span>
                  <span>Missing PPTH: {anlzBuildProgress.missingPpth || 0}</span>
                </div>
              ) : null}
              {analysisProgress ? (
                <div className="meta" style={{ marginTop: '6px' }}>
                  <span>
                    Analysis Progress: {analysisProgress.pairCount || 0}/{analysisProgress.totalPairs || 0} pairs
                  </span>
                  <span>Computed: {analysisProgress.computed || 0}</span>
                  <span>Cache Hits: {analysisProgress.cacheHits || 0}</span>
                  {analysisProgress.done ? <span>Done</span> : null}
                </div>
              ) : null}
              {progress !== null && isParsing ? <p className="progress">Parsing in background: {progress}%</p> : null}
              {error ? <p style={{ color: '#be123c', margin: '8px 0 0' }}>{error}</p> : null}
              {summary ? (
                <>
                  <div className="stat-grid">
                    <StatCard icon={Music2} value={summary.trackCount} label="Tracks" />
                    <StatCard icon={ListMusic} value={summary.playlistCount} label="Playlists" />
                    <StatCard icon={FolderOpen} value={summary.folderCount} label="Folders" />
                    <StatCard
                      icon={Waves}
                      value={anlzAttachSummary?.attached || 0}
                      label="ANLZ Attached"
                    />
                  </div>
                  <div className="meta" style={{ marginTop: '10px' }}>
                    <span>Selected Folders: {selectedFolders.length || 'All'}</span>
                    <span>ANLZ Map: {anlzMapPath.trim() ? 'Configured' : 'Not set'}</span>
                    {anlzBuildSummary ? (
                      <span>
                        ANLZ Matched: {anlzBuildSummary.matchedTracks || 0}/{anlzBuildSummary.totalTracks || 0}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <div className="grid">
        <div className="card">
          <h3>Folder Filter Tree</h3>
          <div className="folder-list">
            {folders.length === 0 ? <p>No folders parsed yet.</p> : null}
            {folderTree?.children?.map((node) => (
              <FolderNode
                key={node.path}
                node={node}
                depth={0}
                selectedSet={selectedSet}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onToggleExpanded={toggleExpanded}
              />
            ))}
          </div>
          <div className="row" style={{ marginTop: '10px' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setSelectedFolders([])}
              disabled={isParsing}
            >
              Clear Filter
            </button>
            <button type="button" onClick={parse} disabled={isParsing || !xmlPath.trim()}>Re-Parse with Filter</button>
          </div>
          {libraryStats ? (
            <div className="meta" style={{ marginTop: '10px' }}>
              <span>BPM Range: {libraryStats.bpmMin !== null ? `${libraryStats.bpmMin} - ${libraryStats.bpmMax}` : '-'}</span>
              <span>Avg Duration: {libraryStats.avgDuration !== null ? formatDuration(libraryStats.avgDuration) : '-'}</span>
              <span>Genres: {libraryStats.genreCount}</span>
              <span>Key Coverage: {(libraryStats.keyCoverage * 100).toFixed(0)}%</span>
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>Quick Preview</h3>
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#334155' }}>Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={playbackVolume}
                onChange={(event) => handleVolumeChange(event.target.value)}
                style={{ width: '140px' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#64748b', minWidth: '36px', textAlign: 'right' }}>
                {Math.round(playbackVolume * 100)}%
              </span>
              {audioStatus.message ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: audioStatus.level === 'error' || audioStatus.level === 'blocked'
                      ? '#fecaca'
                      : audioStatus.level === 'muted'
                        ? '#fed7aa'
                        : '#cbd5f5',
                    color: audioStatus.level === 'error' || audioStatus.level === 'blocked'
                      ? '#b91c1c'
                      : audioStatus.level === 'muted'
                        ? '#9a3412'
                        : '#1e3a8a',
                    backgroundColor: audioStatus.level === 'error' || audioStatus.level === 'blocked'
                      ? '#fef2f2'
                      : audioStatus.level === 'muted'
                        ? '#fff7ed'
                        : '#eef2ff'
                  }}
                >
                  {audioStatus.message}
                </span>
              ) : null}
              <button type="button" className="secondary" onClick={playTestTone}>
                Test Tone
              </button>
            </div>
          </div>
          {nowPlayingTrack ? (
            <div className="now-playing">
              <div className="now-playing-main">
                <span className="now-playing-label">Now Playing</span>
                <span className="now-playing-title">
                  {(nowPlayingTrack.artist || 'Unknown')} — {(nowPlayingTrack.title || 'Unknown')}
                </span>
              </div>
              <div className="now-playing-meta">
                <span>{nowPlayingTrack.bpm ? `${Math.round(nowPlayingTrack.bpm)} BPM` : '-'}</span>
                <span>{nowPlayingTrack.key || '-'}</span>
                <span>
                  {formatClock(getPlaybackState(activeTrackId).currentTime)}
                  {' / '}
                  {formatClock(getPlaybackState(activeTrackId).duration)}
                </span>
              </div>
            </div>
          ) : null}
          <TrackTable
            tracks={sortedTracks.slice(0, 20)}
            onTrackClick={(track) => setSelectedTrackId(getTrackId(track))}
            onTogglePlay={togglePlayPause}
            getPlaybackState={getPlaybackState}
            disablePlay={isSamplingActive}
          />
        </div>

        <div className={`card grid-span${isSamplingActive ? ' sampling-active' : ''}`}>
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Track Table ({sortedTracks.length}/{tracks.length})</h3>
          </div>
          <div className="row" style={{ marginBottom: '8px' }}>
            <input
              ref={trackFilterInputRef}
              type="text"
              placeholder="Filter tracks by id, artist, title, genre, key..."
              value={trackQuery}
              onChange={(event) => setTrackQuery(event.target.value)}
            />
          </div>
          <div className="row" style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: '#334155' }}>Density:</span>
            <button
              type="button"
              className={tableDensity === 'cozy' ? '' : 'secondary'}
              onClick={() => setTableDensity('cozy')}
              style={{ padding: '6px 10px' }}
            >
              Cozy
            </button>
            <button
              type="button"
              className={tableDensity === 'compact' ? '' : 'secondary'}
              onClick={() => setTableDensity('compact')}
              style={{ padding: '6px 10px' }}
            >
              Compact
            </button>
            <span style={{ fontSize: '0.9rem', color: '#334155', marginLeft: '8px' }}>Page Size:</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="row" style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: '#334155' }}>Columns:</span>
            {TRACK_COLUMN_ORDER.map((columnKey) => (
              <label key={columnKey} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={visibleTrackColumns[columnKey]}
                  onChange={() => toggleTrackColumn(columnKey)}
                />
                {TRACK_COLUMN_LABELS[columnKey]}
              </label>
            ))}
          </div>
          <p style={{ margin: '0 0 8px', color: '#475569' }}>
            Shortcuts: Ctrl/Cmd+F filter, Ctrl/Cmd+Enter parse, Ctrl/Cmd+Shift+A analyze.
          </p>
          <div
            ref={tableViewportRef}
            style={{ maxHeight: TABLE_VIEWPORT_HEIGHT, overflow: 'auto' }}
            onScroll={onTableScroll}
          >
            <table className={`track-table ${tableDensity === 'compact' ? 'compact' : ''}`}>
              <colgroup>
                {visibleTrackColumns.play ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.play}px` }} /> : null}
                {visibleTrackColumns.id ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.id}px` }} /> : null}
                {visibleTrackColumns.title ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.title}px` }} /> : null}
                {visibleTrackColumns.bpm ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.bpm}px` }} /> : null}
                {visibleTrackColumns.key ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.key}px` }} /> : null}
                {visibleTrackColumns.waveformPreview ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.waveformPreview}px` }} /> : null}
                {visibleTrackColumns.genre ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.genre}px` }} /> : null}
                {visibleTrackColumns.durationSeconds ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.durationSeconds}px` }} /> : null}
                {visibleTrackColumns.artist ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.artist}px` }} /> : null}
                {visibleTrackColumns.playlists ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.playlists}px` }} /> : null}
              </colgroup>
              <thead>
                <tr>
                  {visibleTrackColumns.play ? <th>Play</th> : null}
                  {visibleTrackColumns.id ? <th>ID</th> : null}
                  {visibleTrackColumns.title ? (
                    <th>
                      <button type="button" className="sort-button" onClick={() => toggleSort('title')}>
                        Title {sortBy === 'title' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </button>
                    </th>
                  ) : null}
                  {visibleTrackColumns.bpm ? (
                    <th>
                      <button type="button" className="sort-button" onClick={() => toggleSort('bpm')}>
                        BPM {sortBy === 'bpm' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </button>
                    </th>
                  ) : null}
                  {visibleTrackColumns.key ? (
                    <th>
                      <button type="button" className="sort-button" onClick={() => toggleSort('key')}>
                        Key {sortBy === 'key' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </button>
                    </th>
                  ) : null}
                  {visibleTrackColumns.waveformPreview ? <th>Waveform</th> : null}
                  {visibleTrackColumns.genre ? (
                    <th>
                      <button type="button" className="sort-button" onClick={() => toggleSort('genre')}>
                        Genre {sortBy === 'genre' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </button>
                    </th>
                  ) : null}
                  {visibleTrackColumns.durationSeconds ? (
                    <th>
                      <button type="button" className="sort-button" onClick={() => toggleSort('durationSeconds')}>
                        Duration {sortBy === 'durationSeconds' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </button>
                    </th>
                  ) : null}
                  {visibleTrackColumns.artist ? (
                    <th>
                      <button type="button" className="sort-button" onClick={() => toggleSort('artist')}>
                        Artist {sortBy === 'artist' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </button>
                    </th>
                  ) : null}
                  {visibleTrackColumns.playlists ? <th>Playlists</th> : null}
                </tr>
              </thead>
              <tbody>
                {topSpacerHeight > 0 ? (
                  <tr>
                    <td colSpan={visibleTrackColumnCount} style={{ height: `${topSpacerHeight}px`, padding: 0, borderBottom: 'none' }} />
                  </tr>
                ) : null}
                {virtualRows.map((track) => {
                  const rowTrackId = getTrackId(track);
                  return (
                  <tr
                    key={rowTrackId || track.id}
                    className={rowTrackId === selectedTrackId ? 'selected-row' : ''}
                    onClick={() => setSelectedTrackId(rowTrackId)}
                  >
                    {visibleTrackColumns.play ? (
                      <td>
                        <div className="playback-cell">
                          <button
                            type="button"
                            className="playback-button"
                            onClick={() => togglePlayPause(track)}
                            disabled={isSamplingActive || getPlaybackState(rowTrackId).loading}
                          >
                            {getPlaybackState(rowTrackId).loading
                              ? 'Loading'
                              : getPlaybackState(rowTrackId).status === 'playing'
                                ? 'Pause'
                                : 'Play'}
                          </button>
                          <span className="playback-time">
                            {formatClock(getPlaybackState(rowTrackId).currentTime)}
                          </span>
                        </div>
                        {getPlaybackState(rowTrackId).status === 'error' ? (
                          <div className="playback-error">{getPlaybackState(rowTrackId).error}</div>
                        ) : null}
                      </td>
                    ) : null}
                    {visibleTrackColumns.id ? <td>{track.trackId || track.id}</td> : null}
                    {visibleTrackColumns.title ? <td>{track.title || '-'}</td> : null}
                    {visibleTrackColumns.bpm ? <td>{track.bpm ?? '-'}</td> : null}
                    {visibleTrackColumns.key ? <td>{track.key || '-'}</td> : null}
                    {visibleTrackColumns.waveformPreview ? (
                      <td>
                        <MiniWaveform
                          waveform={track.anlzWaveform}
                          progress={getPlaybackState(rowTrackId).duration
                            ? getPlaybackState(rowTrackId).currentTime / getPlaybackState(rowTrackId).duration
                            : 0}
                          isActive={getPlaybackState(rowTrackId).status === 'playing'
                            || getPlaybackState(rowTrackId).status === 'paused'}
                          onSeek={(event) => seekFromWaveform(track, event)}
                        />
                        {getPlaybackState(rowTrackId).status === 'error' ? (
                          <div className="playback-error">{getPlaybackState(rowTrackId).error}</div>
                        ) : null}
                      </td>
                    ) : null}
                    {visibleTrackColumns.genre ? <td>{track.genre || '-'}</td> : null}
                    {visibleTrackColumns.durationSeconds ? <td>{formatDuration(track.durationSeconds)}</td> : null}
                    {visibleTrackColumns.artist ? <td>{track.artist || '-'}</td> : null}
                    {visibleTrackColumns.playlists ? <td>{trackPlaylistIndex[track.id]?.length || 0}</td> : null}
                  </tr>
                );
                })}
                {bottomSpacerHeight > 0 ? (
                  <tr>
                    <td colSpan={visibleTrackColumnCount} style={{ height: `${bottomSpacerHeight}px`, padding: 0, borderBottom: 'none' }} />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: '10px', justifyContent: 'space-between' }}>
            <span style={{ color: '#475569' }}>
              Page {currentPage} of {totalPages} ({pagedTracks.length} shown)
            </span>
            <div className="row">
              <button
                type="button"
                className="secondary"
                onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                disabled={currentPage <= 1}
              >
                Prev
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Track Details</h3>
        {!selectedTrack ? <p>Select a track row to inspect metadata and source playlists.</p> : null}
        {selectedTrack ? (
          <div>
            <div className="row" style={{ marginBottom: '8px', justifyContent: 'space-between' }}>
              <div className="row">
                <button
                  type="button"
                  className={showTrackMeta ? '' : 'secondary'}
                  style={{ padding: '6px 10px' }}
                  onClick={() => setShowTrackMeta((value) => !value)}
                >
                  {showTrackMeta ? 'Hide ID' : 'Show ID'}
                </button>
                <button
                  type="button"
                  className={showTrackLocation ? '' : 'secondary'}
                  style={{ padding: '6px 10px' }}
                  onClick={() => setShowTrackLocation((value) => !value)}
                >
                  {showTrackLocation ? 'Hide Location' : 'Show Location'}
                </button>
                <button
                  type="button"
                  className={showTrackAnlzMeta ? '' : 'secondary'}
                  style={{ padding: '6px 10px' }}
                  onClick={() => setShowTrackAnlzMeta((value) => !value)}
                >
                  {showTrackAnlzMeta ? 'Hide ANLZ Meta' : 'Show ANLZ Meta'}
                </button>
                <button
                  type="button"
                  className={showTrackPlaylists ? '' : 'secondary'}
                  style={{ padding: '6px 10px' }}
                  onClick={() => setShowTrackPlaylists((value) => !value)}
                >
                  {showTrackPlaylists ? 'Hide Playlists' : 'Show Playlists'}
                </button>
              </div>
              <div className="row">
                <button
                  type="button"
                  onClick={runSimilarSearch}
                  disabled={isFindingSimilar || tracks.length < 2}
                >
                  {isFindingSimilar ? 'Finding...' : 'Find Similar'}
                </button>
                <label style={{ marginLeft: '8px' }}>
                  Min Score
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={similarMinScore}
                    onChange={(event) => setSimilarMinScore(event.target.value)}
                    style={{ width: '90px', marginLeft: '6px' }}
                  />
                </label>
                <label style={{ marginLeft: '8px' }}>
                  Limit
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={similarLimit}
                    onChange={(event) => setSimilarLimit(event.target.value)}
                    style={{ width: '70px', marginLeft: '6px' }}
                  />
                </label>
              </div>
            </div>
            <div className="meta">
              {showTrackMeta ? <span>ID: {selectedTrack.trackId || selectedTrack.id}</span> : null}
              <span>Artist: {selectedTrack.artist || '-'}</span>
              <span>Title: {selectedTrack.title || '-'}</span>
              <span>BPM: {selectedTrack.bpm ?? '-'}</span>
              <span>Key: {selectedTrack.key || '-'}</span>
            </div>
            {showTrackLocation ? (
              <p style={{ marginTop: '8px' }}>
                Location: {selectedTrack.location || '-'}
              </p>
            ) : null}
            {similarResults ? (
              <>
                <h4 style={{ margin: '12px 0 8px' }}>Similar Tracks</h4>
                <div className="meta">
                  <span>Matches: {similarMatches.length}</span>
                  <span>Pairs: {similarResults.pairCount}</span>
                  <span>Computed: {similarResults.computed}</span>
                  <span>Cache Hits: {similarResults.cacheHits}</span>
                </div>
                {similarMatches.length ? (
                  <div className="similar-track-list">
                    {similarMatches.map((match) => {
                      const track = trackIndexById.get(String(match.trackId));
                      if (!track) {
                        return null;
                      }
                      const trackId = getTrackId(track);
                      const playback = getPlaybackState(trackId);
                      const title = track.title || track.Name || 'Unknown';
                      const artist = track.artist || track.Artist || 'Unknown';
                      const bpmValue = track.bpm ?? track.AverageBpm;
                      const bpmLabel = Number.isFinite(Number(bpmValue))
                        ? `${Math.round(bpmValue)} BPM`
                        : '-';
                      const keyValue = track.key || track.tonality?.key || '-';
                      const duration = Number(track.durationSeconds)
                        || Number(track.anlzWaveform?.durationSeconds)
                        || Number(playback.duration)
                        || 0;
                      const isPlaying = playback.status === 'playing';
                      return (
                        <div className={`similar-track-card${isPlaying ? ' playing' : ''}`} key={match.trackId}>
                          <div className="similar-track-header">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => togglePlayPause(track)}
                            >
                              {playback.status === 'playing' ? 'Pause' : 'Play'}
                            </button>
                            <div className="similar-track-info">
                              <div className="similar-track-title">{title}</div>
                              <div className="similar-track-artist">{artist}</div>
                            </div>
                            <div className="similar-track-meta">
                              <span>{bpmLabel}</span>
                              <span>{keyValue}</span>
                              <span>{formatClock(playback.currentTime || 0)}</span>
                            </div>
                          </div>
                          <div className="similar-waveform">
                            {track.anlzWaveform ? (
                              <WaveformPreview
                                waveform={track.anlzWaveform}
                                seekLabel="Seek in track"
                                progress={playback.duration ? playback.currentTime / playback.duration : 0}
                                onSeek={(ratio) => {
                                  if (!duration) {
                                    return;
                                  }
                                  const target = ratio * duration;
                                  playTrack(track, target);
                                }}
                              />
                            ) : (
                              <div className="waveform-placeholder">No waveform available</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p>No similar tracks above the threshold.</p>
                )}
              </>
            ) : null}
            <>
              <>
                <h4 style={{ margin: '12px 0 8px' }}>ANLZ Waveform Summary</h4>
                {selectedTrack.anlzWaveform ? (
                  <div>
                    {showTrackAnlzMeta ? (
                      <>
                        <div className="meta">
                          <span>Source: {selectedTrack.anlzWaveform.source || 'anlz-pwv5'}</span>
                          <span>Samples: {selectedTrack.anlzWaveform.sampleCount || 0}</span>
                          <span>Duration: {formatDuration(selectedTrack.anlzWaveform.durationSeconds)}</span>
                          <span>
                            Avg RGB: (
                            {selectedTrack.anlzWaveform.avgColor?.red ?? 0},
                            {selectedTrack.anlzWaveform.avgColor?.green ?? 0},
                            {selectedTrack.anlzWaveform.avgColor?.blue ?? 0}
                            )
                          </span>
                          <span>Height Avg: {Number(selectedTrack.anlzWaveform.height?.avg || 0).toFixed(2)}</span>
                          <span>Height Max: {selectedTrack.anlzWaveform.height?.max ?? 0}</span>
                        </div>
                        <p style={{ marginTop: '8px' }}>
                          EXT Path: {selectedTrack.anlzWaveform.extPath || '-'}
                        </p>
                      </>
                    ) : null}
                    <WaveformPreview waveform={selectedTrack.anlzWaveform} />
                    {showTrackAnlzMeta ? (
                      <p style={{ marginTop: '4px', color: '#334155' }}>
                        Envelope bins (preview): {formatBinPreview(selectedTrack.anlzWaveform.bins)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p style={{ marginTop: '4px' }}>
                    No ANLZ waveform attached for this track. Set ANLZ map path and parse again.
                  </p>
                )}
              </>
            </>
            {showTrackPlaylists ? (
              <>
                <h4 style={{ margin: '12px 0 8px' }}>
                  Source Playlists ({trackPlaylistIndex[selectedTrack.id]?.length || 0})
                </h4>
                {(trackPlaylistIndex[selectedTrack.id] || []).length === 0 ? (
                  <p>No playlist references found for this track in the active filter scope.</p>
                ) : (
                  <ul className="playlist-list">
                    {(trackPlaylistIndex[selectedTrack.id] || []).map((playlistPath) => (
                      <li key={playlistPath}>{playlistPath}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {validationIssues.length > 0 ? (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: showValidationIssues ? '8px' : '0' }}>
            <h3 style={{ margin: 0 }}>Validation Issues ({filteredIssues.length}/{validationIssues.length})</h3>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowValidationIssues((value) => !value)}
            >
              {showValidationIssues ? 'Hide Issues' : 'Show Issues'}
            </button>
          </div>
          {showValidationIssues ? (
            <>
              <div className="row" style={{ marginBottom: '8px' }}>
                <select value={issueSeverityFilter} onChange={(event) => setIssueSeverityFilter(event.target.value)}>
                  <option value="all">All severities</option>
                  <option value="error">Errors</option>
                  <option value="warning">Warnings</option>
                </select>
              </div>
              <table className="track-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Code</th>
                    <th>Message</th>
                    <th>Context</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue, index) => (
                    <tr key={`${issue.code}-${index}`}>
                      <td>{issue.severity}</td>
                      <td>{issue.code}</td>
                      <td>{issue.message}</td>
                      <td>{Object.keys(issue.context || {}).length > 0 ? JSON.stringify(issue.context) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p style={{ margin: '8px 0 0', color: '#475569' }}>
              Hidden by default so library browsing stays in focus.
            </p>
          )}
        </div>
      ) : null}

      <div className="card">
        <h3>Recent Imports</h3>
        {recentImports.length === 0 ? <p>No imports recorded yet.</p> : null}
        {recentImports.length > 0 ? (
          <table className="track-table">
            <thead>
              <tr>
                <th>When</th>
                <th>XML Path</th>
                <th>Tracks</th>
                <th>Playlists</th>
                <th>Folders</th>
                <th>Filter</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentImports.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.parsedAt).toLocaleString()}</td>
                  <td title={row.xmlPath}>{row.xmlPath}</td>
                  <td>{row.trackCount}</td>
                  <td>{row.playlistCount}</td>
                  <td>{row.folderCount}</td>
                  <td>{row.selectedFolders.length > 0 ? row.selectedFolders.join(', ') : 'All'}</td>
                  <td>
                    <button type="button" className="secondary" onClick={() => applyRecentImport(row)}>
                      Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {analysisResult ? (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Baseline Analysis</h3>
            <div className="row">
              <button type="button" className="secondary" onClick={() => exportAnalysis('csv')}>
                Export CSV
              </button>
              <button type="button" className="secondary" onClick={() => exportAnalysis('json')}>
                Export JSON
              </button>
            </div>
          </div>
          <div className="meta">
            <span>Algorithm: {analysisResult.algorithmVersion}</span>
            <span>Pairs: {analysisResult.pairCount}</span>
            <span>Computed: {analysisResult.computed}</span>
            <span>Cache Hits: {analysisResult.cacheHits}</span>
          </div>
          <div className="meta">
            <span>Weights</span>
            <span>BPM: {(analysisResult.weights?.bpm ?? 0).toFixed(2)}</span>
            <span>Key: {(analysisResult.weights?.key ?? 0).toFixed(2)}</span>
            <span>Waveform: {(analysisResult.weights?.waveform ?? 0).toFixed(2)}</span>
            <span>Rhythm: {(analysisResult.weights?.rhythm ?? 0).toFixed(2)}</span>
          </div>
          <table className="track-table" style={{ marginTop: '10px' }}>
            <thead>
              <tr>
                <th>Track A</th>
                <th>Track B</th>
                <th>Score</th>
                <th>BPM</th>
                <th>Key</th>
                <th>Waveform</th>
                <th>Rhythm</th>
                <th>Why</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {analysisResult.topMatches.map((row) => (
                <tr key={`${row.trackAId}-${row.trackBId}`}>
                  <td>{row.trackAId}</td>
                  <td>{row.trackBId}</td>
                  <td>{row.score.toFixed(3)}</td>
                  <td>{(row.components?.bpm ?? 0).toFixed(3)}</td>
                  <td>{(row.components?.key ?? 0).toFixed(3)}</td>
                  <td>{(row.components?.waveform ?? 0).toFixed(3)}</td>
                  <td>{(row.components?.rhythm ?? 0).toFixed(3)}</td>
                  <td>{row.reason || '-'}</td>
                  <td>{row.fromCache ? 'Cache' : 'Computed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

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
                        {clusters.length ? (
                          <table className="track-table" style={{ marginTop: '10px' }}>
                            <thead>
                              <tr>
                                <th>Cluster</th>
                                <th>Tracks</th>
                                <th>Avg Score</th>
                                <th>Confidence</th>
                                <th>Ordered</th>
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
                                  const clusterKey = `${group.name}-${cluster.id || index}`;
                                  const isExpanded = expandedClusterKey === clusterKey;
                                  const decision = getClusterDecision(clusterKey);
                                  const clusterSamplingState = samplingState.active && samplingState.clusterKey === clusterKey
                                    ? samplingState
                                    : { active: false, currentIndex: 0, total: 0 };
                                  return (
                                    <React.Fragment key={cluster.id || `${group.name}-${index}`}>
                                    <tr>
                                      <td>#{index + 1}</td>
                                      <td>{cluster.size}</td>
                                      <td>{cluster.avgScore.toFixed(3)}</td>
                                      <td>{(cluster.confidence ?? 0).toFixed(3)}</td>
                                      <td>{cluster.ordered ? 'Yes' : 'No'}</td>
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
                                        {preview.join(', ') || '-'}
                                      </td>
                                    </tr>
                                    {isExpanded ? (
                                      <tr>
                                        <td colSpan={7}>
                                            <ClusterDetails
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
                        ) : (
                          <p>No clusters met the threshold in this folder.</p>
                        )}
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
                {playlistSuggestions.result?.clusters?.length ? (
                  <table className="track-table" style={{ marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th>Cluster</th>
                        <th>Tracks</th>
                        <th>Avg Score</th>
                        <th>Confidence</th>
                        <th>Ordered</th>
                        <th>Status</th>
                        <th>Top Tracks</th>
                      </tr>
                    </thead>
                    <tbody>
                    {playlistSuggestions.result.clusters.map((cluster, index) => {
                      const preview = cluster.trackIds.slice(0, 5).map((trackId) => {
                        const track = trackIndexById.get(String(trackId));
                        return track ? `${track.artist || ''} ${track.title || ''}`.trim() : trackId;
                      }).filter(Boolean);
                      const clusterKey = `all-${cluster.id || index}`;
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
                            <td>{cluster.avgScore.toFixed(3)}</td>
                            <td>{(cluster.confidence ?? 0).toFixed(3)}</td>
                            <td>{cluster.ordered ? 'Yes' : 'No'}</td>
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
                              {preview.join(', ') || '-'}
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr>
                              <td colSpan={7}>
                                <ClusterDetails
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
              ) : (
                  <p>No clusters met the threshold. Try lowering it a bit.</p>
                )}
              </>
            )}
          </>
        ) : (
          <p>Generate suggestions to see clustered playlists.</p>
        )}
          </div>
          </div>
        )}
        <ToastContainer>
          {samplingToast ? (
            <Toast
              message={samplingToast}
              variant="success"
              onClose={() => setSamplingToast(null)}
            />
          ) : null}
        </ToastContainer>
      </main>
    </div>
  );
}

function FolderNode({
  node,
  depth,
  selectedSet,
  expandedFolders,
  onToggleFolder,
  onToggleExpanded
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = expandedFolders.has(node.path);
  const indentStyle = { paddingLeft: `${depth * 14}px` };

  return (
    <div>
      <div className="folder-row" style={indentStyle}>
        {hasChildren ? (
          <button
            type="button"
            className="disclosure"
            onClick={() => onToggleExpanded(node.path)}
            aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="disclosure-spacer" />
        )}
        <label className="folder-item">
          <input
            type="checkbox"
            checked={selectedSet.has(node.path)}
            onChange={() => onToggleFolder(node.path)}
          />{' '}
          {node.name}
        </label>
      </div>
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <FolderNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedSet={selectedSet}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onToggleExpanded={onToggleExpanded}
            />
          ))
        : null}
    </div>
  );
}
