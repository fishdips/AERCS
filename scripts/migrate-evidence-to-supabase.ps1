# One-time migration: upload existing local evidence files to Supabase Storage.
# Run this ONCE before restarting the backend with the new code.

$serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cWRtdHlxZHp3ZHVrdGFiaHVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY4ODg0OSwiZXhwIjoyMDk1MjY0ODQ5fQ.v8PkKkz4BDUOBrZyJEDmTF1iwD3Yd1LdiwACtHSsXIA"
$supabaseUrl  = "https://qyqdmtyqdzwduktabhuq.supabase.co"
$bucket       = "evidence-files"
$localBase    = "$PSScriptRoot\..\backend\uploads\evidence"

$contentTypes = @{
    ".pdf"  = "application/pdf"
    ".docx" = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
}

$files = Get-ChildItem -Recurse -File -Path $localBase -ErrorAction SilentlyContinue

if ($files.Count -eq 0) {
    Write-Host "No local evidence files found at $localBase" -ForegroundColor Yellow
    exit 0
}

$ok = 0; $fail = 0

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($localBase.Length).TrimStart('\', '/').Replace('\', '/')
    $url          = "$supabaseUrl/storage/v1/object/$bucket/$relativePath"
    $ext          = $file.Extension.ToLower()
    $contentType  = if ($contentTypes.ContainsKey($ext)) { $contentTypes[$ext] } else { "application/octet-stream" }

    Write-Host "Uploading $relativePath ..." -NoNewline

    try {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $null = Invoke-RestMethod -Uri $url -Method Post -Body $bytes -ContentType $contentType `
            -Headers @{ "Authorization" = "Bearer $serviceRoleKey"; "x-upsert" = "true" }
        Write-Host " OK" -ForegroundColor Green
        $ok++
    } catch {
        Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
Write-Host "Done. $ok uploaded, $fail failed."
if ($fail -gt 0) { Write-Host "Re-run after fixing failures before starting the backend." -ForegroundColor Yellow }
