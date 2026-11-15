"""One version everywhere: the Python package, the dashboard, the citation and the latest changelog release."""

from __future__ import annotations

import json
import re
import tomllib

from alcohol_data import __version__, paths

ROOT = paths.ROOT


def test_every_place_that_states_the_version_agrees():
    project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
    web = json.loads((ROOT / "web" / "package.json").read_text(encoding="utf-8"))["version"]
    cff = re.search(
        r"^version:\s*['\"]?([^'\"\s]+)", (ROOT / "CITATION.cff").read_text(encoding="utf-8"), re.M
    )
    released = re.search(r"^## (\d+\.\d+\.\d+)\b", (ROOT / "CHANGELOG.md").read_text(encoding="utf-8"), re.M)
    assert cff and released
    # __version__ is written into every build manifest as code_version and into the fetcher's User-Agent.
    assert {
        "pyproject.toml": project,
        "alcohol_data.__version__": __version__,
        "web/package.json": web,
        "CITATION.cff": cff.group(1),
        "CHANGELOG.md": released.group(1),
    } == dict.fromkeys(
        ["pyproject.toml", "alcohol_data.__version__", "web/package.json", "CITATION.cff", "CHANGELOG.md"],
        project,
    )
