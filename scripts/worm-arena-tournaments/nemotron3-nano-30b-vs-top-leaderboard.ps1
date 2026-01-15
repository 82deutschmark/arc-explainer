# Worm Arena Tournament Script - Nemotron 3 Nano 30B A3B (free) vs selected top models + all DeepSeek models
# Author: Codex (GPT-5)
# Date: 2025-12-15
# PURPOSE: Queue matches against a targeted opponent set:
#          - GPT-5 Nano (OpenRouter)
#          - GPT-5 Mini (OpenRouter)
#          
#          - DeepSeek v3.2
#          
#          - Grok 4.1 Fast
#          - Grok Code Fast 1
#          This script uses the existing SnakeBench batch endpoint and does not wait for games to complete.

$apiBase = "http://localhost:5000"
$runBatchEndpoint = "$apiBase/api/snakebench/run-batch"
$modelsEndpoint = "$apiBase/api/models"

$challenger = "nvidia/nemotron-3-nano-30b-a3b:free"
$gamesPerPair = 2
$bothDirections = $true
$includePreviousTopSet = $true
$requestDelayMs = 200
$jobsToWaitSeconds = 30

Write-Host "Fetching models from: $modelsEndpoint" -ForegroundColor Cyan
$allModels = Invoke-RestMethod -Uri $modelsEndpoint -Method Get
if (-not $allModels) {
  throw "Failed to fetch models from $modelsEndpoint"
}

function Get-ModelNameBySlug {
  param([string]$slug)
  $m = $allModels | Where-Object { $_.key -eq $slug } | Select-Object -First 1
  if ($m -and $m.name) { return [string]$m.name }
  return $slug
}

$explicitOpponents = @(
  "openai/gpt-5-nano",
  "openai/gpt-5-mini",
  "anthropic/claude-haiku-4.5",
  "deepseek/deepseek-v3.2",
  "deepseek/deepseek-chat-v3.1",
  "x-ai/grok-4.1-fast",
  "x-ai/grok-code-fast-1"
)

$previousTopSet = @(
  "google/gemini-2.5-flash-preview-09-2025",
  "google/gemini-3-pro-preview",
  "deepseek/deepseek-v3.1-terminus",
  "openai/gpt-oss-120b",
  "google/gemini-2.5-flash-lite-preview-09-2025"
)

$opponents = @(
  $explicitOpponents +
  $(if ($includePreviousTopSet) { $previousTopSet } else { @() })
) | Where-Object { $_ -and $_ -ne $challenger } | Sort-Object -Unique

if ($opponents.Count -eq 0) {
  throw "No opponents configured."
}

Write-Host ""
Write-Host "Opponents to challenge (slug -> name):" -ForegroundColor Cyan
$opponents | ForEach-Object {
  $slug = $_
  $name = Get-ModelNameBySlug -slug $slug
  Write-Host "  $slug -> $name"
}
Write-Host ""

Write-Host "Queuing matches via: $runBatchEndpoint" -ForegroundColor Cyan
Write-Host "Challenger: $challenger" -ForegroundColor Cyan
Write-Host "Opponents: $($opponents -join ', ')" -ForegroundColor Cyan
Write-Host "Games per pairing: $gamesPerPair" -ForegroundColor Cyan
Write-Host "Both directions: $bothDirections" -ForegroundColor Cyan

$batchesAttempted = 0
$jobHandles = @()

foreach ($opponent in $opponents) {
  # IMPORTANT: Use the unary comma to prevent PowerShell from unrolling the inner array.
  # Otherwise $pair becomes a string and $pair[0] returns only the first character (e.g., "n" instead of the full slug).
  $pairs = ,@($challenger, $opponent)
  if ($bothDirections) {
    $pairs += ,@($opponent, $challenger)
  }

  foreach ($pair in $pairs) {
    $modelA = $pair[0]
    $modelB = $pair[1]

    $batchesAttempted++
    Write-Host "Queuing ($batchesAttempted): $modelA vs $modelB (x$gamesPerPair)" -ForegroundColor Yellow

    $payload = @{
      modelA = $modelA
      modelB = $modelB
      count  = $gamesPerPair
    }

    $job = Start-Job -ScriptBlock {
      param($uri, $payloadObject)
      try {
        $resp = Invoke-RestMethod -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body ($payloadObject | ConvertTo-Json) -ErrorAction Stop
        $hasErrors = $resp -and $resp.success -and $resp.batch -and $resp.batch.errors -and $resp.batch.errors.Count -gt 0
        if ($hasErrors) {
          return [pscustomobject]@{
            modelA = $payloadObject.modelA
            modelB = $payloadObject.modelB
            status = "REJECTED"
            message = $resp.batch.errors[0].error
          }
        }
        return [pscustomobject]@{
          modelA = $payloadObject.modelA
          modelB = $payloadObject.modelB
          status = "OK"
          message = ""
        }
      } catch {
        return [pscustomobject]@{
          modelA = $payloadObject.modelA
          modelB = $payloadObject.modelB
          status = "FAILED"
          message = $_.Exception.Message
        }
      }
    } -ArgumentList $runBatchEndpoint, $payload

    $jobHandles += $job

    Start-Sleep -Milliseconds $requestDelayMs
  }
}

Write-Host ""
Write-Host "Batches attempted: $batchesAttempted" -ForegroundColor Cyan
Write-Host "Submitted asynchronously (jobs): $($jobHandles.Count)" -ForegroundColor Green

Write-Host ""
Write-Host "Waiting briefly for job responses (up to $jobsToWaitSeconds seconds)..." -ForegroundColor Yellow
Wait-Job -Job $jobHandles -Timeout $jobsToWaitSeconds | Out-Null

$completed = @($jobHandles | Where-Object { $_.State -eq "Completed" })
if ($completed.Count -gt 0) {
  Write-Host ""
  Write-Host "Job results received ($($completed.Count)):" -ForegroundColor Cyan
  $results = @($completed | Receive-Job)
  $results | Format-Table modelA,modelB,status,message -AutoSize
}

$remaining = @($jobHandles | Where-Object { $_.State -ne "Completed" })
if ($remaining.Count -gt 0) {
  Write-Host ""
  Write-Host "Jobs still running: $($remaining.Count) (matches will continue on backend)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Tip: use /worm-arena/stats or /worm-arena/matches to monitor progress." -ForegroundColor Green
