import { readFileSync } from 'fs';

const APPROLE_DIR = '/vault/approle';

export async function loadSecretsFromVault(): Promise<void> {
  const vaultAddr = process.env.VAULT_ADDR;

  if (!vaultAddr) {
    throw new Error('VAULT_ADDR não está definido');
  }

  const roleId = readFileSync(`${APPROLE_DIR}/role_id`, 'utf-8').trim();
  const secretId = readFileSync(`${APPROLE_DIR}/secret_id`, 'utf-8').trim();

  // 1. Login no AppRole -> obter client token
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

  // 2. Ler o secret admin-api usando o token obtido
  const secretRes = await fetch(`${vaultAddr}/v1/secret/data/admin-api`, {
    headers: { 'X-Vault-Token': clientToken },
  });

  if (!secretRes.ok) {
    throw new Error(
      `Falha ao ler secret/admin-api do Vault: ${secretRes.status} ${await secretRes.text()}`,
    );
  }

  const secretBody = await secretRes.json();
  const adminApiKey = secretBody.data.data.key;

  if (!adminApiKey) {
    throw new Error('secret/admin-api não tem o campo "key" definido');
  }

  process.env.ADMIN_API_KEY = adminApiKey;
}