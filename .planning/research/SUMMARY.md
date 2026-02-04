# Project Research Summary

**Project:** Rekordbox Flow Analyzer
**Domain:** Windows Desktop Music Analysis & DJ Library Management
**Researched:** 2026-02-04
**Confidence:** MEDIUM-HIGH

## Executive Summary

The Rekordbox Flow Analyzer is a Windows desktop application for analyzing DJ music libraries (12,000+ tracks) and generating intelligent, flow-based playlists. Based on research across technology stack, feature landscape, architecture patterns, and domain-specific pitfalls, the recommended approach centers on **Electron + React + TypeScript** with native modules for performance-critical operations (better-sqlite3 for caching, fast-xml-parser for Rekordbox XML). The core differentiator is **multi-factor flow analysis** combining BPM, key, waveform, and rhythm data to suggest tracks that transition smoothly, with an approve/reject workflow that keeps the DJ in control.

The critical architectural insight is that **incremental analysis with aggressive caching** is non-negotiable for 12,000+ track libraries. Without persistent analysis caching in SQLite, every session would require hours of reprocessing. The recommended architecture uses a layered pattern: XML parsing → in-memory track database → cached similarity computation → playlist generation → user approval → M3U export. Background processing with detailed progress feedback prevents UI freezing during long-running analysis operations.

Key risks center on **trust and precision**: DJs need 90%+ accuracy in suggestions (vs. 70% for casual listening), Rekordbox XML has documented import bugs requiring validation, and false positives early destroy user confidence permanently. The mitigation strategy is conservative: start with existing Rekordbox metadata (don't override user's manual corrections), strict similarity thresholds preferring false negatives over false positives, and transparent "why this track?" explanations to build trust through understanding rather than blind algorithm faith.

## Key Findings

### Recommended Stack

Electron dominates desktop audio applications despite Tauri's performance advantages, primarily due to ecosystem maturity and extensive native module support. For 12,000+ track libraries with waveform visualization and audio playback, the Node.js ecosystem's audio libraries (Howler.js, WaveSurfer.js) and better-sqlite3's sub-millisecond query performance outweigh Electron's larger bundle size (100MB+ vs. Tauri's <10MB).

**Core technologies:**
- **Electron 32.x** (desktop framework) — proven for audio apps, extensive native module support, access to Node.js audio/file ecosystem
- **React 18.x + TypeScript 5.x** (UI framework) — complex desktop UIs, excellent TypeScript support, component ecosystem for data visualization
- **better-sqlite3 12.6.2** (database) — fastest SQLite for Node.js, synchronous API simplifies code, essential for analysis cache persistence (avoids reprocessing 12K tracks)
- **fast-xml-parser 5.3.4+** (XML parsing) — handles 100MB+ Rekordbox XML files, significantly faster than alternatives like xml2js
- **Howler.js 2.2.x** (audio playback) — supports MP3/FLAC/WAV/AAC with unified API, proven in production audio apps
- **WaveSurfer.js 7.12.1** (waveform visualization) — canvas-based rendering, proven performance with large files, active development
- **Blueprint UI 5.x** (UI components) — desktop-optimized, dense data-rich interfaces, tables/trees/context menus

**Critical version note:** Always run `npx electron-rebuild` after Electron version updates for native module compatibility (better-sqlite3).

### Expected Features

Research reveals a clear division between table stakes (users assume these exist) and differentiators (competitive advantages). The MVP can succeed by nailing table stakes while establishing one strong differentiator: flow-based playlist generation with verification workflow.

**Must have (table stakes):**
- BPM detection — core requirement for beatmatching (all major DJ software includes this)
- Key detection — harmonic mixing is standard practice (Mixed In Key is gold standard at 76.5% accuracy)
- Waveform visualization — visual representation of track structure (industry standard)
- Folder/crate management — organize subsets of library (all DJ software uses crates/playlists)
- Track search/filter — find tracks quickly in large libraries (basic search expected)
- M3U export — cross-platform playlist format (industry standard for moving between software)
- Hot cues — performance markers for instant jumping (standard 8 hot cues)

**Should have (competitive advantage):**
- **Flow/transition analysis** — predict which tracks transition well (CORE DIFFERENTIATOR, AI-powered transition analyzers model mood/tempo stability/spectral density)
- **Approve/reject workflow** — iterate on AI suggestions (simple but crucial for trust, not common in DJ tools)
- **Random sampling playback** — quick vibe-check multiple tracks (validates suggestions without listening to every track)
- **Incremental analysis** — remember analyzed playlists (saves time on re-analysis, major performance win for 12K+ tracks)
- Energy level detection — build sets with proper energy flow 1-10 scale (Mixed In Key pioneered this, BPM Supreme uses Cyanite AI)
- Track similarity matching — "find tracks like this one" (Djoid's Graph feature, rekordbox "discover similar tracks")

**Defer (v2+):**
- Mood/emotion analysis — complex AI, needs large training dataset (BPM Supreme uses Cyanite for sentiment analysis)
- Graph/visual library mapping — complex visualization, nice-to-have not need-to-have (Djoid's Graph is unique)
- Stem-aware analysis — CPU intensive, requires stem separation integration (VirtualDJ 2026, Serato has Stems FX)
- Timeline-based mix editor — massive scope, different product category (DJ.Studio pioneered this)
- Cloud library sync — infrastructure complexity, local-first is simpler (rekordbox supports 8 devices)
- Lyrics in waveform — very cutting-edge, not related to flow analysis (VirtualDJ 2026 killer feature)

**Anti-features (commonly requested but problematic):**
- Automatic mixing with no human input — removes creative control, DJs don't trust fully automated mixing
- Real-time stem separation during analysis — extremely CPU intensive, slow for batch analysis
- Social features/community sharing — scope creep, copyright issues, infrastructure complexity
- Streaming service integration (Spotify) — API restrictions, licensing nightmares, VirtualDJ 2026 users frustrated
- Automatic genre classification — genre is subjective, AI classification often wrong and frustrating

### Architecture Approach

The standard architecture for desktop music analysis tools is a **three-tier layered architecture** (Presentation → Business Logic → Data Access) with strategic caching at the data layer. This mirrors traditional desktop audio applications like DAWs and DJ software. The hybrid storage approach is critical: in-memory for parsed track metadata (instant access during analysis), SQLite for persistent caching of similarity scores and user-approved playlists.

**Major components:**
1. **Rekordbox XML Parser** — parse XML library format, extract track metadata (BPM, key, waveform data) using SAX streaming parser for 50-100MB files
2. **Similarity Analyzer** — compute similarity scores between tracks based on multi-factor analysis (BPM, key, waveform, rhythm) with weighted scoring
3. **Playlist Generator** — group similar tracks into cohesive playlists using graph-based or clustering algorithms
4. **Track Database (in-memory)** — hash maps indexed by track ID for fast access during analysis, reload from XML each session
5. **Analysis Cache (SQLite)** — persistent storage of pre-computed similarity scores to avoid reprocessing (cache-first pattern, check last modified date for invalidation)
6. **Playlist Repository (SQLite)** — persistent storage of user-approved playlists across sessions
7. **Waveform Renderer** — visualize track waveforms using Canvas/bitmap rendering from Rekordbox's pre-computed RGB waveform data
8. **Audio Player** — sample track playback for user preview using native audio API (Windows Media Foundation)
9. **M3U Exporter** — generate standard playlist files for DJ software with relative/absolute path options

**Key architectural patterns:**
- **Pipeline Architecture** for data flow: Parse → Analyze → Generate → Export (each stage transforms data, natural fit for progress reporting)
- **Repository Pattern** for persistence: abstracts SQLite behind interfaces, business logic doesn't know about storage implementation
- **Event-Driven Architecture** for UI responsiveness: long-running operations publish progress events, UI subscribes without blocking
- **Cache-First Strategy** for performance: check similarity cache before computing, persist results for next session

**Performance critical:**
- Lazy loading (render waveforms on-demand when tracks visible)
- Virtual scrolling (react-window for 12K track lists)
- Indexed queries (SQLite indexes on BPM, key, genre)
- Web Workers (move similarity calculations off main thread)
- Streaming XML parsing (SAX not DOM for 100MB+ files)

### Critical Pitfalls

Research identified five critical pitfalls that could sink the project if not addressed proactively:

1. **Rekordbox XML Import Bug (versions 5.6.1+)** — Rekordbox will NOT import DJ metadata (cues, loops, grid) from XML if track already exists. Special characters with accents cause path errors. TrackNumber fields with non-numerical characters trigger parsing failures. **Avoid:** Validate XML before import, sanitize special characters, test with small samples first, robust error handling with specific error messages pointing to problematic tracks.

2. **False Positive Explosion in Similarity Algorithms** — Academic research shows existing methods contain at least 35 false positives every 50 tracks. "Bad suggestions early = tool abandonment" — when initial playlist suggestions are poor, DJs lose trust permanently. DJs need ~90%+ precision (vs. 70% for casual listening). **Avoid:** Start with strict similarity thresholds (prefer false negatives), implement confidence scoring, add "why this track?" explanations, allow manual feedback loops, test with real DJ libraries not generic recommendation datasets.

3. **BPM Detection Accuracy Collapse on Edge Cases** — While modern algorithms achieve 95%+ on standard 4/4 pop/electronic, accuracy plummets for complex rhythms, tempo changes, non-standard patterns. Half-time/double-time errors (140 BPM detected as 70 or 280) are common. **Avoid:** Use multiple detection algorithms and compare (divergence = flag for manual review), implement confidence scoring, allow manual BPM override, detect tempo changes and warn users, use pre-existing Rekordbox BPM data as ground truth.

4. **Memory Leaks from Audio Analysis at Scale** — Audio processing can explode 20MB MP3 into hundreds of MB RAM when decoded. Processing 12K+ tracks causes memory accumulation, crashes. Waveform RGB data (12K tracks * ~1MB each = 12GB) stays in memory. **Avoid:** Process tracks in small batches (50-100) with explicit cleanup, use streaming/chunked processing, implement checkpointing (save progress every N tracks), monitor memory and pause/GC when threshold exceeded, test on 10K+ tracks early.

5. **UI Blocking During Analysis** — Waveform syncing and analysis can take hours for large libraries. Blocking UI thread causes frozen interface, no progress updates, users killing process assuming crashed. **Avoid:** Move analysis to background thread/worker from day 1, implement progress feedback (no indicator <100ms, inline spinners 100ms-1s, skeleton screens 1-3s, full progress >3s), allow pause/resume, show detailed progress ("Processing track 247 of 12,483 (2%)"), estimate time remaining.

## Implications for Roadmap

Based on research findings, the roadmap should follow a dependency-driven architecture with performance and trust as first-class concerns. The phase structure should build from data layer → analysis engine → user interaction → polish, with each phase avoiding specific pitfalls identified in research.

### Phase 1: Foundation & Data Layer
**Rationale:** Everything depends on successfully parsing Rekordbox XML and establishing the storage architecture. Without reliable XML parsing and persistence patterns, subsequent phases cannot proceed. This phase addresses the most critical pitfalls: Rekordbox XML bugs, UI blocking, and establishes patterns for memory management.

**Delivers:**
- Rekordbox XML parser with robust validation and error handling
- In-memory track database with fast lookup
- SQLite persistence layer (analysis cache, playlist repository, app state)
- Basic UI with folder selection and parsed track display
- Background processing architecture for long-running operations

**Addresses features:**
- Folder selection (table stakes)
- Database foundation for incremental analysis (differentiator)

**Avoids pitfalls:**
- Pitfall 1: Rekordbox XML bugs (validation layer, special character handling)
- Pitfall 5: UI blocking (background processing from day 1)

**Research needs:** LOW — XML parsing and SQLite are well-documented. Test with problematic XML samples from GitHub issues.

### Phase 2: Analysis Engine & Caching
**Rationale:** Core value proposition is flow-based matching, which requires multi-factor similarity analysis. Phase 2 implements BPM, key, waveform, and rhythm analyzers with the cache-first pattern to avoid reprocessing. This phase must address false positive explosion through conservative thresholds and confidence scoring.

**Delivers:**
- BPM analyzer (use Rekordbox data as ground truth, validate with multiple algorithms)
- Key analyzer (musical key compatibility using Camelot Wheel via Tonal.js)
- Waveform analyzer (compare Rekordbox RGB waveform shapes)
- Rhythm analyzer (pattern matching in rhythmic structure)
- Similarity analyzer orchestrating all analyzers with weighted scoring
- Analysis cache implementation with cache-first strategy

**Uses stack:**
- better-sqlite3 for similarity score caching
- Tonal.js for music theory operations
- Potentially Essentia.js for additional analysis validation

**Implements architecture:**
- Similarity Analyzer component
- Analysis Cache Repository
- Pipeline architecture for data flow

**Addresses features:**
- BPM detection (table stakes)
- Key detection (table stakes)
- Waveform analysis (table stakes)
- Flow/transition analysis foundation (core differentiator)

**Avoids pitfalls:**
- Pitfall 2: False positive explosion (conservative thresholds, confidence scoring)
- Pitfall 3: BPM detection accuracy (use Rekordbox data first, multi-algorithm validation)
- Pitfall 4: Memory leaks (batch processing with cleanup, checkpointing)

**Research needs:** MEDIUM — Similarity algorithm requires experimentation with domain-specific requirements. Reverse engineer Rekordbox waveform RGB format (documentation scarce). Survey DJ community on what makes tracks "flow" together.

### Phase 3: Playlist Generation & Suggestions
**Rationale:** With reliable similarity scores cached, Phase 3 implements clustering/graph algorithms to generate cohesive playlist suggestions. This phase transforms analysis data into actionable output for DJs.

**Delivers:**
- Clustering engine to group similar tracks
- Flow optimizer to optimize track order within playlist
- Playlist generator orchestrating generation pipeline
- Playlist suggestion UI with transparent explanations ("why this track?")

**Implements architecture:**
- Playlist Generator component
- Graph-based or clustering algorithms

**Addresses features:**
- Playlist suggestions (core output)
- Track similarity search foundation (differentiator)

**Avoids pitfalls:**
- Pitfall 2: False positive explosion (strict similarity thresholds, explain recommendations)

**Research needs:** MEDIUM — Algorithm selection (Euclidean distance? Cosine similarity? Graph traversal?) requires A/B testing with real DJ libraries. Test different similarity thresholds and measure false positive rate on DJ-curated test set.

### Phase 4: Verification Workflow & Playback
**Rationale:** Trust is critical for DJ tools. Phase 4 implements the unique approve/reject workflow with random sampling playback, allowing DJs to verify suggestions before committing. This differentiates the tool from competitors who provide suggestions without verification.

**Delivers:**
- Playlist viewer UI displaying generated suggestions
- Audio player for track preview (Howler.js for multi-format playback)
- Random sampling playback for quick vibe-checking
- Approve/reject workflow UI
- Waveform renderer for visual verification (WaveSurfer.js + Canvas)

**Uses stack:**
- Howler.js for audio playback
- WaveSurfer.js for waveform visualization
- Blueprint UI for desktop-optimized components

**Implements architecture:**
- Waveform Renderer component
- Audio Player component
- Event-driven architecture for UI responsiveness

**Addresses features:**
- Waveform visualization (table stakes)
- Approve/reject workflow (UNIQUE differentiator)
- Random sampling playback (UNIQUE differentiator)

**Avoids pitfalls:**
- Pitfall 2: False positive explosion (user can reject bad suggestions, builds trust)
- Pitfall 5: UI blocking (async audio loading, responsive playback controls)

**Research needs:** LOW — Audio playback and waveform visualization are well-documented. Usability testing with real DJs to observe workflow and identify pain points.

### Phase 5: Export & Integration
**Rationale:** Final phase closes the loop by exporting approved playlists to M3U format for use in DJ software (rekordbox, Serato, Traktor). This phase integrates the tool into existing DJ workflows.

**Delivers:**
- M3U exporter with relative/absolute path options
- Playlist persistence to SQLite (reload approved playlists across sessions)
- Export options UI (path handling, special character sanitization)

**Implements architecture:**
- M3U Exporter component
- Playlist Repository persistence

**Addresses features:**
- M3U export (table stakes)
- Incremental analysis (persist state across sessions)

**Avoids pitfalls:**
- Pitfall 1: Rekordbox XML bugs (sanitize paths, handle special characters in export)

**Research needs:** LOW — M3U format is well-documented. Test exports load correctly in rekordbox/Serato/Traktor.

### Phase 6: Energy Analysis & Polish (Post-MVP)
**Rationale:** After MVP validation, add energy level detection to upgrade from basic flow to energy-aware flow. This enhances the core differentiator without being required for launch.

**Delivers:**
- Energy level detection (1-10 scale)
- Energy flow visualization across playlist
- Smart playlists/crates (dynamic playlists based on rules)
- Duplicate detection and library cleanup

**Addresses features:**
- Energy level detection (differentiator, planned v1.x)
- Smart playlists (table stakes, deferred from MVP)
- Energy flow visualization (differentiator, planned v1.x)

**Research needs:** HIGH — Energy analysis requires AI-powered tools (Cyanite API, Essentia.js). Define what "energy" means for DJ mixing (BPM + intensity + rhythm density?). A/B test energy-aware suggestions vs. basic flow.

### Phase Ordering Rationale

- **Foundation first (Phase 1):** Cannot proceed without reliable XML parsing and persistence architecture. Background processing patterns established early prevent UI blocking throughout development.
- **Analysis before generation (Phases 2-3):** Playlist generation depends on completed similarity analysis. Caching prevents reprocessing, making iterative development practical.
- **Verification workflow late (Phase 4):** Requires working playlist suggestions to verify. Audio playback is presentational layer, not core logic.
- **Export last (Phase 5):** Final output step after user approval. M3U format is simple, no dependencies.
- **Energy analysis post-MVP (Phase 6):** Nice-to-have enhancement, not required for core value proposition validation.

**Dependency chain:** XML Parsing → Track Database → Similarity Analysis (cached) → Playlist Generation → User Verification → M3U Export

**Performance strategy:** Aggressive caching at Phase 2 enables all subsequent phases. Without cached similarity scores, every Phase 3-6 iteration would require reprocessing 12K tracks.

**Trust strategy:** Conservative thresholds (Phase 2-3) + transparent explanations (Phase 3) + verification workflow (Phase 4) = cumulative trust building.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Analysis Engine):** MEDIUM research need — Rekordbox RGB waveform format is undocumented, requires reverse engineering. Similarity algorithm weights need experimentation with real DJ libraries. Consider `/gsd:research-phase` for waveform format specifically.

- **Phase 3 (Playlist Generation):** MEDIUM research need — Clustering algorithm selection unclear. Graph traversal vs. k-means vs. hierarchical clustering? Test with DJ-curated datasets. Consider `/gsd:research-phase` for algorithm comparison.

- **Phase 6 (Energy Analysis):** HIGH research need — Energy detection is cutting-edge AI territory. Cyanite API licensing? Essentia.js capabilities? What features correlate with DJ "energy"? Definitely needs `/gsd:research-phase`.

Phases with standard patterns (skip research):

- **Phase 1 (Foundation):** LOW research need — XML parsing (fast-xml-parser docs), SQLite (better-sqlite3 docs), Electron background processing (well-documented patterns). Skip additional research.

- **Phase 4 (Verification Workflow):** LOW research need — Audio playback (Howler.js docs), waveform rendering (WaveSurfer.js examples), UI patterns (Blueprint UI docs). Skip additional research.

- **Phase 5 (Export):** LOW research need — M3U format is simple text, extensive examples available. Skip additional research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Electron/React/TypeScript for desktop audio apps is proven. better-sqlite3, fast-xml-parser, Howler.js all have production track records. Version compatibility matrix verified. |
| Features | HIGH | Extensive research from DJ software market (rekordbox, Serato, DJ.Studio, Djoid). Clear table stakes vs. differentiators. Competitor analysis thorough. |
| Architecture | MEDIUM | Layered architecture patterns are standard, but specific Rekordbox RGB waveform format has LOW confidence due to limited official docs. Similarity algorithm weights need experimentation. |
| Pitfalls | MEDIUM | Rekordbox XML bugs well-documented in community (HIGH confidence). False positive research from academic papers (HIGH). BPM/memory/UI pitfalls from production software reports (MEDIUM). Some areas inferred from general best practices. |

**Overall confidence:** MEDIUM-HIGH

Confidence is HIGH for technology stack and feature landscape. Confidence is MEDIUM for architectural details (waveform format) and optimal similarity algorithm implementation. No major unknowns that would block development, but Phases 2-3 will require iterative refinement based on real-world testing.

### Gaps to Address

Research identified areas needing attention during planning/execution:

- **Rekordbox RGB waveform format:** Official documentation is scarce. Reverse engineering required. Can be addressed in Phase 2 by examining actual XML files and testing rendering. Fallback: skip custom waveform rendering, use WaveSurfer.js with audio files directly.

- **Optimal similarity algorithm weights:** What relative importance for BPM vs. key vs. waveform vs. rhythm? Research shows no consensus. Address through A/B testing in Phase 2-3 with real DJ libraries. Start with equal weights, iterate based on false positive rate.

- **Energy level detection implementation:** Research shows multiple approaches (Cyanite AI, Essentia.js, BPM + spectral analysis). Defer to Phase 6 (post-MVP), research thoroughly before implementation since cutting-edge.

- **Windows codec availability:** Research confirms MP3/AAC/FLAC support in Chromium, but user systems may lack codecs. Address in Phase 1 by detecting codec support on startup and providing clear installation instructions (K-Lite Codec Pack link).

- **Rekordbox version differences:** XML format may differ between rekordbox 5.x, 6.x, 7.x. Test with multiple versions during Phase 1. Maintain version detection and compatibility notes.

- **Large library performance thresholds:** Research suggests 12K tracks as target, but actual performance depends on hardware. Phase 1-2 should include performance testing on low-end hardware (8GB RAM, older CPU) to identify bottlenecks early.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [Electron vs. Tauri | DoltHub Blog](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — Architecture and performance comparisons
- [Howler.js](https://howlerjs.com/) — Audio format support verified
- [WaveSurfer.js GitHub](https://github.com/katspaugh/wavesurfer.js) — v7.12.1 confirmed (Dec 2025)
- [better-sqlite3 Releases](https://github.com/WiseLibs/better-sqlite3/releases) — v12.6.2 confirmed (Jan 2026)
- [fast-xml-parser GitHub](https://github.com/NaturalIntelligence/fast-xml-parser) — v5.3.4 confirmed (Jan 2026)
- [Rekordbox XML Format Documentation](https://cdn.rekordbox.com/files/20200410160904/xml_format_list.pdf) — Official format spec

**Features Research:**
- [Lexicon DJ - Library Management For Professional DJs](https://www.lexicondj.com/)
- [Djoid - Music Curation Platform for Djs](https://www.djoid.io/)
- [DJ.Studio Automix Features](https://dj.studio/automix)
- [rekordbox 7 Overview](https://rekordbox.com/en/feature/overview/)
- [Serato DJ 4.0 Beta Brings Major Library Improvements](https://www.digitaldjtips.com/serato-dj-4-beta-library-improved/)
- [Mixed In Key: Software for DJs and Music Producers](https://mixedinkey.com/)

**Architecture Research:**
- [Engine DJ Desktop - Music Management Software](https://enginedj.com/software/enginedj-desktop) — Official docs
- [song2vec: Determining Song Similarity using Deep Unsupervised Learning | Stanford CS229](https://cs229.stanford.edu/proj2017/final-reports/5218770.pdf) — Academic paper on music similarity

**Pitfalls Research:**
- [Rekordbox 5.8.7 can't read xml file properly - Lexicon](https://discuss.lexicondj.com/t/rekordbox-5-8-7-cant-read-xml-file-properly/896) — XML import bug documentation
- [Toward Faultless Content-Based Playlists Generation](https://arxiv.org/pdf/1706.07613) — Academic research on false positives
- [How I Fixed a Critical Memory Leak in My Python Audio App](https://dev.to/highcenburg/how-i-fixed-a-critical-memory-leak-in-my-python-audio-app-42g9) — Memory management pitfalls
- [Beat detection and BPM tempo estimation - Essentia](https://essentia.upf.edu/tutorial_rhythm_beatdetection.html) — BPM detection accuracy

### Secondary (MEDIUM confidence)

**Stack Research:**
- [Tauri vs Electron Comparison 2025](https://www.raftlabs.com/blog/tauri-vs-electron-pros-cons/) — Bundle size and memory benchmarks
- [Offline-first frontend apps 2025: IndexedDB and SQLite](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — Storage comparisons
- [Blueprint UI Documentation](https://www.heroui.com/) — Desktop-optimized components

**Features Research:**
- [The 10 Best AI DJ Tools for 2026 | ZIPDJ](https://www.zipdj.com/blog/best-ai-dj-tools)
- [DJ.Studio - AI-powered software for crafting perfect mixes | Mixmag](https://mixmag.net/feature/dj-studio-ai-tech-mixing-software)
- [VirtualDJ 2026: new AI assistant and revamped FX engine](https://musictech.com/news/gear/virtualdj-2026/)

**Architecture Research:**
- [System Design Interview Question: Design Spotify](https://newsletter.systemdesign.one/p/spotify-system-design) — Playlist generation patterns
- [Calculating Audio Song Similarity Using Siamese Neural Networks | Towards Data Science](https://towardsdatascience.com/calculating-audio-song-similarity-using-siamese-neural-networks-62730e8f3e3d/)

**Pitfalls Research:**
- [The Recommended Music That I Don't Like Are So-Called False Positives - Medium](https://jinhangjiang.medium.com/the-recommended-music-i-dont-like-are-so-called-false-positives-5df25a0d34a8)
- [BPM Detection Technology - Swayzio](https://www.swayzio.com/blog/bpm-detection-technology-how-accurate-tempo-analysis-transforms-music-production)
- [Enhancing Mobile App Performance: Best Practices and Tools - Codebridge](https://www.codebridge.tech/articles/enhancing-mobile-app-performance-best-practices-and-tools)

### Tertiary (LOW confidence, needs validation)

**Architecture Research:**
- [Types of Software Architecture Patterns - GeeksforGeeks](https://www.geeksforgeeks.org/software-engineering/types-of-software-architecture-patterns/) — General patterns, not domain-specific
- [The Architecture of Sound: Workflow Analysis of Generative Audio Tools | DEV](https://dev.to/van_huypham_f0eabcc5d4b2/the-architecture-of-sound-workflow-analysis-of-generative-audio-tools-1mo9) — Generative audio, different domain

**Pitfalls Research:**
- [The algorithm failed music](https://www.jwz.org/blog/2025/11/the-algorithm-failed-music/) — Opinion piece, not research-backed
- [Windows Audio Device Graph Isolation - Razer Insider](https://insider.razer.com/audio-10/windows-audio-device-graph-isolation-solution-76356) — Anecdotal memory leak reports

---
*Research completed: 2026-02-04*
*Ready for roadmap: yes*
