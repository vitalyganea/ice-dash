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

# The developer portal takes no archive and no folders (13 Nov 2026: "Archive
# files are not supported"): every file at the top level of one upload, the
# paths in index.html and style.css made to match. crazygames/upload/ is that.
UP=crazygames/upload
rm -rf "$UP"; mkdir -p "$UP"
for f in $(cd "$OUT" && find . -type f); do
  b=$(basename "$f")
  [ -e "$UP/$b" ] && { echo "two files named $b: the flat upload cannot hold both"; exit 1; }
  cp "$OUT/$f" "$UP/$b"
done
sed -i -E 's#(src|href|srcset)="(css|js|img)/#\1="#g' "$UP/index.html"
sed -i 's#\.\./img/##g' "$UP/style.css"
grep -nE '(src|href|srcset)="(css|js|img)/' "$UP/index.html" && { echo "a folder path is left in $UP/index.html"; exit 1; }
for x in $(grep -oE '(src|href|srcset)="[^"]+"' "$UP/index.html" | grep -v 'https://' | sed -E 's/^[a-z]+="//; s/"$//'); do
  [ -f "$UP/$x" ] || { echo "$UP/index.html names $x, which is not in the upload"; exit 1; }
done

rm -f "$ZIP"
(cd "$OUT" && zip -q -X -r "../$(basename "$ZIP")" .)
unzip -l "$ZIP" | grep -q ' index.html$' || { echo "index.html is not at the root of the archive"; exit 1; }
echo "$ZIP  $(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files, $(du -h "$ZIP" | cut -f1)"
echo "$UP/  $(ls "$UP" | wc -l) files at the top level, for the developer portal's upload"
