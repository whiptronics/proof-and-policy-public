#!/usr/bin/env bash
# Full local verification (Linux/macOS). Windows: scripts\verify.bat runs the same steps.
#
# Runs every repository check against the pinned data already in data/raw/ (no network: it does not
# fetch). It changes no code, but the report and export steps rewrite generated files; the log lists the
# working tree before and after the run. The script prints which steps failed and exits 1 if any did.
#
# Logs (data/processed/verify/, gitignored):
#   verify-posix-<YYYYmmdd-HHMMSS>-<pid>.log  one per run, never overwritten: the revision, the working tree at the
#                                             start and the end, tool versions, start and end times, each step's
#                                             output and exit code, and the script's exit code
#   verify-posix.log                          a copy of the latest run's log, written when the run ends; while a run
#                                             is in progress it names that run's log and holds no result
#
# Usage, from anywhere, with the project's environment active (or ALCOHOL_DATA / PYTHON / RUFF set):
#   bash scripts/verify.sh
# Install or refresh web dependencies first with "npm --prefix web ci" when web/package-lock.json changed.
set -u
cd "$(dirname "$0")/.."
AD=${ALCOHOL_DATA:-alcohol-data}
PY=${PYTHON:-python}
RUFF=${RUFF:-ruff}
mkdir -p data/processed/verify
LOG=data/processed/verify/verify-posix-$(date +%Y%m%d-%H%M%S)-$$.log
LATEST=data/processed/verify/verify-posix.log
START=$(date -Iseconds)
failed=()
run() {
  local name=$1
  shift
  echo "=== $name" | tee -a "$LOG"
  "$@" >>"$LOG" 2>&1
  local rc=$?
  echo "exit=$rc" >>"$LOG"
  [ "$rc" -eq 0 ] || failed+=("$name")
}
version() {
  # Informational: a tool that does not answer is recorded, and a step that needs it will fail on its own.
  local name=$1
  shift
  echo "--- $name" >>"$LOG"
  "$@" >>"$LOG" 2>&1 || echo "no answer, exit $?" >>"$LOG"
}
{ echo "=== start $START"; echo "log $LOG"; } >"$LOG"
echo "=== in progress since $START: this run writes $LOG" >"$LATEST"
{
  echo "=== revision"
  git rev-parse HEAD
  git rev-parse --abbrev-ref HEAD
  echo "=== working tree at start: git status --short"
  git status --short
  echo "=== tool versions"
} >>"$LOG" 2>&1
version "python" "$PY" --version
version "pytest" "$PY" -m pytest --version
version "ruff" "$RUFF" --version
version "node" node --version
version "npm" npm --version
version "vitest" npm --prefix web exec -- vitest --version
version "typescript" npm --prefix web exec -- tsc --version
version "vite" npm --prefix web exec -- vite --version

run "build" "$AD" build
run "validate --profile release" "$AD" validate --profile release
run "officials check" "$AD" officials check
run "sources audit" "$AD" sources audit
run "report coverage" "$AD" report coverage
run "report completeness" "$AD" report completeness
run "report policy-coverage" "$AD" report policy-coverage
run "report descriptive" "$AD" report descriptive
run "report dictionary" "$AD" report dictionary
run "legal review-packet-utah" "$AD" legal review-packet-utah
run "export" "$AD" export
run "dashboard export" "$AD" dashboard export
run "pytest" "$PY" -m pytest -q
run "ruff format --check src tests" "$RUFF" format --check src tests
run "ruff check ." "$RUFF" check .
run "npm test" npm --prefix web test
run "npm run build" npm --prefix web run build
run "export grocery-wine" npm --prefix web run export:grocery-wine
run "export tennessee" npm --prefix web run export:tennessee
run "grocery-wine independent check" "$PY" scripts/grocery_wine_alternatives_check.py
run "grocery-wine purchase-flow check" "$PY" scripts/grocery_wine_flows_check.py

{ echo "=== working tree at end: git status --short"; git status --short; echo "=== done $(date -Iseconds)"; } >>"$LOG" 2>&1
code=0
if [ "${#failed[@]}" -gt 0 ]; then
  code=1
  echo "FAILED: ${failed[*]}" >>"$LOG"
fi
echo "=== exit $code" >>"$LOG"
cp "$LOG" "$LATEST"
if [ "$code" -ne 0 ]; then
  echo "FAILED: ${failed[*]}"
else
  echo "All steps passed."
fi
echo "Log: $LOG"
echo "Latest-run copy: $LATEST"
exit "$code"
