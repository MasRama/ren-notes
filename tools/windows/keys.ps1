# Brings the Renotes window to the front and types into it, in SendKeys
# notation (^n is Ctrl+N, {ENTER} is Enter). CI runs it on windows-latest.
param([Parameter(Mandatory = $true)][string]$Keys)

Add-Type -AssemblyName System.Windows.Forms
if (-not ('Win32.Focus' -as [type])) {
Add-Type -Namespace Win32 -Name Focus -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);
'@
}

$app = Get-Process -Name renotes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $app) { throw 'no Renotes window to type into' }
$window = $app.MainWindowHandle
foreach ($i in 1..10) {
    if ([Win32.Focus]::GetForegroundWindow() -eq $window) { break }
    # Windows lets a background process take the foreground right after a
    # key press; a lone Alt is the usual way in.
    [Win32.Focus]::keybd_event(0x12, 0, 0, [System.UIntPtr]::Zero)
    [Win32.Focus]::keybd_event(0x12, 0, 2, [System.UIntPtr]::Zero)
    [Win32.Focus]::SetForegroundWindow($window) | Out-Null
    Start-Sleep -Milliseconds 300
}
if ([Win32.Focus]::GetForegroundWindow() -ne $window) { throw 'Renotes would not come to the front' }
[System.Windows.Forms.SendKeys]::SendWait($Keys)
Start-Sleep -Milliseconds 300
