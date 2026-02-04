# Technology Stack Research

**Project:** Rekordbox Flow Analyzer
**Domain:** Windows Desktop Music Analysis Tool
**Researched:** 2026-02-04
**Confidence:** MEDIUM-HIGH

## Executive Summary

For Windows desktop music analysis tools handling large audio libraries (12,000+ tracks) with waveform visualization and audio playback, the standard 2025-2026 stack centers on **Electron + React + TypeScript** with native modules for performance-critical operations. Electron dominates the desktop audio application space despite Tauri's performance advantages, primarily due to ecosystem maturity and extensive audio library support.

**Key Trade-off:** Electron's larger bundle size (100+ MB) vs. mature Node.js audio ecosystem and proven native module integration for SQLite, audio decoding, and XML parsing.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Electron** | 32.x (latest LTS) | Desktop application framework | Proven for audio applications; extensive native module support; access to Node.js ecosystem for audio/file handling; better-sqlite3 integration is mature | HIGH |
| **React** | 18.x | UI framework | Standard for complex desktop UIs; excellent TypeScript support; component ecosystem for data visualization | HIGH |
| **TypeScript** | 5.x | Type safety | Essential for large codebase maintainability; catches errors at compile time; excellent IDE support | HIGH |
| **Vite** | 6.x | Build tool | Fast HMR for development; optimized production builds; better than webpack for modern Electron apps | MEDIUM-HIGH |

### XML & Data Parsing

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **fast-xml-parser** | 5.3.4+ | Rekordbox XML parsing | Fastest pure JS XML parser; handles 100MB+ files; preserves tag order; no C++ dependencies; supports entities | HIGH |

**Rationale:** Rekordbox XML files can be 10MB+ for large libraries. fast-xml-parser tested to 100MB, significantly faster than alternatives like xml2js.

### Database & Storage

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **better-sqlite3** | 12.6.2 | Local database for playlists/state | Fastest SQLite for Node.js; synchronous API outperforms async wrappers; native module with excellent Electron support; mature rebuild tooling | HIGH |

**Rationale:** For 12,000+ track libraries with metadata and playlist state, better-sqlite3 provides sub-millisecond query performance. Synchronous API simplifies code compared to async alternatives.

**Alternative:** IndexedDB via Dexie.js if avoiding native modules, but significantly slower for complex queries and 10,000+ record datasets.

### Audio Playback

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **Howler.js** | 2.2.x | Multi-format audio playback | Supports MP3, FLAC, WAV, AAC; automatic format detection; 7KB gzipped; sprite support for cue points; proven in production audio apps | HIGH |

**Rationale:** Howler.js provides a unified API across all audio formats required. HTML5 Audio API underneath is guaranteed in Electron's bundled Chromium, removing cross-browser concerns.

**Note:** For FLAC support, ensure codecs are available in Chromium (MP3/AAC/WAV/OGG/FLAC are standard).

### Waveform Visualization

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **WaveSurfer.js** | 7.12.1 | Interactive waveform rendering | Canvas-based rendering; proven performance with large files; regions/timeline/minimap plugins; integrates with Howler or standalone; active development (Dec 2025 release) | HIGH |
| **HTML5 Canvas** | Native | Low-level rendering for custom viz | Direct control for RGB waveform data from Rekordbox; 60fps via requestAnimationFrame; 10,000+ objects at 60fps achievable | HIGH |

**Rationale:** WaveSurfer.js for standard waveform UI, Canvas API for custom Rekordbox RGB waveform rendering. Rekordbox stores pre-computed waveform data (RGB energy values), avoiding re-analysis overhead.

**Performance Note:** For 12,000 tracks, render on-demand. Pre-rendering all waveforms would consume significant memory.

### Audio Analysis & Similarity

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **Essentia.js** | 0.1.x | BPM/key/rhythm analysis (if needed) | C++ library compiled to WASM; comprehensive music analysis algorithms; used in production music apps | MEDIUM |
| **Tonal.js** | 6.x | Music theory utilities | Key/scale/chord manipulation for compatibility logic; lightweight; pure JS | HIGH |

**Rationale:** Since Rekordbox XML includes BPM, key, and waveform data, minimize re-analysis. Essentia.js available if validation/additional analysis needed. Tonal.js handles music theory operations (key compatibility, harmonic mixing).

**Critical Note:** Use Rekordbox's existing analysis data. Re-analyzing 12,000 tracks would take hours and provide redundant data.

### UI Component Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **Blueprint UI** | 5.x | Desktop-style components | Dense, data-rich interfaces; tables, trees, context menus; optimized for desktop apps | HIGH |
| **Ant Design** | 5.x | Enterprise UI components | Alternative to Blueprint; extensive component library; good TypeScript support | MEDIUM-HIGH |
| **Recharts** | 2.x | Data visualization | Waveform similarity charts, BPM distribution graphs | MEDIUM |

**Recommendation:** Blueprint UI for desktop-native feel. Ant Design if preferring Material-inspired design.

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| **@electron/rebuild** | Native module recompilation | Required for better-sqlite3; handles version matching automatically | HIGH |
| **electron-builder** | Application packaging | Standard for Windows installers; handles code signing | HIGH |
| **ESLint + Prettier** | Code quality | TypeScript-aware linting; consistent formatting | HIGH |
| **Vitest** | Unit testing | Vite-native test runner; faster than Jest | MEDIUM |

## Installation

```bash
# Core dependencies
npm install electron react react-dom
npm install better-sqlite3 fast-xml-parser howler wavesurfer.js
npm install @tonaljs/tonal

# UI framework (choose one)
npm install @blueprintjs/core @blueprintjs/icons  # Recommended
# OR
npm install antd

# Build tools
npm install -D vite @vitejs/plugin-react
npm install -D typescript @types/react @types/react-dom @types/node
npm install -D @electron/rebuild electron-builder

# Dev tools
npm install -D eslint prettier vitest
npm install -D eslint-config-airbnb-typescript

# After installation, rebuild native modules
npx electron-rebuild
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative | Confidence |
|----------|-------------|-------------|------------------------|------------|
| **Desktop Framework** | Electron | Tauri 2.x | If bundle size critical (Tauri: <10MB vs Electron: 100MB+); willing to use Rust for backend; don't need extensive Node.js audio libraries | MEDIUM-HIGH |
| **Desktop Framework** | Electron | .NET (WPF/WinUI) | Windows-only acceptable; team has C# expertise; need lowest possible latency | MEDIUM |
| **Database** | better-sqlite3 | IndexedDB + Dexie.js | Avoiding native modules; web-first architecture; simpler deployment | MEDIUM |
| **XML Parser** | fast-xml-parser | xml2js | None; fast-xml-parser superior in all metrics | HIGH |
| **Audio Playback** | Howler.js | Web Audio API directly | Need advanced audio graph operations; custom audio processing | MEDIUM |
| **Waveform Viz** | WaveSurfer.js + Canvas | Custom Canvas only | Need complete control; WaveSurfer overhead unacceptable | LOW |

### Electron vs. Tauri (2025-2026)

**Electron Advantages:**
- 60% market share in cross-platform desktop apps (2025)
- Mature native module ecosystem (better-sqlite3, audio libraries)
- Extensive documentation and community support
- Proven audio application track record

**Tauri Advantages:**
- 35% YoY growth (2024-2025)
- <10MB bundle vs. 100MB+ for Electron
- 30-40MB memory footprint vs. 200-300MB for Electron
- Sub-500ms startup vs. 1-2 seconds for Electron
- Rust backend provides type safety and performance

**Recommendation:** Electron for this project. Audio playback, native SQLite, and large XML parsing benefit from Node.js ecosystem maturity. Tauri's advantages (size, memory) less critical for desktop tool used by single users.

**Reconsider Tauri if:** Targeting distribution to thousands of users where download size matters, or team has Rust expertise.

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| **xml2js** | 5-10x slower than fast-xml-parser; callback-based API | fast-xml-parser | HIGH |
| **node-sqlite3** | Async-only API; slower than better-sqlite3 | better-sqlite3 | HIGH |
| **Electron Forge** | More complex than needed; electron-builder more mature | electron-builder | MEDIUM |
| **Create React App** | Deprecated; slow; no longer maintained | Vite + React | HIGH |
| **Re-analyzing audio** | Redundant; Rekordbox already analyzed everything | Parse Rekordbox XML data | HIGH |
| **Storing full audio in DB** | Massive storage; unnecessary | Store file paths only | HIGH |
| **jQuery** | Outdated; unnecessary with React | React components | HIGH |

## Platform-Specific Considerations

### Windows Requirements

1. **Native Module Compilation:**
   - Visual Studio Build Tools 2017+ (MSVC v142 compiler)
   - Python 3.x for node-gyp
   - Windows SDK

2. **Audio Codecs:**
   - Windows 10+ includes MP3/AAC codecs in Chromium
   - FLAC support confirmed in Chromium

3. **File Paths:**
   - Handle Windows path separators correctly (`path` module)
   - Rekordbox XML uses file:// URLs with drive letters

4. **Performance:**
   - Windows Defender can slow file I/O; recommend exclusions during development

### Large Library Optimizations

For 12,000+ track libraries:

1. **Lazy Loading:** Render waveforms on-demand when tracks visible
2. **Virtual Scrolling:** Use react-window or react-virtualized for track lists
3. **Indexed Queries:** SQLite indexes on BPM, key, genre for fast filtering
4. **Web Workers:** Move similarity calculations off main thread
5. **Pagination:** Load metadata in batches of 1,000-2,000 tracks

## Version Compatibility Matrix

| Electron | Node.js | better-sqlite3 | Notes |
|----------|---------|----------------|-------|
| 32.x | 20.x | 12.6.2 | LTS; recommended |
| 31.x | 20.x | 12.6.2 | Stable |
| 30.x | 20.x | 12.5.x | Rebuild required |

**Critical:** Always run `npx electron-rebuild` after Electron version updates.

## Stack Variants by Requirements

**If minimizing bundle size:**
- Use Tauri instead of Electron
- Trade-off: Rust learning curve, less mature audio library ecosystem

**If web version needed later:**
- Avoid better-sqlite3 (use IndexedDB + Dexie.js)
- Avoid Electron-specific APIs in React components
- Trade-off: Slower database performance

**If cross-platform (macOS/Linux):**
- Current stack works with minimal changes
- Test better-sqlite3 rebuild on each platform
- macOS/Linux Chromium includes same audio codecs

**If maximum performance:**
- Consider Rust + Tauri for similarity algorithms
- Use Web Workers for parallel processing
- Trade-off: Development complexity

## Research Gaps & Recommendations

### HIGH Confidence Areas:
- Electron as desktop framework (proven track record)
- better-sqlite3 for database (performance verified)
- fast-xml-parser for Rekordbox XML (capabilities confirmed)
- WaveSurfer.js for waveform visualization (actively maintained)

### MEDIUM Confidence Areas:
- Essentia.js for analysis (available if needed, but prefer Rekordbox data)
- Specific Rekordbox XML structure (need to parse actual file during implementation)
- Optimal similarity algorithm (will require experimentation with domain-specific requirements)

### Requires Phase-Specific Research:
1. **Phase: XML Parsing** - Exact Rekordbox XML schema and waveform data format
2. **Phase: Similarity Algorithm** - Define weights for BPM/key/energy/rhythm matching
3. **Phase: Performance** - Profile actual performance with 12,000 track database

## Sources

### Framework Comparisons:
- [Electron vs. Tauri | DoltHub Blog](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — Architecture and performance comparisons
- [Tauri vs Electron Comparison 2025](https://www.raftlabs.com/blog/tauri-vs-electron-pros-cons/) — Bundle size and memory usage benchmarks
- [Electron vs Tauri: performance, bundle size, and trade-offs](https://www.gethopp.app/blog/tauri-vs-electron) — Real-world performance metrics

### Audio Libraries:
- [Howler.js - JavaScript audio library](https://howlerjs.com/) — Audio format support verified
- [WaveSurfer.js GitHub](https://github.com/katspaugh/wavesurfer.js) — v7.12.1 confirmed (Dec 2025)
- [Essentia.js Documentation](https://essentia.upf.edu/) — Audio analysis algorithms

### Database & Performance:
- [better-sqlite3 Releases](https://github.com/WiseLibs/better-sqlite3/releases) — v12.6.2 confirmed (Jan 2026)
- [Offline-first frontend apps 2025: IndexedDB and SQLite](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — Storage comparisons
- [SQLite Persistence On The Web: November 2025](https://www.powersync.com/blog/sqlite-persistence-on-the-web) — Current state of SQLite in browsers

### XML & Data Parsing:
- [fast-xml-parser GitHub](https://github.com/NaturalIntelligence/fast-xml-parser) — v5.3.4 confirmed (Jan 2026)
- [Rekordbox XML Format Documentation](https://cdn.rekordbox.com/files/20200410160904/xml_format_list.pdf) — Official format spec
- [pyrekordbox GitHub](https://github.com/dylanljones/pyrekordbox) — XML parsing patterns

### UI & Visualization:
- [Blueprint UI Documentation](https://www.heroui.com/) — Desktop-optimized components
- [Top React UI Frameworks 2025](https://www.carmatec.com/blog/17-best-react-ui-frameworks/) — Component library survey
- [HTML5 Canvas Performance](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) — Rendering optimization techniques

### Native Modules & Electron:
- [Electron Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) — Official documentation
- [Using better-sqlite3 with Electron](https://dev.to/arindam1997007/a-step-by-step-guide-to-integrating-better-sqlite3-with-electron-js-app-using-create-react-app-3k16) — Integration guide

---
*Stack research for: Rekordbox Flow Analyzer*
*Domain: Windows Desktop Music Analysis Tool*
*Researched: 2026-02-04*
*Overall Confidence: MEDIUM-HIGH*
