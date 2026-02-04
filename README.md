# Rekordbox Flow Analyzer (Phase 1 Start)

Initial implementation of the foundation layer for parsing Rekordbox XML, selecting folders, and running parsing in a background worker.

## What is implemented

- Rekordbox XML parser for tracks and playlist folders
- Track metadata extraction (artist, title, BPM, key, duration, bitrate, path)
- Folder-based filtering over parsed playlists
- App state persistence (`app-state.json` in Electron user data)
- SQLite import history (`rbfa.db` in Electron user data)
- Background parsing worker with progress events
- Desktop shell (Electron + React) with:
  - XML picker
  - Folder filter
  - Track table preview with quick text filtering
  - Track details panel with source playlist references
  - Recent import history table
  - Structured XML validation issues panel (errors/warnings with codes and context)

## CLI usage

```bash
npm run test
npm run cli -- parse /path/to/library.xml
npm run cli -- parse /path/to/library.xml "ROOT/Techno"
```

## Desktop usage

```bash
npm install
npm run dev:renderer
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron
```

For production renderer build:

```bash
npm run build:renderer
npm run start:electron
```

## Notes

- This is the first coding pass for roadmap Phase 1.
- Parser is strict enough for common Rekordbox export structure and can be hardened further using real-world XML samples.
