# Contributing

Corrections and additions are welcome, including ones that weaken the policy argument that motivated the
project. The test for accepting a change is the evidence, not the direction of the result.

## Reporting problems

Use the issue forms: source suggestion, extraction error, policy correction, missing jurisdiction or
year, and analysis concern. Include the URL, period, geography, affected field and evidence. Policy
corrections need the enacted source and your reasoning about the effective date.

## Changing data

- **Parsed sources**: change the adapter in `src/alcohol_data/adapters/`, add a test on a real fixture
  slice in `tests/fixtures/`, and explain the change in `CHANGELOG.md`.
- **Manual extractions** (`data/curated/manual_observations.csv`): copy values exactly as printed, give a
  page/table/row/column locator, and leave `review_status = extracted_unreviewed`. (Policy intervals use the separate
  fields in docs/policy-coding-guide.md.) A different person
  marks `reviewed` after checking against the rendered page, filling `reviewed_by` and `reviewed_on`.
- **Policy intervals** (`data/curated/policy_events.csv` and `policy_evidence.csv`): follow
  `docs/policy-coding-guide.md`. Never fill an unknown date; record what the evidence establishes.
- **New inputs**: add the asset to `config/sources/*.yaml`, run `alcohol-data fetch`, and commit the new
  pin in `config/builds/preview.pins.json` together with the code that parses it.

## Before opening a pull request

```bash
ruff format src tests
ruff check src tests
python -m pytest
alcohol-data build && alcohol-data validate --profile release
cd web && npm test && npm run build
```

If you change a Utah ledger claim in `src/alcohol_data/legal/utah_code.py`, regenerate the ledger
(`alcohol-data legal ledger-utah`) and the review packet (`alcohol-data legal review-packet-utah`) in the
same change; a test fails when the committed ledger no longer matches the claim definitions.

Do not commit API keys, `.env`, raw downloads (`data/raw/`) or generated outputs (`data/processed/`,
`dist/`).
