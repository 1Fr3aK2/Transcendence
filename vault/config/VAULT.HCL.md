# Vault Config (`vault/config/vault.hcl`)

## What it does

Replaces `vault server -dev` with a real, persistent Vault server
configuration, used to run Vault outside of development mode.

## Why it was needed

The project previously ran Vault with `vault server -dev`, which keeps
everything — secrets, policies, the AppRole setup — entirely in memory. Every
container restart wiped all of it, and there was no real encryption at rest.
This doesn't meet the subject's requirement of managing secrets "encrypted
and isolated" in Vault, and it's fragile in practice (a crash mid-demo would
lose all backend credentials).

`vault.hcl` configures a production-style Vault server with persistent,
encrypted storage and a TLS-protected API, replacing the dev-mode shortcut.

## Configuration

```hcl
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/etc/vault/certs/vault.cert"
  tls_key_file  = "/etc/vault/certs/vault.key"
}

api_addr     = "https://vault:8200"
cluster_addr = "https://vault:8201"

ui = true
disable_mlock = false
```

### `storage "raft"`

Integrated storage backend, HashiCorp's current recommendation (the older
`file` backend is in maintenance mode). Data is persisted to disk at
`/vault/data` (needs a Docker volume mounted there) instead of living only in
memory. `node_id` is required by raft even for a single-node setup like this
one — no clustering is being used, but the field is mandatory.

### `listener "tcp"`

Serves the Vault API over `0.0.0.0:8200` inside the container. Unlike the
project's other internal service-to-service traffic (Postgres, Redis — which
the subject explicitly allows to run unencrypted), this listener uses TLS
even for internal Docker-network traffic. This is a deliberate
defense-in-depth choice: Vault holds the most sensitive secrets in the
system, so it's held to a stricter standard than the general internal-traffic
exception. `tls_cert_file`/`tls_key_file` point to the certificate generated
by `setup-certs.sh` (see that script's own documentation), issued for the
`vault` hostname and trusted via the shared local mkcert CA.

### `api_addr` / `cluster_addr`

Required by the raft storage backend even in a single-node deployment — Vault
uses these to advertise its own address. Both use `https://`, consistent with
the TLS listener above.

### `ui = true`

Enables Vault's web UI, reachable at `https://vault:8200/ui` from inside the
network — useful for manual inspection/debugging, not required by the
subject.

### `disable_mlock = false`

Keeps Vault's memory-locking protection enabled, which prevents secret
material from being swapped to disk. Requires the `IPC_LOCK` capability,
already granted to the `vault` service in `docker-compose.yml`
(`cap_add: [IPC_LOCK]`).

## Still needed for this to work

This file alone isn't enough to switch Vault into production mode. Still
pending, in order:

1. A Docker volume for `/vault/data` (raft storage has nowhere to persist to
   yet).
2. Updating the `vault` service's `command:` from `vault server -dev` to
   `vault server -config=/etc/vault/config/vault.hcl`.
3. Handling `vault operator init` and `vault operator unseal` in
   `vault-init.sh` — with this config, Vault starts **sealed** after every
   restart and won't serve secrets until unsealed.
4. Updating `VAULT_ADDR` from `http://vault:8200` to `https://vault:8200`,
   and adding `VAULT_CACERT` pointing at the shared CA, everywhere Vault is
   contacted (backend, `vault_init`).
5. The backend's own Vault HTTP client needs to trust the same CA — Vault
   CLI environment variables don't affect a generic Node.js HTTP client.
