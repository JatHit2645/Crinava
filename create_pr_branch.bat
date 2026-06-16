@echo off
setlocal enabledelayedexpansion

:: Locate git
where git >nul 2>&1
if %errorlevel% equ 0 (
    set "GIT_CMD=git"
    goto :git_found
)
set "COMMON_PATHS[0]=C:\Program Files\Git\cmd\git.exe"
set "COMMON_PATHS[1]=C:\Program Files (x86)\Git\cmd\git.exe"
set "COMMON_PATHS[2]=%USERPROFILE%\AppData\Local\Programs\Git\cmd\git.exe"
set "COMMON_PATHS[3]=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
for /L %%i in (0,1,3) do (
    set "target_path=!COMMON_PATHS[%%i]!"
    if exist "!target_path!" (
        set "GIT_CMD="!target_path!""
        goto :git_found
    )
)
echo Git not found.
pause
exit /b

:git_found
echo Rebuilding Git repository to align histories...

:: Step 1: Delete existing local .git folder to start fresh
if exist ".git" (
    echo Cleaning local Git history...
    rmdir /s /q .git
)

:: Step 2: Initialize a new repository
%GIT_CMD% init -b main
%GIT_CMD% config user.name "Crinava Developer"
%GIT_CMD% config user.email "developer@crinava.local"
%GIT_CMD% remote add origin https://github.com/JatHit2645/Crinava.git

:: Step 3: Create initial commit with only README.md
if not exist "README.md" (
    echo # Crinava > README.md
)
%GIT_CMD% add README.md
%GIT_CMD% commit -m "Initial commit"

:: Step 4: Push initial commit to main (force)
echo Pushing empty main branch to GitHub...
%GIT_CMD% push -u origin main --force

:: Step 5: Create the review-fixes branch off main
echo Creating review-fixes branch...
%GIT_CMD% checkout -b review-fixes

:: Step 6: Add all other files to the review-fixes branch and commit
echo Staging all project files...
%GIT_CMD% add .
%GIT_CMD% commit -m "Update Crinava with latest fixes (scorecard, win probability, striker names, dismissals, scrollbars)"

:: Step 7: Push the review-fixes branch (force)
echo Pushing review-fixes branch to GitHub...
%GIT_CMD% push -u origin review-fixes --force

echo.
echo ====================================================================
echo SUCCESS: Code histories are now aligned!
echo Now open this URL in your browser to create the Pull Request:
echo.
echo https://github.com/JatHit2645/Crinava/compare/main...review-fixes
echo.
echo CodeRabbit will now be able to scan and review all files in the PR.
echo ====================================================================
echo.
pause
