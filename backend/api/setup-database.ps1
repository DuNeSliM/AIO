# Setup PostgreSQL Database for AIO Game Library
# This script creates the database and applies the schema

param(
    [string]$DatabaseName = "aio_games",
    [string]$Username = "postgres",
    [string]$Password = "",
    [string]$Host = "localhost",
    [int]$Port = 5432
)

Write-Host "🎮 AIO Game Library - Database Setup" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL found: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    Write-Host "  Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# Get password if not provided
if ([string]::IsNullOrEmpty($Password)) {
    $SecurePassword = Read-Host "Enter PostgreSQL password for user '$Username'" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

$env:PGPASSWORD = $Password

Write-Host ""
Write-Host "Creating database '$DatabaseName'..." -ForegroundColor Yellow

# Create database (ignore error if already exists)
$createDbResult = psql -h $Host -p $Port -U $Username -d postgres -c "CREATE DATABASE $DatabaseName;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database created successfully" -ForegroundColor Green
} elseif ($createDbResult -like "*already exists*") {
    Write-Host "⚠ Database already exists, will apply schema updates" -ForegroundColor Yellow
} else {
    Write-Host "✗ Failed to create database: $createDbResult" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Applying database schema..." -ForegroundColor Yellow

# Apply schema from k8s/schema.sql
$schemaPath = "..\..\k8s\schema.sql"
if (Test-Path $schemaPath) {
    psql -h $Host -p $Port -U $Username -d $DatabaseName -f $schemaPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Schema applied successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to apply schema" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✗ Schema file not found at: $schemaPath" -ForegroundColor Red
    exit 1
}

# Clean up password from environment
$env:PGPASSWORD = ""

Write-Host ""
Write-Host "✓ Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Update your .env file with:" -ForegroundColor Cyan
Write-Host "   DATABASE_URL=postgresql://${Username}:${Password}@${Host}:${Port}/${DatabaseName}?sslmode=disable" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Now run: go run main.go" -ForegroundColor Cyan
