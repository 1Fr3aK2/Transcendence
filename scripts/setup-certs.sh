#!/bin/bash
set -e

# Instalar mkcert se não existir
if ! command -v mkcert &>/dev/null; then
    echo "[*] Installing mkcert..."
    sudo apt install -y libnss3-tools
    curl -Lo /tmp/mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64
    chmod +x /tmp/mkcert
    sudo mv /tmp/mkcert /usr/local/bin/mkcert
fi

# Instalar CA local
mkcert -install

# Gerar certs do nginx
mkdir -p nginx/certs
cd nginx/certs
mkcert localhost 127.0.0.1 ::1
mv localhost+2.pem nginx.cert
mv localhost+2-key.pem nginx.key
chmod 644 nginx.key
cd ../..

echo "[+] Certs generated at nginx/certs/"

# Gerar cert do Vault, para TLS interno (mesma CA local do mkcert)
mkdir -p vault/certs
cd vault/certs
mkcert vault localhost 127.0.0.1 ::1
mv vault+3.pem vault.cert
mv vault+3-key.pem vault.key
chmod 644 vault.key
cd ../..

# Copiar a CA root do mkcert, para o backend/vault_init confiarem nela
cp "$(mkcert -CAROOT)/rootCA.pem" vault/certs/ca.pem

echo "[+] Certs generated at vault/certs/"