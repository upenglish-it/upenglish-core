# Fix double-encoded UTF-8 files in superstudy-fe/src
# These files were accidentally saved as Latin-1, causing Vietnamese chars to appear garbled
# Fix: read as Latin-1 (which preserves the raw bytes), write back as proper UTF-8 without BOM

$srcRoot = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src"
$latin1 = [System.Text.Encoding]::GetEncoding("iso-8859-1")
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# List of files known to have double-encoding issues (detected by corrupted Vietnamese text)
$targetFiles = @(
    "pages\DashboardPage.jsx"
)

foreach ($relPath in $targetFiles) {
    $filePath = Join-Path $srcRoot $relPath
    if (Test-Path $filePath) {
        Write-Host "Processing: $filePath"
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $content = $latin1.GetString($bytes)
        [System.IO.File]::WriteAllText($filePath, $content, $utf8NoBom)
        Write-Host "  -> Done"
    } else {
        Write-Host "  -> NOT FOUND: $filePath"
    }
}

Write-Host ""
Write-Host "All done. Check the browser to see if Vietnamese text renders correctly."
