"""Check that downloaded bytes are what the configuration says they are.

The classic failure this guards against: a server answers 200 with an HTML
error or bot-check page, and a CSV parser happily turns it into rows.
"""

from __future__ import annotations

import json


class SignatureError(ValueError):
    pass


def _looks_like_html(head: bytes) -> bool:
    h = head.lstrip()[:512].lower()
    return h.startswith(b"<!doctype html") or h.startswith(b"<html") or b"<html" in h[:256]


def check_signature(data: bytes, fmt: str, content_type: str | None = None, min_bytes: int = 64) -> None:
    if len(data) < min_bytes:
        raise SignatureError(f"only {len(data)} bytes received (minimum {min_bytes})")
    head = data[:4096]
    ct = (content_type or "").lower()
    if fmt == "html":
        if not _looks_like_html(head):
            raise SignatureError("expected HTML")
        return
    if _looks_like_html(head):
        raise SignatureError(f"expected {fmt} but received an HTML page (content-type {ct or 'unknown'})")
    if fmt == "xlsx":
        if not data.startswith(b"PK\x03\x04"):
            raise SignatureError("expected an XLSX (zip) file; signature PK\\x03\\x04 missing")
    elif fmt == "zip":
        if not data.startswith(b"PK\x03\x04"):
            raise SignatureError("expected a zip archive; signature PK\\x03\\x04 missing")
    elif fmt == "pdf":
        if not data.startswith(b"%PDF"):
            raise SignatureError("expected a PDF; %PDF header missing")
    elif fmt == "json":
        try:
            json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            raise SignatureError(f"expected JSON: {e}") from e
    elif fmt in ("csv", "text_fixed_width", "text"):
        if b"\x00" in head:
            raise SignatureError(f"expected {fmt} text but found NUL bytes")
        if fmt == "csv":
            first = head.split(b"\n", 1)[0]
            if b"," not in first:
                raise SignatureError("expected CSV; first line has no comma")
    else:
        raise SignatureError(f"unknown declared format {fmt!r}")
