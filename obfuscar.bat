@echo off
echo ============================================
echo  Ofuscador de JavaScript - gastos-app
echo ============================================
echo.

:: Verificar que node este disponible
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH.
    pause
    exit /b 1
)

:: Verificar que npm este disponible
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no esta disponible.
    pause
    exit /b 1
)

echo [1/4] Instalando javascript-obfuscator globalmente...
npm install -g javascript-obfuscator
if errorlevel 1 (
    echo [ERROR] No se pudo instalar javascript-obfuscator.
    pause
    exit /b 1
)
echo      OK.
echo.

echo [2/4] Creando backup de los archivos originales en js_backup\...
if exist js_backup rmdir /s /q js_backup
xcopy js js_backup /E /I /Q
echo      OK. Backup guardado en js_backup\
echo.

echo [3/4] Ofuscando archivos JavaScript...

set OPTS=--compact true --string-array true --string-array-encoding base64 --rotate-string-array true --shuffle-string-array true --split-strings true --identifier-names-generator hexadecimal --rename-globals false --self-defending true --disable-console-output false

javascript-obfuscator js\app.js       --output js\app.js       %OPTS%
javascript-obfuscator js\ui.js        --output js\ui.js        %OPTS%
javascript-obfuscator js\state.js     --output js\state.js     %OPTS%
javascript-obfuscator js\api.js       --output js\api.js       %OPTS%
javascript-obfuscator js\router.js    --output js\router.js    %OPTS%
javascript-obfuscator js\modals.js    --output js\modals.js    %OPTS%
javascript-obfuscator js\ranks.js     --output js\ranks.js     %OPTS%
javascript-obfuscator js\animations.js --output js\animations.js %OPTS%

echo      OK.
echo.

echo [4/4] Verificando archivos ofuscados...
for %%f in (js\app.js js\ui.js js\state.js js\api.js js\router.js js\modals.js js\ranks.js js\animations.js) do (
    if exist %%f (
        echo      [OK] %%f
    ) else (
        echo      [FALLO] %%f - archivo no encontrado
    )
)

echo.
echo ============================================
echo  Listo. Los originales estan en js_backup\
echo  Para restaurar: xcopy js_backup js /E /Y
echo ============================================
echo.
pause
