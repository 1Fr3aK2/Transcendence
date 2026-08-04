# Backend Vault Policy (`vault/config/backend-policy.hcl`)

## What it does

Defines an ACL policy in Vault that grants read-only access to exactly two
secret paths — the Postgres and Redis credentials — and nothing else.

```hcl
path "secret/data/postgres" {
    capabilities = ["read"]
}

path "secret/data/redis" {
    capabilities = ["read"]
}
```

## Why it was needed

By default, a Vault token has no permissions at all — every capability has
to be explicitly granted through a policy. Without this file, the backend
would either need a much broader (and riskier) token, or no way to read its
own database/cache credentials from Vault at all.

This policy follows the principle of least privilege: the backend can only
**read** these two specific paths. It cannot list other secrets, write or
delete anything, or access any secret outside `postgres` and `redis` — even
if new secrets are added to Vault later for other services, this policy
doesn't grant access to them unless explicitly extended.

## How it's used

The policy is loaded into Vault and attached to an AppRole
(`backend-role`, defined in `vault-init.sh`) via `token_policies =
"backend-policy"`. When the backend authenticates with its RoleID/SecretID,
the token it receives is scoped to exactly these permissions — not the
Vault root token, and not unrestricted access.

```bash
vault policy write backend-policy /etc/vault/config/backend-policy.hcl
```

## Path structure

The `secret/data/...` prefix (rather than plain `secret/...`) is specific to
Vault's KV **v2** secrets engine — v2 stores actual secret data under a
`data/` sub-path (separate from `metadata/`, which tracks versioning). Using
v1-style paths here would silently fail to match, since the policy engine
checks the literal path.

