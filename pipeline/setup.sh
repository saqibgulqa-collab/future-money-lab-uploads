#!/usr/bin/env bash
# One-time setup for a fresh cloud session. Safe to re-run (skips what exists).
# Usage: bash pipeline/setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${FML_WORK:-$HOME/fml-work}"
mkdir -p "$WORK"/{broll,sfx,models}

echo "== system packages"
command -v ffmpeg >/dev/null || (apt-get update -q && apt-get install -y -q ffmpeg)
ffmpeg -hide_banner -filters 2>/dev/null | grep -q rubberband || apt-get install -y -q ffmpeg

echo "== python: whisper (timing)"
python3 -c "import whisper" 2>/dev/null || {
  pip install --break-system-packages -q torch --index-url https://download.pytorch.org/whl/cpu
  pip install --break-system-packages -q openai-whisper soundfile
}

echo "== python venv: chatterbox (voice)"
if [ ! -x "$WORK/venv-cb/bin/python" ] || ! "$WORK/venv-cb/bin/python" -c "import chatterbox" 2>/dev/null; then
  python3 -m venv "$WORK/venv-cb"
  "$WORK/venv-cb/bin/pip" install -q --upgrade pip
  "$WORK/venv-cb/bin/pip" install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
  "$WORK/venv-cb/bin/pip" install -q chatterbox-tts
fi

echo "== remotion"
cd "$ROOT/pipeline/remotion"
[ -d node_modules/remotion ] || npm install --silent
mkdir -p public
cp -f "$ROOT"/pipeline/assets/space-grotesk-latin-*.woff2 public/
ln -sfn "$WORK/broll" public/broll

echo "== music + sound effects (Mixkit free license)"
dl() { [ -s "$2" ] || curl -sSfL -A "Mozilla/5.0" -o "$2" "$1"; }
dl https://assets.mixkit.co/music/759/759.mp3 "$WORK/sfx/music_759.mp3"
dl https://assets.mixkit.co/music/744/744.mp3 "$WORK/sfx/music_744.mp3"
for id in 1491 2357 2356; do dl "https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3" "$WORK/sfx/sfx_$id.mp3"; done

echo "== warm up chatterbox model download"
"$WORK/venv-cb/bin/python" -c "from chatterbox.tts import ChatterboxTTS; ChatterboxTTS.from_pretrained(device='cpu')" >/dev/null 2>&1 || true
echo "SETUP OK  (work dir: $WORK)"
