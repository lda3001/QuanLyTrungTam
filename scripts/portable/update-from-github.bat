@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "REPO=lda3001/QuanLyTrungTam"
set "ASSET=quanlytrungtam-update.zip"
set "DOWNLOAD_URL=https://github.com/%REPO%/releases/latest/download/%ASSET%"
set "TEMP_DIR=%~dp0.update-temp"
set "BACKUP_DIR=%~dp0.update-backup"

echo [1/5] Dang tai ban cap nhat moi nhat tu GitHub...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%" || goto :error

if defined GITHUB_TOKEN (
  curl.exe --fail --location --retry 3 --connect-timeout 15 ^
    -H "Authorization: Bearer %GITHUB_TOKEN%" ^
    -H "Accept: application/octet-stream" ^
    "%DOWNLOAD_URL%" -o "%TEMP_DIR%\update.zip"
) else (
  curl.exe --fail --location --retry 3 --connect-timeout 15 ^
    "%DOWNLOAD_URL%" -o "%TEMP_DIR%\update.zip"
)
if errorlevel 1 goto :download_error

echo [2/5] Dang giai nen va kiem tra goi cap nhat...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Expand-Archive -LiteralPath '%TEMP_DIR%\update.zip' -DestinationPath '%TEMP_DIR%\new' -Force"
if errorlevel 1 goto :error
if not exist "%TEMP_DIR%\new\dist-web\index.html" goto :invalid_package
if not exist "%TEMP_DIR%\new\dist-server\index.mjs" goto :invalid_package

echo [3/5] Dang dung server local...
if exist "%~dp0.server.pid" (
  set /p SERVER_PID=<"%~dp0.server.pid"
)
if not defined SERVER_PID (
  for /f "tokens=5" %%P in ('netstat.exe -ano ^| findstr.exe /R /C:":3001 .*LISTENING"') do if not defined SERVER_PID set "SERVER_PID=%%P"
)
if defined SERVER_PID (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p=Get-Process -Id !SERVER_PID! -ErrorAction SilentlyContinue; $expected=[IO.Path]::GetFullPath('%~dp0runtime\node.exe'); if($p -and $p.Path -eq $expected){Stop-Process -Id !SERVER_PID! -Force}"
  del /q "%~dp0.server.pid" 2>nul
)

echo [4/5] Dang thay dist-web va dist-server...
if exist "%BACKUP_DIR%" rmdir /s /q "%BACKUP_DIR%"
mkdir "%BACKUP_DIR%" || goto :error
if exist "%~dp0dist-web" move "%~dp0dist-web" "%BACKUP_DIR%\dist-web" >nul || goto :error
if exist "%~dp0dist-server" move "%~dp0dist-server" "%BACKUP_DIR%\dist-server" >nul || goto :rollback
move "%TEMP_DIR%\new\dist-web" "%~dp0dist-web" >nul || goto :rollback
move "%TEMP_DIR%\new\dist-server" "%~dp0dist-server" >nul || goto :rollback

echo [5/5] Cap nhat thanh cong. Du lieu trong data khong bi thay doi.
if exist "%BACKUP_DIR%" rmdir /s /q "%BACKUP_DIR%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
call "%~dp0start-local.cmd"
exit /b 0

:rollback
echo Cap nhat loi, dang phuc hoi ban cu...
if exist "%~dp0dist-web" rmdir /s /q "%~dp0dist-web"
if exist "%~dp0dist-server" rmdir /s /q "%~dp0dist-server"
if exist "%BACKUP_DIR%\dist-web" move "%BACKUP_DIR%\dist-web" "%~dp0dist-web" >nul
if exist "%BACKUP_DIR%\dist-server" move "%BACKUP_DIR%\dist-server" "%~dp0dist-server" >nul
call "%~dp0start-local.cmd"
goto :error

:download_error
echo Khong tai duoc %DOWNLOAD_URL%
echo Hay kiem tra ket noi, GitHub Release va asset %ASSET%.
goto :error

:invalid_package
echo Goi ZIP khong co dist-web hoac dist-server dung cau truc.

:error
echo Cap nhat that bai. Ban cu va data van duoc giu nguyen.
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
pause
exit /b 1
