"""DuckDB helpers: create schema, bulk insert rows through Arrow."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import date, datetime
from pathlib import Path

import duckdb
import pyarrow as pa

from alcohol_data.schemas.tables import ALL_TABLES, TABLES

ARROW_TYPES = {
    "VARCHAR": pa.string(),
    "DOUBLE": pa.float64(),
    "BIGINT": pa.int64(),
    "INTEGER": pa.int32(),
    "BOOLEAN": pa.bool_(),
    "DATE": pa.date32(),
    "TIMESTAMP": pa.timestamp("s"),
}

EXTRA_DDL = [
    "CREATE TABLE build_info (key VARCHAR PRIMARY KEY, value VARCHAR NOT NULL);",
]


def connect(path: Path) -> duckdb.DuckDBPyConnection:
    path.parent.mkdir(parents=True, exist_ok=True)
    return duckdb.connect(str(path))


def create_schema(con: duckdb.DuckDBPyConnection) -> None:
    for t in ALL_TABLES:
        con.execute(t.ddl())
    for ddl in EXTRA_DDL:
        con.execute(ddl)


def _coerce(v, typ: str):
    if v is None or v == "":
        return None
    if typ == "BOOLEAN" and isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes")
    if typ == "DATE" and isinstance(v, str):
        return date.fromisoformat(v)
    if typ == "TIMESTAMP" and isinstance(v, str):
        return datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
    if typ in ("INTEGER", "BIGINT") and not isinstance(v, int):
        return int(v)
    if typ == "DOUBLE" and not isinstance(v, float):
        return float(v)
    return v


def insert_rows(con: duckdb.DuckDBPyConnection, table: str, rows: Sequence[dict] | Iterable[dict]) -> int:
    t = TABLES[table]
    rows = list(rows)
    if not rows:
        return 0
    arrays = []
    for c in t.columns:
        arrays.append(pa.array([_coerce(r.get(c.name), c.type) for r in rows], type=ARROW_TYPES[c.type]))
    tbl = pa.Table.from_arrays(arrays, names=t.column_names())
    con.register("_incoming", tbl)
    try:
        con.execute(f"INSERT INTO {table} SELECT * FROM _incoming")
    finally:
        con.unregister("_incoming")
    return len(rows)
