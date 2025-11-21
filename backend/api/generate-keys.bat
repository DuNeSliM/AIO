@echo off
REM Generate a secure random JWT secret and encryption key for Windows

echo Generating secure keys...
echo.

echo JWT_SECRET:
powershell -Command "$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)"

echo.
echo ENCRYPTION_KEY:
powershell -Command "$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)"

echo.
echo Copy these values to your .env file!
pause
