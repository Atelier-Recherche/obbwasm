param(
    [string]$ObsidianPluginsRoot = "D:\Notes\.obsidian\plugins"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginSrc = Join-Path $RepoRoot "obsidian-plugin"
$PluginId = "obbwasm-book"
$DestDir = Join-Path $ObsidianPluginsRoot $PluginId

Write-Host "Build obsidian-plugin..." -ForegroundColor Cyan
Push-Location $RepoRoot
try {
    npm run build -w obsidian-plugin
    if ($LASTEXITCODE -ne 0) { throw "Build echoue (exit $LASTEXITCODE)." }
}
finally {
    Pop-Location
}

Write-Host "Copie vers $DestDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

$files = @("main.js", "styles.css", "manifest.json", "pdf.worker.min.mjs")
if (Test-Path (Join-Path $PluginSrc "versions.json")) {
    $files += "versions.json"
}
foreach ($f in $files) {
    $src = Join-Path $PluginSrc $f
    if (-not (Test-Path $src)) {
        throw "Fichier manquant : $src"
    }
    Copy-Item -Force $src (Join-Path $DestDir $f)
}

Write-Host "OK - plugin deploye : $DestDir" -ForegroundColor Green
