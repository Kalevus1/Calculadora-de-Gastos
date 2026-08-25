@echo off
REM Genera CalculadoraDeGastos.exe (sin consola, con icono). Requiere PyInstaller.
cd /d "%~dp0"
set "PYDIR=.venv\Scripts"
if not exist "%PYDIR%\pyinstaller.exe" set "PYDIR=..\.venv_face\Scripts"
if not exist "%PYDIR%\pyinstaller.exe" (
  echo Falta PyInstaller:  "%PYDIR%\python.exe" -m pip install pyinstaller
  pause & exit /b 1
)
"%PYDIR%\pyinstaller.exe" --noconfirm --clean --windowed --onedir ^
  --name "CalculadoraDeGastos" --icon "recursos\icono.ico" ^
  calculadora_gastos.py
echo.
echo Listo: dist\CalculadoraDeGastos\CalculadoraDeGastos.exe
pause
