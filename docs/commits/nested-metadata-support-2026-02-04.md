# nested-metadata-support-2026-02-04

- Why: remove high-volume warning noise and parse nested Rekordbox track metadata blocks.

## Files Changed

- `src/parser/rekordboxParser.js`
- `test/rekordboxParser.test.js`

## Summary

- Parser now handles `<TRACK>...</TRACK>` collection entries with nested child blocks.
- Extracts:
  - `nestedTempoPoints` from `<TEMPO .../>`
  - `nestedPositionMarks` from `<POSITION_MARK .../>`
- Removed unsupported nested metadata warning emission path.

## Validation

- `npm test` passed after change.

## Risk Notes

- Nested metadata extraction currently targets tempo + position marks only.
