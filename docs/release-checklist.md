**Release Checklist**
1. Pull latest `master`.
2. Run `npm install` to sync dependencies.
3. Verify `vite.config.js` has `base: './'` for file-based loads.
4. Clean build outputs: `rm -rf dist dist-electron`.
5. Build renderer: `npm run build:renderer`.
6. Build Windows installer (on Windows): `npm run build:win`.
7. Install and launch the `.exe` from `dist-electron`.
8. Confirm the header build tag matches the intended build.
9. Validate: Browse XML sets the path.
10. Validate: Parse Library succeeds.
11. Validate: Playback works without stutter.
12. Validate: Find Similar and waveforms render.
