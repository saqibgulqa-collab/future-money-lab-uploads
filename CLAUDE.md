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
| Video Library (all channels) | https://claude.ai/artifact/HJc4Sp1hqt41eFjvrEUqjz — collections `channels`, `videos` (ArtifactData) |
| Channel playbook (doc) | https://claude.ai/artifact/GwhSx6Vq1uddShiJ6zged1 — strategy, 30-video plan, upload defaults |
| Scheduling | Metricool connector, brand/blogId `7939426`, timezone `Asia/Karachi` |
| Upload hand-off | this repo's root on `main`: raw URL `https://raw.githubusercontent.com/saqibgulqa-collab/future-money-lab-uploads/main/<file>` |

## Publishing plan (owner's standing order, Nov 2026 — keep going until Saqib says stop)
- `plan/mix.json` holds `perDay` (long videos per day), `stockTarget` and the niche mix. Read it every run.
- **Phase 1 (now): `perDay: 1`, `stockTarget: 60`.** One long video a day at **00:15 PKT** (= 2:15 PM ET). Owner's order:
  keep building stock as far as usage allows, not just to 20 (Nov 2026).
- **Phase 2:** the 9 AM report switches to `perDay: 2` the first time 20 or more long videos are
  scheduled. Then the long slots are **00:15 and 05:15 PKT** (= 2:15 PM and 7:15 PM ET).
- **3 Shorts per long video.** Short slots (PKT): phase 1 → 02:45, 06:45, 21:15 (= 4:45 PM, 8:45 PM, 11:15 AM ET);
  phase 2 → 19:15, 21:15, 23:15, 02:45, 06:45, 08:15. A Short always goes out **after** its own long video:
  take the earliest free Short slots after it.
- When the US switches to daylight time (2nd Sunday of March) move every slot 1 hour earlier; back in November.
- **Niche mix:** `mix.A` / `mix.B` = share of new videos for pillar A (AI tools) vs B (money). The 9 AM report updates it
  from real analytics. Production follows it; never decide the mix from guesses.
- **Use as little as possible:** keep runs lean. Read only the files you need, no extra drafts or re-renders unless a
  check fails, no messages to Saqib except real problems.

## Stock rule
Each run starts with this check: call `getScheduledPosts` (brand 7939426, Asia/Karachi, from now to now + 45 days)
and count future YouTube posts whose `youtubeData.type` is `video`. **If the count is at or above `stockTarget`, stop
immediately** (no build, no message). Otherwise make exactly ONE new long video **and its 3 Shorts** in this run.
Runs fire every 4 hours. If Metricool refuses a post because of a plan limit, stop, note it in the tracker and tell Saqib. Two runs may overlap: always claim a video in the tracker before working on it, and re-check
`getScheduledPosts` right before you schedule so two runs never take one slot.

## One production run (do these in order)
1. `bash pipeline/setup.sh` (installs Chatterbox voice, Whisper, Remotion, music/SFX; ~10–15 min first time).
2. **Pick the video.** Read `plan/mix.json` and the tracker `videos` collection. Look at the last 10 videos that are
   Scheduled/Published: if pillar A's share is below `mix.A`, take A, else take B. Then pick the lowest `num` of that
   pillar whose `stage` is `Idea` (skip ones another run moved to `Script`/`Voice`/`Edit`). Set its stage to `Script`
   (always pin writes with `if_version`).
   **Idea refill:** if fewer than 6 `Idea` rows remain for a pillar, research 10 new topics for it first (search demand,
   what is working for similar channels, no copying) and add them as new `videos` rows (next `num`, stage `Idea`).
3. **Research** with WebSearch/WebFetch. Open the pages you take numbers from. Note prices/dates as "checked <Month Year>".
4. **Write `episodes/EXX/episode.json`** (copy the shape of E02):
   - 1,050–1,250 spoken words (≈7–8 min at 160 wpm), 10–13 scenes, each scene's `text` 60–130 words.
   - Hook in scene 1 (a concrete number or tension), a clear promise, value in every scene, outro with a comment
     question + "subscribe to Future Money Lab" + `next` title from the tracker.
   - Mix scene kinds (see below). Put `at` words on items so graphics appear exactly when spoken.
   - `broll`: two Mixkit clip ids per scene that match what is said (see catalog below).
   - `thumbnail.a` / `thumbnail.b`: two honest A/B versions (max ~4 big words).
   - `youtube`: title (50–65 chars), summary, details, sources (pages you opened), 8–12 tags, hashtags.
   - **`shorts`**: a list of 3 `{scenes: [one or two consecutive scene ids, 30–55 s total], headline (≤ 50 chars, a hook), cta}`.
     Pick the 3 most self-contained, surprising scenes (a number, a rule, a reveal); not the intro if it only teases,
     not the outro, and no scene that starts with "But"/"So" and depends on the one before.
5. Build: `FML_WORK=~/fml-work python3 pipeline/make_episode.py episodes/EXX/episode.json broll voice pace props stills`
   then **Read `~/fml-work/EXX/stills_sheet.png`** and fix any overlap/clipped text in the JSON (re-run `props stills`).
   Then `... render audio assemble short thumbs meta` (render ≈ 1 min per 9 s of video; run it in the background and wait).
   This writes `EXX_short1.mp4`, `EXX_short2.mp4`, `EXX_short3.mp4`.
   Read `contact_sheet.png`, both thumbnails, and one frame of each Short before going on. Update tracker stage as you go (Voice → Edit).
   **Memory:** the machine has ~7 GB. Never run two heavy jobs at once (voice generation, a Remotion render, the
   57-input audio mix). A SIGKILL means out of memory: wait for the other job, then re-run the stage (stages resume).
6. **Upload hand-off**: copy `EXX_upload.mp4` (<95 MB) and the 3 Shorts into the repo root, commit, push to `main`,
   then confirm `curl -sI <raw url>` returns 200 with the right content-length for each file.
7. **Schedule** with Metricool `createScheduledPost` (same fields as E01: `providers:[{network:"youtube"}]`,
   `youtubeData` {title, type:"video", privacy:"public", tags, category:"SCIENCE_TECHNOLOGY", madeForKids:false,
   isAiGeneratedContent:true}, `text` = `youtube_description.txt`, `media` = [raw url], `autoPublish:true`).
   Long video: the earliest free **long slot** for the current phase, at least 2 hours away.
   **Then each Short** with its own file (also via the repo raw URL): `youtubeData.type: "short"`, title = the short
   headline (+ " #Shorts"), same tags, `isAiGeneratedContent: true`, text = 2 lines about the clip +
   "Full video: search 'Future Money Lab' or visit https://www.youtube.com/@TheFutureMoneyLabAI" + the disclaimer line.
   Each Short takes the earliest free **Short slot** after the long video's time.
8. When the posts are created (Metricool copies media to static.metricool.com), `git rm` the mp4 files and push.
   Commit `episode.json` with `"status":"scheduled"` and `metricool.postId/publishAt` (+ `shortPosts`).
9. Tracker: video `stage: "Scheduled"`, `day` = slot; add a short note to the matching task if useful.
   **Library:** `set` `videos/<channel>-EXX` in the Video Library (`channel` "fml", `ep`, `title`, `pillar`, `pillarName`,
   `publishAt`, `status:"Scheduled"`, `shorts:[{title, publishAt, status}]`). If a thumbnail jpg exists, upload it with
   Artifact `asset: true` to the library url and store the returned url as `thumb`.
10. Do not message Saqib per video; the 9 AM report covers it. Message him only if something needs him.

If a stage fails twice, stop, write the reason in the tracker task note, and tell Saqib. Never loop endlessly.

## Daily 9 AM report (separate scheduled task)
Every day at 09:00 PKT, in Roman Urdu, short:
1. Published since yesterday's report (long + Shorts, with links if Metricool gives them) and what failed.
2. Stock: long videos and Shorts scheduled ahead, next 4 publish times.
3. Production: videos made in the last 24 h, ones stuck in Script/Voice/Edit (and why).
4. Numbers per pillar from Metricool YouTube analytics (`getAnalyticsAvailableMetrics` then `getAnalyticsDataByMetrics`):
   views, watch time / average view duration, subscribers gained, best and worst video. Say clearly when data is missing.
5. **Phase switch:** if `perDay` is 1 and 20 or more long videos are scheduled, set `perDay: 2` (keep `stockTarget: 60`)
   in `plan/mix.json`, commit, and tell Saqib in the report.
6. **Mix update:** once each pillar has ≥ 5 long videos published ≥ 3 days ago, compare views per video and average view
   duration. Move `plan/mix.json` toward the stronger pillar by at most 0.10 per day, staying between 0.20 and 0.80;
   write the reason in it and commit. Before that, keep 0.5 / 0.5.
7. **Library:** for every long video or Short Metricool shows as published, set `status:"Published"` and `url`
   (YouTube link) on its `videos` row in the Video Library; failed ones get `status:"Failed"`.
8. **Needs from Saqib** (or "Kuch nahi chahiye"): e.g. phone verification, an expired connection, a failed upload.
Save the report as `reports/YYYY-MM-DD.md` in this repo (commit + push) and send it as the final message.

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
Finance: 47214 man analyzing market data · 9607 stock trend on screen · 18302 counting money · 18296 counting bills ·
18263 counting coins · 47796 stock ticker board · 47793 stock data screen · 9330 bid/ask screen with pen ·
46990 chart on tablet · 5461 animated stock UI · 26758 / 30873 3D candlestick charts.
More: mixkit.co listing pages are blocked from the shell (Cloudflare 429). Find ids with
`WebSearch` (allowed_domains `mixkit.co`, e.g. "mixkit free stock video laptop"); the id is the number at the end of
the clip URL. The CDN still works: `https://assets.mixkit.co/videos/<id>/<id>-1080.mp4` (or `-720.mp4`). Landscape clips only.

## Git
Commit as yourself; end messages with the session attribution lines the system gives you. Never commit video files
except the temporary `*_upload.mp4` hand-off, and remove it right after Metricool accepts the post.

## New channels: Drive stock mode (owner's order, 9 Nov 2026)
Future Money Lab stays on the Metricool flow above. Every **new** channel works differently:
- Keep **20 ready videos per channel** in Google Drive, one folder per video with the long mp4, the 3 Shorts, both
  thumbnails and an `upload.txt` (title, description, tags, Short titles/descriptions, suggested publish time).
- **Saqib uploads them himself** in YouTube Studio and clicks "Uploaded mark karein" in the Video Library.
- Each run: rows with `status:"Uploaded"` → delete that Drive folder; then if the channel has fewer than 20 rows with
  `status:"Stock"`, make one new video and add its row (`status:"Stock"`, `driveUrl`).
- Not live yet: needs the Google Drive connector connected and a test that it can upload ~90 MB files.
  Storage: ~150 MB per video → ~3 GB per channel; the free 15 GB Drive holds about 4 channels.
