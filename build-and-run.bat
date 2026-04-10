@echo off
REM SnoozeGuard Android Build and Deploy Script
REM This script sets up the environment and builds the app for Android

echo.
echo ========================================
echo SnoozeGuard Android Build Setup
echo ========================================
echo.

set "JAVA_HOME=C:\java-17\jdk-17.0.11+9"
set "ANDROID_HOME=C:\android-sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%PATH%"

echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
echo.

REM Verify Java works
"%JAVA_HOME%\bin\java.exe" -version
if errorlevel 1 (
    echo ERROR: Java verification failed
    pause
    exit /b 1
)

REM Verify Android SDK
if not exist "%ANDROID_HOME%\platform-tools\adb.exe" (
    echo ERROR: Android SDK not found at %ANDROID_HOME%
    pause
    exit /b 1
)

echo.
echo Checking connected devices...
"%ANDROID_HOME%\platform-tools\adb.exe" devices
echo.

REM Change to project directory
cd /d "C:\Thesis\SnoozeGuard"

REM Run the build
echo.
echo ========================================
echo Starting Android Build...
echo ========================================
echo.

call npm run android -w @snoozeguard/mobile

if errorlevel 1 (
    echo.
    echo Build failed. Check errors above.
    echo.
) else (
    echo.
    echo Build completed successfully!
    echo.
    echo Setting up ADB reverse for hot reload...
    "%ANDROID_HOME%\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
    "%ANDROID_HOME%\platform-tools\adb.exe" reverse tcp:19000 tcp:19000
    echo Done. Run "npx expo start --dev-client --localhost" to start Metro.
    echo.
)

pause
exit /b %errorlevel%
