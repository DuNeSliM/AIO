# AIO
Desktop App to bundle all your games in one bib

Frontend: Tauri
Backend: Go

for encryption of secrets we do it like this: 
```bash
sops --encrypt --in-place k8s/api/secret.yaml
```



add ZITADEL_ISSUER=https://auth.gamedivers.de to .env
