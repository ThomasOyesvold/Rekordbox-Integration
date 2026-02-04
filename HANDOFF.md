# Handoff

Updated: 2026-02-04
Repo: `ThomasOyesvold/Rekordbox-Integration`
Branch: `master`

## What This App Is
Windows desktop tool for Rekordbox XML parsing and flow-oriented playlist prep.

## Current Working Scope
- Parse Rekordbox XML into tracks/playlists/folders.
- Show validation issues.
- Filter by folder tree.
- Inspect tracks (search/sort/select/details + source playlists).
- Persist import history and analysis cache in SQLite.
- Run baseline similarity analysis (cache-first, metadata-derived component scoring).
- Parser severity now treats duplicate track IDs as fatal (prevents ambiguous cache/signature mapping).
- Added extra XML fixtures for edge playlist structures and duplicate-track validation.
- Renderer now supports keyboard shortcuts (`Ctrl/Cmd+F`, `Ctrl/Cmd+Enter`, `Ctrl/Cmd+Shift+A`).
- Validation issues panel now supports severity filtering (all/error/warning).
- Folder pane shows quick library stats (BPM range, avg duration, genre count, key coverage).
- Baseline analysis table now includes a human-readable "Why" column per match.
- Parser warns when nested `TRACK` metadata exists (`NESTED_TRACK_DATA_UNSUPPORTED`) so gaps are explicit.
- ANLZ pipeline now supports:
  - PPTH-based TrackID -> `.EXT` mapping generation
  - duration/token disambiguation for duplicate filenames
  - waveform summary extraction from PWV5
  - SQLite cache for waveform summaries (reuse on subsequent runs)
  - desktop track details waveform preview rendered from ANLZ bins with per-bin ANLZ colors
  - optional mini waveform preview column in track table (toggle via Columns -> Waveform)
- Per-track audio playback in track table with play/pause, mini-waveform seek, and playhead progress indicator.

## Key Files
- `electron/main.js`
- `electron/preload.js`
- `renderer/App.jsx`
- `src/parser/rekordboxParser.js`
- `src/services/parseService.js`
- `src/services/libraryService.js`
- `src/services/similarityCacheService.js`
- `src/services/baselineAnalyzerService.js`
- `src/state/sqliteStore.js`

## Run
```bash
cd /home/thomas
npm test
npm run dev:renderer
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron
```
Safe mode for WSL/Linux GPU noise:
```bash
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron:safe
```

## Latest Commits (most recent first)
- `ded93f9` docs: compact state and handoff context
- `b3c42e7` weighted baseline scoring with placeholder components
- `8d6683b` baseline analyzer pass with cache-first execution
- `844092b` Phase 2 similarity cache schema + service stubs
- `548ed09` first-run UX + recent import loading
- `af529f7` sortable track table columns
- `86ac24c` track table quick search filter
- `63de59e` track details + playlist source mapping
- `65aa21a` expanded Rekordbox schema validation coverage

## Next Tasks
1. Improve ANLZ mapping coverage above current `80.11%` using stronger secondary matcher for renamed files and duplicate stems.
2. Add integration coverage for ANLZ-assisted analysis path.
3. Add optional mapping confidence threshold/reporting to avoid low-confidence auto-links.
4. Add renderer control for ANLZ attach limits instead of fixed parse-time max.
5. Add optional keyboard shortcut to toggle playback on selected track.

## Notes
- Keep commits small and push feature slices.
- Keep app non-destructive to Rekordbox source data.
- If EACCES occurs in `node_modules/.vite-temp`, reinstall dependencies without sudo.
