$roles = @("email-attachment-parser-role-h9ukc1hg", "Nova-Extractor-Lambda-role-2r21k3xp", "invoice-audit-writer-lamdba-role-lh1bhh2c")

foreach ($r in $roles) {
    aws iam get-role --role-name $r --output json | Set-Content ".\$r-role.json" -Encoding utf8
    aws iam list-attached-role-policies --role-name $r --output json | Set-Content ".\$r-policies.json" -Encoding utf8
    aws iam list-role-policies --role-name $r --output json | Set-Content ".\$r-inline.json" -Encoding utf8
    
    # For any inline policies, fetch them
    $inline = Get-Content ".\$r-inline.json" -Raw | ConvertFrom-Json
    if ($inline.PolicyNames) {
        foreach ($p in $inline.PolicyNames) {
            aws iam get-role-policy --role-name $r --policy-name $p --output json | Set-Content ".\$r-inline-$p.json" -Encoding utf8
        }
    }
}
