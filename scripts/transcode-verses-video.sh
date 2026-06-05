#!/usr/bin/env bash
set -euo pipefail

SRC="reference/verses_video.mov"
OUT_DIR="public/notepad-landing"
mkdir -p "$OUT_DIR"

# MP4 (H.264) — universal
ffmpeg -y -i "$SRC" \
  -vf "scale=1080:1080,format=yuv420p" \
  -c:v libx264 -preset slow -crf 28 -movflags +faststart \
  -an \
  "$OUT_DIR/verses.mp4"

# WebM (VP9) — smaller for modern browsers
ffmpeg -y -i "$SRC" \
  -vf "scale=1080:1080" \
  -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 \
  -an \
  "$OUT_DIR/verses.webm"

# Poster JPEG
ffmpeg -y -ss 5 -i "$SRC" \
  -frames:v 1 \
  -vf "scale=1080:1080" \
  -q:v 4 \
  "$OUT_DIR/verses-poster.jpg"

echo "Done. Sizes:"
du -h "$OUT_DIR"/verses.mp4 "$OUT_DIR"/verses.webm "$OUT_DIR"/verses-poster.jpg
