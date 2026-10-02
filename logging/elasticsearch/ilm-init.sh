#!/bin/sh
set -e

echo "Waiting for Elasticsearch to be ready..."
until curl -sf -u "elastic:$ELASTIC_PASSWORD" "http://elasticsearch:9200/_cluster/health" > /dev/null; do
  sleep 2
done

echo "Creating ILM policy..."
curl -sf -u "elastic:$ELASTIC_PASSWORD" -X PUT "http://elasticsearch:9200/_ilm/policy/transcendence-logs-policy" \
  -H "Content-Type: application/json" \
  -d '{
    "policy": {
      "phases": {
        "delete": {
          "min_age": "14d",
          "actions": {
            "delete": {}
          }
        }
      }
    }
  }'

echo "Creating index template for transcendence-logs-*..."
curl -sf -u "elastic:$ELASTIC_PASSWORD" -X PUT "http://elasticsearch:9200/_index_template/transcendence-logs-template" \
  -H "Content-Type: application/json" \
  -d '{
    "index_patterns": ["transcendence-logs-*"],
    "template": {
      "settings": {
        "index.lifecycle.name": "transcendence-logs-policy",
        "index.number_of_replicas": "0"
      }
    }
  }'

echo "Creating index template for waf-audit-*..."
curl -sf -u "elastic:$ELASTIC_PASSWORD" -X PUT "http://elasticsearch:9200/_index_template/waf-audit-template" \
  -H "Content-Type: application/json" \
  -d '{
    "index_patterns": ["waf-audit-*"],
    "template": {
      "settings": {
        "index.lifecycle.name": "transcendence-logs-policy",
        "index.number_of_replicas": "0"
      }
    }
  }'

echo "Applying policy to existing transcendence-logs-* indices..."
curl -sf -u "elastic:$ELASTIC_PASSWORD" -X PUT "http://elasticsearch:9200/transcendence-logs-*/_settings?ignore_unavailable=true" \
  -H "Content-Type: application/json" \
  -d '{"index.lifecycle.name": "transcendence-logs-policy"}' || true

echo "Applying policy to existing waf-audit-* indices..."
curl -sf -u "elastic:$ELASTIC_PASSWORD" -X PUT "http://elasticsearch:9200/waf-audit-*/_settings?ignore_unavailable=true" \
  -H "Content-Type: application/json" \
  -d '{"index.lifecycle.name": "transcendence-logs-policy"}' || true

echo "ILM setup complete."
