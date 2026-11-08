"""Render two thumbnail versions (A/B) from episode.json -> thumbnail.
Spec: {"a": {"big": "ONLY 3", "line2": "ARE WORTH IT", "tag": "8 AI tools compared",
             "chips": [["1 AI assistant", true], ["Notion AI (solo)", false]]},
       "b": {"kicker": "AI SUBSCRIPTIONS", "from": "$145", "to": "$40", "line2": "STOP OVERPAYING", "tag": "..."}}
Either version may instead use the "a" layout twice. Keep claims identical to the video."""
import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ep = json.load(open(sys.argv[1])); out = sys.argv[2]
F = base64.b64encode(open(f"{ROOT}/pipeline/assets/space-grotesk-latin-700-normal.woff2", "rb").read()).decode()
logo = open(f"{ROOT}/pipeline/assets/logo.svg").read()
CSS = f"""@font-face{{font-family:SG;src:url(data:font/woff2;base64,{F}) format('woff2');font-weight:700}}
body{{margin:0}} .c{{width:1280px;height:720px;position:relative;overflow:hidden;font-family:Inter,sans-serif;
background:radial-gradient(circle at 18% 20%,rgba(34,211,238,.28),transparent 45%),radial-gradient(circle at 90% 85%,rgba(245,179,1,.25),transparent 45%),linear-gradient(150deg,#0b1220,#101d38)}}
.logo{{position:absolute;right:30px;top:24px;width:70px;height:70px}} .logo svg{{width:100%;height:100%}}"""


def layout_a(s):
    chips = "".join(
        f"<div style='display:flex;align-items:center;gap:12px;padding:10px 18px;border-radius:14px;font:800 30px Inter;background:{'#0f2f22' if ok else 'rgba(255,255,255,.06)'};border:2px solid {'#34d399' if ok else 'rgba(244,63,94,.6)'};color:{'#fff' if ok else 'rgba(255,255,255,.55)'};{'' if ok else 'text-decoration:line-through;text-decoration-color:#f43f5e;text-decoration-thickness:4px'}'><span style='color:{'#34d399' if ok else '#f43f5e'}'>{'✓' if ok else '✗'}</span>{t}</div>"
        for t, ok in s.get("chips", []))
    big_size = 250 if len(s["big"]) <= 7 else 170
    return f"""<div class=c><div style='position:absolute;left:56px;top:70px;max-width:{780 if chips else 1150}px'>
<div style='font:700 {big_size}px/0.85 SG;color:#f5b301;letter-spacing:-8px;text-shadow:0 14px 40px rgba(0,0,0,.5)'>{s['big']}</div>
<div style='font:700 92px/1 SG;color:#fff;letter-spacing:-3px;margin-top:22px'>{s.get('line2','')}</div>
{f"<div style='margin-top:26px;display:inline-block;font:800 34px Inter;color:#0b1220;background:#22d3ee;padding:8px 18px;border-radius:12px'>{s['tag']}</div>" if s.get('tag') else ''}</div>
{f"<div style='position:absolute;right:40px;top:265px;width:420px;display:flex;flex-direction:column;gap:14px;transform:rotate(3deg)'>{chips}</div>" if chips else ''}
<div class=logo>{logo}</div></div>"""


def layout_b(s):
    return f"""<div class=c><div style='position:absolute;left:60px;top:60px'>
<div style='font:800 44px Inter;color:rgba(255,255,255,.75);letter-spacing:3px'>{s.get('kicker','')}</div>
<div style='display:flex;align-items:baseline;gap:26px;margin-top:6px'>
<span style='font:700 170px SG;color:rgba(255,255,255,.5);text-decoration:line-through;text-decoration-color:#f43f5e;text-decoration-thickness:12px;letter-spacing:-6px'>{s['from']}</span>
<span style='font:700 120px SG;color:#fff'>→</span>
<span style='font:700 220px SG;color:#34d399;letter-spacing:-8px;text-shadow:0 14px 40px rgba(0,0,0,.5)'>{s['to']}</span></div>
<div style='font:700 96px/1 SG;color:#f5b301;letter-spacing:-3px;margin-top:6px'>{s.get('line2','')}</div>
{f"<div style='margin-top:28px;display:inline-block;font:800 34px Inter;color:#0b1220;background:#22d3ee;padding:8px 18px;border-radius:12px'>{s['tag']}</div>" if s.get('tag') else ''}</div>
<div class=logo>{logo}</div></div>"""


async def main():
    spec = ep["thumbnail"]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for key in ("a", "b"):
            if key not in spec: continue
            s = spec[key]; body = layout_b(s) if "from" in s else layout_a(s)
            pg = await b.new_page(viewport={"width": 1280, "height": 720})
            await pg.set_content(f"<html><head><style>{CSS}</style></head><body>{body}</body></html>")
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=f"{out}/thumb_{key}.png")
        await b.close()
    print("[fml] thumbs ok")

asyncio.run(main())
