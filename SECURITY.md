# Security

- The project needs no credentials to use a release. Optional API keys (`BLS_API_KEY`, `CENSUS_API_KEY`)
  are read from environment variables only and are redacted from logs, manifests and error messages.
- Never commit keys. `.env` is ignored; `.env.example` holds placeholders only.
- Workflows use least-privilege tokens and pin third-party actions to commit SHAs. Pull-request checks run
  with read-only permissions and no secrets.
- Downloads are checked against their declared format before parsing, and every input is pinned by
  SHA-256; a changed upstream file is reported, not silently used.

To report a vulnerability or an accidentally published secret, do not open a public issue. Use GitHub's private
reporting on https://github.com/whiptronics/proof-and-policy-public (Security tab, "Report a vulnerability"); if
that button is not shown, open an issue asking for a private contact without giving details.
