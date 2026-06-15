@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Swiftie Test - 一键推送至 GitHub Pages
echo ========================================
echo.

:: Stage all changes
git add -A

:: Check if there are changes
git diff --cached --quiet
if %errorlevel%==0 (
    echo [√] 没有变化需要推送。
    pause
    exit /b
)

:: Commit
set /p MSG="输入更新说明 (直接回车默认为 update): "
if "%MSG%"=="" set MSG=update
git commit -m "%MSG%"

:: Push
echo.
echo [→] 正在推送至 GitHub...
git push origin main 2>nul
if %errorlevel%==0 (
    echo [√] 推送成功！GitHub Pages 将在 1 分钟内自动更新。
) else (
    echo [×] 推送失败！请检查网络或远程仓库配置。
    echo     你可以手动运行: git push origin main
)

echo.
echo   固定访问地址: https://taytay-1213.github.io/swiftie-test/guess-tswift.html
pause
