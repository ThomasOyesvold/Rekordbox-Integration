# Phase 2 Stress Run - 2026-02-04

## Setup

- XML: `/home/thomas/rekordbox_backup.xml`
- Tracks parsed: `11,328`
- Total theoretical pairs: `64,156,128`
- Pair cap used: `50,000`
- Command:

```bash
npm run stress:phase2 -- --xml /home/thomas/rekordbox_backup.xml --max-pairs 50000
```

## Results

- Parse time: `0.574s`
- Cold analysis time: `703.159s`
- Warm analysis time: `155.309s`
- Cold run:
  - pairs: `50,000`
  - computed: `48,770`
  - cache hits: `1,230`
- Warm run:
  - pairs: `50,000`
  - computed: `0`
  - cache hits: `50,000`

## Memory snapshots

- Start: `rss=50.8MB heapUsed=5.4MB`
- After parse: `rss=193.3MB heapUsed=36.8MB`
- After cold run: `rss=280.0MB heapUsed=73.0MB`
- After warm run: `rss=280.4MB heapUsed=81.6MB`

## Interpretation

- Cache-first behavior works: warm run reused all pairs.
- Runtime improvement is substantial on warm run.
- Memory did not explode between cold and warm pass, but remains elevated at this scale.

## Next stress steps

1. Repeat with folder-scoped runs (`--folders`) to benchmark real workflow slices.
2. Run stepped pair caps: `100k`, `200k`, `500k` and record trend.
3. Add optional progress logging during analysis loop for long runs.
