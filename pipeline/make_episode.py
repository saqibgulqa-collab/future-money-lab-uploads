"""Future Money Lab episode builder.

Usage:
  python3 pipeline/make_episode.py episodes/E02/episode.json [stage ...]
Stages (default: all, in order): broll voice pace props render audio assemble thumbs meta
Every stage skips work that is already done, so a stopped run can be resumed.
Outputs go to $FML_WORK/<episode id>/ (default ~/fml-work/E02).
"""
import json, os, re, subprocess, sys, difflib, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.environ.get("FML_WORK", os.path.expanduser("~/fml-work"))
FPS, WPM = 30, 160
EP_PATH = os.path.abspath(sys.argv[1])
EP = json.load(open(EP_PATH))
OUT = os.path.join(WORK, EP["id"])
STAGES = sys.argv[2:] or ["broll", "voice", "pace", "props", "render", "audio", "assemble", "thumbs", "meta"]
os.makedirs(OUT, exist_ok=True)
norm = lambda s: re.sub(r"[^a-z0-9$]", "", s.lower())
sh = lambda *a, **k: subprocess.run(list(a), check=True, **k)
ff = lambda *a: sh("ffmpeg", "-y", "-loglevel", "error", *a)
dur_of = lambda p: float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]))
ids = [s["id"] for s in EP["scenes"]]
log = lambda *a: print("[fml]", *a, flush=True)


def stage_broll():
    need = sorted({b for s in EP["scenes"] for b in s["broll"]})
    for b in need:
        dst = f"{WORK}/broll/{b}.mp4"
        if os.path.exists(dst):
            continue
        raw = f"{WORK}/broll/raw_{b}.mp4"
        for r in ("1080", "720"):
            if subprocess.run(["curl", "-sSfL", "-A", "Mozilla/5.0", "-o", raw, f"https://assets.mixkit.co/videos/{b}/{b}-{r}.mp4"]).returncode == 0:
                break
        else:
            raise SystemExit(f"b-roll {b} could not be downloaded; pick another Mixkit id")
        ff("-i", raw, "-an", "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,eq=saturation=1.08:contrast=1.04",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-g", "15", "-pix_fmt", "yuv420p", dst + ".tmp.mp4")
        os.replace(dst + ".tmp.mp4", dst); os.remove(raw)
        log("broll", b)
    bd = {b: dur_of(f"{WORK}/broll/{b}.mp4") for b in need}
    json.dump(bd, open(f"{OUT}/broll_dur.json", "w"))


def stage_voice():
    sh(f"{WORK}/venv-cb/bin/python", f"{ROOT}/pipeline/tts_chatterbox.py", EP_PATH, f"{OUT}/audio")


def whisper_words(model, path, text):
    r = model.transcribe(path, language="en", fp16=False, word_timestamps=True)
    ww = [{"w": x["word"].strip(), "s": x["start"], "e": x["end"]} for seg in r["segments"] for x in seg["words"]]
    sw = text.split()
    sm = difflib.SequenceMatcher(a=[norm(x) for x in sw], b=[norm(x["w"]) for x in ww], autojunk=False)
    T = [None] * len(sw)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1): T[i1 + k] = (ww[j1 + k]["s"], ww[j1 + k]["e"])
        elif j2 > j1:
            a, b = ww[j1]["s"], ww[j2 - 1]["e"]; n = i2 - i1
            for k in range(n): T[i1 + k] = (a + (b - a) * k / n, a + (b - a) * (k + 1) / n)
    for i in range(len(T)):
        if T[i] is None: T[i] = (T[i - 1][1], T[i - 1][1] + 0.2) if i else (0.3, 0.5)
    return [{"w": w, "s": round(a, 2), "e": round(b, 2)} for w, (a, b) in zip(sw, T)], r["text"]


def stretch(src, dst, tempo):
    ff("-i", src, "-af", f"rubberband=tempo={tempo:.3f}:transients=mixed:detector=soft:formant=preserved:pitchq=quality:window=standard", dst)


def stage_pace():
    """Bring every scene to ~160 words/minute without changing pitch, then time every word."""
    import whisper, soundfile as sf
    model = whisper.load_model("base")
    os.makedirs(f"{OUT}/audio_n", exist_ok=True)
    timing = {}
    for s in EP["scenes"]:
        raw = f"{OUT}/audio/{s['id']}.wav"; dst = f"{OUT}/audio_n/{s['id']}.wav"
        words, _ = whisper_words(model, raw, s["text"])
        wpm = len(words) / max(1, words[-1]["e"] - words[0]["s"]) * 60
        tempo = max(0.72, min(1.0, WPM / wpm))
        stretch(raw, dst, tempo)
        words, heard = whisper_words(model, dst, s["text"])
        d = sf.info(dst).duration
        timing[s["id"]] = {"dur": round(d, 2), "split": round(s.get("split", d / 2), 2), "words": words}
        log("pace", s["id"], f"{round(wpm)}wpm -> tempo {tempo:.2f}", "|", heard.strip()[:70])
    json.dump(timing, open(f"{OUT}/timing.json", "w"))


def stage_props():
    t = json.load(open(f"{OUT}/timing.json")); bd = json.load(open(f"{OUT}/broll_dur.json"))
    os.makedirs(f"{OUT}/props", exist_ok=True)
    for s in EP["scenes"]:
        json.dump({"scene": s, "timing": t[s["id"]], "brollDur": bd}, open(f"{OUT}/props/{s['id']}.json", "w"))


def stage_render(only=None):
    os.makedirs(f"{OUT}/scenes", exist_ok=True)
    rdir = f"{ROOT}/pipeline/remotion"
    for sid in (only or ids):
        dst = f"{OUT}/scenes/{sid}.mp4"
        if os.path.exists(dst):
            continue
        for attempt in (1, 2):
            r = subprocess.run(["npx", "remotion", "render", "src/index.ts", "Scene", dst + ".tmp.mp4", f"--props={OUT}/props/{sid}.json",
                                "--codec=h264", "--crf=18", "--muted", "--concurrency=2", "--offthreadvideo-cache-size-in-bytes=400000000",
                                "--offthreadvideo-video-threads=1", "--log=error"], cwd=rdir)
            if r.returncode == 0:
                os.replace(dst + ".tmp.mp4", dst); log("render", sid); break
            log("render retry", sid)
        else:
            raise SystemExit(f"render failed for {sid}")


def stage_stills():
    """Preview: last-second frame of every scene (everything on screen) -> stills_sheet.png. Look at it before rendering."""
    t = json.load(open(f"{OUT}/timing.json"))
    for sid in ids:
        sh("npx", "remotion", "still", "src/index.ts", "Scene", f"{OUT}/still_{sid}.png", f"--props={OUT}/props/{sid}.json",
           f"--frame={max(0, int(t[sid]['dur'] * FPS) - 30)}", "--log=error", "--scale=0.5", cwd=f"{ROOT}/pipeline/remotion")
    from PIL import Image
    cols = 3; rows = (len(ids) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 640, rows * 360))
    for j, sid in enumerate(ids):
        sheet.paste(Image.open(f"{OUT}/still_{sid}.png").resize((640, 360)), ((j % cols) * 640, (j // cols) * 360))
    sheet.save(f"{OUT}/stills_sheet.png")
    log("stills", f"{OUT}/stills_sheet.png")


def ats(scene):
    """every (key, nth) that triggers something on screen"""
    out = []
    for field in ("items", "chips", "cards", "bars"):
        for it in scene.get(field, []) or []:
            if it.get("at"): out.append((it["at"], it.get("nth", 0)))
    for field in ("footer", "big", "saving"):
        it = scene.get(field)
        if isinstance(it, dict) and it.get("at"): out.append((it["at"], it.get("nth", 0)))
    return out


def word_at(words, key, nth=0):
    k0, k = norm(key), 0
    for w in words:
        if norm(w["w"]).startswith(k0):
            if k == nth: return w["s"]
            k += 1
    return None


def stage_audio():
    t = json.load(open(f"{OUT}/timing.json")); S = f"{WORK}/sfx/"
    POP, WHOOSH = S + "sfx_2357.mp3", S + "sfx_1491.mp3"
    ev, parts, cur = [], [], 0.0
    for i, s in enumerate(EP["scenes"]):
        d = t[s["id"]]; dur = round(d["dur"] * FPS) / FPS; split = round(d["split"] * FPS) / FPS
        if i: ev.append((cur - 0.25, WHOOSH, 0.5))
        ev.append((cur + split - 0.2, WHOOSH, 0.22))
        for key, nth in ats(s):
            x = word_at(d["words"], key, nth)
            if x is not None: ev.append((cur + x, POP, 0.38))
        if s["kind"] in ("verdict", "hero"): ev.append((cur + 0.05, POP, 0.6))
        if s["kind"] == "stamp":
            x = word_at(d["words"], s.get("stampAt", ""), 0)
            if x is not None: ev.append((cur + x, POP, 0.7))
        if s["kind"] == "outro":
            x = word_at(d["words"], "subscribe") or dur * 0.6
            ev.append((cur + round(x * FPS) / FPS + 24 / FPS, POP, 0.6))
        parts.append((s["id"], dur)); cur += dur
    total = cur
    with open(f"{OUT}/voice_list.txt", "w") as f:
        for sid, dur in parts:
            ff("-i", f"{OUT}/audio_n/{sid}.wav", "-af", f"apad,atrim=0:{dur}", "-ar", "48000", "-ac", "1", f"{OUT}/audio_n/{sid}_fit.wav")
            f.write(f"file '{OUT}/audio_n/{sid}_fit.wav'\n")
    ff("-f", "concat", "-safe", "0", "-i", f"{OUT}/voice_list.txt", f"{OUT}/voice_full.wav")
    music = S + EP.get("music", "music_759.mp3")
    inputs = ["-i", f"{OUT}/voice_full.wav", "-stream_loop", "-1", "-i", music]
    for _, f_, _ in ev: inputs += ["-i", f_]
    fc = ["[0]aformat=channel_layouts=stereo,highpass=f=70,acompressor=threshold=0.1:ratio=3:attack=5:release=80,asplit=2[v][sc]",
          f"[1]atrim=0:{total},afade=t=in:d=1.5,afade=t=out:st={total-4}:d=4,volume=0.2[m]",
          "[m][sc]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=350[md]"]
    labels = ["[v]", "[md]"]
    for k, (ts, _, vol) in enumerate(ev):
        ms = max(0, int(ts * 1000)); fc.append(f"[{k+2}]aformat=channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[e{k}]"); labels.append(f"[e{k}]")
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=11[out]")
    ff(*inputs, "-filter_complex", ";".join(fc), "-map", "[out]", "-ar", "48000", f"{OUT}/mix.wav")
    log("audio", round(total, 1), "s,", len(ev), "sfx")


def stage_assemble():
    with open(f"{OUT}/scene_list.txt", "w") as f:
        for sid in ids: f.write(f"file '{OUT}/scenes/{sid}.mp4'\n")
    ff("-f", "concat", "-safe", "0", "-i", f"{OUT}/scene_list.txt", "-c", "copy", f"{OUT}/video_only.mp4")
    master = f"{OUT}/{EP['id']}_master.mp4"
    ff("-i", f"{OUT}/video_only.mp4", "-i", f"{OUT}/mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", master)
    # upload copy under GitHub's 100 MB file limit
    d = dur_of(master); vk = int(min(6000, (92 * 8 * 1024) / d - 128))
    up = f"{OUT}/{EP['id']}_upload.mp4"
    if os.path.getsize(master) < 95e6:
        shutil.copy(master, up)
    else:
        ff("-i", master, "-c:v", "libx264", "-preset", "medium", "-b:v", f"{vk}k", "-pass", "1", "-passlogfile", f"{OUT}/x264", "-an", "-f", "null", "/dev/null")
        ff("-i", master, "-c:v", "libx264", "-preset", "medium", "-b:v", f"{vk}k", "-pass", "2", "-passlogfile", f"{OUT}/x264", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", up)
    ff("-i", master, "-vf", "select='not(mod(n\\,1800))',scale=480:-1,tile=4x3", "-frames:v", "1", "-fps_mode", "vfr", f"{OUT}/contact_sheet.png")
    log("assemble", master, round(d, 1), "s; upload", round(os.path.getsize(up) / 1e6, 1), "MB")


def stage_thumbs():
    sh("python3", f"{ROOT}/pipeline/thumbnail.py", EP_PATH, OUT)


def stage_meta():
    t = json.load(open(f"{OUT}/timing.json")); y = EP["youtube"]
    cur, ch = 0.0, []
    for s in EP["scenes"]:
        m, sec = divmod(int(cur), 60); ch.append(f"{m:02d}:{sec:02d} {s.get('chapterTitle', s.get('chapter', s['id'])).strip()}")
        cur += round(t[s["id"]]["dur"] * FPS) / FPS
    desc = y["summary"].strip() + "\n\nChapters\n" + "\n".join(ch)
    if y.get("details"): desc += "\n\n" + y["details"].strip()
    if y.get("sources"): desc += "\n\nSources\n" + "\n".join(f"- {s['name']}: {s['url']}" for s in y["sources"])
    desc += ("\n\nVoiceover: AI-generated narration. Script researched and written for Future Money Lab.\nMusic and stock footage: Mixkit (mixkit.co)."
             "\n\nSubscribe for AI tools and smart money, tested and explained: https://www.youtube.com/@TheFutureMoneyLabAI?sub_confirmation=1"
             "\n\nDisclaimer: This video is for education only and is not financial advice. Some links may be affiliate links; we may earn a small commission at no extra cost to you."
             "\n\n" + " ".join(y.get("hashtags", ["#AItools", "#productivity", "#personalfinance"])))
    open(f"{OUT}/youtube_description.txt", "w").write(desc)
    json.dump({"title": y["title"], "tags": y["tags"], "category": y.get("category", "SCIENCE_TECHNOLOGY"), "description": desc},
              open(f"{OUT}/youtube_meta.json", "w"), indent=1)
    log("meta", len(desc), "chars;", len(ch), "chapters")


if __name__ == "__main__":
    for st in STAGES:
        log("== stage", st)
        globals()[f"stage_{st}"]()
    log("DONE", OUT)
