"""Remove credentials from URLs, request bodies, and messages before they are logged or stored."""

from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

SECRET_PARAM_NAMES = {"key", "api_key", "apikey", "registrationkey", "token", "access_token", "password"}
SECRET_ENV_VARS = ("CENSUS_API_KEY", "BLS_API_KEY")
REDACTED = "REDACTED"


def redact_url(url: str | None) -> str | None:
    if not url:
        return url
    parts = urlparse(url)
    netloc = parts.netloc
    if "@" in netloc:  # user:pass@host
        netloc = f"{REDACTED}@{netloc.split('@', 1)[1]}"
    query = [
        (k, REDACTED if k.lower() in SECRET_PARAM_NAMES else v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
    ]
    return urlunparse(parts._replace(netloc=netloc, query=urlencode(query, safe="$(),'*:")))


def redact_body(body: Any) -> Any:
    if isinstance(body, dict):
        return {k: (REDACTED if k.lower() in SECRET_PARAM_NAMES else redact_body(v)) for k, v in body.items()}
    if isinstance(body, list):
        return [redact_body(v) for v in body]
    return body


def redact_text(text: str) -> str:
    """Scrub any configured secret values that slipped into free text (e.g. exception messages)."""
    for name in SECRET_ENV_VARS:
        val = os.environ.get(name)
        if val and len(val) >= 6:
            text = text.replace(val, REDACTED)
    return re.sub(r"(?i)((?:api_?key|registrationkey|token|key)=)[^&\s]+", rf"\1{REDACTED}", text)
