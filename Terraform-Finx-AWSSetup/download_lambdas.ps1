$lambdas = @("email-attachment-parser", "Nova-Extractor-Lambda", "invoice-audit-writer-lamdba")

foreach ($l in $lambdas) {
    # Create src dir
    $dir = ".\src\$l"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    
    # Read location from json
    $json = Get-Content ".\$l-utf8.json" -Raw | ConvertFrom-Json
    $url = $json.Code.Location
    
    # Download zip
    $zipPath = "$dir\function.zip"
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    Write-Host "Downloaded $l to $zipPath"
    
    # Also extract zip
    Expand-Archive -Path $zipPath -DestinationPath $dir -Force
    Write-Host "Extracted $l to $dir"
}
