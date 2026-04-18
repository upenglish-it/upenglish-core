# Scan all service files for relevant functions
$servicesDir = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\services"
$srcDir = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src"
$patterns = @("getCustomListById", "getAdminTopic\b", "getTeacherTopic\b", "getGrammarExercise\b", "readUserStorageDoc", "writeUserStorageDoc", "usersService")
foreach ($pattern in $patterns) {
    $matches = Get-ChildItem -Path $srcDir -Recurse -Filter "*.js","*.jsx" | Select-String -Pattern $pattern
    if ($matches.Count -gt 0) {
        Write-Host "=== '$pattern' found in: ==="
        foreach ($m in $matches | Select-Object -First 3) {
            Write-Host "  $($m.Filename) L$($m.LineNumber): $($m.Line.Trim().Substring(0, [Math]::Min($m.Line.Trim().Length, 80)))"
        }
    } else {
        Write-Host "=== '$pattern' NOT FOUND ==="
    }
}
