#!/usr/bin/env bash
# Builds the CrazyGames copy of the game into crazygames/game/ and the
# archive to upload, crazygames/icedash-crazygames.zip, from the same
# allowlist build.sh ships to YouTube Playables — so the copies can never
# disagree about what the game is. Two differences:
#   - the Playables SDK <script> is swapped for the CrazyGames SDK v3.
#   - js/crazygames.js is added ahead of the game's scripts: it answers the
#     Playables calls the game makes with their CrazyGames equivalents.
set -eu
cd "$(dirname "$0")"

FILES=$(sed -n '/^FILES="/,/^"/p' build.sh | sed '1d;$d')
OUT=crazygames/game
ZIP=crazygames/icedash-crazygames.zip
SDK='https://sdk.crazygames.com/crazygames-sdk-v3.js'
rm -rf "$OUT"
for f in $FILES; do
  [ -f "$f" ] || { echo "missing: $f"; exit 1; }
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$f" "$OUT/$f"
done
cp js/crazygames.js "$OUT/js/crazygames.js"

sed -i 's#<!-- The Playables SDK MUST load before any game code (Integration req. 1). -->#<!-- The CrazyGames SDK v3, before any game code. -->#' "$OUT/index.html"
sed -i "s#<script src=\"https://www.youtube.com/game_api/v1\"></script>#<script src=\"$SDK\"></script>#" "$OUT/index.html"
sed -i 's#<script src="js/i18n.js"></script>#<script src="js/crazygames.js"></script>\n<script src="js/i18n.js"></script>#' "$OUT/index.html"

grep -q 'game_api' "$OUT/index.html" && { echo "the Playables SDK is still in $OUT/index.html"; exit 1; }
grep -q "<script src=\"$SDK\"></script>" "$OUT/index.html" || { echo "the CrazyGames SDK was not added"; exit 1; }
grep -q 'js/crazygames.js' "$OUT/index.html" || { echo "crazygames.js was not added"; exit 1; }
# Nothing may be fetched from outside the archive but the SDK. Only the SVG
# namespace and the font's licence note (a comment) may name an address.
if grep -rnoE 'https?://[^"'"'"' )>]*' "$OUT" | grep -vE 'www\.w3\.org/2000/svg|scripts\.sil\.org/OFL|sdk\.crazygames\.com/crazygames-sdk-v3\.js'; then
  echo "an external address is in the package"; exit 1
fi
# CrazyGames only loads relative paths.
if grep -nE '(src|href)="/' "$OUT/index.html"; then echo "an absolute path is in index.html"; exit 1; fi

rm -f "$ZIP"
(cd "$OUT" && zip -q -X -r "../$(basename "$ZIP")" .)
unzip -l "$ZIP" | grep -q ' index.html$' || { echo "index.html is not at the root of the archive"; exit 1; }
echo "$ZIP  $(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files, $(du -h "$ZIP" | cut -f1)"
