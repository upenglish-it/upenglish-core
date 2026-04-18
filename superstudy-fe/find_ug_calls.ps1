$results = Select-String -Path "C:\Users\Jinshin\Desktop\projects\viet\upenglish-core\superstudy-fe\src" -Pattern "userGroupsService.findOne|/user-groups" -Recurse
foreach ($r in $results) {
    Write-Host "$($r.Filename):$($r.Line.Trim())"
}
