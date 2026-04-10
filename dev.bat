@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo  SnoozeGuard - Dev Build ^& Hot Reload
echo ========================================
echo.

:: ─── Environment ───────────────────────────────────────────────────
set "JAVA_HOME=C:\java-17\jdk-17.0.11+9"
set "ANDROID_HOME=C:\android-sdk"
set "ANDROID_SDK_ROOT=C:\android-sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%PATH%"

echo Java  : !JAVA_HOME!
echo SDK   : !ANDROID_HOME!
echo.

:: ─── Verify Java ───────────────────────────────────────────────────
"!JAVA_HOME!\bin\java.exe" -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java not found at !JAVA_HOME!
    pause & exit /b 1
)
echo [OK] Java 17 found.

:: ─── Verify ADB + device ───────────────────────────────────────────
"!ANDROID_HOME!\platform-tools\adb.exe" start-server >nul 2>&1
set DEVICE=
for /f "tokens=1" %%D in ('"!ANDROID_HOME!\platform-tools\adb.exe" devices ^| findstr "device$"') do (
    set "DEVICE=%%D"
)
if not defined DEVICE (
    echo.
    echo ERROR: No Android device detected.
    echo   1. Connect your phone via USB
    echo   2. Enable USB Debugging in Developer Options
    echo   3. Tap "Allow" when prompted on the phone
    echo.
    "!ANDROID_HOME!\platform-tools\adb.exe" devices
    pause & exit /b 1
)
echo [OK] Device: !DEVICE!

:: ─── Parse arguments ───────────────────────────────────────────────
set BUILD_FIRST=0
if /i "%1"=="--build" set BUILD_FIRST=1
if /i "%1"=="build" set BUILD_FIRST=1
if not exist "C:\Thesis\SnoozeGuard\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk" (
    echo   No APK found — forcing build.
    set BUILD_FIRST=1
)

:: ─── Build + install (first time or --build flag) ──────────────────
if "!BUILD_FIRST!"=="1" (
    echo.
    echo ----------------------------------------
    echo  Building native Android APK...
    echo  (This takes 3-10 min on first run)
    echo ----------------------------------------
    echo.
    cd /d "C:\Thesis\SnoozeGuard"
    call npm run android -w @snoozeguard/mobile
    if errorlevel 1 (
        echo.
        echo [FAILED] Android build failed. See errors above.
        pause & exit /b 1
    )
    echo.
    echo [OK] Build complete and APK installed on device.
    goto :start_metro
) else (
    echo.
    echo [INFO] APK found. Use "dev.bat --build" to do a full rebuild.
)

:: ─── Reinstall existing APK + launch app ───────────────────────────
echo Reinstalling APK on device...
"!ANDROID_HOME!\platform-tools\adb.exe" install -r "C:\Thesis\SnoozeGuard\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk" >nul 2>&1
echo [OK] APK installed.

:start_metro
:: ─── ADB reverse port forwarding (USB hot reload - no WiFi needed) ─
echo.
echo Setting up USB hot reload (ADB reverse port forwarding)...
"!ANDROID_HOME!\platform-tools\adb.exe" reverse tcp:8081 tcp:8081 >nul 2>&1
"!ANDROID_HOME!\platform-tools\adb.exe" reverse tcp:19000 tcp:19000 >nul 2>&1
"!ANDROID_HOME!\platform-tools\adb.exe" reverse tcp:19001 tcp:19001 >nul 2>&1
echo [OK] USB hot reload ready (ports 8081, 19000, 19001 forwarded).

:: ─── Launch app pointing to localhost (via ADB reverse) ─────────────
echo.
echo Launching SnoozeGuard on device...
"!ANDROID_HOME!\platform-tools\adb.exe" shell am start ^
  -a android.intent.action.VIEW ^
  -d "exp+snoozeguard://expo-development-client/?url=http%%3A%%2F%%2Flocalhost%%3A8081" ^
  com.snoozeguard.app >nul 2>&1

:: ─── Start Metro bundler ───────────────────────────────────────────
echo.
echo ----------------------------------------
echo  Starting Metro bundler (hot reload)
echo.
echo  Your phone connects via USB cable.
echo  Changes you save will hot-reload.
echo  Press 'r' to reload, Ctrl+C to stop.
echo ----------------------------------------
echo.

:: Must run from apps/mobile - not from monorepo root
cd /d "C:\Thesis\SnoozeGuard\apps\mobile"
npx expo start --dev-client --localhost --port 8081

pause
