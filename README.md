# Rekordbox Flow Analyzer

Desktop and CLI toolkit for importing Rekordbox XML libraries, filtering playlists/folders, and running baseline compatibility analysis across tracks.

## Quick Start

```bash
npm install
npm run dev:renderer
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron
```

If GPU init errors are noisy in WSL/Linux:

```bash
VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron:safe
```

Run tests:

```bash
npm test
```

## Project Guide

For a full walkthrough (architecture, data flow, feature map, troubleshooting, roadmap), read:

- `docs/PROJECT_GUIDE.md`

## Current Features

- Rekordbox XML parsing for tracks + playlists
- Folder tree filtering for scoped imports
- Track table with:
  - search filter
  - sortable columns
  - column visibility toggles
  - cozy/compact density
  - sticky headers
  - pagination
  - virtualized row rendering in viewport
- Duration formatting in `m:ss`
- Track detail panel with source playlists
- Validation issue table (error/warning severity filtering)
- Baseline similarity analysis (BPM/key/waveform/rhythm weighted scoring)
- Analysis export (`CSV` / `JSON`)
- Parse progress events from worker thread
- Persistent UI preferences and import state
- SQLite-backed recent import history and analysis cache foundation

## CLI Usage

```bash
npm run cli -- parse /path/to/library.xml
npm run cli -- parse /path/to/library.xml "ROOT/Techno"
npm run cli -- analyze /path/to/library.xml
npm run cli -- analyze /path/to/library.xml "ROOT/Techno"
```

## Build Renderer (Production)

```bash
npm run build:renderer
npm run start:electron
```

## Optional Electron Smoke Test

Runs a hidden-window smoke flow that exercises preload bridge + parse + baseline analysis:

```bash
RUN_ELECTRON_SMOKE=1 npm test
```

Or directly:

```bash
npm run smoke:electron
```

Restricted/sandboxed environments:

```bash
npm run smoke:electron:safe
```

## Tech Stack

- Electron + React + Vite
- Node.js worker for background parsing
- SQLite for import history and analysis cache metadata
