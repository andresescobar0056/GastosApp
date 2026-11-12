# Genera deploy\gastos-app.zip con solo los archivos que van al hosting.
# Uso:  powershell -ExecutionPolicy Bypass -File .\empaquetar.ps1
#
# Nota: el ZIP se crea a mano con rutas "/" porque Compress-Archive de Windows PowerShell 5.1
# usa "\" y al extraerlo en un servidor Linux los archivos quedarian mal nombrados.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$out  = Join-Path $root 'deploy'
$zip  = Join-Path $out 'gastos-app.zip'

if (-not (Test-Path (Join-Path $root 'backend\config\config.php'))) {
    Write-Warning 'Falta backend\config\config.php. Copialo desde config.example.php y pon los datos de tu base de datos antes de subir.'
}

New-Item -ItemType Directory -Force $out | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Force }

$items = @('index.html', 'manifest.json', 'sw.js', '.htaccess', 'css', 'js', 'assets', 'backend')
$files = foreach ($item in $items) {
    $p = Join-Path $root $item
    if (Test-Path $p -PathType Container) { Get-ChildItem $p -Recurse -File -Force } else { Get-Item $p -Force }
}

# No subir imagenes de pruebas locales (se conserva el .htaccess de uploads)
$uploads = Join-Path $root 'backend\uploads'
$files = $files | Where-Object { -not ($_.DirectoryName -eq $uploads -and $_.Name -ne '.htaccess') }

$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
    foreach ($f in $files) {
        $entry = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $f.FullName, $entry) | Out-Null
    }
} finally {
    $archive.Dispose()
}

Write-Host "Listo: $zip ($($files.Count) archivos)"
