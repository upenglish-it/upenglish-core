param(
  [Parameter(Mandatory = $true)]
  [string]$WebSocketUrl,

  [Parameter(Mandatory = $true)]
  [string]$ElementId,

  [Parameter(Mandatory = $true)]
  [string]$FilePath
)

$ErrorActionPreference = 'Stop'

function Invoke-Cdp {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [string]$Method,
    [hashtable]$Params = @{}
  )

  $payload = @{
    id     = 1
    method = $Method
    params = $Params
  } | ConvertTo-Json -Compress -Depth 50

  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [ArraySegment[byte]]::new($bytes)
  $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  $buffer = New-Object byte[] 262144
  $readSegment = [ArraySegment[byte]]::new($buffer)
  $builder = New-Object System.Text.StringBuilder

  do {
    $result = $Socket.ReceiveAsync($readSegment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($result.Count -gt 0) {
      [void]$builder.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
    }
  } while (-not $result.EndOfMessage)

  return ($builder.ToString() | ConvertFrom-Json)
}

$ws = [System.Net.WebSockets.ClientWebSocket]::new()
try {
  $ws.ConnectAsync([Uri]$WebSocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  $doc = Invoke-Cdp -Socket $ws -Method 'DOM.getDocument' -Params @{ depth = 1 }
  $rootNodeId = $doc.result.root.nodeId
  $query = Invoke-Cdp -Socket $ws -Method 'DOM.querySelector' -Params @{
    nodeId   = $rootNodeId
    selector = "#$ElementId"
  }

  $nodeId = $query.result.nodeId
  if (-not $nodeId) {
    throw "Element #$ElementId not found"
  }

  Invoke-Cdp -Socket $ws -Method 'DOM.setFileInputFiles' -Params @{
    nodeId = $nodeId
    files    = @($FilePath)
  } | Out-Null

  $event = Invoke-Cdp -Socket $ws -Method 'Runtime.evaluate' -Params @{
    expression    = @"
(() => {
  const el = document.getElementById('$ElementId');
  if (!el) return { found: false };
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { found: true, files: Array.from(el.files || []).map((file) => file.name) };
})()
"@
    returnByValue = $true
  }

  $event.result.result.value | ConvertTo-Json -Compress -Depth 20
}
finally {
  $ws.Dispose()
}
