"""The public release build is the preview build without the sources whose release is gated.

config/builds/public.yaml says so in its header. Sources added to the preview build during the 2026-11-19 development
plan were left out of it until release 0.6.0, so the published manifest did not pin the inputs behind the new pages.
"""

from pathlib import Path

from alcohol_data.config import load_all_sources, load_build

ROOT = Path(__file__).resolve().parents[1]


def test_public_build_is_preview_without_gated_sources():
    preview = load_build(ROOT / "config" / "builds" / "preview.yaml")
    public = load_build(ROOT / "config" / "builds" / "public.yaml")
    gated = {sid for sid, s in load_all_sources(ROOT / "config" / "sources").items() if s.release_gate}
    assert gated, "expected at least one gated source (cdc_cdi)"
    assert set(public.sources) == set(preview.sources) - gated
    assert public.pins_file == preview.pins_file
