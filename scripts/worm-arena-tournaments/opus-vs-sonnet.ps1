$modelA = "anthropic/claude-opus-4.5"
$modelB = "claude-sonnet-4-5-20250929"

Write-Host "Claude Opus 4.5 vs Sonnet 4.5 (3 matches)"

for ($i = 0; $i -lt 3; $i++) {
    $body = @{
        modelA = $modelA
        modelB = $modelB
        count = 1
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList "http://localhost:5000/api/snakebench/run-batch", $body | Out-Null

    Start-Sleep -Milliseconds 500
}

Write-Host "Done! 3 Sonnet matches queued!"
