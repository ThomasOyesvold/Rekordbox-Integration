import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  id: true,
  title: true,
  bpm: true,
  key: true,
  waveformPreview: false,
  genre: true,
  durationSeconds: true,
  artist: true,
  playlists: true
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

function WaveformPreview({ waveform }) {
  const bins = Array.isArray(waveform?.bins) ? waveform.bins : [];
  if (!bins.length) {
    return <p style={{ marginTop: '6px' }}>No waveform bins available.</p>;
  }

  const binColors = Array.isArray(waveform?.binColors) ? waveform.binColors : [];
  const fallbackColor = waveform?.avgColor || { red: 0, green: 170, blue: 255 };
  const maxHeight = 31;

  return (
    <div className="waveform-preview">
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
  const audioRegistryRef = useRef(new Map());
  const [playbackStates, setPlaybackStates] = useState({});
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [playbackVolume, setPlaybackVolume] = useState(1);
  const [audioStatus, setAudioStatus] = useState({ level: 'idle', message: '' });
  const audioDebugEnabled = useMemo(() => isAudioDebugEnabled(), []);
  const playRequestIdRef = useRef(0);

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
      gain.gain.value = Math.max(0.05, Math.min(1, playbackVolume));
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.25);
      oscillator.onended = () => {
        context.close();
      };
      logAudio('[rbfa] test tone played', { volume: playbackVolume });
      setAudioStatus({ level: 'playing', message: 'Test tone played' });
    } catch (error) {
      console.error('[rbfa] test tone failed', { error });
      setAudioStatus({ level: 'error', message: 'Test tone failed' });
    }
  };

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

      if (typeof state?.tableSortBy === 'string') {
        setSortBy(state.tableSortBy);
      }

      if (state?.tableSortDirection === 'asc' || state?.tableSortDirection === 'desc') {
        setSortDirection(state.tableSortDirection);
      }

      setVisibleTrackColumns(normalizeVisibleTrackColumns(state?.visibleTrackColumns));

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
    try {
      const result = await bridgeApi.runBaselineAnalysis(tracks, xmlPath.trim(), selectedFolders);
      setAnalysisResult(result);
    } catch (analysisError) {
      setError(analysisError.message || String(analysisError));
    } finally {
      setIsAnalyzing(false);
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
    setPlaybackStates((current) => ({
      ...current,
      [trackId]: {
        ...(current[trackId] || { status: 'idle', currentTime: 0, duration: 0, loading: false, error: '' }),
        ...patch
      }
    }));
  };

  const getPlaybackState = (trackId) => {
    return playbackStates[trackId] || { status: 'idle', currentTime: 0, duration: 0, loading: false, error: '' };
  };

  const stopPlayback = (trackId) => {
    if (!trackId) {
      return;
    }
    const entry = audioRegistryRef.current.get(trackId);
    if (entry?.audio) {
      entry.audio.pause();
      entry.audio.currentTime = 0;
    }
    updatePlaybackState(trackId, {
      status: 'idle',
      currentTime: 0,
      loading: false
    });
  };

  const stopAllPlayback = (keepTrackId = null) => {
    audioRegistryRef.current.forEach((_entry, trackId) => {
      if (keepTrackId && String(trackId) === String(keepTrackId)) {
        return;
      }
      stopPlayback(trackId);
    });
  };

  const ensureAudio = (track, srcOverride = '') => {
    const trackId = track.id;
    const existing = audioRegistryRef.current.get(trackId);
    const src = srcOverride || normalizeAudioLocation(track.location);

    logAudio('[rbfa] ensureAudio', {
      trackId,
      rawLocation: track.location,
      normalizedSrc: src,
      hasExisting: Boolean(existing)
    });

    if (!src) {
      warnAudio('[rbfa] empty audio src', { trackId, location: track.location });
    }

    if (existing?.audio) {
      if (src && existing.audio.src !== src) {
        logAudio('[rbfa] Updating audio src', {
          trackId,
          oldSrc: existing.audio.src,
          newSrc: src
        });
        existing.audio.src = src;
        existing.audio.load();
      }
      return existing.audio;
    }

    logAudio('[rbfa] Creating new Audio element', { trackId, src });
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = src;
    audio.load();
    audio.volume = playbackVolume;

    const onLoadedMeta = () => {
      updatePlaybackState(trackId, {
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        loading: false,
        error: ''
      });
    };
    const onTimeUpdate = () => {
      updatePlaybackState(trackId, {
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : getPlaybackState(trackId).duration
      });
      if (audio.muted || audio.volume === 0) {
        warnAudio('[rbfa] audio muted or zero volume', {
          trackId,
          muted: audio.muted,
          volume: audio.volume
        });
        setAudioStatus({ level: 'muted', message: 'Muted or volume 0' });
      }
    };
    const onPlay = () => {
      updatePlaybackState(trackId, {
        status: 'playing',
        loading: false,
        error: ''
      });
      setActiveTrackId(trackId);
      logAudio('[rbfa] audio state', {
        trackId,
        src: audio.src,
        muted: audio.muted,
        volume: audio.volume,
        readyState: audio.readyState,
        currentTime: audio.currentTime,
        duration: audio.duration
      });
      if (audio.muted || audio.volume === 0) {
        setAudioStatus({ level: 'muted', message: 'Muted or volume 0' });
      } else {
        setAudioStatus({ level: 'playing', message: 'Playing' });
      }
    };
    const onPause = () => {
      updatePlaybackState(trackId, {
        status: 'paused'
      });
      setAudioStatus({ level: 'paused', message: 'Paused' });
    };
    const onEnded = () => {
      updatePlaybackState(trackId, {
        status: 'idle',
        currentTime: 0
      });
      setAudioStatus({ level: 'idle', message: 'Ended' });
    };
    const onError = () => {
      const mediaError = audio.error;
      const errorCode = mediaError?.code;
      let errorMsg = 'Audio unavailable or failed to load';

      // Map MediaError codes to user-friendly messages
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
      setAudioStatus({ level: 'error', message: errorMsg });

      console.error('[rbfa] audio error', {
        trackId,
        src: audio.src,
        mediaError: {
          code: errorCode,
          message: mediaError?.message
        }
      });
    };

    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    audioRegistryRef.current.set(trackId, {
      audio,
      cleanup: () => {
        audio.removeEventListener('loadedmetadata', onLoadedMeta);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      }
    });

    updatePlaybackState(trackId, { loading: true });
    return audio;
  };

  useEffect(() => {
    audioRegistryRef.current.forEach((entry) => {
      if (entry?.audio) {
        entry.audio.volume = playbackVolume;
      }
    });
    if (playbackVolume === 0) {
      setAudioStatus({ level: 'muted', message: 'Muted (volume 0)' });
    }
  }, [playbackVolume]);

  const playTrack = async (track, seekSeconds = null) => {
    const requestId = playRequestIdRef.current + 1;
    playRequestIdRef.current = requestId;

    if (!track?.location) {
      updatePlaybackState(track.id, { status: 'error', error: 'Missing audio path.' });
      setAudioStatus({ level: 'error', message: 'Missing audio path' });
      console.error('[rbfa] playTrack: missing location', { trackId: track.id });
      return;
    }

    logAudio('[rbfa] playTrack START', {
      trackId: track.id,
      title: track.title,
      rawLocation: track.location,
      seekSeconds
    });

    stopAllPlayback(track.id);

    // Get normalized file URL and filesystem path
    const bridgeApi = getBridgeApi();
    setAudioStatus({ level: 'loading', message: 'Loading audio…' });
    let fileUrl = normalizeAudioLocation(track.location, { debug: audioDebugEnabled });

    // Verify file exists and is readable using bridge API
    let pathInfo = null;
    if (bridgeApi?.resolveAudioPath) {
      pathInfo = await bridgeApi.resolveAudioPath(track.location);
      if (requestId !== playRequestIdRef.current) {
        return;
      }
      logAudio('[rbfa] File verification result', pathInfo);

      if (pathInfo?.fileUrl) {
        fileUrl = pathInfo.fileUrl;
      }

      if (!pathInfo.exists) {
        let errorMsg = `File not found: ${pathInfo.fsPath || track.location}`;
        if (pathInfo.parentExists) {
          errorMsg += ' (Parent folder exists; filename or encoding may not match.)';
        }
        if (pathInfo.hadEncodedSegments) {
          errorMsg += ' (Path contains encoded characters; verify Rekordbox XML matches actual folder names.)';
        }
        updatePlaybackState(track.id, {
          status: 'error',
          loading: false,
          error: errorMsg
        });
        setAudioStatus({ level: 'error', message: 'File not found' });
        console.error('[rbfa] File does not exist', {
          trackId: track.id,
          rawLocation: track.location,
          fsPath: pathInfo.fsPath,
          fileUrl
        });
        return;
      }

      if (!pathInfo.readable) {
        const errorMsg = `Permission denied: ${pathInfo.fsPath}`;
        updatePlaybackState(track.id, {
          status: 'error',
          loading: false,
          error: errorMsg
        });
        setAudioStatus({ level: 'error', message: 'File not readable' });
        console.error('[rbfa] File not readable', {
          trackId: track.id,
          fsPath: pathInfo.fsPath,
          fileUrl
        });
        return;
      }

      logAudio('[rbfa] File verification passed', {
        trackId: track.id,
        fsPath: pathInfo.fsPath,
        exists: pathInfo.exists,
        readable: pathInfo.readable
      });
    } else {
      warnAudio('[rbfa] Bridge API not available for file verification');
    }

    logAudio('[rbfa] Setting audio src', { trackId: track.id, fileUrl });
    const audio = ensureAudio(track, fileUrl);
    const duration = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(track.durationSeconds) || 0;

    if (seekSeconds !== null && Number.isFinite(seekSeconds)) {
      const target = clamp(seekSeconds, 0, duration || seekSeconds);
      audio.currentTime = target;
      updatePlaybackState(track.id, { currentTime: target });
      logAudio('[rbfa] Seeking to', { trackId: track.id, target });
    }

    updatePlaybackState(track.id, { loading: audio.readyState < 1, error: '' });
    if (audio.readyState < 1) {
      try {
        await waitForEvent(audio, 'loadedmetadata', 3000);
      } catch (error) {
        warnAudio('[rbfa] audio metadata not loaded', {
          trackId: track.id,
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
        trackId: track.id,
        readyState: audio.readyState,
        src: audio.src
      });
      await audio.play();
      logAudio('[rbfa] audio.play() succeeded', { trackId: track.id });
    } catch (error) {
      const name = error?.name ? ` (${error.name})` : '';
      const message = error?.message ? ` ${error.message}` : '';
      updatePlaybackState(track.id, {
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
        trackId: track.id,
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
    const state = getPlaybackState(track.id);
    const entry = audioRegistryRef.current.get(track.id);
    if (state.status === 'playing' && entry?.audio) {
      entry.audio.pause();
      return;
    }

    await playTrack(track, state.currentTime || 0);
  };

  const seekFromWaveform = async (track, event) => {
    const state = getPlaybackState(track.id);
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
    return new Map(tracks.map((track) => [String(track.id), track]));
  }, [tracks]);

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

  return (
    <div className="app-shell">
      <div className="header">
        <h1>Rekordbox Flow Analyzer</h1>
        <p>Phase 1 shell: import XML, choose folders, inspect parsed tracks.</p>
        {getBuildTag() ? <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Build: {getBuildTag()}</p> : null}
      </div>

      <div className="card">
        {!xmlPath.trim() ? (
          <div className="onboarding">
            <h3>Getting Started</h3>
            <p>1. Click Browse XML and choose a Rekordbox export file.</p>
            <p>2. Click Parse Library.</p>
            <p>3. Filter folders, inspect tracks, and review validation issues.</p>
          </div>
        ) : null}
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
        {progress !== null && isParsing ? <p className="progress">Parsing in background: {progress}%</p> : null}
        {error ? <p style={{ color: '#be123c', margin: '8px 0 0' }}>{error}</p> : null}
        {summary ? (
          <div className="meta">
            <span>Tracks: {summary.trackCount}</span>
            <span>Playlists: {summary.playlistCount}</span>
            <span>Folders: {summary.folderCount}</span>
            <span>Selected Folders: {selectedFolders.length || 'All'}</span>
            <span>ANLZ Map: {anlzMapPath.trim() ? 'Configured' : 'Not set'}</span>
            {anlzAttachSummary ? <span>ANLZ Attached: {anlzAttachSummary.attached || 0}</span> : null}
            {anlzBuildSummary ? (
              <span>
                ANLZ Matched: {anlzBuildSummary.matchedTracks || 0}/{anlzBuildSummary.totalTracks || 0}
              </span>
            ) : null}
          </div>
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
            <h3 style={{ margin: 0 }}>Track Table ({sortedTracks.length}/{tracks.length})</h3>
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#334155' }}>Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={playbackVolume}
                onChange={(event) => setPlaybackVolume(Number(event.target.value))}
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
                {virtualRows.map((track) => (
                  <tr
                    key={track.id}
                    className={track.id === selectedTrackId ? 'selected-row' : ''}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    {visibleTrackColumns.play ? (
                      <td>
                        <div className="playback-cell">
                          <button
                            type="button"
                            className="playback-button"
                            onClick={() => togglePlayPause(track)}
                            disabled={getPlaybackState(track.id).loading}
                          >
                            {getPlaybackState(track.id).loading
                              ? 'Loading'
                              : getPlaybackState(track.id).status === 'playing'
                                ? 'Pause'
                                : 'Play'}
                          </button>
                          <span className="playback-time">
                            {formatClock(getPlaybackState(track.id).currentTime)}
                          </span>
                        </div>
                        {getPlaybackState(track.id).status === 'error' ? (
                          <div className="playback-error">{getPlaybackState(track.id).error}</div>
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
                          progress={getPlaybackState(track.id).duration
                            ? getPlaybackState(track.id).currentTime / getPlaybackState(track.id).duration
                            : 0}
                          isActive={getPlaybackState(track.id).status === 'playing'
                            || getPlaybackState(track.id).status === 'paused'}
                          onSeek={(event) => seekFromWaveform(track, event)}
                        />
                        {getPlaybackState(track.id).status === 'error' ? (
                          <div className="playback-error">{getPlaybackState(track.id).error}</div>
                        ) : null}
                      </td>
                    ) : null}
                    {visibleTrackColumns.genre ? <td>{track.genre || '-'}</td> : null}
                    {visibleTrackColumns.durationSeconds ? <td>{formatDuration(track.durationSeconds)}</td> : null}
                    {visibleTrackColumns.artist ? <td>{track.artist || '-'}</td> : null}
                    {visibleTrackColumns.playlists ? <td>{trackPlaylistIndex[track.id]?.length || 0}</td> : null}
                  </tr>
                ))}
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
            <div className="row" style={{ marginBottom: '8px' }}>
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
