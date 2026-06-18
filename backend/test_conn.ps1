$p = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server.js" -PassThru
Start-Sleep 6
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
  Write-Host "HEALTH RESPONSE:" $r.Content
} catch {
  Write-Host "ERROR:" $_.Exception.Message
}
$p.Kill()
