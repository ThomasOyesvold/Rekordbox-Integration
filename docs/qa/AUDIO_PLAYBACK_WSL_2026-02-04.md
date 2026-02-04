# Audio Playback WSL - 2026-02-04

## Summary
Playback is failing in WSL because Windows-style paths from Rekordbox XML are not resolving to real files on the Linux filesystem and the renderer is resolving non-absolute paths against the app origin.

## Environment
- Host: WSL (Ubuntu)
- Renderer: Vite dev server (`VITE_DEV_SERVER_URL=http://localhost:5173`)
- Audio source: Rekordbox XML `Location` (Windows paths)

## Observed Errors
- `Error: net::ERR_FILE_NOT_FOUND`
- DevTools: requests resolved to `rbfa://local/C:/Users/.../*.mp3`

## Expected
- `Location` value should resolve to a playable file URL on WSL, e.g. `file:///mnt/c/Users/.../*.mp3`
- Audio element should load via absolute `file://` URL, not a relative `rbfa://local/...` URL

## Current Work
- Added parsing + normalization for `file://` locations and URL decoding.
- Added WSL drive mapping for Windows paths (`C:/...` -> `/mnt/c/...`).
- Added dev-only webSecurity override to allow `file://` media loading.
- Added audio error logging and src update on re-parse.

## Next Debug Steps
1. Verify normalized `audio.src` in DevTools after re-parse (should be `file:///mnt/c/...`).
2. Confirm file exists at the WSL path.
3. If still failing, consider a custom `rbfa://` protocol handler in the main process.
