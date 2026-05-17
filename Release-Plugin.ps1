#Requires -Version 5.1
<#
.SYNOPSIS
  Release plugin Obsidian : bump semver, build, commit, tag, push → GitHub Actions publie la release « latest ».

.DESCRIPTION
  Copiez ce script + version-bump.mjs + .github/workflows/obsidian-plugin-release.yml dans chaque dépôt plugin.
  Adaptez la section CONFIGURATION ci-dessous et les chemins du workflow YAML.

  Prérequis côté dépôt
  --------------------
  - manifest.json, versions.json, styles.css, version-bump.mjs (dans le dossier plugin)
  - package.json du plugin avec champ "version" (source de vérité pour le bump)
  - Workflow GitHub sur push de tags semver : 1.2.3 (sans préfixe "v", convention Obsidian)
  - Repo GitHub : Settings → Actions → Workflow permissions → Read and write

  Pièges fréquents (à lire avant de copier dans un autre projet)
  --------------------------------------------------------------
  1) CI Linux / npm ci EBADPLATFORM
     Ne JAMAIS ajouter en dépendance DIRECTE (devDependencies) des paquets limités à une OS, ex. :
       @rolldown/binding-win32-x64-msvc, lightningcss-win32-x64-msvc
     Ils cassent "npm ci" sur ubuntu-latest même si vous ne build que le plugin.
     Vite/Rolldown installent les binaires natifs en optionalDependencies : laisser npm choisir.
     En monorepo : dans le workflow CI, limiter l'install :
       npm ci --include-workspace-root -w <workspace-core> -w <workspace-plugin>
     (ne pas installer tout le monorepo si un autre workspace force des binaires Windows).

  2) Tag vs version manifest
     Le tag Git DOIT être identique à manifest.json.version (ex. 1.0.3, pas v1.0.3).
     version-bump.mjs aligne manifest + versions.json avant le commit.

  3) Fichier de notes de release
     obsidian-plugin-release-notes.md (ou nom configuré) doit être COMMITÉ dans le même commit
     que le tag : le workflow utilise body_path sur ce fichier.

  4) Arbre Git propre
     Le script refuse de tourner si git status n'est pas clean.

  5) GitHub Actions / Node
     Utiliser actions/checkout@v5, actions/setup-node@v5, node-version "24",
     env FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true (dépréciation Node 20 sur les runners).

  6) Plugin seul à la racine (pas monorepo)
     Mettre $PluginSubdir = '.' ; $CoreWorkspace = $null ;
     build via npm run build dans $PluginSubdir au lieu de -w.

  7) main.js
     Soit commité (comme ici), soit produit uniquement en CI — dans ce cas ne pas l'ajouter
     à git add local, mais le workflow doit toujours le builder avant softprops/action-gh-release.

.PARAMETER BumpKind
  Patch (défaut), Minor ou Major.

.PARAMETER SkipBuild
  Ne pas exécuter npm run build (déconseillé pour une vraie release).

.PARAMETER NoPush
  Commit et tag en local uniquement (pas de git push).

.PARAMETER Remote
  Remote Git (défaut : origin).

.EXAMPLE
  .\Release-Plugin.ps1
  .\Release-Plugin.ps1 -BumpKind Minor
  .\Release-Plugin.ps1 -NoPush
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

# =============================================================================
# CONFIGURATION — adapter lors de la copie vers un autre dépôt
# =============================================================================
$PluginSubdir = 'obsidian-plugin'                    # '.' si le plugin est à la racine
$CoreWorkspace = '@obbwasm/core'                     # $null si aucun package partagé à compiler avant le plugin
$PluginWorkspace = 'obsidian-plugin'                 # nom du workspace npm (package.json → "name") ; $null = npm run build dans $PluginSubdir
$ReleaseNotesFile = 'obsidian-plugin-release-notes.md' # doit correspondre à body_path dans le workflow YAML
$ReleaseNotesTitle = 'OBB WASM Book'                 # titre H1 dans le fichier de notes
$GhActionsUrl = 'https://github.com/Morglaf/obbwasm/actions' # lien affiché en fin de script ; $null pour ne rien afficher
# Chemins Git relatifs à la racine du dépôt (préfixe = $PluginSubdir sauf si '.' → pas de préfixe)
# =============================================================================

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

function Get-PluginRepoRelativePath {
    param([Parameter(Mandatory)][string] $FileName)
    if ($PluginSubdir -eq '.' -or [string]::IsNullOrWhiteSpace($PluginSubdir)) {
        return $FileName
    }
    return "$($PluginSubdir.TrimEnd('/\'))/$FileName"
}

$repoRoot = $PSScriptRoot
$pluginDir = if ($PluginSubdir -eq '.' -or [string]::IsNullOrWhiteSpace($PluginSubdir)) {
    $repoRoot
} else {
    Join-Path $repoRoot $PluginSubdir
}
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
    throw "$(Get-PluginRepoRelativePath 'package.json') : champ version vide ou absent."
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
    throw "Impossible de mettre à jour la version dans $(Get-PluginRepoRelativePath 'package.json')."
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

$notesPath = Join-Path $repoRoot $ReleaseNotesFile
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
$header = "# $ReleaseNotesTitle $newVersion`n`n"
$notesBody = $header + ($logLines | Out-String).Trim() + "`n"
Set-Utf8NoBomFile -Path $notesPath -Content $notesBody

if (-not $SkipBuild) {
    if ($CoreWorkspace) {
        Write-Host "Build $CoreWorkspace..." -ForegroundColor Cyan
        & npm run build -w $CoreWorkspace
        if ($LASTEXITCODE -ne 0) { throw "npm run build -w $CoreWorkspace a échoué (code $LASTEXITCODE)." }
    }
    if ($PluginWorkspace) {
        Write-Host "Build $PluginWorkspace..." -ForegroundColor Cyan
        & npm run build -w $PluginWorkspace
        if ($LASTEXITCODE -ne 0) { throw "npm run build -w $PluginWorkspace a échoué (code $LASTEXITCODE)." }
    }
    else {
        Write-Host "Build plugin (npm run build dans $pluginDir)..." -ForegroundColor Cyan
        Push-Location -LiteralPath $pluginDir
        try {
            & npm run build
            if ($LASTEXITCODE -ne 0) { throw "npm run build a échoué (code $LASTEXITCODE)." }
        }
        finally {
            Pop-Location
        }
    }
}

$mainJs = Join-Path $pluginDir 'main.js'
if (-not (Test-Path -LiteralPath $mainJs)) {
    throw "$(Get-PluginRepoRelativePath 'main.js') absent après build. Relancez sans -SkipBuild."
}

& git rev-parse --verify --quiet "refs/tags/$newVersion" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    throw "Le tag Git '$newVersion' existe déjà."
}

$pathsToAdd = @(
    (Get-PluginRepoRelativePath 'package.json'),
    (Get-PluginRepoRelativePath 'manifest.json'),
    (Get-PluginRepoRelativePath 'versions.json'),
    (Get-PluginRepoRelativePath 'main.js'),
    (Get-PluginRepoRelativePath 'styles.css'),
    (Get-PluginRepoRelativePath 'pdf.worker.min.mjs'),
    $ReleaseNotesFile
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
Write-Host "GitHub Actions va publier la release (latest) avec main.js, manifest.json, styles.css, versions.json." -ForegroundColor Cyan
if ($GhActionsUrl) {
    Write-Host "Suivi : $GhActionsUrl" -ForegroundColor Gray
}
