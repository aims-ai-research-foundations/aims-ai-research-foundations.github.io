/* Live Session 4 quiz content: questions, illustrations, animated explanations and the architecture explorer.
   Running example everywhere: "Ben was hungry so he went looking for ___".  Numbers are illustrative. */
"use strict";

/* ---------------- helpers shared with app.js ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MOTION = !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
let UID = 0;
const uid = p => p + (++UID);
const f2 = x => x.toFixed(2);
const softmax = (a, T = 1) => { const m = Math.max(...a.map(x => x / T)); const e = a.map(x => Math.exp(x / T - m)); const s = e.reduce((p, c) => p + c, 0); return e.map(x => x / s); };
const LET = ["A", "B", "C", "D"];
const COURSE_URL = "https://www.skills.google/paths/3135/course_templates/1451";   // Course 04 on Google Skills
const FONT = `font-family="Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif"`;

function K(src, display) {
  if (typeof katex === "undefined") return `<code class="tex">${esc(src)}</code>`;
  try { return katex.renderToString(src, { displayMode: !!display, throwOnError: false, strict: "ignore", trust: c => c.command === "\\htmlClass" }); }
  catch (e) { return `<code class="tex">${esc(src)}</code>`; }
}
const tex = (s, ...v) => K(String.raw(s, ...v), false);
const texd = (s, ...v) => K(String.raw(s, ...v), true);

const chip = (t, cls = "") => `<span class="tk ${cls}">${esc(t)}</span>`;
const P = (n, title, body) => `<section class="panel"><h4><span class="pn">${n}</span><span>${title}</span></h4>${body}</section>`;
const EQ = (html, cap) => `<div class="eqbox">${html}${cap ? `<div class="eqcap">${cap}</div>` : ""}</div>`;
const card = (cls, head, body) => `<div class="pc ${cls}"><b class="h">${head}</b>${body}</div>`;

/* run fn once, the first time el is on screen (explanations sit in closed accordions until opened) */
function whenVisible(el, fn) {
  if (!("IntersectionObserver" in window)) { fn(); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: 0.2 });
  io.observe(el);
}
const W = {};   // widget registry: <div data-w="name"> is filled in by W[name](el)
function mountAll(root) {
  $$("[data-w]", root).forEach(el => { if (el._mounted) return; el._mounted = true; const f = W[el.dataset.w]; if (f) f(el); });
}

/* ---------------- running example ---------------- */
const SENT = ["Ben", "was", "hungry", "so", "he", "went", "looking", "for"];
const RAW = [1.9, -0.4, 5.4, -0.2, 1.4, 2.2, 3.6, 1.7];            // q_for · k_j
const DK = 4;                                                      // toy key size, so we divide by √4 = 2
const SCALED = RAW.map(x => x / Math.sqrt(DK));
const WTS = softmax(SCALED);                                       // hungry 0.46, looking 0.19, ...
const VALS = [[0.2, -0.5, 0.1, 0.4], [0.0, 0.1, -0.2, 0.0], [0.9, 0.7, -0.3, 0.8], [0.1, 0.0, 0.1, -0.1],
              [0.3, -0.4, 0.2, 0.3], [-0.2, 0.3, 0.6, 0.1], [0.5, 0.2, 0.8, -0.2], [-0.1, 0.1, 0.4, -0.3]];
const OUT = [0, 1, 2, 3].map(c => VALS.reduce((s, v, j) => s + WTS[j] * v[c], 0));
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

const TICK = `<svg viewBox="0 0 24 24" fill="none" stroke="#5E9E48" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const CROSS = `<svg viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`;

/* coloured vector cells: v in [-1, 1]; rgb is the base colour */
const RGB = { q: "230,145,56", k: "60,120,216", v: "106,168,79", x: "142,124,195" };
function vec(vals, kind, opts = {}) {
  return `<span class="vec ${opts.mini ? "mini" : ""}" ${opts.style ? `style="${opts.style}"` : ""}>${vals.map(v =>
    `<span style="background:rgba(${RGB[kind]},${(0.12 + 0.7 * Math.min(1, Math.abs(v))).toFixed(2)})">${opts.mini ? "" : (v < 0 ? "−" : "") + Math.abs(v).toFixed(1)}</span>`).join("")}</span>`;
}

/* ======================================================================
   Transformer architecture, drawn bottom (input) to top (output)
   o.missing: FFN box shows "?"   o.hi: highlight a part   o.flow: animated dot
   o.interactive: blocks are buttons (architecture explorer)
   ====================================================================== */
const ARCH_PARTS = [
  ["probs", 14, "Next-token probabilities", "#EEF0F5", "#9AA3B8"],
  ["softmax", 72, "Softmax", "#E4DCF1", "#8E7CC3"],
  ["logits", 130, "Logits", "#FFF2CC", "#C9A227"],
  ["linear", 188, "Linear layer", "#CFE2F3", "#3C78D8"],
  ["addnorm", 270, "Add & Norm", "#D9EAD3", "#6AA84F"],
  ["ffn", 328, "Feed-forward (MLP)", "#FCE5CD", "#E69138"],
  ["addnorm", 386, "Add & Norm", "#D9EAD3", "#6AA84F"],
  ["attn", 444, "Masked self-attention", "#4C2BD6", "#4C2BD6", "#FFFFFF"],
  ["embed", 560, "Token embeddings", "#EEF0F5", "#9AA3B8"],
  ["tokens", 618, "Input tokens", "#EEF0F5", "#9AA3B8"],
];
function ARCH(o = {}) {
  const id = uid("ar"), X = 95, Wd = 210, H = 38, cx = X + Wd / 2;
  const btn = (part, label) => o.interactive ? `tabindex="0" role="button" aria-label="${esc(label)}"` : "";
  const box = ([part, y, label, fill, stroke, ink = "#1B1530"]) => {
    const missing = o.missing && part === "ffn";
    const cls = `ab ${o.hi === part ? "hi" : ""}`;
    if (missing) return `<g class="${cls}" data-part="${part}"><rect x="${X}" y="${y}" width="${Wd}" height="${H}" rx="10" fill="#FFFFFF" stroke="#361A54" stroke-width="2.6" stroke-dasharray="7 5"/><text x="${cx}" y="${y + 28}" text-anchor="middle" font-size="27" font-weight="800" fill="#361A54">?</text></g>`;
    return `<g class="${cls}" data-part="${part}" ${btn(part, label)}><rect class="ring" x="${X - 5}" y="${y - 5}" width="${Wd + 10}" height="${H + 10}" rx="14" fill="none" stroke="#FDD633" stroke-width="5"/><rect class="bx" x="${X}" y="${y}" width="${Wd}" height="${H}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><text x="${cx}" y="${y + H / 2 + 5.5}" text-anchor="middle" font-size="15.5" font-weight="700" fill="${ink}">${esc(label)}</text></g>`;
  };
  const up = (y1, y2) => `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 + 3}" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>`;
  const skip = (yFrom, yTo) => `<path d="M${cx} ${yFrom} H${X + Wd + 26} V${yTo + H / 2} H${X + Wd + 4}" fill="none" stroke="#7A5FC4" stroke-width="2.2" marker-end="url(#${id}p)"/>`;
  const flow = o.flow && MOTION ? `<circle r="7" fill="#FDD633" stroke="#361A54" stroke-width="2" pointer-events="none"><animateMotion dur="5s" repeatCount="indefinite" path="M${cx} 637 V 33"/></circle>` : "";
  return `<svg viewBox="0 0 380 676" role="img" aria-label="Transformer language model, from input tokens at the bottom to next-token probabilities at the top" ${FONT}>
  <defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7D7794"/></marker>
  <marker id="${id}p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7A5FC4"/></marker></defs>
  <g class="ab ${o.hi === "block" ? "hi" : ""}" data-part="block" ${btn("block", "Transformer block, repeated N times")}>
    <rect class="blk" x="42" y="248" width="324" height="258" rx="16" fill="#F3EFFB" stroke="#B9A9E3" stroke-width="1.6" stroke-dasharray="6 5"/>
    <text x="64" y="377" text-anchor="middle" font-size="14" font-weight="800" fill="#5B4596" transform="rotate(-90 64 377)">Transformer block × N</text></g>
  ${up(72, 52)}${up(130, 110)}${up(188, 168)}${up(270, 226)}${up(328, 308)}${up(386, 366)}${up(444, 424)}${up(520, 482)}${up(560, 544)}${up(618, 598)}
  ${skip(376, 270)}${skip(500, 386)}
  ${ARCH_PARTS.map(box).join("")}
  <circle cx="${cx}" cy="532" r="12" fill="#FFFFFF" stroke="#1B1530" stroke-width="2"/><text x="${cx}" y="538.5" text-anchor="middle" font-size="19" font-weight="700" fill="#1B1530">+</text>
  <g class="ab ${o.hi === "pos" ? "hi" : ""}" data-part="pos" ${btn("pos", "Positional encoding")}><rect class="ring" x="5" y="508" width="158" height="48" rx="13" fill="none" stroke="#FDD633" stroke-width="5"/><rect class="bx" x="10" y="513" width="148" height="38" rx="10" fill="#D6F0EE" stroke="#2A9D8F" stroke-width="1.6"/><text x="84" y="536.5" text-anchor="middle" font-size="13" font-weight="700" fill="#1B1530">Positional encoding</text></g>
  <line x1="158" y1="532" x2="185" y2="532" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
  ${flow}
  </svg>`;
}

/* attention lines from "for" back to every token (mode "q": question, "x": weights) */
function ARCS(mode) {
  const n = SENT.length, top = 20, gap = 34, ny = top + gap * (n - 1) / 2, mx = Math.max(...WTS);
  const lines = SENT.map((t, i) => {
    const y = top + gap * i, w = WTS[i];
    const style = mode === "x"
      ? `stroke="${i === 2 ? "#E69138" : "#8E7CC3"}" stroke-width="${(1.5 + 15 * w).toFixed(1)}" stroke-opacity="${(0.3 + 0.7 * w / mx).toFixed(2)}"`
      : `stroke="#CFCADB" stroke-width="2"`;
    return `<line class="ln" style="--i:${i}" x1="138" y1="${y}" x2="262" y2="${ny}" ${style} stroke-linecap="round" pathLength="1"/>`;
  }).join("");
  const labels = SENT.map((t, i) => {
    const y = top + gap * i;
    return `<text x="92" y="${y + 5}" text-anchor="end" font-size="15" font-weight="700" fill="${mode === "x" && i === 2 ? "#B4651C" : "#1B1530"}">${t}</text>
      <text class="wl" style="--i:${i}" x="100" y="${y + 5}" font-size="13" font-weight="700" fill="${mode === "x" && i === 2 ? "#B4651C" : "#655F78"}">${mode === "x" ? f2(WTS[i]) : "?"}</text>
      <circle cx="136" cy="${y}" r="3.5" fill="#8A84A0"/>`;
  }).join("");
  return `<svg viewBox="0 0 360 ${top + gap * (n - 1) + 26}" class="arcs ${mode}" role="img" aria-label="The token for looks back at every earlier token" ${FONT}>
    ${lines}${labels}
    <rect x="262" y="${ny - 19}" width="86" height="38" rx="10" fill="#FCE5CD" stroke="#E69138" stroke-width="1.8"/>
    <text x="305" y="${ny + 6}" text-anchor="middle" font-size="16" font-weight="800" fill="#1B1530">for</text>
    <text x="305" y="${ny + 40}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#655F78">looks back</text>
    <text x="305" y="${ny + 56}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#655F78">at every token</text>
  </svg>`;
}

/* residual connection + layer norm, bottom to top */
function RESID(mode) {
  const id = uid("rs"), cx = 150, x = mode === "x";
  const ar = (y1, y2) => `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 + 3}" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>`;
  const dots = x && MOTION ? `
    <circle r="6.5" fill="#FDD633" stroke="#361A54" stroke-width="2"><animateMotion dur="3.4s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.75;1" calcMode="linear" path="M${cx} 286 V 120"/></circle>
    <circle r="6.5" fill="#B9A9E3" stroke="#5B4596" stroke-width="2"><animateMotion dur="3.4s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.75;1" calcMode="linear" path="M${cx} 286 V 240 H 318 V 120 H ${cx + 2}"/></circle>` : "";
  return `<svg viewBox="0 0 360 318" role="img" aria-label="Residual connection: x skips around the sub-layer and is added back, then layer norm" ${FONT}>
  <defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7D7794"/></marker>
  <marker id="${id}p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5B4596"/></marker></defs>
  <rect x="30" y="28" width="240" height="110" rx="14" fill="none" stroke="#9DBE5A" stroke-width="1.6" stroke-dasharray="6 5"/>
  <text x="20" y="85" text-anchor="middle" font-size="13" font-weight="800" fill="#4E7A2A" transform="rotate(-90 20 85)">Add &amp; Norm</text>
  <line x1="${cx}" y1="40" x2="${cx}" y2="8" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
  <text x="${cx + 10}" y="18" font-size="12.5" font-weight="600" fill="#655F78">output</text>
  <rect x="50" y="40" width="200" height="38" rx="10" fill="#D9EAD3" stroke="#6AA84F" stroke-width="1.6"/><text x="${cx}" y="64" text-anchor="middle" font-size="15" font-weight="700" fill="#1B1530">Layer norm</text>
  ${ar(102, 78)}
  <circle cx="${cx}" cy="118" r="16" fill="#FFFFFF" stroke="#1B1530" stroke-width="2.2"/><text x="${cx}" y="125" text-anchor="middle" font-size="22" font-weight="700" fill="#1B1530">+</text>
  ${ar(160, 134)}
  <rect x="40" y="160" width="220" height="50" rx="11" fill="#4C2BD6"/><text x="${cx}" y="183" text-anchor="middle" font-size="15.5" font-weight="700" fill="#FFFFFF">Sub-layer</text><text x="${cx}" y="200" text-anchor="middle" font-size="12" font-weight="600" fill="#D9D2FA">attention or feed-forward</text>
  ${ar(268, 210)}
  <rect x="100" y="268" width="100" height="36" rx="10" fill="#EEF0F5" stroke="#9AA3B8" stroke-width="1.6"/><text x="${cx}" y="291" text-anchor="middle" font-size="16" font-weight="800" font-style="italic" fill="#1B1530">x</text>
  <path d="M${cx} 240 H318 V118 H${cx + 19}" fill="none" stroke="#5B4596" stroke-width="2.6" marker-end="url(#${id}p)"/>
  ${x ? `<text x="${cx + 10}" y="153" font-size="13" font-weight="700" fill="#4C2BD6">Sublayer(x)</text>
  <text x="${cx - 12}" y="96" text-anchor="end" font-size="13" font-weight="700" fill="#1B1530">x + Sublayer(x)</text>
  <text x="336" y="180" text-anchor="middle" font-size="12.5" font-weight="700" fill="#5B4596" transform="rotate(90 336 180)">residual: x skips around</text>` : ""}
  ${dots}
  </svg>`;
}

/* the causal mask, big and centred */
function MASK() {
  const n = SENT.length;
  let h = `<div class="mgrid" style="--n:${n}" role="table" aria-label="Causal mask: each token can attend to itself and earlier tokens only"><span></span>`;
  h += SENT.map((t, j) => `<span class="mcol" data-c="${j}">${t}</span>`).join("");
  for (let i = 0; i < n; i++) {
    h += `<span class="mrow" data-r="${i}" tabindex="0">${SENT[i]}</span>`;
    for (let j = 0; j < n; j++) h += `<span class="mc ${j <= i ? "y" : "n"}" data-r="${i}" data-c="${j}" style="--d:${(i * 60 + j * 30)}ms">${j <= i ? TICK : CROSS}</span>`;
  }
  return h + `</div>`;
}

/* every pair of tokens gets a score (QKᵀ) */
function SCOREGRID() {
  const n = SENT.length;
  let h = `<div class="mgrid" style="--n:${n};--cs:clamp(22px,5.6vw,40px)"><span></span>` + SENT.map(t => `<span class="mcol">${t}</span>`).join("");
  for (let i = 0; i < n; i++) {
    h += `<span class="mrow">${SENT[i]}</span>`;
    for (let j = 0; j < n; j++) h += `<span class="mc" style="background:rgba(142,124,195,${(0.12 + 0.6 * hash(i, j)).toFixed(2)});border-color:rgba(91,69,150,.25)"></span>`;
  }
  return h + `</div>`;
}

/* ======================================================================
   Widgets (animated or interactive pieces of the explanations)
   ====================================================================== */
function bars(rows, opts = {}) {
  // rows: [label, value, widthPercent, cls]
  return rows.map(([t, v, w, cls]) => `<div class="brow ${cls || ""}"><span class="t">${esc(t)}</span><span class="bar"><i style="width:${opts.start ? 0 : w}%" data-w="${w}"></i></span><span class="n">${v}</span></div>`).join("");
}
const grow = root => requestAnimationFrame(() => requestAnimationFrame(() => $$("i[data-w]", root).forEach(i => i.style.width = i.dataset.w + "%")));
function replayable(el, play) {
  const b = $(".replay", el); if (b) b.onclick = () => play();
  if (!MOTION) { play(true); return; }
  whenVisible(el, () => play());
}

/* Q1: predict, append, repeat */
W.nexttok = el => {
  const steps = [
    { dist: [["food", 0.64], ["something", 0.11], ["water", 0.09], ["lunch", 0.07]], pick: "food" },
    { dist: [[".", 0.41], ["and", 0.19], [",", 0.12], ["in", 0.08]], pick: "." },
  ];
  el.innerHTML = `<div class="nt-sent"></div><div class="nt-dist"></div><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const sent = $(".nt-sent", el), dist = $(".nt-dist", el), cap = $(".cap", el);
  let run = 0;
  const drawSent = (words, fresh, blank) => { sent.innerHTML = words.map((t, i) => chip(t, i === fresh ? "new" : "")).join("") + (blank ? chip("?", "blank") : ""); };
  const drawDist = (d, pick, start) => { dist.innerHTML = bars(d.map(([t, p]) => [t, f2(p), p * 100 / 0.7, t === pick ? "pick" : ""]), { start }) + `<div class="more">…and a probability for every other token in the vocabulary</div>`; if (start) grow(dist); };
  async function play(still) {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (still) { drawSent(SENT.concat("food", "."), 9, false); drawDist(steps[1].dist, "."); cap.innerHTML = "Predict, pick, append, repeat: one token at a time."; return; }
    let words = SENT.slice();
    for (let s = 0; s < steps.length; s++) {
      drawSent(words, s ? words.length - 1 : -1, true); dist.innerHTML = "";
      cap.innerHTML = s ? "<b>Again:</b> the new token is now part of the context" : "<b>1.</b> Give every token in the vocabulary a probability";
      await sleep(600); if (!ok()) return;
      drawDist(steps[s].dist, null, true);
      await sleep(1800); if (!ok()) return;
      $$(".brow", dist)[0].classList.add("pick");
      cap.innerHTML = `<b>2.</b> Pick one: “${esc(steps[s].pick)}” (here the most likely; models can also sample)`;
      await sleep(1600); if (!ok()) return;
      words = words.concat(steps[s].pick);
      drawSent(words, words.length - 1, false);
      cap.innerHTML = "<b>3.</b> Append it to the context";
      await sleep(1500); if (!ok()) return;
    }
    cap.innerHTML = "…and repeat, one token at a time, until the model predicts an end-of-text token.";
  }
  replayable(el, play);
};

/* Q2: the trigram window slides along and loses the clue */
W.ngram = el => {
  const toks = SENT.concat("?");
  el.innerHTML = `<p class="cap" style="margin:0 0 10px">Trigram model: predict each word from the <b>2 words</b> before it</p>
    <div class="toks ng">${toks.map((t, i) => chip(t, t === "?" ? "blank" : "")).join("")}</div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const cs = $$(".ng .tk", el), cap = $(".wg-foot .cap", el);
  let run = 0;
  const mark = (t, final) => cs.forEach((c, i) => {
    c.className = "tk" + (toks[i] === "?" ? " blank" : "");
    if (i === t - 2 || i === t - 1) c.classList.add("win");
    else if (i === t) c.classList.add("tgt");
    else if (i < t - 2) c.classList.add(final && i === 2 ? "clue" : "fade");
    else c.classList.add("ghost");
  });
  async function play(still) {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (!still) for (let t = 2; t < toks.length - 1; t++) {
      mark(t); cap.innerHTML = `Predicting “${toks[t]}” from only “${toks[t - 2]} ${toks[t - 1]}”`;
      await sleep(900); if (!ok()) return;
    }
    mark(8, true);
    cap.innerHTML = `At the blank it sees only <b>“looking for”</b>. The clue, <b style="color:#B3261E">“hungry”</b>, is out of view.`;
  }
  replayable(el, play);
};

/* Q3: attention lines grow in */
W.arcs = el => {
  el.innerHTML = ARCS("x") + `<div class="wg-foot"><span class="cap">Line thickness = attention weight. The weights add up to 1.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const svg = $("svg", el);
  replayable(el, still => {
    if (still) { svg.classList.add("play", "still"); return; }
    svg.classList.add("reset"); svg.classList.remove("play"); void svg.getBoundingClientRect();
    svg.classList.remove("reset"); requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add("play")));
  });
};

/* Q4: attention, one step at a time */
const ATTN_EQ = () => texd`\mathrm{Attention}(\htmlClass{eq-q}{Q},\htmlClass{eq-k}{K},\htmlClass{eq-v}{V}) = \htmlClass{eq-sm}{\mathrm{softmax}}\!\left(\frac{\htmlClass{eq-qk}{\htmlClass{eq-q}{Q}\,\htmlClass{eq-k}{K^{\top}}}}{\htmlClass{eq-sc}{\sqrt{d_k}}}\right)\htmlClass{eq-v}{V}`;
W.stepper = el => {
  const XF = [0.3, -0.6, 0.8, 0.1], QF = [0.9, 0.2, -0.4, 0.7], KF = [0.1, 0.5, 0.3, -0.2];
  const order = [2, 6, 5, 0, 7, 4, 1, 3];                     // rows sorted by weight, biggest first
  const keyMini = i => vec([0, 1, 2, 3].map(c => (hash(i, c) * 2 - 1)), "k", { mini: true });
  const rowsHTML = mode => order.map(i => {
    const top = i === 2 || i === 6;
    let val, w, cls = "";
    if (mode === 2) { val = RAW[i].toFixed(1); w = Math.max(0, RAW[i]) / 5.4 * 100; }
    else if (mode === 3) { val = SCALED[i].toFixed(2); w = Math.max(0, SCALED[i]) / 5.4 * 100; }
    else { val = f2(WTS[i]); w = WTS[i] / 0.5 * 100; cls = "w"; }
    return `<div class="sr ${top ? "top" : ""}"><span class="t">${SENT[i]}</span>${keyMini(i)}<span class="bar"><i class="${cls}" data-w="${w.toFixed(1)}"></i></span><span class="n ${parseFloat(val) < 0 ? "neg" : ""}">${val}</span></div>`;
  }).join("");
  const steps = [
    { t: "Three roles for every token",
      stage: () => `<div class="s1 anim-in">
        <div class="xrow"><b>x<sub>for</sub></b>${vec(XF, "x")}<span class="cap">the vector for “for”</span></div>
        <div class="row"><span class="op">× W<sub>Q</sub> →</span>${vec(QF, "q")}<span class="role"><b style="color:#B4651C">Query q</b>What am I looking for?</span></div>
        <div class="row"><span class="op">× W<sub>K</sub> →</span>${vec(KF, "k")}<span class="role"><b style="color:#2A5DB0">Key k</b>What do I offer? How do others find me?</span></div>
        <div class="row"><span class="op">× W<sub>V</sub> →</span>${vec(VALS[7], "v")}<span class="role"><b style="color:#4E7A2A">Value v</b>What do I pass on if I’m chosen?</span></div></div>`,
      text: `<p>Every token’s vector <b>x</b> is multiplied by three learned weight matrices, giving it three new vectors: a <b style="color:#B4651C">query</b>, a <b style="color:#2A5DB0">key</b> and a <b style="color:#4E7A2A">value</b>. Every token gets all three, made with the same three matrices.</p><p>Let’s follow the query of <b>“for”</b> as it works out what to pay attention to.</p>` },
    { t: "Score: compare the query with every key",
      stage: () => `<div class="cap" style="text-align:center;margin-bottom:8px">${tex`\text{score}_j = q_{\text{for}} \cdot k_j`}</div>${rowsHTML(2)}`,
      text: `<p>The query of “for” is compared with the <b style="color:#2A5DB0">key</b> of every token up to itself, using a dot product. The more two vectors point the same way, the bigger the score. <b>“hungry”</b> matches best (5.4), then <b>“looking”</b> (3.6).</p>` },
    { t: "Scale: divide by √d<sub>k</sub>",
      stage: () => `<div class="cap" style="text-align:center;margin-bottom:8px">${tex`\text{score}_j \,/\, \sqrt{d_k} \;=\; \text{score}_j \,/\, 2`}</div>${rowsHTML(3)}`,
      text: `<p>Dot products get bigger as the vectors get longer (d<sub>k</sub> numbers each). Dividing by √d<sub>k</sub> keeps the scores in a moderate range, so softmax doesn’t put nearly all the weight on one token and learning stays smooth.</p><p>Here d<sub>k</sub> = 4, so we divide by 2. Real models use d<sub>k</sub> = 64 or 128.</p>` },
    { t: "Softmax: turn scores into weights",
      stage: () => `<div class="cap" style="text-align:center;margin-bottom:8px">${tex`w_j = \mathrm{softmax}_j\!\left(\text{score} / \sqrt{d_k}\right)`}</div>${rowsHTML(4)}<div class="sumline">all weights add up to 1.00</div>`,
      text: `<p>Softmax makes every weight positive and makes them add up to 1. “for” will take <b>46%</b> of its new information from “hungry” and <b>19%</b> from “looking”.</p><p>Tokens that come after “for” would get a weight of exactly 0, thanks to the causal mask (Question 7).</p>` },
    { t: "Mix the values",
      stage: () => `<div>${order.map(i => `<div class="sr" style="grid-template-columns:72px 50px auto"><span class="t">${SENT[i]}</span><span class="n">${f2(WTS[i])} ×</span>${vec(VALS[i], "v", { style: `opacity:${(0.18 + 0.82 * WTS[i] / WTS[2]).toFixed(2)}` })}</div>`).join("")}
        <div class="outrow"><span>= new vector for “for”</span>${vec(OUT, "v")}</div></div>`,
      text: `<p>The output for “for” is the weighted sum of the <b style="color:#4E7A2A">value</b> vectors: 0.46 × v<sub>hungry</sub> + 0.19 × v<sub>looking</sub> + … (faded rows count for little).</p><p>This new, <b>contextual</b> vector for “for” now carries “someone hungry is looking”, which points the model towards “food”.</p>` },
    { t: "All tokens at once: the full equation",
      stage: () => {
        const grid = (r, c, fn) => `<span class="g" style="grid-template-columns:repeat(${c},var(--cell))">${Array.from({ length: r * c }, (_, k) => { const i = Math.floor(k / c), j = k % c; return `<span style="background:${fn(i, j)}"></span>`; }).join("")}</span>`;
        const col = (kind, a) => `rgba(${RGB[kind]},${a.toFixed(2)})`;
        const raw = (i, j) => j > i ? "#E6E3EC" : col("x", 0.2 + 0.7 * hash(i + 3, j));
        const wts = Array.from({ length: 8 }, (_, i) => softmax(Array.from({ length: i + 1 }, (_, j) => 3 * hash(i + 3, j))));
        const wcell = (i, j) => j > i ? "#E6E3EC" : col("x", 0.12 + 0.85 * Math.min(1, wts[i][j] * (i + 1) / 2.2));
        const m = (g, label) => `<span class="mat">${g}<span class="ml">${label}</span></span>`;
        return `<div class="mats anim-in">
          ${m(grid(8, 4, (i, j) => col("q", 0.2 + 0.7 * hash(i, j))), "Q · 8 × d")}<span class="op">·</span>
          ${m(grid(4, 8, (i, j) => col("k", 0.2 + 0.7 * hash(j, i + 5))), "K<sup>⊤</sup> · d × 8")}<span class="op">=</span>
          ${m(grid(8, 8, raw), "scores · 8 × 8")}<span class="op">→<small>scale, mask,<br>softmax</small></span>
          ${m(grid(8, 8, wcell), "weights · rows sum to 1")}<span class="op">×</span>
          ${m(grid(8, 4, (i, j) => col("v", 0.2 + 0.7 * hash(i + 9, j))), "V · 8 × d")}<span class="op">=</span>
          ${m(grid(8, 4, (i, j) => col("v", 0.3 + 0.6 * hash(i + 1, j + 2))), "output · 8 × d")}</div>`;
      },
      text: `<p>Every token does steps 2 to 5 <b>at the same time</b>. Stack the queries as the rows of <b style="color:#B4651C">Q</b>, the keys as <b style="color:#2A5DB0">K</b> and the values as <b style="color:#4E7A2A">V</b>. One matrix product QK<sup>⊤</sup> gives the whole table of scores: one row per token asking, one column per token being looked at (grey cells are the future, masked out). Scale, softmax each row, multiply by V, and every token gets its new vector in parallel.</p><p>A Transformer runs several of these <b>attention heads</b> side by side, each with its own W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub>, so each head can track a different kind of relationship.</p>` },
  ];
  el.innerHTML = `<div class="st" data-s="1"><div class="st-eq">${ATTN_EQ()}</div>
    <div class="st-nav"><div class="st-dots">${steps.map((_, i) => `<button type="button" data-i="${i}" aria-label="Step ${i + 1}">${i + 1}</button>`).join("")}</div>
      <button class="btn ghost small" data-a="prev" type="button">← Back</button><button class="btn small" data-a="next" type="button">Next step →</button><button class="btn ghost small" data-a="play" type="button">▶ Play all</button></div>
    <div class="st-title"></div><div class="st-stage"></div><div class="st-text"></div></div>`;
  const root = $(".st", el), stage = $(".st-stage", el), title = $(".st-title", el), text = $(".st-text", el);
  const seen = new Set(); let cur = 0, timer = null;
  function show(i) {
    cur = Math.max(0, Math.min(steps.length - 1, i)); seen.add(cur);
    root.dataset.s = cur + 1;
    title.innerHTML = `Step ${cur + 1} of ${steps.length} · ${steps[cur].t}`;
    // keep the previous bar widths so 2 → 3 → 4 morphs instead of redrawing
    const prev = $$(".sr .bar i", stage).map(i => i.style.width);
    stage.innerHTML = steps[cur].stage(); text.innerHTML = steps[cur].text;
    const now = $$(".sr .bar i", stage), morph = prev.length === now.length && cur >= 2 && cur <= 3;
    now.forEach((b, k) => b.style.width = morph ? prev[k] : "0%");
    grow(stage);
    $$(".st-dots button", el).forEach((b, k) => { b.classList.toggle("on", k === cur); b.classList.toggle("seen", seen.has(k)); });
    $('[data-a="prev"]', el).disabled = cur === 0;
    $('[data-a="next"]', el).disabled = cur === steps.length - 1;
  }
  const stop = () => { clearInterval(timer); timer = null; $('[data-a="play"]', el).innerHTML = "▶ Play all"; };
  $$(".st-dots button", el).forEach(b => b.onclick = () => { stop(); show(+b.dataset.i); });
  $('[data-a="prev"]', el).onclick = () => { stop(); show(cur - 1); };
  $('[data-a="next"]', el).onclick = () => { stop(); show(cur + 1); };
  $('[data-a="play"]', el).onclick = () => {
    if (timer) { stop(); return; }
    if (cur === steps.length - 1) show(0);
    $('[data-a="play"]', el).innerHTML = "❚❚ Pause";
    timer = setInterval(() => { if (!el.isConnected || cur === steps.length - 1) { stop(); return; } show(cur + 1); }, 7000);
  };
  show(0);
};

/* Q5: the feed-forward network lights up: expand, activate, compress */
W.ffn = el => {
  const IN = [65, 105, 145, 185], HID = Array.from({ length: 10 }, (_, j) => 17 + j * 24), ON = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0];
  let e1 = "", e2 = "";
  IN.forEach(y1 => HID.forEach(y2 => e1 += `<line class="ffn-e e1" x1="48" y1="${y1}" x2="172" y2="${y2}" stroke-width="1.1"/>`));
  HID.forEach((y1, j) => IN.forEach(y2 => e2 += `<line class="ffn-e e2 ${ON[j] ? "on" : ""}" x1="188" y1="${y1}" x2="312" y2="${y2}" stroke-width="1.1"/>`));
  const node = (x, y, cls, r) => `<circle class="ffn-n ${cls}" cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" stroke="#B9B3C9" stroke-width="1.8"/>`;
  el.innerHTML = `<svg class="ffnsvg" viewBox="0 0 360 300" role="img" aria-label="Feed-forward network: 4 inputs expand to 10 hidden neurons, then compress back to 4 outputs" ${FONT}>
    ${e1}${e2}
    ${IN.map(y => node(40, y, "in", 9)).join("")}${HID.map((y, j) => node(180, y, "hid " + (ON[j] ? "on" : "off"), 8)).join("")}${IN.map(y => node(320, y, "out", 9)).join("")}
    <text x="110" y="268" text-anchor="middle" font-size="13" font-weight="700" fill="#5B4596">W₁ x + b₁</text>
    <text x="250" y="268" text-anchor="middle" font-size="13" font-weight="700" fill="#B4651C">W₂ (·) + b₂</text>
    <text x="40" y="290" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1B1530">x · d</text>
    <text x="180" y="290" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1B1530">σ · 4d neurons</text>
    <text x="320" y="290" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1B1530">FFN(x) · d</text>
  </svg><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const svg = $("svg", el), cap = $(".cap", el);
  const caps = ["<b>1. Expand:</b> W₁ spreads the token’s d numbers over 4d neurons",
                "<b>2. Activate:</b> the non-linearity σ lets some neurons fire (orange) and switches others off",
                "<b>3. Compress:</b> W₂ combines the active neurons back into d numbers",
                "The same network runs on every token’s vector, one token at a time"];
  let run = 0;
  async function play(still) {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (still) { svg.setAttribute("class", "ffnsvg p1 p2 p3"); cap.innerHTML = caps[3]; return; }
    for (let loop = 0; loop < 3; loop++) {
      svg.setAttribute("class", "ffnsvg"); cap.innerHTML = caps[0]; await sleep(500); if (!ok()) return;
      svg.classList.add("p1"); await sleep(1700); if (!ok()) return;
      svg.classList.add("p2"); cap.innerHTML = caps[1]; await sleep(1900); if (!ok()) return;
      svg.classList.add("p3"); cap.innerHTML = caps[2]; await sleep(2300); if (!ok()) return;
      cap.innerHTML = caps[3]; await sleep(1800); if (!ok()) return;
    }
  }
  replayable(el, play);
};

/* Q6: layer norm, before and after */
W.lnorm = el => {
  const h = [6.2, -1.8, 9.4, 2.6, -4.0, 11.2];
  const mu = h.reduce((a, b) => a + b, 0) / h.length, sd = Math.sqrt(h.reduce((a, b) => a + (b - mu) ** 2, 0) / h.length);
  const n = h.map(v => (v - mu) / sd);
  const chart = (vals, max, colour, label, sub) => {
    const bw = 26, gap = 10, H = 70, w0 = 18, mid = 92;
    const bars = vals.map((v, i) => {
      const x = w0 + i * (bw + gap), hgt = Math.abs(v) / max * H, y = v >= 0 ? mid - hgt : mid;
      return `<rect class="lnb" x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${hgt.toFixed(1)}" rx="4" fill="${colour}" style="--i:${i}"/>
        <text x="${x + bw / 2}" y="${(v >= 0 ? y - 5 : y + hgt + 14).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1B1530">${v.toFixed(1)}</text>`;
    }).join("");
    return `<div><div class="cap" style="text-align:center"><b>${label}</b><br>${sub}</div>
      <svg viewBox="0 0 240 184" ${FONT}><line x1="10" y1="92" x2="232" y2="92" stroke="#8A84A0" stroke-width="1.4"/><text x="234" y="96" font-size="11" fill="#8A84A0" text-anchor="end"></text>${bars}</svg></div>`;
  };
  el.innerHTML = `<div class="cols" style="gap:10px">${chart(h, 12, "#B9A9E3", "Before: x + Sublayer(x)", `mean ${mu.toFixed(1)} · spread ${sd.toFixed(1)}`)}${chart(n, 1.6, "#93C47D", "After layer norm", "mean 0 · spread 1")}</div>
    <p class="cap" style="text-align:center;margin:6px 0 0">One token’s values (6 of them here; 768 in GPT-2 small). Same shape, now centred on 0 with a standard spread.</p>`;
};

/* Q7: the mask: pop in, then tap a row */
W.mask = el => {
  el.innerHTML = MASK() + `<div class="mlegend"><span><i style="background:#E3F1DC;border-color:#93C47D"></i>can attend</span><span><i style="background:#F1F0F3;border-color:#DAD6E0"></i>blocked (the future)</span></div>
    <div class="wg-foot"><span class="cap">Tap a row to see what that token can look at.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const g = $(".mgrid", el), cap = $(".wg-foot .cap", el);
  const select = r => {
    g.classList.add("sel");
    $$(".mc", g).forEach(c => c.classList.toggle("on", +c.dataset.r === r));
    $$(".mrow", g).forEach(c => c.classList.toggle("on", +c.dataset.r === r));
    $$(".mcol", g).forEach(c => c.classList.toggle("on", +c.dataset.c <= r));
    const seen = SENT.slice(0, r + 1), hidden = SENT.slice(r + 1);
    cap.innerHTML = `<b>“${SENT[r]}”</b> can look at: ${seen.map(t => `“${t}”`).join(", ")}.` + (hidden.length ? ` Hidden: ${hidden.map(t => `“${t}”`).join(", ")}.` : " Nothing is hidden: it is the last token.");
  };
  $$(".mrow, .mc", g).forEach(c => { c.onclick = () => select(+c.dataset.r); c.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(+c.dataset.r); } }; });
  replayable(el, still => {
    g.classList.remove("play", "sel"); $$(".on", g).forEach(c => c.classList.remove("on"));
    cap.innerHTML = "Tap a row to see what that token can look at.";
    if (still) return;
    void g.offsetWidth; g.classList.add("play");
    setTimeout(() => { if (el.isConnected && !g.classList.contains("sel")) select(2); }, 2600);
  });
};

/* Q8: sinusoidal waves, a marker slides along the positions */
W.sinus = el => {
  const ws = [0, 1, 2, 3].map(i => Math.pow(10000, -i / 8)), x0 = 92, x1 = 344, P = 24;
  const px = p => x0 + p * (x1 - x0) / P, base = k => 34 + k * 46, A = 16;
  const path = w => Array.from({ length: 97 }, (_, s) => { const p = s * P / 96; return `${s ? "L" : "M"}${px(p).toFixed(1)} ${(-Math.sin(p * w) * A).toFixed(1)}`; }).join(" ");
  el.innerHTML = `<svg viewBox="0 0 360 214" role="img" aria-label="Sinusoidal positional encoding: each dimension is a wave of a different speed" ${FONT}>
    ${ws.map((w, k) => `<g transform="translate(0 ${base(k)})"><line x1="${x0}" x2="${x1}" y1="0" y2="0" stroke="#ECE9F2"/><path d="${path(w)}" fill="none" stroke="${["#3C78D8", "#8E7CC3", "#2A9D8F", "#E69138"][k]}" stroke-width="2.2"/>
      <text x="6" y="-2" font-size="12.5" font-weight="700" fill="#1B1530">dim ${2 * k}</text><text x="6" y="13" font-size="11" fill="#655F78">${["fast", "", "", "slow"][k]}</text>
      <circle class="sd" r="5" cx="${x0}" cy="0" fill="#FFFFFF" stroke="#1B1530" stroke-width="2"/></g>`).join("")}
    <line class="sm" x1="${x0}" x2="${x0}" y1="12" y2="196" stroke="#361A54" stroke-width="1.6" stroke-dasharray="4 4"/>
    <text x="${x0}" y="210" font-size="11.5" fill="#655F78">position 0</text><text x="${x1}" y="210" text-anchor="end" font-size="11.5" fill="#655F78">24</text>
  </svg><div class="wg-foot"><span class="cap sread"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const dots = $$(".sd", el), marker = $(".sm", el), read = $(".sread", el);
  let run = 0;
  const at = p => {
    marker.setAttribute("x1", px(p)); marker.setAttribute("x2", px(p));
    dots.forEach((d, k) => { d.setAttribute("cx", px(p)); d.setAttribute("cy", (-Math.sin(p * ws[k]) * A).toFixed(1)); });
    read.innerHTML = `<b>pos = ${p}</b> → PE = [${ws.map(w => Math.sin(p * w).toFixed(2)).join(", ")}, …] (sine dimensions shown)`;
  };
  async function play(still) {
    const my = ++run; if (still) { at(7); return; }
    for (let loop = 0; loop < 2; loop++) for (let p = 0; p <= P; p++) { if (my !== run || !el.isConnected) return; at(p); await sleep(380); }
    at(7);
  }
  replayable(el, play);
};

/* Q8: RoPE, two arrows rotate with position; the angle between them only depends on the distance */
W.rope = el => {
  const cx = 130, cy = 118, R = 92, th = 22, q0 = 18, k0 = 52;   // degrees per position, base angles
  const arrow = (cls, col) => `<g class="${cls}" style="transform-origin:${cx}px ${cy}px;transform-box:view-box;transition:transform .8s cubic-bezier(.3,.7,.3,1)"><line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${col}" stroke-width="4" stroke-linecap="round"/><path d="M${cx + R + 9} ${cy}L${cx + R - 6} ${cy - 8}L${cx + R - 6} ${cy + 8}z" fill="${col}"/></g>`;
  el.innerHTML = `<div class="cols" style="align-items:center;gap:10px"><svg viewBox="0 0 260 236" role="img" aria-label="RoPE rotates the query and key by angles proportional to their positions" ${FONT}>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="#FAF8FD" stroke="#E4DCF1" stroke-width="1.6"/><line x1="${cx - R - 8}" x2="${cx + R + 8}" y1="${cy}" y2="${cy}" stroke="#ECE9F2"/><line y1="${cy - R - 8}" y2="${cy + R + 8}" x1="${cx}" x2="${cx}" stroke="#ECE9F2"/>
      ${arrow("rk", "#3C78D8")}${arrow("rq", "#E69138")}<circle cx="${cx}" cy="${cy}" r="5" fill="#1B1530"/>
      <text x="8" y="228" font-size="12.5" font-weight="700" fill="#B4651C">query at position m</text><text x="252" y="228" text-anchor="end" font-size="12.5" font-weight="700" fill="#2A5DB0">key at n</text></svg>
    <div><div class="rope-read"><div>query m<b class="rm">0</b></div><div>key n<b class="rn">2</b></div><div>distance<b class="rd">2</b></div></div>
      <div class="rope-read" style="grid-template-columns:1fr"><div>score q′ · k′<b class="rs">0.00</b></div></div><p class="cap rcap" style="margin:10px 0 0"></p></div></div>
    <div class="wg-foot"><span></span><button class="replay" type="button">↻ Replay</button></div>`;
  const rq = $(".rq", el), rk = $(".rk", el), F = c => $(c, el);
  let run = 0;
  const at = (m, n, msg) => {
    rq.style.transform = `rotate(${-(q0 + m * th)}deg)`; rk.style.transform = `rotate(${-(k0 + n * th)}deg)`;
    F(".rm").textContent = m; F(".rn").textContent = n; F(".rd").textContent = n - m;
    F(".rs").textContent = Math.cos(((k0 + n * th) - (q0 + m * th)) * Math.PI / 180).toFixed(2);
    F(".rcap").innerHTML = msg;
  };
  const same = "<b>Both tokens move along the sentence:</b> both arrows turn by the same amount, so the angle between them, and the score, stays the same.";
  const apart = "<b>The key moves further away:</b> the angle between them grows and the score changes. Only the distance n − m matters.";
  async function play(still) {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (still) { at(3, 5, same); return; }
    for (let loop = 0; loop < 2; loop++) {
      for (let m = 0; m <= 5; m++) { at(m, m + 2, same); await sleep(1100); if (!ok()) return; }
      for (let n = 3; n <= 8; n++) { at(2, n, apart); await sleep(1100); if (!ok()) return; }
    }
  }
  replayable(el, play);
};

/* Q9: logits → exponentiate → divide by the sum */
const LOGITS = [["food", 4.1], ["water", 2.3], ["lunch", 1.7], ["keys", 0.2]];
W.softmax = el => {
  const z = LOGITS.map(r => r[1]), e = z.map(Math.exp), s = e.reduce((a, b) => a + b, 0), p = e.map(x => x / s);
  const stages = [
    { b: z.map((v, i) => [LOGITS[i][0], v.toFixed(1), v / 4.1 * 100]), c: "<b>Logits:</b> raw scores from the linear layer, one per vocabulary token. They can be any number, even negative." },
    { b: e.map((v, i) => [LOGITS[i][0], v.toFixed(1), v / e[0] * 100]), c: `<b>Exponentiate:</b> e<sup>z</sup> makes every value positive and stretches the gaps: 4.1 → 60.3, but 0.2 → 1.2.` },
    { b: p.map((v, i) => [LOGITS[i][0], f2(v), v * 100, i === 0 ? "pick" : ""]), c: `<b>Divide by the sum</b> (${s.toFixed(1)}): every value is now between 0 and 1, and they add up to 1.` },
  ];
  el.innerHTML = `<div class="tabs">${["1 · Logits", "2 · Exponentiate", "3 · Divide by the sum"].map((t, i) => `<button type="button" data-i="${i}">${t}</button>`).join("")}</div>
    <div class="smrows">${bars(stages[0].b, { start: true })}</div><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const rows = $(".smrows", el), cap = $(".wg-foot .cap", el);
  const show = k => {
    $$(".tabs button", el).forEach((b, i) => b.classList.toggle("on", i === k));
    $$(".brow", rows).forEach((r, i) => { const [, v, w, cls] = stages[k].b[i]; r.className = "brow " + (cls || ""); $(".n", r).textContent = v; $("i", r).style.width = w + "%"; });
    cap.innerHTML = stages[k].c;
  };
  let run = 0;
  $$(".tabs button", el).forEach(b => b.onclick = () => { run++; show(+b.dataset.i); });
  replayable(el, async still => {
    const my = ++run; if (still) { show(2); return; }
    for (let k = 0; k < 3; k++) { show(k); await sleep(2600); if (my !== run || !el.isConnected) return; }
  });
};

/* Q9: temperature slider */
W.temp = el => {
  el.innerHTML = `<label class="slider"><span>Temperature T</span><input type="range" min="0.2" max="2.5" step="0.05" value="1"><output>T = 1.00</output></label><div class="tmrows"></div><p class="cap tmcap" style="margin:8px 0 0"></p>`;
  const inp = $("input", el), out = $("output", el), rows = $(".tmrows", el), cap = $(".tmcap", el);
  const draw = () => {
    const T = +inp.value, p = softmax(LOGITS.map(r => r[1]), T);
    out.textContent = "T = " + T.toFixed(2);
    rows.innerHTML = bars(p.map((v, i) => [LOGITS[i][0], f2(v), v * 100, i === 0 ? "pick" : ""]));
    cap.innerHTML = T < 0.85 ? "<b>Low temperature:</b> sharper. The model almost always picks “food”: predictable." : T > 1.25 ? "<b>High temperature:</b> flatter. Less likely tokens get a real chance: more varied, more surprising." : "<b>T = 1:</b> the model’s own probabilities.";
  };
  inp.oninput = draw; draw();
};

/* Q10: the score table grows with n² */
W.quad = el => {
  el.innerHTML = `<div class="quad"><svg viewBox="0 0 260 260" role="img" aria-label="The score table grows as n squared" ${FONT}><g class="qg"></g></svg>
    <div><div class="big qn"></div><div class="big qs" style="margin-top:14px"></div><p class="cap qc" style="margin:14px 0 0"></p></div></div>
    <div class="wg-foot"><span></span><button class="replay" type="button">↻ Replay</button></div>`;
  const g = $(".qg", el), F = c => $(c, el);
  const draw = n => {
    const c = 256 / n; let s = "";
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += `<rect x="${(2 + j * c).toFixed(2)}" y="${(2 + i * c).toFixed(2)}" width="${(c - (n > 16 ? 0.6 : 1.5)).toFixed(2)}" height="${(c - (n > 16 ? 0.6 : 1.5)).toFixed(2)}" rx="${n > 16 ? 0.5 : 2}" fill="rgba(142,124,195,${(0.18 + 0.6 * hash(i, j)).toFixed(2)})"/>`;
    g.innerHTML = s;
    F(".qn").innerHTML = `${n}<small>tokens (n)</small>`;
    F(".qs").innerHTML = `${(n * n).toLocaleString()}<small>scores (n × n)</small>`;
    F(".qc").innerHTML = n === 2 ? "Each cell is one query–key score." : `<b>${n / 2} → ${n} tokens:</b> twice the tokens, <b>four times</b> the scores.`;
  };
  let run = 0;
  replayable(el, async still => {
    const my = ++run; if (still) { draw(16); return; }
    for (let loop = 0; loop < 3; loop++) for (const n of [2, 4, 8, 16, 32]) { if (my !== run || !el.isConnected) return; draw(n); await sleep(1700); }
  });
};

/* End screen: click any block of the architecture */
const ARCH_INFO = {
  tokens: { name: "Input tokens", c: "#9AA3B8", q: 0, what: "Text is split into tokens (words or pieces of words), and each token becomes an ID number. This is where everything starts.", eg: "“Ben was hungry so he went looking for” → 8 tokens.", eq: String.raw`\text{text} \rightarrow [x_1, x_2, \dots, x_n]` },
  embed: { name: "Token embeddings", c: "#9AA3B8", q: 0, what: "A learned lookup table turns each token ID into a vector of numbers that captures its meaning. Similar words end up with similar vectors.", eg: "Each of the 8 tokens becomes a vector of 768 numbers in GPT-2 small.", eq: String.raw`x_i = E[\text{token}_i]` },
  pos: { name: "Positional encoding", c: "#2A9D8F", q: 7, what: "Attention on its own is order-blind, so position information is needed. Sinusoidal encodings are added here, to the embeddings. RoPE instead rotates the queries and keys inside attention.", eg: "Lets the model tell “the lion chased the zebra” from “the zebra chased the lion”.", eq: String.raw`x_i = E[\text{token}_i] + PE(i)` },
  attn: { name: "Masked self-attention", c: "#4C2BD6", q: 3, what: "Each token looks back at the tokens before it and mixes in their information. Queries are matched with keys, softmax turns the scores into weights, and the values are blended. The causal mask hides the future. Several heads run in parallel.", eg: "“for” takes 46% of its new information from “hungry”.", eq: String.raw`\mathrm{softmax}\!\left(\frac{QK^{\top}}{\sqrt{d_k}} + M\right)V` },
  addnorm: { name: "Add & Norm", c: "#6AA84F", q: 5, what: "Adds each sub-layer’s input back to its output (the residual connection), then normalises the values. Nothing is lost, gradients get a shortcut, and values stay in a stable range.", eg: "Lets models stack dozens of blocks and still train.", eq: String.raw`\mathrm{LayerNorm}\big(x + \mathrm{Sublayer}(x)\big)` },
  ffn: { name: "Feed-forward network (MLP)", c: "#E69138", q: 4, what: "Processes each token’s vector on its own: expand to 4× the size, apply a non-linearity, compress back. It holds about two-thirds of each block’s parameters and much of the model’s stored knowledge.", eg: "Attention gathers “someone hungry is looking”; the FFN works with it.", eq: String.raw`\mathrm{FFN}(x) = W_2\,\sigma(W_1 x + b_1) + b_2` },
  block: { name: "Transformer block × N", c: "#8E7CC3", q: 4, what: "Attention, feed-forward and their Add & Norms form one block. The block is stacked N times; each one refines every token’s vector a little more.", eg: "N = 12 in GPT-2 small, 32 in Llama 2 7B.", eq: String.raw`h^{(\ell+1)} = \mathrm{Block}\big(h^{(\ell)}\big)` },
  linear: { name: "Linear layer", c: "#3C78D8", q: 8, what: "Takes the final vector of the last token and projects it onto the vocabulary: one raw score for every token the model knows.", eg: "One score each for “food”, “water”, “lunch”… and every other token.", eq: String.raw`z = W_{\text{vocab}}\, h_n` },
  logits: { name: "Logits", c: "#C9A227", q: 8, what: "The raw scores, one per vocabulary token (often 50,000 to 256,000 of them). Higher means more likely, but they are not probabilities yet.", eg: "food 4.1 · water 2.3 · lunch 1.7 · keys 0.2", eq: String.raw`z = [z_1, z_2, \dots, z_{|V|}]` },
  softmax: { name: "Softmax", c: "#8E7CC3", q: 8, what: "Turns the logits into probabilities: every value between 0 and 1, all adding up to 1. A temperature can make the distribution sharper or flatter.", eg: "food 0.78 · water 0.13 · lunch 0.07 · keys 0.02", eq: String.raw`\mathrm{softmax}(z)_i = \frac{e^{z_i}}{\sum_j e^{z_j}}` },
  probs: { name: "Next-token probabilities", c: "#9AA3B8", q: 0, what: "A probability for every token in the vocabulary. Decoding picks one, appends it to the input, and the whole stack runs again: one token at a time.", eg: "Pick “food”, append it, predict again.", eq: String.raw`P(x_{t} \mid x_1, \dots, x_{t-1})` },
};
W.explorer = el => {
  const canJump = el.dataset.jump === "1";
  el.innerHTML = `<div class="explore"><div><div class="arch interactive">${ARCH({ interactive: true, flow: true })}</div><p class="xhint">Read from the bottom (input) to the top (output). Tap any block.</p></div><div class="xinfo" aria-live="polite"></div></div>`;
  const info = $(".xinfo", el);
  const pick = part => {
    const d = ARCH_INFO[part]; if (!d) return;
    $$(".ab", el).forEach(g => g.classList.toggle("on", g.dataset.part === part));
    info.innerHTML = `<div class="kick">Transformer architecture</div><h3><i style="border-color:${d.c}"></i>${esc(d.name)}</h3>
      <p>${esc(d.what)}</p>${EQ(K(d.eq, true))}<div class="eg"><b>In our example:</b> ${esc(d.eg)}</div>
      ${canJump ? `<div class="acts"><button class="btn ghost small" type="button" data-q="${d.q}">Revisit Question ${d.q + 1} →</button></div>` : ""}`;
    const b = $("[data-q]", info); if (b) b.onclick = () => el.dispatchEvent(new CustomEvent("jumpq", { bubbles: true, detail: +b.dataset.q }));
  };
  $$(".ab", el).forEach(g => {
    g.addEventListener("click", e => { e.stopPropagation(); pick(g.dataset.part); });
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(g.dataset.part); } });
  });
  pick("attn");
};

/* ======================================================================
   QUESTIONS
   illus(): shown with the question · explain(): panels shown after the answer
   whynot: why each wrong option is wrong · take: the yellow takeaway bar
   ====================================================================== */
const QUESTIONS = [
 { id: "goal",
   q: "What is the goal of a Transformer language model?",
   options: ["Generate the entire sentence in one step", "Predict the next token based on the context so far", "Predict the next word using only the previous word", "Retrieve the correct sentence from its training data"],
   answer: 1,
   illus: () => `<div class="flowup">
       <div class="toks" style="justify-content:center">${SENT.map(t => chip(t)).join("")}</div><div class="ar">↑</div>
       <div class="modelbox">Transformer language model</div><div class="ar">↑</div>
       <div class="toks"><span class="tk blank" style="font-size:20px;padding:8px 18px">?</span></div></div>
     <p class="ilcap">The model reads the context. What does it produce?</p>`,
   explain: () =>
     P(1, "One job: predict the next token", `<div class="wg" data-w="nexttok"></div>
       <p>Given the context so far, the model gives <b>every token in its vocabulary</b> a probability of coming next. The context mentions being hungry, so “food” gets the most. To write text, it picks a token, appends it, and runs again: <b>one token at a time</b>. (Probabilities are illustrative.)</p>`) +
     P(2, "In maths", `${EQ(texd`P(x_t \mid x_1, x_2, \dots, x_{t-1})`, "The probability of the next token x<sub>t</sub>, given every token before it.")}
       <p>Chain these predictions and you get the probability of a whole sentence:</p>${EQ(texd`P(x_1,\dots,x_T) = \prod_{t=1}^{T} P(x_t \mid x_{<t})`)}`) +
     P(3, "How it learns", `<p>Training shows the model billions of real sentences. At every position it predicts the next token, and it is nudged to give the token that actually came next a higher probability. The nudge comes from the cross-entropy loss:</p>
       ${EQ(texd`\mathcal{L} = -\log P(\text{food} \mid \text{context})`, "context = “Ben was hungry so he went looking for”. The loss is small when the model gives “food” a high probability, and large when it doesn’t.")}`),
   whynot: { 0: "It writes one token at a time, each prediction feeding the next, not a whole sentence in one step.", 2: "Using only the previous word is a bigram model. A Transformer uses the whole context.", 3: "It generates new text from patterns it learned. It doesn’t look sentences up in its training data." },
   take: "A Transformer language model learns P(next token | all the tokens before it), then generates text one token at a time." },

 { id: "ngram",
   q: "Why were n-gram language models limited?",
   options: ["They cannot represent words numerically", "They cannot predict the next token", "They only consider a fixed-size context", "They need a neural network to be trained"],
   answer: 2,
   illus: () => `<div class="toks" style="justify-content:center">${SENT.map(t => chip(t)).join("")}${chip("?", "blank")}</div>
     <p class="cap" style="text-align:center;margin:16px 0 4px">A trigram model’s prediction for the blank:</p>
     <div class="counts">${bars([["a", "0.34", 34 / 0.4], ["work", "0.21", 21 / 0.4], ["the", "0.14", 14 / 0.4], ["food", "0.04", 4 / 0.4]])}</div>
     <p class="ilcap">Built from counts in its training text (illustrative). Why does “food” score so low?</p>`,
   explain: () =>
     P(1, "It only ever sees a fixed window", `<div class="wg" data-w="ngram"></div>
       <p>A trigram model predicts each word from the <b>two words before it</b>, by counting what followed that pair in its training text. At the blank it sees only “looking for”. The clue that matters, <b>“hungry”</b>, is six words back, outside its window, so “food” looks no more likely than “a job” or “a friend”.</p>`) +
     P(2, "Why not just make the window bigger?", `<p>The model must have seen the exact word sequence in its training text, and the number of possible contexts explodes as the window grows:</p>
       ${EQ(texd`50{,}000^{4} \approx 6 \times 10^{18}`, "possible 4-word contexts with a 50,000-word vocabulary. Most never appear in any training text, so their counts are zero: the data sparsity problem.")}`) +
     P(3, "How a Transformer fixes it", `<div class="cols">${card("peach", "Trigram", `${EQ(texd`P(x_t \mid x_{t-2},\, x_{t-1})`)}Sees the last 2 words, nothing else.`)}${card("sage", "Transformer", `${EQ(texd`P(x_t \mid x_1, \dots, x_{t-1})`)}Sees the whole context, and attention learns which words matter.`)}</div>`),
   whynot: { 0: "They do represent words numerically: as entries in a table of counts.", 1: "Predicting the next word is exactly what they do.", 3: "They need no neural network at all. They are tables of counts." },
   take: "An n-gram model only sees the last n − 1 words. A Transformer can use the whole context, so a clue like “hungry” is never out of reach." },

 { id: "attention",
   q: "What is the key idea behind attention?",
   options: ["Each token can focus on relevant information from other tokens", "Each token is processed independently", "The model only considers the previous token", "Attention converts tokens into embeddings"],
   answer: 0,
   illus: () => `${ARCS("q")}<p class="ilcap">To predict what comes after “for”, which earlier tokens should it pay attention to?</p>`,
   explain: () =>
     P(1, "Look back and weigh every token", `<div class="wg" data-w="arcs"></div>
       <p>“for” scores every token up to itself for relevance, and the weights add up to 1. Most goes to <b>“hungry”</b> (0.46) and <b>“looking”</b> (0.19): exactly the words that tell us what Ben is looking for. (Weights are illustrative.)</p>`) +
     P(2, "Then mix in their information", `<p>The new vector for “for” is a blend of the tokens it attended to, weighted by those scores:</p>
       ${EQ(texd`\begin{aligned} \text{new}_{\text{for}} &= 0.46\,v_{\text{hungry}} + 0.19\,v_{\text{looking}} \\ &\quad + 0.09\,v_{\text{went}} + \dots \end{aligned}`, "v is each token’s information, its value vector (next question).")}
       <p>So “for” now carries “someone hungry is looking”, which points towards “food”.</p>`) +
     P(3, "Every token, all at once", `<p>Every token does this at the same time, each looking back with its own weights, so a whole sentence is processed in parallel. Transformers also run several attention <b>heads</b> side by side: one head might link “he” to “Ben”, another “for” to “hungry”.</p>`),
   whynot: { 1: "Processing each token on its own is what the feed-forward network does (Question 5). Attention is about tokens looking at each other.", 2: "Using only the previous token is a bigram model. Attention can look at every earlier token.", 3: "Embeddings come from a lookup table before attention runs." },
   take: "Attention lets each token pull in information from the tokens that matter to it, wherever they are in the context." },

 { id: "qkv",
   q: "In the attention equation, what do the Query, Key and Value vectors do?",
   options: ["They store a token’s meaning, position and vocabulary ID", "They represent what a token is looking for, what each token offers, and the information passed on", "They represent the input, hidden and output layers", "They represent the past, present and future tokens"],
   answer: 1,
   illus: () => `<div class="st-eq">${ATTN_EQ()}</div>
     <div class="grid3" style="margin:12px 0 0;grid-template-columns:repeat(3,minmax(0,1fr))">
       <div class="pc peach" style="text-align:center;padding:8px 4px">${tex`\htmlClass{eq-q}{Q} = XW_Q`}</div>
       <div class="pc blue" style="text-align:center;padding:8px 4px">${tex`\htmlClass{eq-k}{K} = XW_K`}</div>
       <div class="pc sage" style="text-align:center;padding:8px 4px">${tex`\htmlClass{eq-v}{V} = XW_V`}</div></div>
     <p class="ilcap">X holds one vector per token. Q, K and V are made from X with three learned weight matrices.</p>`,
   explain: () =>
     P(1, "Follow one token through attention", `<div class="wg" data-w="stepper"></div>`) +
     P(2, "In one sentence", `<p>Attention is a <b>soft lookup</b>: each token’s query is matched against every key, and it gets back a blend of the values, weighted by how well they match.</p>
       <div class="grid3">${card("peach", "Query q", "What I’m looking for.")}${card("blue", "Key k", "What I offer: how other tokens find me.")}${card("sage", "Value v", "What I pass on when I’m chosen.")}</div>`),
   whynot: { 0: "Meaning comes from the embedding, position from positional encoding, and the ID from the tokenizer.", 2: "Input, hidden and output layers describe a neural network’s layers, not attention.", 3: "Every token gets all three vectors. Hiding the future is the causal mask’s job (Question 7)." },
   take: "Query: what I’m looking for. Key: what I offer. Value: what I pass on. Scores = query · key, weights = softmax, output = weighted sum of values." },

 { id: "ffn",
   q: "Here is a Transformer language model, read from the bottom (input) to the top (output). What goes in the box marked “?” inside each Transformer block?",
   options: ["Softmax", "Tokenizer", "Causal mask", "Feed-forward network (MLP)"],
   answer: 3,
   illus: () => `<div class="arch">${ARCH({ missing: true, flow: true })}</div><p class="ilcap">Data flows upwards: from input tokens to next-token probabilities.</p>`,
   explain: () =>
     P(1, "Where it sits", `<div class="cols"><div class="arch" style="max-width:380px;margin:0 auto;width:100%">${ARCH({ hi: "ffn", flow: true })}</div>
       <div><p>Inside every Transformer block, attention is followed by a <b>feed-forward network</b> (FFN), also called an MLP. Each one is wrapped in Add & Norm, and the whole block is stacked N times.</p>
       <p>Attention lets tokens <b>share</b> information. The feed-forward network then lets each token <b>process</b> what it gathered, on its own: the same small network is applied to every position separately.</p>
       <div class="pertok">${["hungry", "looking", "for"].map(t => `<div class="col">${chip(t)}<span class="ar">↑</span><span class="box">FFN</span><span class="ar">↑</span>${chip(t + "′", "new")}</div>`).join("")}</div>
       <p class="cap" style="text-align:center;margin-top:8px">Same weights for every token. Tokens never look at each other here.</p>
       <p style="margin-top:12px">Remember it as: <b>attention = communication</b> between tokens, <b>feed-forward = computation</b> within each token.</p></div></div>`) +
     P(2, "Inside the network: expand, activate, compress", `<div class="wg" data-w="ffn"></div>
       ${EQ(texd`\mathrm{FFN}(x) = W_2\,\sigma(W_1 x + b_1) + b_2`, "W₁ expands each token’s vector to 4× its size (768 → 3,072 in GPT-2 small), σ is a non-linear activation, and W₂ projects it back to 768.")}
       <p>σ was ReLU in the original Transformer and GELU in GPT-2. Modern models such as Llama and Gemma use gated versions (SwiGLU, GeGLU), but the shape is the same: expand, activate, compress.</p>`) +
     P(3, "What breaks if you remove it", `<div class="grid3">
       ${card("pink", "Far less expressive", "Attention outputs are weighted averages of value vectors. Without the FFN, each block can only re-mix what is already there: no per-token, non-linear processing.")}
       ${card("pink", "Much of the knowledge is gone", "The FFN holds about two-thirds of each block’s parameters (8d² of 12d²). Research suggests these layers act like key–value memories that store patterns and facts (Geva et al., 2021).")}
       ${card("pink", "Tokens blur together", "Stacking attention on its own tends to make every token’s vector look the same (“rank collapse”, Dong et al., 2021). Feed-forward layers and residual connections counter this.")}</div>`),
   whynot: { 0: "Softmax sits at the very top, turning logits into probabilities (and inside attention). It isn’t a sub-layer of the block.", 1: "The tokenizer runs before the model starts, splitting text into tokens.", 2: "The causal mask lives inside self-attention, not in a box of its own." },
   take: "Attention mixes information across tokens; the feed-forward network transforms each token on its own, and holds most of the model’s parameters." },

 { id: "addnorm",
   q: "In each Transformer block, what does Add & Norm do?",
   options: ["Adds positional information to the embeddings", "Adds the sub-layer’s input back to its output (a residual connection), then normalises the values", "Adds more attention heads to the block", "Normalises the final scores so they sum to 1"],
   answer: 1,
   illus: () => `${RESID("q")}<p class="ilcap">A zoom into one sub-layer and its Add & Norm, read from the bottom up.</p>`,
   explain: () =>
     P(1, "Add: the residual connection", `<div class="cols"><div class="wg">${RESID("x")}</div>
       <div><p>The input <b>x</b> takes two routes: <b>through</b> the sub-layer (attention or feed-forward), and <b>around</b> it, along the skip. At the ⊕ the two are added back together:</p>
       ${EQ(texd`\text{output} = \mathrm{LayerNorm}\big(x + \mathrm{Sublayer}(x)\big)`)}
       <p>So the sub-layer only has to learn a <b>change</b> to x, an edit, not rebuild it from scratch.</p></div></div>`) +
     P(2, "Why that matters", `<div class="grid3">
       ${card("sage", "Nothing is lost", "The original x always survives, so earlier information flows straight through every block.")}
       ${card("sage", "Gradients get a shortcut", "During training, gradients flow back along the skips, so models with dozens of blocks still learn.")}
       ${card("sage", "A shared running document", "Think of x as a document, the residual stream, that every block reads and adds notes to.")}</div>`) +
     P(3, "Norm: layer normalisation", `<div class="wg" data-w="lnorm"></div>
       ${EQ(texd`\mathrm{LayerNorm}(h) = \gamma \odot \frac{h - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta`, "μ and σ are the mean and spread of one token’s values; γ and β are learned, so the model can rescale if it needs to.")}
       <p>Each token’s values are re-centred and rescaled, so they stay in a stable range block after block, and training stays stable.</p>`) +
     P(4, "What breaks without it", `<div class="cols">
       ${card("pink", "Without Add", "Signals and gradients must squeeze through every sub-layer. Deep stacks become very hard to train, and each block has to preserve everything itself.")}
       ${card("pink", "Without Norm", "Values drift larger or smaller from block to block, and training becomes unstable.")}</div>
       <p class="cap" style="margin-top:12px">Most modern LLMs (GPT-2 onwards, Llama, Gemma) normalise <b>before</b> each sub-layer instead, ${tex`x + \mathrm{Sublayer}(\mathrm{Norm}(x))`}, often with a simpler RMSNorm. Same two ideas.</p>`),
   whynot: { 0: "Positional information is added once at the input (or applied inside attention with RoPE), not in Add & Norm.", 2: "The number of heads is fixed by the architecture. Add & Norm never adds heads.", 3: "Making scores sum to 1 is softmax’s job (Question 9)." },
   take: "Add keeps the original signal and gives gradients a shortcut; Norm keeps the values stable. Together they make deep stacks of blocks trainable." },

 { id: "mask",
   q: "Which component prevents a Transformer from looking at future tokens during next-token prediction?",
   options: ["Positional embedding", "Layer normalisation", "Causal mask", "Feed-forward network"],
   answer: 2,
   illus: () => `${MASK()}<div class="mlegend"><span><i style="background:#E3F1DC;border-color:#93C47D"></i>can attend</span><span><i style="background:#F1F0F3;border-color:#DAD6E0"></i>blocked</span></div>
     <p class="ilcap">Each row is a token paying attention; each column is a token it could look at. Which component creates this pattern?</p>`,
   explain: () =>
     P(1, "The causal mask", `<div class="wg" data-w="mask"></div>
       <p>This pattern is the <b>causal mask</b>. Each <b>row</b> is a token paying attention; each <b>column</b> is a token it could look at. A token may look at itself and the tokens before it (✓), never the ones after it (✗). Tap a row to see what that token can see.</p>`) +
     P(2, "How it works", `${EQ(texd`\begin{gathered} \mathrm{softmax}\!\left(\frac{QK^{\top}}{\sqrt{d_k}} + M\right)V \\[6pt] M_{ij} = \begin{cases} 0 & j \le i \ \text{(past or self)} \\ -\infty & j > i \ \text{(future)} \end{cases} \end{gathered}`)}
       <p>Before softmax, the mask adds −∞ to every score for a future token. Since e<sup>−∞</sup> = 0, those tokens get a weight of exactly 0. Here is the row for “hungry”:</p>
       <div class="scrollx">${(() => {
         const s = [1.2, 0.4, 2.0, 1.7, 0.3, 0.9, 1.1, 0.6], w = softmax(s.slice(0, 3));
         return `<table class="wtab"><tr><td></td>${SENT.map(t => `<th>${t}</th>`).join("")}</tr>
           <tr><td class="lab">scores</td>${s.map(v => `<td>${v.toFixed(1)}</td>`).join("")}</tr>
           <tr><td class="lab">+ mask</td>${s.map((v, j) => j <= 2 ? `<td>${v.toFixed(1)}</td>` : `<td class="inf">−∞</td>`).join("")}</tr>
           <tr><td class="lab">softmax</td>${s.map((v, j) => j <= 2 ? `<td class="pos">${f2(w[j])}</td>` : `<td class="zero">0</td>`).join("")}</tr></table>`;
       })()}</div>`) +
     P(3, "Why it matters", `<div class="wg"><div class="trainpairs"><span class="h">Token</span><span></span><span class="h">Must predict</span>
       ${SENT.map((t, i) => `${chip(t)}<span class="ar">→</span>${chip(i < SENT.length - 1 ? SENT[i + 1] : "food", "tgt")}`).join("")}</div>
       <p class="cap" style="text-align:center;margin:10px 0 0">One pass over the sentence trains all 8 predictions at the same time.</p></div>
       <p>In training, the whole sentence is processed at once, so all positions learn in parallel. Without the mask, “looking” could simply read “for”, the very token it is meant to predict, and learn to copy it. When generating there is no future to read, so the model would fail.</p>
       <p>The mask makes training match generation: <b>predict from the past only</b>.</p>`),
   whynot: { 0: "Positional embeddings tell the model where each token is. They don’t hide anything.", 1: "Layer normalisation rescales each token’s values. It doesn’t control what attention can see.", 3: "The feed-forward network processes each token on its own and never looks at other tokens at all." },
   take: "The causal mask blocks attention to future tokens, so every prediction uses only the past, in training and in generation." },

 { id: "position",
   q: "Why does a Transformer need positional information?",
   options: ["Attention cannot represent token meaning", "Positional information calculates the attention weights", "Positional information replaces token embeddings", "Attention does not inherently know the order of tokens"],
   answer: 3,
   illus: () => `<div class="sent2"><div class="toks">${"The lion chased the zebra".split(" ").map(t => chip(t, "k")).join("")}</div>
       <div class="toks">${"The zebra chased the lion".split(" ").map(t => chip(t, "v")).join("")}</div>
       <div class="ar" style="font-size:22px;color:#8A84A0">↓ ↓</div>
       <div class="bag">${["chased", "the", "zebra", "The", "lion"].map(t => chip(t)).join("")}</div></div>
     <p class="ilcap">Same words, opposite meanings. Both sentences contain exactly the same set of tokens.</p>`,
   explain: () =>
     P(1, "Attention is order-blind", `<p>Attention scores come from q · k, which depend on <b>what</b> the tokens are, not <b>where</b> they are. Shuffle a sentence and every token gets exactly the same scores. Without position information, these two look identical to the model:</p>
       <div class="cols">${card("blue", "“The lion chased the zebra”", `<span class="cap">the lion is the hunter, the zebra runs for its life</span>`)}${card("lav", "“The zebra chased the lion”", `<span class="cap">the same five words, but now the zebra is doing the chasing</span>`)}</div>`) +
     P(2, "Option 1 · Sinusoidal positional encoding (original Transformer, 2017)", `<div class="addrow" style="margin-bottom:12px"><span class="box" style="background:#EEF0F5;border-color:#9AA3B8">token embedding</span>+<span class="box" style="background:#D6F0EE;border-color:#2A9D8F">PE(pos)</span>→<span class="box" style="background:#F3EFFB;border-color:#B9A9E3">input to block 1</span></div>
       <div class="wg" data-w="sinus"></div>
       ${EQ(texd`\begin{gathered} PE_{(pos,\,2i)} = \sin\!\left(\frac{pos}{10000^{2i/d}}\right) \\[4pt] PE_{(pos,\,2i+1)} = \cos\!\left(\frac{pos}{10000^{2i/d}}\right) \end{gathered}`, "pos is the position, i picks a pair of dimensions, d is the embedding size.")}
       <p>A fixed vector is <b>added to each token’s embedding</b>, once, at the input. Each pair of dimensions is a wave with its own speed, from fast to slow, like the hands of a clock, so every position gets its own unique pattern.</p>`) +
     P(3, "Option 2 · RoPE, rotary position embedding (Llama, Gemma, Mistral)", `<div class="wg" data-w="rope"></div>
       ${EQ(texd`\begin{gathered} q'_m = R(m\theta)\,q_m \qquad k'_n = R(n\theta)\,k_n \\[4pt] R(\phi) = \begin{pmatrix} \cos\phi & -\sin\phi \\ \sin\phi & \cos\phi \end{pmatrix} \end{gathered}`, "Applied to each pair of dimensions, each pair with its own angle θ<sub>i</sub> = 10000<sup>−2i/d</sup>.")}
       ${EQ(texd`q'_m \cdot k'_n = q_m^{\top}\, R\big((n-m)\theta\big)\, k_n`, "The score depends only on the distance n − m between the two tokens.")}
       <p>Nothing is added to the embeddings. Inside <b>every attention layer</b>, each query and key is <b>rotated</b> by an angle proportional to its position. The values (V) are left unchanged: position only needs to shape the scores.</p>`) +
     P(4, "The key difference", `<div class="scrollx"><table class="cmp"><thead><tr><th></th><th>Sinusoidal</th><th>RoPE</th></tr></thead><tbody>
       <tr><th>Where</th><td>Once, at the input: <b>added to the token embeddings</b></td><td>Inside every attention layer: <b>applied to Q and K</b> (not V)</td></tr>
       <tr><th>How</th><td>Addition: x + PE(pos)</td><td>Rotation: R(mθ)q and R(nθ)k</td></tr>
       <tr><th>Encodes</th><td><b>Absolute</b> position: “I am token 7”</td><td><b>Relative</b> position: “we are 2 tokens apart”</td></tr>
       <tr><th>Used in</th><td>The original Transformer (Vaswani et al., 2017)</td><td>Llama, Gemma, Mistral, Qwen (Su et al., 2021)</td></tr></tbody></table></div>`),
   whynot: { 0: "Attention represents meaning fine: that comes from the embeddings and q, k, v.", 1: "Attention weights come from q · k and softmax. Position information only shapes them.", 2: "Positions are added to (or applied alongside) the token embeddings, never instead of them." },
   take: "Attention is order-blind. Sinusoidal encodings add “where am I” to each embedding at the input; RoPE rotates Q and K so attention scores depend on how far apart tokens are." },

 { id: "softmax",
   q: "What does the Softmax at the end of a Transformer language model do?",
   options: ["Turns the logits into probabilities that sum to 1 over the vocabulary", "Picks the next token on its own, without any probabilities", "Adds positional information to each token", "Normalises the values inside each Transformer block"],
   answer: 0,
   illus: () => `<div class="pipe">
       <div class="box" style="background:#F3EFFB;border-color:#B9A9E3">final vector of “for” (from the last block)</div><div class="ar">↑</div>
       <div class="box" style="background:#CFE2F3;border-color:#3C78D8">Linear layer</div><div class="ar">↑</div>
       <div class="logits"><div class="cap" style="text-align:center;margin-bottom:2px"><b>Logits</b>: one raw score per vocabulary token</div>${bars(LOGITS.map(([t, v]) => [t, v.toFixed(1), v / 4.1 * 100]))}</div><div class="ar">↑</div>
       <div class="box" style="background:#E4DCF1;border-color:#8E7CC3">Softmax</div><div class="ar">↑</div>
       <div class="box" style="background:#FFFFFF;border:2px dashed #361A54;color:#361A54;font-size:20px">?</div></div>`,
   explain: () =>
     P(1, "From raw scores to probabilities", `<div class="wg" data-w="softmax"></div>
       ${EQ(texd`\mathrm{softmax}(z)_i = \frac{e^{z_i}}{\sum_{j} e^{z_j}}`, "z are the logits, one per token in the vocabulary (Gemma’s vocabulary has about 256,000 tokens).")}`) +
     P(2, "Temperature: how adventurous to be", `<div class="wg" data-w="temp"></div>
       ${EQ(texd`p_i = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}`)}
       <p>Dividing the logits by a temperature T before softmax changes the shape: T &lt; 1 sharpens it (more confident, more predictable), T &gt; 1 flattens it (more varied, more surprising). Decoding then picks a token from these probabilities.</p>`) +
     P(3, "Softmax appears twice", `<p>The same function sits inside every attention layer, where it turns query–key scores into attention weights that add up to 1 (Question 4).</p>`),
   whynot: { 1: "Softmax only produces probabilities. Decoding (greedy or sampling) is what picks a token from them.", 2: "Positional information is added at the input (or applied in attention with RoPE).", 3: "Normalising values inside each block is layer normalisation’s job (Question 6)." },
   take: "Softmax turns raw scores (logits) into a probability distribution: every value between 0 and 1, all adding up to 1." },

 { id: "quadratic",
   q: "What is the major computational limitation of standard self-attention?",
   options: ["Its cost grows logarithmically with sequence length", "It can only process one token at a time", "Its cost grows quadratically with sequence length", "Its cost does not depend on sequence length"],
   answer: 2,
   illus: () => `${SCOREGRID()}<p class="ilcap">Self-attention computes a score for every pair of tokens: 8 tokens → 8 × 8 = 64 scores. What happens as the text gets longer?</p>`,
   explain: () =>
     P(1, "Every token meets every token", `<div class="wg" data-w="quad"></div>
       <p>For n tokens, attention builds an <b>n × n</b> table of scores (QK<sup>⊤</sup>), in every head of every layer. Double the tokens and the table has 4× as many cells.</p>`) +
     P(2, "How fast it grows", `<div style="max-width:620px;--lw:108px">${bars([["1,000 tokens", "1 M", 0.5], ["8,000", "64 M", 0.9], ["32,000", "≈ 1 B", 6.25], ["128,000", "≈ 16 B", 100]])}</div>
       <p class="cap" style="margin:4px 0 12px">Scores per head, per layer. The first bars are so small you can barely see them.</p>
       ${EQ(texd`\begin{gathered} \text{time} = O(n^2 \cdot d) \\ \text{memory for the scores} = O(n^2) \end{gathered}`, "n is the number of tokens, d the vector size. The feed-forward network, by contrast, grows only linearly in n: O(n · d²).")}`) +
     P(3, "How models cope", `<div class="grid3">
       ${card("blue", "FlashAttention", "Computes exact attention in small tiles, so the full n × n table is never stored. Memory grows linearly; the compute is still n².")}
       ${card("lav", "Local (sliding-window) attention", "Each token looks only at the last w tokens: n · w instead of n². Gemma 2 and 3 mix local and global attention layers.")}
       ${card("peach", "KV cache", "When generating, the keys and values of earlier tokens are stored and reused, so each new token costs about n, not n².")}</div>`),
   whynot: { 0: "Every pair of tokens gets a score: that’s n², far worse than log n.", 1: "In training, attention processes all tokens in parallel. One token at a time is only how text is generated.", 3: "More tokens means more pairs to score, so the cost grows with length." },
   take: "Every token attends to every other token: n² scores. Double the context, quadruple the cost." },
];

/* full explanation: panels, why-not list and the takeaway bar */
function explainHTML(q) {
  const why = Object.entries(q.whynot || {}).map(([i, t]) => `<div><span class="L" style="background:${["var(--a)", "var(--b)", "var(--c)", "var(--d)"][i]}">${LET[i]}</span><span><b>${esc(q.options[i])}</b><br><i>${esc(t)}</i></span></div>`).join("");
  return q.explain() + (why ? P("?", "Why not the other options?", `<div class="whynot">${why}</div>`) : "") + `<div class="take">${esc(q.take)}</div>`;
}

/* Sessions 1 to 3 live in /sessions/live-session-N.js and push themselves onto this list; app.js sorts by order.
   explore: the widget shown on the results screen; exploreTitle: its heading. */
const SESSIONS = [{
  id: "live-session-4",
  order: 4,
  explore: "explorer",
  exploreTitle: "Explore the architecture",
  label: "Live Session 4 of 4",
  course: "Course 04",
  title: "Discover the Transformer Architecture",
  held: "Held live on Wednesday 4 November 2026",
  cover: "/img/live-session-4.jpg",
  courseUrl: COURSE_URL,
  questions: QUESTIONS,
}];
