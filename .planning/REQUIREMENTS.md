# Requirements: Rekordbox Flow Analyzer

**Defined:** 2026-02-04
**Core Value:** Correctly identify tracks that flow well together based on multi-factor analysis (waveform patterns, energy curves, BPM, key compatibility, and kick patterns), reducing set preparation time from hours to minutes while maintaining creative control.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation & Data Management

- [x] **FOUND-01**: Parse Rekordbox XML library files and extract track metadata ✅
- [x] **FOUND-02**: Validate XML structure and handle Rekordbox import bugs (special characters, malformed fields) ✅
- [x] **FOUND-03**: User can select specific folders from library to analyze (not forced to process all 12K tracks) ✅
- [x] **FOUND-04**: Display parsed track list with basic metadata (artist, title, BPM, key) ✅
- [ ] **FOUND-05**: Persist application state in SQLite database across sessions
- [x] **FOUND-06**: Background processing architecture prevents UI blocking during long operations ✅

### Analysis Engine

- [x] **ANLY-01**: Read BPM values from Rekordbox XML (use pre-analyzed data) ✅
- [x] **ANLY-02**: Read musical key values from Rekordbox XML (use pre-analyzed data) ✅
- [x] **ANLY-03**: Read waveform RGB data from Rekordbox XML ✅
- [x] **ANLY-04**: Implement BPM similarity analyzer (compatible BPM ranges for mixing) ✅
- [x] **ANLY-05**: Implement key compatibility analyzer (Camelot Wheel harmonic mixing) ✅
- [x] **ANLY-06**: Implement waveform pattern analyzer (energy curves, structure similarity) ✅
- [ ] **ANLY-07**: Implement rhythm pattern analyzer (kick patterns, rhythmic structure)
- [ ] **ANLY-08**: Multi-factor flow analysis combines all analyzers with equal weighting
- [x] **ANLY-09**: Cache similarity scores in SQLite to avoid reprocessing ✅
- [x] **ANLY-10**: Cache-first strategy: check cache before computing new similarities ✅
- [ ] **ANLY-11**: Batch processing with memory management for 12K+ track libraries

### Playlist Generation

- [ ] **PLAY-01**: Clustering algorithm groups similar tracks into playlists
- [ ] **PLAY-02**: Flow optimizer orders tracks within playlist for smooth transitions
- [ ] **PLAY-03**: Generate multiple playlist suggestions from analyzed folders
- [ ] **PLAY-04**: Conservative similarity thresholds (prefer false negatives over false positives)
- [ ] **PLAY-05**: Confidence scoring for each suggested grouping
- [ ] **PLAY-06**: Track similarity search: "find tracks like this one" feature

### Workflow & Verification

- [ ] **WORK-01**: Display suggested playlists with track lists and metadata
- [ ] **WORK-02**: Visualize waveforms for tracks in suggested playlist
- [ ] **WORK-03**: Random sampling playback (play 10-20 random tracks from suggestion)
- [x] **WORK-04**: Audio playback supports MP3, FLAC, WAV, AAC formats ✅
- [ ] **WORK-05**: Approve/reject workflow for each playlist suggestion
- [ ] **WORK-06**: User can name approved playlists based on perceived vibe
- [ ] **WORK-07**: Transparent explanations show why tracks were grouped together
- [ ] **WORK-08**: Incremental analysis: suggest additions to existing saved playlists when analyzing new folders

### Export & Integration

- [ ] **EXPO-01**: Export approved playlists as M3U files
- [ ] **EXPO-02**: Handle relative and absolute file paths in M3U export
- [ ] **EXPO-03**: Sanitize special characters in paths for cross-platform compatibility
- [ ] **EXPO-04**: Persist approved playlists in SQLite across sessions
- [ ] **EXPO-05**: Display saved playlists with option to re-export or modify

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Analysis

- **ANLY-12**: Energy level detection (1-10 scale) using AI-powered analysis
- **ANLY-13**: Energy flow visualization across playlist timeline
- **ANLY-14**: Mood/emotion analysis using machine learning models

### Advanced Workflow

- **WORK-09**: Track-level editing: remove specific tracks from suggestions
- **WORK-10**: Regenerate suggestions with different similarity thresholds
- **WORK-11**: Merge multiple suggested playlists
- **WORK-12**: Smart playlists with dynamic rules (e.g., "all deep techno 125-130 BPM")

### Integration

- **EXPO-06**: Direct Rekordbox database write (create playlists in Rekordbox automatically)
- **EXPO-07**: Bidirectional sync with Rekordbox (detect external changes)
- **EXPO-08**: Export to other DJ software formats (Serato, Traktor)

### Platform

- **PLAT-01**: Mac support (cross-platform Electron build)
- **PLAT-02**: Linux support

### Advanced Features

- **FEAT-01**: Duplicate track detection and library cleanup
- **FEAT-02**: Track search and filter across entire library
- **FEAT-03**: Cue point visualization
- **FEAT-04**: Hot cue management

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automatic mixing without approval | Removes DJ creative control; research shows DJs don't trust fully automated mixing |
| Real-time/live performance features | Tool is for preparation, not live use; different product category |
| Streaming service integration (Spotify, Apple Music) | API restrictions, licensing nightmares, copyright issues |
| Social features / community playlist sharing | Scope creep, copyright issues, infrastructure complexity |
| Automatic genre classification | Genre is subjective; AI classification often wrong and frustrating to DJs |
| Re-analysis of audio files | Rekordbox already analyzed everything; re-analysis is redundant and slow |
| Stem-aware analysis | Requires stem separation integration; extremely CPU intensive for 12K tracks |
| Cloud library sync | Infrastructure complexity; local-first is simpler and faster |
| Timeline-based mix editor | Massive scope; different product category (DJ.Studio territory) |
| In-app full DJ features (mixing, effects, recording) | Not a DJ performance tool; stay focused on library organization |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Done |
| FOUND-02 | Phase 1 | Done |
| FOUND-03 | Phase 1 | Done |
| FOUND-04 | Phase 1 | Done |
| FOUND-05 | Phase 1 | Not started (state currently stored in JSON + SQLite for history) |
| FOUND-06 | Phase 1 | Done |
| ANLY-01 | Phase 2 | Done |
| ANLY-02 | Phase 2 | Done |
| ANLY-03 | Phase 2 | Done (implemented via ANLZ EXT waveform extraction) |
| ANLY-04 | Phase 2 | Done |
| ANLY-05 | Phase 2 | Done |
| ANLY-06 | Phase 2 | Done (ANLZ waveform summaries) |
| ANLY-07 | Phase 2 | Not started (kick-pattern-specific rhythm analysis pending) |
| ANLY-08 | Phase 2 | Not started (weights not equal yet) |
| ANLY-09 | Phase 2 | Done |
| ANLY-10 | Phase 2 | Done |
| ANLY-11 | Phase 2 | Deferred |
| PLAY-01 | Phase 3 | Not started |
| PLAY-02 | Phase 3 | Not started |
| PLAY-03 | Phase 3 | Not started |
| PLAY-04 | Phase 3 | Not started |
| PLAY-05 | Phase 3 | Not started |
| PLAY-06 | Phase 3 | Not started |
| WORK-01 | Phase 4 | Not started |
| WORK-02 | Phase 4 | Not started |
| WORK-03 | Phase 4 | Not started |
| WORK-04 | Phase 4 | Done (file playback + formats via Electron/audio tag) |
| WORK-05 | Phase 5 | Not started |
| WORK-06 | Phase 5 | Not started |
| WORK-07 | Phase 5 | Not started |
| WORK-08 | Phase 5 | Not started |
| EXPO-01 | Phase 6 | Not started |
| EXPO-02 | Phase 6 | Not started |
| EXPO-03 | Phase 6 | Not started |
| EXPO-04 | Phase 6 | Not started |
| EXPO-05 | Phase 6 | Not started |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 33 ⚠️

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04 after initial definition*
