# Scan all pages and services for remaining Firebase imports in migrated frontend
$pagesDir = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\pages"
$servicesDir = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\services"

Write-Host "=== FIREBASE IMPORTS IN PAGES ==="
$results = Get-ChildItem -Path $pagesDir -Recurse -Include "*.js","*.jsx" | Select-String -Pattern "import.*firebase"
foreach ($r in $results) {
    Write-Host "  $($r.Filename) L$($r.LineNumber): $($r.Line.Trim())"
}
if ($results.Count -eq 0) { Write-Host "  NONE FOUND ✅" }

Write-Host ""
Write-Host "=== FIREBASE IMPORTS IN SERVICES ==="
$results2 = Get-ChildItem -Path $servicesDir -Recurse -Include "*.js","*.jsx" | Select-String -Pattern "import.*firebase"
foreach ($r in $results2) {
    Write-Host "  $($r.Filename) L$($r.LineNumber): $($r.Line.Trim())"
}
if ($results2.Count -eq 0) { Write-Host "  NONE FOUND ✅" }
