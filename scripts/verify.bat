@echo off
rem Full local verification (Windows). Linux/macOS: scripts/verify.sh runs the same steps.
rem
rem Runs every repository check against the pinned data already in data\raw\ (no network: it does not
rem fetch). It changes no code, but the report and export steps rewrite generated files; the log lists the
rem working tree before and after the run. The script prints which steps failed and exits 1 if any did.
rem It uses the project .venv (a Windows venv) and npm on PATH.
rem
rem Logs (data\processed\verify\, gitignored):
rem   verify-windows-<yyyyMMdd-HHmmss>-<random>.log  one per run, never overwritten: the revision, the working tree
rem                                                  at the start and the end, tool versions, start and end times,
rem                                                  each step's output and exit code, and the script's exit code
rem   verify-windows.log                             a copy of the latest run's log, written when the run ends; while
rem                                                  a run is in progress it names that run's log and holds no result
rem
rem Usage: double-click, or from any folder:  scripts\verify.bat
rem Run "npm --prefix web ci" first when web\package-lock.json changed.
setlocal EnableDelayedExpansion
cd /d "%~dp0.."
set "VENV=%CD%\.venv\Scripts"
if not exist "%VENV%\alcohol-data.exe" (
  echo .venv\Scripts\alcohol-data.exe not found. Install first: see docs\reproduction.md
  exit /b 2
)
if not exist "data\processed\verify" mkdir "data\processed\verify"
set "STAMP="
for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%t"
if not defined STAMP set "STAMP=time-unknown"
set "LOG=%CD%\data\processed\verify\verify-windows-!STAMP!-!RANDOM!.log"
set "LATEST=%CD%\data\processed\verify\verify-windows.log"
set "FAILED="
call :now START
>"!LOG!" echo === start !START!
>>"!LOG!" echo log !LOG!
>"!LATEST!" echo === in progress since !START!: this run writes !LOG!
>>"!LOG!" echo === revision
>>"!LOG!" 2>&1 git rev-parse HEAD
>>"!LOG!" 2>&1 git rev-parse --abbrev-ref HEAD
>>"!LOG!" echo === working tree at start: git status --short
>>"!LOG!" 2>&1 git status --short
>>"!LOG!" echo === tool versions
call :version "python" "%VENV%\python.exe" --version
call :version "pytest" "%VENV%\python.exe" -m pytest --version
call :version "ruff" "%VENV%\ruff.exe" --version
call :version "node" node --version
call :version "npm" npm --version
call :version "vitest" npm --prefix web exec -- vitest --version
call :version "typescript" npm --prefix web exec -- tsc --version
call :version "vite" npm --prefix web exec -- vite --version
call :run "build" "%VENV%\alcohol-data.exe" build
call :run "validate --profile release" "%VENV%\alcohol-data.exe" validate --profile release
call :run "officials check" "%VENV%\alcohol-data.exe" officials check
call :run "sources audit" "%VENV%\alcohol-data.exe" sources audit
call :run "report coverage" "%VENV%\alcohol-data.exe" report coverage
call :run "report completeness" "%VENV%\alcohol-data.exe" report completeness
call :run "report policy-coverage" "%VENV%\alcohol-data.exe" report policy-coverage
call :run "report descriptive" "%VENV%\alcohol-data.exe" report descriptive
call :run "report dictionary" "%VENV%\alcohol-data.exe" report dictionary
call :run "legal review-packet-utah" "%VENV%\alcohol-data.exe" legal review-packet-utah
call :run "export" "%VENV%\alcohol-data.exe" export
call :run "dashboard export" "%VENV%\alcohol-data.exe" dashboard export
call :run "pytest" "%VENV%\python.exe" -m pytest -q
call :run "ruff format --check src tests" "%VENV%\ruff.exe" format --check src tests
call :run "ruff check ." "%VENV%\ruff.exe" check .
call :run "npm test" npm --prefix web test
call :run "npm run build" npm --prefix web run build
call :run "export grocery-wine" npm --prefix web run export:grocery-wine
call :run "export tennessee" npm --prefix web run export:tennessee
call :run "grocery-wine independent check" "%VENV%\python.exe" scripts\grocery_wine_alternatives_check.py
call :run "grocery-wine purchase-flow check" "%VENV%\python.exe" scripts\grocery_wine_flows_check.py
>>"!LOG!" echo === working tree at end: git status --short
>>"!LOG!" 2>&1 git status --short
call :now END
>>"!LOG!" echo === done !END!
set "CODE=0"
if defined FAILED set "CODE=1"
if defined FAILED (
  >>"!LOG!" echo FAILED:!FAILED!
)
>>"!LOG!" echo === exit !CODE!
copy /y "!LOG!" "!LATEST!" >nul
if defined FAILED (
  echo FAILED:!FAILED!
) else (
  echo All steps passed.
)
echo Log: !LOG!
echo Latest-run copy: !LATEST!
exit /b !CODE!

:run
rem First argument: the step name; the rest: the command. "call" lets npm (a .cmd file) return here.
set "NAME=%~1"
echo === !NAME!
>>"!LOG!" echo === !NAME!
call %2 %3 %4 %5 %6 %7 %8 %9 >> "!LOG!" 2>&1
set "RC=!errorlevel!"
>>"!LOG!" echo exit=!RC!
if not "!RC!"=="0" set "FAILED=!FAILED! [!NAME!]"
goto :eof

:version
rem Informational: a tool that does not answer is recorded, and a step that needs it will fail on its own.
set "NAME=%~1"
>>"!LOG!" echo --- !NAME!
call %2 %3 %4 %5 %6 %7 %8 %9 >> "!LOG!" 2>&1
if errorlevel 1 (
  >>"!LOG!" echo no answer, exit !errorlevel!
)
goto :eof

:now
rem The local time with its UTC offset (ISO 8601), whatever the system's date format.
set "%~1="
for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format o"') do set "%~1=%%t"
goto :eof
