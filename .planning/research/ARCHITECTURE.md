# Architecture Research

**Domain:** Music Analysis & Playlist Generation Desktop Application
**Researched:** 2026-02-04
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Folder   │  │ Playlist │  │ Waveform │  │  Audio   │        │
│  │ Selector │  │ Viewer   │  │ Renderer │  │  Player  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │              │             │              │
├───────┴─────────────┴──────────────┴─────────────┴──────────────┤
│                      BUSINESS LOGIC LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌───────────────────┐  ┌────────────────┐ │
│  │   Rekordbox    │  │     Similarity    │  │    Playlist    │ │
│  │  XML Parser    │  │     Analyzer      │  │   Generator    │ │
│  └───────┬────────┘  └─────────┬─────────┘  └────────┬───────┘ │
│          │                     │                      │         │
│          └─────────────────────┼──────────────────────┘         │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│                        DATA ACCESS LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ Track Database│  │ Playlist Cache│  │ Analysis Cache│       │
│  │  (In-Memory)  │  │  (SQLite)     │  │   (SQLite)    │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      EXTERNAL LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Rekordbox XML│  │  Audio Files │  │  M3U Export  │          │
│  │    (Read)    │  │   (Read)     │  │   (Write)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Rekordbox XML Parser** | Parse XML library format, extract track metadata (BPM, key, waveform data, etc.) | SAX/DOM parser with custom track model |
| **Similarity Analyzer** | Compute similarity scores between tracks based on BPM, key, waveform, rhythm | Multi-factor algorithm with weighted scoring |
| **Playlist Generator** | Group similar tracks into cohesive playlists using analysis results | Graph-based or clustering algorithm |
| **Track Database** | In-memory store of parsed track metadata for fast access | Hash maps indexed by track ID |
| **Playlist Cache** | Persistent storage of user-approved playlists across sessions | SQLite with tracks and playlist relationships |
| **Analysis Cache** | Store pre-computed similarity scores to avoid reprocessing | SQLite with track pair similarity matrix |
| **Waveform Renderer** | Visualize track waveforms for user review | Canvas/bitmap rendering from waveform data |
| **Audio Player** | Sample track playback for user preview | Native audio API (Windows Media Foundation) |
| **M3U Exporter** | Generate standard playlist files for DJ software | Text file writer with relative/absolute paths |

## Recommended Project Structure

```
RekordboxFlowAnalyzer/
├── src/
│   ├── parsers/              # XML parsing and data extraction
│   │   ├── RekordboxXmlParser.cs
│   │   ├── TrackModel.cs
│   │   └── WaveformParser.cs
│   ├── analysis/             # Similarity computation
│   │   ├── SimilarityAnalyzer.cs
│   │   ├── BpmAnalyzer.cs
│   │   ├── KeyAnalyzer.cs
│   │   ├── WaveformAnalyzer.cs
│   │   └── RhythmAnalyzer.cs
│   ├── generation/           # Playlist creation algorithms
│   │   ├── PlaylistGenerator.cs
│   │   ├── ClusteringEngine.cs
│   │   └── FlowOptimizer.cs
│   ├── storage/              # Persistence layer
│   │   ├── TrackDatabase.cs
│   │   ├── PlaylistRepository.cs
│   │   ├── AnalysisCacheRepository.cs
│   │   └── migrations/
│   ├── rendering/            # Visualization components
│   │   ├── WaveformRenderer.cs
│   │   └── VisualizationHelpers.cs
│   ├── playback/             # Audio playback
│   │   ├── AudioPlayer.cs
│   │   └── AudioEngine.cs
│   ├── export/               # Output generation
│   │   ├── M3uExporter.cs
│   │   └── ExportOptions.cs
│   ├── ui/                   # User interface
│   │   ├── MainWindow.xaml
│   │   ├── MainWindow.xaml.cs
│   │   ├── controls/
│   │   └── viewmodels/
│   └── core/                 # Shared utilities
│       ├── Config.cs
│       ├── Logger.cs
│       └── Extensions.cs
├── tests/
├── docs/
└── RekordboxFlowAnalyzer.sln
```

### Structure Rationale

- **parsers/:** Isolates XML processing logic from analysis. Rekordbox XML format is complex and may change, so keeping parsing separate enables easier maintenance.
- **analysis/:** Multi-factor similarity analysis separated by concern (BPM, key, waveform, rhythm). Allows independent testing and weighting adjustments.
- **generation/:** Playlist generation algorithms isolated from analysis. Different generation strategies can be swapped without affecting similarity computation.
- **storage/:** Centralized persistence layer. SQLite for playlist memory and analysis cache enables fast startup and avoids reprocessing 12,000+ tracks.
- **ui/ and viewmodels/:** MVVM pattern for Windows desktop (WPF recommended). Separates presentation from business logic for testability and maintainability.

## Architectural Patterns

### Pattern 1: Layered Architecture with Caching

**What:** Three-tier architecture (Presentation, Business Logic, Data Access) with strategic caching at the data layer. Similar to traditional desktop audio applications like DAWs and DJ software.

**When to use:** Desktop applications with complex data processing that need responsive UI during heavy computation. Ideal for applications like this that process large datasets (12,000+ tracks) but need instant re-load.

**Trade-offs:**
- PRO: Clear separation of concerns, testable business logic
- PRO: Caching dramatically improves startup time (load cached analysis vs recompute all similarities)
- PRO: Well-understood pattern with extensive tooling support
- CON: Can become over-engineered for simple use cases
- CON: Cache invalidation complexity (when should analysis cache be cleared?)

**Example:**
```csharp
// Layered architecture with cache-first pattern
public class SimilarityAnalyzer
{
    private readonly IAnalysisCacheRepository _cache;
    private readonly IBpmAnalyzer _bpmAnalyzer;
    private readonly IKeyAnalyzer _keyAnalyzer;

    public async Task<SimilarityScore> ComputeSimilarity(Track track1, Track track2)
    {
        // Cache-first: check if we've computed this pair before
        var cached = await _cache.GetSimilarity(track1.Id, track2.Id);
        if (cached != null)
            return cached;

        // Compute if not cached
        var bpmScore = _bpmAnalyzer.Analyze(track1.Bpm, track2.Bpm);
        var keyScore = _keyAnalyzer.Analyze(track1.Key, track2.Key);
        var waveformScore = await _waveformAnalyzer.Analyze(track1.Waveform, track2.Waveform);

        var score = new SimilarityScore(bpmScore, keyScore, waveformScore);

        // Cache for next time
        await _cache.StoreSimilarity(track1.Id, track2.Id, score);
        return score;
    }
}
```

### Pattern 2: Pipeline Architecture for Data Flow

**What:** Data flows through sequential processing stages (Parse → Analyze → Generate → Export). Each stage transforms data and passes to next stage. Common in audio processing systems.

**When to use:** When data must flow through multiple transformation steps with minimal backtracking. Ideal for batch processing workflows like analyzing entire libraries.

**Trade-offs:**
- PRO: Clear data flow, easy to visualize and debug
- PRO: Each stage can be optimized independently
- PRO: Natural fit for progress reporting (track which stage user is in)
- CON: Tightly coupled stage ordering
- CON: Error in one stage blocks entire pipeline

**Example:**
```csharp
// Pipeline pattern for library analysis
public class LibraryAnalysisPipeline
{
    public async Task<List<Playlist>> ProcessLibrary(string xmlPath)
    {
        // Stage 1: Parse
        var tracks = await _parser.ParseXml(xmlPath);

        // Stage 2: Analyze (with progress reporting)
        var similarityGraph = await _analyzer.AnalyzeSimilarities(tracks,
            progress: p => ReportProgress("Analyzing", p));

        // Stage 3: Generate playlists
        var playlists = await _generator.GeneratePlaylists(similarityGraph,
            progress: p => ReportProgress("Generating", p));

        // Stage 4: Cache results
        await _cache.StorePlaylists(playlists);

        return playlists;
    }
}
```

### Pattern 3: Repository Pattern for Persistence

**What:** Abstract data access behind repository interfaces. Separates business logic from storage implementation details (SQLite, file system, etc.).

**When to use:** When storage implementation may change or when testing requires mocking data access. Essential for desktop apps that need to persist user data.

**Trade-offs:**
- PRO: Business logic doesn't know about SQLite or storage format
- PRO: Easy to test with in-memory repositories
- PRO: Can swap storage backend without changing business logic
- CON: Additional abstraction layer
- CON: Overkill for simple CRUD operations

**Example:**
```csharp
// Repository pattern abstracts storage
public interface IPlaylistRepository
{
    Task<List<Playlist>> GetAllPlaylists();
    Task<Playlist> GetPlaylistById(int id);
    Task SavePlaylist(Playlist playlist);
    Task DeletePlaylist(int id);
}

// SQLite implementation
public class SqlitePlaylistRepository : IPlaylistRepository
{
    private readonly string _connectionString;

    public async Task<List<Playlist>> GetAllPlaylists()
    {
        using var conn = new SqliteConnection(_connectionString);
        // SQLite implementation details hidden
        return await conn.QueryAsync<Playlist>("SELECT * FROM playlists");
    }
}

// Business logic uses interface, doesn't know about SQLite
public class PlaylistManager
{
    private readonly IPlaylistRepository _repository;

    public async Task ApprovePlaylist(Playlist playlist)
    {
        playlist.IsApproved = true;
        await _repository.SavePlaylist(playlist);
    }
}
```

### Pattern 4: Event-Driven Architecture for UI Responsiveness

**What:** Components communicate through events rather than direct calls. UI subscribes to business logic events for progress updates and completion notifications.

**When to use:** Desktop applications with long-running operations that need responsive UI. Essential for preventing UI freezes during 12,000+ track analysis.

**Trade-offs:**
- PRO: UI remains responsive during heavy computation
- PRO: Loose coupling between UI and business logic
- PRO: Natural fit for progress reporting and cancellation
- CON: More complex to debug (indirect call paths)
- CON: Event subscription management overhead

**Example:**
```csharp
// Event-driven pattern for long-running analysis
public class SimilarityAnalyzer
{
    public event EventHandler<AnalysisProgressEventArgs> ProgressUpdated;
    public event EventHandler<AnalysisCompletedEventArgs> AnalysisCompleted;

    public async Task AnalyzeLibraryAsync(List<Track> tracks, CancellationToken cancellationToken)
    {
        int total = tracks.Count;
        for (int i = 0; i < total; i++)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            await AnalyzeTrack(tracks[i]);

            // Raise progress event for UI
            ProgressUpdated?.Invoke(this, new AnalysisProgressEventArgs
            {
                Current = i + 1,
                Total = total,
                CurrentTrack = tracks[i].Name
            });
        }

        AnalysisCompleted?.Invoke(this, new AnalysisCompletedEventArgs());
    }
}

// UI subscribes to events
public class MainWindow
{
    private void OnAnalyzeClick(object sender, EventArgs e)
    {
        _analyzer.ProgressUpdated += OnAnalysisProgress;
        _analyzer.AnalysisCompleted += OnAnalysisCompleted;

        await _analyzer.AnalyzeLibraryAsync(_tracks, _cancellationToken);
    }

    private void OnAnalysisProgress(object sender, AnalysisProgressEventArgs e)
    {
        // Update progress bar without blocking
        progressBar.Value = e.Current;
        statusLabel.Text = $"Analyzing {e.CurrentTrack}... ({e.Current}/{e.Total})";
    }
}
```

## Data Flow

### Primary Data Flow: XML to Playlist

```
[User Selects Rekordbox XML]
    ↓
[RekordboxXmlParser] → Parse XML → Extract tracks with metadata
    ↓
[TrackDatabase] ← Store in-memory → Fast lookup during analysis
    ↓
[SimilarityAnalyzer] → For each track pair:
    ↓                     1. Check AnalysisCache (SQLite)
    ↓                     2. If not cached, compute similarity
    ↓                     3. Cache result for next session
    ↓
[SimilarityGraph] → Graph where edges = similarity scores
    ↓
[PlaylistGenerator] → Clustering/graph traversal → Cohesive groups
    ↓
[UI: Playlist Viewer] ← User reviews, approves/rejects
    ↓ (approved)
[PlaylistRepository] → Store approved playlists (SQLite)
    ↓
[M3uExporter] → Generate .m3u files
```

### Incremental Analysis Flow

For performance with 12,000+ tracks, avoid reprocessing:

```
[App Startup]
    ↓
[Check AnalysisCache] → Has XML been processed before?
    ↓ YES                    ↓ NO
[Load cached results]     [Full analysis pipeline]
[from SQLite]             [then cache results]
    ↓                        ↓
[Detect changed XML] ← Compare last modified date
    ↓ Changed                ↓ Unchanged
[Incremental update]      [Use cached data]
[only new/modified]
[tracks]
```

### Key Data Flows

1. **XML Parsing Flow:** Rekordbox XML → SAX Parser → Track objects → In-memory database (Hash map by track ID)
2. **Similarity Computation Flow:** Track pair → Check cache → Compute if missing → Store in cache → Return score
3. **Playlist Generation Flow:** Track database + Similarity graph → Clustering algorithm → Playlist candidates → UI review
4. **Session Persistence Flow:** User approves playlist → PlaylistRepository → SQLite → Restored on next app launch
5. **Export Flow:** Approved playlist → M3U formatter → Write to disk with track file paths

## Build Order Recommendations

Based on dependencies between components, recommended build order:

### Phase 1: Core Data Layer (Build First)
**Why first:** Everything depends on these foundational components.

1. **TrackModel** - Data structure for track metadata
2. **RekordboxXmlParser** - Can test with real XML files immediately
3. **TrackDatabase** - In-memory storage for parsed tracks
4. **Basic UI** - Folder selection, display parsed track count

**Validation:** Can parse Rekordbox XML and display track list.

### Phase 2: Persistence Layer
**Why second:** Enables incremental development of analysis without reprocessing.

5. **SQLite schema design** - Tables for playlists, analysis cache
6. **PlaylistRepository** - Save/load user-approved playlists
7. **AnalysisCacheRepository** - Cache similarity scores
8. **Database migrations** - Schema versioning for future changes

**Validation:** Can persist and restore playlists across app sessions.

### Phase 3: Analysis Engine
**Why third:** Core value proposition, but depends on parsed data.

9. **BpmAnalyzer** - Simplest: numeric comparison
10. **KeyAnalyzer** - Musical key compatibility (Camelot wheel)
11. **WaveformAnalyzer** - More complex: compare waveform shapes
12. **RhythmAnalyzer** - Pattern matching in rhythmic structure
13. **SimilarityAnalyzer** - Orchestrates all analyzers with weighting

**Validation:** Given two tracks, produces similarity score.

### Phase 4: Playlist Generation
**Why fourth:** Requires completed analysis engine.

14. **ClusteringEngine** - Group similar tracks
15. **FlowOptimizer** - Optimize track order within playlist
16. **PlaylistGenerator** - Orchestrates generation pipeline

**Validation:** Generates playlist suggestions from analyzed library.

### Phase 5: UI & Visualization
**Why fifth:** Presentational layer depends on working business logic.

17. **PlaylistViewer** - Display generated playlists
18. **WaveformRenderer** - Visualize track waveforms
19. **AudioPlayer** - Preview tracks before approval
20. **Approval UI** - Accept/reject playlist suggestions

**Validation:** User can review and approve playlists.

### Phase 6: Export
**Why last:** Final output step after user approval.

21. **M3uExporter** - Generate standard playlist files
22. **Export options** - Relative vs absolute paths, etc.

**Validation:** Exported M3U files load correctly in DJ software.

## Storage Strategy

For handling 12,000+ tracks with responsive performance:

### Hybrid Storage Approach

| Storage Type | What | Why | When to Persist |
|--------------|------|-----|-----------------|
| **In-Memory** | Parsed track metadata | Instant access during analysis | Never (reload from XML) |
| **SQLite: analysis_cache** | Track pair similarity scores | Avoid recomputing thousands of comparisons | After each track pair analyzed |
| **SQLite: playlists** | User-approved playlists | Remember across sessions | When user approves playlist |
| **SQLite: app_state** | Last opened folder, analysis date | Quick resume | On app close |

### Schema Design

```sql
-- User-approved playlists
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP,
    is_exported BOOLEAN DEFAULT 0
);

CREATE TABLE playlist_tracks (
    playlist_id INTEGER,
    track_id TEXT,  -- Rekordbox track ID
    position INTEGER,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)
);

-- Analysis cache for performance
CREATE TABLE analysis_cache (
    track1_id TEXT,
    track2_id TEXT,
    similarity_score REAL,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (track1_id, track2_id)
);

CREATE INDEX idx_analysis_cache_track1 ON analysis_cache(track1_id);
CREATE INDEX idx_analysis_cache_track2 ON analysis_cache(track2_id);

-- App state for resume
CREATE TABLE app_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Cache Invalidation Strategy

**When to clear analysis cache:**
- Rekordbox XML file modified (different last modified timestamp)
- User explicitly requests "Re-analyze Library"
- Analysis algorithm version changes (store version in app_state)

**When to keep analysis cache:**
- User reopens same XML file
- User adds to existing playlist (reuse cached scores)
- App restarts (persistence is the point)

### Performance Optimization

For 12,000 tracks:

1. **Lazy loading:** Don't analyze all pairs upfront. Generate playlists from a subset (e.g., tracks played recently).
2. **Batch caching:** Insert cache entries in batches (SQLite transaction) rather than one-by-one.
3. **Indexing:** Index track IDs in analysis_cache for fast lookup.
4. **Pruning:** Periodically remove old cache entries for tracks no longer in library.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **1,000 tracks** | Simple in-memory processing, minimal caching needed. Linear analysis acceptable. |
| **12,000 tracks** | Essential caching strategy, incremental analysis, background processing with progress UI. Target for initial release. |
| **50,000+ tracks** | Consider partial library analysis, user-defined track subsets, parallel processing for similarity computation. May need database instead of in-memory track storage. |

### Scaling Priorities

1. **First bottleneck: Similarity computation** - With 12,000 tracks, full O(n²) pairwise comparison = 144 million comparisons. **Mitigation:** Cache-first strategy, smart sampling (only compare tracks within ±10 BPM), parallel processing.

2. **Second bottleneck: UI responsiveness** - Large playlist rendering, waveform visualization for thousands of tracks. **Mitigation:** Virtual scrolling, lazy waveform rendering, async/await throughout UI layer.

3. **Third bottleneck: Startup time** - Loading 12,000 tracks from XML. **Mitigation:** Background loading, show UI immediately with "Loading..." state, stream parsing (SAX not DOM).

## Anti-Patterns

### Anti-Pattern 1: Recomputing Similarities Every Session

**What people do:** Load XML, compute all similarities, generate playlists. Every single time app opens.

**Why it's wrong:** For 12,000 tracks with smart sampling (10,000 comparisons), even 1ms per comparison = 10 seconds. Without caching, users wait every session. For full pairwise (144M comparisons), would take hours.

**Do this instead:** Implement analysis cache in SQLite. Compute once, cache forever (until XML changes). Check XML last modified timestamp to detect changes.

### Anti-Pattern 2: Loading Entire Library Into UI at Once

**What people do:** Parse 12,000 tracks, bind all to ListBox/DataGrid, let UI framework render everything.

**Why it's wrong:** UI frameworks aren't optimized for rendering thousands of complex items. Causes freezing, high memory usage, slow scrolling.

**Do this instead:** Implement virtual scrolling (only render visible items), lazy loading (load playlists on demand), pagination (show 50-100 tracks at a time).

### Anti-Pattern 3: Blocking UI Thread During Analysis

**What people do:** Start similarity analysis on button click, wait for completion, then update UI. UI freezes for entire duration.

**Why it's wrong:** Users can't cancel, can't see progress, app appears crashed. Windows may show "Not Responding" dialog.

**Do this instead:** Use async/await throughout. Run analysis on background thread, publish progress events, allow cancellation via CancellationToken. Keep UI thread only for rendering.

### Anti-Pattern 4: Storing Absolute Paths in Playlists

**What people do:** Save full Windows paths like "C:\Users\DJ\Music\track.mp3" in playlist database.

**Why it's wrong:** Playlists break if user moves music folder, renames drive, or shares database across machines. Not portable.

**Do this instead:** Store paths relative to Rekordbox library root. M3U export offers both relative and absolute path options. Detect music folder moves and offer to update paths.

### Anti-Pattern 5: Parsing XML with DOM for Large Files

**What people do:** Load entire Rekordbox XML into memory using DOM parser (XmlDocument in C#).

**Why it's wrong:** For 12,000 tracks, XML file can be 50-100MB. DOM parser loads entire tree into memory, slow and memory-intensive.

**Do this instead:** Use streaming parser (XmlReader in C#, SAX-style). Process tracks incrementally, never hold entire XML in memory. 10x faster, 1/10th memory usage.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Rekordbox XML** | File system read, SAX parser | Read-only. XML format stable but undocumented. Reverse-engineered. Watch for format changes in Rekordbox updates. |
| **Audio Files** | Windows Media Foundation (WMF) | For audio playback. Native Windows API. Supports MP3, AAC, FLAC, WAV. |
| **File System Watcher** | .NET FileSystemWatcher | Detect when Rekordbox XML changes, offer to re-analyze. |
| **SQLite** | System.Data.SQLite NuGet | Local persistence. Single file database, no server needed. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **UI ↔ Business Logic** | MVVM pattern, ICommand, INotifyPropertyChanged | UI binds to ViewModels, never directly to business logic. Clean separation. |
| **Business Logic ↔ Data Access** | Repository pattern, interface contracts | Business logic doesn't know about SQLite. Can mock repositories for testing. |
| **Analysis ↔ Parsing** | Direct method calls via interfaces | Analysis receives parsed Track objects. Doesn't know about XML format. |
| **Generation ↔ Analysis** | Similarity graph data structure | Generator consumes graph where nodes=tracks, edges=similarity scores. |

## Sources

**Music Analysis Architecture (2026):**
- [AI Music Analysis 2026: Descriptive AI, Auto-Tagging & Benchmark | Soundcharts](https://soundcharts.com/en/blog/ai-music-analysis-2026) - MEDIUM confidence
- [Types of Software Architecture Patterns - GeeksforGeeks](https://www.geeksforgeeks.org/software-engineering/types-of-software-architecture-patterns/) - LOW confidence

**Playlist Generation Systems:**
- [System Architecture for the Playlist Generation System | ResearchGate](https://researchgate.net/figure/System-Architecture-for-the-Playlist-Generation-System_fig1_275721056) - MEDIUM confidence
- [Apple Music Algorithm Guide 2026 | BeatsToRapOn](https://beatstorapon.com/blog/the-apple-music-algorithm-in-2026-a-comprehensive-guide-for-artists-labels-and-data-scientists/) - MEDIUM confidence
- [System Design Interview Question: Design Spotify](https://newsletter.systemdesign.one/p/spotify-system-design) - MEDIUM confidence

**Audio Analysis Data Flow:**
- [AIoT-Based Framework for Automated English-Speaking Assessment (January 2026) | MDPI](https://www.mdpi.com/2227-9709/13/2/19) - HIGH confidence
- [The Architecture of Sound: Workflow Analysis of Generative Audio Tools | DEV](https://dev.to/van_huypham_f0eabcc5d4b2/the-architecture-of-sound-workflow-analysis-of-generative-audio-tools-1mo9) - LOW confidence

**DJ Software Architecture:**
- [How To Create The Ultimate DJ Music Library In 2026 | ZIPDJ](https://www.zipdj.com/blog/dj-music-library) - MEDIUM confidence
- [Music Management Software | ENGINE DJ DESKTOP](https://enginedj.com/software/enginedj-desktop) - HIGH confidence (official docs)
- [DJ Software: Who's Leading The Way In 2026? - Digital DJ Tips](https://www.digitaldjtips.com/best-dj-software-2026/) - MEDIUM confidence

**Music Similarity Analysis:**
- [song2vec: Determining Song Similarity using Deep Unsupervised Learning | Stanford CS229](https://cs229.stanford.edu/proj2017/final-reports/5218770.pdf) - HIGH confidence (academic paper)
- [Calculating Audio Song Similarity Using Siamese Neural Networks | Towards Data Science](https://towardsdatascience.com/calculating-audio-song-similarity-using-siamese-neural-networks-62730e8f3e3d/) - MEDIUM confidence
- [Music Similarity Detection Guided by Deep Learning Model | PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9970704/) - MEDIUM confidence

**Persistence Patterns:**
- [5+ software architecture patterns you should know in 2026 | SayOne](https://www.sayonetech.com/blog/software-architecture-patterns/) - LOW confidence
- [Software architectures and patterns for persistence in heterogeneous data-intensive systems | Semantic Scholar](https://www.semanticscholar.org/paper/Software-architectures-and-patterns-for-persistence-Schram/86b285a0cc5f8a0f454560a3e8ad30f6a044ea2c) - MEDIUM confidence

---
*Architecture research for: Rekordbox Flow Analyzer*
*Researched: 2026-02-04*
