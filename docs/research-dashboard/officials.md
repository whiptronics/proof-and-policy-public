# Officials and committees (reference data)

A small reference directory inside the dashboard (`?v=officials`, "Officials & committees" under the data
views): who a public source records as holding or having held office, which committees it lists them on, and
when. It exists so that, later, a law can be tied to the officials and committees serving at the time. It is
**kept apart from the observations, the population statistics and the policy simulator's economic inputs**:
nothing here feeds an estimate, a build measure or a scenario.

It is not a campaign tool. There is no outreach, messaging, scoring or ranking of anyone's support, and none
is planned in this batch.

## Source

| | |
|---|---|
| Dataset | Open States People (state legislators, governors, some mayors, former officeholders, committees) |
| Archive | `people-main-officials-only.zip` (17,161,270 bytes, SHA-256 `bcc1347ad74094de…`), kept in the `politics` folder and cached at `data/raw/openstates_people_officials_2026_10_08/` |
| Snapshot date | 2026-10-08, as stated in the archive's `SANITIZATION.md` (the retained files carry no upstream commit hash) |
| Cleaned copy made | 2026-10-11 by the project owner from `people-main.zip`; the original archive was deleted and is not recreated |
| License | CC0 1.0 Universal (`LICENSE`, `CITATION.cff` in the archive) |
| Attribution | Authors from `CITATION.cff`: James Turk, Ben Fossen, Rylie Johnson, Chris Nardi, Chris Yamas, Joe Arasin, Harry Mattison. https://github.com/openstates/people |
| Documentation kept | `README.md`, `LICENSE`, `CITATION.cff`, `schema.md`, `SANITIZATION.md`: all five present, so no documentation gap to recover |
| Source config | `config/sources/openstates_people.yaml`; asset `openstates_people_officials_2026_10_08`; pinned in `config/builds/preview.pins.json`; rows in `metadata/source_registry.csv` and `metadata/rights_registry.csv` |

### What the cleaned copy contains, and what it does not

The archive was cleaned with a whitelist before it reached this project (`SANITIZATION.md` inside the archive is
the record; this project did not change it). **Kept:** names and name variants, party, roles (office, district,
dates), official e-mail on government or legislature domains, capitol-office address and phone, official links,
research identifiers (Open States, bioguide, FEC, GovTrack and others), seat descriptions, and committees with
members linked to an officeholder record. **Removed:** birth and death dates, gender, photos, biographies,
occupation, education, religion, family, home and district-office addresses, personal phones and e-mails, staff,
personal social-media accounts, links to LinkedIn, Facebook, Wikipedia, Ballotpedia and Vote Smart, party and
caucus sites, and profile-site identifiers. Former officeholders were kept on purpose, for historical research,
and are separated from current officials everywhere (below).

Counts the archive states, and the importer reproduces: 22,692 officeholder records (7,959 legislature, 201
executive, 608 municipal, 13,924 former) and 3,042 committees. Parsed: 30,918 roles, 38,864 committee
memberships, 22,691 distinct person ids.

## The importer

`src/alcohol_data/officials/importer.py` reads the zip directly (read-only; no network, no clock) and returns
plain tables. `alcohol-data officials check` re-reads the pinned archive and runs the checks below
(exit code 1 on any failure). To reproduce from scratch:

```
alcohol-data import-asset openstates_people_officials_2026_10_08 ..\people-main-officials-only.zip
alcohol-data officials check
alcohol-data dashboard export        # writes officials.json and officials/<code>.json
```

Records are **one per source file**, keyed by `<folder>/<group>/<uuid>`; `person_id` is the archive's
`ocd-person/...` id and is the only join key. **People are never merged or matched by name.** One id
(Barbara Lee, `ocd-person/3cbc3ca2-…`) appears in two files (`ca/municipalities` and `us/retired`); it stays two
records, each pointing at the other.

Kept per record: stable id, name and other names, parties (with their dates where given), roles (type,
jurisdiction id parsed into scope and place, district, start and end dates, end reason), official links,
identifiers, seat extras, and, for current records only, official e-mail and capitol office. Kept per committee:
id, name, chamber, classification, parent, links and members (person id, role as the source gives it). A member
whose person id is not in the archive is **kept as unresolved** (name and id as the committee file gave them), not
matched by name; there are 2, both New Hampshire (Gary Daniels on two committees). Three memberships belong to
people the source files as former (Vermont). 8 Vermont members with no person id were already dropped in the
cleaning (`SANITIZATION.md`).

## Current versus former

| Label | Rule |
|---|---|
| **Current in source** | Filed in the source's `legislature`, `executive` or `municipalities` folder **and** at least one role with no end date or an end date on or after the snapshot, and a start date not after it. |
| Ended (filed with current officials) | Filed in a current folder but every role ended before the snapshot (330 records). Treated as historical. |
| Former | Filed in the `retired` folder (13,924 records). Never current, whatever its dates say. |

"Current in source" is the source's own listing at its snapshot date. It is **never** "confirmed": nothing
here was checked against an official roster, a missing end date does not make anyone current (a record in the
retired folder with no end date is still former), and every record's review status is `not_reviewed`. The page
says so above the table and in every row.

**Contact details.** Official e-mail and capitol-office address and phone are exported only for records that are
current in the source, shown as "as of 2026-10-08, not re-checked", as plain text (no mailto link). Former and
ended records carry none, so an old contact detail is never shown as current. Links on historical records are
shown as links the source recorded, with a note that they are not current contact points.

## The view

Defaults to **Utah** and **current in source**. Filters (all in the URL, so a link reproduces the view):
jurisdiction (50 states, DC, Puerto Rico, federal), current/former/all, chamber or office, government (state
or a city), district, committee, name search (accent- and case-insensitive, includes other names and ids), and
an optional **date**.

The date filter uses role dates only. A role supports a date when it has a recorded start on or before it and
has not ended (both ends inclusive, so a handover day can match two roles). A role with no end date counts as
ongoing only for a record that is current in the source. A role with no start date, or whose start is later
than its end (119 roles in the source), **cannot say**; those records are left out unless the box "Also show
records whose dates cannot say" is ticked, and the page tells you how many more there are. Coverage is thin for
old dates: for Utah on 2019-03-26, 35 records are supported by dates and 99 more cannot say. The same rule is in
`importer.role_covers` and `web/src/lib/officials.ts`, tested against the same cases.

Committee membership has **no dates** in the source (one list per committee as of the snapshot, and no marker
of which committees are still active), so a date never filters it and the page says it may not match who sat on
a committee then.

Each row shows name, party, role, district and term dates as recorded, committee memberships with roles,
retained official links, and the source folder, snapshot date and review status.

## Linking officials and committees to policy records

Only what the data can support:

| Relationship | Status |
|---|---|
| Held a seat on the date a law was **enacted** | Supported where role dates exist. The view offers the enactment dates already recorded in `policy_events.csv` (8 across UT, TN, VA, AR) as one-click dates, with links to the policy record. It means "recorded in a seat that day", nothing more. |
| **Sponsored** a bill | Not in this data; no policy record carries a sponsor. |
| **Voted** for or against | Not in this data. Party and committee membership are not treated as evidence of a vote or of support. |
| Committee **reviewed or received** a bill | **Unverified.** No bill referral is documented anywhere in the project. |

For committees that look relevant to wine or alcohol law, `data/curated/officials/committee_relevance.csv` keeps
two things apart: *general subject relevance* (a judgment from the committee's name; six Utah entries:
Business and Labor, Business, Labor and Commerce, Business and Labor Interim, and Revenue and Taxation in each
chamber plus its interim committee) and a *documented bill referral* (`referral_status` is `unverified` for all
six; `documented` needs a named bill and an evidence URL, enforced by the export). Every row is
`not_reviewed`. Adding a documented referral later means editing that file with the bill and its source.

## Checks, and what they do and do not show

`alcohol-data officials check`, the tests in `tests/test_officials.py` (a hand-built fixture archive plus the
real one) and `web/src/lib/officials.test.ts` test: record, committee and member counts against a separate pass
over the zip and against the counts `SANITIZATION.md` states; unique record keys and ocd-person ids; every
membership either resolved or flagged; no retired record treated as current; the date-coverage cases; the
current/former/ended split; committee-member filtering; accent-insensitive search without merging same names;
contact details only on current records; and that no key named in `SANITIZATION.md`'s removed list, no blocked
link host (social, encyclopedia, Vote Smart, Ballotpedia), no consumer e-mail domain and no non-capitol office
appears in the archive or in the exported files.

They do **not** show that the source is right, that anyone listed as current holds office today, that names,
addresses or free-text seat descriptions contain nothing personal (only field names, hosts and classifications
are tested), or that the cleaned copy matches the original, which no longer exists. The sanitization record is
the archive's own `SANITIZATION.md`.

## Known limits

- The snapshot is one day; officeholders change. Nothing refreshes it.
- 7,972 roles have an end date but no start date, and 84 have neither; old dates are often unsupported.
- Committee membership is undated and may include committees that no longer meet.
- Names are as the source gives them; variants are search aids, not identities.
- No bill, vote, sponsorship, hearing or referral data. Open States' bill data was not imported.
- The page loads one jurisdiction file at a time (about 0.3 MB for Utah, 1.3 MB for the federal file; 18 MB in
  all under `web/public/data/officials/`, which is generated and git-ignored).
