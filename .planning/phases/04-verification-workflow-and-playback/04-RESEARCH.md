# Phase 4: Verification Workflow & Playback - Research

**Researched:** 2026-02-05
**Domain:** Audio playback, waveform visualization, playlist verification UI
**Confidence:** HIGH

## Summary

This phase builds on existing audio playback infrastructure (already implemented with WSL path resolution and file verification) and adds visual verification capabilities for suggested playlists. The standard approach combines HTML5 Audio elements for playback with Canvas-based waveform visualization using established libraries like WaveSurfer.js. For large playlist handling, React virtualization libraries (react-window or react-virtualized) ensure performant rendering of track lists.

The existing codebase already has:
- Complete audio playback with HTML5 Audio elements
- WSL/Windows path resolution with comprehensive debugging
- File verification (exists, readable) via Electron IPC
- Mini waveform visualization from ANLZ data
- Track metadata display with filtering/sorting

What needs to be added:
- Suggested playlist view/management
- Full waveform visualization (interactive seeking)
- Random sampling workflow (select N random tracks, play through them)
- Enhanced format detection and error messaging

**Primary recommendation:** Build playlist verification UI using existing audio infrastructure, add @wavesurfer/react for full interactive waveforms, implement random sampling with client-side track selection, leverage existing track table virtualization patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 Audio | Built-in | Audio playback | Guaranteed support in Electron/Chromium, efficient for simple playback, lower memory than Web Audio API |
| @wavesurfer/react | 1.x (latest) | Interactive waveform visualization | Official React wrapper for wavesurfer.js, handles React lifecycle properly, widely used for audio visualization |
| React (existing) | 18.3.1 | UI framework | Already in project, provides efficient state management for playback state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-window | 1.x | Virtualized list rendering | When rendering large playlists (100+ tracks) for performance |
| Canvas API | Built-in | Waveform rendering | Used internally by WaveSurfer.js, already in use for mini waveforms |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML5 Audio | Web Audio API | Web Audio API has more power for effects but worse memory/performance for basic playback, overkill for this use case |
| @wavesurfer/react | react-audio-visualize | WaveSurfer.js is more mature, better docs, larger community, better seeking interaction |
| react-window | react-virtualized | react-window is lighter/modern, react-virtualized is heavier but more features (already have sorting/filtering) |

**Installation:**
```bash
npm install wavesurfer.js @wavesurfer/react
# Optional for very large playlists (500+):
npm install react-window
```

## Architecture Patterns

### Recommended Project Structure
```
renderer/
├── components/           # New UI components
│   ├── PlaylistView.jsx       # Suggested playlist display
│   ├── WaveformPlayer.jsx     # Full interactive waveform
│   ├── RandomSampler.jsx      # Random sampling controls
│   └── TrackVerification.jsx  # File status indicators
└── App.jsx              # Main app (existing playback infrastructure)
```

### Pattern 1: Centralized Audio State Management
**What:** Single audio registry with playback state stored in React state, accessed via refs for audio elements
**When to use:** Already implemented in App.jsx - continue this pattern
**Example:**
```typescript
// Source: Existing implementation in App.jsx lines 401-406
const audioRegistryRef = useRef(new Map()); // trackId -> { audio, cleanup }
const [playbackStates, setPlaybackStates] = useState({}); // trackId -> { status, currentTime, duration, error }
const [activeTrackId, setActiveTrackId] = useState(null);

// Centralized state update
const updatePlaybackState = (trackId, patch) => {
  setPlaybackStates((current) => ({
    ...current,
    [trackId]: {
      ...(current[trackId] || { status: 'idle', currentTime: 0, duration: 0 }),
      ...patch
    }
  }));
};
```

### Pattern 2: Plugin Array Memoization for WaveSurfer.js
**What:** WaveSurfer.js mutates plugin instances during initialization, requiring memoization
**When to use:** Any WaveSurfer.js component with plugins
**Example:**
```typescript
// Source: https://github.com/katspaugh/wavesurfer-react
import { useMemo } from 'react';
import WavesurferPlayer from '@wavesurfer/react';

// CRITICAL: Plugins must be memoized or defined outside component
const plugins = useMemo(() => [
  TimelinePlugin.create({ container: '#timeline' }),
  RegionsPlugin.create()
], []);

<WavesurferPlayer
  url={audioUrl}
  plugins={plugins}
  onReady={onReady}
/>
```

### Pattern 3: Random Sampling with Fisher-Yates Shuffle
**What:** Client-side random track selection without modifying original playlist
**When to use:** "Play 10-20 random tracks" feature
**Example:**
```typescript
// Source: Standard algorithm for unbiased sampling
function selectRandomTracks(tracks, count) {
  const shuffled = [...tracks]; // Copy to avoid mutation
  let currentIndex = shuffled.length;

  // Fisher-Yates shuffle
  while (currentIndex > 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] =
      [shuffled[randomIndex], shuffled[currentIndex]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}
```

### Pattern 4: Pre-Flight File Verification
**What:** Verify file accessibility before attempting playback
**When to use:** Already implemented - continue for suggested playlists
**Example:**
```typescript
// Source: Existing implementation in App.jsx lines 913-971
const bridgeApi = getBridgeApi();
if (bridgeApi?.resolveAudioPath) {
  const pathInfo = await bridgeApi.resolveAudioPath(fileUrl);

  if (!pathInfo.exists) {
    updatePlaybackState(track.id, {
      status: 'error',
      error: `File not found: ${pathInfo.fsPath}`
    });
    return;
  }

  if (!pathInfo.readable) {
    updatePlaybackState(track.id, {
      status: 'error',
      error: `Permission denied: ${pathInfo.fsPath}`
    });
    return;
  }
}
```

### Anti-Patterns to Avoid
- **Creating new Audio elements on every render:** Causes memory leaks and duplicate event listeners. Use refs to persist audio elements across renders.
- **Passing non-memoized plugin arrays to WaveSurfer.js:** Causes re-initialization and errors. Always memoize plugins array.
- **Polling audio.currentTime with setInterval:** Use 'timeupdate' event listener instead for better performance.
- **Direct file:// URLs without verification:** Can fail silently on WSL/Windows. Always use normalizeAudioLocation() + bridge verification.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waveform visualization | Custom Canvas drawing with Web Audio API | @wavesurfer/react + wavesurfer.js | Handles zoom, seeking, regions, peaks caching, responsive resizing, multiple formats |
| Audio seeking UI | Custom progress bar + click handlers | WaveSurfer.js waveform (built-in seeking) | Handles precise pixel-to-time mapping, drag seeking, keyboard shortcuts |
| Random sampling algorithm | Simple Math.random() in loop | Fisher-Yates shuffle | Unbiased selection, avoids duplicates, O(n) performance |
| Large list rendering | map() over all tracks | react-window or built-in virtualization | Existing App.jsx already has virtualization (lines 1200-1500), extend for playlist view |
| File format detection | Custom MIME sniffing | HTML5 Audio error codes + file extension | MediaError code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) reliably detects unsupported formats |
| Audio metadata parsing | Custom binary parsing | HTML5 Audio.duration after loadedmetadata | Browser handles all format parsing (MP3, FLAC, WAV, AAC) automatically |

**Key insight:** Audio playback infrastructure is mature in browsers. The main challenge is path resolution (already solved in Phase 4 pre-work) and state management, not core playback.

## Common Pitfalls

### Pitfall 1: WaveSurfer.js Plugin Array Mutation
**What goes wrong:** React re-renders cause "Cannot create plugin twice" errors, playback breaks
**Why it happens:** WaveSurfer.js mutates plugin instances during initialization. Passing new array on each render re-initializes plugins.
**How to avoid:** Memoize plugins array with useMemo() or define outside component
**Warning signs:** Console errors about duplicate plugins, waveform not rendering on second load

### Pitfall 2: HTML5 Audio Format Support Assumptions
**What goes wrong:** Assuming browser supports all formats, playback fails silently or with generic error
**Why it happens:** Chromium/Electron format support depends on OS codecs. FLAC support varies by OS.
**How to avoid:**
- Test canPlayType() for critical formats
- Handle MediaError code 3 (MEDIA_ERR_DECODE) and code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) with format-specific messages
- Document supported formats in UI
**Warning signs:** Some files play, others fail with "format not supported" despite being same extension

### Pitfall 3: WSL Path Resolution Edge Cases
**What goes wrong:** Audio plays in development but fails on specific drive letters or special characters
**Why it happens:** Case sensitivity (WSL vs Windows), URI encoding mismatches, drive letter mapping
**How to avoid:** Already solved in existing implementation (normalizeAudioLocation + resolveAudioPath bridge). Continue using this pattern for all audio file access.
**Warning signs:** Files on C: drive work, D: drive fails; paths with spaces/special chars fail

### Pitfall 4: Memory Leaks from Audio Elements
**What goes wrong:** Browser memory increases over time, app becomes sluggish
**Why it happens:** Audio elements not properly cleaned up, event listeners not removed
**How to avoid:** Store cleanup functions in audioRegistryRef, call on unmount/stop. Existing implementation has this (lines 854-875).
**Warning signs:** DevTools shows increasing DOM node count, memory profiler shows retained Audio objects

### Pitfall 5: Playback State Synchronization
**What goes wrong:** UI shows "playing" but audio is paused, seek position jumps
**Why it happens:** Race conditions between playback commands, async audio.play() returning promise
**How to avoid:** Use request ID pattern (existing: playRequestIdRef) to cancel stale playback requests
**Warning signs:** Clicking play rapidly causes multiple tracks to play, seek bar jumps erratically

## Code Examples

Verified patterns from official sources:

### WaveSurfer.js React Integration (Full Interactive Waveform)
```typescript
// Source: https://github.com/katspaugh/wavesurfer-react
import { useState, useRef } from 'react';
import { useWavesurfer } from '@wavesurfer/react';

function WaveformPlayer({ track, onSeek }) {
  const containerRef = useRef(null);
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    url: track.fileUrl,
    waveColor: 'rgb(0, 170, 255)',
    progressColor: 'rgb(0, 100, 200)',
    height: 128,
    normalize: true,
    barWidth: 2,
    barGap: 1,
    barRadius: 2
  });

  const handlePlayPause = () => {
    wavesurfer?.playPause();
  };

  const handleSeek = (e) => {
    if (!wavesurfer) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const percent = x / bounds.width;
    wavesurfer.seekTo(percent);
    onSeek?.(percent * wavesurfer.getDuration());
  };

  return (
    <div>
      <div ref={containerRef} onClick={handleSeek} />
      <button onClick={handlePlayPause}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <span>{currentTime.toFixed(1)}s</span>
    </div>
  );
}
```

### MediaError Code Detection
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code
// Already implemented in App.jsx lines 819-852

const onError = () => {
  const mediaError = audio.error;
  const errorCode = mediaError?.code;
  let errorMsg = 'Audio unavailable or failed to load';

  // Map MediaError codes to user-friendly messages
  if (errorCode === 1) { // MEDIA_ERR_ABORTED
    errorMsg = 'Audio loading aborted';
  } else if (errorCode === 2) { // MEDIA_ERR_NETWORK
    errorMsg = 'Network error loading audio';
  } else if (errorCode === 3) { // MEDIA_ERR_DECODE
    errorMsg = 'Audio format not supported or file corrupted';
  } else if (errorCode === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
    errorMsg = 'Audio source not found or not accessible';
  }

  updatePlaybackState(trackId, {
    status: 'error',
    error: errorMsg
  });

  console.error('[rbfa] audio error', {
    trackId,
    mediaError: { code: errorCode, message: mediaError?.message }
  });
};
```

### Random Track Sampling
```typescript
// Source: Fisher-Yates shuffle algorithm (standard)
function RandomSampler({ playlist, onSampleReady }) {
  const [sampleSize, setSampleSize] = useState(15);
  const [sampledTracks, setSampledTracks] = useState([]);

  const generateSample = () => {
    const tracks = [...playlist.tracks];
    let currentIndex = tracks.length;

    // Fisher-Yates shuffle
    while (currentIndex > 0) {
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [tracks[currentIndex], tracks[randomIndex]] =
        [tracks[randomIndex], tracks[currentIndex]];
    }

    const sample = tracks.slice(0, Math.min(sampleSize, tracks.length));
    setSampledTracks(sample);
    onSampleReady(sample);
  };

  return (
    <div>
      <label>
        Sample size:
        <input
          type="number"
          min="5"
          max="50"
          value={sampleSize}
          onChange={(e) => setSampleSize(Number(e.target.value))}
        />
      </label>
      <button onClick={generateSample}>
        Generate Random Sample ({sampleSize} tracks)
      </button>
      {sampledTracks.length > 0 && (
        <p>{sampledTracks.length} tracks sampled</p>
      )}
    </div>
  );
}
```

### Format Support Detection
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio
const audio = new Audio();

const formatSupport = {
  mp3: audio.canPlayType('audio/mpeg') !== '',
  flac: audio.canPlayType('audio/flac') !== '',
  wav: audio.canPlayType('audio/wav') !== '',
  aac: audio.canPlayType('audio/aac') !== '' ||
       audio.canPlayType('audio/mp4') !== '' // AAC often in MP4 container
};

// Display format support in UI
function FormatSupport() {
  return (
    <div>
      <h3>Supported Formats</h3>
      <ul>
        <li>MP3: {formatSupport.mp3 ? '✓' : '✗'}</li>
        <li>FLAC: {formatSupport.flac ? '✓' : '✗'}</li>
        <li>WAV: {formatSupport.wav ? '✓' : '✗'}</li>
        <li>AAC: {formatSupport.aac ? '✓' : '✗'}</li>
      </ul>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Web Audio API for playback | HTML5 Audio for simple playback | ~2020 | Better memory/performance, simpler code. Use Web Audio API only for effects/analysis. |
| Custom waveform rendering | WaveSurfer.js library | 2015-present | Mature library with seeking, zoom, plugins. Don't reinvent. |
| react-wavesurfer (unmaintained) | @wavesurfer/react (official) | 2023+ | Official wrapper, better React 18+ support, maintained by core team. |
| jQuery audio players | React hooks-based players | 2018+ | Better performance, no jQuery dependency, hooks for state. |
| Polling audio.currentTime | 'timeupdate' event | Always preferred | Event-driven more efficient than polling. |
| file:// URLs directly | Custom protocols or IPC verification | Electron 5+ security | Sandbox restrictions require verification or custom protocols. Already implemented via bridge API. |

**Deprecated/outdated:**
- **react-wavesurfer (mspae):** Unmaintained since 2019, use @wavesurfer/react instead
- **Web Audio API for basic playback:** Overkill, use HTML5 Audio for player use cases
- **wavesurfer.js v6:** Use v7+ for better React integration and performance

## Open Questions

Things that couldn't be fully resolved:

1. **FLAC format support consistency across platforms**
   - What we know: Chromium FLAC support depends on OS codecs. Windows/Linux usually support FLAC, macOS may require additional codecs.
   - What's unclear: Exact codec availability in production Windows environment after packaging with Electron
   - Recommendation: Test FLAC playback in production build early. Fall back to showing "format not supported" error with MediaError code 3. Document FLAC as "best-effort" support in UI.

2. **Custom rbfa:// protocol necessity**
   - What we know: Current implementation uses file:// URLs with bridge verification, works in WSL development. STATE.md notes "Audio playback in Windows production may need custom protocol handler (rbfa://)"
   - What's unclear: Whether Electron sandbox in production Windows build will block file:// URLs even with verification
   - Recommendation: Test production build audio playback early. If file:// fails, implement custom protocol handler as documented in AUDIO_FIX_IMPLEMENTATION.md lines 244-270. Keep current implementation until proven necessary.

3. **Optimal sample size for playlist verification**
   - What we know: Requirements specify "10-20 random tracks", which is reasonable for ~50-200 track playlists
   - What's unclear: Whether users prefer fixed count or percentage of playlist (e.g., 10% of tracks)
   - Recommendation: Start with configurable count (10-20 default range), add percentage option if user feedback requests it. Log sample size usage for analytics.

## Sources

### Primary (HIGH confidence)
- MDN MediaError documentation - https://developer.mozilla.org/en-US/docs/Web/API/MediaError
- MDN MediaError.code constants - https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code
- @wavesurfer/react GitHub README - https://github.com/katspaugh/wavesurfer-react
- Electron Process Sandboxing docs - https://www.electronjs.org/docs/latest/tutorial/sandbox
- Electron Security docs - https://www.electronjs.org/docs/latest/tutorial/security

### Secondary (MEDIUM confidence)
- Chrome Developers: HTML5 audio and Web Audio API - https://developer.chrome.com/blog/html5-audio-and-the-web-audio-api-are-bffs
- WaveSurfer.js v7 migration discussion - https://github.com/katspaugh/wavesurfer.js/discussions/2762
- Existing implementation: App.jsx (audio playback), anlzWaveformService.js (waveform data)
- AUDIO_FIX_IMPLEMENTATION.md - WSL path resolution documentation

### Tertiary (LOW confidence)
- Music player UI design trends - https://pixso.net/tips/music-player-ui/
- React virtualization performance - Various Medium articles (need verification with actual benchmarks)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - HTML5 Audio and WaveSurfer.js are established, widely-used solutions
- Architecture: HIGH - Existing implementation demonstrates working patterns, WaveSurfer.js docs are comprehensive
- Pitfalls: HIGH - Based on official docs (MediaError codes, plugin memoization warning) and existing implementation experience (WSL paths, memory leaks)

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain)
