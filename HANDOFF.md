# Project Handoff Context

Last updated: 2026-02-04
Repo: ThomasOyesvold/Rekordbox-Integration
Branch: master

## What this project is
Rekordbox Flow Analyzer is a Windows desktop app that parses Rekordbox XML, helps filter library folders, and prepares the foundation for flow-based playlist generation.

## Current implementation status
Phase 1 foundation is in progress and working.

Completed:
- Electron + React desktop shell
- Background XML parsing worker with progress events
- Rekordbox XML parser (tracks/playlists/folders)
- Nested folder tree filter UI
- SQLite persistence for import history
- Structured XML validation issues in UI
- Expanded Rekordbox-specific validation rules (collection entries, node type/name, empty playlists, missing metadata)
- Track details panel with source playlist references
- Quick track table search/filter
- Sortable track table columns
- First-run onboarding hints and recent-import load action
- Phase 2 cache schema foundation and similarity cache service stubs
- Unit tests for parser/services/state

Not started yet:
- Similarity analysis engine (BPM/key/waveform/rhythm scoring)
- Playlist generation
- Audio sampling and waveform verification UX
- M3U export workflow

## Key files
- Electron main/preload: `electron/main.js`, `electron/preload.js`
- Renderer UI: `renderer/App.jsx`, `renderer/styles.css`
- XML parser: `src/parser/rekordboxParser.js`
- Parse worker/service: `src/worker/parseWorker.js`, `src/services/parseService.js`
- Similarity cache service: `src/services/similarityCacheService.js`
- Folder/filter helpers: `src/services/libraryService.js`
- State persistence: `src/state/stateStore.js`, `src/state/sqliteStore.js`
- Tests: `test/*.test.js`

## How to run
Install dependencies:
```bash
cd /home/thomas
npm install
```

Run tests:
```bash
npm test
```

Run desktop app (dev):
```bash
npm run dev:renderer
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron
```

If WSL/Linux shows GPU init errors:
```bash
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron:safe
```

Build renderer:
```bash
npm run build:renderer
npm run start:electron
```

## Recent milestones (latest first)
- `548ed09` feat: improve first-run UX and recent import loading
- `af529f7` feat: add sortable columns to track table
- `86ac24c` feat: add track table quick search filter
- `63de59e` feat: add track details panel with playlist source mapping
- `d81694b` feat: add structured XML validation and UI issue reporting
- `d920993` feat: persist import history in sqlite and show recent runs
- `9925ba7` feat: add expandable nested folder tree filter UI
- `345b9a7` chore: add lockfile and fix vite renderer root
- `10c4e5a` feat: scaffold electron+react phase 1 desktop shell

## Next recommended tasks
1. Wire similarity cache service into a first analyzer pass (BPM + key baseline score).
2. Improve Rekordbox-specific validation rules and severity classification.
3. Add real-world XML fixtures from your Rekordbox exports to harden parser edge cases.
4. Add keyboard shortcuts and focus states for fast desktop workflows.

## Notes for future sessions
- Keep commits small and push after each feature slice.
- Preserve non-destructive behavior: never modify Rekordbox source data.
- Prioritize conservative correctness over aggressive matching (trust-first).
- If renderer build fails with EACCES in `node_modules/.vite-temp`, reinstall deps without sudo (`rm -rf node_modules package-lock.json && npm install`) before continuing.
