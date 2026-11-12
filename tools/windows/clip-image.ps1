# Puts a small picture on the clipboard, for pasting into a note. The
# clipboard wants a single-threaded apartment: run it with powershell -STA.
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 360, 220
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$rect = New-Object System.Drawing.Rectangle 0, 0, 360, 220
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 214, 120)), ([System.Drawing.Color]::FromArgb(80, 140, 230)), 35.0
$graphics.FillRectangle($brush, $rect)
$graphics.Dispose()
[System.Windows.Forms.Clipboard]::SetImage($bitmap)
