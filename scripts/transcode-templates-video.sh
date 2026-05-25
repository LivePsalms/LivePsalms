#!/usr/bin/env bash
set -euo pipefail

SRC="reference/notepad_template_video/renders/notepad-cinema.mp4"
OUT_DIR="public/notepad-landing"
mkdir -p "$OUT_DIR"

# MP4 (H.264) — universal
ffmpeg -y -i "$SRC" \
  -vf "format=yuv420p" \
  -c:v libx264 -preset slow -crf 30 -movflags +faststart \
  -an \
  "$OUT_DIR/templates.mp4"

# WebM (VP9) — smaller for modern browsers
ffmpeg -y -i "$SRC" \
  -c:v libvpx-vp9 -b:v 0 -crf 50 -row-mt 1 \
  -an \
  "$OUT_DIR/templates.webm"

# Poster JPEG — frame at 9.0s (mid-clip, inside a steady frame, not a crossfade)
ffmpeg -y -ss 9.0 -i "$SRC" \
  -frames:v 1 \
  -q:v 12 \
  "$OUT_DIR/templates-poster.jpg"

echo "Done. Sizes:"
du -h "$OUT_DIR"/templates.mp4 "$OUT_DIR"/templates.webm "$OUT_DIR"/templates-poster.jpg
