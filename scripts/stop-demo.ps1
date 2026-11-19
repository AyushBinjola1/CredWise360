# Stops the demonstration API and web server. PostgreSQL keeps running; data is retained.
Get-Process credwise -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'next.*start' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Write-Host 'CredWise 360 stopped.'
