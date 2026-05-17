#Requires -Version 5.1
<#
.SYNOPSIS
  Release du plugin Obsidian (obsidian-plugin/) : bump semver, sync manifest/versions.json, build, commit, tag, push.

.DESCRIPTION
  - Lit la version dans obsidian-plugin/package.json
  - Met à jour manifest.json et versions.json (version-bump.mjs)
  - Build @obbwasm/core + obsidian-plugin (npm workspaces)
  - Commit, tag semver (ex. 0.1.1), push → GitHub Actions crée la release « latest » avec les artefacts

.PARAMETER BumpKind
  Patch (défaut), Minor ou Major.

.PARAMETER SkipBuild
  Ne pas exécuter npm run build (déconseillé pour une vraie release).

.PARAMETER NoPush
  Commit et tag en local uniquement (pas de git push).

.PARAMETER Remote
  Remote Git (défaut : origin).
#>
param(
    [ValidateSet('Patch', 'Minor', 'Major')]
    [string] $BumpKind = 'Patch',

    [switch] $SkipBuild,

    [switch] $NoPush,

    [string] $Remote = 'origin'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-CommandExists {
    param([Parameter(Mandatory)][string] $Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Set-Utf8NoBomFile {
    param(
        [Parameter(Mandatory)][string] $Path,
        [Parameter(Mandatory)][string] $Content
    )
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Get-NextSemVer {
    param(
        [Parameter(Mandatory)][string] $Version,
        [Parameter(Mandatory)][ValidateSet('Patch', 'Minor', 'Major')][string] $Kind
    )
    if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
        throw "Version non semver à trois segments: $Version"
    }
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
    switch ($Kind) {
        'Major' { return "$($major + 1).0.0" }
        'Minor' { return "$major.$($minor + 1).0" }
        'Patch' { return "$major.$minor.$($patch + 1)" }
    }
}

$repoRoot = $PSScriptRoot
$pluginDir = Join-Path $repoRoot 'obsidian-plugin'
Set-Location -LiteralPath $repoRoot

foreach ($cmd in @('git', 'node', 'npm')) {
    if (-not (Test-CommandExists $cmd)) {
        throw "Commande introuvable dans le PATH: $cmd"
    }
}

$required = @(
    (Join-Path $repoRoot 'package.json'),
    (Join-Path $pluginDir 'package.json'),
    (Join-Path $pluginDir 'manifest.json'),
    (Join-Path $pluginDir 'versions.json'),
    (Join-Path $pluginDir 'version-bump.mjs')
)
foreach ($p in $required) {
    if (-not (Test-Path -LiteralPath $p)) {
        throw "Fichier requis absent: $p"
    }
}

$dirty = (& git status --porcelain 2>&1 | Out-String).Trim()
if ($dirty) {
    throw "Arbre Git non propre. Committez ou stash vos changements avant une release.`n$dirty"
}

$packagePath = Join-Path $pluginDir 'package.json'
$packageRaw = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8
$packageJson = $packageRaw | ConvertFrom-Json
$currentVersion = [string] $packageJson.version
if ([string]::IsNullOrWhiteSpace($currentVersion)) {
    throw "obsidian-plugin/package.json : champ version vide ou absent."
}

$newVersion = Get-NextSemVer -Version $currentVersion -Kind $BumpKind
Write-Host "Version plugin : $currentVersion → $newVersion ($BumpKind)" -ForegroundColor Cyan

$escapedCurrent = [regex]::Escape($currentVersion)
$updatedPackage = [regex]::Replace(
    $packageRaw,
    '("version"\s*:\s*")' + $escapedCurrent + '(")',
    '${1}' + $newVersion + '$2',
    1
)
if ($updatedPackage -eq $packageRaw) {
    throw "Impossible de mettre à jour la version dans obsidian-plugin/package.json."
}
Set-Utf8NoBomFile -Path $packagePath -Content $updatedPackage

$env:npm_package_version = $newVersion
try {
    Push-Location -LiteralPath $pluginDir
    & node (Join-Path $pluginDir 'version-bump.mjs')
    if ($LASTEXITCODE -ne 0) { throw "version-bump.mjs a échoué (code $LASTEXITCODE)." }
}
finally {
    Pop-Location
    Remove-Item Env:\npm_package_version -ErrorAction SilentlyContinue
}

$notesPath = Join-Path $repoRoot 'obsidian-plugin-release-notes.md'
$lastTag = $null
$describeResult = & git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*' 2>&1
if ($LASTEXITCODE -eq 0) {
    $lastTag = ($describeResult | Out-String).Trim()
}
$logLines = if ($lastTag) {
    & git log "$lastTag..HEAD" --oneline 2>&1
}
else {
    & git log --oneline -n 30 2>&1
}
if ($LASTEXITCODE -ne 0) {
    throw "git log a échoué (code $LASTEXITCODE)."
}
$header = "# OBB WASM Book $newVersion`n`n"
$notesBody = $header + ($logLines | Out-String).Trim() + "`n"
Set-Utf8NoBomFile -Path $notesPath -Content $notesBody

if (-not $SkipBuild) {
    Write-Host "Build @obbwasm/core + obsidian-plugin..." -ForegroundColor Cyan
    & npm run build -w @obbwasm/core
    if ($LASTEXITCODE -ne 0) { throw "npm run build -w @obbwasm/core a échoué (code $LASTEXITCODE)." }
    & npm run build -w obsidian-plugin
    if ($LASTEXITCODE -ne 0) { throw "npm run build -w obsidian-plugin a échoué (code $LASTEXITCODE)." }
}

$mainJs = Join-Path $pluginDir 'main.js'
if (-not (Test-Path -LiteralPath $mainJs)) {
    throw "obsidian-plugin/main.js absent après build. Relancez sans -SkipBuild."
}

& git rev-parse --verify --quiet "refs/tags/$newVersion" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    throw "Le tag Git '$newVersion' existe déjà."
}

$pathsToAdd = @(
    'obsidian-plugin/package.json',
    'obsidian-plugin/manifest.json',
    'obsidian-plugin/versions.json',
    'obsidian-plugin/main.js',
    'obsidian-plugin/styles.css',
    'obsidian-plugin-release-notes.md'
)
& git add -- $pathsToAdd
if ($LASTEXITCODE -ne 0) { throw "git add a échoué (code $LASTEXITCODE)." }

& git commit -m "release(plugin): $newVersion"
if ($LASTEXITCODE -ne 0) { throw "git commit a échoué (code $LASTEXITCODE)." }

& git tag -a $newVersion -m $newVersion
if ($LASTEXITCODE -ne 0) { throw "git tag a échoué (code $LASTEXITCODE)." }

if ($NoPush) {
    Write-Host "OK — Release $newVersion préparée en local (-NoPush). Poussez avec :" -ForegroundColor Green
    Write-Host "  git push $Remote HEAD" -ForegroundColor Gray
    Write-Host "  git push $Remote refs/tags/$newVersion" -ForegroundColor Gray
    exit 0
}

& git push $Remote HEAD
if ($LASTEXITCODE -ne 0) { throw "git push a échoué (code $LASTEXITCODE)." }

& git push $Remote "refs/tags/$newVersion"
if ($LASTEXITCODE -ne 0) { throw "git push tag a échoué (code $LASTEXITCODE)." }

Write-Host ""
Write-Host "Release plugin $newVersion poussée sur $Remote." -ForegroundColor Green
Write-Host "GitHub Actions « Obsidian plugin release » va publier la release (latest) avec main.js, manifest.json, styles.css, versions.json." -ForegroundColor Cyan
Write-Host "Suivi : https://github.com/Morglaf/obbwasm/actions" -ForegroundColor Gray
