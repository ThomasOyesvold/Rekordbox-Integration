import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Loader2, Upload } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import './SetupWizard.css';

function toRecentLabel(row) {
  if (!row) {
    return '';
  }

  if (row.name) {
    return row.name;
  }

  const path = row.xmlPath || row.path || '';
  if (!path) {
    return '';
  }

  const normalized = String(path).replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

export function SetupWizard({ onFileSelect, isLoading, recentImports = [] }) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (file.name.endsWith('.xml')) {
        onFileSelect?.(file);
      }
    }
  };

  const handleFileInput = (event) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect?.(event.target.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="setup-wizard">
      <Card>
        <CardHeader>
          <div className="wizard-header">
            <Upload size={24} />
            <div>
              <h2 className="wizard-title">Get Started</h2>
              <p className="wizard-subtitle">
                Import your Rekordbox library to start analyzing tracks
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <motion.div
            className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            animate={dragActive ? { scale: 1.02 } : { scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {isLoading ? (
              <div className="drop-zone-loading">
                <Loader2 className="spinner" size={32} />
                <span>Parsing library...</span>
              </div>
            ) : (
              <>
                <FolderOpen size={48} className="drop-zone-icon" />
                <div className="drop-zone-text">
                  <span className="drop-zone-main">Drop XML file here</span>
                  <span className="drop-zone-sub">or</span>
                </div>
                <Button variant="primary" onClick={handleBrowseClick}>
                  Browse Computer
                </Button>
              </>
            )}
          </motion.div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          {recentImports.length > 0 ? (
            <div className="recent-imports">
              <h3 className="recent-title">Recent imports</h3>
              <div className="recent-list">
                {recentImports.map((importRow, idx) => (
                  <motion.div
                    key={importRow.id || importRow.xmlPath || idx}
                    className="recent-item"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onFileSelect?.(importRow)}
                  >
                    <FolderOpen size={16} />
                    <div className="recent-info">
                      <span className="recent-name">{toRecentLabel(importRow)}</span>
                      <span className="recent-meta">
                        {(importRow.trackCount || 0).toLocaleString()} tracks
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
