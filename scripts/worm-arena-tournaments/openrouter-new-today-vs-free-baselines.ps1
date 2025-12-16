# Author: Cascade
# Date: 2025-12-16
# PURPOSE: Automatically queue Worm Arena/SnakeBench batch matches for OpenRouter models added today.
#          New models (from server/config/openrouter-catalog.json) play a small number of matches
#          against baseline models consisting of:
#          - All OTHER runnable OpenRouter ":free" models
#          - Plus openai/gpt-5-nano (as a paid-but-cheap anchor)
#
#          The script targets the existing /api/snakebench/run-batch endpoint (no auth).
#          It only selects models that are known-runnable by ARC Explainer's server config
#          (server/config/openrouterModels.ts -> OPENROUTER_MODEL_KEYS).
# SRP/DRY check: Pass - single-purpose match orchestration; derives inputs from existing SoT files.
#
# Notes:
# - This script queues work on the backend; it does not wait for matches to finish.
# - If no new models were added today (by catalog "created" timestamp), nothing is queued.
# - "Today" is based on your local machine date unless you pass -Date.

[CmdletBinding()]
param(
  # Base URL for the server. Defaults to local dev server.
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://localhost:5000",

  # Date to treat as "today" (local). Format: YYYY-MM-DD.
  [Parameter(Mandatory = $false)]
  [string]$Date = "",

  # Matches per direction (A vs B and B vs A). Total per pairing = 2 * MatchesPerDirection.
  [Parameter(Mandatory = $false)]
  [int]$MatchesPerDirection = 2,

  # Delay between request submissions, to avoid stampeding the server.
  [Parameter(Mandatory = $false)]
  [int]$DelayMilliseconds = 500,

  # Queue requests asynchronously using Start-Job.
  [Parameter(Mandatory = $false)]
  [switch]$Async,

  # Optional SnakeBench parameters (passed through to /run-batch).
  [Parameter(Mandatory = $false)]
  [int]$Width = 10,

  [Parameter(Mandatory = $false)]
  [int]$Height = 10,

  [Parameter(Mandatory = $false)]
  [int]$MaxRounds = 150,

  [Parameter(Mandatory = $false)]
  [int]$NumApples = 5,

  # Optional BYO API key/provider (never stored by this script; just forwarded).
  [Parameter(Mandatory = $false)]
  [string]$ApiKey = "",

  [Parameter(Mandatory = $false)]
  [ValidateSet('openrouter','openai','anthropic','xai','gemini')]
  [string]$Provider = "openrouter"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  # Script location: scripts/worm-arena-tournaments/*.ps1
  # Repo root is two levels up from scripts/.
  $here = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $here "..\.." )).Path
}

function Parse-OpenRouterModelKeys {
  param(
    [Parameter(Mandatory=$true)][string]$OpenRouterModelsTsPath
  )

  # PURPOSE: Read server/config/openrouterModels.ts and extract OPENROUTER_MODEL_KEYS entries.
  # NOTE: This is intentionally a lightweight parser. If the TS file changes format substantially,
  #       this may need adjusting.

  $raw = Get-Content -Raw -Path $OpenRouterModelsTsPath

  # Grab the array literal assigned to OPENROUTER_MODEL_KEYS.
  $m = [regex]::Match($raw, "OPENROUTER_MODEL_KEYS\s*:\s*string\[\]\s*=\s*\[(?<body>[\s\S]*?)\];")
  if (-not $m.Success) {
    throw "Failed to parse OPENROUTER_MODEL_KEYS from $OpenRouterModelsTsPath"
  }

  $body = $m.Groups['body'].Value

  # Extract quoted strings 'foo/bar' or "foo/bar".
  $keys = @()
  foreach ($match in [regex]::Matches($body, "['\"](?<id>[^'\"]+)['\"]")) {
    $id = $match.Groups['id'].Value.Trim()
    if ($id) { $keys += $id }
  }

  # Deduplicate while preserving order.
  $seen = @{}
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($k in $keys) {
    if (-not $seen.ContainsKey($k)) {
      $seen[$k] = $true
      $out.Add($k) | Out-Null
    }
  }

  return $out
}

function Load-OpenRouterCatalog {
  param(
    [Parameter(Mandatory=$true)][string]$CatalogPath
  )

  $json = Get-Content -Raw -Path $CatalogPath | ConvertFrom-Json
  if ($null -eq $json -or $null -eq $json.models) {
    throw "Invalid catalog JSON shape in $CatalogPath (expected top-level 'models' array)."
  }

  return $json.models
}

function Normalize-LocalDate {
  param(
    [Parameter(Mandatory=$false)][string]$DateString
  )

  # PURPOSE: Convert an optional YYYY-MM-DD string into a [DateTime] at local midnight.
  if ([string]::IsNullOrWhiteSpace($DateString)) {
    $now = Get-Date
    return Get-Date -Year $now.Year -Month $now.Month -Day $now.Day -Hour 0 -Minute 0 -Second 0 -Millisecond 0
  }

  try {
    $dt = [DateTime]::ParseExact($DateString, 'yyyy-MM-dd', $null)
    # Ensure local midnight
    return Get-Date -Year $dt.Year -Month $dt.Month -Day $dt.Day -Hour 0 -Minute 0 -Second 0 -Millisecond 0
  } catch {
    throw "-Date must be in YYYY-MM-DD format. Got: '$DateString'"
  }
}

function Get-NewModelsForDay {
  param(
    [Parameter(Mandatory=$true)]$CatalogModels,
    [Parameter(Mandatory=$true)][System.Collections.Generic.List[string]]$RunnableKeys,
    [Parameter(Mandatory=$true)][DateTime]$DayStartLocal
  )

  # PURPOSE: Pick runnable models whose catalog 'created' timestamp falls within the given local day.
  $dayEndLocalExclusive = $DayStartLocal.AddDays(1)

  # Map catalog by id for fast lookup.
  $byId = @{}
  foreach ($m in $CatalogModels) {
    if ($null -ne $m.id -and -not $byId.ContainsKey($m.id)) {
      $byId[$m.id] = $m
    }
  }

  $newModels = New-Object System.Collections.Generic.List[string]

  foreach ($slug in $RunnableKeys) {
    # openrouterModels.ts contains a small alias case (openrouter/gpt-5.1-codex-mini).
    # In the catalog, it may appear as openai/gpt-5.1-codex-mini. We handle that special-case.
    $catalogId = $slug
    if ($slug -eq 'openrouter/gpt-5.1-codex-mini') {
      $catalogId = 'openai/gpt-5.1-codex-mini'
    }

    if (-not $byId.ContainsKey($catalogId)) {
      continue
    }

    $entry = $byId[$catalogId]
    if ($null -eq $entry.created) {
      continue
    }

    # 'created' is seconds since epoch.
    $createdUtc = [DateTimeOffset]::FromUnixTimeSeconds([int64]$entry.created).UtcDateTime
    $createdLocal = $createdUtc.ToLocalTime()

    if ($createdLocal -ge $DayStartLocal -and $createdLocal -lt $dayEndLocalExclusive) {
      $newModels.Add($slug) | Out-Null
    }
  }

  return $newModels
}

function Get-BaselineModels {
  param(
    [Parameter(Mandatory=$true)][System.Collections.Generic.List[string]]$RunnableKeys,
    [Parameter(Mandatory=$true)][System.Collections.Generic.List[string]]$NewModels
  )

  # PURPOSE: Baselines are "all other :free models" plus openai/gpt-5-nano.
  $newSet = @{}
  foreach ($m in $NewModels) { $newSet[$m] = $true }

  $baselines = New-Object System.Collections.Generic.List[string]

  foreach ($slug in $RunnableKeys) {
    if ($newSet.ContainsKey($slug)) { continue }
    if ($slug.ToLowerInvariant().EndsWith(':free')) {
      $baselines.Add($slug) | Out-Null
    }
  }

  # Always include GPT-5 nano (OpenRouter slug in our config).
  if (-not $baselines.Contains('openai/gpt-5-nano')) {
    $baselines.Add('openai/gpt-5-nano') | Out-Null
  }

  return $baselines
}

function Invoke-QueueBatch {
  param(
    [Parameter(Mandatory=$true)][string]$Endpoint,
    [Parameter(Mandatory=$true)][hashtable]$Body,
    [Parameter(Mandatory=$true)][bool]$AsJob
  )

  $json = $Body | ConvertTo-Json

  if ($AsJob) {
    Start-Job -ScriptBlock {
      param($uri, $payload)
      Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload | Out-Null
    } -ArgumentList $Endpoint, $json | Out-Null
    return
  }

  Invoke-WebRequest -Uri $Endpoint -Method Post -Headers @{"Content-Type"="application/json"} -Body $json | Out-Null
}

# --- Main ---

$repoRoot = Get-RepoRoot
$catalogPath = Join-Path $repoRoot "server\config\openrouter-catalog.json"
$openrouterModelsTsPath = Join-Path $repoRoot "server\config\openrouterModels.ts"

if (-not (Test-Path $catalogPath)) {
  throw "Catalog not found at: $catalogPath"
}
if (-not (Test-Path $openrouterModelsTsPath)) {
  throw "OpenRouter model config not found at: $openrouterModelsTsPath"
}

if ($MatchesPerDirection -lt 1) {
  throw "-MatchesPerDirection must be >= 1"
}
if ($DelayMilliseconds -lt 0) {
  throw "-DelayMilliseconds must be >= 0"
}

$dayStart = Normalize-LocalDate -DateString $Date
$dayLabel = $dayStart.ToString('yyyy-MM-dd')

$catalogModels = Load-OpenRouterCatalog -CatalogPath $catalogPath
$runnableKeys = Parse-OpenRouterModelKeys -OpenRouterModelsTsPath $openrouterModelsTsPath
$newModels = Get-NewModelsForDay -CatalogModels $catalogModels -RunnableKeys $runnableKeys -DayStartLocal $dayStart
$baselines = Get-BaselineModels -RunnableKeys $runnableKeys -NewModels $newModels

$endpoint = ($BaseUrl.TrimEnd('/') + "/api/snakebench/run-batch")

Write-Host "OpenRouter New-Models-Of-The-Day vs Free Baselines" -ForegroundColor Green
Write-Host "Date: $dayLabel" -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint" -ForegroundColor Cyan
Write-Host "Matches per direction: $MatchesPerDirection" -ForegroundColor Cyan
Write-Host "Async: $($Async.IsPresent)" -ForegroundColor Cyan
Write-Host "Board: ${Width}x${Height}, maxRounds=$MaxRounds, numApples=$NumApples" -ForegroundColor Cyan

if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
  Write-Host "BYO key: provided (provider=$Provider)" -ForegroundColor Yellow
} else {
  Write-Host "BYO key: not provided (server keys)" -ForegroundColor DarkYellow
}

Write-Host "" 

if ($newModels.Count -eq 0) {
  Write-Host "No runnable OpenRouter models found for $dayLabel (by catalog created timestamp). Nothing to queue." -ForegroundColor Yellow
  return
}

Write-Host "New models ($($newModels.Count)):" -ForegroundColor Cyan
foreach ($m in $newModels) { Write-Host "  - $m" -ForegroundColor DarkCyan }

Write-Host "" 
Write-Host "Baselines ($($baselines.Count)):" -ForegroundColor Cyan
foreach ($b in $baselines) { Write-Host "  - $b" -ForegroundColor DarkGreen }

Write-Host "" 

# Compute total requests.
$totalPairings = $newModels.Count * $baselines.Count
$totalQueuedMatches = $totalPairings * $MatchesPerDirection * 2

Write-Host "Total pairings: $totalPairings" -ForegroundColor Cyan
Write-Host "Total matches queued (directions included): $totalQueuedMatches" -ForegroundColor Cyan
Write-Host "" 

$queued = 0

foreach ($newModel in $newModels) {
  foreach ($baseline in $baselines) {
    for ($i = 0; $i -lt $MatchesPerDirection; $i++) {
      # New vs Baseline
      $body1 = @{
        modelA = $newModel
        modelB = $baseline
        count = 1
        width = $Width
        height = $Height
        maxRounds = $MaxRounds
        numApples = $NumApples
      }

      if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
        $body1.apiKey = $ApiKey
        $body1.provider = $Provider
      }

      Invoke-QueueBatch -Endpoint $endpoint -Body $body1 -AsJob $Async.IsPresent
      $queued += 1
      Start-Sleep -Milliseconds $DelayMilliseconds

      # Baseline vs New (reverse)
      $body2 = @{
        modelA = $baseline
        modelB = $newModel
        count = 1
        width = $Width
        height = $Height
        maxRounds = $MaxRounds
        numApples = $NumApples
      }

      if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
        $body2.apiKey = $ApiKey
        $body2.provider = $Provider
      }

      Invoke-QueueBatch -Endpoint $endpoint -Body $body2 -AsJob $Async.IsPresent
      $queued += 1
      Start-Sleep -Milliseconds $DelayMilliseconds

      Write-Host "Queued [$queued/$totalQueuedMatches]: $newModel <-> $baseline" -ForegroundColor Yellow
    }
  }
}

Write-Host "" 
Write-Host "Done. Queued $queued matches." -ForegroundColor Green
Write-Host "Monitor via Worm Arena UI or completed games folder." -ForegroundColor Cyan
