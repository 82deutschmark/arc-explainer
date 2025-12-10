$modelsA = @("openai/gpt-5-nano", "gpt-5.1-codex-mini")
$modelsB = @("mistralai/ministral-14b-2512", "mistralai/ministral-8b-2512", "mistralai/ministral-3b-2512")

$jobs = @()

foreach ($modelA in $modelsA) {
    foreach ($modelB in $modelsB) {
        Write-Host "Queuing: $modelA vs $modelB (5 matches)"
        $body = @{
            modelA = $modelA
            modelB = $modelB
            count = 5
        } | ConvertTo-Json

        $job = Start-Job -ScriptBlock {
            param($uri, $body)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
        } -ArgumentList "http://localhost:5000/api/snakebench/run-batch", $body

        $jobs += $job

        Start-Sleep -Seconds 2
    }
}

Write-Host "All batches queued asynchronously!" -ForegroundColor Green
