#!/usr/bin/env bash
# Quick smoke test for hackathon submission URLs
set -euo pipefail

FRONTEND="${1:-https://meesho-beige-three.vercel.app}"
BACKEND="${2:-https://meesho-backend-wgsi.onrender.com}"

echo "==> Checking backend: $BACKEND"
HEALTH=$(curl -s -m 90 "$BACKEND/api/health" || true)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "OK  /api/health"
  echo "$HEALTH"
else
  echo "FAIL /api/health — set DATABASE_URL + FRONTEND_URL on Render and redeploy"
  echo "$HEALTH"
  exit 1
fi

echo ""
echo "==> Checking CORS for: $FRONTEND"
CORS=$(curl -s -m 30 -I -X OPTIONS "$BACKEND/api/pool/status" \
  -H "Origin: $FRONTEND" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control || true)
if echo "$CORS" | grep -qi "$FRONTEND\|access-control-allow-origin"; then
  echo "OK  CORS headers present"
  echo "$CORS"
else
  echo "WARN CORS — set FRONTEND_URL=$FRONTEND on Render (no trailing slash)"
fi

echo ""
echo "==> Checking frontend: $FRONTEND"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 30 "$FRONTEND")
if [ "$CODE" = "200" ]; then
  echo "OK  frontend HTTP $CODE"
else
  echo "FAIL frontend HTTP $CODE"
  exit 1
fi

echo ""
echo "All checks passed. Submit: $FRONTEND"
