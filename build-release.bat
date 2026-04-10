@echo off
setlocal enabledelayedexpansion

echo ========================================
echo SnoozeGuard - Mobile App Build
echo ========================================
echo.

:: Try to find Java 11
echo Searching for Java 11...
if exist "C:\java-11" (
    for /d %%A in (C:\java-11\*) do (
        if exist "%%A\bin\java.exe" (
            set "JAVA_HOME=%%A"
            goto :java_found
        )
    )
)

if exist "C:\jdk11" (
    for /d %%A in (C:\jdk11\*) do (
        if exist "%%A\bin\java.exe" (
            set "JAVA_HOME=%%A"
            goto :java_found
        )
    )
)

if exist "C:\openjdk11" (
    for /d %%A in (C:\openjdk11\*) do (
        if exist "%%A\bin\java.exe" (
            set "JAVA_HOME=%%A"
            goto :java_found
        )
    )
)

:: If not found in subdirs, try direct path
if exist "C:\java-11\bin\java.exe" (
    set "JAVA_HOME=C:\java-11"
    goto :java_found
)

:: Last resort - try to find ANY java on PATH
where java.exe >nul 2>&1
if !errorlevel! equ 0 (
    echo Found Java on system PATH
    for /f "delims=" %%A in ('where java.exe') do (
        set "FOUND_JAVA=%%A"
        echo Java location: !FOUND_JAVA!
    )
    goto :continue
)

echo ERROR: Could not find Java 11!
echo.
echo Please download Java 11 and extract to C:\java-11\
echo Download from: https://github.com/adoptium/temurin11-binaries/releases
echo.
pause
exit /b 1

:java_found
echo ✓ Found JAVA_HOME: !JAVA_HOME!
"!JAVA_HOME!\bin\java.exe" -version
if errorlevel 1 (
    echo ERROR: Java not working
    pause
    exit /b 1
)

:continue
set "ANDROID_HOME=C:\Program Files (x86)\Android\android-sdk"
echo ✓ ANDROID_HOME: !ANDROID_HOME!
echo.

:: Check device
echo Checking connected devices...
"!ANDROID_HOME!\platform-tools\adb.exe" devices
echo.
echo ⚠️ If your device is "unauthorized":
echo    1. Unlock your phone
echo    2. Tap "Allow USB debugging" when prompted
echo.

:: Navigate and build
cd /d "C:\Thesis\SnoozeGuard"
echo Building app...
call npm run android -w @snoozeguard/mobile

if errorlevel 1 (
    echo.
    echo ❌ Build failed - see errors above
    echo.
) else (
    echo.
    echo ✅ Build successful!
    echo.
)

pause
exit /b !errorlevel!
