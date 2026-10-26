# Third-party notices

## Data

- **CDC BRFSS Prevalence Data (2010 and prior)**, data.cdc.gov dataset `y4ft-s73h`, Centers for Disease
  Control and Prevention. Licensed under the Open Data Commons Attribution License v1.0
  (http://opendatacommons.org/licenses/by/1.0/) according to the dataset's data.cdc.gov metadata.
  Rows from this dataset appear in releases (series `cdc_brfss_prevalence_1995_2010`) and a small slice is in
  `tests/fixtures/brfss_1995_2010_subset.csv`.
- **CDC BRFSS Prevalence Data (2011 to present)**, dataset `dttw-5yxu`: public domain (data.cdc.gov
  metadata). Attribution given as good practice.
- **CDC YRBSS High School**, dataset `svam-8dhg`: public domain (data.cdc.gov metadata).
- **U.S. Census Bureau**, **NIAAA**, **BLS**, **BEA**, **NHTSA**: U.S. government works, public domain in the United States.
  Attribution given as good practice; citations are in `metadata/source_registry.csv`.
- **CDC U.S. Chronic Disease Indicators**, data.cdc.gov dataset `hksd-2xuw`: licensed under the Open
  Database License (ODbL) according to its data.cdc.gov metadata (checked 2026-10-09). Used in local builds
  and the local dashboard only; `alcohol-data package` refuses to build a release containing it until the
  owner decides how ODbL's share-alike terms fit the project's release license.
- **Utah Department of Alcoholic Beverage Services** annual reports and monthly Sales Analysis Reports:
  figures transcribed with page citations, or summed by beverage type; the reports themselves are not
  redistributed.
- **Utah State Tax Commission** Publication 25: one rate, cited by page; the PDF is not redistributed.
- **us-atlas** 3.0.1 (Mike Bostock), `states-albers-10m.json`, ISC license, built from U.S. Census Bureau
  cartographic boundary files. The dashboard draws its U.S. map from it.

## Software

Runtime dependencies (installed, not vendored): DuckDB (MIT), Apache Arrow / PyArrow (Apache-2.0), HTTPX
(BSD-3-Clause), Typer (MIT), PyYAML (MIT), openpyxl (MIT), truststore (MIT). Exact versions and hashes
are in `requirements/runtime.lock`.
