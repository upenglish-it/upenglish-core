param(
  [Parameter(Mandatory = $true)]
  [string]$WebSocketUrl,

  [Parameter(Mandatory = $true)]
  [string]$Expression
)

$ErrorActionPreference = 'Stop'

$ws = [System.Net.WebSockets.ClientWebSocket]::new()
try {
  $ws.ConnectAsync([Uri]$WebSocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  $payload = @{
    id     = 1
    method = 'Runtime.evaluate'
    params = @{
      expression    = $Expression
      returnByValue = $true
      awaitPromise  = $true
    }
  } | ConvertTo-Json -Compress -Depth 20

  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [ArraySegment[byte]]::new($bytes)
  $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  $buffer = New-Object byte[] 262144
  $readSegment = [ArraySegment[byte]]::new($buffer)
  $builder = New-Object System.Text.StringBuilder

  do {
    $result = $ws.ReceiveAsync($readSegment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($result.Count -gt 0) {
      [void]$builder.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
    }
  } while (-not $result.EndOfMessage)

  $raw = $builder.ToString() | ConvertFrom-Json
  if ($raw.PSObject.Properties.Name -contains 'error') {
    throw ($raw.error | ConvertTo-Json -Compress)
  }

  if ($raw.result.result.subtype -eq 'null') {
    return 'null'
  }

  if ($raw.result.result.PSObject.Properties.Name -contains 'value') {
    return ($raw.result.result.value | ConvertTo-Json -Compress -Depth 20)
  }

  return ($raw.result.result | ConvertTo-Json -Compress -Depth 20)
}
finally {
  $ws.Dispose()
}
