#!/bin/sh
# Browser checks against a fake Gmail page. Optional: needs Playwright
# (npm install -g playwright, then npx playwright install chromium).
cd "$(dirname "$0")" || exit 1
fail=0
for f in phase2.js phase3.js phase4.js phase5.js; do
  echo "== $f"
  node "$f" || fail=1
done
exit $fail
