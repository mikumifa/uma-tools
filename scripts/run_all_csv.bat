@echo off
setlocal enabledelayedexpansion

REM Get current script directory
set SCRIPT_DIR=%~dp0
REM Remove trailing \
if "%SCRIPT_DIR:~-1%"=="\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

REM Root directory = parent directory of script
for %%i in ("%SCRIPT_DIR%\..") do set ROOT_DIR=%%~fi

cd "%ROOT_DIR%"

REM List of Python scripts to run
set scripts[0]=scripts/gacha_free_campaign.py
set scripts[1]=scripts/exchange_data.py
set scripts[2]=scripts/login_data.py
set scripts[3]=scripts/mission_data_with_text.py
set scripts[4]=scripts/story_event_stats.py
set scripts[5]=scripts/transfer_data.py
set scripts[6]=scripts/gacha_data.py
set scripts[7]=scripts/champions_schedule.py
set scripts[8]=scripts/legend_race.py
set scripts[9]=scripts/campaign_data.py

for /L %%i in (0,1,9) do (
    set script=!scripts[%%i]!
    echo ==^> Running !script!
    uv run "!script!"
    if errorlevel 1 (
        echo [ERROR] Script failed: !script!
        exit /b 1
    )
)

echo All CSV exports completed.
endlocal
