#!/usr/bin/env bash
# Every check that asserts something, in the order they are cheapest to
# slowest. Pass a name to run just one: ./run.sh courses
set -u
cd "$(dirname "$0")"
# ladder is deliberately not in here: it samples 60 runs a skin and takes
# several minutes. Run it by name when the catalogue changes.
# playtest is not in here either: it needs Chrome on the machine. Run it
# with `node playtest.js` — it is the only check that touches the real page.
SUITES="lint-colors viewport persist determinism zonename gates themes courses daily tutorial timerush avalanche crevasse revive skinsafe newskins rush fork mech economy"
[ $# -gt 0 ] && SUITES="$*"
fail=0
for t in $SUITES; do
  printf '### %s\n' "$t"
  if ! node "$t.js"; then fail=$((fail+1)); fi
done
echo
if [ $fail -gt 0 ]; then echo "$fail SUITE(S) FAILED"; exit 1; fi
echo "all suites passed"
