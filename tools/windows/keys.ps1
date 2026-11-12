# Brings the Renotes window to the front and types into it, in SendKeys
# notation (^n is Ctrl+N, {ENTER} is Enter). CI runs it on windows-latest.
param([Parameter(Mandatory = $true)][string]$Keys)

Add-Type -AssemblyName System.Windows.Forms
$shell = New-Object -ComObject WScript.Shell
if (-not $shell.AppActivate('Renotes')) { throw 'no Renotes window to type into' }
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait($Keys)
Start-Sleep -Milliseconds 300
