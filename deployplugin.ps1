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

$TypesetSrc = Join-Path $RepoRoot "typeset"
if (Test-Path $TypesetSrc) {
    $TypesetDest = Join-Path $DestDir "typeset"
    Write-Host "Fusion typeset/ -> $TypesetDest (sans supprimer les gabarits locaux absents du depot)" -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $TypesetDest | Out-Null
    Get-ChildItem -Path $TypesetSrc -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($TypesetSrc.Length + 1)
        $destFile = Join-Path $TypesetDest $rel
        $destDir = Split-Path $destFile -Parent
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Copy-Item -Path $_.FullName -Destination $destFile -Force
    }
} else {
    Write-Warning "Dossier typeset introuvable : $TypesetSrc (gabarits non deployes)"
}

Write-Host "OK - plugin deploye : $DestDir" -ForegroundColor Green
