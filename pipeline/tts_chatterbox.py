"""Generate one WAV per scene with Chatterbox (run inside the chatterbox venv).
Usage: venv-cb/bin/python tts_chatterbox.py episode.json out_dir [scene_id ...]
Sentences are voiced in short chunks with natural pauses; speed is fixed later."""
import json, os, re, sys
import torch, torchaudio
from chatterbox.tts import ChatterboxTTS

ep = json.load(open(sys.argv[1]))
out = sys.argv[2]
only = set(sys.argv[3:])
os.makedirs(out, exist_ok=True)
torch.set_num_threads(os.cpu_count() or 2)
torch.manual_seed(7)
m = ChatterboxTTS.from_pretrained(device="cpu")
sr = m.sr
sil = lambda s: torch.zeros(1, int(sr * s))
for sc in ep["scenes"]:
    if only and sc["id"] not in only:
        continue
    path = f"{out}/{sc['id']}.wav"
    if os.path.exists(path):
        print("skip", sc["id"], flush=True)
        continue
    sents = re.split(r"(?<=[.?!])\s+", sc["text"].strip())
    chunks, cur = [], ""
    for s in sents:
        if cur and len(cur) + len(s) > 90:
            chunks.append(cur); cur = s
        else:
            cur = (cur + " " + s).strip()
    chunks.append(cur)
    parts = [sil(0.3)]
    for c in chunks:
        parts += [m.generate(c, exaggeration=0.5, cfg_weight=0.3, temperature=0.75), sil(0.45)]
    parts.append(sil(0.4))
    torchaudio.save(path + ".tmp.wav", torch.cat(parts, dim=1), sr)
    os.replace(path + ".tmp.wav", path)
    print("done", sc["id"], flush=True)
