# Rekordbox Flow Analyzer (Phase 1 Start)

Initial implementation of the foundation layer for parsing Rekordbox XML, selecting folders, and running parsing in a background worker.

## What is implemented

- Rekordbox XML parser for tracks and playlist folders
- Track metadata extraction (artist, title, BPM, key, duration, bitrate, path)
- Folder-based filtering over parsed playlists
- App state persistence (`app-state.json` in Electron user data)
- SQLite import history (`rbfa.db` in Electron user data)
- Phase 2 cache schema foundation in SQLite (`analysis_runs`, `tracks`, `track_similarity`)
- Background parsing worker with progress events
- Desktop shell (Electron + React) with:
  - XML picker
  - Folder filter
  - Track table preview with quick text filtering and sortable columns
  - Track details panel with source playlist references
  - Recent import history table
  - Baseline analysis run button (BPM + key score, cache-first)
- Structured XML validation issues panel (errors/warnings with codes and context)
- Analysis cache service for track signatures and similarity cache lookups

## CLI usage

```bash
npm run test
npm run cli -- parse /path/to/library.xml
npm run cli -- parse /path/to/library.xml "ROOT/Techno"
npm run cli -- analyze /path/to/library.xml
npm run cli -- analyze /path/to/library.xml "ROOT/Techno"
```

## Desktop usage

```bash
npm install
npm run dev:renderer
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron
```

If GPU init errors are noisy in WSL/Linux, use:

```bash
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron:safe
```

For production renderer build:

```bash
npm run build:renderer
npm run start:electron
```

## Notes

- This is the first coding pass for roadmap Phase 1.
- Parser is strict enough for common Rekordbox export structure and can be hardened further using real-world XML samples.
