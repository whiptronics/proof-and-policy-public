"""The review packet and source catalog cover every Utah interval and pinned source, and record no review."""

import re

from alcohol_data import paths
from alcohol_data.legal import review_packet as rp


def test_packet_covers_every_utah_interval(tmp_path, monkeypatch):
    monkeypatch.setattr(rp, "PACKET_MD", tmp_path / "packet.md")
    text = rp.review_packet(prior=None).read_text(encoding="utf-8")
    ids = set(re.findall(r"^## `(ut_[a-z0-9_]+)`", text, re.M))
    with open(paths.CURATED_DIR / "policy_events.csv", encoding="utf-8") as f:
        utah = {line.split(",")[0] for line in f if ",state:49," in line}
    assert ids == utah
    assert "maintainer_reviewed" not in text and "[x]" not in text.lower()


def test_catalog_lists_every_pinned_utah_asset(tmp_path, monkeypatch):
    from alcohol_data.acquisition.fetch import load_pins
    from alcohol_data.config import load_all_sources

    monkeypatch.setattr(rp, "CATALOG_MD", tmp_path / "catalog.md")
    text = rp.source_catalog().read_text(encoding="utf-8")
    pins = load_pins(paths.BUILDS_DIR / "preview.pins.json")
    sources = load_all_sources()
    for sid in rp.UTAH_SOURCES:
        for a in sources[sid].assets:
            assert f"`{a.asset_id}`" in text
            if a.asset_id in pins:
                assert pins[a.asset_id]["sha256"][:16] in text
    # Hand-imported files are listed like any other: pinned once imported, otherwise owed.
    volume = next(line for line in text.splitlines() if "`uca_1992_title59_ch15_21`" in line)
    assert volume.endswith("| pinned |") or volume.endswith("| manual import owed |")


def test_comparison_packet_quotes_each_record_as_transcribed_and_records_no_review():
    # docs/review/utah-grocery-wine-comparison-packet.md: every hand-entered record it cites exists, its value matches the
    # transcription, the record is still unreviewed, and the human-review column is empty.
    import csv

    text = (paths.ROOT / "docs" / "review" / "utah-grocery-wine-comparison-packet.md").read_text(
        encoding="utf-8"
    )
    with open(paths.CURATED_DIR / "manual_observations.csv", encoding="utf-8", newline="") as f:
        manual = {r["manual_id"]: r for r in csv.DictReader(f)}
    checked = 0
    for line in text.splitlines():
        if not re.match(r"^\| \d+ \|", line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        assert cells[-1] == "", f"a human-review cell is filled: {cells[0]}"
        ids = [m for m in re.findall(r"`([^`]+)`", line) if m in manual]
        for mid in ids:
            assert manual[mid]["raw_value"] == cells[1], mid
            assert manual[mid]["review_status"] == "extracted_unreviewed", mid
            checked += 1
    assert checked == 6
