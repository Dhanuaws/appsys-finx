$functions = @(
    "email-attachment-parser",
    "Nova-Extractor-Lambda",
    "invoice-audit-writer-lamdba"
)

foreach ($func in $functions) {
    Write-Host "Fetching download URL for $func..."
    
    # Get the prepresigned URL for the deployment package
    $url = aws lambda get-function --function-name $func --query 'Code.Location' --output text
    
    if ($url) {
        Write-Host "Downloading $func.zip..."
        Invoke-WebRequest -Uri $url -OutFile "src\$func.zip"
        Write-Host "Successfully downloaded src\$func.zip"
    } else {
        Write-Host "Failed to get URL for $func"
    }
}
