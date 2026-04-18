# Scan DashboardPage.jsx for Firebase references
$filePath = "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src\pages\DashboardPage.jsx"
$matches = Select-String -Path $filePath -Pattern "firebase" -CaseSensitive:$false
Write-Host "Firebase references found: $($matches.Count)"
foreach ($m in $matches | Select-Object -First 20) {
    Write-Host "$($m.LineNumber): $($m.Line.Trim())"
}
