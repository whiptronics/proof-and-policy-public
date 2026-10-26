@echo off
rem Redraws the grocery-wine graph package from the current exports (Windows, local only).
rem
rem Runs, in order, and stops at the first failure:
rem   1. scripts\grocery_wine_graphs.py       charts, plotted values, data copies, manifest, provenance
rem   2. scripts\grocery_wine_deck_figures.py the slide deck's figures and numbers.json
rem   3. scripts\grocery_wine_bundle_docs.py  data dictionary, source and assumption register, dataset list
rem The charts need matplotlib, which the project's .venv does not have; ParaView 6.1.0's pvpython has it.
rem Run scripts\verify.bat first: it rebuilds the dataset and writes the exports these steps draw from.
rem
rem Usage, from any folder (cmd or PowerShell; in PowerShell put & before a quoted path):
rem   scripts\grocery_wine_package.bat                    writes to ..\..\graphs and data
rem   scripts\grocery_wine_package.bat "<package folder>"
setlocal
cd /d "%~dp0.."
set "PKG=%~1"
if "%PKG%"=="" set "PKG=%CD%\..\..\graphs and data"
set "PV=C:\Program Files\ParaView 6.1.0\bin\pvpython.exe"
if not exist "%PV%" (
  echo ParaView's pvpython not found at "%PV%"; any Python with matplotlib and numpy can run scripts\grocery_wine_graphs.py.
  exit /b 2
)
if not exist ".venv\Scripts\python.exe" (
  echo .venv\Scripts\python.exe not found. Install first: see docs\reproduction.md
  exit /b 2
)
echo === charts and data: "%PKG%"
"%PV%" -B scripts\grocery_wine_graphs.py "%PKG%" || goto failed
echo === deck figures
"%PV%" -B scripts\grocery_wine_deck_figures.py "%PKG%\slides\grocery-wine-deck" || goto failed
echo === reference files
".venv\Scripts\python.exe" -B scripts\grocery_wine_bundle_docs.py "%PKG%" || goto failed
echo Package redrawn in "%PKG%".
exit /b 0
:failed
echo FAILED: the step above did not finish; nothing after it ran.
exit /b 1
