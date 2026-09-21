#!/usr/bin/env bash
# Replays every case in contract/error-contract.json against both running
# backends and diffs the answers. Start them first:
#   npm run dev                                  (Node, 43147)
#   cd backend && PORT=43148 bin/rails server    (Rails, 43148)
set -u

NODE_ORIGIN="${NODE_ORIGIN:-http://127.0.0.1:43147}"
RAILS_ORIGIN="${RAILS_ORIGIN:-http://127.0.0.1:43148}"
CONTRACT="$(dirname "$0")/../contract/error-contract.json"

failures=0

check() {
  local name="$1" body="$2"
  local node rails
  node=$(curl -s -o /tmp/parity-node.json -w '%{http_code}' -X POST "$NODE_ORIGIN/api/entries" \
    -H 'Content-Type: application/json' --data-binary "$body")
  rails=$(curl -s -o /tmp/parity-rails.json -w '%{http_code}' -X POST "$RAILS_ORIGIN/api/entries" \
    -H 'Content-Type: application/json' --data-binary "$body")

  if [ "$node" = "$rails" ] && diff -q /tmp/parity-node.json /tmp/parity-rails.json >/dev/null; then
    printf '  ok   %-38s %s %s\n' "$name" "$node" "$(cat /tmp/parity-node.json)"
  else
    printf '  FAIL %-38s node=%s %s | rails=%s %s\n' "$name" \
      "$node" "$(cat /tmp/parity-node.json)" "$rails" "$(cat /tmp/parity-rails.json)"
    failures=$((failures + 1))
  fi
}

echo "POST /api/entries"
while IFS=$'\t' read -r name body; do
  check "$name" "$body"
done < <(python3 -c '
import json, sys
contract = json.load(open(sys.argv[1]))
for case in contract["cases"]:
    body = case.get("body")
    if body is None:
        body = json.dumps({"legs": [], "filler": "x" * case["bodyBytes"]})
    print(case["name"], body, sep="\t")
' "$CONTRACT")

echo "GET /api/health"
for origin in "$NODE_ORIGIN" "$RAILS_ORIGIN"; do
  printf '  %s -> %s\n' "$origin" "$(curl -s "$origin/api/health" | python3 -c 'import json,sys; print(json.load(sys.stdin)["backend"])')"
done

echo "GET /api/props/nope"
check_404() {
  local origin="$1"
  printf '  %s -> %s %s\n' "$origin" \
    "$(curl -s -o /tmp/parity-404.json -w '%{http_code}' "$origin/api/props/nope")" \
    "$(cat /tmp/parity-404.json)"
}
check_404 "$NODE_ORIGIN"
check_404 "$RAILS_ORIGIN"

if [ "$failures" -gt 0 ]; then
  echo "$failures case(s) differ"
  exit 1
fi
echo "both backends agree"
