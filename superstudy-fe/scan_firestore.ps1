# Scan DashboardPage.jsx for all Firestore usage patterns
$filePath = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\pages\DashboardPage.jsx"
$patterns = @("getDoc", "setDoc", "getDocs", "collection(", "doc(db", "firebase", "Firestore", "Firestore")
foreach ($pattern in $patterns) {
    $matches = Select-String -Path $filePath -Pattern $pattern -CaseSensitive:$false
    Write-Host "=== '$pattern' found: $($matches.Count) times ==="
    foreach ($m in $matches | Select-Object -First 5) {
        Write-Host "  L$($m.LineNumber): $($m.Line.Trim().Substring(0, [Math]::Min($m.Line.Trim().Length, 100)))"
    }
}
