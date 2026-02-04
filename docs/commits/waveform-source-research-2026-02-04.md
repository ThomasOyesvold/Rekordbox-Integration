# waveform-source-research-2026-02-04

- Why: after closing Phase 1, de-risk next phase by identifying where true waveform data must come from.

## Files Changed

- `docs/research/WAVEFORM_DATA_SOURCES_2026-02-04.md`
- `README.md`

## Summary

- Documented that XML alone does not provide full waveform arrays in current dataset.
- Collected external references pointing to Rekordbox analysis files (`ANLZ*.DAT`/`ANLZ*.EXT`) and DB mapping.
- Defined recommended implementation path for real waveform feature ingestion.

## Validation

- Research links and conclusions align with local XML validation findings.

## Risk Notes

- ANLZ parsing depends on reverse-engineered formats and should be guarded with robust fixture tests.
