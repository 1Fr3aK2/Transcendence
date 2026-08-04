storage "raft" {
    path = "/vault/data"
    node_id = "vault-1"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/etc/vault/certs/vault.cert"
  tls_key_file  = "/etc/vault/certs/vault.key"
}

api_addr = "https://vault:8200"
cluster_addr = "https://vault:8201"

ui = true
disable_mlock = false