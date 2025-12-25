# Worm Arena Tournament Script - Seed/Grok/Devstral vs baselines
# Author: Cascade GPT 5.1 high reasoning
# Date: 2025-12-24
# PURPOSE: Run parallel Worm Arena matches for new OpenRouter models plus baselines.
#          - Pairwise round-robin among new models (both directions).
#          - Each new model also plays baseline opponents (both directions).
#          - Logs queued matches for visibility.
# SRP/DRY check: Pass (single-purpose queue script)

param(
  [string]$ApiEndpoint = "https://localhost:5000/api/snakebench/run-batch",
  [int]$MatchesPerDirection = 1,
  [int]$DelayMs = 300,
  [switch]$Async = $true
)

$newModels = @(
  "bytedance-seed/seed-1.6-flash",
  "bytedance-seed/seed-1.6",
  "minimax/minimax-m2.1",
  "z-ai/glm-4.7",
  "oops"  # placeholder slug per request; must exist in server/config/models.ts
)

$baselines = @(
  "openai/gpt-5.1-codex-mini",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "x-ai/grok-4.1-fast",
  "mistralai/devstral-2512",
  "deepseek/deepseek-v3.2"
)

$jobs = New-Object System.Collections.Generic.List[System.Management.Automation.Job]

function Queue-Match {
  param(
    [string]$A,
    [string]$B
  )
  $body = @{
    modelA = $A
    modelB = $B
    count = $MatchesPerDirection
  } | ConvertTo-Json

  Write-Host "Queue: $A vs $B (x$MatchesPerDirection)" -ForegroundColor Cyan
  if ($Async) {
    $jobs.Add(
      Start-Job -ScriptBlock {
        param($uri, $payload)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload | Out-Null
      } -ArgumentList $ApiEndpoint, $body
    ) | Out-Null
  } else {
    Invoke-WebRequest -Uri $ApiEndpoint -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
  }
}

# Round-robin among new models (both directions)
for ($i = 0; $i -lt $newModels.Count; $i++) {
  for ($j = $i + 1; $j -lt $newModels.Count; $j++) {
    Queue-Match -A $newModels[$i] -B $newModels[$j]
    Queue-Match -A $newModels[$j] -B $newModels[$i]
    Start-Sleep -Milliseconds $DelayMs
  }
}

# New models vs baselines (both directions)
foreach ($n in $newModels) {
  foreach ($b in $baselines) {
    Queue-Match -A $n -B $b
    Queue-Match -A $b -B $n
    Start-Sleep -Milliseconds $DelayMs
  }
}

Write-Host ""
Write-Host "Submitted $($jobs.Count) async jobs (if Async on)." -ForegroundColor Green
Write-Host "Matches running in parallel on backend."

if ($Async -and $jobs.Count -gt 0) {
  Write-Host ""
  Write-Host "Waiting for job completions to summarize results..." -ForegroundColor Yellow
  Receive-Job -Job $jobs -Wait | Out-Null

  $failed = $jobs | Where-Object { $_.State -ne 'Completed' }
  if ($failed.Count -gt 0) {
    Write-Host "Some jobs did not complete:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host " - $($_.Id): $($_.State)" -ForegroundColor Red }
  } else {
    Write-Host "All jobs completed. Fetch match results via /api/snakebench/games or UI." -ForegroundColor Green
  }

  $jobs | Remove-Job | Out-Null
}
