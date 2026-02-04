# Waveform Extraction Validation - 2026-02-04

Command:

```bash
npm run validate:waveform -- --xml /home/thomas/rekordbox_backup.xml
```

## Findings (11,328 tracks)

- Tracks with `TEMPO`: `11,326` (`99.98%`)
- Tracks with `POSITION_MARK`: `10,594` (`93.52%`)
- Tracks with RGB-colored position marks: `10,594` (`93.52%`)
- Tracks with loop marks (`Type=4`): `293` (`2.59%`)

Likely waveform tags present in XML:

- `WAVEFORM`: `0`
- `WAVEFORM_PREVIEW`: `0`
- `WAVE`: `0`
- `BEATGRID`: `0`
- `PHRASE`: `0`

## Conclusion

Rekordbox XML in this library does **not** include explicit waveform arrays/tags.  
What we can reliably extract from XML is:

- beat grid / tempo map (`TEMPO`)
- cue/loop/marker structure + RGB marker colors (`POSITION_MARK`)

So Phase 2 can use real Rekordbox XML timing + marker color data, but not full waveform envelopes from this XML export format alone.

## Implication for roadmap

- Current nested metadata scoring is valid for XML-available signals.
- True waveform-envelope analysis likely needs another data source (e.g., Rekordbox analysis files), not XML alone.
