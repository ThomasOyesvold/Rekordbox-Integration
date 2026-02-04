# Rekordbox Flow Analyzer: Project Guide

## 1. What This App Does

Rekordbox Flow Analyzer helps you:

- import a Rekordbox XML export
- scope analysis to selected playlist folders
- inspect parsed track metadata quickly
- run baseline compatibility scoring between tracks

It is built as an Electron desktop app with a matching CLI path for scripted use.

## 2. High-Level Architecture

- `electron/main.js`
  - creates the app window
  - exposes IPC handlers (`library:parse`, `analysis:baseline`, state/history handlers)
- `electron/preload.cjs`
  - securely exposes `window.rbfa` bridge functions to the renderer
- `renderer/App.jsx`
  - main UI and interaction logic
  - calls bridge APIs to parse, save/load state, run analysis
- `src/services/*`
  - parsing orchestration, filtering, analysis, cache logic
- `src/parser/*`
  - Rekordbox XML parsing + attribute handling
- `src/state/*`
  - app state JSON persistence + SQLite history/cache plumbing
- `src/worker/parseWorker.js`
  - background parser to keep UI responsive

## 3. Data Flow (Desktop)

1. User selects XML file.
2. Renderer calls `window.rbfa.parseLibrary(xmlPath, selectedFolders)`.
3. Main process runs background parse, streams progress to renderer.
4. Parsed library is filtered/scoped and summarized.
5. Renderer updates:
   - folder tree
   - track table
   - validation issues
   - recent import data
6. User runs baseline analysis; results display in score table.

## 4. UI Capabilities

- Search + sortable table
- `m:ss` duration rendering
- column visibility toggles
- cozy/compact row density
- sticky table header
- pagination controls
- virtualized rows for smooth scrolling
- row click details panel
- validation issue inspector
- analysis export (CSV/JSON)

Preferences persisted to app state include:

- last XML path
- selected folders
- sort field + direction
- visible columns
- table density
- page size

## 5. Running the App

Development:

```bash
npm install
npm run dev:renderer
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron
```

WSL safe mode (if GPU warnings/noise):

```bash
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron:safe
```

Tests:

```bash
npm test
```

Build renderer:

```bash
npm run build:renderer
npm run start:electron
```

Optional Electron smoke test:

```bash
RUN_ELECTRON_SMOKE=1 npm test
```

If running in a restricted environment, use:

```bash
npm run smoke:electron:safe
```

## 6. Troubleshooting

- Error: bridge unavailable or `parseLibrary` undefined
  - Ensure app is launched through Electron, not just Vite browser page.
  - Preload bridge is in `electron/preload.cjs`.
- XML path issues in WSL
  - Prefer Linux path copy into home, e.g. `/home/thomas/rekordbox_backup.xml`.
- Very large library handling
  - use search filters + pagination
  - hide unneeded columns for cleaner scanning

## 7. Current Gaps

- Richer scoring explainability and tuning UI
- More robust parsing for uncommon nested Rekordbox metadata blocks

## 8. Suggested Next Milestones

1. Phase 2 closure: improve ANLZ mapping coverage from ~80% toward 90%+ (secondary matcher for renamed/duplicate filenames).
2. Persist ANLZ waveform summaries in SQLite cache to avoid re-reading `.EXT` files each analysis run.
3. Track detail enhancements (surface ANLZ waveform summary: sample count, color profile, envelope bins).
4. Expand Electron smoke to include export-path verification and one ANLZ-assisted analysis run.
5. Playback UX refinements (keyboard shortcuts, speed toggle, per-track audio error recovery).

## 9. Roadmap Status (2026-02-04)

- Phase 1 (POC extraction): Completed.
- Phase 2 (correlation + integration): In progress.
  - Completed: PWV5 parser, PPTH-based mapper, duration/token disambiguation, baseline waveform scoring now prefers real ANLZ summaries when present, ANLZ waveform summary persistence in SQLite cache, renderer track details now surface ANLZ waveform summary metadata and a desktop waveform preview chart with per-bin ANLZ colors, track table now supports optional mini waveform previews via column toggle, per-track audio playback with mini-waveform seek + playhead.
  - Current measured mapping coverage on real library: `9075/11328` (`80.11%`).
  - Current cache behavior: second analysis run reuses cached waveform summaries (`cacheHits=99`, `parsedFromFile=0` on `--anlz-max-tracks 120` test).
  - Remaining: raise mapping coverage and add ANLZ-assisted integration coverage.
- Phase 3 (validation at scale): Pending after Phase 2 cache + coverage improvements.
