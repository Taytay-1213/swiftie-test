@echo off
cd /d "%~dp0"

echo ========================================
echo   Swiftie Test - Push to GitHub Pages
echo ========================================
echo.

:: Stage all changes
git add -A

:: Check for changes to commit
git diff --cached --quiet
set STAGED=%errorlevel%

:: Auto commit if there are staged changes
if %STAGED%==1 (
    for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set d=%%a%%b%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set t=%%a%%b
    git commit -m "update %d%_%t%"
) else (
    echo [OK] No new changes to commit.
)

:: Push
echo.
echo [->] Pushing to GitHub...
git push origin main
if %errorlevel%==0 (
    echo [OK] Push succeeded! GitHub Pages will update in ~1 minute.
) else (
    echo [X] Push failed! Check network or remote repo config.
    echo     Manual: git push origin main
)

echo.
echo   URL: https://taytay-1213.github.io/swiftie-test/guess-tswift.html
pause
