# Rekordbox Flow Analyzer

## What This Is

A Windows desktop tool that analyzes Rekordbox music libraries using waveform patterns, BPM, key, and rhythmic data to suggest cohesive playlists for DJ set preparation. Helps DJs with large libraries discover track connections and build flowing sets faster by analyzing what makes tracks work well together.

## Core Value

Correctly identify tracks that flow well together based on multi-factor analysis (waveform patterns, energy curves, BPM, key compatibility, and kick patterns), reducing set preparation time from hours to minutes while maintaining creative control.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Read and parse Rekordbox XML library files
- [ ] Extract track metadata (BPM, key, waveform data, artist, title, genre, bitrate, duration)
- [ ] Folder selection interface (analyze subset of library, not all 12,000 tracks at once)
- [ ] Multi-factor similarity analysis (waveform patterns + BPM + key + rhythmic patterns, equally weighted)
- [ ] Generate playlist suggestions based on flow analysis
- [ ] UI with waveform visualization showing track flow and energy patterns
- [ ] Random sampling playback (play 10-20 random tracks from suggestion to verify vibe)
- [ ] Track list overview display (show all tracks in suggested playlist with metadata)
- [ ] Name and approve/reject workflow for suggested playlists
- [ ] Export approved playlists as M3U files
- [ ] Remember saved playlists (stateful - store playlist definitions and their signatures)
- [ ] Incremental analysis (suggest additions to existing playlists when analyzing new folders)
- [ ] Non-destructive operation (never modify Rekordbox data directly)

### Out of Scope

- Mac/Linux support — Windows-only for v1, focusing on single platform
- Real-time/live performance features — This is for preparation, not live use
- Track-by-track suggestion mode — v1 focuses on complete playlist generation
- Automatic playlist creation without approval — Manual verification required to build trust
- Direct Rekordbox database write — v1 uses M3U export, direct integration deferred to v2
- Track-level editing of suggestions — v1 is approve/reject only, editing deferred to v2
- Regeneration with different criteria — v1 has fixed algorithm, flexibility deferred to v2
- Playlist merging — Deferred to v2
- Re-analysis of audio files — Use Rekordbox's existing analysis data only
- Genre-based organization — Waveform analysis is more reliable than genre tags

## Context

**User Profile:**
- Professional DJ with 12,000+ track library
- Constantly adding new music
- Needs to prep sets that flow smoothly (energy transitions, harmonic mixing, rhythmic compatibility)
- Time spent finding the right track sequences cuts into actual playing/performing time

**Technical Environment:**
- Windows platform
- Rekordbox DJ software (industry-standard library management)
- Rekordbox stores all analysis data in XML export files
- Waveform data is RGB-visualized, contains energy patterns and structure
- Library organized in folders
- Uses M3U playlist format for import/export

**Problem:**
- 12,000 tracks make manual organization overwhelming
- Genre tags are inconsistent and unreliable for finding flow
- Finding tracks that transition well requires listening to thousands of combinations
- Set preparation takes hours of manual searching

**Solution Approach:**
- Use Rekordbox's existing waveform analysis (no re-processing needed)
- Analyze multiple dimensions: waveform structure, energy patterns, BPM, key, kick patterns
- Generate complete playlist suggestions, not track-by-track
- Provide visual (waveform viz) and audio (random sampling) verification
- Let DJ make final decision with meaningful playlist names
- Build up library knowledge incrementally as tool is used

**Key Insight:**
Waveform analysis reveals flow better than genre tags. Two techno tracks might be labeled identically but flow completely differently based on energy curves and kick patterns.

## Constraints

- **Platform**: Windows-only for v1 — Rekordbox XML parsing and file handling optimized for Windows environment
- **Data Source**: Must use Rekordbox XML export format — Cannot modify Rekordbox database directly
- **Non-Destructive**: Never modify existing Rekordbox playlists or folders — Tool is suggestion-only
- **Verification Required**: All suggestions must be manually approved before export — No auto-creation in v1
- **Performance**: Must handle 12,000+ track libraries without performance degradation — Analysis and UI must be responsive
- **Audio Playback**: Must support common DJ formats (MP3, FLAC, WAV, AAC) for random sampling feature
- **Progressive Trust Model**: Start with manual workflow (M3U export), enable automation (direct Rekordbox write) only in v2 after tool proves accuracy

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Rekordbox's waveform analysis instead of re-analyzing | Rekordbox already does excellent analysis; re-analysis would be redundant and slow | — Pending |
| Multi-factor analysis with equal weighting | Flow requires balance of waveform, BPM, key, and rhythms - no single factor dominates | — Pending |
| Complete playlist suggestions vs track-by-track | DJ needs full set flows, not individual transitions; batch approach is more useful | — Pending |
| Stateful tool that remembers playlists | Incremental workflow where tool learns library structure over time; prevents re-analyzing same folders | — Pending |
| M3U export for v1, direct Rekordbox write for v2 | Progressive trust model - prove accuracy with manual workflow before automation | — Pending |
| Random sampling verification (10-20 tracks) | Listening to 200 tracks is impractical; sampling gives accurate vibe check efficiently | — Pending |
| Windows-only for v1 | Focus on single platform to ship faster; majority of Rekordbox users are on Windows | — Pending |

---
*Last updated: 2026-02-04 after initialization*
