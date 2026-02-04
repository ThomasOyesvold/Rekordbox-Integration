# nested-metadata-scoring-2026-02-04

- Why: improve Phase 2 scoring fidelity by using parsed nested Rekordbox metadata.

## Files Changed

- `src/services/baselineAnalyzerService.js`
- `test/baselineAnalyzerService.test.js`

## Summary

- Waveform scoring now blends legacy metadata with nested position-mark similarity.
- Rhythm scoring now blends legacy rhythm heuristics with nested tempo-map similarity.
- Added tests showing nested-similar tracks score higher than nested-dissimilar tracks.

## Validation

- `npm test` passed.

## Risk Notes

- Weighting constants are heuristic and may need tuning on full-library feedback.
