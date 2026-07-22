#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Meesho Ad Ne Bana Di Jodi — Local Demo Startup"
echo ""
echo "Mode: LOCAL DEMO (SQLite, no .env / DATABASE_URL required)"
echo ""

# Backend setup
if [ ! -d "$ROOT/backend/venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$ROOT/backend/venv"
  "$ROOT/backend/venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

# Frontend setup
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

echo ""
echo "Starting backend on http://127.0.0.1:8000"
echo "Starting frontend on http://127.0.0.1:5173"
echo ""
echo "Demo accounts:"
echo "  Seller:   seller1@test.com / password  (or Guest Seller button)"
echo "  Customer: customer@example.com / password  (or Guest Customer button)"
echo ""
echo "Demo flow:"
echo "  1. Seller Dashboard → Join Ad Ne Bana Di Jodi (authentic seller UI)"
echo "  2. Demo Console (bottom-right) → Run Matchmaking → Run Bidding"
echo "  3. Customer Feed → see live sponsored ads"
echo "Press Ctrl+C to stop both servers."
echo ""

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

export LOCAL_DEMO=1

# Free port 8000 if a previous backend is still running
if lsof -ti:8000 >/dev/null 2>&1; then
  echo "Stopping previous backend on port 8000..."
  lsof -ti:8000 | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

(cd "$ROOT/backend" && source venv/bin/activate && uvicorn main:app --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!

(cd "$ROOT/frontend" && npm run dev -- --host 127.0.0.1 --port 5173) &
FRONTEND_PID=$!

wait
