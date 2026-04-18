param(
  [Parameter(Mandatory = $true)]
  [string]$WebSocketUrl,

  [Parameter(Mandatory = $true)]
  [string]$Method,

  [Parameter()]
  [string]$ParamsJson = '{}'
)

$ErrorActionPreference = 'Stop'

$ws = [System.Net.WebSockets.ClientWebSocket]::new()
try {
  $ws.ConnectAsync([Uri]$WebSocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  $params = if ([string]::IsNullOrWhiteSpace($ParamsJson)) { @{} } else { $ParamsJson | ConvertFrom-Json }
  $payload = @{
    id     = 1
    method = $Method
    params = $params
  } | ConvertTo-Json -Compress -Depth 50

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

  $builder.ToString()
}
finally {
  $ws.Dispose()
}
