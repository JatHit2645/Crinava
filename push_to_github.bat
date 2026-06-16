@echo off
setlocal enabledelayedexpansion

echo Searching for Git installation...

:check_git
:: Check if git is already in PATH
where git >nul 2>&1
if %errorlevel% equ 0 (
    set "GIT_CMD=git"
    goto :git_found
)

:: Check common paths
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

:: Git not found, try to install it
echo.
echo ====================================================================
echo WARNING: Git was not found on your system.
echo Attempting to automatically install Git using Windows Package Manager...
echo ====================================================================
echo.

where winget >nul 2>&1
if %errorlevel% equ 0 (
    echo Installing Git silently via winget. Please wait, this may take a minute...
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    if !errorlevel! equ 0 (
        echo.
        echo Git installed successfully! Rescanning paths...
        echo.
        goto :check_git
    ) else (
        echo Winget installation failed.
    )
) else (
    echo Windows Package Manager (winget) is not available.
)

echo.
echo ====================================================================
echo ERROR: Automatic installation failed. 
echo Please download and install Git manually from:
echo https://git-scm.com/download/win
echo ====================================================================
echo.
pause
exit /b

:git_found
echo.
echo Git command located: %GIT_CMD%
echo Checking git repository status...

%GIT_CMD% status >nul 2>&1
if %errorlevel% neq 0 (
    echo Initializing new Git repository...
    %GIT_CMD% init
    %GIT_CMD% branch -M main
)

:: Automatically configure a repository-local name and email if missing
%GIT_CMD% config user.name >nul 2>&1
if %errorlevel% neq 0 (
    echo Configuring repository-local Git username...
    %GIT_CMD% config user.name "Crinava Developer"
)

%GIT_CMD% config user.email >nul 2>&1
if %errorlevel% neq 0 (
    echo Configuring repository-local Git email...
    %GIT_CMD% config user.email "developer@crinava.local"
)

echo Setting remote origin to https://github.com/JatHit2645/Crinava.git...
%GIT_CMD% remote remove origin >nul 2>&1
%GIT_CMD% remote add origin https://github.com/JatHit2645/Crinava.git

echo Staging files...
%GIT_CMD% add .

echo Committing changes...
%GIT_CMD% commit -m "Update Crinava with latest fixes (scorecard, win probability, striker names, dismissals, scrollbars)"

echo Pushing to GitHub (Force-Push to overwrite remote history)...
%GIT_CMD% push -u origin main --force

echo.
echo Process complete!
pause
