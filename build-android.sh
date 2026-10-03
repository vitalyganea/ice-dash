#!/usr/bin/env bash
# Builds www/, the web part of the Android app, from the same allowlist
# build.sh ships to YouTube Playables — so the two can never disagree about
# what the game is. Two differences, both because an app is not YouTube:
#   - the Playables SDK <script> is taken out. The game already runs
#     without it (saves to localStorage, no platform pause), and in an app
#     it would be a network request that fails offline.
#   - js/native.js is added: the Android back button, haptics through the
#     native plugin, and the system bars hidden.
set -eu
cd "$(dirname "$0")"

FILES=$(sed -n '/^FILES="/,/^"/p' build.sh | sed '1d;$d')
rm -rf www
for f in $FILES; do
  [ -f "$f" ] || { echo "missing: $f"; exit 1; }
  mkdir -p "www/$(dirname "$f")"
  cp "$f" "www/$f"
done
cp js/native.js www/js/native.js

# No YouTube SDK in the app; native.js goes in ahead of the game's scripts.
sed -i '/youtube\.com\/game_api/d' www/index.html
sed -i 's#<script src="js/i18n.js"></script>#<script src="js/native.js"></script>\n<script src="js/i18n.js"></script>#' www/index.html

grep -q 'game_api' www/index.html && { echo "the Playables SDK is still in www/index.html"; exit 1; }
grep -q 'js/native.js' www/index.html || { echo "native.js was not added"; exit 1; }
echo "www/ built: $(find www -type f | wc -l) files, $(du -sh www | cut -f1)"
