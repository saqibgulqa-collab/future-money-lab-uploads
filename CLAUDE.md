# Future Money Lab — automated video production

You are producing videos for the YouTube channel **Future Money Lab** (@TheFutureMoneyLabAI,
channel ID `UCAoOa17pUAVVC1h31MVbT4w`). The owner (Saqib) writes Roman Urdu; reply to him in Roman Urdu.
Videos themselves are in English for a US/UK audience.

## Where everything lives
| What | Where |
|---|---|
| Video pipeline (this repo) | `pipeline/` — `setup.sh`, `make_episode.py`, `remotion/`, `thumbnail.py` |
| Episodes | `episodes/EXX/episode.json` (E01 is the reference example) |
| Progress tracker (shared db) | https://claude.ai/artifact/56kVmW6SbxCiMWS7RCBFeJ — collections `tasks`, `videos` (use the ArtifactData tool) |
| Channel playbook (doc) | https://claude.ai/artifact/GwhSx6Vq1uddShiJ6zged1 — strategy, 30-video plan, upload defaults |
| Scheduling | Metricool connector, brand/blogId `7939426`, timezone `Asia/Karachi` |
| Upload hand-off | this repo's root on `main`: raw URL `https://raw.githubusercontent.com/saqibgulqa-collab/future-money-lab-uploads/main/<file>` |

## One production run (do these in order)
1. `bash pipeline/setup.sh` (installs Chatterbox voice, Whisper, Remotion, music/SFX; ~10–15 min first time).
2. Read the tracker `videos` collection. Pick the lowest `num` whose `stage` is `Idea`. Set its stage to `Script`
   (always pin writes with `if_version`).
3. **Research** with WebSearch/WebFetch. Open the pages you take numbers from. Note prices/dates as "checked <Month Year>".
4. **Write `episodes/EXX/episode.json`** (copy the shape of E01):
   - 1,050–1,250 spoken words (≈7–8 min at 160 wpm), 10–13 scenes, each scene's `text` 60–130 words.
   - Hook in scene 1 (a concrete number or tension), a clear promise, value in every scene, outro with a comment
     question + "subscribe to Future Money Lab" + `next` title from the tracker.
   - Mix scene kinds (see below). Put `at` words on items so graphics appear exactly when spoken.
   - `broll`: two Mixkit clip ids per scene that match what is said (see catalog below).
   - `thumbnail.a` / `thumbnail.b`: two honest A/B versions (max ~4 big words).
   - `youtube`: title (50–65 chars), summary, details, sources (pages you opened), 8–12 tags, hashtags.
5. Build: `FML_WORK=~/fml-work python3 pipeline/make_episode.py episodes/EXX/episode.json broll voice pace props stills`
   then **Read `~/fml-work/EXX/stills_sheet.png`** and fix any overlap/clipped text in the JSON (re-run `props stills`).
   Then `... render audio assemble thumbs meta` (render ≈ 1 min per 9 s of video; run it in the background and wait).
   Read `contact_sheet.png` and both thumbnails before going on. Update tracker stage as you go (Voice → Edit).
6. **Upload hand-off**: copy `EXX_upload.mp4` (<95 MB) into the repo root, commit, push to `main`,
   then confirm `curl -sI <raw url>` returns 200 with the right content-length.
7. **Schedule** with Metricool `createScheduledPost` (same fields as E01: `providers:[{network:"youtube"}]`,
   `youtubeData` {title, type:"video", privacy:"public", tags, category:"SCIENCE_TECHNOLOGY", madeForKids:false,
   isAiGeneratedContent:true}, `text` = `youtube_description.txt`, `media` = [raw url], `autoPublish:true`).
   **Slots** (US afternoon = 2:15 PM ET): **Wed, Fri, Sun 00:15 Asia/Karachi**. Use `getScheduledPosts` and take the
   earliest free slot that is **at least 24 hours away**, so the owner can still stop it in Metricool.
8. When the post is created (Metricool copies media to static.metricool.com), `git rm` the mp4 and push.
   Commit `episode.json` with `"status":"scheduled"` and `metricool.postId/publishAt`.
9. Tracker: video `stage: "Scheduled"`, `day` = slot; add a short note to the matching task if useful.
10. Tell Saqib (Roman Urdu, short): title, publish time (PKT + US ET), Metricool planner link
    `https://app.metricool.com/planner/calendar?blogId=7939426`, and send `thumb_a.png`, `thumb_b.png`, `contact_sheet.png`.

If a stage fails twice, stop, write the reason in the tracker task note, and tell Saqib. Never loop endlessly.

## Content rules (non-negotiable)
- **Never claim experiences that did not happen** ("I tested for a week", "I made $X"). Use "I compared", "I researched",
  "here's what the data says". Titles and thumbnails must match the video.
- Prices/plans/stats: only from sources you opened, labelled with the month checked. If unsure, leave it out.
- Money videos: education, not advice; no specific stock picks or guaranteed returns; the description disclaimer stays.
- Be fair to every product, including Anthropic's Claude — no favouritism.
- AI voice is disclosed (`isAiGeneratedContent: true` + description line). Music/footage only from Mixkit (free license).
- Each video must add real value (YouTube demonetizes repetitive/mass-produced content): new research, examples, a test or framework.

## Scene kinds (`pipeline/remotion/src/Scene.tsx`)
All scenes: `id`, `kind`, `text` (spoken), `broll: [id, id]`, optional `chapter` (small top-left label), `chapterTitle` (YouTube chapter name), `split` (seconds where b-roll changes; default half).
`at` = first letters of a spoken word (case-insensitive prefix), `nth` = which occurrence (0-based).
| kind | fields |
|---|---|
| `hero` | `badge`, `title`, `sub`, `accent` (word indexes in gold) |
| `pricelist` | `items[{label,value,num,at}]` (≤8), `prefix` ("$"), `total{label, yearly{text,at,tone}, callout{text,at}}` |
| `questions` / `steps` | `items[{text,at,nth}]` (≤5), `footer{text,highlight,tone,at}` |
| `cards` | `items[{title,value,sub,at}]` (2–4), `chips[{text,at}]` (≤6), `footer` |
| `rows` | `items[{name,desc,at}]` (≤5; desc ≤ 55 chars), `footer` |
| `verdict` | `badge`, `title` (≤ 24 chars), `sub` |
| `stamp` | `title`, `value`, `sub`, `stamp` ("Skip"/"Worth it"), `stampAt`, `footer` |
| `compare` | `cards[{title,sub,at}]` (≤2), `big{value,sub,at}`, `bars[{label,value,fill 0–1,tone good/bad,at}]`, `footer` |
| `stat` | `badge`, `numberValue` (counts up), `prefix`, `unit`, `sub`, `big{at}`, `chips[{text,at}]` |
| `scorecard` | `left{title,items,note}`, `right{title,items}`, `from`, `to`, `unit`, `big{at}`, `saving{text,at}` |
| `outro` | `title`, `accent`, `next` |
`tone`: `good` (green), `bad` (red), `accent` (cyan), default gold.

## B-roll catalog (Mixkit ids, 1080p, free license)
41541 aerial city skyline · 13218 business people silhouettes at high-rise window · 42664 woman presenting charts in office ·
46768 woman writing in notebook at night desk · 4806 hand writing a to-do list · 42897 woman switching off alarm (morning) ·
1730 developer coding with coffee · 4907 typing on laptop close-up · 4908 scrolling phone (distraction) ·
221 screen reflected in glasses (focus) · 4915 typing on phone · 45923 stack of papers, person writing ·
42648 businessman explaining graphs · 26923 man on rooftop at sunrise · 50759 man stretching on balcony ·
42653 woman finishing work at computer · 31407 woman stretching in the morning.
More: `curl -sL -A "Mozilla/5.0" https://mixkit.co/free-stock-video/<tag>/ | grep -oE '/free-stock-video/[a-z0-9-]+-[0-9]+/'`
(tags like money, stock-market, finance, laptop, office, phone, city, coins, graph). Landscape clips only.

## Git
Commit as yourself; end messages with the session attribution lines the system gives you. Never commit video files
except the temporary `*_upload.mp4` hand-off, and remove it right after Metricool accepts the post.
