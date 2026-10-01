# Downscales JPEGs for the web using System.Drawing, which ships with Windows,
# so there is nothing to install. Caps the longest edge and re-encodes.
#
#   powershell -File tools/resize-images.ps1 -Folder assets/img/headshots
#
# Used by the local editor when photos are dropped in, and safe to run by hand.

param(
  [Parameter(Mandatory = $true)][string]$Folder,
  [string]$Filter  = '*.jpg',
  [int]$MaxEdge    = 1600,
  [int]$Quality    = 82
)

Add-Type -AssemblyName System.Drawing

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }

$totalBefore = 0
$totalAfter  = 0

Get-ChildItem -Path $Folder -Filter $Filter | Sort-Object Name | ForEach-Object {
  $path   = $_.FullName
  $before = $_.Length
  $totalBefore += $before

  try {
    $img = [System.Drawing.Image]::FromFile($path)
  } catch {
    Write-Output ("{0}  SKIPPED - not a readable image" -f $_.Name)
    return
  }

  $ow = $img.Width; $oh = $img.Height

  # Explicit doubles: PowerShell will otherwise bind Math::Min to the (int,int)
  # overload and round a ratio like 0.8 up to 1, silently skipping the file.
  $ratio = [Math]::Min([double]$MaxEdge / [double]$ow, [double]$MaxEdge / [double]$oh)

  if ($ratio -ge 1) {
    $img.Dispose()
    $totalAfter += $before
    Write-Output ("{0}  {1}x{2}  already within {3}px" -f $_.Name, $ow, $oh, $MaxEdge)
    return
  }

  $nw = [int][Math]::Round($ow * $ratio)
  $nh = [int][Math]::Round($oh * $ratio)

  $bmp = New-Object System.Drawing.Bitmap $nw, $nh
  $bmp.SetResolution(72, 72)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $g.Dispose()
  $img.Dispose()

  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                   [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

  $tmp = "$path.tmp"
  $bmp.Save($tmp, $codec, $ep)
  $bmp.Dispose()
  $ep.Dispose()

  Remove-Item $path -Force
  Rename-Item $tmp (Split-Path $path -Leaf)

  $after = (Get-Item $path).Length
  $totalAfter += $after

  Write-Output ("{0}  {1}x{2} -> {3}x{4}   {5} KB -> {6} KB  (-{7}%)" -f `
    $_.Name, $ow, $oh, $nw, $nh,
    [int]($before/1KB), [int]($after/1KB),
    [int]((1 - $after/$before) * 100))
}

if ($totalBefore -gt 0) {
  Write-Output ""
  Write-Output ("TOTAL  {0} MB -> {1} MB" -f `
    [math]::Round($totalBefore/1MB,2), [math]::Round($totalAfter/1MB,2))
}
