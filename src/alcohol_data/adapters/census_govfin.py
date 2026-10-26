"""Census Bureau government finances: the liquor store items of state governments.

Census classifies "liquor stores" as "alcoholic beverage distribution facilities operated by governments
maintaining alcoholic beverage monopoly systems" (Glossary of Government Finances, 1992, shipped in the
IndFin zip). That includes wholesale-only monopolies, so a value here never shows that a state runs retail
stores, and a zero never shows that it does not.

Two Census files, one classification:

* ``_IndFin_1967-2012.zip``, the historical database of individual government finances. Three
  comma-delimited files per survey year (a, b, c) with a heading record. State governments are the records
  with Type Code 0; they exist for FY1972 and FY1977-FY2012 only. File a prints "Liquor Stores Revenue"
  (code A90); file c prints "Liquor Stores-Tot Exp" (total, code -90) and "Liquor Stores-Cap Out".
* ``<yy>statetypepu.zip``, the yearly state-by-type-of-government public-use files (FY2008-FY2015 here).
  One line per item: Census state code and type digit (2 = state government), item code, amount, a
  coefficient of variation and the two-digit year. They print A90, E90 (current operations), F90
  (construction) and G90 (other capital outlay). FY2009-FY2015 print only items that are not zero; FY2008
  prints zeros too, and gives the District of Columbia a type 2 block of zeros, which is skipped (DC has
  no state government record in IndFin and none in the later files).

The four measures follow Census's own formulas (User Guide, sheet "7. Formulas": E90 = total - capital
outlay; capital outlay = F90 + G90). Whatever a file does not print is computed from what it does, flagged
``census_formula`` and carries its inputs. Amounts are thousands of current dollars, stored in dollars.

Census publishes no profit and no transfer item for liquor stores, and the IndFin readme warns that a
difference between revenue and expenditure "does not necessarily indicate a budget surplus or deficit".
Nothing here subtracts one from the other.
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import Rejected, Staged, register
from alcohol_data.config import AssetConfig
from alcohol_data.fiscal import fiscal_period, fiscal_period_for

REVENUE = "census_liquor_stores_revenue"
EXPENDITURE = "census_liquor_stores_expenditure"
CURRENT_OPERATIONS = "census_liquor_stores_current_operations"
CAPITAL_OUTLAY = "census_liquor_stores_capital_outlay"
COMPARABILITY = "census_govfin|state_government|liquor_stores"

# Survey years whose files carry state government records (User Guide, User Notes; checked 2026-10-08).
INDFIN_STATE_YEARS = frozenset([1972, *range(1977, 2013)])
A_COLUMNS = (
    "Year4",
    "ID",
    "State Code",
    "Type Code",
    "Name",
    "FIPS Code-State",
    "FYEndDate",
    "YearofData",
    "Version",
    "ReviseDate",
    "Data_Flag",
    "Imputed Record",
    "Liquor Stores Revenue",
)
C_COLUMNS = ("Year4", "ID", "Liquor Stores-Tot Exp", "Liquor Stores-Cap Out")
MEMBER = re.compile(r"^IndFin(\d{2})([ac])\.txt$", re.I)
# A state government's ID is the state code followed by seven zeros (type 0, no county, no unit).
STATE_ID_A = re.compile(rb'^\d+,\d+,\d{4},"?\d{2}0{7}"?,')
STATE_ID_C = re.compile(rb'^\d+,\d{4},"?\d{2}0{7}"?,')


def _thousands(raw: str) -> int | None:
    t = raw.strip()
    return int(t) if re.fullmatch(r"-?\d+", t) else None


def _base(geo_id, start, end, extraction_method, flags, extra) -> dict:
    return dict(
        geo_id=geo_id,
        period_start=start,
        period_end=end,
        period_kind="state_fiscal_year",
        period_label=f"FY ending {end.isoformat()}",
        year=end.year,
        estimate_type="administrative_amount",
        extraction_method=extraction_method,
        comparability_group=COMPARABILITY,
        raw_unit="thousands_of_dollars",
        multiplier=1000.0,
        fiscal_year_end=end,
        quality_flags=flags,
        extra=extra,
    )


def _amount(measure, thousands, raw, code, loc, base, *, formula=None) -> Staged:
    b = dict(base)
    b["quality_flags"] = list(b["quality_flags"]) + (["census_formula"] if formula else [])
    if formula:
        b["extra"] = dict(b["extra"] or {}, formula=formula)
    return Staged(
        measure_id=measure,
        value=thousands * 1000.0,
        raw_value=raw,
        source_code=code,
        source_locator=loc,
        **b,
    )


def _rows(zf: zipfile.ZipFile, name: str, pattern: re.Pattern) -> tuple[list[str], list[list[str]]]:
    """Heading record and the state government records of one IndFin file."""
    with zf.open(name) as fh:
        header = next(csv.reader([fh.readline().decode("latin-1")]))
        rows = [next(csv.reader([line.decode("latin-1")])) for line in fh if pattern.match(line)]
    return [h.strip() for h in header], rows


@register("census_indfin_state_liquor_stores", "1.0")
def parse_indfin(asset: AssetConfig, path: Path):
    expected_states = int((asset.options or {}).get("expected_state_records", 50))
    zf = zipfile.ZipFile(path)
    members: dict[int, dict[str, str]] = {}
    for name in zf.namelist():
        m = MEMBER.match(name)
        if m:
            yy = int(m.group(1))
            members.setdefault(1900 + yy if yy >= 67 else 2000 + yy, {})[m.group(2).lower()] = name
    if not members:
        yield Rejected(asset.asset_id, "no IndFin<yy>a.txt files in the archive")
        return
    for year in sorted(members):
        parts = members[year]
        if set(parts) != {"a", "c"}:
            yield Rejected(f"survey year {year}", f"files a and c both needed, found {sorted(parts)}")
            continue
        header_a, rows_a = _rows(zf, parts["a"], STATE_ID_A)
        header_c, rows_c = _rows(zf, parts["c"], STATE_ID_C)
        missing = [c for c in A_COLUMNS if c not in header_a] + [c for c in C_COLUMNS if c not in header_c]
        if missing:
            yield Rejected(f"{parts['a']} / {parts['c']}", f"heading lacks columns {missing}")
            continue
        ia = {c: header_a.index(c) for c in A_COLUMNS}
        ic = {c: header_c.index(c) for c in C_COLUMNS}
        states = [r for r in rows_a if r[ia["Type Code"]].strip() == "0"]
        expenditure = {r[ic["ID"]].strip(): r for r in rows_c}
        if not states:
            if year in INDFIN_STATE_YEARS:
                yield Rejected(parts["a"], f"no state government records, but FY{year} should have them")
            continue  # documented: no state records in this survey year
        if len(states) != expected_states:
            yield Rejected(parts["a"], f"{len(states)} state government records, expected {expected_states}")
            continue
        for r in states:
            yield from _indfin_record(asset, year, parts, r, ia, ic, expenditure)


def _indfin_record(asset, year, parts, r, ia, ic, expenditure):
    v = {c: r[i].strip() for c, i in ia.items()}
    cid = v["ID"]
    loc_a = f"{parts['a']}, record ID {cid} ({v['Name']})"
    if v["Year4"] != str(year):
        yield Rejected(loc_a, f"Year4 {v['Year4']} in the FY{year} file")
        return
    st = geo.by_fips(v["FIPS Code-State"])
    if st is None or st.census_gov_code != v["State Code"]:
        yield Rejected(loc_a, f"FIPS {v['FIPS Code-State']} and Census state code {v['State Code']} disagree")
        return
    fy = v["FYEndDate"].zfill(4)
    try:
        end = date(year, int(fy[:2]), int(fy[2:]))
    except ValueError:
        yield Rejected(loc_a, f"FYEndDate {v['FYEndDate']!r} is not a month and day", geo_id=st.geo_id)
        return
    flags = []
    if year >= 1985:
        rule = fiscal_period_for(st.geo_id, year)
        if rule is None or rule[1] != end:
            yield Rejected(
                loc_a,
                f"FYEndDate {fy} disagrees with metadata/fiscal_years.csv ({rule[1] if rule else 'no rule'})",
                geo_id=st.geo_id,
            )
            return
    else:
        flags.append("fiscal_year_end_from_census_record")
    yod = v["YearofData"]
    if yod[:2] != f"{year % 100:02d}" or yod[2:] not in ("", "R"):
        flags.append(f"census_year_of_data_{yod}")
    if v["Imputed Record"] == "1":
        flags.append("census_imputed_record")
    start, _ = fiscal_period(end)
    extra = {
        "census_id": cid,
        "census_name": v["Name"],
        "year_of_data": yod,
        "data_flag": v["Data_Flag"] or None,
        "database_version": v["Version"],
        "revise_date": v["ReviseDate"] or None,
    }
    base = _base(st.geo_id, start, end, "csv_parser", flags, extra)
    rev = _thousands(v["Liquor Stores Revenue"])
    c = expenditure.get(cid)
    loc_c = f"{parts['c']}, record ID {cid}"
    if c is None:
        yield Rejected(loc_c, "state government record missing from file c", geo_id=st.geo_id)
        return
    total = _thousands(c[ic["Liquor Stores-Tot Exp"]])
    capital = _thousands(c[ic["Liquor Stores-Cap Out"]])
    if c[ic["Year4"]].strip() != str(year):
        yield Rejected(loc_c, f"Year4 {c[ic['Year4']]} in the FY{year} file", geo_id=st.geo_id)
        return
    bad = [
        n
        for n, x in (("revenue", rev), ("total expenditure", total), ("capital outlay", capital))
        if x is None or x < 0
    ]
    if bad or capital > total:
        yield Rejected(
            loc_a,
            f"unusable liquor store amounts (revenue {rev}, total {total}, capital outlay {capital})",
            geo_id=st.geo_id,
        )
        return
    yield _amount(REVENUE, rev, str(rev), "A90", f"{loc_a}, column 'Liquor Stores Revenue'", base)
    yield _amount(EXPENDITURE, total, str(total), "-90", f"{loc_c}, column 'Liquor Stores-Tot Exp'", base)
    yield _amount(
        CAPITAL_OUTLAY, capital, str(capital), "F90+G90", f"{loc_c}, column 'Liquor Stores-Cap Out'", base
    )
    yield _amount(
        CURRENT_OPERATIONS,
        total - capital,
        f"{total}-{capital}",
        "E90",
        f"{loc_c}, columns 'Liquor Stores-Tot Exp' minus 'Liquor Stores-Cap Out'",
        base,
        formula="E90 = total expenditure - capital outlay (User Guide, sheet '7. Formulas')",
    )


STATE_TYPE_LINE = re.compile(r"^(\d{2})(\d) (\w{3})\s+(\S+)(?:\s+(\S+))?\s+(\d{2})\s*$")
LIQUOR_ITEMS = ("A90", "E90", "F90", "G90")
LIQUOR_LINE = re.compile(r"^\d{2}2 (A90|E90|F90|G90)\b")


@register("census_state_type_liquor_stores", "1.0")
def parse_state_type(asset: AssetConfig, path: Path):
    fy = int(asset.options["fiscal_year"])
    zf = zipfile.ZipFile(path)
    names = [n for n in zf.namelist() if n.lower().endswith("statetypepu.txt")]
    if len(names) != 1:
        yield Rejected(asset.asset_id, f"expected one <yy>statetypepu.txt in the archive, found {names}")
        return
    name = names[0]
    items: dict[str, dict[str, tuple[int, str, int]]] = {}
    for lineno, line in enumerate(io.TextIOWrapper(zf.open(name), encoding="latin-1"), start=1):
        line = line.rstrip("\r\n")
        if not LIQUOR_LINE.match(line):
            continue
        loc = f"{name} line {lineno}"
        m = STATE_TYPE_LINE.match(line)
        amount = _thousands(m.group(4)) if m else None
        if m is None or amount is None or amount < 0 or int(m.group(6)) != fy % 100:
            yield Rejected(loc, f"liquor store line not read cleanly: {line.strip()!r}")
            continue
        if m.group(1) in ("00", "09"):
            continue  # the U.S. total of state governments, and DC's FY2008 zeros; the 50 states only
        items.setdefault(m.group(1), {})[m.group(3)] = (amount, m.group(4), lineno)
    if not any("A90" in v for v in items.values()):
        yield Rejected(name, "no state government liquor store revenue line (A90) at all")
        return
    for code in sorted(items):
        st = geo.by_census_gov_code(code)
        if st is None:
            yield Rejected(f"{name}, state code {code}", "Census state code not in the crosswalk")
            continue
        per = fiscal_period_for(st.geo_id, fy)
        if per is None:
            yield Rejected(f"{name}, state code {code}", f"no fiscal-year rule for FY{fy}", geo_id=st.geo_id)
            continue
        start, end, rule = per
        flags = [] if rule.verified else ["fiscal_year_dates_not_verified_against_source"]
        got = items[code]
        base = _base(st.geo_id, start, end, "fixed_width_parser", flags, {"state_type_year": fy})

        def loc(*codes, got=got, code=code):
            return f"{name}, " + ", ".join(f"line {got[c][2]} ({code}2 {c})" for c in codes if c in got)

        if "A90" in got:
            yield _amount(REVENUE, got["A90"][0], got["A90"][1], "A90", loc("A90"), base)
        if "E90" in got:
            yield _amount(CURRENT_OPERATIONS, got["E90"][0], got["E90"][1], "E90", loc("E90"), base)
        capital_items = [c for c in ("F90", "G90") if c in got]
        if capital_items:
            yield _amount(
                CAPITAL_OUTLAY,
                sum(got[c][0] for c in capital_items),
                "+".join(got[c][1] for c in capital_items),
                "F90+G90",
                loc(*capital_items),
                base,
                formula="capital outlay = F90 + G90; an item without a line is zero",
            )
        spending = [c for c in ("E90", "F90", "G90") if c in got]
        if spending:
            yield _amount(
                EXPENDITURE,
                sum(got[c][0] for c in spending),
                "+".join(got[c][1] for c in spending),
                "-90",
                loc(*spending),
                base,
                formula="total = E90 + F90 + G90; an item without a line is zero",
            )


# ----- Individual Unit Files, FY2015-FY2024 ------------------------------------------------------------------------
#
# Each yearly zip holds the unit file (``<year>FinEstDAT_<8 digits>modp[_pu].txt``: one fixed-width record per
# government and item, amount in thousands, year of data and an item flag), the government directory
# (``Fin_GID_<year>.txt`` to FY2016, ``Fin_PID_<year>.txt`` from FY2017) and the state-by-level file
# (``<yy>statetypepu.txt``, the layout read above). From FY2022 the members sit inside a folder. Only the 50 state
# governments are read: the records whose third ID character (type) is 0, each of which must be named as its state
# in the directory, carry the fiscal-year end of metadata/fiscal_years.csv, and agree item for item with the
# state-by-level file's level 2 lines. A state that fails any of these is rejected whole, never patched.


@dataclass(frozen=True)
class UnitLayout:
    directory: str  # member prefix: Fin_GID or Fin_PID
    state_codes: str  # "census" (Alabama 01 ... Wyoming 51) or "fips"
    id_len: int
    directory_len: int
    fy_end_at: (
        int  # 0-based start of the directory's fiscal-year end (MMDD), followed by the survey year (YY)
    )
    record_lens: tuple[int, ...]


# FY2015-FY2016 (Technical Documentation 2015): 14-character IDs, 34-character records, 153-character directory with
# the FIPS state code at positions 114-115. From FY2017: FIPS codes in 12-character IDs, 32-character records (the
# FY2024 documentation says 33 with a two-character flag; the files have 32), 146-character directory.
GID_LAYOUT = UnitLayout("Fin_GID", "census", 14, 153, 147, (34,))
PID_LAYOUT = UnitLayout("Fin_PID", "fips", 12, 146, 140, (32, 33))
PID_FROM_FY = 2017
NO_G_ITEM_FROM_FY = 2022  # the item list and the files have no G (other capital outlay) item from FY2022
OREGON = "state:41"
STATE_GOVERNMENTS = 50
UNIT_DATA = re.compile(r"^(\d{4})FinEstDAT_\d{8}modp(?:_pu)?\.txt$", re.I)
UNIT_DIRECTORY = re.compile(r"^Fin_(GID|PID)_(\d{4})\.txt$", re.I)
UNIT_STATE_LEVEL = re.compile(r"^(\d{2})statetypepu\.txt$", re.I)
GROUP_NO_G_ITEM = "no_g_item_from_fy2022"
GROUP_OREGON_UNIT = "oregon_unit_files"


def unit_layout(fy: int) -> UnitLayout:
    return PID_LAYOUT if fy >= PID_FROM_FY else GID_LAYOUT


def unit_comparability_group(measure: str, fy: int, geo_id: str) -> str:
    """Breaks the unit files bring: capital outlay and total expenditure lose the G items from FY2022, and Oregon's
    current operations run 0.62-0.75 of revenue in every unit file against 0.49-0.51 in FY2008-FY2015 (the FY2015
    release pair shows the change inside one fiscal year), so neither continues the earlier series."""
    parts = [COMPARABILITY]
    if geo_id == OREGON and measure in (CURRENT_OPERATIONS, EXPENDITURE):
        parts.append(GROUP_OREGON_UNIT)
    if fy >= NO_G_ITEM_FROM_FY and measure in (CAPITAL_OUTLAY, EXPENDITURE):
        parts.append(GROUP_NO_G_ITEM)
    return "|".join(parts)


def _unit_members(zf: zipfile.ZipFile, fy: int, layout: UnitLayout) -> dict[str, str] | str:
    """The three members by role, or the reason they cannot be identified."""
    found: dict[str, list[str]] = {"data": [], "directory": [], "state_level": []}
    for name in zf.namelist():
        base = name.rsplit("/", 1)[-1]
        if m := UNIT_DATA.match(base):
            if int(m.group(1)) == fy:
                found["data"].append(name)
        elif m := UNIT_DIRECTORY.match(base):
            if int(m.group(2)) == fy and f"Fin_{m.group(1).upper()}" == layout.directory:
                found["directory"].append(name)
            else:
                return f"directory {base} does not fit FY{fy} (expected {layout.directory}_{fy}.txt)"
        elif m := UNIT_STATE_LEVEL.match(base):
            if int(m.group(1)) == fy % 100:
                found["state_level"].append(name)
    bad = {k: v for k, v in found.items() if len(v) != 1}
    if bad:
        return f"expected one unit file, one {layout.directory}_{fy}.txt and one {fy % 100:02d}statetypepu.txt; found {found}"
    return {k: v[0] for k, v in found.items()}


def _unit_state(code: str, layout: UnitLayout):
    return geo.by_census_gov_code(code) if layout.state_codes == "census" else geo.by_fips(code)


@register("census_unit_liquor_stores", "1.0")
def parse_unit(asset: AssetConfig, path: Path):
    fy = int(asset.options["fiscal_year"])
    layout = unit_layout(fy)
    zf = zipfile.ZipFile(path)
    members = _unit_members(zf, fy, layout)
    if isinstance(members, str):
        yield Rejected(asset.asset_id, members)
        return
    data_name, dir_name, level_name = members["data"], members["directory"], members["state_level"]
    data_base, dir_base, level_base = (n.rsplit("/", 1)[-1] for n in (data_name, dir_name, level_name))

    # 1. The directory: exactly the 50 state governments, each named as its state.
    directory: dict[str, tuple[int, str]] = {}
    with zf.open(dir_name) as fh:
        for lineno, raw in enumerate(fh, start=1):
            line = raw.decode("latin-1").rstrip("\r\n")
            if len(line) > 2 and line[2] == "0":
                directory[line[: layout.id_len]] = (lineno, line)
    if len(directory) != STATE_GOVERNMENTS:
        yield Rejected(
            dir_base, f"{len(directory)} state government records (type 0), expected {STATE_GOVERNMENTS}"
        )
        return
    states: dict[str, dict] = {}  # government ID -> what the checks established
    seen_geo: dict[str, str] = {}
    for gid, (lineno, line) in sorted(directory.items()):
        loc = f"{dir_base} line {lineno} (ID {gid})"
        st = _unit_state(gid[:2], layout)
        name = line[layout.id_len : layout.id_len + 64].strip()
        if len(line) != layout.directory_len:
            yield Rejected(
                loc, f"directory record of {len(line)} characters, expected {layout.directory_len}"
            )
            continue
        if st is None or name != st.name.upper():
            yield Rejected(
                loc,
                f"state code {gid[:2]} ({layout.state_codes} codes) is "
                f"{st.name if st else 'not in the crosswalk'}, but the directory names {name!r}",
                geo_id=st.geo_id if st else None,
            )
            continue
        if st.geo_id in seen_geo:
            yield Rejected(
                loc, f"second state government record for {st.name} ({seen_geo[st.geo_id]})", geo_id=st.geo_id
            )
            continue
        seen_geo[st.geo_id] = gid
        if layout.state_codes == "census" and line[113:115] != st.fips:
            yield Rejected(
                loc,
                f"directory FIPS state code {line[113:115]!r} is not {st.name}'s {st.fips}",
                geo_id=st.geo_id,
            )
            continue
        fy_end, survey = (
            line[layout.fy_end_at : layout.fy_end_at + 4],
            line[layout.fy_end_at + 4 : layout.fy_end_at + 6],
        )
        per = fiscal_period_for(st.geo_id, fy)
        if per is None:
            yield Rejected(loc, f"no fiscal-year rule for FY{fy}", geo_id=st.geo_id)
            continue
        start, end, rule = per
        if survey != f"{fy % 100:02d}" or fy_end != f"{end.month:02d}{end.day:02d}":
            yield Rejected(
                loc,
                f"directory fiscal-year end {fy_end!r} and survey year {survey!r} disagree with FY{fy} ending "
                f"{end.isoformat()} (metadata/fiscal_years.csv)",
                geo_id=st.geo_id,
            )
            continue
        states[gid] = {
            "state": st,
            "name": name,
            "start": start,
            "end": end,
            "rule": rule,
            "dir_line": lineno,
        }

    # 2. The unit records of those governments' liquor store items.
    items: dict[str, dict[str, tuple[int, str, str, int]]] = {gid: {} for gid in directory}
    broken: dict[str, str] = {}
    with zf.open(data_name) as fh:
        for lineno, raw in enumerate(fh, start=1):
            if raw[2:3] != b"0":
                continue
            line = raw.decode("latin-1").rstrip("\r\n")
            gid, item = line[: layout.id_len], line[layout.id_len : layout.id_len + 3]
            if item not in LIQUOR_ITEMS:
                continue
            loc = f"{data_base} line {lineno} (ID {gid}, {item})"
            if gid not in directory:
                yield Rejected(loc, "state government record (type 0) not in the directory")
                continue
            amount_raw = line[layout.id_len + 3 : layout.id_len + 15]
            year_raw = line[layout.id_len + 15 : layout.id_len + 19]
            flag = line[layout.id_len + 19 :].strip()
            amount = _thousands(amount_raw)
            problem = None
            if len(line) not in layout.record_lens:
                problem = (
                    f"record of {len(line)} characters, expected {' or '.join(map(str, layout.record_lens))}"
                )
            elif amount is None or amount < 0:
                problem = f"amount {amount_raw.strip()!r} is not a non-negative whole number"
            elif year_raw != str(fy):
                problem = f"year of data {year_raw!r} in the FY{fy} file"
            elif not re.fullmatch(r"[A-Z]{1,2}", flag):
                problem = f"item flag {flag!r} not read"
            elif item == "G90" and fy >= NO_G_ITEM_FROM_FY:
                problem = "a G item, but the item list has none from FY2022"
            elif item in items[gid]:
                problem = f"second {item} record (first on line {items[gid][item][3]})"
            if problem:
                broken.setdefault(gid, f"{loc}: {problem}")
                continue
            items[gid][item] = (amount, amount_raw.strip(), flag, lineno)

    # 3. The state-by-level file's level 2 (state government total) liquor lines.
    level2: dict[str, dict[str, tuple[int, int]]] = {}
    with zf.open(level_name) as fh:
        for lineno, raw in enumerate(fh, start=1):
            line = raw.decode("latin-1").rstrip("\r\n")
            if not LIQUOR_LINE.match(line):
                continue
            m = STATE_TYPE_LINE.match(line)
            amount = _thousands(m.group(4)) if m else None
            if m is None or amount is None or amount < 0 or int(m.group(6)) != fy % 100:
                yield Rejected(
                    f"{level_base} line {lineno}", f"liquor store line not read cleanly: {line.strip()!r}"
                )
                continue
            if m.group(1) != "00":  # the U.S. total of state governments
                level2.setdefault(m.group(1), {})[m.group(3)] = (amount, lineno)
    codes = {gid[:2] for gid in directory}
    for code in sorted(set(level2) - codes):
        yield Rejected(
            f"{level_base}, state code {code}",
            f"level 2 liquor lines {level2[code]} with no state government",
        )

    # 4. One state at a time: every check passed, or nothing from that state.
    for gid in sorted(states):
        s = states[gid]
        st = s["state"]
        got = items[gid]
        if gid in broken:
            yield Rejected(
                broken[gid], "state government's liquor store records not read cleanly", geo_id=st.geo_id
            )
            continue
        lv = level2.get(gid[:2], {})
        if {k: v[0] for k, v in got.items()} != {k: v[0] for k, v in lv.items()}:
            yield Rejected(
                f"{data_base}, ID {gid} ({s['name']}); {level_base}",
                f"unit records { ({k: v[0] for k, v in sorted(got.items())}) } disagree with the level 2 lines "
                f"{ ({k: v[0] for k, v in sorted(lv.items())}) }",
                geo_id=st.geo_id,
            )
            continue
        if got:
            yield from _unit_measures(asset, fy, gid, s, got, lv, data_base, level_base)


def _unit_measures(asset, fy, gid, s, got, lv, data_base, level_base):
    st, end = s["state"], s["end"]
    flags = [] if s["rule"].verified else ["fiscal_year_dates_not_verified_against_source"]
    if "A90" not in got:
        flags.append("census_expenditure_without_revenue")
    elif "E90" in got and got["E90"][0] == got["A90"][0]:
        flags.append("census_expenditure_equals_revenue")
    extra = {
        "census_id": gid,
        "census_name": s["name"],
        "unit_file_year": fy,
        "item_flags": {k: v[2] for k, v in sorted(got.items())},
    }
    g_items = ("F90", "G90") if fy < NO_G_ITEM_FROM_FY else ("F90",)

    def loc(*codes):
        return (
            f"{data_base}, "
            + ", ".join(f"line {got[c][3]} (ID {gid}, {c})" for c in codes)
            + f"; equal to {level_base} "
            + ", ".join(f"line {lv[c][1]}" for c in codes)
        )

    def obs(measure, codes, code_label, formula=None):
        present = [c for c in codes if c in got]
        if not present:
            return None
        item_flags = sorted({f"census_item_flag_{got[c][2]}" for c in present if got[c][2] != "R"})
        absent = [c for c in codes if c not in got]
        mflags = [f for f in flags if measure != REVENUE or f != "census_expenditure_without_revenue"]
        if measure in (CAPITAL_OUTLAY,) and "census_expenditure_equals_revenue" in mflags:
            mflags.remove("census_expenditure_equals_revenue")
        x = dict(extra)
        if formula and absent:
            x["absent_items_counted_as_zero"] = absent
        b = _base(st.geo_id, s["start"], end, "fixed_width_parser", mflags + item_flags, x)
        b["comparability_group"] = unit_comparability_group(measure, fy, st.geo_id)
        return _amount(
            measure,
            sum(got[c][0] for c in present),
            "+".join(got[c][1] for c in present),
            code_label,
            loc(*present),
            b,
            formula=formula,
        )

    capital_formula = (
        "capital outlay = F90 + G90; an item without a record is zero"
        if fy < NO_G_ITEM_FROM_FY
        else "capital outlay = F90; the files have no G item from FY2022 (a separate comparability group)"
    )
    total_formula = (
        "total = E90 + F90 + G90; an item without a record is zero"
        if fy < NO_G_ITEM_FROM_FY
        else "total = E90 + F90; the files have no G item from FY2022 (a separate comparability group); "
        "an item without a record is zero"
    )
    for o in (
        obs(REVENUE, ("A90",), "A90"),
        obs(CURRENT_OPERATIONS, ("E90",), "E90"),
        obs(CAPITAL_OUTLAY, g_items, "F90+G90" if fy < NO_G_ITEM_FROM_FY else "F90", capital_formula),
        obs(EXPENDITURE, ("E90", *g_items), "-90", total_formula),
    ):
        if o is not None:
            yield o
