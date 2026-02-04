# Phase 2 Stress Test

Use this to verify analysis performance and cache behavior on large libraries (including 12K+ tracks).

## Command

```bash
npm run stress:phase2 -- --xml /home/thomas/rekordbox_backup.xml --max-pairs 200000
```

Optional folder scope:

```bash
npm run stress:phase2 -- --xml /home/thomas/rekordbox_backup.xml --folders "ROOT/Techno,ROOT/Progressive" --max-pairs 150000
```

Optional custom DB path:

```bash
npm run stress:phase2 -- --xml /home/thomas/rekordbox_backup.xml --db .planning/rbfa-stress-techno.db
```

Tip for clean "cold run" benchmarks: use a fresh `--db` file per run step.

## What it does

1. Parses XML in background worker.
2. Filters tracks by selected folders (or all tracks).
3. Runs baseline analysis once ("cold run").
4. Runs baseline analysis a second time ("warm run").
5. Prints timing and memory snapshots.

## Expected output pattern

- `cold` run should have high `computed` count and low cache hits.
- `warm` run should have near-zero `computed` and high cache hits.
- Memory should stay stable after warm run (no unbounded growth).

## Suggested thresholds (starting target)

- Parse time: acceptable for your machine/library size.
- Warm run significantly faster than cold run.
- No crashes at target `--max-pairs`.

## Notes

- Full pairwise on 12K tracks is extremely large (~72M pairs). Use `--max-pairs` cap.
- Increase `--max-pairs` gradually (e.g. 50k -> 100k -> 200k -> 500k) while monitoring memory.
