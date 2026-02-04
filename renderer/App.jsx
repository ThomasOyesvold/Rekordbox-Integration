import React, { useEffect, useMemo, useRef, useState } from 'react';

const DESKTOP_BRIDGE_ERROR = 'Desktop bridge unavailable. Relaunch from Electron (not browser-only mode).';
const TRACK_COLUMN_ORDER = ['id', 'title', 'bpm', 'key', 'genre', 'durationSeconds', 'artist', 'playlists'];
const TRACK_COLUMN_WIDTHS = {
  id: 110,
  title: 380,
  bpm: 84,
  key: 80,
  genre: 130,
  durationSeconds: 96,
  artist: 220,
  playlists: 84
};
const PAGE_SIZE_OPTIONS = [50, 100, 250, 500];
const TABLE_VIEWPORT_HEIGHT = 500;
const VIRTUAL_OVERSCAN_ROWS = 8;
const TRACK_COLUMN_LABELS = {
  id: 'ID',
  title: 'Title',
  bpm: 'BPM',
  key: 'Key',
  genre: 'Genre',
  durationSeconds: 'Duration',
  artist: 'Artist',
  playlists: 'Playlists'
};
const DEFAULT_VISIBLE_TRACK_COLUMNS = {
  id: true,
  title: true,
  bpm: true,
  key: true,
  genre: true,
  durationSeconds: true,
  artist: true,
  playlists: true
};

function getBridgeApi() {
  return window.rbfa || window.electron?.rbfa || null;
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
  const [validationIssues, setValidationIssues] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [issueSeverityFilter, setIssueSeverityFilter] = useState('all');
  const [error, setError] = useState('');
  const [progress, setProgress] = useParseProgress();
  const trackFilterInputRef = useRef(null);
  const tableViewportRef = useRef(null);

  useEffect(() => {
    const bridgeApi = getBridgeApi();
    if (!bridgeApi?.loadState) {
      return;
    }

    bridgeApi.loadState().then((state) => {
      if (state?.lastLibraryPath) {
        setXmlPath(state.lastLibraryPath);
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

  const applyRecentImport = (row) => {
    setXmlPath(row.xmlPath || '');
    setSelectedFolders(Array.isArray(row.selectedFolders) ? row.selectedFolders : []);
    setError('Loaded import settings from history. Click Parse Library to reload.');
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
    setProgress(0);

    try {
      const result = await bridgeApi.parseLibrary(xmlPath.trim(), selectedFolders);
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
      setValidationIssues(Array.isArray(result.validation?.issues) ? result.validation.issues : []);
      setAnalysisResult(null);

      await bridgeApi.saveState({
        lastLibraryPath: xmlPath.trim(),
        selectedFolders
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

  const sortedTracks = useMemo(() => {
    const values = [...visibleTracks];
    const factor = sortDirection === 'asc' ? 1 : -1;

    values.sort((a, b) => {
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
        {progress !== null && isParsing ? <p className="progress">Parsing in background: {progress}%</p> : null}
        {error ? <p style={{ color: '#be123c', margin: '8px 0 0' }}>{error}</p> : null}
        {summary ? (
          <div className="meta">
            <span>Tracks: {summary.trackCount}</span>
            <span>Playlists: {summary.playlistCount}</span>
            <span>Folders: {summary.folderCount}</span>
            <span>Selected Folders: {selectedFolders.length || 'All'}</span>
          </div>
        ) : null}
      </div>

      {validationIssues.length > 0 ? (
        <div className="card">
          <h3>Validation Issues ({filteredIssues.length}/{validationIssues.length})</h3>
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
        </div>
      ) : null}

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
          <h3>Track Table ({sortedTracks.length}/{tracks.length})</h3>
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
                {visibleTrackColumns.id ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.id}px` }} /> : null}
                {visibleTrackColumns.title ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.title}px` }} /> : null}
                {visibleTrackColumns.bpm ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.bpm}px` }} /> : null}
                {visibleTrackColumns.key ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.key}px` }} /> : null}
                {visibleTrackColumns.genre ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.genre}px` }} /> : null}
                {visibleTrackColumns.durationSeconds ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.durationSeconds}px` }} /> : null}
                {visibleTrackColumns.artist ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.artist}px` }} /> : null}
                {visibleTrackColumns.playlists ? <col style={{ width: `${TRACK_COLUMN_WIDTHS.playlists}px` }} /> : null}
              </colgroup>
              <thead>
                <tr>
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
                    {visibleTrackColumns.id ? <td>{track.trackId || track.id}</td> : null}
                    {visibleTrackColumns.title ? <td>{track.title || '-'}</td> : null}
                    {visibleTrackColumns.bpm ? <td>{track.bpm ?? '-'}</td> : null}
                    {visibleTrackColumns.key ? <td>{track.key || '-'}</td> : null}
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
            <div className="meta">
              <span>ID: {selectedTrack.trackId || selectedTrack.id}</span>
              <span>Artist: {selectedTrack.artist || '-'}</span>
              <span>Title: {selectedTrack.title || '-'}</span>
              <span>BPM: {selectedTrack.bpm ?? '-'}</span>
              <span>Key: {selectedTrack.key || '-'}</span>
            </div>
            <p style={{ marginTop: '8px' }}>
              Location: {selectedTrack.location || '-'}
            </p>
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
          </div>
        ) : null}
      </div>

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
