# List exported functions from adminService and teacherService
$adminFile = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\services\adminService.js"
$teacherFile = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\services\teacherService.js"
$grammarFile = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\services\grammarService.js"

Write-Host "=== ADMIN SERVICE exports ==="
$results = Select-String -Path $adminFile -Pattern "export (async )?function"
foreach ($r in $results) {
    Write-Host "  L$($r.LineNumber): $($r.Line.Trim())"
}

Write-Host ""
Write-Host "=== TEACHER SERVICE exports ==="
$results2 = Select-String -Path $teacherFile -Pattern "export (async )?function"
foreach ($r in $results2) {
    Write-Host "  L$($r.LineNumber): $($r.Line.Trim())"
}

Write-Host ""
Write-Host "=== GRAMMAR SERVICE exports ==="
$results3 = Select-String -Path $grammarFile -Pattern "export (async )?function"
foreach ($r in $results3) {
    Write-Host "  L$($r.LineNumber): $($r.Line.Trim())"
}
