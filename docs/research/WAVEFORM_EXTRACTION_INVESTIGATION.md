# Rekordbox Waveform Extraction Investigation

**Date:** 2026-02-04
**Question:** Can we extract RGB waveform data from Rekordbox for flow analysis?
**Answer:** ✅ Yes - ANLZ files contain full waveform data, extraction is feasible

---

## Executive Summary

Rekordbox XML does **not** contain waveform data, but Rekordbox **does** store full RGB waveform arrays in ANLZ analysis files (`.EXT` extension). These files use a well-documented binary format with existing parsing libraries available. Extraction is feasible with medium complexity.

**Recommended approach:** Use existing JavaScript library (`rekordbox-parser`) or Python library (`pyrekordbox`) to parse ANLZ files and extract PWV5 (Color Detail) waveform sections.

---

## Where Waveform Data Lives

### File Locations
- **Database:** `.edb` files (Windows) - SQLite encrypted with SQLCipher (Rekordbox 6/7)
- **Analysis Files:** `ANLZ*.DAT`, `ANLZ*.EXT`, `ANLZ*.2EX`
- **Waveform data specifically:** `.EXT` files (extended analysis)

### Windows Storage Path
```
C:\Users\[Username]\AppData\Roaming\Pioneer\rekordbox\
└── share/
    └── PIONEER/
        └── USBANLZ/  ← Analysis files here
```

**File naming pattern:** `ANLZ0000.EXT`, `ANLZ0001.EXT`, etc.

---

## Waveform Data Format

### PWV4: Color Preview (Fixed Width)
- **Purpose:** Touch strip preview on CDJ-2000NXS2 players
- **Size:** 7,200 bytes (1,200 columns × 6 bytes each)
- **Resolution:** Fixed-width preview of entire track
- **Storage:** `.EXT` files, section code `PWV4`
- **Use case:** Quick overview visualization

### PWV5: Color Detail (Variable Width) ⭐ **Primary Target**
- **Purpose:** High-resolution scrolling waveform during playback
- **Size:** Variable (2 bytes per entry, 150 entries/second of audio)
- **Encoding:** Each 2-byte entry (big-endian):
  ```
  Bits 15-13: Red (3 bits, 0-7)
  Bits 12-10: Green (3 bits, 0-7)
  Bits 9-7:   Blue (3 bits, 0-7)
  Bits 6-2:   Height (5 bits, 0-31 pixels)
  Bits 1-0:   Unused
  ```
- **Resolution:** 150 samples per second (one per half-frame at 75fps)
- **Storage:** `.EXT` files, section code `PWV5`

**Example calculation:** 3-minute track = 180 seconds × 150 entries/sec = **27,000 waveform data points**

### RGB Color Decoding

3-bit values (0-7) need scaling to 8-bit RGB (0-255):

```javascript
function decode3BitToRGB(value3bit) {
  return Math.round((value3bit * 255) / 7);
}

// Example:
// 3-bit value 7 → 255 (full intensity)
// 3-bit value 4 → 145 (mid intensity)
// 3-bit value 0 → 0 (no intensity)
```

---

## Recommended Tools

### Option 1: JavaScript/Node.js - `rekordbox-parser` ⭐ **Recommended**

**Why recommended:** Native JavaScript integration, works in Electron, no external processes needed.

- **NPM Package:** https://www.npmjs.com/package/rekordbox-parser
- **GitHub:** https://github.com/evanpurkhiser/rekordbox-parser
- **Install:** `npm install rekordbox-parser`
- **Status:** Last published 3 years ago, stable
- **Based on:** crate-digger v0.1.6 (Deep Symmetry's reverse engineering work)

**Documented capabilities:**
- ✅ Parses ANLZ binary files
- ✅ Extracts beat grids
- ✅ Extracts cue points
- ❓ PWV4/PWV5 support (not documented but likely supported via crate-digger)

**Usage example:**
```javascript
const RekordboxAnlz = require('rekordbox-parser');
const {SectionTags, parseAnlz} = RekordboxAnlz;
const fs = require('fs');

// Read ANLZ file
const anlzFile = fs.readFileSync('/path/to/ANLZ0000.EXT');
const anlz = parseAnlz(anlzFile);

// Extract beat grid
const beatGrid = anlz.sections.find(
  section => section.fourcc === SectionTags.BEAT_GRID
);
console.log(beatGrid.body.beats);

// Extract cues
const cues = anlz.sections.find(
  section => section.fourcc === SectionTags.CUES
);
console.log(cues.body.cues);

// Check for waveform sections (need to test if exposed)
const waveformDetail = anlz.sections.find(
  section => section.fourcc === 'PWV5'
);
```

**Next step:** Test with real ANLZ files to confirm PWV5 extraction support.

---

### Option 2: Python - `pyrekordbox`

**Why consider:** Most actively maintained, comprehensive documentation, confirmed waveform support.

- **PyPI:** https://pypi.org/project/pyrekordbox/
- **GitHub:** https://github.com/dylanljones/pyrekordbox
- **Install:** `pip install pyrekordbox`
- **Status:** Actively maintained
- **Documentation:** https://pyrekordbox.readthedocs.io/

**Confirmed capabilities:**
- ✅ Full ANLZ parsing including PWV4/PWV5
- ✅ Documentation for waveform extraction
- ✅ Can read .edb databases
- ✅ Actively maintained with recent updates

**Usage example:**
```python
from pyrekordbox.anlz import AnlzFile

# Parse ANLZ file
anlz = AnlzFile.parse_file('/path/to/ANLZ0000.EXT')

# Extract waveform
waveform = anlz.get_tag('PWV5')
for entry in waveform.entries:
    red = entry.red    # 0-7
    green = entry.green  # 0-7
    blue = entry.blue   # 0-7
    height = entry.height  # 0-31
```

**Integration approach:** Use Python script via child process, communicate via JSON/IPC.

---

### Option 3: Rust - `rekordcrate`

**Why consider:** Most recently maintained, strong type safety, performance.

- **GitHub:** https://github.com/Holzhaus/rekordcrate
- **Crates.io:** https://crates.io/crates/rekordcrate
- **Status:** Most actively maintained
- **Language:** Rust

**Capabilities:**
- ✅ Complete ANLZ parsing
- ✅ Strong type safety
- ✅ High performance

**Integration approach:**
1. Create Rust CLI tool that extracts waveforms
2. Call from Node.js via child process
3. OR: Build Node.js native addon using Neon

---

## Implementation Challenges

### Challenge 1: Locating ANLZ Files for Tracks

**Problem:** Need to map XML track IDs to ANLZ filenames.

**Solutions (in order of complexity):**

1. **File naming pattern correlation** (easiest)
   - ANLZ files may use predictable naming based on track hash/ID
   - Test: Check if ANLZ file count matches track count
   - Correlate by track location in library

2. **Scan and metadata match** (medium)
   - Scan USBANLZ folder for all `.EXT` files
   - Parse each ANLZ file's metadata tags
   - Match to XML tracks by BPM, duration, etc.

3. **Parse .edb database** (complex)
   - Read Rekordbox's SQLite database
   - Decrypt with SQLCipher (if Rekordbox 6/7)
   - Query track → ANLZ file path mapping
   - Requires database schema knowledge

**Recommended:** Start with #1, fall back to #2 if needed.

---

### Challenge 2: Library PWV5 Support Verification

**Problem:** `rekordbox-parser` documentation doesn't confirm PWV5 extraction.

**Solutions:**

1. **Test existing library** (1 hour)
   - Install `rekordbox-parser`
   - Parse real `.EXT` file from your library
   - Check if `PWV5` section is exposed
   - If yes: document usage, proceed
   - If no: move to option 2

2. **Extend library** (3-4 hours)
   - Fork `rekordbox-parser`
   - Add PWV5 parsing based on Deep Symmetry docs
   - Submit PR upstream
   - Use fork in project

3. **Use Python instead** (2 hours)
   - Install `pyrekordbox`
   - Create extraction script
   - Call via child process from Node.js
   - Pass waveform data via JSON

**Recommended:** Test first, extend only if necessary.

---

### Challenge 3: RGB Bit Depth Conversion

**Problem:** 3-bit RGB (8 levels) needs display as 8-bit (256 levels).

**Solution (simple):**
```javascript
function decodeWaveformColor(entry) {
  // Extract 3-bit values (0-7)
  const red3bit = (entry >> 13) & 0x07;
  const green3bit = (entry >> 10) & 0x07;
  const blue3bit = (entry >> 7) & 0x07;
  const height = (entry >> 2) & 0x1F;

  // Scale to 8-bit (0-255)
  const red = Math.round((red3bit * 255) / 7);
  const green = Math.round((green3bit * 255) / 7);
  const blue = Math.round((blue3bit * 255) / 7);

  return { red, green, blue, height };
}
```

**Not a significant challenge** - straightforward bit manipulation.

---

## Feasibility Assessment

| Aspect | Feasibility | Effort | Notes |
|--------|-------------|--------|-------|
| **Format documentation** | ✅ Excellent | - | Deep Symmetry's analysis is comprehensive |
| **Existing libraries** | ✅ Good | - | JavaScript, Python, Rust options available |
| **Data accessibility** | ✅ Easy | Low | ANLZ files unencrypted, predictable location |
| **Integration complexity** | 🟡 Medium | Medium | Binary parsing, track correlation needed |
| **Cross-track lookup** | 🟡 Medium | Medium | Need mapping strategy (file pattern or DB) |
| **Performance at scale** | ✅ Good | Low | Binary format efficient, 12K tracks manageable |
| **Windows compatibility** | ✅ Perfect | - | Rekordbox native to Windows, paths well-known |

**Overall:** ✅ **FEASIBLE** - Medium effort, well-documented, existing tools available

**Estimated implementation time:** 10-15 hours (POC → integration → testing)

---

## Comparison: Marker-Based vs Waveform-Based Analysis

| Feature | POSITION_MARK (XML) | PWV5 Waveform (ANLZ) |
|---------|---------------------|----------------------|
| **Coverage** | Only tracks with user-added markers | All analyzed tracks (100% coverage) |
| **Granularity** | Sparse (4-10 points per track) | Dense (150 points per second) |
| **Energy signal** | DJ-curated (high quality) | Computed (consistent) |
| **Availability** | Requires manual DJ effort | Automatic (Rekordbox analysis) |
| **RGB color data** | Yes (marker colors) | Yes (waveform colors) |
| **Flow analysis** | Discrete energy points | Continuous energy curve |
| **Dependency** | Requires DJ workflow | No user action needed |

**Conclusion:** Waveform data provides **universal coverage** and **continuous energy analysis** - critical for multi-factor flow scoring across entire library.

---

## Recommended Implementation Plan

### Phase 1: Proof of Concept (3-4 hours)
**Goal:** Confirm PWV5 extraction works with real data.

1. Install `rekordbox-parser`: `npm install rekordbox-parser`
2. Locate USBANLZ folder on Windows system
3. Create test script: `scripts/testWaveformExtraction.js`
4. Parse one `.EXT` file
5. Extract PWV5 section
6. Decode 100 waveform entries to RGB values
7. Log results and validate format

**Deliverable:** Working script that extracts RGB waveform array from ANLZ file.

**Success criteria:** Can parse ANLZ file and output array of `{red, green, blue, height}` objects.

---

### Phase 2: Track Correlation (4-5 hours)
**Goal:** Map XML tracks to ANLZ waveform files.

1. Study ANLZ file naming pattern in USBANLZ folder
2. Attempt correlation by:
   - Track file hash matching
   - Track position/ID pattern
   - Metadata matching (BPM + duration + key)
3. Build lookup service: `getAnlzPathForTrack(trackId)`
4. Test on 100 random tracks
5. Document correlation strategy

**Deliverable:** Service that returns ANLZ file path for any track ID.

**Success criteria:** 95%+ match rate for tracks with Rekordbox analysis.

---

### Phase 3: Baseline Analyzer Integration (5-6 hours)
**Goal:** Replace waveform proxies with real ANLZ data.

1. Extend `baselineAnalyzerService.js`:
   - Add ANLZ waveform loader
   - Replace proxy waveform data with real PWV5 extraction
   - Compute waveform similarity from RGB arrays
2. Add waveform similarity scoring algorithm:
   - Energy curve comparison (height values over time)
   - Color pattern similarity (RGB distribution)
3. Update analysis results to show waveform component
4. Test on real track pairs

**Deliverable:** Baseline analyzer using real waveform data.

**Success criteria:** Analysis includes waveform similarity score based on ANLZ data.

---

### Phase 4: Validation & Testing (2-3 hours)
**Goal:** Confirm 12K library performance.

1. Update `scripts/validateWaveformExtraction.js`
2. Run stress test with ANLZ extraction
3. Measure performance impact
4. Document findings
5. Update roadmap

**Deliverable:** Validation report confirming ANLZ approach works at scale.

---

## Decision: Proceed with ANLZ Extraction?

### Arguments FOR:
✅ Feasible - well-documented format, existing libraries
✅ Universal coverage - works for all analyzed tracks
✅ Original value prop - enables true waveform-based flow analysis
✅ Continuous data - 150 samples/sec vs sparse markers
✅ Reasonable effort - 10-15 hours total implementation

### Arguments AGAINST:
⚠️ Complexity - binary parsing vs simple XML
⚠️ Track correlation - need mapping strategy
⚠️ Library maturity - `rekordbox-parser` 3 years old
⚠️ Scope creep - adds new data source to Phase 2

### Recommendation: ✅ **Proceed**

**Rationale:**
1. Format is proven and documented
2. Effort is bounded (2 weeks vs unknown)
3. Unlocks differentiating value proposition
4. Provides foundation for sophisticated analysis in future phases

**Next step:** Run Phase 1 proof-of-concept to validate library works with your ANLZ files.

---

## References & Documentation

### Primary Documentation
- **DJ Link Ecosystem Analysis - ANLZ Files**
  https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/anlz.html
  *Most comprehensive technical documentation of ANLZ format*

- **pyrekordbox - Analysis Files Format**
  https://pyrekordbox.readthedocs.io/en/latest/formats/anlz.html
  *Python library documentation with usage examples*

### Libraries
- **rekordbox-parser (JavaScript/Node.js)**
  https://github.com/evanpurkhiser/rekordbox-parser
  https://www.npmjs.com/package/rekordbox-parser

- **pyrekordbox (Python)**
  https://github.com/dylanljones/pyrekordbox
  https://pypi.org/project/pyrekordbox/

- **rekordcrate (Rust)**
  https://github.com/Holzhaus/rekordcrate
  https://crates.io/crates/rekordcrate

### Database Format
- **Rekordbox Database Decoding**
  https://github.com/henrybetts/Rekordbox-Decoding
  *Early reverse engineering work on .edb format*

- **Database Exports - DJ Link Analysis**
  https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/exports.html
  *Database schema documentation*

### Community Resources
- **rekordbox topics on GitHub**
  https://github.com/topics/rekordbox
  *Collection of Rekordbox-related projects*

---

## Appendix: Technical Details

### ANLZ File Structure

```
ANLZ File (.DAT, .EXT, .2EX)
├── Header (4 bytes): "PMAI"
├── File length (4 bytes)
├── Section 1 (tagged)
│   ├── FourCC (4 bytes): e.g. "PWV5"
│   ├── Section length
│   └── Section data
├── Section 2 (tagged)
│   └── ...
└── Section N (tagged)
```

### Common Section Tags

| FourCC | Name | Description | File |
|--------|------|-------------|------|
| PQTZ | Beat Grid | Beat timing information | .DAT |
| PCOB | Cues | Memory cues and loops | .DAT |
| PWAV | Waveform Preview | Monochrome waveform | .DAT |
| PWV4 | Color Preview | RGB fixed-width preview | .EXT |
| PWV5 | Color Detail | RGB high-res scrolling | .EXT |
| PSSI | Song Structure | Phrase analysis | .2EX |

### PWV5 Entry Bit Layout

```
15 14 13 12 11 10  9  8  7  6  5  4  3  2  1  0
├──┴──┴──┼──┴──┴──┼──┴──┴──┼──┴──┴──┴──┴──┼──┴──┤
│  Red   │ Green  │  Blue  │   Height    │ Unu- │
│ (3bit) │ (3bit) │ (3bit) │   (5bit)    │ sed  │
└────────┴────────┴────────┴──────────────┴──────┘
```

**Example decoding:**
```
Binary:  1110 1010 0111 1101 00
Hex:     0xEA7D

Red:   111 (7) → 255
Green: 010 (2) → 73
Blue:  011 (3) → 109
Height: 11101 (29) → 29 pixels
```

---

*Investigation completed: 2026-02-04*
*Status: Feasible - recommend proceeding with proof-of-concept*
