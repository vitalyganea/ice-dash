#!/usr/bin/env bash
# Builds the Yandex Games copy of the game into yandex/game/ and the archive
# to upload, yandex/icedash-yandex.zip, from the same allowlist build.sh
# ships to YouTube Playables — so the two can never disagree about what the
# game is. Two differences, both because Yandex is not YouTube:
#   - the Playables SDK <script> is swapped for Yandex's own /sdk.js, which
#     Yandex serves next to every game it hosts.
#   - js/yandex.js is added ahead of the game's scripts: it answers the
#     Playables calls the game makes with their Yandex equivalents.
set -eu
cd "$(dirname "$0")"

FILES=$(sed -n '/^FILES="/,/^"/p' build.sh | sed '1d;$d')
OUT=yandex/game
ZIP=yandex/icedash-yandex.zip
rm -rf "$OUT"
for f in $FILES; do
  [ -f "$f" ] || { echo "missing: $f"; exit 1; }
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$f" "$OUT/$f"
done
cp js/yandex.js "$OUT/js/yandex.js"

sed -i 's#<!-- The Playables SDK MUST load before any game code (Integration req. 1). -->#<!-- The Yandex Games SDK, served by Yandex next to the game. -->#' "$OUT/index.html"
sed -i 's#<script src="https://www.youtube.com/game_api/v1"></script>#<script src="/sdk.js"></script>#' "$OUT/index.html"
sed -i 's#<script src="js/i18n.js"></script>#<script src="js/yandex.js"></script>\n<script src="js/i18n.js"></script>#' "$OUT/index.html"

grep -q 'game_api' "$OUT/index.html" && { echo "the Playables SDK is still in $OUT/index.html"; exit 1; }
grep -q '<script src="/sdk.js"></script>' "$OUT/index.html" || { echo "the Yandex SDK was not added"; exit 1; }
grep -q 'js/yandex.js' "$OUT/index.html" || { echo "yandex.js was not added"; exit 1; }
# Nothing may be fetched from outside the archive. Only the SVG namespace
# and the font's licence note (a comment) are allowed to name an address.
if grep -rnoE 'https?://[^"'"'"' )>]*' "$OUT" | grep -vE 'www\.w3\.org/2000/svg|scripts\.sil\.org/OFL'; then
  echo "an external address is in the package"; exit 1
fi

rm -f "$ZIP"
(cd "$OUT" && zip -q -X -r "../$(basename "$ZIP")" .)
unzip -l "$ZIP" | grep -q ' index.html$' || { echo "index.html is not at the root of the archive"; exit 1; }
echo "$ZIP  $(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files, $(du -h "$ZIP" | cut -f1)"
