Write-Host "=== Test OpenRouter Key A ==="
$openrouterA = Read-Host "Tempel OpenRouter Key A (atau tekan Enter untuk skip)"
if ($openrouterA) {
    $body = @{
        model = "meta-llama/llama-3.1-8b-instruct:free"
        messages = @(
            @{
                role = "user"
                content = "Balas hanya: OK"
            }
        )
    } | ConvertTo-Json -Depth 5

    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $openrouterA"
            "HTTP-Referer" = "https://example.com"
            "X-Title" = "BuzzLab WhatsApp Bot"
        }
        $response = Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/chat/completions" -Method Post -Headers $headers -Body $body
        Write-Host "`nOpenRouter A BERHASIL:"
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "`nOpenRouter A GAGAL:"
        Write-Host $_.Exception.Message
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            Write-Host "StatusCode:" ([int]$_.Exception.Response.StatusCode)
        }
    }
} else {
    Write-Host "OpenRouter Key A dilewati."
}

Write-Host "`n=== Test OpenRouter Key B ==="
$openrouterB = Read-Host "Tempel OpenRouter Key B (atau tekan Enter untuk skip)"
if ($openrouterB) {
    $body = @{
        model = "meta-llama/llama-3.1-8b-instruct:free"
        messages = @(
            @{
                role = "user"
                content = "Balas hanya: OK"
            }
        )
    } | ConvertTo-Json -Depth 5

    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $openrouterB"
            "HTTP-Referer" = "https://example.com"
            "X-Title" = "BuzzLab WhatsApp Bot"
        }
        $response = Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/chat/completions" -Method Post -Headers $headers -Body $body
        Write-Host "`nOpenRouter B BERHASIL:"
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "`nOpenRouter B GAGAL:"
        Write-Host $_.Exception.Message
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            Write-Host "StatusCode:" ([int]$_.Exception.Response.StatusCode)
        }
    }
} else {
    Write-Host "OpenRouter Key B dilewati."
}

Write-Host "`n=== Test Mistral ==="
$mistralKey = Read-Host "Tempel Mistral Key (atau tekan Enter untuk skip)"
if ($mistralKey) {
    $body = @{
        model = "mistral-small-latest"
        messages = @(
            @{
                role = "user"
                content = "Balas hanya: OK"
            }
        )
    } | ConvertTo-Json -Depth 5

    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $mistralKey"
        }
        $response = Invoke-RestMethod -Uri "https://api.mistral.ai/v1/chat/completions" -Method Post -Headers $headers -Body $body
        Write-Host "`nMistral BERHASIL:"
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "`nMistral GAGAL:"
        Write-Host $_.Exception.Message
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            Write-Host "StatusCode:" ([int]$_.Exception.Response.StatusCode)
        }
    }
} else {
    Write-Host "Mistral Key dilewati."
}

Write-Host "`n=== Test DeepSeek ==="
$deepseekKey = Read-Host "Tempel DeepSeek Key (atau tekan Enter untuk skip)"
if ($deepseekKey) {
    $body = @{
        model = "deepseek-chat"
        messages = @(
            @{
                role = "user"
                content = "Balas hanya: OK"
            }
        )
    } | ConvertTo-Json -Depth 5

    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $deepseekKey"
        }
        $response = Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method Post -Headers $headers -Body $body
        Write-Host "`nDeepSeek BERHASIL:"
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "`nDeepSeek GAGAL:"
        Write-Host $_.Exception.Message
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            Write-Host "StatusCode:" ([int]$_.Exception.Response.StatusCode)
        }
    }
} else {
    Write-Host "DeepSeek Key dilewati."
}

Write-Host "`nSelesai. Cek di atas mana yang BERHASIL dan GAGAL."

