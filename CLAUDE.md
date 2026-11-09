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

## Publishing plan (owner's order, 9 Nov 2026 — replaces the Metricool auto-schedule for new videos)
- **Claude's job ends at Google Drive.** Every new video (long + 3 Shorts) goes into its own Google Drive folder with
  everything needed to upload it. **Saqib uploads to YouTube himself.** Do NOT create Metricool posts for new videos.
- Posts already scheduled in Metricool before 9 Nov 2026 (E02–E07 and their Shorts) stay as they are and publish on
  their own; never cancel or edit them.
- **Stock target: 20 ready videos per channel** (Video Library rows with `status:"Stock"`). `plan/mix.json`
  `stockTarget` holds this number.
- Suggested publish times written into `upload.txt` (advice for Saqib, US audience): long video 00:15 PKT
  (= 2:15 PM ET), Shorts after it at 02:45, 06:45 and 21:15 PKT. One long video a day per channel. When the US switches
  to daylight time (2nd Sunday of March) suggest 1 hour earlier; back in November.
- **Niche mix:** `mix.A` / `mix.B` = share of new videos for pillar A (AI tools) vs B (money). The 9 AM report updates it
  from real analytics. Production follows it; never decide the mix from guesses.
- **Use as little as possible:** keep runs lean. Read only the files you need, no extra drafts or re-renders unless a
  check fails, no messages to Saqib except real problems.

## Stock rule (start of every run)
1. **Drive check:** load the Google Drive connector tools (ToolSearch "google drive"). If they are not available,
   **stop immediately** (no build; nothing could be saved). Do not message Saqib; the 9 AM report says it.
2. **Clean up:** in the Video Library, for each row with `status:"Uploaded"` whose Drive folder still exists, delete
   that Drive folder and set `driveDeleted: true` on the row.
3. **Count:** rows with `status:"Stock"` for the channel. **If at or above `stockTarget` (20), stop** (no build, no
   message). Otherwise make exactly ONE new long video **and its 3 Shorts** in this run.
Runs fire every 4 hours. Two runs may overlap: always claim a video in the tracker before working on it.

## One production run (do these in order)
1. `bash pipeline/setup.sh` (installs Chatterbox voice, Whisper, Remotion, music/SFX; ~10–15 min first time).
2. **Pick the video.** Read `plan/mix.json` and the tracker `videos` collection. Look at the last 10 videos that are
   Stock/Scheduled/Published: if pillar A's share is below `mix.A`, take A, else take B. Then pick the lowest `num` of that
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
6. **Google Drive folder:** in Drive folder `YouTube Stock/<Channel name>/` create `EXX - <title>` and upload:
   `EXX_upload.mp4` (long video), `EXX_short1.mp4`, `EXX_short2.mp4`, `EXX_short3.mp4`, both thumbnails (A and B), and
   `upload.txt` with: channel name, long-video title, full description (`youtube_description.txt`), tags (comma
   separated), category Science & Technology, "Made for kids: No", "Altered or synthetic content: Yes", suggested publish
   time; then for each Short: title (headline + " #Shorts"), description (2 lines about the clip + "Full video: search
   '<Channel name>' or visit <channel url>" + disclaimer line), tags, and suggested time. Confirm every file is in Drive
   with the right size before going on. If an upload fails twice, stop and tell Saqib.
7. Commit `episode.json` with `"status":"stock"` and `drive.folderUrl`. Never commit mp4 files.
8. Tracker: video `stage: "Stock"`.
   **Library:** `set` `videos/<channel>-EXX` (`channel` e.g. "fml", `ep`, `title`, `pillar`, `pillarName`,
   `status:"Stock"`, `driveUrl` = folder link, `suggestedAt` = suggested publish time,
   `shorts:[{title, status:"Stock"}]`). Upload thumbnail A with Artifact `asset: true` to the library url and store the
   returned url as `thumb`.
9. Do not message Saqib per video; the 9 AM report covers it. Message him only if something needs him.

If a stage fails twice, stop, write the reason in the tracker task note, and tell Saqib. Never loop endlessly.

## Daily 9 AM report (separate scheduled task)
Every day at 09:00 PKT, in Roman Urdu, short:
1. Published since yesterday's report (long + Shorts, with links if Metricool gives them) and what failed.
2. Stock: per channel, ready videos in Drive (Library `Stock` rows) vs the 20 target; videos Saqib marked `Uploaded`
   since the last report; Metricool posts still scheduled (old flow) and their next publish times.
3. Production: videos made in the last 24 h, ones stuck in Script/Voice/Edit (and why).
4. Numbers per pillar from Metricool YouTube analytics (`getAnalyticsAvailableMetrics` then `getAnalyticsDataByMetrics`):
   views, watch time / average view duration, subscribers gained, best and worst video. Say clearly when data is missing.
5. **Mix update:** once each pillar has ≥ 5 long videos published ≥ 3 days ago, compare views per video and average view
   duration. Move `plan/mix.json` toward the stronger pillar by at most 0.10 per day, staying between 0.20 and 0.80;
   write the reason in it and commit. Before that, keep 0.5 / 0.5.
6. **Library:** for every long video or Short Metricool shows as published, set `status:"Published"` and `url`
   (YouTube link) on its `videos` row in the Video Library; failed ones get `status:"Failed"`. For `Uploaded` rows,
   add the YouTube link if Metricool analytics lists the video (match by title).
7. **Needs from Saqib** (or "Kuch nahi chahiye"): e.g. Google Drive not connected, Drive almost full,
   phone verification, an expired connection, a failed upload.
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

## New channels
Same Drive flow for every channel. Each channel gets its own folder under `YouTube Stock/` and its own row in the
Library `channels` collection. Storage: ~150 MB per video → ~3 GB per channel at 20 in stock; the free 15 GB Drive
holds about 4 channels. Warn Saqib in the report when Drive is over 80% full.
