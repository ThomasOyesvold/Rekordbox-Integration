import { motion } from 'framer-motion';
import { Eye, Music, Play } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import './PlaylistCard.css';

export function PlaylistCard({ playlist, onSample, onViewDetails }) {
  const confidence = playlist?.confidence || 0;
  const confidenceLevel = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card hoverable className={`playlist-card confidence-${confidenceLevel}`}>
        <CardHeader>
          <div className="playlist-header">
            <div className="playlist-icon">
              <Music size={24} />
            </div>
            <div className="playlist-info">
              <h3 className="playlist-name">{playlist?.name || 'Unnamed Playlist'}</h3>
              <div className="playlist-stats">
                <span className="stat">
                  <Music size={14} />
                  <span>{playlist?.tracks?.length || 0} tracks</span>
                </span>
                {playlist?.bpmRange ? (
                  <span className="stat">
                    <span>{playlist.bpmRange.min}-{playlist.bpmRange.max} BPM</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className={`confidence-badge ${confidenceLevel}`}>
              <span>{Math.round(confidence)}%</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="playlist-preview">
            {playlist?.tracks?.slice(0, 3).map((track, i) => (
              <div key={track?.id || i} className="preview-track">
                <span className="preview-track-number">{i + 1}</span>
                <span className="preview-track-title">{track?.Name || track?.title || 'Unknown'}</span>
              </div>
            ))}
            {playlist?.tracks?.length > 3 ? (
              <div className="preview-more">
                +{playlist.tracks.length - 3} more tracks
              </div>
            ) : null}
          </div>
        </CardContent>

        <CardFooter>
          <div className="playlist-actions">
            <Button variant="secondary" icon={<Play size={16} />} onClick={() => onSample?.(playlist)}>
              Sample
            </Button>
            <Button variant="primary" icon={<Eye size={16} />} onClick={() => onViewDetails?.(playlist)}>
              View Details
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
