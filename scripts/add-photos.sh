#!/usr/bin/env bash
# Add curated workshop photos to a cohort's gallery.
#
#   scripts/add-photos.sh <cohort-id> <folder-of-photos> [--replace]
#
# e.g. scripts/add-photos.sh pretoria-cohort ~/Downloads/pretoria-picks
#
# Every JPG/PNG/HEIC/WebP in the folder is auto-rotated, resized to at most
# 1600px on the long edge, stripped of metadata (GPS location, camera
# details) and saved as WebP in assets/gallery/<cohort-id>/ as 01.webp,
# 02.webp, ... New photos are numbered after any that are already there;
# --replace clears the cohort's folder first.
#
# Order: if the folder has an order.txt (one file name per line; blank lines
# and lines starting with # are ignored), photos follow that order and any
# not listed go after, in file-name order. Otherwise file-name order is used.
# Subfolders (e.g. _excluded/) are ignored, so move a photo there to drop it.
# The first photo is shown large on the Gallery, and the last one stretches
# to fill the final row, so a strong group photo works well in both places.
#
# Aim for 15-20 photos per cohort. The Gallery page builds small previews
# automatically, so only these files need to be committed.
#
# Needs ImageMagick 7 (brew install imagemagick).

set -euo pipefail

MAX_EDGE=1600
QUALITY=80
TARGET_MAX=20

usage() { sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

[[ $# -lt 2 ]] && usage
cohort="$1"; src="$2"; replace="${3:-}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cohorts_file="$root/data/cohorts.yaml"
dest="$root/assets/gallery/$cohort"

command -v magick >/dev/null || { echo "ImageMagick 7 not found. Install it with: brew install imagemagick" >&2; exit 1; }
[[ -d "$src" ]] || { echo "Not a folder: $src" >&2; exit 1; }
if ! grep -qE "^  - id: ${cohort}\$" "$cohorts_file"; then
  echo "Unknown cohort id: $cohort" >&2
  echo "Known ids:" >&2
  sed -nE 's/^  - id: (.*)$/  \1/p' "$cohorts_file" >&2
  exit 1
fi

mkdir -p "$dest"
if [[ "$replace" == "--replace" ]]; then
  rm -f "$dest"/*.webp
fi

# Continue numbering after the highest existing NN.webp.
n=0
for f in "$dest"/[0-9][0-9].webp; do
  [[ -e "$f" ]] || continue
  num=$((10#$(basename "$f" .webp)))
  (( num > n )) && n=$num
done

# Build the list of photos: order.txt first (if present), then the rest.
all_photos="$(find "$src" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' -o -iname '*.webp' \) -exec basename {} \; | sort)"
ordered=""
if [[ -f "$src/order.txt" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ -f "$src/$line" ]]; then
      ordered+="$line"$'\n'
    else
      echo "Warning: order.txt lists '$line', which is not in $src" >&2
    fi
  done < "$src/order.txt"
fi
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  grep -qxF -- "$name" <<< "$ordered" || ordered+="$name"$'\n'
done <<< "$all_photos"

added=0
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  f="$src/$name"
  n=$((n + 1))
  out="$dest/$(printf '%02d' "$n").webp"
  magick "$f" -auto-orient -resize "${MAX_EDGE}x${MAX_EDGE}>" -strip -quality "$QUALITY" "$out"
  printf '  %s -> %s (%s)\n' "$name" "${out#$root/}" "$(du -h "$out" | cut -f1 | tr -d ' ')"
  added=$((added + 1))
done <<< "$ordered"

total=$(find "$dest" -maxdepth 1 -name '*.webp' | wc -l | tr -d ' ')
echo "Added $added photo(s) to $cohort. The cohort now has $total photo(s), $(du -sh "$dest" | cut -f1 | tr -d ' ') in total."
if (( total > TARGET_MAX )); then
  echo "Note: that is more than $TARGET_MAX. Consider removing some from ${dest#$root/} to keep the gallery curated."
fi
