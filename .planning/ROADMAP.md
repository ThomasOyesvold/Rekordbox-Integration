# Roadmap: Rekordbox Flow Analyzer

## Overview

This roadmap transforms a 12,000+ track DJ library from overwhelming chaos into intelligently organized playlists through multi-factor flow analysis. Six phases build from foundation (XML parsing, data persistence) through analysis engine (BPM, key, waveform, rhythm) to playlist generation, verification workflow, and M3U export. Each phase addresses specific pitfalls identified in research: Rekordbox XML bugs, false positive explosion, memory leaks, and UI blocking. The tool maintains DJ creative control through approve/reject workflow while reducing set preparation time from hours to minutes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Data Layer** - Parse Rekordbox XML, establish persistence, enable folder selection
- [ ] **Phase 2: Analysis Engine & Caching** - Multi-factor similarity analysis with aggressive caching
- [ ] **Phase 3: Playlist Generation** - Cluster tracks and optimize flow for cohesive playlists
- [ ] **Phase 4: Verification Workflow & Playback** - Visualize waveforms and sample audio for verification
- [ ] **Phase 5: Approval & User Control** - Approve/reject workflow with transparent explanations
- [ ] **Phase 6: Export & Integration** - Export approved playlists as M3U files for DJ software

## Phase Details

### Phase 1: Foundation & Data Layer
**Goal**: User can load Rekordbox library, select folders to analyze, and see parsed tracks without UI freezing during long operations
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):
  1. User can import Rekordbox XML library file and see success/error feedback with specific validation messages
  2. User can select specific folders from library hierarchy (not forced to analyze all 12K tracks at once)
  3. User can view parsed track list showing artist, title, BPM, key, and other metadata in responsive UI
  4. Application persists state across sessions (selected folders, imported library path remembered)
  5. Long operations (XML parsing, folder loading) run in background with detailed progress feedback and never freeze the UI
**Plans**:

Plans:
- [x] Build Electron shell + React renderer with secure preload bridge
- [x] Parse Rekordbox XML in background worker with progress events
- [x] Implement folder-tree filtering and track table inspection
- [x] Persist app state and import history (JSON + SQLite)
- [x] Add structured validation issue reporting
- [x] Complete manual QA checklist items (dialog behavior, folder-scope reparse confirmation)

### Phase 2: Analysis Engine & Caching
**Goal**: System can compute multi-factor similarity scores between tracks and cache results to avoid reprocessing 12K+ track libraries
**Depends on**: Phase 1
**Requirements**: ANLY-01, ANLY-02, ANLY-03, ANLY-04, ANLY-05, ANLY-06, ANLY-07, ANLY-08, ANLY-09, ANLY-10, ANLY-11
**Success Criteria** (what must be TRUE):
  1. System extracts BPM, key, and waveform RGB data from Rekordbox XML (uses pre-analyzed Rekordbox data, no re-analysis)
  2. System computes BPM similarity (compatible mixing ranges), key compatibility (Camelot Wheel harmonic mixing), waveform pattern similarity (energy curves), and rhythm pattern similarity (kick patterns)
  3. System combines all analyzers with equal weighting into multi-factor flow score for any track pair
  4. System persists similarity scores in SQLite cache and checks cache before computing new scores (cache-first strategy)
  5. System processes large libraries (12K+ tracks) in batches with memory management (no crashes, no memory leaks)
**Plans**:

Plans:
- [x] Implement baseline multi-factor scoring (BPM, key, waveform proxy, rhythm proxy)
- [x] Persist similarity cache and analysis runs in SQLite
- [x] Add analysis results UI table with score components and reasons
- [x] Add CSV/JSON analysis export
- [ ] Replace placeholder waveform/rhythm proxies with full Rekordbox waveform data extraction
- [ ] Add batch/memory safeguards and long-run stress tests for 12K+ libraries

### Phase 3: Playlist Generation
**Goal**: System generates multiple cohesive playlist suggestions from analyzed tracks with confidence scoring and transparent reasoning
**Depends on**: Phase 2
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06
**Success Criteria** (what must be TRUE):
  1. System clusters similar tracks into playlist groups using conservative similarity thresholds (prefers false negatives over false positives)
  2. System orders tracks within each playlist for smooth flow (optimized transitions based on BPM, key, energy)
  3. System generates multiple playlist suggestions from analyzed folders (not just one)
  4. Each suggested playlist shows confidence score indicating grouping quality
  5. User can search "find tracks like this one" for any track and see similarity-ranked results
**Plans**: TBD

Plans:
- [ ] TBD (planned during phase planning)

### Phase 4: Verification Workflow & Playback
**Goal**: User can visually and aurally verify suggested playlists through waveform visualization and random sampling playback before approval
**Depends on**: Phase 3
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04
**Success Criteria** (what must be TRUE):
  1. User can view suggested playlists with complete track lists showing all metadata
  2. User can see waveform visualizations for tracks in suggested playlist (RGB energy patterns)
  3. User can play random sampling (10-20 random tracks) from any suggested playlist to verify vibe without listening to all tracks
  4. Audio playback supports common DJ formats (MP3, FLAC, WAV, AAC) with responsive controls
**Plans**: TBD

Plans:
- [ ] TBD (planned during phase planning)

### Phase 5: Approval & User Control
**Goal**: User can approve or reject suggested playlists with meaningful names and understand why tracks were grouped together
**Depends on**: Phase 4
**Requirements**: WORK-05, WORK-06, WORK-07, WORK-08
**Success Criteria** (what must be TRUE):
  1. User can approve or reject each suggested playlist independently
  2. User can name approved playlists based on perceived vibe (e.g., "Deep Techno 125-128", "Melodic Progressive")
  3. User can see transparent explanations for why tracks were grouped (BPM range, key compatibility, waveform similarity scores)
  4. When analyzing new folders, system suggests additions to existing saved playlists (incremental analysis, not full re-analysis)
**Plans**: TBD

Plans:
- [ ] TBD (planned during phase planning)

### Phase 6: Export & Integration
**Goal**: User can export approved playlists as M3U files that load correctly in Rekordbox and other DJ software
**Depends on**: Phase 5
**Requirements**: EXPO-01, EXPO-02, EXPO-03, EXPO-04, EXPO-05
**Success Criteria** (what must be TRUE):
  1. User can export approved playlists as M3U files with relative or absolute file path options
  2. M3U exports handle special characters in file paths correctly (cross-platform compatibility)
  3. Approved playlists persist in SQLite across sessions (user can view saved playlists anytime)
  4. User can re-export or view details of previously saved playlists
  5. Exported M3U files load correctly in Rekordbox, Serato, and Traktor without errors
**Plans**: TBD

Plans:
- [ ] TBD (planned during phase planning)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Data Layer | 6/6 | Completed | Background parse, folder filter, persistence, validation UI, table UX |
| 2. Analysis Engine & Caching | 4/6 | In progress | Baseline analyzer, SQLite cache, export, analysis UI |
| 3. Playlist Generation | 0/TBD | Not started | - |
| 4. Verification Workflow & Playback | 0/TBD | Not started | - |
| 5. Approval & User Control | 0/TBD | Not started | - |
| 6. Export & Integration | 0/TBD | Not started | - |
