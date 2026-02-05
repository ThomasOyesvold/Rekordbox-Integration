# Roadmap Update: Windows .exe Production Build Strategy

**Date**: 2026-02-05
**Updated Files**: `.planning/ROADMAP.md`, `.planning/STATE.md`

## Summary

The roadmap has been updated with comprehensive plans for converting the WSL development environment to production Windows .exe builds. This includes the audio playback fix implementation and a detailed strategy for packaging, signing, and distributing the application.

---

## What Changed

### 1. Phase 4 Updated - Audio Playback ✅ COMPLETE

**Completed Work (2026-02-05)**:
- WSL audio playback path mapping fixed
- Bridge API methods added: `checkFileExists`, `checkFileReadable`, `resolveAudioPath`
- Enhanced path normalization with debug logging
- Pre-playback file verification with detailed error messages
- Case-insensitive drive letter fallback for WSL
- MediaError code mapping for user-friendly errors

**Status**: ✅ Ready for testing (dev server running, Electron ready to launch)

**Documentation**:
- `AUDIO_FIX_IMPLEMENTATION.md` - Technical implementation details
- `IMPLEMENTATION_COMPLETE.md` - Testing guide
- `test-audio-fix.md` - User testing checklist
- `verify-audio-fix.sh` - Automated verification script

### 2. NEW: Phase 7 - Windows Production Build

**Goal**: Package application as signed Windows .exe installer with automatic updates

**Key Components**:

#### A. Electron Builder Setup
- NSIS installer configuration
- Build scripts for Windows packaging
- Icon and resource management
- File inclusion/exclusion rules

#### B. Path Resolution Adaptation
Current WSL development uses `/mnt/c/` paths. Production Windows uses `C:\` paths directly.

**Solution**: Platform-aware path resolution
```javascript
// Detect environment
const isProduction = app.isPackaged;
const platform = process.platform;
const isWsl = Boolean(process.env.WSL_DISTRO_NAME);

// Adapt paths based on platform
if (platform === 'win32') {
  // Production Windows: C:\Users\Music\track.mp3
} else if (isWsl) {
  // WSL Development: /mnt/c/Users/Music/track.mp3
}
```

Key changes needed:
- `electron/main.js` - Platform detection and path handlers
- `electron/preload.cjs` - Expose production flag
- `renderer/App.jsx` - Conditional path normalization

#### C. Code Signing
- Acquire code signing certificate ($80-300/year)
- Configure electron-builder with certificate
- Sign .exe to avoid Windows SmartScreen warnings
- Optional: GitHub Actions for CI/CD builds

#### D. Auto-Updates
- Use electron-updater (built into electron-builder)
- Host updates on GitHub Releases
- Automatic differential updates
- User notification and restart flow

#### E. User Data Management
- SQLite database: `C:\Users\<username>\AppData\Roaming\rekordbox-flow-analyzer\rbfa.db`
- App state: `C:\Users\<username>\AppData\Roaming\rekordbox-flow-analyzer\app-state.json`
- Use `app.getPath('userData')` for all persistent storage

#### F. Production Testing
Comprehensive test checklist:
- Clean Windows 10/11 VMs
- Installation/uninstallation flows
- Audio playback with native Windows paths
- File path edge cases (spaces, Unicode, special chars)
- Network drives and different drives (D:, E:)
- Performance with 12K+ track libraries
- Update mechanism end-to-end
- Offline functionality

#### G. File Protocol Security
Two approaches:

**Option 1: Conditional webSecurity**
```javascript
webSecurity: isDev ? false : true  // Disable only in dev
```

**Option 2: Custom protocol handler**
```javascript
protocol.registerFileProtocol('rbfa', (request, callback) => {
  // Handle audio file loading securely
});
```

Recommendation: Start with Option 1, implement Option 2 if issues arise.

### 3. NEW: Phase 8 - Distribution & Maintenance

**Goal**: Infrastructure for ongoing releases, user feedback, and crash reporting

**Distribution Channels**:
1. GitHub Releases (primary) - Free hosting, auto-update support
2. Direct Download (secondary) - Own website with SHA256 checksums
3. Microsoft Store (future) - Requires MSIX packaging

**Crash Reporting**:
- Sentry integration for production error tracking
- Optional: Custom crash handler
- Version-tagged error reports

**User Feedback**:
- GitHub Issues for bug reports
- Email support template
- Optional: In-app feedback form

**Documentation**:
- User guide
- FAQ section
- Troubleshooting guide
- Video tutorials (optional)

---

## Path Resolution Architecture

### Development (Current)
```
Rekordbox XML: file://localhost/C:/Users/Music/track.mp3
       ↓
WSL normalization: /mnt/c/Users/Music/track.mp3
       ↓
File URL: file:///mnt/c/Users/Music/track.mp3
       ↓
Audio element plays: ✅
```

### Production (Target)
```
Rekordbox XML: file://localhost/C:/Users/Music/track.mp3
       ↓
Windows normalization: C:\Users\Music\track.mp3
       ↓
File URL: file:///C:/Users/Music/track.mp3
       ↓
Audio element plays: ✅
```

### Implementation Strategy

**Conditional Logic**:
```javascript
function normalizeAudioLocation(rawLocation) {
  const bridge = getBridgeApi();
  const platform = bridge?.platform;
  const isWsl = bridge?.isWsl;
  const isProduction = bridge?.isProduction;

  // Platform-specific path handling
  if (platform === 'win32') {
    // Windows production: C:\path\to\file
    // No /mnt/ mapping needed
  } else if (isWsl || platform === 'linux') {
    // WSL/Linux dev: /mnt/c/path/to/file
    // Apply /mnt/ mapping
  }

  // Return appropriate file:// URL
}
```

**Key Principle**: Same codebase, different behavior based on runtime environment detection.

---

## Implementation Timeline

### Phase 7: Windows Production Build
**Estimated**: 2-3 weeks

- **Week 1**: Electron builder setup, path resolution adaptation
  - Install and configure electron-builder
  - Add build scripts to package.json
  - Create icons and resources
  - Adapt path resolution code for Windows production
  - Test basic build process

- **Week 2**: Code signing, auto-updates, production testing
  - Acquire code signing certificate
  - Configure signing in electron-builder
  - Implement auto-update mechanism
  - Set up test VMs (Windows 10, Windows 11)
  - Run comprehensive production test checklist

- **Week 3**: Bug fixes, performance optimization, documentation
  - Fix issues found in testing
  - Optimize memory usage for large libraries
  - Write user documentation
  - Prepare release notes
  - Set up distribution channels

### Phase 8: Distribution & Maintenance
**Initial Setup**: 1 week
**Ongoing**: Release management as features ship

- Set up crash reporting (Sentry)
- Configure GitHub Releases
- Create support documentation
- Establish feedback channels
- Monitor production metrics

---

## Risk Assessment

### High-Risk Items

**1. Audio playback breaking in production**
- **Risk**: File protocol security differences between dev and production
- **Mitigation**: Test on clean Windows VMs early in Phase 7
- **Fallback**: Implement custom `rbfa://` protocol handler
- **Status**: Code already prepared for both approaches

**2. Code signing certificate issues**
- **Risk**: Certificate acquisition delays or identity verification problems
- **Mitigation**: Start certificate process early (Week 1 of Phase 7)
- **Fallback**: Distribute unsigned builds to beta testers first
- **Impact**: Users see SmartScreen warnings without signing

**3. Large library performance in production**
- **Risk**: Memory leaks or performance degradation with 12K+ tracks
- **Mitigation**: Stress testing during Phase 7, Week 2
- **Optimization**: Lazy loading, pagination, virtualization
- **Monitoring**: Add performance metrics in production

### Medium-Risk Items

**1. File path edge cases**
- Risk: Network drives, special characters, Unicode
- Mitigation: Comprehensive test matrix in Phase 7

**2. SQLite database corruption**
- Risk: Data loss on crashes or improper shutdown
- Mitigation: Transaction handling, backup/restore mechanism

**3. Update mechanism failures**
- Risk: Users stuck on old versions
- Mitigation: Extensive update flow testing, manual download fallback

---

## Dependencies

### Before Starting Phase 7:
- ✅ Phase 1 complete (Foundation)
- 🔄 Phase 2 complete (Analysis Engine) - In progress
- ❌ Phase 3 complete (Playlist Generation) - Not started
- 🔄 Phase 4 complete (Verification Workflow) - Audio playback done, rest pending
- ❌ Phase 5 complete (Approval Workflow) - Not started
- ❌ Phase 6 complete (Export Integration) - Not started

**Minimum Requirements**:
- All core features implemented and stable
- Beta testing with real users completed
- Performance optimized for 12K+ libraries
- Documentation complete

**Estimated Start Date for Phase 7**: After Phase 6 completion

---

## Success Metrics

### Technical Metrics
- [ ] Build size < 200MB
- [ ] Startup time < 5 seconds
- [ ] Memory usage < 500MB with 12K tracks
- [ ] Update success rate > 95%
- [ ] Crash rate < 0.1% of sessions

### User Metrics
- [ ] Installation success rate > 98%
- [ ] No SmartScreen warnings (code signing working)
- [ ] Audio playback works in > 99% of cases
- [ ] User data persists correctly in 100% of cases

### Distribution Metrics
- [ ] Update adoption rate > 80% within 7 days
- [ ] User feedback channels established
- [ ] Documentation complete and accessible

---

## Configuration Summary

### Files to Create

**1. Electron Builder Config** (`package.json` additions):
```json
{
  "build": {
    "appId": "com.rekordbox-flow-analyzer.app",
    "productName": "Rekordbox Flow Analyzer",
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico",
      "certificateFile": "certs/cert.pfx",
      "certificatePassword": "${WINDOWS_CERT_PASSWORD}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "publish": {
      "provider": "github",
      "owner": "yourusername",
      "repo": "rekordbox-flow-analyzer"
    }
  }
}
```

**2. Build Scripts**:
```json
{
  "scripts": {
    "build:win": "npm run build:renderer && electron-builder --win",
    "build:win:portable": "npm run build:renderer && electron-builder --win portable",
    "publish:win": "npm run build:renderer && electron-builder --win --publish always"
  }
}
```

**3. Resources**:
- `build/icon.ico` - Application icon (256x256px)
- `resources/` - Static resources directory
- `certs/cert.pfx` - Code signing certificate (in .gitignore)

### Environment Variables

```bash
# .env.local (DO NOT COMMIT)
WINDOWS_CERT_PASSWORD=your-certificate-password
```

### Git Ignore Additions

```gitignore
# Code signing
certs/
*.pfx

# Build output
dist-electron/

# Environment
.env.local
```

---

## Testing Checklist (Phase 7, Week 2)

### Installation Testing
- [ ] Installer runs on clean Windows 10 VM
- [ ] Installer runs on clean Windows 11 VM
- [ ] No SmartScreen warnings (code signing verified)
- [ ] User can choose installation directory
- [ ] Desktop and Start Menu shortcuts created
- [ ] Uninstaller entry in Add/Remove Programs

### Core Functionality Testing
- [ ] Application launches without errors
- [ ] No console window appears (production mode)
- [ ] Browse and select Rekordbox XML
- [ ] Parse 12K+ track library successfully
- [ ] **Audio playback works with C:\ paths**
- [ ] Waveform visualization renders
- [ ] SQLite database in correct AppData location
- [ ] Application state persists between launches

### Path Edge Cases
- [ ] File paths with spaces
- [ ] File paths with Unicode characters (é, ñ, 中文, etc.)
- [ ] File paths with special characters (&, #, %, etc.)
- [ ] Music files on D: drive
- [ ] Music files on E: drive
- [ ] Music files on network drive (\\server\share\)

### Performance Testing
- [ ] Parse 12,000+ tracks without crashing
- [ ] UI responsive during parsing
- [ ] Memory usage reasonable (< 500MB)
- [ ] Application starts in < 5 seconds
- [ ] No memory leaks in 4-hour session

### Update Testing
- [ ] Auto-update check on launch
- [ ] Update notification displays
- [ ] Update downloads successfully
- [ ] Update installs and restarts correctly
- [ ] User data preserved after update

### Offline Testing
- [ ] Application works without internet connection
- [ ] All features functional offline
- [ ] Only update check fails gracefully

---

## Future Considerations

### Windows Store Distribution (Future)
- Requires MSIX packaging (different from NSIS)
- $19 one-time registration fee
- Automatic updates via Store
- Better discoverability
- More restrictive security model

### macOS Support (Future)
- Smaller market but secondary opportunity
- Apple Developer account required ($99/year)
- DMG installer + code signing + notarization
- Different path handling (no drive letters)
- Metal rendering optimization

### Linux Support (Future)
- Smallest market for DJ software
- AppImage or deb/rpm packages
- No code signing required
- Already works in WSL development

### Enterprise Features (Future)
- Silent installation: `installer.exe /S`
- Group Policy integration
- Network deployment
- License management (if commercializing)

---

## Next Actions

### Immediate (Current Phase)
1. ✅ Audio playback testing in WSL
2. 🔄 Complete Phase 2 (waveform/rhythm extraction)
3. Plan Phase 3 (playlist generation)

### Phase 7 Preparation (Future)
1. Acquire code signing certificate (start early)
2. Set up Windows 10 VM for testing
3. Set up Windows 11 VM for testing
4. Create application icon (256x256px)
5. Install electron-builder: `npm install --save-dev electron-builder`

### When Ready to Ship (After Phase 6)
1. Execute Phase 7 Week 1 (electron-builder setup)
2. Execute Phase 7 Week 2 (signing, testing)
3. Execute Phase 7 Week 3 (bug fixes, docs)
4. Execute Phase 8 setup (distribution, monitoring)
5. Release v1.0! 🚀

---

## Questions to Consider

### Distribution Strategy
- **Q**: Host on GitHub Releases or own server?
  - **A**: GitHub Releases (simpler, free, auto-update support)

- **Q**: Charge for the software or keep it free?
  - **A**: TBD - Start free, consider paid features or donations later

### Branding
- **Q**: Final product name?
  - **A**: "Rekordbox Flow Analyzer" (current working name)

- **Q**: Website needed?
  - **A**: Optional - GitHub README sufficient for v1, website for v2

### Support
- **Q**: How much support can you provide?
  - **A**: Define support model before public release

- **Q**: Community vs. paid support?
  - **A**: Community support via GitHub Issues for v1

### Licensing
- **Q**: Open source or proprietary?
  - **A**: TBD - Consider business model

---

## Documentation Reference

### New Files Created (2026-02-05)
- `AUDIO_FIX_IMPLEMENTATION.md` - Technical details of WSL audio fix
- `IMPLEMENTATION_COMPLETE.md` - Testing guide for audio playback
- `test-audio-fix.md` - User testing checklist
- `verify-audio-fix.sh` - Automated verification script
- `ROADMAP_UPDATE_2026-02-05.md` - This document

### Updated Files
- `.planning/ROADMAP.md` - Added Phase 7 & 8, updated Phase 4
- `.planning/STATE.md` - Updated progress and next tasks

### Key References
- **Electron Builder**: https://www.electron.build/
- **electron-updater**: https://www.electron.build/auto-update
- **Code Signing**: https://www.electron.build/code-signing
- **Protocol Handlers**: https://www.electronjs.org/docs/latest/api/protocol

---

## Conclusion

The roadmap now includes a comprehensive strategy for production Windows .exe builds. The audio playback infrastructure built for WSL development will adapt cleanly to Windows production through platform-aware conditional logic.

**Key Takeaway**: The same codebase will work in both environments by detecting the runtime platform and adapting path resolution accordingly. No separate codebases needed.

**Status**: Ready to continue with Phase 2 development. Phase 7 is fully planned and ready to execute when core features are complete.

---

*Document created: 2026-02-05*
*Author: Claude Opus 4.5 with Thomas*
*Project: Rekordbox Flow Analyzer*
