/** Vertical 1080x1920 Short built from an already-rendered 16:9 scene clip. */
import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

type Word = { w: string; s: number; e: number };
export type ShortProps = { video: string; words: Word[]; dur: number; endCard: number; headline: string; cta: string };

const C = { text: "#ffffff", gold: "#f5b301", cyan: "#22d3ee", dark: "#0b1220", muted: "rgba(255,255,255,0.7)" };
const FONT = "Inter, sans-serif";
const DISPLAY = "'Space Grotesk', Inter, sans-serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const KEY = /^(\$?\d[\d,.]*%?|one|two|three|four|five|ten|twenty|hundred|thousand|million|free|pay|skip|never|every|half|more|less|money|ai|bid|ask|price)$/i;

const Logo: React.FC = () => (
  <svg viewBox="0 0 200 200" width={64} height={64}>
    <defs><clipPath id="fl"><path d="M82 40 h36 v38 l38 68 a12 12 0 0 1 -10.5 18 h-91 a12 12 0 0 1 -10.5 -18 l38 -68 z" /></clipPath></defs>
    <path d="M30 128 C60 118 80 136 100 126 C120 116 140 132 170 122 V180 H30 Z" fill="#f5b301" clipPath="url(#fl)" />
    <polyline points="64,152 86,138 102,145 132,110" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="116,108 134,108 134,126" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M82 40 h36 v38 l38 68 a12 12 0 0 1 -10.5 18 h-91 a12 12 0 0 1 -10.5 -18 l38 -68 z" fill="none" stroke="#22d3ee" strokeWidth="9" strokeLinejoin="round" />
  </svg>
);

const BigCaptions: React.FC<{ words: Word[] }> = ({ words }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps;
  const groups: Word[][] = []; let cur: Word[] = [];
  words.forEach((w, i) => { cur.push(w); if (/[.?!,]$/.test(w.w) || cur.length >= 3 || i === words.length - 1) { groups.push(cur); cur = []; } });
  const gi = groups.findIndex((g, i) => t >= g[0].s - 0.05 && (i === groups.length - 1 || t < groups[i + 1][0].s - 0.05));
  if (gi < 0) return null;
  const g = groups[gi];
  if (t > g[g.length - 1].e + 0.5) return null;
  const pop = spring({ frame: f - Math.round((g[0].s - 0.05) * fps), fps, config: { damping: 10, mass: 0.5 } });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, padding: "0 60px", transform: `scale(${0.82 + 0.18 * pop})` }}>
      {g.map((w, i) => { const c = w.w.replace(/[^a-zA-Z0-9$%,.']/g, "").replace(/[,.]$/, "");
        return <span key={i} style={{ fontFamily: FONT, fontSize: 92, fontWeight: 900, textTransform: "uppercase", color: KEY.test(c) ? C.gold : C.text,
          opacity: t >= w.s - 0.02 ? 1 : 0.35, textShadow: "0 6px 24px rgba(0,0,0,0.85)", WebkitTextStroke: "2px rgba(0,0,0,0.5)" }}>{w.w.replace(/[,.]$/, "")}</span>; })}
    </div>
  );
};

export const Short: React.FC<ShortProps> = ({ video, words, dur, endCard, headline, cta }) => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const head = spring({ frame: f, fps, config: { damping: 13 } });
  const endAt = Math.round(dur * fps);
  const end = spring({ frame: f - endAt, fps, config: { damping: 11 } });
  const progress = interpolate(f, [0, durationInFrames], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 20% 15%, rgba(34,211,238,0.25), transparent 45%), radial-gradient(circle at 85% 90%, rgba(245,179,1,0.22), transparent 45%), linear-gradient(170deg, #0b1220, #111c33)` }}>
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />
      <div style={{ position: "absolute", top: 110, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
        <Logo /><span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, letterSpacing: 6, color: C.muted }}>FUTURE MONEY LAB</span>
      </div>
      <div style={{ position: "absolute", top: 230, left: 60, right: 60, textAlign: "center", fontFamily: DISPLAY, fontSize: 92, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2,
        color: C.text, opacity: head, transform: `translateY(${(1 - head) * 40}px)`, textShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>{headline}</div>
      <div style={{ position: "absolute", top: 660, left: 0, width: 1080, height: 515, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", borderTop: `4px solid ${C.cyan}`, borderBottom: `4px solid ${C.cyan}` }}>
        {f < endAt ? <OffthreadVideo src={staticFile(video)} muted style={{ width: 1080, height: 608, objectFit: "cover" }} /> : <div style={{ width: 1080, height: 515, background: "#05080f" }} />}
      </div>
      <div style={{ position: "absolute", top: 1290, left: 0, right: 0 }}>{f < endAt ? <BigCaptions words={words} /> : null}</div>
      {f >= endAt ? (
        <div style={{ position: "absolute", top: 1300, left: 80, right: 80, textAlign: "center", transform: `scale(${end})` }}>
          <div style={{ display: "inline-block", background: "#e11d22", color: "#fff", fontFamily: FONT, fontSize: 64, fontWeight: 900, padding: "26px 44px", borderRadius: 24 }}>▶ {cta}</div>
          <div style={{ marginTop: 26, fontFamily: FONT, fontSize: 44, fontWeight: 800, color: C.gold }}>@TheFutureMoneyLabAI</div>
        </div>) : null}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 10, width: `${progress * 100}%`, background: C.gold }} />
    </AbsoluteFill>
  );
};
