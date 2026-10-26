"""The figure in ut_dabs_operating_nonoperating_expenses is DABS's operating expenses only.

DABS's five-year summary prints it as "Operating and Non-Operating Expenses", but in FY2024 and FY2025 it
equals the income statement's Total Operating Expenses, which lists depreciation, amortization and interest
separately as non-operating (90th Annual Report, p. 30). These checks keep the dataset label and the Utah
grocery-wine outputs from presenting it as total expenses again. The identifier keeps the printed wording for
compatibility.
"""

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEASURE = "ut_dabs_operating_nonoperating_expenses"
BRIEFING = ROOT / "docs" / "briefings" / "utah-grocery-wine"

# Wordings that would present the operating-expense figure as every expense.
FORBIDDEN = [
    re.compile(r"all (?:of DABS.s )?operating and non-operating expenses", re.IGNORECASE),
    re.compile(r"operating and non-operating expenses (?:were|was|is|are)\b", re.IGNORECASE),
    re.compile(r"every DABS expense avoidable", re.IGNORECASE),
    re.compile(r"all of DABS.s expenses \((?:14|15)", re.IGNORECASE),
]


def _row(name: str, key: str) -> dict[str, str]:
    with open(ROOT / "metadata" / name, encoding="utf-8", newline="") as f:
        return next(r for r in csv.DictReader(f) if r[key] == MEASURE)


def _displayed() -> list[Path]:
    web = ROOT / "web" / "src"
    code = [p for p in sorted([*web.rglob("*.ts"), *web.rglob("*.tsx")]) if ".test." not in p.name]
    # brief.md and review-packet.md are private and absent from the public repository.
    docs = [BRIEFING / n for n in ("brief.md", "technical-appendix.md", "review-packet.md")]
    return [*code, *(p for p in docs if p.exists())]


def test_the_measure_is_labelled_operating_expenses_not_total_expenses():
    m = _row("measures.csv", "measure_id")
    label = m["label"].lower()
    assert label.startswith("dabs operating expenses")
    assert "total" not in label
    definition = m["definition"].lower()
    assert "excludes depreciation" in definition
    assert "interest" in definition
    assert "not total expenses" in definition
    assert _row("measure_concepts.csv", "concept_id")["concept_label"] == m["label"]


def test_displayed_text_does_not_call_operating_expenses_all_expenses():
    hits = []
    for path in _displayed():
        text = path.read_text(encoding="utf-8")
        for pattern in FORBIDDEN:
            hits += [f"{path.relative_to(ROOT)}: {m.group(0)!r}" for m in pattern.finditer(text)]
    assert not hits, hits
