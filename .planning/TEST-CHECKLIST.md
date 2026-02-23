# Test Checklist

## Before You Start
1. Close all Electron/Vite processes.
2. Start the app with `VITE_DEV_SERVER_URL=http://localhost:5173 npm run start:electron`.
3. Confirm the build tag shown in the UI is correct.
4. Open DevTools console to watch for errors and warnings.

## Library Import + Parsing
1. XML path loads without errors.
2. Parse library completes with correct track, playlist, folder counts.
3. Folder filter tree populates and filtering reduces track table correctly.
4. Special characters and non-ASCII paths display correctly.
5. ANLZ map load shows expected attached count (if present).

## Track Table
1. Default columns match the desired layout.
2. Play button toggles to Pause and back correctly.
3. Timer updates while playing.
4. Filter input works and doesn’t break playback.
5. Density toggle works (Cozy/Compact) and doesn’t break layout.
6. Page size control works and persists during navigation.
7. Waveform renders and the playhead needle follows playback.
8. Clicking waveform seeks to that position and timer updates.

## Quick Preview
1. Waveforms render for each row (if expected).
2. Scroll works smoothly.
3. Layout doesn’t overflow or collapse.
4. The preview doesn’t block or stutter audio playback.

## Track Details
1. Play/Pause toggles correctly.
2. Timer displays and counts up continuously.
3. Location and metadata toggles show/hide correctly.
4. “Find Similar” button is visible and usable.
5. Similar list does not repeat identical tracks.
6. Similar list shows only: Play, Title, Artist, BPM, Key, Waveform.
7. No “reasoning” or “why” text appears in results.
8. Clicking large waveform seeks and needle follows.
9. Play controls inside “Find Similar” work.

## Audio Playback
1. Audio starts and is audible.
2. No stutter under idle conditions.
3. No stutter when running CPU-heavy actions (Find Similar, re-parse).
4. Starting a new track stops the previous track immediately.
5. Sampling playback respects 30-45 sec rule (if enabled).
6. No “play() interrupted by pause()” errors in console.

## Volume Controls
1. Default volume is 50% on launch.
2. Slider moves smoothly and doesn’t jump back.
3. Volume changes affect current playback immediately.
4. Volume slider is positioned near Quick Preview.

## UI Stability
1. Window resize doesn’t break layout.
2. Panels remain usable on smaller window sizes.
3. Track table and details panels don’t overflow or clip.
4. No disappearing UI (especially after parsing and filters).

## Persistence
1. App state save doesn’t throw `ENOENT` errors.
2. Last XML path and last ANLZ path persist.
3. Approved playlists list persists in SQLite.

## Export / Approvals
1. Approve playlist saves into SQLite.
2. Approved list renders on reload.
3. Export M3U works and creates a valid file.
4. Export includes correct file paths.

## Performance
1. Parse doesn’t block UI.
2. Find Similar completes with no UI freeze.
3. Long session (10+ minutes) doesn’t degrade audio.

## Logs / Console
1. No `ERR_FILE_NOT_FOUND`.
2. No repeated decoding/URL errors.
3. No persistent exceptions after parse/play.
