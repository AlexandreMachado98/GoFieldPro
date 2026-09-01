Add-Type -AssemblyName System.Drawing

$iconSrc = 'C:\Users\alexa\.gemini\antigravity\brain\9f80252f-5fd7-49d0-8249-60b97db99360\gofield_pro_app_icon_1788227944264.jpg'
$logoSrc = 'C:\Users\alexa\.gemini\antigravity\brain\9f80252f-5fd7-49d0-8249-60b97db99360\gofield_pro_logo_banner_1788227962210.jpg'

function Resize-Image ($srcPath, $destPath, $width, $height) {
    $dir = Split-Path -Parent $destPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $width, $height)
    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $destBmp.Dispose()
    $srcImg.Dispose()
}

Write-Host 'Generating Web/PWA Assets...'
Resize-Image $iconSrc 'public\icon-192.png' 192 192
Resize-Image $iconSrc 'public\icon-512.png' 512 512
Resize-Image $iconSrc 'public\app-icon.png' 512 512
Resize-Image $logoSrc 'public\logo-full.png' 1280 720

Write-Host 'Generating Android Mipmap Icons...'
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-mdpi\ic_launcher.png' 48 48
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png' 48 48
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-mdpi\ic_launcher_foreground.png' 108 108

Resize-Image $iconSrc 'android\app\src\main\res\mipmap-hdpi\ic_launcher.png' 72 72
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png' 72 72
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-hdpi\ic_launcher_foreground.png' 162 162

Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xhdpi\ic_launcher.png' 96 96
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png' 96 96
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xhdpi\ic_launcher_foreground.png' 216 216

Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png' 144 144
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png' 144 144
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.png' 324 324

Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png' 192 192
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png' 192 192
Resize-Image $iconSrc 'android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png' 432 432

Write-Host 'Generating Android Splash Screens...'
Resize-Image $iconSrc 'android\app\src\main\res\drawable\splash.png' 512 512
Resize-Image $iconSrc 'android\app\src\main\res\drawable-port-mdpi\splash.png' 320 480
Resize-Image $iconSrc 'android\app\src\main\res\drawable-port-hdpi\splash.png' 480 800
Resize-Image $iconSrc 'android\app\src\main\res\drawable-port-xhdpi\splash.png' 720 1280
Resize-Image $iconSrc 'android\app\src\main\res\drawable-port-xxhdpi\splash.png' 960 1600
Resize-Image $iconSrc 'android\app\src\main\res\drawable-port-xxxhdpi\splash.png' 1280 1920

Resize-Image $logoSrc 'android\app\src\main\res\drawable-land-mdpi\splash.png' 480 320
Resize-Image $logoSrc 'android\app\src\main\res\drawable-land-hdpi\splash.png' 800 480
Resize-Image $logoSrc 'android\app\src\main\res\drawable-land-xhdpi\splash.png' 1280 720
Resize-Image $logoSrc 'android\app\src\main\res\drawable-land-xxhdpi\splash.png' 1600 960
Resize-Image $logoSrc 'android\app\src\main\res\drawable-land-xxxhdpi\splash.png' 1920 1280

Write-Host 'All icons and logos generated successfully!'
