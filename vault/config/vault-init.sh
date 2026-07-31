#!/bin/sh
set -e

# jq é usado para ler o JSON de vault operator init / vault status
apk add --no-cache jq >/dev/null 2>&1 || true

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

ROOT_TOKEN=$(jq -r '.root_token' "$KEYS_FILE")
export VAULT_TOKEN="$ROOT_TOKEN"

# 2. Destrancar o Vault, se estiver selado (acontece em todo o restart do container)
SEALED=$(vault status -format=json | jq -r '.sealed')
if [ "$SEALED" = "true" ]; then
  echo "[*] Vault selado — a destrancar com 3 das 5 chaves"
  for i in 0 1 2; do
    KEY=$(jq -r ".unseal_keys_b64[$i]" "$KEYS_FILE")
    vault operator unseal "$KEY"
  done
else
  echo "[*] Vault já estava destrancado"
fi

# 3. Guardar secrets (idempotente — vault kv put sobrescreve sem falhar)
vault kv put secret/postgres user="${POSTGRES_USER}" password="${POSTGRES_PASSWORD}"
vault kv put secret/redis password="${REDIS_PASSWORD}"

# 4. Carregar a policy
vault policy write backend-policy /etc/vault/config/backend-policy.hcl

# 5. Ativar AppRole (idempotente — não falha se já existir)
vault auth enable approle || true

# 6. Criar a role com TTLs definidos
vault write auth/approle/role/backend-role \
  token_policies="backend-policy" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=24h

# 7. Obter o RoleID (fixo)
vault read auth/approle/role/backend-role/role-id

# 8. Gerar o SecretID (sensível, expira em 24h)
vault write -f auth/approle/role/backend-role/secret-id