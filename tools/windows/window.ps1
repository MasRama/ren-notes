# Shows the Renotes window maximized, restored or minimized, as its title
# bar buttons would. CI runs it on windows-latest.
param([Parameter(Mandatory = $true)][ValidateSet('Maximize', 'Restore', 'Minimize')][string]$State)

if (-not ('Win32.Show' -as [type])) {
Add-Type -Namespace Win32 -Name Show -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
'@
}
$commands = @{ Maximize = 3; Restore = 9; Minimize = 6 }
$app = Get-Process -Name renotes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $app) { throw 'no Renotes window' }
[Win32.Show]::ShowWindow($app.MainWindowHandle, $commands[$State]) | Out-Null
Start-Sleep -Milliseconds 800
