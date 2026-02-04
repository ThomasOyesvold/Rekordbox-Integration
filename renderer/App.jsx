import React, { useEffect, useMemo, useState } from 'react';

function useParseProgress() {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!window.rbfa?.onParseProgress) {
      return undefined;
    }

    const dispose = window.rbfa.onParseProgress((value) => {
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
  const [sortBy, setSortBy] = useState('artist');
  const [sortDirection, setSortDirection] = useState('asc');
  const [recentImports, setRecentImports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useParseProgress();

  useEffect(() => {
    if (!window.rbfa?.loadState) {
      return;
    }

    window.rbfa.loadState().then((state) => {
      if (state?.lastLibraryPath) {
        setXmlPath(state.lastLibraryPath);
      }

      if (Array.isArray(state?.selectedFolders)) {
        setSelectedFolders(state.selectedFolders);
      }
    }).catch(() => {
      // best-effort state load
    });

    window.rbfa.getRecentImports().then((rows) => {
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
    const picked = await window.rbfa.pickXmlFile();
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
      const result = await window.rbfa.parseLibrary(xmlPath.trim(), selectedFolders);
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

      await window.rbfa.saveState({
        lastLibraryPath: xmlPath.trim(),
        selectedFolders
      });
      const rows = await window.rbfa.getRecentImports();
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
    if (tracks.length < 2) {
      setError('Need at least 2 tracks to run baseline analysis.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    try {
      const result = await window.rbfa.runBaselineAnalysis(tracks, xmlPath.trim(), selectedFolders);
      setAnalysisResult(result);
    } catch (analysisError) {
      setError(analysisError.message || String(analysisError));
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  const toggleSort = (nextSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection('asc');
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
          <h3>Validation Issues ({validationIssues.length})</h3>
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
              {validationIssues.map((issue, index) => (
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
        </div>

        <div className="card">
          <h3>Track Table ({sortedTracks.length}/{tracks.length})</h3>
          <div className="row" style={{ marginBottom: '8px' }}>
            <input
              type="text"
              placeholder="Filter tracks by id, artist, title, genre, key..."
              value={trackQuery}
              onChange={(event) => setTrackQuery(event.target.value)}
            />
          </div>
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            <table className="track-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>
                    <button type="button" className="sort-button" onClick={() => toggleSort('artist')}>
                      Artist {sortBy === 'artist' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-button" onClick={() => toggleSort('title')}>
                      Title {sortBy === 'title' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-button" onClick={() => toggleSort('bpm')}>
                      BPM {sortBy === 'bpm' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-button" onClick={() => toggleSort('key')}>
                      Key {sortBy === 'key' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-button" onClick={() => toggleSort('genre')}>
                      Genre {sortBy === 'genre' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-button" onClick={() => toggleSort('durationSeconds')}>
                      Duration {sortBy === 'durationSeconds' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>Playlists</th>
                </tr>
              </thead>
              <tbody>
                {sortedTracks.slice(0, 1000).map((track) => (
                  <tr
                    key={track.id}
                    className={track.id === selectedTrackId ? 'selected-row' : ''}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    <td>{track.trackId || track.id}</td>
                    <td>{track.artist || '-'}</td>
                    <td>{track.title || '-'}</td>
                    <td>{track.bpm ?? '-'}</td>
                    <td>{track.key || '-'}</td>
                    <td>{track.genre || '-'}</td>
                    <td>{track.durationSeconds ?? '-'}</td>
                    <td>{trackPlaylistIndex[track.id]?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedTracks.length > 1000 ? <p>Showing first 1000 filtered tracks for responsiveness.</p> : null}
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
          <h3>Baseline Analysis</h3>
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
