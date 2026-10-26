"""Controlled vocabularies. Validation rejects any value not listed here."""

from __future__ import annotations

ESTIMATE_TYPES = {
    "reported_count": "A count published by the source (people, gallons, cases).",
    "administrative_amount": "A money amount taken from an administrative or financial record.",
    "survey_estimate": "A weighted estimate published from a probability survey.",
    "modeled_estimate": "A model-based estimate (e.g. small-area models). Never a causal outcome by default.",
    "official_estimate": "A demographic or statistical estimate published by an agency (e.g. Census population estimates).",
    "derived": "Computed by this project from other observations; see lineage.",
}

EXTRACTION_METHODS = {
    "api": "Machine-readable API response.",
    "csv_parser": "Delimited text file parsed by code.",
    "fixed_width_parser": "Fixed-width text file parsed by code.",
    "spreadsheet_parser": "Spreadsheet parsed by code.",
    "pdf_table": "Table extracted from a PDF by code.",
    "manual": "Transcribed by hand from a rendered page. Still an official value if the source is official.",
    "ocr": "Optical character recognition.",
    "computed": "Computed by this project (derived values only).",
}

MISSING_REASONS = {
    "not_collected": "The source did not collect this item for this unit and period.",
    "not_published": "Collected but not published (or not yet published).",
    "suppressed": "Withheld by the source, e.g. for small samples or confidentiality.",
    "not_applicable": "The concept does not apply (e.g. Census 'X': tax not imposed / not applicable).",
    "unavailable": "Published as unavailable by the source, or an input needed for a derivation is missing.",
    "unresolved_conflict": "Sources disagree and no documented rule selects one value.",
}

PERIOD_KINDS = {
    "point_in_time": "A single date (e.g. July 1 population estimate). period_start == period_end.",
    "calendar_year": "January 1 to December 31.",
    "state_fiscal_year": "The state government's 12-month fiscal year; dates vary by state.",
    "survey_year": "A survey's data year (BRFSS interviews fielded during the calendar year).",
    "month": "One calendar month.",
    "pooled_years": "An estimate pooling several years. Never an observation of a single year.",
}

GEO_LEVELS = {
    "nation": "United States (50 states and DC unless a source says otherwise).",
    "census_region": "Census Bureau region (Northeast, Midwest, South, West).",
    "state": "State or the District of Columbia.",
    "county": "County or county-equivalent.",
    "place": "Incorporated place (city/town).",
    "cbsa": "Core-based statistical area (metro/micro). Delineation vintage matters.",
}

VALUE_KINDS = {"count", "amount", "percent", "rate", "ratio", "index", "fraction"}

RIGHTS_STATUSES = {
    "public_domain_us_federal": "Work of the U.S. federal government (17 U.S.C. 105); verify embedded third-party material.",
    "open_license": "Published under an open license; see license field.",
    "government_edict": "Statutes and enacted legislation; not subject to copyright (government edicts doctrine).",
    "facts_with_citation": "Only extracted factual values and short citations are redistributed; the original document is not.",
    "rights_unresolved": "Redistribution of the raw file is not cleared. Raw file is not bundled.",
    "blocked_access": "Automated access is refused by the host. Manual acquisition required.",
}

ACQUISITION_STATUSES = {
    "not_investigated",
    "verified_available",
    "acquired",
    "parsed",
    "reviewed",
    "blocked_access",
    "rights_unresolved",
    "not_published",
    "not_applicable",
    # Pinned (hash recorded when it was acquired) but the bytes are not present in this build
    # environment, e.g. a cited document whose host now refuses downloads. Never used for parsed inputs.
    "pinned_not_local",
}

EXTRACTION_STATUSES = {
    "parsed": "Text extracted by code; not compared with the original rendering.",
    "checked_against_original": "Excerpts compared with the original page image or source file.",
    "uncertain": "Extraction may be wrong (OCR doubt, layout loss); needs checking.",
}

TEMPORAL_STATUSES = {
    "unresolved": "Dates rest on a summary or inference; operative dates not established.",
    "anchored": "Dates come from official dated versions or enacted effective-date clauses.",
    "reconstructed": "Operative text and dates rebuilt from enacted amendments.",
    "reconciled": "Reconstruction checked against an independent anchor (e.g. a later code edition).",
}

LEGAL_REVIEW_STATUSES = {
    "unreviewed": "Nobody has assessed whether the cited text answers the question.",
    "machine_assisted_review": "Assessed by code checks and/or an AI assistant (Claude). Not a human review.",
    "maintainer_reviewed": "A named project maintainer reviewed the claim against the evidence.",
    "expert_reviewed": "A named legal expert reviewed the claim. Recorded only when real.",
}

CLAIM_STATUSES = {
    "supported": "The cited evidence supports the coded value for the stated window.",
    "contradicted": "Evidence contradicts the coded value.",
    "incomplete": "Some indispensable dependency is unverified for part of the window.",
    "ambiguous": "Evidence admits more than one reading.",
}

HUMAN_REVIEW_STATUSES = {"maintainer_reviewed", "expert_reviewed"}

OBSERVATION_STATUSES = {"production", "quarantined"}

POLICY_EXPOSURE_STATUSES = {
    "exposed_full": "The policy value applied on every day of the period.",
    "exposed_partial": "The policy value applied on some days; see covered_days and exposure_fraction.",
    "not_exposed": "Verified that the policy value did not apply on any day of the period.",
    "unknown": "Legal status unknown for some or all days. Never treated as exposed or not exposed.",
    "local_option_unknown": "State authorized local adoption, but local adoption coverage is unknown.",
    "period_not_complete": "Part of the period lies after the build's as-of date; see the min/max bounds.",
}
