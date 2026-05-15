$ErrorActionPreference='Stop'
function WriteLine($m){ Write-Output $m }
$url='http://localhost:3000'
# Check server
try { Invoke-WebRequest -Uri $url -UseBasicParsing -Method Head -TimeoutSec 5; WriteLine 'Server responding'; $server=$true } catch { WriteLine 'Server not responding'; $server=$false }
# Start server if not running
if (-not $server) {
  WriteLine 'Starting server in background...'
  Start-Process -FilePath npm -ArgumentList 'run','dev' -WindowStyle Hidden
  Start-Sleep -Seconds 6
}
# Create web session and login
$sess = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try{
  $login = Invoke-WebRequest -Uri "$url/login" -Method Post -Body @{ studentName='Harshita'; passcode='ch@plot' } -WebSession $sess -UseBasicParsing -TimeoutSec 10
  WriteLine ("Login status: {0}" -f $login.StatusCode)
  WriteLine ('Login response body snippet:')
  WriteLine ($login.Content | Select-String -Pattern 'Access denied|Owner access required' -Quiet)
} catch { WriteLine ("Login failed: {0}" -f $_.Exception.Message); exit 1 }
# Prepare sample PDF
$uploadsDir = Join-Path (Get-Location) 'uploads'
if (-not (Test-Path $uploadsDir)) { New-Item -ItemType Directory -Path $uploadsDir | Out-Null }
$sample = Join-Path $uploadsDir 'test-upload.pdf'
$pdf = [System.Text.Encoding]::ASCII.GetBytes('%PDF-1.4`n1 0 obj<<>>endobj`nxref`n0 1`n0000000000 65535 f `ntrailer<<>>`nstartxref`n0`n%%EOF')
[System.IO.File]::WriteAllBytes($sample,$pdf)
WriteLine ("Sample PDF created: {0}" -f $sample)
# Upload
try{
  # Build cookie header from the WebRequestSession
  $cookieHeader = ($sess.Cookies.GetCookies($url) | ForEach-Object { $_.Name + '=' + $_.Value }) -join '; '
  $fileArg = 'file=@"' + $sample + '"'
  # Use .NET HttpClient to POST multipart/form-data (works across PowerShell versions)
  Add-Type -AssemblyName System.Net.Http
  $multipart = New-Object System.Net.Http.MultipartFormDataContent
  $multipart.Add((New-Object System.Net.Http.StringContent('compiler-design-lab')), 'subjectSlug')
  $multipart.Add((New-Object System.Net.Http.StringContent('Automated Test Upload')), 'title')
  $multipart.Add((New-Object System.Net.Http.StringContent('Uploaded by automated test')), 'description')
  $fileStream = [System.IO.File]::OpenRead($sample)
  $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
  $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/pdf')
  $multipart.Add($fileContent, 'file', [System.IO.Path]::GetFileName($sample))

  $client = New-Object System.Net.Http.HttpClient
  $client.DefaultRequestHeaders.Add('Cookie', $cookieHeader)
  $response = $client.PostAsync(($url + '/upload'), $multipart).Result
  $body = $response.Content.ReadAsStringAsync().Result
  WriteLine ("Upload status: {0}" -f $response.StatusCode)
} catch { WriteLine ("Upload failed: {0}" -f $_.Exception.Message); exit 1 }
# Fetch assignments
try{
  $api = Invoke-WebRequest -Uri "$url/api/assignments" -WebSession $sess -UseBasicParsing -TimeoutSec 10
  $rawJson = $api.Content
  WriteLine ('Assignments raw JSON:')
  WriteLine $rawJson
  $data = $rawJson | ConvertFrom-Json
  WriteLine ("Assignments count: {0}" -f $data.assignments.Count)
  $latest = $data.assignments | Where-Object { $_.title -eq 'Automated Test Upload' } | Select-Object -First 1
  if (-not $latest) { WriteLine 'Uploaded assignment not found in list.'; exit 1 }
  WriteLine ("Found uploaded assignment id: {0}" -f $latest.id)
} catch { WriteLine ("Failed to fetch assignments: {0}" -f $_.Exception.Message); exit 1 }
# Load secure view
try{
  $sv = Invoke-WebRequest -Uri "$url/secure-view/$($latest.id)" -WebSession $sess -UseBasicParsing -TimeoutSec 10
  WriteLine ("Secure view loaded: {0}" -f $sv.StatusCode)
} catch { WriteLine ("Secure view failed: {0}" -f $_.Exception.Message); exit 1 }
# Fetch raw file stream
try{
  $raw = Invoke-WebRequest -Uri "$url/secure-file/$($latest.id)/raw" -WebSession $sess -UseBasicParsing -Method Get -TimeoutSec 20
  WriteLine ("Secure file request status: {0}; bytes: {1}" -f $raw.StatusCode, $raw.RawContentLength)
} catch { WriteLine ("Secure file request failed: {0}" -f $_.Exception.Message); exit 1 }
WriteLine 'Test completed successfully.'
