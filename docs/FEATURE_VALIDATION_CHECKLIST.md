# Feature Validation Checklist

Use this before packaging/release.

## Parse and Import

- [ ] Browse XML opens picker and fills path.
- [ ] Parse succeeds on known-good fixture/library.
- [ ] Parse progress updates while background worker runs.
- [ ] Validation issues table renders and severity filter works.
- [ ] Folder tree renders; selecting folders and re-parse scopes tracks.

## Track Table UX

- [ ] Search filter updates results as expected.
- [ ] All sortable columns sort ascending/descending.
- [ ] Duration renders as `m:ss`.
- [ ] Column toggles work (including `ID` hide/show).
- [ ] At least one column always remains visible.
- [ ] Sticky header remains visible while scrolling.
- [ ] Cozy/Compact density toggle affects row height.
- [ ] Pagination (`Prev`/`Next`) and page size options work.
- [ ] Virtualized rows do not break selection behavior.

## Track Details and History

- [ ] Clicking a row updates Track Details panel.
- [ ] Playlist references appear correctly for selected track.
- [ ] Recent imports list updates and load action works.

## Baseline Analysis

- [ ] Run Baseline Analysis works with 2+ tracks.
- [ ] Analysis summary stats render (`pairs`, `cache hits`, etc.).
- [ ] Top match table renders component scores and reason text.

## Export

- [ ] Export CSV creates valid file and readable rows.
- [ ] Export JSON creates valid structured output.
- [ ] Canceling export dialog returns gracefully.

## Persistence

- [ ] App restores last XML path.
- [ ] App restores selected folders.
- [ ] App restores table sort, visible columns, density, and page size.

## Automated Checks

- [ ] `npm test` passes.
- [ ] `npm run build:renderer` passes.
- [ ] `RUN_ELECTRON_SMOKE=1 npm test` passes on a non-restricted host.
