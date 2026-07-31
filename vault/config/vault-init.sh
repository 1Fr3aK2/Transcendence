#!/bin/sh
set -e

KEYS_FILE="/vault/keys/init.json"

# 1. Inicializar o Vault — só corre uma vez, na primeira vez que o container arranca.
#    Nas execuções seguintes, o ficheiro já existe e este passo é ignorado.
if [ ! -f "$KEYS_FILE" ]; then
  echo "[*] Vault ainda não inicializado — a correr vault operator init"
  vault operator init -key-shares=5 -key-threshold=3 -format=json > "$KEYS_FILE"
  chmod 600 "$KEYS_FILE"
else
  echo "[*] Ficheiro de chaves já existe, a saltar vault operator init"
fi

# Extrair o root token sem jq (grep/sed/cut, já disponíveis no Alpine)
ROOT_TOKEN=$(grep -Eo '"root_token": *"[^"]*"' "$KEYS_FILE" | cut -d'"' -f4)
export VAULT_TOKEN="$ROOT_TOKEN"

# 2. Destrancar o Vault, se estiver selado (acontece em todo o restart do container)
SEALED=$(vault status -format=json | grep -Eo '"sealed": *(true|false)' | grep -Eo 'true|false')
if [ "$SEALED" = "true" ]; then
  echo "[*] Vault selado — a destrancar com 3 das 5 chaves"
  # Extrai as strings base64 dentro do bloco unseal_keys_b64 (sem jq)
  UNSEAL_KEYS=$(sed -n '/"unseal_keys_b64"/,/\]/p' "$KEYS_FILE" | grep -Eo '"[A-Za-z0-9+/=]+"' | tr -d '"')
  i=0
  for KEY in $UNSEAL_KEYS; do
    i=$((i + 1))
    vault operator unseal "$KEY"
    [ "$i" -ge 3 ] && break
  done
else
  echo "[*] Vault já estava destrancado"
fi

# 3. Ativar o motor de secrets KV v2 em "secret/" — em dev-mode isto é automático,
#    fora de dev-mode tem de ser feito explicitamente (idempotente: ignora erro se já existir)
vault secrets enable -path=secret -version=2 kv 2>/dev/null || true

# 4. Guardar secrets (idempotente — vault kv put sobrescreve sem falhar)
vault kv put secret/postgres user="${POSTGRES_USER}" password="${POSTGRES_PASSWORD}"
vault kv put secret/redis password="${REDIS_PASSWORD}"

# 5. Carregar a policy
vault policy write backend-policy /etc/vault/config/backend-policy.hcl

# 6. Ativar AppRole (idempotente — não falha se já existir)
vault auth enable approle || true

# 7. Criar a role com TTLs definidos
vault write auth/approle/role/backend-role \
  token_policies="backend-policy" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=24h

# 8. Obter o RoleID (fixo)
vault read auth/approle/role/backend-role/role-id

# 9. Gerar o SecretID (sensível, expira em 24h)
vault write -f auth/approle/role/backend-role/secret-id