---
phase: 03-playlist-generation
plan: 02
subsystem: api
tags: [clustering, confidence, camelot, flow-ordering, bpm]

requires:
  - phase: 03-playlist-generation
    plan: 01
    provides: cluster pipeline, basic confidence score

provides:
  - flow-ordered trackIds within clusters (BPM continuity + Camelot + waveform energy)
  - confidence model v2 with minScore penalty and variance penalty
  - per-cluster label (strong/good/mixed) and outlier warnings

affects: [03-03-playlist-suggestion-ui]

tech-stack:
  added: []
  patterns: [BPM window flow ordering, Camelot adjacency heuristic, confidence label thresholds]

key-files:
  created: []
  modified: [src/services/playlistClusteringService.js]

key-decisions:
  - "Confidence v2 penalises low minScore and high variance, boosts large high-avgScore clusters"
  - "Outlier warnings surface when a track's score deviates significantly from cluster average"
  - "Confidence label thresholds: strong ≥0.85, good ≥0.72, mixed below"

patterns-established:
  - "Flow ordering: prefer next track within ±3 BPM, then closest Camelot key"

duration: ~30min
completed: 2026-02-11
---

# Phase 03-02: Flow Ordering + Confidence Model Summary

**Cluster flow ordering improved with BPM/Camelot heuristic; confidence model v2 penalises variance and outliers, adds strong/good/mixed labels**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-02-11
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- BPM continuity + Camelot adjacency heuristic applied to re-order tracks within each cluster
- Confidence v2 penalises low `minScore` and high variance; boosts larger clusters with high `avgScore`
- Per-cluster label (strong / good / mixed) and optional outlier warning added

## Task Commits

1. **Playlist confidence scoring improvement** — `728fcc4`

## Files Created/Modified
- `src/services/playlistClusteringService.js` — Flow ordering + confidence v2 logic

## Decisions Made
- Confidence label thresholds kept conservative (strong ≥ 0.85) to avoid false confidence
- Outlier warning appears when a track scores below `minScore * 0.9`

## Deviations from Plan
None — plan executed as specified.

## Issues Encountered
None

## Next Phase Readiness
- Ordered clusters with labelled confidence ready for UI display (03-03)

---
*Phase: 03-playlist-generation*
*Completed: 2026-02-11*
