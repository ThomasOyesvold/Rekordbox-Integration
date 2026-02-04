# fd81dc7 - Allow hiding ID column in track table

- Date: 2026-02-04
- Why: ID is not always needed for browsing and should be optional.

## Files Changed

- `renderer/App.jsx`

## Summary

- Added `id` to column toggle model.
- Updated table header/body/colgroup/spacer logic to support hidden ID column.

## Validation

- `npm test` passed after change.

## Risk Notes

- Dynamic column span math must stay aligned with visible columns to avoid table layout issues.
