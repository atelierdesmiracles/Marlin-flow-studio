@echo off
setlocal
cd /d "%~dp0"
call "%~dp0CREATE-EXE.bat"
set "EXITCODE=%ERRORLEVEL%"
endlocal & exit /b %EXITCODE%
