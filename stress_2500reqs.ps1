# StayEaze Stress Test - 2,500 Req/s & 500 Concurrent Users

param(
    [int]$Concurrency = 500,
    [int]$TotalRequestsPerEndpoint = 2500,
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$Email = "testowner1@gmail.com",
    [string]$Password = "Friend@2010"
)

Add-Type -AssemblyName System.Net.Http

# Configure connection limit for high concurrency
[System.Net.ServicePointManager]::DefaultConnectionLimit = 5000
[System.Net.ServicePointManager]::Expect100Continue = $false

Write-Host "`n⚡ Authenticating for 500 Concurrent User (Target 2,500 Req/s) Stress Test..." -ForegroundColor Cyan
$loginBody = "{`"email`":`"$Email`",`"password`":`"$Password`"}"
$wc = New-Object System.Net.WebClient
$wc.Headers["Content-Type"] = "application/json"
try {
    $rawResp = $wc.UploadString("$BaseUrl/auth/login", $loginBody)
    $token   = ($rawResp | ConvertFrom-Json).accessToken
    Write-Host "✅ Authentication Successful — Access Token acquired`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Auth failed: $_" -ForegroundColor Red
    exit 1
}

$endpoints = @(
    "GET|/tenants?page=1&pageSize=10",
    "GET|/tenants/minimal",
    "GET|/properties/minimal",
    "GET|/rooms?page=1&pageSize=10",
    "GET|/beds?page=1&pageSize=10",
    "GET|/check-ins?page=1&pageSize=10",
    "GET|/payments?page=1&pageSize=10",
    "GET|/complaints?page=1&pageSize=10",
    "GET|/maintenance?page=1&pageSize=10",
    "GET|/audit-logs?page=1&pageSize=10"
)

Write-Host "══════════════════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  StayEaze Stress Test — 500 CONCURRENT USERS / TARGET 2,500 REQ/SEC" -ForegroundColor White
Write-Host "  Concurrency: $Concurrency Threads | Total Reqs/EP: $TotalRequestsPerEndpoint | Endpoints: $($endpoints.Count)" -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor DarkGray

Write-Host ("  {0,-32} {1,6} {2,6} {3,6} {4,7}% {5,8} {6,8} {7,8} {8,8} {9,8}" -f `
    "Endpoint","Total","OK","Err","Err%","Min ms","Avg ms","P95 ms","P99 ms","RPS") -ForegroundColor White
Write-Host ("  " + ("-" * 96)) -ForegroundColor DarkGray

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.MaxConnectionsPerServer = 5000
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [System.TimeSpan]::FromSeconds(30)
$client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
$client.DefaultRequestHeaders.Add("X-Stress-Test", "true")

$scaleResults = @()
$globalSW = [System.Diagnostics.Stopwatch]::StartNew()

foreach ($ep in $endpoints) {
    $parts  = $ep.Split("|")
    $method = $parts[0]
    $path   = $parts[1]
    $label  = "$method $path".Split("?")[0]
    $url    = $BaseUrl + $path

    $timings  = [System.Collections.Generic.List[double]]::new()
    $okCount  = 0
    $errCount = 0

    $swBatch = [System.Diagnostics.Stopwatch]::StartNew()

    # Launch $Concurrency concurrent requests per burst until $TotalRequestsPerEndpoint reached
    $batches = [Math]::Ceiling($TotalRequestsPerEndpoint / $Concurrency)
    
    for ($b = 0; $b -lt $batches; $b++) {
        $tasks = for ($i = 0; $i -lt $Concurrency; $i++) {
            $reqSW = [System.Diagnostics.Stopwatch]::StartNew()
            $t = $client.GetAsync($url)
            [PSCustomObject]@{ Task = $t; SW = $reqSW }
        }

        foreach ($t in $tasks) {
            try {
                $resp = $t.Task.GetAwaiter().GetResult()
                $t.SW.Stop()
                $timings.Add($t.SW.Elapsed.TotalMilliseconds)
                if ([int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 400) {
                    $okCount++
                } else {
                    $errCount++
                }
                $resp.Dispose()
            } catch {
                $t.SW.Stop()
                $timings.Add($t.SW.Elapsed.TotalMilliseconds)
                $errCount++
            }
        }
    }

    $swBatch.Stop()

    $sorted   = ($timings.ToArray() | Sort-Object)
    $total    = $sorted.Count
    $avg      = [Math]::Round(($sorted | Measure-Object -Average).Average, 1)
    $minMs    = [Math]::Round($sorted[0], 1)
    $p95      = [Math]::Round($sorted[[Math]::Min($total-1, [Math]::Floor($total*0.95))], 1)
    $p99      = [Math]::Round($sorted[[Math]::Min($total-1, [Math]::Floor($total*0.99))], 1)
    $rps      = if ($swBatch.Elapsed.TotalSeconds -gt 0) { [Math]::Round($total / $swBatch.Elapsed.TotalSeconds, 1) } else { 0 }
    $errPct   = [Math]::Round(($errCount / [Math]::Max(1,$total)) * 100, 1)

    $color = if ($errPct -eq 0) { "Green" } elseif ($errPct -lt 5) { "Yellow" } else { "Red" }

    Write-Host ("  {0,-32} {1,6} {2,6} {3,6} {4,6}% {5,8} {6,8} {7,8} {8,8} {9,8}" -f `
        $label.PadRight(32).Substring(0,32), $total, $okCount, $errCount, $errPct, $minMs, $avg, $p95, $p99, $rps) `
        -ForegroundColor $color

    $scaleResults += [PSCustomObject]@{
        Endpoint = $label; Total=$total; OK=$okCount; Errors=$errCount
        ErrPct=$errPct; MinMs=$minMs; AvgMs=$avg; P95Ms=$p95; P99Ms=$p99; RPS=$rps; DurationSec=[Math]::Round($swBatch.Elapsed.TotalSeconds, 2)
    }
}

$client.Dispose()
$globalSW.Stop()

$totReqs = ($scaleResults | Measure-Object -Property Total -Sum).Sum
$totErrs = ($scaleResults | Measure-Object -Property Errors -Sum).Sum
$overallErrPct = [Math]::Round(($totErrs / $totReqs) * 100, 2)
$overallAvg = [Math]::Round(($scaleResults | Measure-Object -Property AvgMs -Average).Average, 1)
$overallRps = [Math]::Round($totReqs / $globalSW.Elapsed.TotalSeconds, 1)

Write-Host "`n  ══════════════════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  500 CONCURRENT USERS (TARGET 2,500 REQ/SEC) STRESS TEST SUMMARY" -ForegroundColor White
Write-Host "  ══════════════════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  Total Requests Fired : $totReqs ($TotalRequestsPerEndpoint per endpoint)" -ForegroundColor White
Write-Host "  Wall Clock Time      : $([Math]::Round($globalSW.Elapsed.TotalSeconds, 2)) seconds" -ForegroundColor White
Write-Host "  Total Errors         : $totErrs ($overallErrPct%)" -ForegroundColor $(if ($overallErrPct -lt 1) {"Green"} elseif ($overallErrPct -lt 5) {"Yellow"} else {"Red"})
Write-Host "  Average Response     : $overallAvg ms" -ForegroundColor White
Write-Host "  Peak Throughput      : $overallRps req/sec" -ForegroundColor White
Write-Host "  ══════════════════════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor DarkGray
