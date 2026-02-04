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

export function App() {
  const [xmlPath, setXmlPath] = useState('');
  const [folders, setFolders] = useState([]);
  const [folderTree, setFolderTree] = useState(null);
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [tracks, setTracks] = useState([]);
  const [summary, setSummary] = useState(null);
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

  const parse = async () => {
    if (!xmlPath.trim()) {
      setError('Choose an XML export first.');
      return;
    }

    setIsParsing(true);
    setError('');
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
      setSummary(result.summary || null);

      await window.rbfa.saveState({
        lastLibraryPath: xmlPath.trim(),
        selectedFolders
      });
    } catch (parseError) {
      setError(parseError.message || String(parseError));
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="header">
        <h1>Rekordbox Flow Analyzer</h1>
        <p>Phase 1 shell: import XML, choose folders, inspect parsed tracks.</p>
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
          <h3>Track Table ({tracks.length})</h3>
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            <table className="track-table">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Title</th>
                  <th>BPM</th>
                  <th>Key</th>
                  <th>Genre</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {tracks.slice(0, 1000).map((track) => (
                  <tr key={track.id}>
                    <td>{track.artist || '-'}</td>
                    <td>{track.title || '-'}</td>
                    <td>{track.bpm ?? '-'}</td>
                    <td>{track.key || '-'}</td>
                    <td>{track.genre || '-'}</td>
                    <td>{track.durationSeconds ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tracks.length > 1000 ? <p>Showing first 1000 tracks for responsiveness.</p> : null}
        </div>
      </div>
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
