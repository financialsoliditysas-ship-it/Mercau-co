Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$backgroundPath = Join-Path $root 'public\bajo-cauca-hero.png'
$logoPath = Join-Path $root 'public\logo-mercau-white.png'
$outputPath = Join-Path $root 'public\og-instalar-mercau.jpg'

$canvas = New-Object System.Drawing.Bitmap 1200, 630
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$background = [System.Drawing.Image]::FromFile($backgroundPath)
$scale = [Math]::Max(1200 / $background.Width, 630 / $background.Height)
$drawWidth = [int]($background.Width * $scale)
$drawHeight = [int]($background.Height * $scale)
$graphics.DrawImage($background, [int]((1200 - $drawWidth) / 2), [int]((630 - $drawHeight) / 2), $drawWidth, $drawHeight)

$overlay = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(218, 216, 32, 22))
$graphics.FillRectangle($overlay, 0, 0, 1200, 630)
$shade = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 10, 18, 30))
$graphics.FillRectangle($shade, 0, 0, 1200, 630)

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$softWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 222, 218))
$titleFont = New-Object System.Drawing.Font 'Arial', 67, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$bodyFont = New-Object System.Drawing.Font 'Arial', 31, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$labelFont = New-Object System.Drawing.Font 'Arial', 22, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)

$graphics.DrawString('NEGOCIOS DEL BAJO CAUCA', $labelFont, $accent, 70, 105)
$graphics.DrawString('Instala Mercáu', $titleFont, $white, 65, 165)
$bodyBox = New-Object System.Drawing.RectangleF 72, 265, 610, 130
$graphics.DrawString('Encuentra negocios, productos y servicios desde tu celular.', $bodyFont, $softWhite, $bodyBox)

$buttonBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
$buttonText = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 197, 30, 23))
$graphics.FillRectangle($buttonBrush, 72, 430, 290, 65)
$buttonFont = New-Object System.Drawing.Font 'Arial', 25, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('INSTALACIÓN GRATIS', $buttonFont, $buttonText, 91, 447)

$logo = [System.Drawing.Image]::FromFile($logoPath)
$graphics.DrawImage($logo, 770, 120, 350, 350)
$domainFont = New-Object System.Drawing.Font 'Arial', 24, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('www.mercau.co/instalar', $domainFont, $white, 795, 500)

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$quality = New-Object System.Drawing.Imaging.EncoderParameters 1
$quality.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L
$canvas.Save($outputPath, $encoder, $quality)

$quality.Dispose()
$domainFont.Dispose()
$buttonFont.Dispose()
$buttonText.Dispose()
$buttonBrush.Dispose()
$labelFont.Dispose()
$bodyFont.Dispose()
$titleFont.Dispose()
$accent.Dispose()
$softWhite.Dispose()
$white.Dispose()
$shade.Dispose()
$overlay.Dispose()
$logo.Dispose()
$background.Dispose()
$graphics.Dispose()
$canvas.Dispose()
