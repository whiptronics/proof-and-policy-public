import json

import pytest

from alcohol_data.acquisition import fetch
from alcohol_data.acquisition.redact import REDACTED, redact_body, redact_text, redact_url
from alcohol_data.acquisition.signatures import SignatureError, check_signature
from alcohol_data.config import safe_filename

HTML_ERROR = (
    b"<!DOCTYPE html><html><head><title>Access Denied</title></head><body>Request blocked</body></html>" * 3
)


def test_html_error_page_is_not_accepted_as_csv():
    with pytest.raises(SignatureError, match="HTML"):
        check_signature(HTML_ERROR, "csv", "text/html")


def test_html_error_page_is_not_accepted_as_fixed_width_text_or_xlsx():
    for fmt in ("text_fixed_width", "xlsx", "zip", "pdf", "json"):
        with pytest.raises(SignatureError):
            check_signature(HTML_ERROR, fmt, "text/html")


def test_signatures_accept_real_formats():
    check_signature(b"ITEM,US,AL\nT10,1,2\n" * 10, "csv")
    check_signature(b"%PDF-1.4\n" + b"0" * 100, "pdf")
    check_signature(b"PK\x03\x04" + b"0" * 100, "xlsx")
    check_signature(b"PK\x03\x04" + b"0" * 100, "zip")
    check_signature(json.dumps({"a": list(range(40))}).encode(), "json")


def test_truncated_download_rejected():
    with pytest.raises(SignatureError, match="bytes"):
        check_signature(b"a,b\n", "csv")


def test_redaction_of_keys_in_urls_bodies_and_messages(monkeypatch):
    monkeypatch.setenv("CENSUS_API_KEY", "supersecretkey123")
    url = "https://api.census.gov/data/x?get=NAME&key=supersecretkey123&for=state:*"
    assert "supersecretkey123" not in redact_url(url)
    assert f"key={REDACTED}" in redact_url(url)
    assert redact_body({"seriesid": ["X"], "registrationkey": "abc"})["registrationkey"] == REDACTED
    assert "supersecretkey123" not in redact_text(
        "failed GET ...?key=supersecretkey123 (timeout) supersecretkey123"
    )


def test_query_strings_never_reach_cache_filenames():
    name = safe_filename("dttw-5yxu.csv?$where=class='Alcohol'")
    assert "?" not in name and "'" not in name and "$" not in name


def test_offline_mode_fails_clearly_and_never_uses_network(asset_factory):
    a = asset_factory(asset_id="never_cached")
    pins = {"never_cached": {"sha256": "0" * 64}}
    with pytest.raises(fetch.AcquisitionError, match="offline"):
        fetch.acquire(a, pins, client=None, offline=True)


def test_upstream_change_is_reported_and_pin_kept(asset_factory, monkeypatch, tmp_path):
    a = asset_factory(asset_id="changing_asset")
    first = b"year,value\n2020,1\n" * 10
    second = b"year,value\n2020,2\n" * 10
    pins = {}
    payloads = iter([first, second])

    def fake_download(asset, client):
        data = next(payloads)
        return data, {
            "url": asset.url,
            "retrieved_at": "2026-01-01T00:00:00Z",
            "http_status": 200,
            "content_type": "text/csv",
            "last_modified": None,
            "bytes": len(data),
            "sha256": fetch.sha256_bytes(data),
        }

    monkeypatch.setattr(fetch, "download", fake_download)
    r1 = fetch.acquire(a, pins, client=object(), offline=False, refresh=True)
    assert r1.status == "acquired" and pins["changing_asset"]["sha256"] == fetch.sha256_bytes(first)
    r2 = fetch.acquire(a, pins, client=object(), offline=False, refresh=True)
    assert r2.status == "changed_upstream"
    assert pins["changing_asset"]["sha256"] == fetch.sha256_bytes(first), (
        "pin must not move without --update-pins"
    )
    assert fetch.resolve_pinned(a, pins).read_bytes() == first


def test_cached_pinned_bytes_are_reused_without_network(asset_factory, monkeypatch):
    a = asset_factory(asset_id="reused_asset")
    data = b"year,value\n2020,1\n" * 10
    pins = {}
    fetch.store_bytes(a, data, {"sha256": fetch.sha256_bytes(data)})
    pins["reused_asset"] = {"sha256": fetch.sha256_bytes(data)}
    monkeypatch.setattr(fetch, "download", lambda *a, **k: pytest.fail("network used"))
    assert fetch.acquire(a, pins, client=None, offline=False).status == "cached"


def test_volatile_response_fields_do_not_change_the_pin(asset_factory):
    bls = asset_factory(asset_id="b", format="json", options={"normalize": "bls_api_json"})
    one = b'{"status":"REQUEST_SUCCEEDED","responseTime":100,"message":[],"Results":{"series":[]}}'
    two = b'{"Results": {"series": []}, "message": [], "responseTime": 77, "status": "REQUEST_SUCCEEDED"}'
    assert fetch.normalize(bls, one) == fetch.normalize(bls, two)
    assert b"responseTime" not in fetch.normalize(bls, one)
    page = asset_factory(asset_id="h", format="html", options={"normalize": "strip_html_request_tokens"})
    a = b'<p>Pub. Ch. 554</p><input name="__RequestVerificationToken" type="hidden" value="CfDJ8aaa" />'
    b = b'<p>Pub. Ch. 554</p><input name="__RequestVerificationToken" type="hidden" value="CfDJ8bbb" />'
    assert fetch.normalize(page, a) == fetch.normalize(page, b)
    assert b"Pub. Ch. 554" in fetch.normalize(page, a)
    changed = b'<p>Pub. Ch. 555</p><input name="__RequestVerificationToken" type="hidden" value="CfDJ8aaa" />'
    assert fetch.normalize(page, a) != fetch.normalize(page, changed)  # real content changes still show
    index = asset_factory(asset_id="p", format="html", options={"normalize": "strip_passed_bills_timestamp"})
    a = b"<TITLE>Bills Passed as of 10/6/2026 11:45:53 PM</TITLE><TD>SB0314S01</TD><TD>334</TD>"
    b = b"<TITLE>Bills Passed as of 10/7/2026 12:12:51 AM</TITLE><TD>SB0314S01</TD><TD>334</TD>"
    assert fetch.normalize(index, a) == fetch.normalize(index, b)
    assert fetch.normalize(index, a) != fetch.normalize(index, a.replace(b">334<", b">335<"))
    lis = asset_factory(asset_id="v", format="html", options={"normalize": "strip_lis_page_variants"})
    a = b"<div id='printDate'>10/7/2026</div></div><p>grocery store, or marina store</p>"
    b = b"<div id='printDate'>10/9/2026</div></div><p>grocery store, or marina store</p>"
    assert fetch.normalize(lis, a) == fetch.normalize(lis, b)
    assert b"10/7/2026" not in fetch.normalize(lis, a)
    assert fetch.normalize(lis, a) != fetch.normalize(lis, a.replace(b"marina", b"marine"))
    footer = b'    <div class="va-law-footer" id="valawfooter">\r\n <h4>Virginia Law Library</h4></div>\r\n'
    rest = b'        <div class="footer"><nav>links</nav></div>'
    assert fetch.normalize(lis, a + footer + rest) == fetch.normalize(lis, b + rest)  # some servers omit it


def test_a_pdf_inside_a_multipart_envelope_is_unwrapped_before_the_type_check(asset_factory):
    pdf = b"%PDF-1.6\r\n" + b"0" * 200 + b"\r\n%%EOF"
    wrapped = (
        b'------WebKitFormBoundaryX\r\nContent-Disposition: form-data; name="813579.pdf"\r\n'
        b"Content-Type: application/pdf\r\n\r\n" + pdf + b"\r\n------WebKitFormBoundaryX--\r\n"
    )
    asset = asset_factory(asset_id="w", format="pdf", options={"normalize": "unwrap_multipart_pdf"})
    assert fetch._verified(asset, wrapped, "application/pdf") == pdf
    plain = asset_factory(asset_id="p", format="pdf")
    with pytest.raises(fetch.AcquisitionError):
        fetch._verified(plain, wrapped, "application/pdf")  # without the declared unwrapper it is refused
    with pytest.raises(fetch.AcquisitionError):
        fetch._verified(asset, HTML_ERROR, "text/html")  # an error page has no PDF inside
