@echo off
cd /d "%~dp0"
git add -A
git commit -m "update" 2>nul
echo.
echo Pushing to GitHub...
git push origin main
echo.
echo Done! Visit: https://taytay-1213.github.io/swiftie-test/guess-tswift.html
pause
