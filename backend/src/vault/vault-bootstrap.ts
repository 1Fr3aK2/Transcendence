import { readFileSync } from 'fs';

const APPROLE_DIR = '/vault/approle';

interface VaultKvResponse {
  data: { data: Record<string, string> };
}


export async function loadSecretsFromVault(): Promise<void> {
  const vaultAddr = process.env.VAULT_ADDR; // ex: https://vault:8200

  if (!vaultAddr) {
    throw new Error('VAULT_ADDR não está definido');
  }

  const roleId = readFileSync(`${APPROLE_DIR}/role_id`, 'utf-8').trim();
  const secretId = readFileSync(`${APPROLE_DIR}/secret_id`, 'utf-8').trim();

  const loginRes = await fetch(`${vaultAddr}/v1/auth/approle/login`, {
    method: 'POST',
    body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
  });

  if (!loginRes.ok) {
    throw new Error(
      `Falha no login AppRole ao Vault: ${loginRes.status} ${await loginRes.text()}`,
    );
  }

  const loginBody = await loginRes.json();
  const clientToken = loginBody.auth.client_token;

  const adminApiData = await readVaultSecret(vaultAddr, clientToken, 'admin-api');
  const adminApiKey = adminApiData.key;
  if (!adminApiKey) {
    throw new Error('secret/admin-api não tem o campo "key" definido');
  }
  process.env.ADMIN_API_KEY = adminApiKey;

  const adminAccountData = await readVaultSecret(vaultAddr, clientToken, 'admin-account');
  const { username, email, password } = adminAccountData;
  if (!username || !email || !password) {
    throw new Error(
      'secret/admin-account tem de ter os campos "username", "email" e "password" definidos',
    );
  }
  process.env.ADMIN_USERNAME = username;
  process.env.ADMIN_EMAIL = email;
  process.env.ADMIN_PASSWORD = password;
}

async function readVaultSecret(
  vaultAddr: string,
  clientToken: string,
  path: string,
): Promise<Record<string, string>> {
  const res = await fetch(`${vaultAddr}/v1/secret/data/${path}`, {
    headers: { 'X-Vault-Token': clientToken },
  });

  if (!res.ok) {
    throw new Error(
      `Falha ao ler secret/${path} do Vault: ${res.status} ${await res.text()}`,
    );
  }

  const body = (await res.json()) as VaultKvResponse;
  return body.data.data;
}