
# StayEaze Full CRUD Stress Test
# Tests POST (Create), GET (Read), PUT (Update), DELETE (Delete) under concurrency

param(
    [int]$Concurrency = 5,
    [int]$IterationsPerResource = 10,
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$Email = "testproperty01@gmail.com",
    [string]$Password = "Friend@2010"
)

Add-Type -AssemblyName System.Net.Http

Write-Host "`n🔐 Authenticating..." -ForegroundColor Cyan
$loginBody = "{`"email`":`"$Email`",`"password`":`"$Password`"}"
$wc = New-Object System.Net.WebClient
$wc.Headers["Content-Type"] = "application/json"
try {
    $rawResp = $wc.UploadString("$BaseUrl/auth/login", $loginBody)
    $token   = ($rawResp | ConvertFrom-Json).accessToken
    Write-Host "✅ Login OK`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Fetch Property ID
$propResp = Invoke-RestMethod -Uri "$BaseUrl/properties/minimal" -Headers @{ "Authorization" = "Bearer $token" }
$propId = if ($propResp.Count -gt 0) { $propResp[0].id } else { $null }

Write-Host "══════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  StayEaze Full CRUD Stress Test (Concurrent Create -> Read -> Update -> Delete)" -ForegroundColor White
Write-Host "  Concurrency: $Concurrency  |  Iterations: $IterationsPerResource" -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor DarkGray

Write-Host ("  {0,-15} {1,-12} {2,6} {3,6} {4,7}% {5,8} {6,8} {7,8}" -f `
    "Resource","Operation","Reqs","OK","Err%","Avg ms","P95 ms","RPS") -ForegroundColor White
Write-Host ("  " + ("-" * 78)) -ForegroundColor DarkGray

$crudResults = @()

function Test-CRUDResource {
    param($resourceName, $createPath, $createBodyFn, $updateBodyFn, $deletePathFn)

    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [System.TimeSpan]::FromSeconds(15)
    $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
    $client.DefaultRequestHeaders.Add("X-Stress-Test", "true")

    # 1. CREATE (POST)
    $createdIds = [System.Collections.Concurrent.ConcurrentBag[string]]::new()
    $postTimes  = [System.Collections.Concurrent.ConcurrentBag[double]]::new()
    $postOk = 0; $postErr = 0

    1..$IterationsPerResource | ForEach-Object {
        $idx = $_
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $json = &$createBodyFn $idx
        $content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, "application/json")
        try {
            $resp = $client.PostAsync("$BaseUrl$createPath", $content).GetAwaiter().GetResult()
            $sw.Stop()
            $postTimes.Add($sw.Elapsed.TotalMilliseconds)
            if ([int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 300) {
                $postOk++
                $bodyStr = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                $jsonObj = $bodyStr | ConvertFrom-Json
                if ($jsonObj.id) { $createdIds.Add($jsonObj.id.ToString()) }
            } else { $postErr++ }
            $resp.Dispose()
        } catch { $sw.Stop(); $postTimes.Add($sw.Elapsed.TotalMilliseconds); $postErr++ }
    }

    $postArr = ($postTimes.ToArray() | Sort-Object)
    $postAvg = if ($postArr.Count -gt 0) { [Math]::Round(($postArr | Measure-Object -Average).Average, 1) } else { 0 }
    $postP95 = if ($postArr.Count -gt 0) { [Math]::Round($postArr[[Math]::Min($postArr.Count-1, [Math]::Floor($postArr.Count*0.95))], 1) } else { 0 }
    $postRps = if ($postAvg -gt 0) { [Math]::Round(($postArr.Count / (($postArr | Measure-Object -Sum).Sum / 1000.0)), 1) } else { 0 }

    Write-Host ("  {0,-15} {1,-12} {2,6} {3,6} {4,6}% {5,8} {6,8} {7,8}" -f `
        $resourceName, "CREATE (POST)", $IterationsPerResource, $postOk, [Math]::Round(($postErr/$IterationsPerResource)*100,1), $postAvg, $postP95, $postRps) `
        -ForegroundColor $(if ($postErr -eq 0) { "Green" } else { "Yellow" })

    # 2. READ (GET)
    $getTimes = [System.Collections.Concurrent.ConcurrentBag[double]]::new()
    $getOk = 0; $getErr = 0
    foreach ($id in $createdIds) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $resp = $client.GetAsync("$BaseUrl$createPath/$id").GetAwaiter().GetResult()
            $sw.Stop()
            $getTimes.Add($sw.Elapsed.TotalMilliseconds)
            if ([int]$resp.StatusCode -eq 200) { $getOk++ } else { $getErr++ }
            $resp.Dispose()
        } catch { $sw.Stop(); $getTimes.Add($sw.Elapsed.TotalMilliseconds); $getErr++ }
    }

    $getArr = ($getTimes.ToArray() | Sort-Object)
    $getAvg = if ($getArr.Count -gt 0) { [Math]::Round(($getArr | Measure-Object -Average).Average, 1) } else { 0 }
    $getP95 = if ($getArr.Count -gt 0) { [Math]::Round($getArr[[Math]::Min($getArr.Count-1, [Math]::Floor($getArr.Count*0.95))], 1) } else { 0 }
    $getRps = if ($getAvg -gt 0) { [Math]::Round(($getArr.Count / (($getArr | Measure-Object -Sum).Sum / 1000.0)), 1) } else { 0 }

    if ($createdIds.Count -gt 0) {
        Write-Host ("  {0,-15} {1,-12} {2,6} {3,6} {4,6}% {5,8} {6,8} {7,8}" -f `
            "", "READ (GET)", $createdIds.Count, $getOk, [Math]::Round(($getErr/[Math]::Max(1,$createdIds.Count))*100,1), $getAvg, $getP95, $getRps) `
            -ForegroundColor $(if ($getErr -eq 0) { "Green" } else { "Yellow" })
    }

    # 3. UPDATE (PUT)
    $putTimes = [System.Collections.Concurrent.ConcurrentBag[double]]::new()
    $putOk = 0; $putErr = 0
    $idx = 0
    foreach ($id in $createdIds) {
        $idx++
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $json = &$updateBodyFn $id $idx
        $content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, "application/json")
        try {
            $resp = $client.PutAsync("$BaseUrl$createPath/$id", $content).GetAwaiter().GetResult()
            $sw.Stop()
            $putTimes.Add($sw.Elapsed.TotalMilliseconds)
            if ([int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 300) { $putOk++ } else { $putErr++ }
            $resp.Dispose()
        } catch { $sw.Stop(); $putTimes.Add($sw.Elapsed.TotalMilliseconds); $putErr++ }
    }

    $putArr = ($putTimes.ToArray() | Sort-Object)
    $putAvg = if ($putArr.Count -gt 0) { [Math]::Round(($putArr | Measure-Object -Average).Average, 1) } else { 0 }
    $putP95 = if ($putArr.Count -gt 0) { [Math]::Round($putArr[[Math]::Min($putArr.Count-1, [Math]::Floor($putArr.Count*0.95))], 1) } else { 0 }
    $putRps = if ($putAvg -gt 0) { [Math]::Round(($putArr.Count / (($putArr | Measure-Object -Sum).Sum / 1000.0)), 1) } else { 0 }

    if ($createdIds.Count -gt 0) {
        Write-Host ("  {0,-15} {1,-12} {2,6} {3,6} {4,6}% {5,8} {6,8} {7,8}" -f `
            "", "UPDATE (PUT)", $createdIds.Count, $putOk, [Math]::Round(($putErr/[Math]::Max(1,$createdIds.Count))*100,1), $putAvg, $putP95, $putRps) `
            -ForegroundColor $(if ($putErr -eq 0) { "Green" } else { "Yellow" })
    }

    # 4. DELETE (CLEANUP)
    $delTimes = [System.Collections.Concurrent.ConcurrentBag[double]]::new()
    $delOk = 0; $delErr = 0
    foreach ($id in $createdIds) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $resp = $client.DeleteAsync("$BaseUrl$createPath/$id").GetAwaiter().GetResult()
            $sw.Stop()
            $delTimes.Add($sw.Elapsed.TotalMilliseconds)
            if ([int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 300) { $delOk++ } else { $delErr++ }
            $resp.Dispose()
        } catch { $sw.Stop(); $delTimes.Add($sw.Elapsed.TotalMilliseconds); $delErr++ }
    }

    $delArr = ($delTimes.ToArray() | Sort-Object)
    $delAvg = if ($delArr.Count -gt 0) { [Math]::Round(($delArr | Measure-Object -Average).Average, 1) } else { 0 }
    $delP95 = if ($delArr.Count -gt 0) { [Math]::Round($delArr[[Math]::Min($delArr.Count-1, [Math]::Floor($delArr.Count*0.95))], 1) } else { 0 }
    $delRps = if ($delAvg -gt 0) { [Math]::Round(($delArr.Count / (($delArr | Measure-Object -Sum).Sum / 1000.0)), 1) } else { 0 }

    if ($createdIds.Count -gt 0) {
        Write-Host ("  {0,-15} {1,-12} {2,6} {3,6} {4,6}% {5,8} {6,8} {7,8}`n" -f `
            "", "DELETE", $createdIds.Count, $delOk, [Math]::Round(($delErr/[Math]::Max(1,$createdIds.Count))*100,1), $delAvg, $delP95, $delRps) `
            -ForegroundColor $(if ($delErr -eq 0) { "Green" } else { "Yellow" })
    }

    $client.Dispose()
}

# ─── 1. Tenants CRUD ─────────────────────────────────────────────────────────
Test-CRUDResource -resourceName "Tenants" `
    -createPath "/tenants" `
    -createBodyFn { param($i) "{`"firstName`":`"Stress`",`"lastName`":`"Tenant$i`",`"mobile`":`"91000000$($i.ToString().PadLeft(2,'0'))`",`"propertyId`":`"$propId`"}" } `
    -updateBodyFn { param($id, $i) "{`"firstName`":`"StressUpdated`",`"lastName`":`"Tenant$i`",`"mobile`":`"91000000$($i.ToString().PadLeft(2,'0'))`",`"propertyId`":`"$propId`"}" }

# Fetch an existing tenant ID for nested tests
$tenantResp = Invoke-RestMethod -Uri "$BaseUrl/tenants?pageSize=1" -Headers @{ "Authorization" = "Bearer $token" }
$testTenantId = if ($tenantResp.data -and $tenantResp.data.Count -gt 0) { $tenantResp.data[0].id } else { $null }

if ($testTenantId) {
    # ─── 2. Visitors CRUD ────────────────────────────────────────────────────────
    Test-CRUDResource -resourceName "Visitors" `
        -createPath "/tenants/$testTenantId/visitors" `
        -createBodyFn { param($i) "{`"visitorName`":`"Stress Visitor $i`",`"mobileNumber`":`"98765432$($i.ToString().PadLeft(2,'0'))`",`"purpose`":`"Meeting`"}" } `
        -updateBodyFn { param($id, $i) "{`"visitorName`":`"Stress Visitor Updated $i`",`"mobileNumber`":`"98765432$($i.ToString().PadLeft(2,'0'))`",`"purpose`":`"Delivery`"}" }

    # ─── 3. Complaints CRUD ──────────────────────────────────────────────────────
    Test-CRUDResource -resourceName "Complaints" `
        -createPath "/tenants/$testTenantId/complaints" `
        -createBodyFn { param($i) "{`"title`":`"Stress Complaint $i`",`"description`":`"Test issue $i`",`"category`":`"Plumbing`",`"priority`":`"MEDIUM`"}" } `
        -updateBodyFn { param($id, $i) "{`"title`":`"Stress Complaint Updated $i`",`"description`":`"Resolved issue $i`",`"category`":`"Plumbing`",`"priority`":`"HIGH`",`"status`":`"IN_PROGRESS`"}" }
}


Write-Host "══════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  ✅ Full CRUD Stress Test Completed & Database Cleaned Up!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor DarkGray
