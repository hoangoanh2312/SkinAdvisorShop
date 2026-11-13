$ErrorActionPreference = 'Stop'
try {
  $root = Split-Path -Parent $MyInvocation.MyCommand.Path
  $main = Join-Path $root 'frontend\src\main.jsx'
  $css = Join-Path $root 'frontend\src\sandwich-vibrant-theme.css'
  $incoming = Join-Path $root 'assets\sandwich-vibrant-theme.css'

  if (!(Test-Path -LiteralPath $main)) { throw 'Chua tim thay frontend\src\main.jsx. Giai nen ZIP vao D:\SkinAdvisorShop.' }
  if (!(Test-Path -LiteralPath $incoming)) { throw 'ZIP thieu file assets\sandwich-vibrant-theme.css.' }

  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $backupFolder = Join-Path $root "SAO_LUU_GIAO_DIEN_$stamp"
  New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
  Copy-Item -LiteralPath $main -Destination (Join-Path $backupFolder 'main.jsx')
  if (Test-Path -LiteralPath $css) {
    Copy-Item -LiteralPath $css -Destination (Join-Path $backupFolder 'sandwich-vibrant-theme.css')
  }

  Copy-Item -LiteralPath $incoming -Destination $css -Force
  $source = [System.IO.File]::ReadAllText($main, [System.Text.Encoding]::UTF8)
  $import = 'import "./sandwich-vibrant-theme.css";'
  if (!$source.Contains('sandwich-vibrant-theme.css')) {
    $anchors = @('import "./sandwich-typography.css";', 'import "./phase12.css";')
    $found = $false
    foreach ($anchor in $anchors) {
      if ($source.Contains($anchor)) {
        $source = $source.Replace($anchor, "$anchor`r`n$import")
        $found = $true
        break
      }
    }
    if (!$found) { throw 'Khong tim thay dong import CSS phu hop. main.jsx chua duoc sua, xem HUONG_DAN.txt.' }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($main, $source, $utf8NoBom)
  }
  Write-Host 'DA CAP NHAT giao dien sandwich dong bo.' -ForegroundColor Green
  Write-Host "Sao luu: $backupFolder"
  Write-Host 'Hay tai lai trang voi Ctrl+F5. Neu can, khoi dong lai frontend.'
} catch {
  Write-Host "LOI: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
