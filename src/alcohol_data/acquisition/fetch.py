"""Acquire source assets: download (politely), verify, hash, cache, and pin.

Raw bytes are stored content-addressed under data/raw/<asset_id>/. A build only
ever reads the bytes whose SHA-256 is pinned in the build's pins file, so an
upstream change is reported as an update event instead of silently changing a
build. Offline mode never touches the network.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx

from alcohol_data import __version__, paths
from alcohol_data.acquisition.redact import redact_body, redact_text, redact_url
from alcohol_data.acquisition.signatures import SignatureError, check_signature
from alcohol_data.config import AssetConfig

USER_AGENT = (
    f"alcohol-policy-revenue-data/{__version__} "
    "(open research data pipeline; https://github.com/ - repository URL set at publication)"
)
TIMEOUT = httpx.Timeout(120.0, connect=30.0)
MAX_ATTEMPTS = 3


class AcquisitionError(RuntimeError):
    pass


@dataclass
class AcquisitionResult:
    asset_id: str
    status: str  # acquired | cached | changed_upstream | manual_required | failed | imported
    sha256: str | None = None
    bytes: int | None = None
    path: str | None = None
    retrieved_at: str | None = None
    url: str | None = None
    http_status: int | None = None
    content_type: str | None = None
    last_modified: str | None = None
    message: str | None = None


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- cache & pins


def asset_dir(asset_id: str) -> Path:
    return paths.RAW_DIR / asset_id


def cached_path(asset: AssetConfig, sha: str) -> Path:
    return asset_dir(asset.asset_id) / f"{sha[:16]}-{asset.filename}"


def find_cached(asset: AssetConfig, sha: str) -> Path | None:
    p = cached_path(asset, sha)
    if p.is_file() and sha256_file(p) == sha:
        return p
    return None


def store_bytes(asset: AssetConfig, data: bytes, meta: dict) -> Path:
    sha = sha256_bytes(data)
    d = asset_dir(asset.asset_id)
    d.mkdir(parents=True, exist_ok=True)
    p = cached_path(asset, sha)
    if not p.exists():
        tmp = p.with_suffix(p.suffix + ".part")
        tmp.write_bytes(data)
        os.replace(tmp, p)
    (d / f"{sha[:16]}.meta.json").write_text(
        json.dumps(meta, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return p


def load_pins(pins_file: Path) -> dict[str, dict]:
    if pins_file.is_file():
        return json.loads(pins_file.read_text(encoding="utf-8"))
    return {}


def save_pins(pins_file: Path, pins: dict[str, dict]) -> None:
    pins_file.parent.mkdir(parents=True, exist_ok=True)
    ordered = {k: pins[k] for k in sorted(pins)}
    pins_file.write_text(json.dumps(ordered, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def log_acquisition(result: AcquisitionResult) -> None:
    paths.RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(paths.ACQUISITION_LOG, "a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(asdict(result), sort_keys=True) + "\n")


# ---------------------------------------------------------------- HTTP


def _tls_context():
    """Verify TLS against the operating system's trust store.

    Some official hosts (le.utah.gov, checked 2026-10-06) do not send their intermediate
    certificate. The OS store can complete such chains on Windows and macOS; Python's
    bundled CA list cannot. Verification is never disabled.
    """
    import ssl

    import truststore

    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


class PoliteClient:
    """httpx client with per-host minimum intervals, bounded retries, and timeouts."""

    def __init__(self, min_interval: dict[str, float] | None = None):
        self.client = httpx.Client(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
            verify=_tls_context(),
        )
        self.min_interval = min_interval or {}
        self.last_request: dict[str, float] = {}

    def close(self) -> None:
        self.client.close()

    def _wait(self, host: str) -> None:
        gap = self.min_interval.get(host, 1.0)
        last = self.last_request.get(host)
        if last is not None:
            delay = gap - (time.monotonic() - last)
            if delay > 0:
                time.sleep(delay)
        self.last_request[host] = time.monotonic()

    def request(
        self,
        method: str,
        url: str,
        *,
        json_body: dict | None = None,
        params: dict | None = None,
        form: dict | None = None,
    ) -> httpx.Response:
        host = urlparse(url).netloc
        err: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            self._wait(host)
            try:
                resp = self.client.request(method, url, json=json_body, params=params, data=form)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                err = e
                time.sleep(2**attempt)
                continue
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < MAX_ATTEMPTS:
                retry_after = resp.headers.get("Retry-After", "")
                time.sleep(float(retry_after) if retry_after.isdigit() else 2**attempt)
                continue
            return resp
        raise AcquisitionError(
            redact_text(f"{method} {redact_url(url)} failed after {MAX_ATTEMPTS} attempts: {err}")
        )


def _auth(asset: AssetConfig) -> tuple[dict, dict]:
    """Return (extra query params, extra JSON body fields) from environment credentials."""
    if not asset.auth:
        return {}, {}
    value = os.environ.get(asset.auth.env, "").strip()
    if not value:
        if asset.auth.required:
            raise AcquisitionError(
                f"{asset.asset_id}: environment variable {asset.auth.env} is required for this asset"
            )
        return {}, {}
    if asset.auth.kind == "query":
        return {asset.auth.param: value}, {}
    return {}, {asset.auth.param: value}


NORMALIZERS_DOC = {
    "bls_api_json": "BLS API JSON with the volatile 'responseTime' field removed, re-serialised with sorted keys",
    "strip_html_request_tokens": "HTML with the per-request anti-forgery token values (__RequestVerificationToken) blanked",
    "strip_passed_bills_timestamp": "Utah passed-bill index HTML with the request time in 'Bills Passed as of <time>' blanked",
    "strip_lis_page_variants": (
        "Virginia Law Library (law.lis.virginia.gov) HTML with the request date in its printDate block blanked and "
        "the Virginia Law Library footer block removed (some of the site's servers add it, others do not)"
    ),
    "unwrap_multipart_pdf": (
        "a PDF that the server sends inside a multipart/form-data envelope (NHTSA crashstats): the envelope is "
        "removed and the PDF bytes from %PDF to the last %%EOF kept"
    ),
}
# Normalizers that recover the document from a wrapper: they run before the file-type check, which the
# wrapped bytes could not pass. The others run after it, on bytes already known to be of the right type.
UNWRAPPERS = {"unwrap_multipart_pdf"}


def normalize(asset: AssetConfig, data: bytes) -> bytes:
    """Remove response noise that changes on every request but carries no content.

    Declared per asset (options.normalize) and applied identically to downloads and
    manual imports, so the pinned hash identifies the content, not the request.
    """
    kind = asset.options.get("normalize")
    if not kind:
        return data
    if kind == "bls_api_json":
        payload = json.loads(data.decode("utf-8"))
        payload.pop("responseTime", None)
        text = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        return (text + "\n").encode("utf-8")
    if kind == "strip_html_request_tokens":
        return HTML_TOKEN.sub(rb"\g<1>\g<2>", data)
    if kind == "strip_passed_bills_timestamp":
        return PASSED_AS_OF.sub(rb"\g<1>", data)
    if kind == "strip_lis_page_variants":
        return LIS_FOOTER.sub(b"", LIS_PRINT_DATE.sub(rb"\g<1>\g<2>", data))
    if kind == "unwrap_multipart_pdf":
        start, end = data.find(b"%PDF"), data.rfind(b"%%EOF")
        if start < 0 or end < start:
            raise AcquisitionError(f"{asset.asset_id}: no PDF inside the response to unwrap")
        return data[start : end + len(b"%%EOF")]
    raise AcquisitionError(f"{asset.asset_id}: unknown normalizer {kind!r}")


def _verified(asset: AssetConfig, raw: bytes, content_type: str | None, min_bytes: int = 64) -> bytes:
    """Check the bytes are the declared file type and apply the asset's normalizer, in the right order."""
    unwrap = asset.options.get("normalize") in UNWRAPPERS
    data = normalize(asset, raw) if unwrap else raw
    try:
        check_signature(data, asset.format, content_type, min_bytes=min_bytes)
    except SignatureError as e:
        raise AcquisitionError(f"{asset.asset_id}: {e}") from e
    return data if unwrap else normalize(asset, data)


HTML_TOKEN = re.compile(rb'(name="__RequestVerificationToken"[^>]*?value=")[^"]*(")')
PASSED_AS_OF = re.compile(rb"(Bills Passed as of )\d{1,2}/\d{1,2}/\d{4} \d{1,2}:\d{2}:\d{2} [AP]M")
LIS_PRINT_DATE = re.compile(rb"(<div id='printDate'>)\d{1,2}/\d{1,2}/\d{4}(</div>)")
LIS_FOOTER = re.compile(
    rb'[ \t]*<div class="va-law-footer" id="valawfooter">.*?(?=[ \t]*<div class="footer">)', re.S
)


def download(asset: AssetConfig, client: PoliteClient) -> tuple[bytes, dict]:
    params, extra_body = _auth(asset)
    body = dict(asset.body or {})
    body.update(extra_body)
    url = asset.url
    if extra_body and asset.options.get("bls_v2_url"):
        url = asset.options["bls_v2_url"]  # keyed requests go to the v2 endpoint
    resp = client.request(asset.method, url, json_body=body or None, params=params or None)
    if resp.status_code != 200:
        raise AcquisitionError(f"{asset.asset_id}: HTTP {resp.status_code} from {redact_url(str(resp.url))}")
    ct = resp.headers.get("Content-Type")
    data = _verified(asset, resp.content, ct)
    if asset.format == "json" and asset.options.get("bls_api"):
        payload = json.loads(data)
        if payload.get("status") != "REQUEST_SUCCEEDED":
            raise AcquisitionError(
                f"{asset.asset_id}: BLS API status {payload.get('status')}: {payload.get('message')}"
            )
    meta = {
        "asset_id": asset.asset_id,
        "url": redact_url(str(resp.url)),
        "request_method": asset.method,
        "request_body": redact_body(asset.body) if asset.body else None,
        "retrieved_at": utc_now(),
        "http_status": resp.status_code,
        "content_type": ct,
        "last_modified": resp.headers.get("Last-Modified"),
        "etag": resp.headers.get("ETag"),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "acquisition_method": "http",
        "normalized": asset.options.get("normalize"),
    }
    return data, meta


def import_local(asset: AssetConfig, file_path: Path, method: str = "local_import") -> AcquisitionResult:
    """Import a manually downloaded or fixture file into the cache."""
    raw = Path(file_path).read_bytes()
    data = _verified(asset, raw, None, min_bytes=16)
    meta = {
        "asset_id": asset.asset_id,
        "url": redact_url(asset.url),
        "request_method": method,
        "retrieved_at": utc_now(),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "acquisition_method": method,
        "imported_from": Path(file_path).name,
    }
    p = store_bytes(asset, data, meta)
    return AcquisitionResult(
        asset.asset_id, "imported", meta["sha256"], len(data), paths.rel(p), meta["retrieved_at"], meta["url"]
    )


def acquire(
    asset: AssetConfig,
    pins: dict[str, dict],
    *,
    client: PoliteClient | None,
    offline: bool,
    local_file: Path | None = None,
    update_pins: bool = False,
    refresh: bool = False,
) -> AcquisitionResult:
    """Make the asset's bytes available locally.

    Without refresh, pinned bytes already in the cache are reused and the network is
    not touched. With refresh, the asset is downloaded again so upstream changes are
    detected (reported as changed_upstream; pins move only with update_pins).
    """
    pin = pins.get(asset.asset_id)

    if local_file is not None:
        res = import_local(asset, local_file, method="fixture_import")
        if update_pins or not pin or pin.get("sha256") != res.sha256:
            pins[asset.asset_id] = _pin_record(asset, res)
        return res

    if offline or asset.method == "manual_import" or not refresh:
        if pin and (p := find_cached(asset, pin["sha256"])):
            return AcquisitionResult(
                asset.asset_id,
                "cached",
                pin["sha256"],
                p.stat().st_size,
                paths.rel(p),
                pin.get("retrieved_at"),
                pin.get("url"),
            )
        if asset.method == "manual_import":
            return AcquisitionResult(
                asset.asset_id,
                "manual_required",
                url=redact_url(asset.url),
                message=(
                    f"Automated download is not available for {asset.asset_id}. Download it manually from "
                    f"{redact_url(asset.url) or 'the source landing page'} and run: "
                    f"alcohol-data import-asset {asset.asset_id} <path-to-file>"
                ),
            )
        if offline:
            raise AcquisitionError(
                f"offline: pinned bytes for {asset.asset_id} "
                f"({(pin or {}).get('sha256', 'no pin')[:16]}) are not in {paths.rel(asset_dir(asset.asset_id))}; "
                "offline mode never falls back to the network"
            )

    if client is None:
        raise AcquisitionError(f"{asset.asset_id}: no network client available")
    data, meta = download(asset, client)
    p = store_bytes(asset, data, meta)
    res = AcquisitionResult(
        asset.asset_id,
        "acquired",
        meta["sha256"],
        meta["bytes"],
        paths.rel(p),
        meta["retrieved_at"],
        meta["url"],
        meta["http_status"],
        meta["content_type"],
        meta["last_modified"],
    )
    if pin and pin.get("sha256") != res.sha256:
        res.status = "changed_upstream"
        if update_pins:
            pins[asset.asset_id] = _pin_record(asset, res)
            res.message = (
                f"pin moved from {pin['sha256'][:16]} (pinned {pin.get('retrieved_at')}) to the new bytes; "
                "rebuild and review with 'report changes' before releasing."
            )
        else:
            res.message = (
                f"upstream bytes differ from pin {pin['sha256'][:16]} (pinned {pin.get('retrieved_at')}). "
                "The new bytes are cached; the build keeps using the pinned bytes until pins are updated "
                "(fetch --refresh --update-pins) and the change is reviewed with 'report changes'."
            )
    elif not pin or update_pins:
        pins[asset.asset_id] = _pin_record(asset, res)
    return res


def _pin_record(asset: AssetConfig, res: AcquisitionResult) -> dict:
    return {
        "sha256": res.sha256,
        "bytes": res.bytes,
        "retrieved_at": res.retrieved_at,
        "url": res.url,
        "edition": asset.edition,
        "filename": asset.filename,
    }


def resolve_pinned(asset: AssetConfig, pins: dict[str, dict]) -> Path | None:
    pin = pins.get(asset.asset_id)
    if not pin:
        return None
    return find_cached(asset, pin["sha256"])


def copy_out(asset: AssetConfig, pins: dict[str, dict], dest: Path) -> Path | None:
    src = resolve_pinned(asset, pins)
    if src is None:
        return None
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / asset.filename
    shutil.copyfile(src, out)
    return out
