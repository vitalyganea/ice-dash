#!/usr/bin/env bash
# Builds www/, the web part of the Android app and of the iPhone app (both
# copy it in: npx cap sync android / ios), from the allowlist below, with
# js/native.js added: the Android back button, haptics through the native
# plugin, the system bars hidden, ads and the board (Play Games on Android,
# Game Center on the iPhone), crash reports and the shared board.
set -eu
cd "$(dirname "$0")"

# The files the game is made of: an allowlist, so nothing else (docs,
# tests, test pages) ever ships. A new runtime file goes here, or it is not
# in the apps. (It lived in build.sh with the Playables package until
# 24 Nov 2026, when the web portals were dropped.)
FILES="
index.html
css/font.css
css/style.css
js/i18n.js
js/audio.js
js/biomes.js
js/skins.js
js/courses.js
js/achievements.js
js/album.js
js/comic.js
js/game.js
js/portraits.js
js/events.js
js/ui.js
img/logo.png
img/logo.webp
img/event-ny-h.webp
img/event-ny-v.webp
"
rm -rf www
for f in $FILES; do
  [ -f "$f" ] || { echo "missing: $f"; exit 1; }
  mkdir -p "www/$(dirname "$f")"
  cp "$f" "www/$f"
done
cp js/native.js www/js/native.js

# No YouTube SDK in the app; native.js goes in ahead of the game's scripts.
# (perl, not sed -i: the iPhone app is built on a Mac, whose sed reads -i
# differently from Linux's)
perl -i -pe 's#<script src="js/i18n.js"></script>#<script src="js/native.js"></script>\n<script src="js/i18n.js"></script>#' www/index.html

grep -q 'game_api' www/index.html && { echo "the Playables SDK is still in www/index.html"; exit 1; }
grep -q 'js/native.js' www/index.html || { echo "native.js was not added"; exit 1; }
echo "www/ built: $(find www -type f | wc -l) files, $(du -sh www | cut -f1)"
