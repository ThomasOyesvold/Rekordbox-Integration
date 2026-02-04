# playback-wsl-debug-2026-02-04

- Why: playback failed in WSL because Rekordbox XML paths resolve to Windows paths and renderer requested relative URLs (`rbfa://local/...`). We need consistent, absolute `file://` URLs and WSL drive mapping to reach `/mnt/c`.
- Scope:
  - normalize Rekordbox `Location` parsing to decode `file://` URLs
  - map Windows paths to `/mnt/<drive>` when running on WSL/Linux
  - update audio element src on re-parse + add error logging
  - dev-only webSecurity override to allow `file://` media while using Vite
  - log WSL playback errors and roadmap task
- Files:
  - `src/parser/rekordboxParser.js`
  - `renderer/App.jsx`
  - `electron/main.js`
  - `electron/preload.cjs`
  - `docs/qa/AUDIO_PLAYBACK_WSL_2026-02-04.md`
  - `.planning/ROADMAP.md`
