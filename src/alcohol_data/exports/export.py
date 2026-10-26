"""Deterministic exports of the canonical build.

CSV, Parquet and the DuckDB file are written from the same database. CSV and
Parquet rows are sorted by each table's key, so the same inputs and code give
the same CSV bytes. The DuckDB file and Parquet files carry writer metadata
(library version, page layout) and are not guaranteed byte-identical across
builds; compare their table contents instead (tests/test_exports.py does).
"""

from __future__ import annotations

import shutil
from pathlib import Path

import duckdb

from alcohol_data import paths
from alcohol_data.schemas.tables import ALL_TABLES

EXPORT_DIR = paths.PROCESSED_DIR / "exports"
VIEWS = {
    "preferred_observations": ("measure_id", "geo_id", "period_start", "period_end", "subgroup"),
    "state_year_long": ("measure_id", "geo_id", "period_start", "period_end"),
    "fiscal_components": ("geo_id", "period_start", "fiscal_component", "measure_id"),
}
EXTRA_TABLES = {"build_info": ("key",)}


def export_objects() -> dict[str, tuple[str, ...]]:
    objs = {t.name: t.order_by() for t in ALL_TABLES if t.export}
    objs.update(EXTRA_TABLES)
    objs.update(VIEWS)
    return objs


def _posix(p: Path) -> str:
    return p.resolve().as_posix().replace("'", "''")


def export_all(
    formats: list[str], database: Path | None = None, out_dir: Path | None = None
) -> dict[str, str]:
    database = database or paths.DATABASE_PATH
    out_dir = out_dir or EXPORT_DIR
    if not database.exists():
        raise FileNotFoundError(f"{paths.rel(database)} not found; run 'alcohol-data build' first")
    unknown = set(formats) - {"csv", "parquet", "duckdb"}
    if unknown:
        raise ValueError(f"unknown export format(s): {sorted(unknown)}")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    written = {}
    con = duckdb.connect(str(database), read_only=True)
    try:
        for name, order in export_objects().items():
            order_sql = ", ".join(order)
            query = f"SELECT * FROM {name} ORDER BY {order_sql}"
            if "csv" in formats:
                d = out_dir / "csv"
                d.mkdir(exist_ok=True)
                con.execute(
                    f"COPY ({query}) TO '{_posix(d / (name + '.csv'))}' (FORMAT CSV, HEADER, DELIMITER ',', QUOTE '\"', DATEFORMAT '%Y-%m-%d')"
                )
            if "parquet" in formats:
                d = out_dir / "parquet"
                d.mkdir(exist_ok=True)
                con.execute(
                    f"COPY ({query}) TO '{_posix(d / (name + '.parquet'))}' (FORMAT PARQUET, COMPRESSION ZSTD)"
                )
        if "csv" in formats:
            written["csv"] = paths.rel(out_dir / "csv")
        if "parquet" in formats:
            written["parquet"] = paths.rel(out_dir / "parquet")
    finally:
        con.close()
    if "duckdb" in formats:
        target = out_dir / "alcohol_data.duckdb"
        src = duckdb.connect(str(database))
        try:
            src.execute("CHECKPOINT")
        finally:
            src.close()
        shutil.copyfile(database, target)
        written["duckdb"] = paths.rel(target)
    return written
