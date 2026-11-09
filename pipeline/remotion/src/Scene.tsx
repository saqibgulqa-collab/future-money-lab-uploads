/**
 * Future Money Lab — generic, data-driven scene renderer.
 * Every scene in an episode JSON picks a `kind` below and fills its fields.
 * Anything with `at` appears when that word is spoken (prefix match on the
 * normalised word; `nth` picks the n-th match). See CLAUDE.md for the schema.
 */
import React from "react";
import {
  AbsoluteFill, continueRender, delayRender, Easing, OffthreadVideo, Sequence,
  interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

if (typeof document !== "undefined") {
  const h = delayRender("brand font");
  Promise.all(
    [["700", "space-grotesk-latin-700-normal.woff2"], ["500", "space-grotesk-latin-500-normal.woff2"]].map(([w, file]) =>
      new FontFace("Space Grotesk", `url(${staticFile(file)})`, { weight: w }).load()),
  ).then((faces) => { faces.forEach((ff) => document.fonts.add(ff)); continueRender(h); }).catch(() => continueRender(h));
}

type Word = { w: string; s: number; e: number };
type At = { at?: string; nth?: number };
type Item = At & { label?: string; value?: string; num?: number; text?: string; title?: string; sub?: string; name?: string; desc?: string; fill?: number; tone?: "good" | "bad" };
type Footer = At & { text: string; highlight?: string; tone?: "good" | "bad" | "accent" };
export type SceneSpec = {
  id: string; kind: string; chapter?: string; broll: string[];
  title?: string; sub?: string; badge?: string; accent?: number[];
  items?: Item[]; chips?: Item[]; footer?: Footer; prefix?: string;
  total?: { label: string; yearly?: Footer; callout?: Footer };
  value?: string; stamp?: string; stampAt?: string; cards?: Item[]; big?: Item; bars?: Item[];
  left?: { title: string; items: string[]; note?: string }; right?: { title: string; items: string[] };
  from?: string; to?: string; unit?: string; saving?: Footer; next?: string; numberValue?: number;
};
export type SceneProps = { scene: SceneSpec; timing: { dur: number; words: Word[]; split: number }; brollDur: Record<string, number> };

const C = { text: "#ffffff", muted: "rgba(255,255,255,0.78)", gold: "#f5b301", cyan: "#22d3ee", red: "#f43f5e", green: "#34d399", dark: "#0b1220", glass: "rgba(8,12,24,0.68)", line: "rgba(255,255,255,0.16)" };
const FONT = "Inter, sans-serif";
const DISPLAY = "'Space Grotesk', Inter, sans-serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const tone = (t?: string) => (t === "good" ? C.green : t === "bad" ? C.red : t === "accent" ? C.cyan : C.gold);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9$]/g, "");

const wordAt = (words: Word[], key: string | undefined, nth = 0, fallback = 0) => {
  if (!key) return fallback;
  const k0 = norm(key);
  let k = 0;
  for (const w of words) if (norm(w.w).startsWith(k0)) { if (k === nth) return w.s; k++; }
  return fallback;
};
const useT = () => { const { fps } = useVideoConfig(); return (sec: number) => Math.round(sec * fps); };
const useSpringAt = (frame: number, damping = 14) => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return spring({ frame: f - frame, fps, config: { damping, mass: 0.7 } }); };
/** frame at which item i appears: its `at` word, else spread over the scene */
const appearFrames = (items: At[] | undefined, words: Word[], dur: number, fps: number, start = 0.08, span = 0.7) =>
  (items || []).map((it, i, arr) => Math.round(wordAt(words, it.at, it.nth || 0, dur * (start + (span * i) / Math.max(1, arr.length))) * fps));

/* ---------- background & finish ---------- */
const Broll: React.FC<{ id: string; frames: number; clipDur: number; seed: number; dim: number }> = ({ id, frames, clipDur, seed, dim }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const rate = frames / fps > clipDur ? Math.max(0.5, clipDur / (frames / fps)) : 1;
  const zIn = random(`z${seed}`) > 0.5;
  const scale = interpolate(f, [0, frames], zIn ? [1.05, 1.17] : [1.17, 1.05], clamp);
  const dx = interpolate(f, [0, frames], [0, (random(`x${seed}`) - 0.5) * 70], clamp);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <OffthreadVideo src={staticFile(`broll/${id}.mp4`)} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${dx}px)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(90deg, rgba(5,8,16,${dim + 0.15}) 0%, rgba(5,8,16,${dim}) 55%, rgba(5,8,16,${dim - 0.1}) 100%)` }} />
    </AbsoluteFill>
  );
};
const Finish: React.FC = () => {
  const f = useCurrentFrame();
  return (<>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.6) 100%)" }} />
    <AbsoluteFill style={{ opacity: 0.06, mixBlendMode: "overlay", backgroundPosition: `${(f * 37) % 200}px ${(f * 53) % 200}px`,
      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")" }} />
  </>);
};

/* ---------- captions ---------- */
const KEY = /^(\$?\d[\d,.]*%?|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|eighty|hundred|thousand|million|billion|free|pay|skip|never|always|every|half|double|cancel|save|money|ai)$/i;
const Captions: React.FC<{ words: Word[]; extra: RegExp | null }> = ({ words, extra }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps;
  const groups: Word[][] = []; let cur: Word[] = [];
  words.forEach((w, i) => { cur.push(w); if (/[.?!,]$/.test(w.w) || cur.length >= 4 || i === words.length - 1) { groups.push(cur); cur = []; } });
  const gi = groups.findIndex((g, i) => t >= g[0].s - 0.05 && (i === groups.length - 1 || t < groups[i + 1][0].s - 0.05));
  if (gi < 0) return null;
  const g = groups[gi];
  if (t > g[g.length - 1].e + 0.5) return null;
  const pop = spring({ frame: f - Math.round((g[0].s - 0.05) * fps), fps, config: { damping: 11, mass: 0.5 } });
  return (
    <div style={{ position: "absolute", bottom: 70, width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ fontFamily: FONT, fontSize: 58, fontWeight: 900, display: "flex", gap: 16, transform: `scale(${0.86 + 0.14 * pop})`, textShadow: "0 4px 18px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)", WebkitTextStroke: "1.5px rgba(0,0,0,0.55)" }}>
        {g.map((w, i) => { const c = w.w.replace(/[^a-zA-Z0-9$%,.']/g, "").replace(/[,.]$/, ""); const hit = KEY.test(c) || (extra ? extra.test(c) : false);
          return <span key={i} style={{ color: hit ? C.gold : C.text, opacity: t >= w.s - 0.02 ? 1 : 0.35, textTransform: "uppercase" }}>{w.w.replace(/[,.]$/, "")}</span>; })}
      </div>
    </div>
  );
};

/* ---------- shared bits ---------- */
const Chapter: React.FC<{ label?: string }> = ({ label }) => {
  const p = useSpringAt(2);
  if (!label) return null;
  return (
    <div style={{ position: "absolute", top: 54, left: 90, display: "flex", alignItems: "center", gap: 14, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: C.cyan, boxShadow: `0 0 16px ${C.cyan}` }} />
      <span style={{ fontFamily: FONT, color: C.muted, fontSize: 26, fontWeight: 800, letterSpacing: 4 }}>{label.toUpperCase()}</span>
    </div>
  );
};
const Glass: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: C.glass, backdropFilter: "blur(14px)", border: `1px solid ${C.line}`, borderRadius: 26, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", ...style }}>{children}</div>
);
const Kinetic: React.FC<{ text: string; size: number; delay?: number; accent?: number[] }> = ({ text, size, delay = 0, accent = [] }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: size * 0.24, justifyContent: "center" }}>
    {text.split(" ").map((w, i) => { const p = useSpringAt(delay + i * 4, 13);
      return <span key={i} style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: 700, letterSpacing: -size * 0.03, lineHeight: 1.02, color: accent.includes(i) ? C.gold : C.text, opacity: p, display: "inline-block", transform: `translateY(${(1 - p) * size * 0.55}px)`, textShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>{w}</span>; })}
  </div>
);
const FooterLine: React.FC<{ footer?: Footer; words: Word[]; dur: number; size?: number; align?: "left" | "center" }> = ({ footer, words, dur, size = 42, align = "left" }) => {
  const { fps } = useVideoConfig();
  const p = useSpringAt(Math.round(wordAt(words, footer?.at, footer?.nth || 0, dur * 0.8) * fps));
  if (!footer) return null;
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 800, color: C.text, opacity: p, transform: `translateY(${(1 - p) * 16}px)`, textAlign: align }}>
      {footer.text}{footer.highlight ? <span style={{ color: tone(footer.tone) }}> {footer.highlight}</span> : null}
    </div>
  );
};
type Body = React.FC<SceneProps>;

/* ---------- kinds ---------- */
const Hero: Body = ({ scene }) => {
  const sub = useSpringAt(22); const bar = useSpringAt(14);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 150 }}>
      {scene.badge ? <div style={{ color: C.cyan, fontFamily: FONT, fontSize: 30, fontWeight: 800, letterSpacing: 10, marginBottom: 24, opacity: sub }}>{scene.badge.toUpperCase()}</div> : null}
      <Kinetic text={scene.title || ""} size={140} accent={scene.accent} />
      <div style={{ width: 560 * bar, height: 8, background: C.gold, borderRadius: 4, margin: "32px 0 24px" }} />
      {scene.sub ? <div style={{ color: C.text, fontFamily: FONT, fontSize: 54, fontWeight: 600, opacity: sub }}>{scene.sub}</div> : null}
    </AbsoluteFill>
  );
};

const PriceList: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const T = useT();
  const items = scene.items || []; const fr = appearFrames(items, timing.words, timing.dur, fps, 0.04, 0.4);
  const total = items.reduce((a, it, i) => a + (it.num || 0) * interpolate(f, [fr[i], fr[i] + 8], [0, 1], clamp), 0);
  const yr = useSpringAt(T(wordAt(timing.words, scene.total?.yearly?.at, scene.total?.yearly?.nth || 0, timing.dur * 0.5)));
  const co = useSpringAt(T(wordAt(timing.words, scene.total?.callout?.at, scene.total?.callout?.nth || 0, timing.dur * 0.7)), 10);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 90, top: 130, width: 760, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it, i) => { const s = spring({ frame: f - fr[i], fps, config: { damping: 14 } });
          return (<div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 26px", background: "rgba(8,12,24,0.72)", border: `1px solid ${C.line}`, borderRadius: 16, opacity: s, transform: `translateX(${(1 - s) * -80}px)`, fontFamily: FONT }}>
            <span style={{ color: C.text, fontSize: 34, fontWeight: 700 }}>{it.label}</span><span style={{ color: C.gold, fontSize: 34, fontWeight: 800 }}>{it.value}</span></div>); })}
      </div>
      {scene.total ? (
        <div style={{ position: "absolute", right: 110, top: 250, width: 820, textAlign: "right", fontFamily: FONT }}>
          <div style={{ color: C.muted, fontSize: 36, fontWeight: 700, letterSpacing: 4 }}>{scene.total.label.toUpperCase()}</div>
          <div style={{ fontFamily: DISPLAY, color: C.text, fontSize: 230, fontWeight: 700, letterSpacing: -8, lineHeight: 1, textShadow: "0 12px 50px rgba(0,0,0,0.6)" }}>{scene.prefix ?? "$"}{Math.round(total).toLocaleString("en-US")}</div>
          {scene.total.yearly ? <div style={{ color: tone(scene.total.yearly.tone || "bad"), fontSize: 56, fontWeight: 800, opacity: yr, transform: `translateY(${(1 - yr) * 20}px)` }}>{scene.total.yearly.text}</div> : null}
          {scene.total.callout ? <div style={{ marginTop: 40, display: "inline-block", background: C.gold, color: C.dark, fontSize: 52, fontWeight: 900, padding: "14px 30px", borderRadius: 18, transform: `scale(${co})`, transformOrigin: "right center" }}>{scene.total.callout.text}</div> : null}
        </div>) : null}
    </AbsoluteFill>
  );
};

const Steps: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const items = scene.items || []; const fr = appearFrames(items, timing.words, timing.dur, fps, 0.05, 0.6);
  const numbered = scene.kind === "questions";
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 110, paddingBottom: 130 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 1300 }}>
        {items.map((it, i) => { const s = spring({ frame: f - fr[i], fps, config: { damping: 14 } });
          return (<Glass key={i} style={{ display: "flex", alignItems: "center", gap: 28, padding: "24px 34px", opacity: s, transform: `translateX(${(1 - s) * -90}px)` }}>
            {numbered
              ? <div style={{ width: 84, height: 84, flex: "none", borderRadius: 22, background: C.gold, color: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontSize: 52, fontWeight: 700 }}>{i + 1}</div>
              : <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, color: C.cyan, letterSpacing: 3, width: 150, flex: "none" }}>STEP {i + 1}</div>}
            <div style={{ fontFamily: FONT, fontSize: items.length > 4 ? 40 : 48, fontWeight: 800, color: C.text }}>{it.text}</div></Glass>); })}
        <FooterLine footer={scene.footer} words={timing.words} dur={timing.dur} />
      </div>
    </AbsoluteFill>
  );
};

const Cards: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const items = scene.items || []; const chips = scene.chips || [];
  const fr = appearFrames(items, timing.words, timing.dur, fps, 0.05, 0.3);
  const fc = appearFrames(chips, timing.words, timing.dur, fps, 0.35, 0.35);
  const w = items.length >= 4 ? 380 : items.length === 3 ? 500 : 620;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 26 }}>
        {items.map((it, i) => { const s = spring({ frame: f - fr[i], fps, config: { damping: 12 } });
          return (<Glass key={i} style={{ width: w, padding: "30px 26px", textAlign: "center", opacity: s, transform: `translateY(${(1 - s) * 60}px) scale(${0.9 + 0.1 * s})` }}>
            <div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 800, color: C.text }}>{it.title}</div>
            {it.value ? <div style={{ fontFamily: DISPLAY, fontSize: 70, fontWeight: 700, color: C.gold, marginTop: 8 }}>{it.value}</div> : null}
            {it.sub ? <div style={{ fontFamily: FONT, fontSize: 26, color: C.muted, fontWeight: 600, marginTop: 4 }}>{it.sub}</div> : null}</Glass>); })}
      </div>
      <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, padding: "0 200px" }}>
        {chips.map((c, i) => { const s = spring({ frame: f - fc[i], fps, config: { damping: 12 } });
          return <div key={i} style={{ fontFamily: FONT, fontSize: 34, fontWeight: 700, color: C.dark, background: C.cyan, borderRadius: 999, padding: "10px 26px", opacity: s, transform: `scale(${s})` }}>✓ {c.text}</div>; })}
      </div>
      <div style={{ position: "absolute", top: 670, left: 0, right: 0 }}><FooterLine footer={scene.footer} words={timing.words} dur={timing.dur} size={52} align="center" /></div>
    </AbsoluteFill>
  );
};

const Rows: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const items = scene.items || []; const fr = appearFrames(items, timing.words, timing.dur, fps, 0.05, 0.6);
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 110, paddingBottom: 140 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 1450 }}>
        {items.map((it, i) => { const s = spring({ frame: f - fr[i], fps, config: { damping: 14 } });
          return (<Glass key={i} style={{ display: "flex", alignItems: "center", gap: 30, padding: "22px 34px", opacity: s, transform: `translateX(${(1 - s) * -90}px)` }}>
            <div style={{ width: 320, flex: "none", fontFamily: DISPLAY, fontSize: 48, fontWeight: 700, color: C.gold }}>{it.name}</div>
            <div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 700, color: C.text }}>{it.desc}</div></Glass>); })}
        <div style={{ color: C.cyan }}><FooterLine footer={scene.footer} words={timing.words} dur={timing.dur} /></div>
      </div>
    </AbsoluteFill>
  );
};

const Verdict: Body = ({ scene }) => {
  const badge = useSpringAt(0, 9); const sub = useSpringAt(22);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 150 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 64, fontWeight: 700, color: C.dark, background: C.gold, padding: "12px 40px", borderRadius: 20, transform: `scale(${badge}) rotate(${(1 - badge) * -8}deg)`, boxShadow: "0 20px 60px rgba(245,179,1,0.35)" }}>{(scene.badge || "").toUpperCase()}</div>
      <div style={{ marginTop: 36 }}><Kinetic text={scene.title || ""} size={140} delay={8} accent={scene.accent} /></div>
      {scene.sub ? <div style={{ marginTop: 26, fontFamily: FONT, fontSize: 50, fontWeight: 700, color: C.cyan, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>{scene.sub}</div> : null}
    </AbsoluteFill>
  );
};

const Stamp: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const card = useSpringAt(0);
  const stampAt = Math.round(wordAt(timing.words, scene.stampAt, 0, timing.dur * 0.75) * fps);
  const st = spring({ frame: f - stampAt, fps, config: { damping: 8, mass: 0.6 } });
  const good = /keep|yes|buy|worth|pass/i.test(scene.stamp || "");
  const col = good ? C.green : C.red;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 140 }}>
      <Glass style={{ position: "relative", width: 1000, padding: "50px 60px", textAlign: "center", opacity: card, transform: `scale(${0.9 + 0.1 * card})` }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 104, fontWeight: 700, color: C.text, letterSpacing: -3 }}>{scene.title}</div>
        {scene.value ? <div style={{ fontFamily: DISPLAY, fontSize: 90, fontWeight: 700, color: C.gold, marginTop: 6 }}>{scene.value}</div> : null}
        {scene.sub ? <div style={{ fontFamily: FONT, fontSize: 34, color: C.muted, fontWeight: 600 }}>{scene.sub}</div> : null}
        <div style={{ position: "absolute", right: -60, top: -50, opacity: st > 0.01 ? 1 : 0, transform: `scale(${3 - 2 * st}) rotate(-14deg)`, border: `10px solid ${col}`, color: col, fontFamily: DISPLAY, fontSize: 96, fontWeight: 700, padding: "4px 34px", borderRadius: 18, background: "rgba(10,10,20,0.75)" }}>{(scene.stamp || "").toUpperCase()}</div>
      </Glass>
      <div style={{ marginTop: 30 }}><FooterLine footer={scene.footer} words={timing.words} dur={timing.dur} size={40} align="center" /></div>
    </AbsoluteFill>
  );
};

const Compare: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const T = useT();
  const cards = scene.cards || []; const bars = scene.bars || [];
  const fc = appearFrames(cards, timing.words, timing.dur, fps, 0.03, 0.15);
  const fb = appearFrames(bars, timing.words, timing.dur, fps, 0.5, 0.25);
  const big = useSpringAt(T(wordAt(timing.words, scene.big?.at, scene.big?.nth || 0, timing.dur * 0.3)), 11);
  const barsIn = bars.length ? interpolate(f, [fb[0] - 6, fb[0]], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 140, display: "flex", gap: 26 }}>
        {cards.map((c, i) => { const s = spring({ frame: f - fc[i], fps, config: { damping: 13 } });
          return (<Glass key={i} style={{ width: 430, padding: "26px 30px", opacity: s, transform: `translateY(${(1 - s) * 50}px)` }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 54, fontWeight: 700, color: C.text }}>{c.title}</div>
            {c.sub ? <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 700, color: C.cyan, marginTop: 6 }}>{c.sub}</div> : null}</Glass>); })}
      </div>
      {scene.big ? (<div style={{ position: "absolute", right: 110, top: 150, textAlign: "center", opacity: big, transform: `scale(${0.7 + 0.3 * big})` }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 120, fontWeight: 700, color: C.gold, lineHeight: 1 }}>{scene.big.value}</div>
        <div style={{ fontFamily: FONT, fontSize: 46, fontWeight: 800, color: C.text }}>{scene.big.sub}</div></div>) : null}
      {bars.length ? (<Glass style={{ position: "absolute", left: 100, right: 110, top: 470, padding: "30px 40px", opacity: barsIn }}>
        {bars.map((b, i) => { const w = interpolate(f, [fb[i], fb[i] + 18], [0, b.fill ?? 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 26, marginTop: i ? 18 : 0 }}>
            <div style={{ width: 280, fontFamily: FONT, fontSize: 36, fontWeight: 800, color: C.text }}>{b.label}</div>
            <div style={{ flex: 1, height: 46, background: "rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}><div style={{ width: `${w * 100}%`, height: "100%", background: tone(b.tone), borderRadius: 12 }} /></div>
            <div style={{ width: 280, textAlign: "right", fontFamily: DISPLAY, fontSize: 40, fontWeight: 700, color: C.text }}>{b.value}</div></div>); })}
        <div style={{ marginTop: 18, color: C.green }}><FooterLine footer={scene.footer} words={timing.words} dur={timing.dur} size={36} /></div>
      </Glass>) : null}
    </AbsoluteFill>
  );
};

const Stat: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const T = useT();
  const at = T(wordAt(timing.words, scene.big?.at, scene.big?.nth || 0, timing.dur * 0.15));
  const target = scene.numberValue ?? 0;
  const n = interpolate(f, [at, at + 45], [0, target], { ...clamp, easing: Easing.out(Easing.cubic) });
  const s = useSpringAt(at, 13);
  const chips = scene.chips || []; const fc = appearFrames(chips, timing.words, timing.dur, fps, 0.5, 0.3);
  const dec = Number.isInteger(target) ? 0 : 1;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 150 }}>
      {scene.badge ? <div style={{ fontFamily: FONT, fontSize: 40, color: C.text, fontWeight: 700, letterSpacing: 6, opacity: s }}>{scene.badge.toUpperCase()}</div> : null}
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, transform: `scale(${0.7 + 0.3 * s})` }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 280, fontWeight: 700, color: C.gold, letterSpacing: -10, textShadow: "0 12px 50px rgba(0,0,0,0.6)" }}>{scene.prefix ?? ""}{dec ? n.toFixed(dec) : Math.round(n).toLocaleString("en-US")}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 100, fontWeight: 700, color: C.text }}>{scene.unit}</span>
      </div>
      {scene.sub ? <div style={{ fontFamily: FONT, fontSize: 46, color: C.text, fontWeight: 600, marginTop: -10 }}>{scene.sub}</div> : null}
      <div style={{ display: "flex", gap: 22, marginTop: 40, flexWrap: "wrap", justifyContent: "center" }}>
        {chips.map((c, i) => { const p = spring({ frame: f - fc[i], fps, config: { damping: 13 } });
          return <Glass key={i} style={{ padding: "14px 26px", opacity: p, transform: `translateY(${(1 - p) * 30}px)`, borderRadius: 18 }}><span style={{ fontFamily: FONT, fontSize: 34, color: C.text, fontWeight: 700 }}>✓ {c.text}</span></Glass>; })}
      </div>
    </AbsoluteFill>
  );
};

const Scorecard: Body = ({ scene, timing }) => {
  const T = useT();
  const L = useSpringAt(4); const R = useSpringAt(16);
  const tot = useSpringAt(T(wordAt(timing.words, scene.big?.at, scene.big?.nth || 0, timing.dur * 0.45)), 11);
  const sv = useSpringAt(T(wordAt(timing.words, scene.saving?.at, scene.saving?.nth || 0, timing.dur * 0.6)), 11);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 130, left: 100, right: 100, display: "flex", gap: 30 }}>
        {scene.left ? <Glass style={{ flex: 1, padding: "28px 36px", opacity: L, transform: `translateY(${(1 - L) * 40}px)` }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 700, color: C.green }}>✓ {scene.left.title}</div>
          {scene.left.items.map((p) => <div key={p} style={{ fontFamily: FONT, fontSize: 40, fontWeight: 700, color: C.text, marginTop: 14 }}>{p}</div>)}
          {scene.left.note ? <div style={{ fontFamily: FONT, fontSize: 26, color: C.muted, marginTop: 14 }}>{scene.left.note}</div> : null}</Glass> : null}
        {scene.right ? <Glass style={{ flex: 1, padding: "28px 36px", opacity: R, transform: `translateY(${(1 - R) * 40}px)` }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 700, color: C.red }}>✗ {scene.right.title}</div>
          {scene.right.items.map((p) => <div key={p} style={{ fontFamily: FONT, fontSize: 36, fontWeight: 700, color: C.muted, marginTop: 10, textDecoration: "line-through" }}>{p}</div>)}</Glass> : null}
      </div>
      {scene.from || scene.to ? (
        <div style={{ position: "absolute", top: 620, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 30, fontFamily: DISPLAY, opacity: tot, transform: `scale(${0.85 + 0.15 * tot})` }}>
          {scene.from ? <span style={{ fontSize: 80, fontWeight: 700, color: C.muted, textDecoration: "line-through" }}>{scene.from}</span> : null}
          <span style={{ fontSize: 70, color: C.text }}>→</span>
          <span style={{ fontSize: 110, fontWeight: 700, color: C.gold }}>{scene.to}</span>
          {scene.unit ? <span style={{ fontSize: 44, color: C.text, fontFamily: FONT, fontWeight: 700 }}>{scene.unit}</span> : null}
          {scene.saving ? <span style={{ marginLeft: 24, fontSize: 44, fontFamily: FONT, fontWeight: 900, color: C.dark, background: C.green, padding: "8px 22px", borderRadius: 14, opacity: sv, transform: `scale(${sv})`, display: "inline-block" }}>{scene.saving.text}</span> : null}
        </div>) : null}
    </AbsoluteFill>
  );
};

const Outro: Body = ({ scene, timing }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const btnAt = Math.round(wordAt(timing.words, "subscribe", 0, timing.dur * 0.6) * fps);
  const btn = spring({ frame: f - btnAt, fps, config: { damping: 9 } });
  const clicked = f > btnAt + 24;
  const nx = useSpringAt(Math.round(wordAt(timing.words, "next", 0, timing.dur * 0.8) * fps));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 170 }}>
      <Kinetic text={scene.title || ""} size={130} accent={scene.accent} />
      <div style={{ marginTop: 50, transform: `scale(${btn})` }}>
        <div style={{ background: clicked ? "#3f3f46" : "#e11d22", color: "white", borderRadius: 20, padding: "24px 60px", fontFamily: FONT, fontSize: 52, fontWeight: 900, display: "flex", gap: 18 }}><span>{clicked ? "✓" : "▶"}</span>{clicked ? "SUBSCRIBED" : "SUBSCRIBE"}</div>
      </div>
      {scene.next ? <Glass style={{ marginTop: 40, padding: "18px 34px", opacity: nx, transform: `translateY(${(1 - nx) * 30}px)` }}>
        <span style={{ fontFamily: FONT, fontSize: 36, fontWeight: 700, color: C.muted }}>NEXT: </span><span style={{ fontFamily: FONT, fontSize: 36, fontWeight: 800, color: C.text }}>{scene.next}</span></Glass> : null}
    </AbsoluteFill>
  );
};

const BODIES: Record<string, Body> = { hero: Hero, pricelist: PriceList, questions: Steps, steps: Steps, cards: Cards, rows: Rows, verdict: Verdict, stamp: Stamp, compare: Compare, stat: Stat, scorecard: Scorecard, outro: Outro };

export const Scene: React.FC<SceneProps> = (props) => {
  const { scene, timing, brollDur } = props;
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const split = Math.round(timing.split * fps);
  const [b1, b2] = scene.broll;
  const enter = interpolate(f, [0, 9], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const exit = interpolate(f, [durationInFrames - 6, durationInFrames], [0, 1], clamp);
  const flash = interpolate(f, [split - 3, split, split + 6], [0, 0.35, 0], clamp);
  const B = BODIES[scene.kind] || Hero;
  const dim = ["verdict", "outro", "hero"].includes(scene.kind) ? 0.45 : 0.6;
  const names = [...(scene.items || []), ...(scene.cards || [])].map((i) => i.label || i.title || i.name || "").join(" ").split(/\s+/).filter((w) => /^[A-Z]/.test(w) && w.length > 2).map((w) => w.replace(/[^A-Za-z0-9]/g, ""));
  const extra = names.length ? new RegExp(`^(${names.join("|")})$`, "i") : null;
  return (
    <AbsoluteFill style={{ background: "#000", filter: `blur(${enter * 14}px)`, transform: `scale(${1 + enter * 0.12})` }}>
      <Sequence durationInFrames={split}><Broll id={b1} frames={split} clipDur={brollDur[b1] || 10} seed={scene.id.length * 3 + 1} dim={dim} /></Sequence>
      <Sequence from={split}><Broll id={b2 || b1} frames={durationInFrames - split} clipDur={brollDur[b2 || b1] || 10} seed={scene.id.length * 3 + 7} dim={dim} /></Sequence>
      <AbsoluteFill style={{ background: "white", opacity: flash }} />
      <AbsoluteFill><Chapter label={scene.chapter} /><B {...props} /></AbsoluteFill>
      <Finish />
      <Captions words={timing.words} extra={extra} />
      <AbsoluteFill style={{ background: "black", opacity: exit }} />
    </AbsoluteFill>
  );
};
