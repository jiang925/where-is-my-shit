#!/bin/bash
set -e

BASE_URL="http://localhost:8000"
API_URL="$BASE_URL/api/v1"

echo "Waiting for service to be ready..."
until curl -s "$BASE_URL/health" > /dev/null; do
  echo "Waiting..."
  sleep 1
done

echo "1. Checking Health..."
curl -f "$BASE_URL/health"
echo -e "\nHealth OK"

echo "2. Ingesting content..."
CONTENT="The quick brown fox jumps over the lazy dog."
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

RESPONSE=$(curl -s -X POST "$API_URL/ingest/" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"$CONTENT\",
    \"platform\": \"cli-test\",
    \"author\": \"script\",
    \"conversation_id\": \"verify-run\",
    \"timestamp\": \"$TIMESTAMP\"
  }")

echo "Response: $RESPONSE"
ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ID" ]; then
  echo "Ingestion failed: No ID returned"
  exit 1
fi
echo "Ingested ID: $ID"

echo "3. Searching..."
# Give it a moment for indexing if async (though LanceDB is usually fast)
sleep 1

SEARCH_RESPONSE=$(curl -s "$API_URL/search/?q=fast%20animal&limit=1")
echo "Search Response: $SEARCH_RESPONSE"

if echo "$SEARCH_RESPONSE" | grep -q "$ID"; then
  echo "Found ingested document in search results."
else
  echo "FAILED: Did not find document in search results."
  exit 1
fi

echo "VERIFICATION PASSED"
