#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://api:5278}"
MAX_ATTEMPTS="${SEED_MAX_ATTEMPTS:-60}"

echo "Waiting for API at ${API_BASE_URL}..."
attempt=0
until node -e "fetch(process.env.API_BASE_URL+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "API did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

echo "Running demo seed (same as npm run seed:demo)..."
node /seed/seed-demo.js
echo "Demo seed finished."
