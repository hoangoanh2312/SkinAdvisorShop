$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$release = Join-Path $PSScriptRoot 'SKINORA_FINAL'
$zip = Join-Path $PSScriptRoot 'SKINORA_FINAL_20261023.zip'
if (-not (Test-Path -LiteralPath (Join-Path $release 'README.md'))) { throw 'RELEASE_DOCS_MISSING' }
if (Test-Path -LiteralPath $zip) { throw 'ZIP_ALREADY_EXISTS_REFUSING_OVERWRITE' }
if (Test-Path -LiteralPath (Join-Path $release 'backend')) { throw 'RELEASE_SOURCE_ALREADY_EXISTS_REFUSING_OVERWRITE' }

function Copy-ReleaseFile([string]$relative) {
  $source = Join-Path $workspace $relative
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "MISSING_SOURCE_FILE:$relative" }
  $target = Join-Path $release $relative
  $parent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target
}
function Copy-ReleaseDirectory([string]$relative) {
  $source = Join-Path $workspace $relative
  if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "MISSING_SOURCE_DIR:$relative" }
  $target = Join-Path $release $relative
  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Recurse
}

foreach ($relative in @('.gitignore', 'backend/app.js', 'backend/server.js', 'backend/package.json', 'backend/package-lock.json', 'backend/.env.example', 'frontend/index.html', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/.env.example', 'frontend/.gitignore', 'frontend/.oxlintrc.json', 'frontend/vite.config.js', 'frontend/README.md', 'docs/cloudinary-setup.md', 'docs/business-database.md', 'docs/real-product-sources.md')) { Copy-ReleaseFile $relative }
foreach ($relative in @('backend/assets', 'backend/config', 'backend/controllers', 'backend/data', 'backend/middleware', 'backend/models', 'backend/routes', 'backend/scripts', 'backend/services', 'backend/utils', 'frontend/public', 'frontend/src', 'anh')) { Copy-ReleaseDirectory $relative }

$files = @(Get-ChildItem -LiteralPath $release -Recurse -Force -File)
$forbidden = @($files | Where-Object { $_.Name -eq '.env' -or $_.Name -eq '.git' -or $_.Extension -in @('.log', '.pem', '.key', '.p12') -or $_.FullName -match '[\\/](node_modules|\.git|dist|coverage)[\\/]' })
if ($forbidden.Count) { throw "FORBIDDEN_RELEASE_FILES:$($forbidden.Count)" }
if (-not (Test-Path -LiteralPath (Join-Path $release 'backend/.env.example'))) { throw 'BACKEND_ENV_EXAMPLE_MISSING' }
if (-not (Test-Path -LiteralPath (Join-Path $release 'frontend/.env.example'))) { throw 'FRONTEND_ENV_EXAMPLE_MISSING' }
$textFiles = @($files | Where-Object { $_.Extension -in @('.js', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.svg', '.ps1') -or $_.Name -eq '.env.example' })
foreach ($file in $textFiles) {
  if (Select-String -LiteralPath $file.FullName -Pattern 'Admin@12345' -SimpleMatch -Quiet) { throw "KNOWN_PASSWORD_IN_RELEASE:$($file.Name)" }
}

Compress-Archive -LiteralPath $release -DestinationPath $zip -CompressionLevel Optimal
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $entries = @($archive.Entries | Where-Object { $_.Name })
  if ($entries.Count -ne $files.Count) { throw "ZIP_ENTRY_COUNT_MISMATCH:$($entries.Count):$($files.Count)" }
  if (@($entries | Where-Object { $_.FullName.Replace('\', '/') -match '(^|/)(\.env|node_modules|\.git|dist|coverage)(/|$)' }).Count) { throw 'FORBIDDEN_ZIP_ENTRY' }
  if (-not @($entries | Where-Object { $_.FullName.Replace('\', '/') -eq 'SKINORA_FINAL/backend/.env.example' }).Count) { throw 'ENV_EXAMPLE_NOT_IN_ZIP' }
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
    if (-not (Test-Path -LiteralPath $copy)) { throw "EXTRACTED_FILE_MISSING:$relative" }
    if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash) { throw "EXTRACTED_HASH_MISMATCH:$relative" }
  }
} finally {
  $resolved = (Resolve-Path -LiteralPath $verify).Path
  if (-not $resolved.StartsWith((Resolve-Path -LiteralPath $PSScriptRoot).Path + [IO.Path]::DirectorySeparatorChar + '_verify_')) { throw 'UNSAFE_VERIFY_CLEANUP_PATH' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
$zipInfo = Get-Item -LiteralPath $zip
Write-Output "RELEASE_PACKAGE_PASS files=$($files.Count) bytes=$($zipInfo.Length) zip=$zip"
