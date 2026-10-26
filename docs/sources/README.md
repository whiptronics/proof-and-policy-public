# Sources

The source catalog is generated, not written by hand:

- `metadata/source_registry.csv`: one row per asset (exact URL, edition, retrieval date, SHA-256,
  format, access method, update frequency, observed coverage, rights, extraction status, blockers,
  next action). Regenerate with `alcohol-data sources audit` after a build.
- `metadata/rights_registry.csv`: rights status, redistribution decision and attribution per asset.
- `config/sources/*.yaml`: the definitions both files are generated from.

The narrative audit of what each source does and does not contain is `docs/coverage-audit.md`.

Batches of files downloaded by hand are inventoried file by file, with what was imported, skipped or
blocked and why: [downloads-2026-10-09.md](downloads-2026-10-09.md) (115 files; list in
[downloads-2026-10-09.csv](downloads-2026-10-09.csv)).

Files still to be saved by hand, with what each unlocks: [download-checklist-2026-10-13.md](download-checklist-2026-10-13.md).

Later hand downloads, imported with `alcohol-data import-asset` (the originals stay in
`../Repeal Title 32B Utah`; the pinned copies are in `data/raw/<asset_id>/`):

| Saved | Files | Assets | State |
|---|---|---|---|
| 2026-10-12 | The ten Census Individual Unit File zips, FY2015-FY2024 (`2015-individual-unit-file.zip` ... `2024_Individual_Unit_Files.zip`), matched to their years by the year in every member name and in the records | `census_govfin_unit_fy2015` to `census_govfin_unit_fy2024` | acquired and pinned; not yet parsed ([fiscal-reconciliation.md](../fiscal-reconciliation.md), "After FY2015") |
