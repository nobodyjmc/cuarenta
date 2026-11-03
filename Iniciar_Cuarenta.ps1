[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$serverPath = Join-Path $projectRoot 'scripts\serve.mjs'
$baseUri = "http://127.0.0.1:$Port"
$healthUri = "$baseUri/__cuarenta_health"

function Get-CuarentaHealth {
    try {
        return Invoke-RestMethod -Uri $healthUri -Method Get -TimeoutSec 1
    }
    catch {
        return $null
    }
}

function Test-LocalPort {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.ConnectAsync('127.0.0.1', $Port)
        if (-not $pending.Wait(600)) { return $false }
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

try {
    $health = Get-CuarentaHealth
    if ($health -and $health.app -ceq 'cuarenta-local') {
        Write-Host "Cuarenta ya esta disponible en $baseUri"
        if (-not $NoBrowser) { Start-Process -FilePath $baseUri }
        exit 0
    }

    if (Test-LocalPort) {
        throw "El puerto $Port esta ocupado por otra aplicacion. No se ha cerrado ningun proceso. Prueba: .\Iniciar_Cuarenta.ps1 -Port 4174"
    }

    if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\index.html') -PathType Leaf)) {
        throw 'Faltan archivos del juego. Conserva la carpeta app completa junto a este lanzador.'
    }

    $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($nodeCommand) {
        $nodeExecutable = $nodeCommand.Source
    }
    else {
        $nodeExecutable = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
        if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf)) {
            throw 'No se encontro Node.js. Este lanzador necesita Node.js 20 o superior; no descarga ni instala programas.'
        }
    }

    $logDirectory = Join-Path $projectRoot '.local'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $outputLog = Join-Path $logDirectory "server-$Port.stdout.log"
    $errorLog = Join-Path $logDirectory "server-$Port.stderr.log"
    $arguments = @(('"' + $serverPath + '"'), '--port', [string]$Port)
    $serverProcess = Start-Process -FilePath $nodeExecutable -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru

    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    $ready = $false
    while ($watch.Elapsed.TotalSeconds -lt 12) {
        $health = Get-CuarentaHealth
        if ($health -and $health.app -ceq 'cuarenta-local') {
            $ready = $true
            break
        }
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) { break }
        Start-Sleep -Milliseconds 200
    }
    $watch.Stop()

    if (-not $ready) {
        throw "No se pudo iniciar el servidor local. Revisa $errorLog. Si el puerto $Port esta ocupado, elige otro con -Port."
    }

    Write-Host "Cuarenta listo: $baseUri"
    Write-Host "El servidor funciona solo en este dispositivo. Registros: $logDirectory"
    if (-not $NoBrowser) { Start-Process -FilePath $baseUri }
    exit 0
}
catch {
    Write-Host "No se pudo abrir Cuarenta: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
