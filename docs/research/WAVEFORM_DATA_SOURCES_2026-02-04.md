# Research: Waveform Data Sources (2026-02-04)

## Goal

Identify where true waveform/analysis data can be sourced for Rekordbox libraries, since XML export does not expose full waveform arrays.

## What we validated locally

- XML contains strong `TEMPO` and `POSITION_MARK` coverage.
- XML does **not** contain explicit waveform tags in this dataset.

Local evidence:

- `docs/qa/WAVEFORM_VALIDATION_2026-02-04.md`

## External findings

### 1) Rekordbox XML is limited for waveform envelopes

Community parsing docs and tools emphasize that full analysis data is stored outside XML, in Rekordbox analysis files.

Source:

- pyrekordbox docs (ANLZ file support, waveform/beatgrid extraction):
  - https://pyrekordbox.readthedocs.io/en/stable/generated/pyrekordbox.anlz.html

### 2) Rekordbox analysis files (`ANLZ*.DAT` / `ANLZ*.EXT`) contain waveform data

Open-source parser docs show waveform preview/tiny waveform and beatgrid structures in these files.

Sources:

- pyrekordbox ANLZ parser docs:
  - https://pyrekordbox.readthedocs.io/en/stable/formats/anlz.html
- crate-digger parser (references waveform and beat-grid tags):
  - https://github.com/Deep-Symmetry/crate-digger

### 3) Rekordbox database references analysis-file paths

Reverse-engineered Rekordbox DB docs indicate where analysis file paths are stored and linked to tracks.

Source:

- rekordscrate docs (DjmdContent + analysis path fields):
  - https://rekordscrate.readthedocs.io/en/latest/formats/db6.html

## Recommendation

Implement waveform pipeline from Rekordbox database + ANLZ files:

1. Read Rekordbox DB (`master.db` / `datafile.edb`) for track-to-analysis-file mapping.
2. Parse referenced `ANLZ*.DAT` / `ANLZ*.EXT` files.
3. Extract waveform and beatgrid structures into normalized features.
4. Feed those features into Phase 2 waveform/rhythm scorers.

## Suggested execution order

1. Build a standalone extractor prototype (coverage report + sample payloads).
2. Add fixture-based tests for ANLZ parsing.
3. Integrate features into analyzer with fallback when analysis files are unavailable.
4. Re-run 12K stress tests and compare score quality + runtime.
