param(
    [string]$PhpHost = "127.0.0.1",
    [int]$PhpPort = 8088,
    [string]$ViteHost = "127.0.0.1",
    [int]$VitePort = 5173
)

$ErrorActionPreference = "Stop"

function Start-LoggedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$StdOutPath,
        [Parameter(Mandatory = $true)][string]$StdErrPath
    )

    $process = Start-Process -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -NoNewWindow `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath `
        -PassThru

    if ($null -eq $process) {
        throw "Impossible de demarrer le processus $Name."
    }

    return $process
}

function Stop-IfRunning {
    param(
        [System.Diagnostics.Process]$Process
    )

    if ($null -ne $Process -and -not $Process.HasExited) {
        try {
            $Process.Kill()
            $Process.WaitForExit(5000) | Out-Null
        } catch {
            Write-Host "[runner] Echec de l'arret du processus pid=$($Process.Id): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

function Read-NewLogLines {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][ref]$Position,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [Parameter(Mandatory = $true)][ConsoleColor]$Color
    )

    if (-not (Test-Path $Path)) {
        return
    }

    $fs = $null
    $reader = $null
    try {
        $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        if ($Position.Value -gt $fs.Length) {
            $Position.Value = 0
        }
        $fs.Seek($Position.Value, [System.IO.SeekOrigin]::Begin) | Out-Null
        $reader = New-Object System.IO.StreamReader($fs)
        while (-not $reader.EndOfStream) {
            $line = $reader.ReadLine()
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                Write-Host "$Prefix $line" -ForegroundColor $Color
            }
        }
        $Position.Value = $fs.Position
    }
    finally {
        if ($reader -ne $null) { $reader.Dispose() }
        elseif ($fs -ne $null) { $fs.Dispose() }
    }
}

function Read-ViteStderrLines {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][ref]$Position
    )

    if (-not (Test-Path $Path)) {
        return
    }

    $fs = $null
    $reader = $null
    try {
        $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        if ($Position.Value -gt $fs.Length) {
            $Position.Value = 0
        }
        $fs.Seek($Position.Value, [System.IO.SeekOrigin]::Begin) | Out-Null
        $reader = New-Object System.IO.StreamReader($fs)
        while (-not $reader.EndOfStream) {
            $line = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($line)) {
                continue
            }

            # En mode --debug, Vite ecrit beaucoup d'info sur stderr.
            if ($line -match "(?i)\b(error|failed|fatal|exception)\b") {
                Write-Host "[vite][ERR] $line" -ForegroundColor Red
            }
            else {
                Write-Host "[vite][DEBUG] $line" -ForegroundColor DarkGray
            }
        }
        $Position.Value = $fs.Position
    }
    finally {
        if ($reader -ne $null) { $reader.Dispose() }
        elseif ($fs -ne $null) { $fs.Dispose() }
    }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$webDir = Join-Path $root "web"
$appDir = Join-Path $root "app"

if (-not (Test-Path $webDir)) { throw "Dossier web introuvable: $webDir" }
if (-not (Test-Path $appDir)) { throw "Dossier app introuvable: $appDir" }

Write-Host "[runner] Root: $root" -ForegroundColor Cyan
Write-Host "[runner] API : http://$PhpHost`:$PhpPort/api" -ForegroundColor Cyan
Write-Host "[runner] Web : http://$ViteHost`:$VitePort" -ForegroundColor Cyan
Write-Host "[runner] Appuie sur Ctrl+C pour tout stopper." -ForegroundColor Cyan

$phpArgs = "-d display_errors=1 -d display_startup_errors=1 -d error_reporting=E_ALL -S $PhpHost`:$PhpPort -t app"
$viteArgs = "/c npm run dev -- --host $ViteHost --port $VitePort --strictPort --debug"

$php = $null
$vite = $null
$runId = [guid]::NewGuid().ToString("N")
$phpOut = Join-Path $env:TEMP "obbwasm-$runId-php-out.log"
$phpErr = Join-Path $env:TEMP "obbwasm-$runId-php-err.log"
$viteOut = Join-Path $env:TEMP "obbwasm-$runId-vite-out.log"
$viteErr = Join-Path $env:TEMP "obbwasm-$runId-vite-err.log"

"" | Set-Content -Path $phpOut -Encoding utf8
"" | Set-Content -Path $phpErr -Encoding utf8
"" | Set-Content -Path $viteOut -Encoding utf8
"" | Set-Content -Path $viteErr -Encoding utf8

$phpOutPos = 0L
$phpErrPos = 0L
$viteOutPos = 0L
$viteErrPos = 0L

try {
    $php = Start-LoggedProcess -Name "php" -FilePath "php" -Arguments $phpArgs -WorkingDirectory $root -StdOutPath $phpOut -StdErrPath $phpErr
    Start-Sleep -Milliseconds 300
    $vite = Start-LoggedProcess -Name "vite" -FilePath "cmd.exe" -Arguments $viteArgs -WorkingDirectory $webDir -StdOutPath $viteOut -StdErrPath $viteErr

    while ($true) {
        Start-Sleep -Milliseconds 500

        Read-NewLogLines -Path $phpOut -Position ([ref]$phpOutPos) -Prefix "[php]" -Color Green
        Read-NewLogLines -Path $phpErr -Position ([ref]$phpErrPos) -Prefix "[php][ERR]" -Color Red
        Read-NewLogLines -Path $viteOut -Position ([ref]$viteOutPos) -Prefix "[vite]" -Color Magenta
        Read-ViteStderrLines -Path $viteErr -Position ([ref]$viteErrPos)

        if ($php.HasExited) {
            throw "Le serveur PHP s'est arrete (code=$($php.ExitCode))."
        }

        if ($vite.HasExited) {
            throw "Le serveur Vite s'est arrete (code=$($vite.ExitCode))."
        }
    }
}
catch {
    Write-Host "[runner] $($_.Exception.Message)" -ForegroundColor Yellow
}
finally {
    Stop-IfRunning -Process $vite
    Stop-IfRunning -Process $php
    foreach ($logPath in @($phpOut, $phpErr, $viteOut, $viteErr)) {
        if (Test-Path $logPath) {
            Remove-Item -Path $logPath -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "[runner] Tous les processus ont ete arretes." -ForegroundColor Cyan
}
