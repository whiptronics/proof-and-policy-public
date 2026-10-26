# Examples

- `load_csv.py`: read `state_year_long.csv` with the Python standard library only.
- `queries.sql`: example SQL against `alcohol_data.duckdb` (coverage, confidence intervals, candidate
  selection, finance components, policy exposure, lineage).

Neither needs this project's code. The DuckDB command-line tool or `pip install duckdb` is enough for the
SQL examples.

Start from `preferred_observations` or `state_year_long` for one value per cell. Use `observations` when
you need every competing edition or revision.
