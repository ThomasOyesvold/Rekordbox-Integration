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
1. Tighten parser error-vs-warning rules.
2. Add sanitized real Rekordbox XML fixtures.
3. Add keyboard shortcuts/focus states.
4. Add folder-level analysis summary cards in renderer.

## Notes
- Keep commits small and push feature slices.
- Keep app non-destructive to Rekordbox source data.
- If EACCES occurs in `node_modules/.vite-temp`, reinstall dependencies without sudo.
