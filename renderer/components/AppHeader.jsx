import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { IconButton } from './ui/Button';
import './AppHeader.css';

export function AppHeader({
  onSettingsClick,
  hasLibrary = false,
  isStale = false,
  isRefreshing = false,
  onRefresh
}) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 24 24" width="24" height="24">
            <path
              d="M3 12h4l3-9 4 18 3-9h4"
              stroke="url(#waveform-gradient)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="waveform-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#667eea" />
                <stop offset="100%" stopColor="#764ba2" />
              </linearGradient>
            </defs>
          </svg>
          <span className="logo-text">Rekordbox Flow Analyzer</span>
        </div>
      </div>
      <div className="header-right">
        {hasLibrary ? (
          <div className="header-library-status">
            {isStale ? (
              <div className="stale-indicator">
                <AlertTriangle size={14} />
                <span>Library may be outdated</span>
              </div>
            ) : null}
            <button
              type="button"
              className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Re-parse library for new tracks"
            >
              <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh Library</span>
            </button>
          </div>
        ) : null}
        <IconButton icon={<Settings size={20} />} onClick={onSettingsClick} aria-label="Settings" />
      </div>
    </header>
  );
}
