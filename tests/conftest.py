"""Test configuration.

Tests never use the network. Anything that writes data (cache, database, exports)
goes to a temporary ALCOHOL_DATA_HOME, set here before the package is imported.
"""

import os
import shutil
import tempfile
from pathlib import Path

_HOME = Path(tempfile.mkdtemp(prefix="alcohol-data-tests-"))
os.environ["ALCOHOL_DATA_HOME"] = str(_HOME)

import pytest  # noqa: E402

from alcohol_data import paths  # noqa: E402

FIXTURES = paths.ROOT / "tests" / "fixtures"
FIXTURE_BUILD = paths.ROOT / "config" / "builds" / "fixture.yaml"


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_HOME, ignore_errors=True)


@pytest.fixture(scope="session")
def fixture_db():
    """Run fetch (local fixture import only), build and export once for the session."""
    from alcohol_data.acquisition.fetch import acquire, load_pins, save_pins
    from alcohol_data.config import build_assets, load_all_sources, load_build
    from alcohol_data.exports.export import export_all
    from alcohol_data.transforms.build import run_build

    paths.ensure_dirs()
    build = load_build(FIXTURE_BUILD)
    pins = load_pins(build.pins_file)
    for a in build_assets(build, load_all_sources()):
        if a.asset_id in build.local_assets:
            acquire(a, pins, client=None, offline=True, local_file=build.local_assets[a.asset_id])
    save_pins(build.pins_file, pins)
    summary = run_build(FIXTURE_BUILD)
    export_all(["csv", "parquet", "duckdb"])
    return summary


@pytest.fixture
def asset_factory():
    from alcohol_data.config import AssetConfig

    def make(**kw):
        base = dict(
            asset_id="t",
            source_id="s",
            url="https://example.invalid/x.csv",
            method="GET",
            edition="e",
            source_series="series",
            source_vintage="v1",
            format="csv",
            parser=None,
            filename="x.csv",
        )
        base.update(kw)
        return AssetConfig(**base)

    return make
