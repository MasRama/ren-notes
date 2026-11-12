# Installs Renotes from the NSIS setup the way a user would, uses it with
# the keyboard and clipboard, and screenshots each step into shots/. Fails
# when what was typed is not in the library. CI runs it on windows-latest.
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

function Shot([string]$Name) { & "$here/shot.ps1" -Name $Name }
function Keys([string]$Keys) { & "$here/keys.ps1" -Keys $Keys }
function Query([string]$Sql) { (python "$here/query.py" $Sql | Out-String).Trim() }
function Expect([string]$What, [string]$Sql, [string]$Want) {
    $got = Query $Sql
    if ($got -ne $Want) { throw "${What}: expected '$Want', got '$got'" }
    Write-Output "ok: $What"
}
function Start-Renotes {
    Start-Process $script:exe
    foreach ($i in 1..60) {
        Start-Sleep -Milliseconds 500
        $app = Get-Process -Name renotes -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
        if ($app) { Start-Sleep -Seconds 4; return }
    }
    throw 'Renotes showed no window'
}
function Stop-Renotes {
    foreach ($app in Get-Process -Name renotes -ErrorAction SilentlyContinue) { $app.CloseMainWindow() | Out-Null }
    foreach ($i in 1..40) {
        Start-Sleep -Milliseconds 250
        if (-not (Get-Process -Name renotes -ErrorAction SilentlyContinue)) { return }
    }
    throw 'Renotes did not close'
}

$setup = Get-ChildItem target/release/bundle/nsis/*-setup.exe | Select-Object -First 1
if (-not $setup) { throw 'no setup.exe was built' }
Start-Process $setup.FullName -ArgumentList '/S' -Wait
$found = Get-ChildItem "$env:LOCALAPPDATA\Renotes" -Filter renotes.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $found) { throw "renotes.exe is not under $env:LOCALAPPDATA\Renotes" }
$script:exe = $found.FullName

Start-Renotes
Shot 'first-start'
if (-not (Test-Path "$env:APPDATA\Renotes\library.sqlite")) { throw 'no library in %APPDATA%\Renotes' }

# A second start hands over to the window already open.
Start-Process $script:exe
Start-Sleep -Seconds 4
$running = @(Get-Process -Name renotes).Count
if ($running -ne 1) { throw "expected one Renotes, found $running" }

Keys '^n'
Start-Sleep -Seconds 1
Keys 'Hello from Windows{ENTER}Typed on a runner, tagged #windows{ENTER}'
Start-Sleep -Seconds 2
Shot 'note'

powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "$here/clip-image.ps1"
Keys '^v'
Start-Sleep -Seconds 3
Keys '{ENTER}'
# A page of our own with a card picture: real sites rate-limit runners.
$site = Join-Path $env:RUNNER_TEMP 'site'
New-Item -ItemType Directory -Force $site | Out-Null
Set-Content -Path "$site/index.html" -Value '<html><head><title>Renotes on Windows</title><meta property="og:title" content="A page with a card" /><meta property="og:site_name" content="Smoke Site" /><meta property="og:image" content="/card.png" /></head><body>hi</body></html>'
Add-Type -AssemblyName System.Drawing
$card = New-Object System.Drawing.Bitmap 400, 210
$g = [System.Drawing.Graphics]::FromImage($card)
$g.Clear([System.Drawing.Color]::FromArgb(46, 160, 110))
$g.Dispose()
$card.Save("$site/card.png", [System.Drawing.Imaging.ImageFormat]::Png)
$server = Start-Process python -ArgumentList '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', $site -PassThru -NoNewWindow
Start-Sleep -Seconds 2
Set-Clipboard -Value 'http://127.0.0.1:8765/'
Keys '^v'
Start-Sleep -Seconds 6
Stop-Process -Id $server.Id
Shot 'picture-and-link'

Expect 'the note was saved' "select count(*) from notes where title = 'Hello from Windows' and deleted_at is null" '1'
Expect 'its tag was read' "select count(*) from note_tags where tag = 'windows'" '1'
Expect 'the picture and the card picture were kept' "select count(*) from attachments where mime like 'image/%'" '2'

& "$here/window.ps1" -State Maximize
Shot 'maximized'
& "$here/window.ps1" -State Restore

# Closed and opened again, it comes back where it was.
Stop-Renotes
Start-Renotes
Shot 'reopened'
