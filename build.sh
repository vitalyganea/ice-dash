#!/usr/bin/env bash
# Builds icedash.zip from an explicit list of the files the game actually
# needs. An allowlist rather than a set of excludes, because the last
# package was built the other way round and shipped README.md and
# PLAYABLES.md inside it while the README said it did not.
set -eu
cd "$(dirname "$0")"

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
js/game.js
js/ui.js
img/logo.png
img/logo.webp
"

for f in $FILES; do
  [ -f "$f" ] || { echo "missing: $f"; exit 1; }
done

rm -f icedash.zip
zip -q -X icedash.zip $FILES
echo "icedash.zip  $(unzip -l icedash.zip | tail -1 | awk '{print $2}') files, $(du -h icedash.zip | cut -f1)"

# And say out loud what is NOT in it, so the claim is checked rather than made.
for f in README.md PLAYABLES.md GAME_SPEC.md SYSTEMS.md PLAYTEST.md unlock.html build.sh; do
  if unzip -l icedash.zip | grep -q " $f\$"; then echo "LEAKED: $f"; exit 1; fi
done
if unzip -l icedash.zip | grep -q "test/"; then echo "LEAKED: test/"; exit 1; fi
echo "no testing page, no planning doc and no test suite in the package"
