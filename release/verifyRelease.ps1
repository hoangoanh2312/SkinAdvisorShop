param([string]$ZipPath = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$release = Join-Path $PSScriptRoot 'SKINORA_FINAL'
$zip = if ($ZipPath) { $ZipPath } else { Join-Path $PSScriptRoot 'SKINORA_FINAL_20261023.zip' }
if (-not (Test-Path -LiteralPath $zip -PathType Leaf)) { throw 'ZIP_MISSING' }
$files = @(Get-ChildItem -LiteralPath $release -Recurse -Force -File)
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $entries = @($archive.Entries | Where-Object { $_.Name })
  if ($entries.Count -ne $files.Count) { throw "ZIP_ENTRY_COUNT_MISMATCH:$($entries.Count):$($files.Count)" }
  $names = @($entries | ForEach-Object { $_.FullName.Replace('\', '/') })
  if (@($names | Where-Object { $_ -match '(^|/)(\.env|node_modules|\.git|dist|coverage)(/|$)' }).Count) { throw 'FORBIDDEN_ZIP_ENTRY' }
  foreach ($name in @('SKINORA_FINAL/backend/.env.example', 'SKINORA_FINAL/frontend/.env.example', 'SKINORA_FINAL/README.md', 'SKINORA_FINAL/BAO_CAO_KIEM_THU_SKINORA.md', 'SKINORA_FINAL/DANH_SACH_CHUC_NANG.md', 'SKINORA_FINAL/HUONG_DAN_CAI_DAT.md', 'SKINORA_FINAL/TRANG_THAI_48_SAN_PHAM.md', 'SKINORA_FINAL/NHAT_KY_SUA_DOI.md')) {
    if ($name -notin $names) { throw "REQUIRED_FILE_MISSING:$name" }
  }
} finally { $archive.Dispose() }

$verify = Join-Path $PSScriptRoot ('_verify_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $verify | Out-Null
try {
  Expand-Archive -LiteralPath $zip -DestinationPath $verify
  $extracted = Join-Path $verify 'SKINORA_FINAL'
  $extractedFiles = @(Get-ChildItem -LiteralPath $extracted -Recurse -Force -File)
  if ($extractedFiles.Count -ne $files.Count) { throw 'EXTRACTED_FILE_COUNT_MISMATCH' }
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($release.Length + 1)
    $copy = Join-Path $extracted $relative
    if (-not (Test-Path -LiteralPath $copy -PathType Leaf)) { throw "EXTRACTED_FILE_MISSING:$relative" }
    if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash) { throw "EXTRACTED_HASH_MISMATCH:$relative" }
  }
} finally {
  $resolved = (Resolve-Path -LiteralPath $verify).Path
  $expectedPrefix = (Resolve-Path -LiteralPath $PSScriptRoot).Path + [IO.Path]::DirectorySeparatorChar + '_verify_'
  if (-not $resolved.StartsWith($expectedPrefix)) { throw 'UNSAFE_VERIFY_CLEANUP_PATH' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
$zipInfo = Get-Item -LiteralPath $zip
Write-Output "RELEASE_VERIFY_PASS files=$($files.Count) bytes=$($zipInfo.Length) zip=$zip"
