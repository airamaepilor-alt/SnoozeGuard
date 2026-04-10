@echo off
REM Set environment variables for Android build
set JAVA_HOME=C:\Program Files\Android\jdk
set ANDROID_HOME=C:\Program Files (x86)\Android\android-sdk
set ANDROID_SDK_ROOT=%ANDROID_HOME%

REM Navigate to project root
cd /d C:\Thesis\SnoozeGuard

REM Run Android build
npm run android -w @snoozeguard/mobile

pause
