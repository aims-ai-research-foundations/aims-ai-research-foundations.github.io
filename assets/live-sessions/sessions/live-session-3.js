/* Live Session 3 quiz: Course 03, Design and Train Neural Networks.
   The story: one neuron → activations → a network → the training loop (backprop, optimiser, learning rate,
   Adam, batches) → why depth is hard → generalisation (bias, variance, overfitting). Numbers are illustrative. */
"use strict";
(() => {

/* ---------------- small helpers (ls3 only) ---------------- */
const num = (v, d = 2) => { const r = Math.round(v * 10 ** d) / 10 ** d; return (r < 0 ? "−" : "") + Math.abs(r).toString(); };
const par = v => v < 0 ? `(${num(v)})` : num(v);
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = r => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
const lin = (a, b, A, B) => v => A + (v - a) * (B - A) / (b - a);
const mk = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker>`;
const pathOf = pts => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
const svg = (vb, label, inner, cls = "") => `<svg viewBox="${vb}" class="${cls}" role="img" aria-label="${esc(label)}" ${FONT}>${inner}</svg>`;
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || "middle"}" font-size="${o.fs || 13}" font-weight="${o.fw || 700}" fill="${o.c || "#1B1530"}"${o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : ""}${o.cls ? ` class="${o.cls}"` : ""}>${s}</text>`;
const box = (x, y, w, h, fill, stroke, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.6" ${extra}/>`;
const range = (cls, label, min, max, step, val) => `<label class="slider ls3-sl"><span>${label}</span><input class="${cls}" type="range" min="${min}" max="${max}" step="${step}" value="${val}"><output></output></label>`;
/* exponents: HTML gets <sup>, SVG text gets a raised tspan (it always ends the string) */
const sup = (n, inSvg) => { const s = (n < 0 ? "−" : "") + Math.abs(n); return inSvg ? `<tspan dy="-5" font-size="72%">${s}</tspan>` : `<sup>${s}</sup>`; };
const sci = (v, inSvg) => { if (v >= 0.001 && v < 100000) return v >= 100 ? Math.round(v).toLocaleString("en-GB") : num(v, v < 0.01 ? 4 : v < 1 ? 3 : 2); const e = Math.floor(Math.log10(v)); return `${(v / 10 ** e).toFixed(1)} × 10${sup(e, inSvg)}`; };

const EQ3 = (html, cap) => EQ(html, cap).replace('class="eqbox"', 'class="eqbox ls3-eqb"');

/* least squares with a tiny ridge: (AᵀA + λI) c = Aᵀy, solved by Gaussian elimination */
function lstsq(rows, y, lam = 1e-10) {
  const n = rows[0].length, M = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  rows.forEach((r, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] += r[i] * r[j]; M[i][n] += r[i] * y[k]; } });
  for (let i = 0; i < n; i++) M[i][i] += lam;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
/* a little animation loop helper: returns a token checker */
function runner(el) { let run = 0; return () => { const my = ++run; return () => my === run && el.isConnected; }; }

/* ======================================================================
   Diagrams
   ====================================================================== */

/* one neuron: x = (3, 2), weights, bias, Σ, ReLU, output. show: 0 nothing computed, 1 products, 2 z, 3 output */
function NEURON(w1, w2, b, show = 0) {
  const id = uid("n3"), z = w1 * 3 + w2 * 2 + b, a = Math.max(0, z);
  const wc = v => v < 0 ? "#B3261E" : "#2A5DB0";
  return svg("0 0 380 214", "A neuron with two inputs, two weights, a bias, a weighted sum and a ReLU activation", `
    <defs>${mk(id, "#7D7794")}</defs>
    <line x1="70" y1="50" x2="174" y2="96" stroke="${wc(w1)}" stroke-opacity=".55" stroke-width="${(1.5 + 1.8 * Math.abs(w1)).toFixed(1)}"/>
    <line x1="70" y1="162" x2="174" y2="116" stroke="${wc(w2)}" stroke-opacity=".55" stroke-width="${(1.5 + 1.8 * Math.abs(w2)).toFixed(1)}"/>
    <circle cx="48" cy="50" r="22" fill="#CFE2F3" stroke="#3C78D8" stroke-width="1.6"/>${T(48, 56, "3", { fs: 17, fw: 800 })}${T(18, 22, "x₁", { fs: 14, c: "#2A5DB0" })}
    <circle cx="48" cy="162" r="22" fill="#CFE2F3" stroke="#3C78D8" stroke-width="1.6"/>${T(48, 168, "2", { fs: 17, fw: 800 })}${T(18, 200, "x₂", { fs: 14, c: "#2A5DB0" })}
    ${T(118, 42, `w₁ = ${num(w1)}`, { fs: 13.5, c: wc(w1) })}${T(118, 184, `w₂ = ${num(w2)}`, { fs: 13.5, c: wc(w2) })}
    ${show >= 1 ? T(108, 102, `${num(w1)} × 3 = ${num(w1 * 3)}`, { fs: 12, fw: 600, c: "#655F78", cls: "ls3-pop" }) + T(108, 120, `${num(w2)} × 2 = ${num(w2 * 2)}`, { fs: 12, fw: 600, c: "#655F78", cls: "ls3-pop" }) : ""}
    ${box(166, 6, 68, 26, "#FFF2CC", "#C9A227")}${T(200, 24, `b = ${num(b)}`, { fs: 13.5 })}
    <line x1="200" y1="32" x2="200" y2="75" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
    <circle cx="200" cy="106" r="28" fill="#E4DCF1" stroke="#8E7CC3" stroke-width="1.8"/>${T(200, 114, "Σ", { fs: 24, fw: 700, c: "#5B4596" })}
    ${show >= 2 ? T(200, 156, `z = ${num(z)}`, { fs: 14, c: "#5B4596", cls: "ls3-pop" }) : ""}
    <line x1="228" y1="106" x2="250" y2="106" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
    ${box(252, 86, 62, 40, "#D9EAD3", "#6AA84F")}${T(283, 111, "ReLU", { fs: 14 })}
    <line x1="314" y1="106" x2="330" y2="106" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
    <circle cx="354" cy="106" r="20" fill="${show >= 3 ? (a > 0 ? "#D9EAD3" : "#F1F0F3") : "#FFFFFF"}" stroke="${show >= 3 ? "#6AA84F" : "#361A54"}" stroke-width="2" ${show >= 3 ? "" : 'stroke-dasharray="5 4"'}/>
    ${T(354, 112, show >= 3 ? num(a) : "?", { fs: 16, fw: 800, c: "#361A54", cls: show >= 3 ? "ls3-pop" : "" })}
    ${show >= 3 ? T(354, 146, `output`, { fs: 12, fw: 600, c: "#655F78" }) : ""}`);
}

/* mini activation icons */
const actIcon = (x, y, kind, label) => {
  const W0 = 46, H0 = 30, f = { relu: t => Math.max(0, t) / 2, sig: t => 1 / (1 + Math.exp(-3 * t)), tanh: t => (Math.tanh(2 * t) + 1) / 2 }[kind];
  const pts = Array.from({ length: 25 }, (_, i) => { const t = -1 + i / 12; return [x + (t + 1) / 2 * W0, y + H0 - f(t) * H0]; });
  return `<rect x="${x - 4}" y="${y - 4}" width="${W0 + 8}" height="${H0 + 8}" rx="7" fill="#FFFFFF" stroke="#E3E0EC"/><path d="${pathOf(pts)}" fill="none" stroke="#4E7A2A" stroke-width="2.2"/>${T(x + W0 / 2, y + H0 + 20, label, { fs: 11.5, fw: 600, c: "#655F78" })}`;
};

/* layer stack for Q2, read bottom to top */
function STACK() {
  const id = uid("st");
  const up = (y1, y2) => `<line x1="110" y1="${y1}" x2="110" y2="${y2 + 3}" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>`;
  return svg("0 0 360 290", "Two linear layers with an activation function between them, read from bottom to top", `
    <defs>${mk(id, "#7D7794")}</defs>
    ${box(30, 240, 160, 38, "#EEF0F5", "#9AA3B8")}${T(110, 264, "input x", { fs: 14 })}
    ${up(240, 214)}
    ${box(20, 176, 180, 38, "#CFE2F3", "#3C78D8")}${T(110, 200, "Linear: W₁x + b₁", { fs: 14 })}
    ${up(176, 150)}
    ${box(20, 112, 180, 38, "#FFF2CC", "#C9A227", 'stroke-dasharray="6 4" stroke-width="2.2"')}${T(110, 136, "Activation  f( · )", { fs: 14 })}
    ${up(112, 86)}
    ${box(20, 48, 180, 38, "#CFE2F3", "#3C78D8")}${T(110, 72, "Linear: W₂h + b₂", { fs: 14 })}
    ${up(48, 18)}${T(110, 13, "output", { fs: 12.5, fw: 600, c: "#655F78" })}
    ${T(286, 104, "common choices for f", { fs: 12, fw: 700, c: "#655F78" })}
    ${actIcon(222, 114, "relu", "ReLU")}${actIcon(280, 114, "sig", "sigmoid")}${actIcon(222, 186, "tanh", "tanh")}
    <path d="M200 131 H214" stroke="#C9A227" stroke-width="1.6" stroke-dasharray="3 3"/>`);
}

/* sigmoid and ReLU side by side */
function TWOACTS() {
  const panel = (x0, title, f, zr, yr, col, yt) => {
    const sx = lin(zr[0], zr[1], x0 + 26, x0 + 166), sy = lin(yr[0], yr[1], 150, 42);
    const pts = Array.from({ length: 81 }, (_, i) => { const z = zr[0] + (zr[1] - zr[0]) * i / 80; return [sx(z), sy(f(z))]; });
    return `<rect x="${x0 + 4}" y="6" width="170" height="182" rx="12" fill="#FFFFFF" stroke="#E3E0EC"/>
      ${T(x0 + 96, 26, title, { fs: 14 })}
      <line x1="${sx(zr[0])}" x2="${sx(zr[1])}" y1="${sy(0)}" y2="${sy(0)}" stroke="#C9C3D6"/><line x1="${sx(0)}" x2="${sx(0)}" y1="38" y2="152" stroke="#C9C3D6"/>
      <path d="${pathOf(pts)}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"/>
      ${T(sx(zr[0]), 168, zr[0], { fs: 11, fw: 600, c: "#655F78" })}${T(sx(0), 168, "0", { fs: 11, fw: 600, c: "#655F78" })}${T(sx(zr[1]), 168, zr[1], { fs: 11, fw: 600, c: "#655F78" })}
      ${yt.map(v => T(sx(0) - 5, sy(v) + 4, v, { a: "end", fs: 10.5, fw: 600, c: "#8A84A0" })).join("")}
      ${T(x0 + 96, 184, "input z", { fs: 11, fw: 600, c: "#655F78" })}`;
  };
  return svg("0 0 360 194", "Sigmoid squashes inputs into 0 to 1; ReLU is 0 for negative inputs and the identity for positive ones",
    panel(0, "Sigmoid σ(z)", z => 1 / (1 + Math.exp(-z)), [-6, 6], [0, 1], "#8E7CC3", [0.5, 1]) +
    panel(182, "ReLU(z)", z => Math.max(0, z), [-4, 4], [0, 4], "#6AA84F", [2, 4]));
}

/* fully connected network, columns of node counts; returns {svg, edges} */
function NET(cols, o = {}) {
  const W0 = o.w || 360, H0 = o.h || 230, xs = cols.map((_, i) => 46 + i * (W0 - 92) / (cols.length - 1));
  const ys = cols.map(n => Array.from({ length: n }, (_, j) => (H0 - 40) / 2 + 10 + (j - (n - 1) / 2) * Math.min(42, (H0 - 60) / Math.max(1, n - 1))));
  let edges = "";
  for (let l = 0; l < cols.length - 1; l++) ys[l].forEach((y1, a) => ys[l + 1].forEach((y2, b) =>
    edges += `<line class="ls3-e e${l + 1}" data-a="${a}" data-b="${b}" style="--k:${a * ys[l + 1].length + b}" x1="${xs[l] + 13}" y1="${y1.toFixed(1)}" x2="${xs[l + 1] - 13}" y2="${y2.toFixed(1)}" stroke="#D5D1E0" stroke-width="1.4"/>`));
  const fills = o.fills || ["#CFE2F3", "#E4DCF1", "#E4DCF1", "#D9EAD3"];
  const strokes = o.strokes || ["#3C78D8", "#8E7CC3", "#8E7CC3", "#6AA84F"];
  const nodes = ys.map((col, l) => col.map((y, j) => {
    const k = l === cols.length - 1 ? 3 : l === 0 ? 0 : 1;
    return `<g class="ls3-node l${l}" data-l="${l}" data-j="${j}"><circle cx="${xs[l]}" cy="${y.toFixed(1)}" r="13" fill="${fills[k]}" stroke="${strokes[k]}" stroke-width="1.6"/>${o.nodeText ? o.nodeText(l, j, xs[l], y) : ""}</g>`;
  }).join("")).join("");
  const labels = o.labels ? o.labels.map((t, l) => T(xs[l], H0 - 6, t, { fs: 12.5, fw: 700, c: "#655F78" })).join("") : "";
  return { svg: svg(`0 0 ${o.vw || W0} ${H0}`, o.aria || "A fully connected neural network", edges + nodes + labels + (o.extra || ""), o.cls || ""), xs, ys };
}

/* a four-step training loop; vals: four lines of text (or "?") */
function LOOP(vals, active = -1) {
  const id = uid("lp");
  const B = [[14, 18, "1 · Forward pass", "#CFE2F3", "#3C78D8"], [196, 18, "2 · Loss", "#F4CCCC", "#CC4125"], [196, 128, "3 · Backpropagation", "#FCE5CD", "#E69138"], [14, 128, "4 · Optimiser", "#D9EAD3", "#6AA84F"]];
  return svg("0 0 360 212", "A training step: forward pass, loss, backpropagation, optimiser, then repeat", `
    <defs>${mk(id, "#7D7794")}</defs>
    ${B.map(([x, y, t, f, s], i) => `<g class="ls3-lb ${i === active ? "on" : ""}"><rect class="ring" x="${x - 4}" y="${y - 4}" width="158" height="74" rx="14" fill="none" stroke="#FDD633" stroke-width="5"/>${box(x, y, 150, 66, f, s)}
      ${T(x + 75, y + 24, t, { fs: 13.5 })}<foreignObject x="${x + 6}" y="${y + 32}" width="138" height="32"><div xmlns="http://www.w3.org/1999/xhtml" class="ls3-lbt">${vals[i]}</div></foreignObject></g>`).join("")}
    <line x1="166" y1="51" x2="192" y2="51" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
    <line x1="271" y1="86" x2="271" y2="124" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
    <line x1="194" y1="161" x2="168" y2="161" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
    <line x1="89" y1="126" x2="89" y2="88" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>
    ${T(180, 112, "repeat", { fs: 11.5, fw: 700, c: "#8A84A0" })}`);
}

/* loss curve L(w) = w² with a ball and a step arrow */
function BOWL(o = {}) {
  const id = uid("bw"), sx = lin(-3.2, 3.2, 30, 340), sy = lin(0, 10.5, 188, 18);
  const pts = Array.from({ length: 97 }, (_, i) => { const w = -3.2 + 6.4 * i / 96; return [sx(w), sy(w * w)]; });
  const w0 = -2.5, w1 = -1.3;
  return svg("0 0 360 214", "Loss against weight value: a bowl with its minimum in the middle", `
    <defs>${mk(id, "#E69138")}</defs>
    <line x1="30" x2="340" y1="188" y2="188" stroke="#C9C3D6"/>${T(185, 207, "weight value w", { fs: 11.5, fw: 600, c: "#655F78" })}${T(14, 100, "loss", { fs: 11.5, fw: 600, c: "#655F78", rot: -90 })}
    <path d="${pathOf(pts)}" fill="none" stroke="#8E7CC3" stroke-width="3"/>
    <path d="M${sx(w0)} ${sy(w0 * w0) - 12} Q ${sx((w0 + w1) / 2)} ${sy(((w0 + w1) / 2) ** 2) - 34} ${sx(w1)} ${sy(w1 * w1) - 12}" fill="none" stroke="#E69138" stroke-width="2.2" stroke-dasharray="5 4" marker-end="url(#${id})"/>
    ${T(150, 125, "step = η × slope", { a: "start", fs: 12.5, c: "#B4651C" })}
    <circle cx="${sx(w0)}" cy="${sy(w0 * w0)}" r="9" fill="#FDD633" stroke="#361A54" stroke-width="2"/>
    <circle cx="${sx(0)}" cy="${sy(0)}" r="4" fill="#4E7A2A"/>${T(sx(0), sy(0) - 10, "minimum", { fs: 12, c: "#4E7A2A" })}`);
}

/* narrow valley contours (Q8) */
const VAL = { a: 0.1, b: 4, sx: lin(-4, 4, 20, 340), sy: lin(-2, 2, 184, 16), start: [-3.5, 1.5] };
function VALLEY(inner = "", cid) {
  const { a, b, sx, sy } = VAL, c = cid || uid("vc");
  const ell = [0.03, 0.12, 0.35, 0.8, 1.6, 2.9, 4.6, 7].map((L, i) => `<ellipse cx="${sx(0)}" cy="${sy(0)}" rx="${(Math.sqrt(2 * L / a) * 40).toFixed(1)}" ry="${(Math.sqrt(2 * L / b) * 42).toFixed(1)}" fill="${i ? "none" : "#E3F1DC"}" stroke="#CFC8E0" stroke-width="1.2"/>`).join("");
  return `<defs><clipPath id="${c}"><rect x="20" y="16" width="320" height="168" rx="10"/></clipPath></defs>
    <rect x="20" y="16" width="320" height="168" rx="10" fill="#FCFBFE" stroke="#E3E0EC"/>
    <g clip-path="url(#${c})">${ell}${inner}</g>
    <circle cx="${sx(0)}" cy="${sy(0)}" r="4.5" fill="#4E7A2A"/>
    <circle cx="${sx(VAL.start[0])}" cy="${sy(VAL.start[1])}" r="6" fill="#FFFFFF" stroke="#361A54" stroke-width="2"/>${T(sx(VAL.start[0]) + 2, sy(VAL.start[1]) - 11, "start", { fs: 11.5, c: "#361A54" })}`;
}
function optPath(kind, n) {
  const { a, b } = VAL, g = (x, y) => [a * x, b * y];
  let [x, y] = VAL.start; const p = [[x, y]];
  if (kind === "sgd") { for (let t = 0; t < n; t++) { const [gx, gy] = g(x, y); x -= 0.45 * gx; y -= 0.45 * gy; p.push([x, y]); } return p; }
  const b1 = 0.8, b2 = 0.99, lr = 0.35, m = [0, 0], v = [0, 0];
  for (let t = 1; t <= n; t++) { const gr = g(x, y); for (let k = 0; k < 2; k++) { m[k] = b1 * m[k] + (1 - b1) * gr[k]; v[k] = b2 * v[k] + (1 - b2) * gr[k] ** 2; }
    x -= lr * (m[0] / (1 - b1 ** t)) / (Math.sqrt(v[0] / (1 - b2 ** t)) + 1e-8); y -= lr * (m[1] / (1 - b1 ** t)) / (Math.sqrt(v[1] / (1 - b2 ** t)) + 1e-8); p.push([x, y]); }
  return p;
}
const vLoss = ([x, y]) => 0.5 * (VAL.a * x * x + VAL.b * y * y);

/* chain of layers with the gradient flowing back (Q10 question) */
function CHAIN() {
  const id = uid("ch"); let s = "";
  for (let l = 0; l < 10; l++) { const x = 12 + l * 31; s += box(x, 40, 25, 44, l < 1 ? "#CFE2F3" : "#E4DCF1", l < 1 ? "#3C78D8" : "#8E7CC3") + T(x + 12.5, 67, l + 1, { fs: 12 }) + (l ? T(x - 3, 114, "×?", { fs: 11.5, c: "#B4651C" }) : ""); }
  s += box(322, 40, 32, 44, "#F4CCCC", "#CC4125") + T(338, 67, "L", { fs: 14 });
  return svg("0 0 360 150", "Ten layers in a row with the loss at the end; the gradient travels back through every layer", `
    <defs>${mk(id, "#E69138")}</defs>${s}
    <line x1="348" y1="98" x2="16" y2="98" stroke="#E69138" stroke-width="2.4" marker-end="url(#${id})"/>
    ${T(180, 30, "layer 1 (input side)  →  layer 10  →  loss", { fs: 12, fw: 600, c: "#655F78" })}
    ${T(180, 140, "backprop: the gradient is multiplied by each layer’s factor on the way back", { fs: 11.5, fw: 600, c: "#B4651C" })}`);
}

/* polynomial fits on noisy data (Q11, Q12) */
const FIT = { f: x => 0.75 * Math.sin(2.6 * x), sigma: 0.2, n: 12, sx: lin(-1.05, 1.05, 26, 340), sy: lin(-1.45, 1.45, 196, 18) };
function sample(seed) { const r = rng(seed); return Array.from({ length: FIT.n }, (_, i) => { const x = -1 + 2 * (i + 0.15 + 0.7 * r()) / FIT.n; return [x, FIT.f(x) + FIT.sigma * gauss(r)]; }); }
function polyfit(pts, deg, lam = 1e-10) { const c = lstsq(pts.map(([x]) => Array.from({ length: deg + 1 }, (_, k) => x ** k)), pts.map(p => p[1]), lam); return x => c.reduce((s, ck, k) => s + ck * x ** k, 0); }
function curvePath(f) { const { sx, sy } = FIT; return pathOf(Array.from({ length: 121 }, (_, i) => { const x = -1 + 2 * i / 120; return [sx(x), sy(Math.max(-3, Math.min(3, f(x))))]; })); }
function FITPLOT(inner, clip) {
  const { sx, sy, f } = FIT;
  return `<defs><clipPath id="${clip}"><rect x="22" y="14" width="322" height="186" rx="8"/></clipPath></defs>
    <rect x="22" y="14" width="322" height="186" rx="8" fill="#FCFBFE" stroke="#E3E0EC"/>
    <line x1="22" x2="344" y1="${sy(0)}" y2="${sy(0)}" stroke="#ECE9F2"/>
    <g clip-path="url(#${clip})"><path d="${curvePath(f)}" fill="none" stroke="#C9C3D6" stroke-width="2" stroke-dasharray="5 5"/>${inner}</g>`;
}
const dots = pts => pts.map(([x, y]) => `<circle cx="${FIT.sx(x).toFixed(1)}" cy="${FIT.sy(y).toFixed(1)}" r="4.5" fill="#3C78D8" stroke="#FFFFFF" stroke-width="1.5"/>`).join("");
function TWOFITS() {
  const pts = sample(7), c1 = uid("fc"), c2 = uid("fc");
  const panel = (deg, title, clip, dx) => `<g transform="translate(${dx} 0) scale(.5 .5)">${FITPLOT(`<path d="${curvePath(polyfit(pts, deg))}" fill="none" stroke="${deg > 1 ? "#CC4125" : "#E69138"}" stroke-width="5"/>${dots(pts).replace(/r="4.5"/g, 'r="8"')}`, clip)}</g>${T(dx + 92, 118, title, { fs: 13 })}`;
  return svg("0 0 360 126", "Two models trained on the same data: a straight line and a wiggly curve through every point", panel(1, "Model A", c1, 0) + panel(9, "Model B", c2, 178));
}

/* training vs validation loss over epochs (Q12) */
const CURVES = {
  none: { n: 60, tr: t => 0.08 + 1.55 * Math.exp(-t / 10), va: t => 0.25 + 1.45 * Math.exp(-t / 9) + Math.max(0, t - 18) * 0.013 },
  reg: { n: 60, tr: t => 0.2 + 1.45 * Math.exp(-t / 11), va: t => 0.27 + 1.42 * Math.exp(-t / 10) + Math.max(0, t - 30) * 0.003 },
  big: { n: 60, tr: t => 0.02 + 1.6 * Math.exp(-t / 6.5), va: t => 0.26 + 1.4 * Math.exp(-t / 6.5) + Math.max(0, t - 11) * 0.022 },
};
const csx = lin(0, 60, 40, 340), csy = lin(0, 1.9, 182, 18);
const cpath = (f, n, upTo = n) => pathOf(Array.from({ length: upTo + 1 }, (_, t) => [csx(t), csy(Math.min(1.9, f(t)))]));
const cmin = c => { let b = 0; for (let t = 1; t <= c.n; t++) if (c.va(t) < c.va(b)) b = t; return b; };
function CURVEAXES() {
  return `<line x1="40" x2="340" y1="182" y2="182" stroke="#C9C3D6"/><line x1="40" x2="40" y1="18" y2="182" stroke="#C9C3D6"/>
    ${T(190, 204, "epochs →", { fs: 11.5, fw: 600, c: "#655F78" })}${T(16, 100, "loss", { fs: 11.5, fw: 600, c: "#655F78", rot: -90 })}
    <line x1="230" x2="254" y1="30" y2="30" stroke="#3C78D8" stroke-width="3"/>${T(260, 34, "training", { a: "start", fs: 12 })}
    <line x1="230" x2="254" y1="50" y2="50" stroke="#CC4125" stroke-width="3"/>${T(260, 54, "validation", { a: "start", fs: 12 })}`;
}
function CURVESTATIC() {
  const c = CURVES.none, b = cmin(c);
  return svg("0 0 360 212", "Training loss keeps falling while validation loss falls, then rises", CURVEAXES() + `
    <path d="${cpath(c.tr, c.n)}" fill="none" stroke="#3C78D8" stroke-width="3"/><path d="${cpath(c.va, c.n)}" fill="none" stroke="#CC4125" stroke-width="3"/>
    <line x1="${csx(b)}" x2="${csx(b)}" y1="${csy(c.va(b)) + 8}" y2="182" stroke="#8A84A0" stroke-dasharray="4 4"/>
    ${T(csx(b) - 10, csy(c.va(b)) - 26, "validation starts rising", { a: "start", fs: 11.5, c: "#B3261E" })}`);
}

/* ======================================================================
   Widgets
   ====================================================================== */

/* Q1: compute one neuron, then let people try their own weights */
W.ls3_neuron = el => {
  el.innerHTML = `<div class="ls3-neu"></div><p class="ls3-calc"></p>
    <div class="ls3-sliders">${range("w1", "w₁", -2, 2, 0.1, 0.5)}${range("w2", "w₂", -2, 2, 0.1, -1)}${range("b", "bias b", -3, 3, 0.1, -1)}</div>
    <div class="wg-foot"><span class="cap">Drag the sliders: you are now the training algorithm, choosing weights.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const neu = $(".ls3-neu", el), calc = $(".ls3-calc", el), ins = $$("input", el);
  const vals = () => ins.map(i => +i.value);
  const draw = show => {
    const [w1, w2, b] = vals(), z = w1 * 3 + w2 * 2 + b, a = Math.max(0, z);
    neu.innerHTML = NEURON(w1, w2, b, show);
    ins.forEach(i => i.nextElementSibling.textContent = num(+i.value, 1));
    const lines = [`<b>Weighted sum:</b> z = ${num(w1)} × 3 + ${par(w2)} × 2 + ${par(b)} = <b>${num(z)}</b>`, `<b>Activation:</b> ReLU(${num(z)}) = <b>${num(a)}</b> ${a > 0 ? "(positive, so it passes through)" : "(negative or zero, so ReLU outputs 0)"}`];
    calc.innerHTML = show >= 3 ? lines.join("<br>") : show >= 2 ? lines[0] : show >= 1 ? "<b>Multiply</b> each input by its weight…" : "&nbsp;";
  };
  ins.forEach(i => i.oninput = () => { tok(); draw(3); });
  const tok = runner(el);
  replayable(el, async still => {
    const ok = tok(); if (still) { draw(3); return; }
    for (let s = 0; s <= 3; s++) { draw(s); await sleep(s ? 1300 : 500); if (!ok()) return; }
  });
};

/* Q2: each ReLU adds one bend */
W.ls3_bends = el => {
  const r = rng(11), data = Array.from({ length: 26 }, (_, i) => { const x = i / 25; return [x, 0.52 + 0.3 * Math.sin(5.6 * x - 0.7) + 0.035 * gauss(r)]; });
  const sx = lin(0, 1, 26, 340), sy = lin(0.05, 1, 190, 16), cid = uid("bc");
  el.innerHTML = `<div class="ls3-plot"></div>${range("n", "ReLU neurons", 0, 8, 1, 0)}<div class="wg-foot"><span class="cap ls3-bc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const plot = $(".ls3-plot", el), inp = $("input", el), cap = $(".ls3-bc", el);
  const draw = n => {
    inp.value = n; inp.nextElementSibling.textContent = n;
    const knots = Array.from({ length: n }, (_, j) => (j + 1) / (n + 1));
    const feats = x => [1, x, ...knots.map(k => Math.max(0, x - k))];
    const c = lstsq(data.map(([x]) => feats(x)), data.map(p => p[1]));
    const fx = x => feats(x).reduce((s, v, k) => s + v * c[k], 0);
    const curve = pathOf(Array.from({ length: 101 }, (_, i) => [sx(i / 100), sy(fx(i / 100))]));
    const err = data.reduce((s, [x, y]) => s + (y - fx(x)) ** 2, 0) / data.length;
    plot.innerHTML = svg("0 0 360 206", "Data on a curve and a fit built from ReLU pieces", `<defs><clipPath id="${cid}"><rect x="22" y="10" width="322" height="186"/></clipPath></defs>
      <rect x="22" y="10" width="322" height="186" rx="8" fill="#FCFBFE" stroke="#E3E0EC"/>
      ${data.map(([x, y]) => `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="4" fill="#3C78D8" fill-opacity=".75"/>`).join("")}
      <g clip-path="url(#${cid})"><path d="${curve}" fill="none" stroke="#E69138" stroke-width="3.2" stroke-linejoin="round"/></g>
      ${knots.map(k => `<path d="M${sx(k)} ${sy(fx(k)) - 9}l5 9l-5 9l-5-9z" fill="#FDD633" stroke="#361A54" stroke-width="1.2"/>`).join("")}`);
    cap.innerHTML = n === 0 ? "<b>No activation:</b> the best the network can do is a straight line, however many layers it has." :
      `<b>${n} ReLU neuron${n > 1 ? "s" : ""} → ${n} bend${n > 1 ? "s" : ""}</b> (yellow). Error ${num(err * 1000, 1)} × 10<sup>−3</sup>. More neurons, more bends, a closer fit.`;
  };
  inp.oninput = () => { tok(); draw(+inp.value); };
  const tok = runner(el);
  replayable(el, async still => {
    const ok = tok(); if (still) { draw(6); return; }
    for (const n of [0, 1, 2, 3, 5, 8]) { draw(n); await sleep(n ? 1500 : 2200); if (!ok()) return; }
  });
};

/* Q3: function, slope and a sweeping tangent */
W.ls3_slopes = el => {
  const K2 = {
    sig: { f: z => 1 / (1 + Math.exp(-z)), d: z => { const s = 1 / (1 + Math.exp(-z)); return s * (1 - s); }, zr: [-6, 6], yr: [-0.05, 1.05], name: "Sigmoid", col: "#8E7CC3" },
    relu: { f: z => Math.max(0, z), d: z => z > 0 ? 1 : 0, zr: [-4, 4], yr: [-0.2, 4.2], name: "ReLU", col: "#6AA84F" },
  };
  el.innerHTML = `<div class="tabs"><button type="button" data-k="sig">Sigmoid</button><button type="button" data-k="relu">ReLU</button></div><div class="ls3-plot"></div>
    <div class="rope-read ls3-read"><div>input z<b class="rz">0</b></div><div>output<b class="rf">0</b></div><div>slope<b class="rd">0</b></div></div>
    <div class="wg-foot"><span class="cap ls3-sc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const plot = $(".ls3-plot", el), cap = $(".ls3-sc", el);
  let kind = "sig";
  const frame = z => {
    const k = K2[kind], sx = lin(k.zr[0], k.zr[1], 34, 342), sy = lin(k.yr[0], k.yr[1], 186, 14);
    const P = (fn, n = 120) => pathOf(Array.from({ length: n + 1 }, (_, i) => { const t = k.zr[0] + (k.zr[1] - k.zr[0]) * i / n; return [sx(t), sy(fn(t))]; }));
    const fz = k.f(z), dz = k.d(z), h = (k.zr[1] - k.zr[0]) * 0.12;
    plot.innerHTML = svg("0 0 360 200", `${k.name} and its slope`, `
      <line x1="34" x2="342" y1="${sy(0)}" y2="${sy(0)}" stroke="#C9C3D6"/><line x1="${sx(0)}" x2="${sx(0)}" y1="14" y2="186" stroke="#C9C3D6"/>
      <path d="${P(k.f)}" fill="none" stroke="${k.col}" stroke-width="3.2"/>
      <path d="${kind === "relu" ? `M${sx(k.zr[0])} ${sy(0)} H${sx(0)} M${sx(0)} ${sy(1)} H${sx(k.zr[1])}` : P(k.d)}" fill="none" stroke="#E69138" stroke-width="2.4" stroke-dasharray="6 4"/>
      <line x1="${sx(z - h)}" y1="${sy(fz - dz * h)}" x2="${sx(z + h)}" y2="${sy(fz + dz * h)}" stroke="#361A54" stroke-width="2"/>
      <circle cx="${sx(z)}" cy="${sy(fz)}" r="6" fill="#FDD633" stroke="#361A54" stroke-width="2"/>
      <line x1="40" x2="62" y1="26" y2="26" stroke="${k.col}" stroke-width="3.2"/>${T(68, 30, k.name + "(z)", { a: "start", fs: 12 })}
      <line x1="40" x2="62" y1="46" y2="46" stroke="#E69138" stroke-width="2.4" stroke-dasharray="6 4"/>${T(68, 50, "slope (derivative)", { a: "start", fs: 12 })}
      ${kind === "sig" ? T(sx(0) + 6, sy(0.25) - 6, "max slope 0.25", { a: "start", fs: 11.5, c: "#B4651C" }) : T(sx(2.6), sy(1) - 7, "slope = 1", { fs: 11.5, c: "#B4651C" })}`);
    $(".rz", el).textContent = num(z, 1); $(".rf", el).textContent = num(fz, 2); $(".rd", el).textContent = num(dz, kind === "sig" ? 3 : 0);
  };
  const setKind = k => { kind = k; $$(".tabs button", el).forEach(b => b.classList.toggle("on", b.dataset.k === k));
    cap.innerHTML = k === "sig" ? "<b>Sigmoid:</b> the slope is at most 0.25, at z = 0, and almost 0 in the flat tails." : "<b>ReLU:</b> the slope is exactly 1 for every positive input (and 0 for negative ones)."; };
  const tok = runner(el);
  async function sweep(still) {
    const ok = tok(); if (still) { setKind(kind); frame(kind === "sig" ? 3 : 2); return; }
    for (let loop = 0; loop < 2; loop++) {
      const k = K2[kind];
      for (let i = 0; i <= 60; i++) { frame(k.zr[0] + (k.zr[1] - k.zr[0]) * i / 60); await sleep(60); if (!ok()) return; }
    }
    frame(kind === "sig" ? 3 : 2);
  }
  $$(".tabs button", el).forEach(b => b.onclick = () => { setKind(b.dataset.k); sweep(!MOTION); });
  setKind("sig"); frame(0);
  replayable(el, sweep);
};

/* Q3: how much gradient survives L layers */
W.ls3_vanish = el => {
  el.innerHTML = `${range("L", "Layers", 1, 20, 1, 10)}<div class="ls3-vbars"></div><p class="cap ls3-vc" style="margin:10px 0 0"></p>`;
  const inp = $("input", el), out = $(".ls3-vbars", el), cap = $(".ls3-vc", el);
  const bar = (label, v, col, txt) => `<div class="ls3-vb"><span class="t">${label}</span><span class="bar"><i style="width:${Math.max(1, (Math.log10(v) + 13) / 13 * 100).toFixed(1)}%;background:${col}"></i></span><span class="n">${txt}</span></div>`;
  const draw = () => {
    const L = +inp.value, s = 0.25 ** L; inp.nextElementSibling.textContent = L;
    out.innerHTML = bar("Sigmoid", s, "#8E7CC3", `0.25${sup(L)} ≈ ${sci(s)}`) + bar("ReLU", 1, "#6AA84F", `1${sup(L)} = 1`) +
      `<div class="ls3-axis"><span>10<sup>−13</sup></span><span>10<sup>−6</sup></span><span>1</span></div>`;
    cap.innerHTML = `Best case for sigmoid (slope 0.25 at every layer): after <b>${L} layer${L > 1 ? "s" : ""}</b> only ${sci(s)} of the gradient is left${L >= 10 ? ", about one millionth or less" : ""}. With ReLU on active neurons it stays 1. (Log scale.)`;
  };
  inp.oninput = draw; draw();
};

/* Q4: count connections layer by layer */
W.ls3_count = el => {
  const net = NET([4, 5, 1], { labels: ["4 inputs", "5 hidden", "1 output"], aria: "A network with 4 inputs, 5 hidden units and 1 output",
    nodeText: (l, j, x, y) => l > 0 ? `<g class="ls3-bias"><circle cx="${x + 12}" cy="${y - 11}" r="7" fill="#FFF2CC" stroke="#C9A227" stroke-width="1.4"/>${T(x + 12, y - 7.5, "b", { fs: 9.5 })}</g>` : "" });
  el.innerHTML = `<div class="ls3-cnt">${net.svg}</div><div class="ls3-tally"></div><div class="wg-foot"><span class="cap">Every line is one weight.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const s = $("svg", el), tally = $(".ls3-tally", el), tok = runner(el);
  const show = (k, txt) => { s.setAttribute("class", "ls3-count " + ["", "c1", "c1 c2", "c1 c2", "c1 c2 c3"][k]); tally.innerHTML = txt; };
  const lines = ["&nbsp;", "Input → hidden: <b>4 × 5 = 20</b> weights", "Input → hidden: 4 × 5 = 20 · Hidden → output: <b>5 × 1 = 5</b>", "<b>20 + 5 = 25 weights</b>", "25 weights + <b>6 biases</b> (5 hidden + 1 output) = <b>31 parameters</b>"];
  replayable(el, async still => {
    const ok = tok(); if (still) { show(4, lines[3] + "<br>" + lines[4]); return; }
    for (let k = 0; k <= 4; k++) { show(k, k === 4 ? lines[3] + "<br>" + lines[4] : lines[k]); await sleep(k === 1 ? 2200 : 1600); if (!ok()) return; }
  });
};

/* Q4: parameter calculator */
W.ls3_params = el => {
  el.innerHTML = `<div class="ls3-presets"><button type="button" class="btn ghost small" data-p="4,5,1">This question: 4 → 5 → 1</button><button type="button" class="btn ghost small" data-p="784,128,10">Handwritten digits: 784 → 128 → 10</button></div>
    ${range("i", "Inputs", 1, 1000, 1, 4)}${range("h", "Hidden units", 1, 512, 1, 5)}${range("o", "Outputs", 1, 20, 1, 1)}
    <div class="rope-read"><div>weights<b class="pw"></b></div><div>biases<b class="pb"></b></div><div>parameters<b class="pp"></b></div></div><p class="cap ls3-pc" style="margin:10px 0 0"></p>`;
  const ins = $$("input", el), F = c => $(c, el), fmt = v => v.toLocaleString("en-GB");
  const draw = () => {
    const [i, h, o] = ins.map(x => +x.value); ins.forEach(x => x.nextElementSibling.textContent = x.value);
    F(".pw").textContent = fmt(i * h + h * o); F(".pb").textContent = fmt(h + o); F(".pp").textContent = fmt(i * h + h * o + h + o);
    F(".ls3-pc").innerHTML = `${fmt(i)} × ${fmt(h)} + ${fmt(h)} × ${fmt(o)} = <b>${fmt(i * h + h * o)} weights</b>, plus ${fmt(h + o)} biases.`;
  };
  ins.forEach(x => x.oninput = draw);
  $$("[data-p]", el).forEach(b => b.onclick = () => { b.dataset.p.split(",").forEach((v, k) => ins[k].value = v); draw(); });
  draw();
};

/* Q5: forward pass, then backward pass */
W.ls3_backprop = el => {
  const net = NET([2, 3, 1], { w: 300, vw: 360, h: 200, aria: "Forward pass to the loss, then the backward pass",
    extra: `${box(306, 68, 46, 44, "#F4CCCC", "#CC4125")}${T(329, 96, "L", { fs: 16 })}<line class="ls3-e e3" x1="268" y1="90" x2="304" y2="90" stroke="#D5D1E0" stroke-width="2"/>
      ${T(46, 192, "inputs", { fs: 12, fw: 700, c: "#655F78" })}${T(150, 192, "hidden", { fs: 12, fw: 700, c: "#655F78" })}${T(254, 192, "prediction ŷ", { fs: 12, fw: 700, c: "#655F78" })}${T(329, 132, "loss", { fs: 12, fw: 700, c: "#655F78" })}` });
  el.innerHTML = `<div class="ls3-bp">${net.svg}</div><div class="wg-foot"><span class="cap ls3-bpc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const s = $("svg", el), cap = $(".ls3-bpc", el), tok = runner(el);
  // gradient labels on a few edges
  const lab = [[1, 0, 0], [1, 2, 0], [0, 0, 1], [0, 1, 2]].map(([l, a, b], k) => {
    const x1 = net.xs[l] + 13, x2 = net.xs[l + 1] - 13, y1 = net.ys[l][a], y2 = net.ys[l + 1][b];
    return `<g class="ls3-gl" style="--k:${k}"><rect x="${(x1 + x2) / 2 - 22}" y="${(y1 + y2) / 2 - 11}" width="44" height="20" rx="6" fill="#FCE5CD" stroke="#E69138"/>${T((x1 + x2) / 2, (y1 + y2) / 2 + 3.5, "∂L/∂w", { fs: 10.5, c: "#8A4B12" })}</g>`;
  }).join("");
  s.insertAdjacentHTML("beforeend", lab);
  const set = c => s.setAttribute("class", "ls3-bpsvg " + c);
  replayable(el, async still => {
    const ok = tok();
    if (still) { set("f1 f2 f3 b3 b2 b1 g"); cap.innerHTML = "<b>Forward</b> (purple): inputs → prediction ŷ → loss. <b>Backward</b> (orange): the chain rule sends the error back, giving ∂L/∂w for every weight."; return; }
    const seq = [["", "Start with the inputs…"], ["f1", "<b>Forward pass:</b> each layer computes its outputs…"], ["f1 f2", "<b>Forward pass:</b> …until the network makes a prediction ŷ"], ["f1 f2 f3", "…and the <b>loss</b> measures how wrong ŷ is"],
      ["f1 f2 f3 b3", "<b>Backward pass:</b> start from the loss…"], ["f1 f2 f3 b3 b2", "…apply the chain rule layer by layer…"], ["f1 f2 f3 b3 b2 b1 g", "…until <b>every weight</b> has its gradient ∂L/∂w"]];
    for (let loop = 0; loop < 2; loop++) for (const [c, t] of seq) { set(c); cap.innerHTML = t; await sleep(1500); if (!ok()) return; }
  });
};

/* Q6: the training loop on a one-weight model: ŷ = wx, x = 2, y = 3, η = 0.05 */
W.ls3_loop = el => {
  const x = 2, y = 3, eta = 0.05, steps = [];
  let w = 0.5;
  for (let t = 0; t < 6; t++) { const yh = w * x, L = (yh - y) ** 2, g = 2 * (yh - y) * x, w2 = w - eta * g; steps.push({ w, yh, L, g, w2 }); w = w2; }
  el.innerHTML = `<div class="ls3-lp"></div><div class="scrollx"><table class="ls3-tbl"><thead><tr><th>step</th><th>w</th><th>ŷ = 2w</th><th>loss</th><th>∂L/∂w</th></tr></thead><tbody></tbody></table></div>
    <div class="wg-foot"><span class="cap ls3-lc">Model ŷ = w·x, one example x = 2, y = 3, learning rate η = 0.05.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const lp = $(".ls3-lp", el), tb = $("tbody", el), tok = runner(el);
  const vals = (s, k) => [k >= 0 ? `ŷ = 2 × ${num(s.w)} = <b>${num(s.yh)}</b>` : "make a prediction", k >= 1 ? `L = (${num(s.yh)} − 3)² = <b>${num(s.L)}</b>` : "how wrong?", k >= 2 ? `∂L/∂w = <b>${num(s.g)}</b>` : "gradients", k >= 3 ? `w ← ${num(s.w)} − 0.05 × ${par(s.g)} = <b>${num(s.w2)}</b>` : "update w"];
  const row = (s, t) => `<tr><td>${t + 1}</td><td>${num(s.w)}</td><td>${num(s.yh)}</td><td><span class="ls3-lbar" style="width:${Math.max(3, s.L / 4 * 48).toFixed(0)}px"></span>${num(s.L)}</td><td>${num(s.g)}</td></tr>`;
  replayable(el, async still => {
    const ok = tok();
    if (still) { lp.innerHTML = LOOP(vals(steps[0], 3)); tb.innerHTML = steps.map(row).join(""); return; }
    tb.innerHTML = "";
    for (let t = 0; t < steps.length; t++) {
      for (let k = 0; k < 4; k++) { lp.innerHTML = LOOP(vals(steps[t], k), k); await sleep(t ? 700 : 1500); if (!ok()) return; }
      tb.insertAdjacentHTML("beforeend", row(steps[t], t));
    }
  });
};

/* Q7: gradient descent on L(w) = w² with a learning-rate slider */
W.ls3_lr = el => {
  const sx = lin(-3.2, 3.2, 30, 340), sy = lin(0, 10.5, 188, 18), cid = uid("lc");
  const bowl = pathOf(Array.from({ length: 97 }, (_, i) => { const w = -3.2 + 6.4 * i / 96; return [sx(w), sy(w * w)]; }));
  el.innerHTML = `<div class="ls3-presets">${[["0.03", "Too small"], ["0.3", "Just right"], ["0.9", "Too large"], ["1.04", "Diverges"]].map(([v, t]) => `<button type="button" class="btn ghost small" data-v="${v}">${t} · η = ${v}</button>`).join("")}</div>
    ${range("eta", "Learning rate η", 0.02, 1.06, 0.01, 0.3)}<div class="ls3-plot"></div><div class="wg-foot"><span class="cap ls3-lrc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const plot = $(".ls3-plot", el), inp = $("input", el), cap = $(".ls3-lrc", el), tok = runner(el);
  const N = 14;
  const traj = eta => { const p = [-2.8]; for (let t = 0; t < N; t++) p.push(p[t] * (1 - 2 * eta)); return p; };
  const verdict = eta => { const f = Math.abs(1 - 2 * eta); return eta < 0.1 ? ["#E69138", "Too small: tiny careful steps. It will get there, but training crawls."] : f < 0.65 ? ["#4E7A2A", "Just right: big confident steps that settle at the minimum."] : f < 1 ? ["#E69138", "Too large: every step overshoots to the other side and the ball bounces before settling."] : ["#B3261E", "Diverges: each step lands further away than the last. The loss explodes."]; };
  const draw = (eta, k) => {
    const p = traj(eta).slice(0, k + 1), clip = w => Math.max(-3.15, Math.min(3.15, w));
    const pts = p.map(w => [sx(clip(w)), sy(Math.min(10.4, w * w))]);
    const [col, txt] = verdict(eta);
    plot.innerHTML = svg("0 0 360 206", "Gradient descent on a bowl-shaped loss", `<defs><clipPath id="${cid}"><rect x="24" y="10" width="322" height="182"/></clipPath></defs>
      <line x1="30" x2="340" y1="188" y2="188" stroke="#C9C3D6"/>${T(185, 204, "weight w", { fs: 11.5, fw: 600, c: "#655F78" })}
      <path d="${bowl}" fill="none" stroke="#8E7CC3" stroke-width="3"/><circle cx="${sx(0)}" cy="${sy(0)}" r="4" fill="#4E7A2A"/>
      <g clip-path="url(#${cid})"><path d="${pathOf(pts)}" fill="none" stroke="${col}" stroke-width="1.8" stroke-dasharray="4 3"/>
      ${pts.map((q, i) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${i === pts.length - 1 ? 8 : 4}" fill="${i === pts.length - 1 ? "#FDD633" : col}" stroke="#361A54" stroke-width="${i === pts.length - 1 ? 2 : 0}"/>`).join("")}</g>
      ${Math.abs(p[p.length - 1]) > 3.2 ? T(p[p.length - 1] > 0 ? 330 : 40, 30, "off the chart!", { a: p[p.length - 1] > 0 ? "end" : "start", fs: 12, c: "#B3261E" }) : ""}
      ${T(340, 30, `step ${k} · loss ${sci(p[p.length - 1] ** 2, true)}`, { a: "end", fs: 12, c: "#655F78" })}`);
    cap.innerHTML = `<b style="color:${col}">${txt}</b>`;
  };
  async function play(still) {
    const ok = tok(), eta = +inp.value; inp.nextElementSibling.textContent = eta.toFixed(2);
    if (still) { draw(eta, N); return; }
    for (let k = 0; k <= N; k++) { draw(eta, k); await sleep(k ? 330 : 500); if (!ok()) return; }
  }
  inp.oninput = () => play(true);
  inp.onchange = () => play(!MOTION);
  $$("[data-v]", el).forEach(b => b.onclick = () => { inp.value = b.dataset.v; play(!MOTION); });
  replayable(el, play);
};

/* Q8: SGD vs Adam in a narrow valley */
W.ls3_adam = el => {
  const N = 40, P1 = optPath("sgd", N), P2 = optPath("adam", N), { sx, sy } = VAL, cid = uid("vc");
  el.innerHTML = `<div class="ls3-plot"></div><div class="rope-read"><div>step<b class="as">0</b></div><div>SGD loss<b class="al" style="color:#B4651C">0</b></div><div>Adam loss<b class="aa" style="color:#4E7A2A">0</b></div></div>
    <div class="wg-foot"><span class="cap">Same start, same number of steps. <b style="color:#B4651C">SGD</b> bounces across the steep direction and crawls along the flat one; <b style="color:#4E7A2A">Adam</b> sizes each direction’s step separately.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const plot = $(".ls3-plot", el), tok = runner(el);
  const pp = (P, k) => pathOf(P.slice(0, k + 1).map(([x, y]) => [sx(x), sy(y)]));
  const draw = k => {
    plot.innerHTML = svg("0 0 360 200", "Loss contours of a long narrow valley with the paths of SGD and Adam", VALLEY(`
      <path d="${pp(P1, k)}" fill="none" stroke="#E69138" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="${pp(P2, k)}" fill="none" stroke="#4E7A2A" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="${sx(P1[k][0])}" cy="${sy(P1[k][1])}" r="5" fill="#E69138"/><circle cx="${sx(P2[k][0])}" cy="${sy(P2[k][1])}" r="5" fill="#4E7A2A"/>`, cid) +
      `<line x1="26" x2="44" y1="194" y2="194" stroke="#E69138" stroke-width="3"/>${T(48, 198, "SGD", { a: "start", fs: 11.5 })}<line x1="90" x2="108" y1="194" y2="194" stroke="#4E7A2A" stroke-width="3"/>${T(112, 198, "Adam", { a: "start", fs: 11.5 })}`);
    $(".as", el).textContent = k; $(".al", el).textContent = num(vLoss(P1[k]), 3); $(".aa", el).textContent = num(vLoss(P2[k]), 3);
  };
  replayable(el, async still => {
    const ok = tok(); if (still) { draw(N); return; }
    for (let k = 0; k <= N; k++) { draw(k); await sleep(k ? 150 : 600); if (!ok()) return; }
  });
};

/* Q9: 1,000 examples split into batches */
W.ls3_batch = el => {
  const C = 50, R = 20, cs = 6.6;
  let cells = ""; for (let i = 0; i < C * R; i++) cells += `<rect x="${(8 + (i % C) * cs).toFixed(1)}" y="${(8 + Math.floor(i / C) * cs).toFixed(1)}" width="5.4" height="5.4" rx="1.2"/>`;
  el.innerHTML = `<div class="tabs"><button type="button" data-b="1">Batch size 1</button><button type="button" data-b="100">Batch size 100</button><button type="button" data-b="1000">Batch size 1,000</button></div>
    <div class="ls3-grid">${svg(`0 0 ${16 + C * cs} ${16 + R * cs}`, "1,000 training examples shown as small squares", cells)}</div>
    <div class="rope-read"><div>updates per epoch<b class="bu"></b></div><div>this epoch<b class="bn">0</b></div><div>gradient<b class="bg" style="font-size:15px"></b></div></div>
    <div class="wg-foot"><span class="cap ls3-btc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const rects = $$(".ls3-grid rect", el), F = c => $(c, el), tok = runner(el);
  let B = 100;
  const pal = ["#8E7CC3", "#E69138", "#3C78D8", "#6AA84F", "#CC4125"];
  const paint = cur => rects.forEach((r, i) => { const b = Math.floor(i / B); r.setAttribute("fill", B === 1 ? (i <= cur ? "#8E7CC3" : "#E4E1EA") : b === cur ? pal[b % 5] : b < cur ? "#D8D2E8" : "#EEEBF3"); });
  const paintAll = () => rects.forEach((r, i) => r.setAttribute("fill", B === 1 ? "#8E7CC3" : pal[Math.floor(i / B) % 5]));
  const info = { 1: ["1,000", "very noisy", "<b>Batch size 1:</b> one example per update. 1,000 cheap, noisy updates per epoch."], 100: ["10", "fairly smooth", "<b>Batch size 100:</b> average the gradient over 100 examples, update, move to the next 100. 10 updates = 1 epoch."], 1000: ["1", "smooth", "<b>Full batch:</b> one smooth gradient from all 1,000 examples, one update per epoch, lots of memory."] };
  async function play(still) {
    const ok = tok(), [u, g, c] = info[B], n = 1000 / B;
    $$(".tabs button", el).forEach(b => b.classList.toggle("on", +b.dataset.b === B));
    F(".bu").textContent = u; F(".bg").textContent = g; F(".ls3-btc").innerHTML = c;
    if (still) { paintAll(); F(".bn").textContent = u; return; }
    const stepsPerTick = B === 1 ? 20 : 1, delay = B === 1 ? 60 : B === 100 ? 650 : 1200;
    for (let k = 0; k < n; k += stepsPerTick) { const cur = Math.min(n - 1, k + stepsPerTick - 1); paint(cur); F(".bn").textContent = (cur + 1).toLocaleString("en-GB"); await sleep(delay); if (!ok()) return; }
    paintAll();
  }
  $$(".tabs button", el).forEach(b => b.onclick = () => { B = +b.dataset.b; play(!MOTION); });
  replayable(el, play);
};

/* Q10: gradient size layer by layer, factor slider */
W.ls3_deep = el => {
  el.innerHTML = `<div class="ls3-presets"><button type="button" class="btn ghost small" data-f="0.5">Vanishing · ×0.5</button><button type="button" class="btn ghost small" data-f="1">Healthy · ×1</button><button type="button" class="btn ghost small" data-f="2">Exploding · ×2</button></div>
    ${range("f", "Factor per layer", 0.5, 2, 0.05, 0.5)}<div class="ls3-plot"></div><div class="wg-foot"><span class="cap ls3-dc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const plot = $(".ls3-plot", el), inp = $("input", el), cap = $(".ls3-dc", el), tok = runner(el);
  const sy = lin(-3, 3, 188, 34);   // log10 scale
  const draw = (f, shown) => {
    inp.nextElementSibling.textContent = "×" + num(f, 2);
    let bars = "";
    for (let l = 1; l <= 10; l++) {
      const v = f ** (11 - l), lg = Math.max(-3, Math.min(3, Math.log10(v))), x = 44 + (l - 1) * 29, vis = 11 - l <= shown;
      const y0 = sy(0), y1 = sy(lg), col = v < 0.2 ? "#8E7CC3" : v > 5 ? "#CC4125" : "#6AA84F";
      bars += `<g style="opacity:${vis ? 1 : 0.12};transition:opacity .3s"><rect x="${x}" y="${Math.min(y0, y1).toFixed(1)}" width="20" height="${Math.max(1.5, Math.abs(y1 - y0)).toFixed(1)}" rx="3" fill="${col}"/>${T(x + 10, 202, l, { fs: 11, fw: 600, c: "#655F78" })}</g>`;
    }
    plot.innerHTML = svg("0 0 360 212", "Gradient size at each layer on a log scale", `
      ${[-3, -2, -1, 0, 1, 2, 3].map(e => `<line x1="40" x2="336" y1="${sy(e)}" y2="${sy(e)}" stroke="${e ? "#F0EEF5" : "#8A84A0"}"/>${T(36, sy(e) + 4, e === 0 ? "1" : "10" + sup(e, true), { a: "end", fs: 10, fw: 600, c: "#8A84A0" })}`).join("")}
      ${bars}${box(338, 96, 20, 30, "#F4CCCC", "#CC4125")}${T(348, 116, "L", { fs: 12 })}
      ${T(190, 14, "gradient size at each layer (log scale) · layer 1 is the input side", { fs: 11, fw: 600, c: "#655F78" })}`);
    const v1 = f ** 10;
    cap.innerHTML = `At layer 1: ${num(f, 2)}${sup(10)} ≈ <b>${sci(v1)}</b>. ` + (v1 < 0.05 ? "<b style='color:#5B4596'>Vanishing:</b> the early layers barely learn." : v1 > 20 ? "<b style='color:#B3261E'>Exploding:</b> huge, unstable updates." : "<b style='color:#4E7A2A'>Healthy:</b> every layer gets a useful gradient.");
  };
  async function play(still) {
    const ok = tok(), f = +inp.value; if (still) { draw(f, 10); return; }
    for (let k = 0; k <= 10; k++) { draw(f, k); await sleep(220); if (!ok()) return; }
  }
  inp.oninput = () => play(true);
  $$("[data-f]", el).forEach(b => b.onclick = () => { inp.value = b.dataset.f; play(!MOTION); });
  replayable(el, play);
};

/* Q11: dartboards */
function DARTS() {
  const board = (cx, cy, bias, spread, seed) => {
    const r = rng(seed); let d = "";
    for (let k = 0; k < 9; k++) { const x = cx + bias[0] + gauss(r) * spread, y = cy + bias[1] + gauss(r) * spread; d += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="#361A54" stroke="#FFFFFF" stroke-width="1.2"/>`; }
    return [56, 40, 24, 9].map((R, i) => `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${["#FFFFFF", "#E4DCF1", "#FFFFFF", "#FDD633"][i]}" stroke="#B9A9E3" stroke-width="1.4"/>`).join("") + d;
  };
  return svg("0 0 360 300", "Four dartboards: low or high bias against low or high variance",
    T(150, 18, "Low variance", { fs: 12.5, c: "#655F78" }) + T(290, 18, "High variance", { fs: 12.5, c: "#655F78" }) +
    T(18, 92, "Low bias", { fs: 12.5, c: "#655F78", rot: -90 }) + T(18, 226, "High bias", { fs: 12.5, c: "#655F78", rot: -90 }) +
    board(150, 92, [0, 0], 5, 3) + board(290, 92, [0, 0], 20, 4) + board(150, 226, [22, -16], 5, 5) + board(290, 226, [20, -18], 20, 6) +
    T(150, 166, "the goal", { fs: 11, fw: 600, c: "#4E7A2A" }) + T(290, 296, "the worst of both", { fs: 11, fw: 600, c: "#B3261E" }));
}

/* Q11 question page: the four dartboards, each with what it means */
function DARTS4() {
  const board = (bias, spread, seed) => {
    const r = rng(seed); let d = "";
    for (let k = 0; k < 9; k++) { const x = 60 + bias[0] + gauss(r) * spread, y = 60 + bias[1] + gauss(r) * spread; d += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.4" fill="#361A54" stroke="#FFFFFF" stroke-width="1.3"/>`; }
    return svg("-22 -22 164 164", "Dartboard", [56, 40, 24, 9].map((R, i) => `<circle cx="60" cy="60" r="${R}" fill="${["#FFFFFF", "#E4DCF1", "#FFFFFF", "#FDD633"][i]}" stroke="#B9A9E3" stroke-width="1.5"/>`).join("") + d, "ls3-board");
  };
  const cell = (b, s, seed, head, sub, tone = "") => `<div class="ls3-dcell ${tone}">${board(b, s, seed)}<b>${head}</b>${sub ? `<span>${sub}</span>` : ""}</div>`;
  return `<div class="ls3-darts">
    <span></span><span class="ls3-dh">Low variance</span><span class="ls3-dh">High variance</span>
    <span class="ls3-dv"><span>Low bias</span></span>${cell([0, 0], 5, 3, "Accurate and consistent", "the goal", "good")}${cell([0, 0], 20, 4, "Right on average, but scattered")}
    <span class="ls3-dv"><span>High bias</span></span>${cell([22, -16], 5, 5, "Tightly grouped, but off target")}${cell([20, -18], 20, 6, "Off target and scattered", "the worst of both", "bad")}
  </div>`;
}

/* Q11/Q12: retrain on new samples and watch the fits move (mode "deg") or shrink weights with L2 (mode "l2") */
W.ls3_fit = el => {
  const mode = el.dataset.mode || "deg", clip = uid("fp"), test = (() => { const r = rng(999); return Array.from({ length: 200 }, () => { const x = -1 + 2 * r(); return [x, FIT.f(x) + FIT.sigma * gauss(r)]; }); })();
  const DEG = [[1, "Too simple · degree 1"], [3, "Just right · degree 3"], [9, "Too flexible · degree 9"]], LAM = [0, 0.0001, 0.001, 0.01, 0.1, 1];
  el.innerHTML = (mode === "deg" ? `<div class="tabs">${DEG.map(([d, t]) => `<button type="button" data-d="${d}">${t}</button>`).join("")}</div>` : range("lam", "Penalty λ", 0, 5, 1, 0)) +
    `<div class="ls3-plot"></div><div class="ls3-err"></div>
    <div class="wg-foot"><span class="cap ls3-fc"></span>${mode === "deg" ? `<button class="btn small" type="button" data-new>New training sample</button>` : `<button class="replay" type="button">↻ Replay</button>`}</div>`;
  const plot = $(".ls3-plot", el), err = $(".ls3-err", el), cap = $(".ls3-fc", el), tok = runner(el);
  let deg = 3, seed = 1, ghosts = [];
  const mse = (f, pts) => pts.reduce((s, [x, y]) => s + (y - f(x)) ** 2, 0) / pts.length;
  const draw = () => {
    const pts = sample(seed), lamI = mode === "l2" ? +$("input", el).value : 0, lam = LAM[lamI] || 1e-10, d = mode === "l2" ? 9 : deg;
    const fit = polyfit(pts, d, Math.max(1e-10, lam * FIT.n));
    if (mode === "l2") $("input", el).nextElementSibling.textContent = lam ? String(lam) : "0";
    const g = ghosts.map(f => `<path d="${curvePath(f)}" fill="none" stroke="#E69138" stroke-opacity=".28" stroke-width="2"/>`).join("");
    plot.innerHTML = svg("0 0 360 214", "Training points, the true pattern (dashed) and the fitted model", FITPLOT(g + `<path d="${curvePath(fit)}" fill="none" stroke="${d === 9 && lam < 0.001 ? "#CC4125" : "#E69138"}" stroke-width="3.2"/>` + dots(pts), clip) +
      `<line x1="200" x2="218" y1="206" y2="206" stroke="#C9C3D6" stroke-width="2" stroke-dasharray="5 5"/>${T(222, 210, "true pattern", { a: "start", fs: 11, fw: 600, c: "#655F78" })}`);
    const tr = mse(fit, pts), te = mse(fit, test), mx = 0.6, b = (t, v, c) => `<div class="brow" style="--lw:118px"><span class="t">${t}</span><span class="bar"><i style="width:${Math.min(100, v / mx * 100).toFixed(1)}%;background:${c}"></i></span><span class="n">${num(v, 3)}</span></div>`;
    err.innerHTML = b("training error", tr, "#3C78D8") + b("test error", Math.min(te, 9.99), "#CC4125");
    cap.innerHTML = mode === "l2" ? (lam < 0.001 ? "<b>No penalty:</b> large weights let the curve chase every point." : lam < 0.1 ? "<b>Some penalty:</b> smaller weights, a smoother curve that ignores the noise." : "<b>Too much penalty:</b> the weights are squeezed so hard the model underfits.")
      : deg === 1 ? "<b>High bias:</b> wrong in the same way on every sample. Press <b>New training sample</b>: the line barely moves." : deg === 3 ? "<b>Balanced:</b> close to the true pattern, and stable from sample to sample." : "<b>High variance:</b> it threads every training point, so each new sample gives a wildly different curve.";
  };
  if (mode === "deg") {
    $$(".tabs button", el).forEach(b => b.onclick = () => { tok(); deg = +b.dataset.d; ghosts = []; $$(".tabs button", el).forEach(x => x.classList.toggle("on", x === b)); draw(); });
    $("[data-new]", el).onclick = () => { tok(); const pts = sample(seed); ghosts.push(polyfit(pts, deg)); if (ghosts.length > 6) ghosts.shift(); seed++; draw(); };
    $$(".tabs button", el)[1].classList.add("on");
    draw();
    // show variance on its own: flexible model, five fresh samples
    if (MOTION) whenVisible(el, async () => {
      const ok = tok(); await sleep(900); if (!ok()) return;
      $$(".tabs button", el)[2].click(); const ok2 = tok();
      for (let k = 0; k < 4; k++) { await sleep(1300); if (!ok2()) return; const pts = sample(seed); ghosts.push(polyfit(pts, deg)); seed++; draw(); }
    });
  } else {
    $("input", el).oninput = () => { tok(); draw(); };
    replayable(el, async still => {
      const ok = tok(); if (still) { $("input", el).value = 3; draw(); return; }
      for (const k of [0, 1, 2, 3, 4]) { $("input", el).value = k; draw(); await sleep(1500); if (!ok()) return; }
    });
  }
};

/* Q12: loss curves under different fixes */
W.ls3_curves = el => {
  el.innerHTML = `<div class="tabs"><button type="button" data-c="none">No fix</button><button type="button" data-c="reg">Dropout or L2</button><button type="button" data-c="stop">Early stopping</button><button type="button" data-c="big">Bigger model, longer</button></div>
    <div class="ls3-plot"></div><div class="wg-foot"><span class="cap ls3-cc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const plot = $(".ls3-plot", el), cap = $(".ls3-cc", el), tok = runner(el);
  let cur = "none";
  const caps = { none: "<b>Overfitting:</b> after the dashed line, training loss keeps falling but validation loss climbs. The model is memorising.",
    reg: "<b>Dropout or L2:</b> training loss falls a little more slowly, but validation loss stays low for much longer.",
    stop: "<b>Early stopping:</b> watch validation loss, stop once it hasn’t improved for a few epochs, and keep the best checkpoint.",
    big: "<b>Bigger model, longer training:</b> more capacity and more time to memorise. Validation loss turns up sooner and climbs faster." };
  const draw = k => {
    const c = CURVES[cur === "stop" ? "none" : cur], b = cmin(c), stopAt = cur === "stop" ? Math.min(c.n, b + 6) : c.n, upto = Math.min(k, stopAt);
    plot.innerHTML = svg("0 0 360 212", "Training and validation loss against epochs", CURVEAXES() + `
      ${cur === "stop" ? `<path d="${cpath(c.tr, c.n)}" fill="none" stroke="#3C78D8" stroke-opacity=".18" stroke-width="3"/><path d="${cpath(c.va, c.n)}" fill="none" stroke="#CC4125" stroke-opacity=".18" stroke-width="3"/>` : ""}
      <path d="${cpath(c.tr, c.n, upto)}" fill="none" stroke="#3C78D8" stroke-width="3"/><path d="${cpath(c.va, c.n, upto)}" fill="none" stroke="#CC4125" stroke-width="3"/>
      ${upto >= b ? `<line x1="${csx(b)}" x2="${csx(b)}" y1="${csy(c.va(b)) + 7}" y2="182" stroke="#4E7A2A" stroke-width="1.6" stroke-dasharray="4 4"/><circle cx="${csx(b)}" cy="${csy(c.va(b))}" r="5" fill="#FDD633" stroke="#361A54" stroke-width="1.6"/>${T(csx(b) + 2, csy(c.va(b)) - 12, "best: epoch " + b, { a: "start", fs: 11.5, c: "#4E7A2A" })}` : ""}
      ${cur === "stop" && upto >= stopAt ? `<line x1="${csx(stopAt)}" x2="${csx(stopAt)}" y1="20" y2="182" stroke="#361A54" stroke-width="1.8"/>${T(csx(stopAt) + 5, 74, "stop", { a: "start", fs: 12, c: "#361A54" })}` : ""}`);
    cap.innerHTML = caps[cur];
  };
  async function play(still) {
    const ok = tok(); $$(".tabs button", el).forEach(b => b.classList.toggle("on", b.dataset.c === cur));
    if (still) { draw(60); return; }
    for (let k = 0; k <= 60; k += 2) { draw(k); await sleep(55); if (!ok()) return; }
    draw(60);
  }
  $$(".tabs button", el).forEach(b => b.onclick = () => { cur = b.dataset.c; play(!MOTION); });
  replayable(el, play);
};

/* Q12: dropout switches random neurons off each step */
W.ls3_dropout = el => {
  const net = NET([4, 6, 6, 2], { w: 360, h: 220, aria: "A network where random hidden neurons are switched off at each training step",
    nodeText: (l, j, x, y) => l === 1 || l === 2 ? `<g class="ls3-x"><path d="M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12" stroke="#B3261E" stroke-width="2.6" stroke-linecap="round"/></g>` : "" });
  el.innerHTML = `<div class="ls3-do">${net.svg}</div><div class="wg-foot"><span class="cap ls3-doc"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const s = $("svg", el), cap = $(".ls3-doc", el), tok = runner(el);
  const apply = off => {
    $$(".ls3-node", s).forEach(g => g.classList.toggle("off", off.has(g.dataset.l + ":" + g.dataset.j)));
    $$(".ls3-e", s).forEach(e => { const l = +[...e.classList].find(c => /^e\d$/.test(c)).slice(1); e.classList.toggle("off", off.has((l - 1) + ":" + e.dataset.a) || off.has(l + ":" + e.dataset.b)); });
  };
  replayable(el, async still => {
    const ok = tok();
    if (still) { const r = rng(3), off = new Set(); [1, 2].forEach(l => { for (let j = 0; j < 6; j++) if (r() < 0.4) off.add(l + ":" + j); }); apply(off); cap.innerHTML = "<b>Training:</b> a random 20 to 50% of neurons are switched off at every step, a different set each time. <b>At inference:</b> all are on."; return; }
    for (let loop = 0; loop < 2; loop++) {
      for (let step = 1; step <= 4; step++) {
        const r = rng(step * 17 + loop * 5), off = new Set(); [1, 2].forEach(l => { for (let j = 0; j < 6; j++) if (r() < 0.4) off.add(l + ":" + j); });
        apply(off); cap.innerHTML = `<b>Training step ${step}:</b> ${off.size} hidden neurons switched off (rate 40%). The rest must manage without them.`;
        await sleep(1300); if (!ok()) return;
      }
      apply(new Set()); cap.innerHTML = "<b>At inference:</b> every neuron is on (outputs scaled so the totals match training)."; await sleep(2000); if (!ok()) return;
    }
  });
};

/* ---------------- results screen: the network and its training loop ---------------- */
const EXP = [
  ["loss", 20, 16, 200, 46, "Loss", "L(ŷ, y): how wrong?", "#F4CCCC", "#CC4125"],
  ["output", 20, 96, 200, 46, "Output layer + softmax", "ŷ = softmax(z)", "#E4DCF1", "#8E7CC3"],
  ["activation", 34, 196, 172, 44, "Activation", "a = ReLU(z)", "#D9EAD3", "#6AA84F"],
  ["neuron", 34, 268, 172, 44, "Weighted sum + bias", "z = Wx + b", "#CFE2F3", "#3C78D8"],
  ["input", 20, 356, 200, 46, "Input", "x: one example’s features", "#EEF0F5", "#9AA3B8"],
  ["backprop", 252, 16, 136, 62, "Backpropagation", "∂L/∂w for every|weight and bias", "#FCE5CD", "#E69138"],
  ["optimiser", 252, 259, 136, 62, "Optimiser", "w ← w − η ∇L|SGD, Adam", "#FFF2CC", "#C9A227"],
  ["batch", 252, 356, 136, 46, "Mini-batch", "B examples at a time", "#EEF0F5", "#9AA3B8"],
];
const EXP_INFO = {
  input: { name: "Input", c: "#9AA3B8", q: [0], what: "One training example, written as a vector of numbers: its features. For an image, its pixel values; for a house, its size, number of rooms and location.", eq: String.raw`x = [x_1, x_2, \dots, x_n]`, eg: "In Question 1: x₁ = 3, x₂ = 2." },
  neuron: { name: "Weighted sum + bias", c: "#3C78D8", q: [0, 3], what: "Each neuron multiplies every input by a weight, adds them up and adds a bias. A layer does this for all its neurons at once, as one matrix multiplication.", eq: String.raw`z = Wx + b`, eg: "0.5 × 3 + (−1) × 2 + (−1) = −1.5" },
  activation: { name: "Activation function", c: "#6AA84F", q: [1, 2], what: "Bends the weighted sum with a non-linear function, so stacked layers can model curves instead of collapsing into one straight line. ReLU keeps positive values and turns negatives into 0.", eq: String.raw`a = \mathrm{ReLU}(z) = \max(0, z)`, eg: "ReLU(−1.5) = 0 · ReLU(2) = 2" },
  block: { name: "Hidden layers × L", c: "#8E7CC3", q: [3, 9], what: "Weighted sum, then activation, repeated layer after layer. Deeper networks can learn richer features, but the gradient has to survive the trip back through every layer.", eq: String.raw`h^{(\ell)} = f\big(W^{(\ell)} h^{(\ell-1)} + b^{(\ell)}\big)`, eg: "4 inputs → 5 hidden → 1 output: 4 × 5 + 5 × 1 = 25 weights." },
  output: { name: "Output layer + softmax", c: "#8E7CC3", q: [], what: "The last layer gives one score per class, and softmax turns the scores into probabilities that add up to 1. To predict a single number, such as a price, the output is used as it is.", eq: String.raw`\hat y_i = \frac{e^{z_i}}{\sum_j e^{z_j}}`, eg: "cat 0.85 · dog 0.10 · bird 0.05" },
  loss: { name: "Loss", c: "#CC4125", q: [10, 11], what: "One number that says how wrong the predictions are. Training makes it small on the training data; watching it on validation data tells you whether the model generalises.", eq: String.raw`L = -\sum_i y_i \log \hat y_i \quad \text{(cross-entropy)}`, eg: "True class cat, ŷ_cat = 0.85: L = −log 0.85 ≈ 0.16." },
  backprop: { name: "Backpropagation", c: "#E69138", q: [4], what: "Works backwards from the loss with the chain rule, computing how the loss would change if each weight and bias changed: the gradients. It doesn’t change anything itself.", eq: String.raw`\frac{\partial L}{\partial w} = \frac{\partial L}{\partial \hat y}\cdot\frac{\partial \hat y}{\partial w}`, eg: "ŷ = wx, L = (ŷ − y)²: ∂L/∂w = 2(1 − 3) × 2 = −8" },
  optimiser: { name: "Optimiser", c: "#C9A227", q: [5, 6, 7], what: "Uses the gradients to move every weight a small step downhill. The learning rate η sets the step size; Adam adapts it for each parameter using running averages of its gradients.", eq: String.raw`w \leftarrow w - \eta\,\frac{\partial L}{\partial w}`, eg: "w ← 0.5 − 0.05 × (−8) = 0.9" },
  batch: { name: "Mini-batch", c: "#9AA3B8", q: [8], what: "Training data goes in small batches. Each batch gives one gradient estimate and one update; one pass through every batch is an epoch.", eq: String.raw`g = \frac{1}{B}\sum_{i=1}^{B} \nabla_w\, \ell_i`, eg: "1,000 examples, batch size 100 → 10 updates per epoch." },
};
function EXPSVG() {
  const id = uid("ex"), cx = 120;
  const grp = ([part, x, y, w, h, label, sub, f, s]) => {
    const subs = sub.split("|"), narrow = w < 150;
    return `<g class="ab" data-part="${part}" tabindex="0" role="button" aria-label="${esc(label)}"><rect class="ring" x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="14" fill="none" stroke="#FDD633" stroke-width="5"/>${box(x, y, w, h, f, s, 'class="bx"')}
      ${T(x + w / 2, y + (subs.length > 1 ? 21 : 20), label, { fs: narrow ? 13.5 : 14.5 })}${subs.map((t, i) => T(x + w / 2, y + (subs.length > 1 ? 38 : 36) + i * 14, esc(t), { fs: 11.5, fw: 600, c: "#4A4460" })).join("")}</g>`;
  };
  const ar = (x1, y1, x2, y2, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${dash ? "#B4651C" : "#7D7794"}" stroke-width="2" ${dash ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#${id}${dash ? "o" : ""})"/>`;
  const flow = MOTION ? `<circle r="6.5" fill="#FDD633" stroke="#361A54" stroke-width="2" pointer-events="none"><animateMotion dur="8s" repeatCount="indefinite" path="M320 379 H${cx} V39 H320 V290 H212"/></circle>` : "";
  return svg("0 0 400 414", "A neural network and its training loop: forward pass up the left, backward pass and update down the right", `
    <defs>${mk(id, "#7D7794")}${mk(id + "o", "#B4651C")}</defs>
    <g class="ab" data-part="block" tabindex="0" role="button" aria-label="Hidden layers"><rect class="blk" x="12" y="166" width="216" height="162" rx="14" fill="#F3EFFB" stroke="#B9A9E3" stroke-width="1.6" stroke-dasharray="6 5"/>${T(26, 247, "Hidden layer × L", { fs: 12, c: "#5B4596", rot: -90 })}</g>
    ${ar(cx, 356, cx, 315)}${ar(cx, 268, cx, 243)}${ar(cx, 196, cx, 145)}${ar(cx, 96, cx, 65)}
    ${ar(220, 39, 249, 39)}${ar(320, 78, 320, 256)}${ar(252, 290, 209, 290, true)}${ar(252, 379, 223, 379)}
    ${T(334, 168, "gradients", { fs: 11.5, c: "#B4651C", rot: 90 })}${T(230, 282, "update", { fs: 10.5, c: "#B4651C" })}
    ${EXP.map(grp).join("")}${flow}`);
}
W.ls3_explorer = el => {
  const canJump = el.dataset.jump === "1";
  el.innerHTML = `<div class="explore"><div><div class="arch interactive ls3-exp">${EXPSVG()}</div><p class="xhint">One training step: forward up the left, then backward and update down the right. Tap any part.</p></div><div class="xinfo" aria-live="polite"></div></div>`;
  const info = $(".xinfo", el);
  const pick = part => {
    const d = EXP_INFO[part]; if (!d) return;
    $$(".ab", el).forEach(g => g.classList.toggle("on", g.dataset.part === part));
    info.innerHTML = `<div class="kick">Neural network training</div><h3><i style="border-color:${d.c}"></i>${esc(d.name)}</h3>
      <p>${esc(d.what)}</p>${EQ3(K(d.eq, true))}<div class="eg"><b>Example:</b> ${esc(d.eg)}</div>
      ${canJump && d.q.length ? `<div class="acts">${d.q.map(q => `<button class="btn ghost small" type="button" data-q="${q}">Revisit Question ${q + 1} →</button>`).join("")}</div>` : ""}`;
    $$("[data-q]", info).forEach(b => b.onclick = () => el.dispatchEvent(new CustomEvent("jumpq", { bubbles: true, detail: +b.dataset.q })));
  };
  $$(".ab", el).forEach(g => {
    g.addEventListener("click", e => { e.stopPropagation(); pick(g.dataset.part); });
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(g.dataset.part); } });
  });
  pick("neuron");
};

/* ======================================================================
   QUESTIONS
   ====================================================================== */
const QS = [
 { id: "neuron",
   q: "A neuron has inputs x₁ = 3 and x₂ = 2, weights w₁ = 0.5 and w₂ = −1, a bias b = −1 and a ReLU activation. What does it output?",
   options: ["−1.5", "0", "0.5", "4.5"],
   answer: 1,
   illus: () => `${NEURON(0.5, -1, -1, 0)}<p class="ilcap">Multiply, add, add the bias, then apply the activation.</p>`,
   explain: () =>
     P(1, "Step 1: a weighted sum plus a bias", `<div class="wg" data-w="ls3_neuron"></div>
       <p>Each input is multiplied by its weight: 0.5 × 3 = 1.5 and −1 × 2 = −2. Add them up and add the bias: 1.5 − 2 − 1 = <b>−1.5</b>. A weight says how much an input matters (and in which direction); the bias shifts the result up or down.</p>`) +
     P(2, "Step 2: the activation decides what passes on", `<p>ReLU keeps positive values and turns negative ones into 0. Here z = −1.5, so the neuron outputs <b>0</b>: for this input it stays quiet.</p>
       ${EQ3(texd`\begin{gathered} z = w_1 x_1 + w_2 x_2 + b \\ a = \mathrm{ReLU}(z) = \max(0, z) \end{gathered}`)}`) +
     P(3, "From one neuron to a layer", `<p>A layer is many neurons reading the same inputs, each with its own weights. Stack their weights as the rows of a matrix W and the whole layer is one line of maths:</p>
       ${EQ3(texd`\mathbf{a} = f(W\mathbf{x} + \mathbf{b})`, "W holds one row of weights per neuron, b one bias per neuron, f is the activation.")}
       <p>Training a network means finding the weights and biases that make these outputs useful.</p>`),
   whynot: { 0: "−1.5 is z, the weighted sum. The ReLU activation still has to be applied, and it turns −1.5 into 0.", 2: "This adds the bias with the wrong sign: 1.5 − 2 + 1. The bias is −1, so it is subtracted.", 3: "This drops the minus sign on w₂: 1.5 + 2 + 1. The second input pushes the sum down, not up." },
   take: "A neuron computes a weighted sum plus a bias, z = w·x + b, then applies its activation: here ReLU(−1.5) = 0." },

 { id: "activation",
   q: "What is the main purpose of an activation function in a neural network?",
   options: ["Add non-linearity", "Reduce the number of parameters", "Prevent overfitting", "Calculate the loss"],
   answer: 0,
   illus: () => `${STACK()}<p class="ilcap">Between layers, every neuron applies an activation function f. What is it for?</p>`,
   explain: () =>
     P(1, "Without an activation, layers collapse into one", `<p>Each layer computes a weighted sum, which is linear. Put one linear layer after another and you still have a single linear function:</p>
       ${EQ3(texd`\begin{aligned} &W_2(W_1 x + b_1) + b_2 \\ &= (W_2 W_1)\,x + (W_2 b_1 + b_2) \\ &= W' x + b' \end{aligned}`, "Two linear layers are one linear layer in disguise. So are a hundred.")}
       <p>A one-number example: layer 1 computes 2x + 1, layer 2 computes 3h − 4. Together: 3(2x + 1) − 4 = 6x − 1. Still a straight line.</p>`) +
     P(2, "Each ReLU adds a bend", `<div class="wg" data-w="ls3_bends"></div>
       <p>ReLU, max(0, z), is a straight line with one bend at 0. Each ReLU neuron contributes one bend, and a network adds bends together to follow any curve. With enough neurons it can approximate any continuous function as closely as you like (the <b>universal approximation theorem</b>).</p>`) +
     P(3, "Why that matters", `<p>Real patterns are curved: whether a photo shows a cat, how a crop’s yield depends on rain and temperature, which word comes next. Activations are what let a network learn them.</p>`),
   whynot: { 1: "Activations add no parameters (ReLU has none) and remove none. The parameters are the weights and biases.", 2: "That is the job of regularisation, such as dropout, L2 and early stopping (Question 12). Extra flexibility can even make overfitting easier.", 3: "The loss function compares predictions with the true answers. Activations work inside the network, on every neuron." },
   take: "Activation functions add non-linearity: without them, any stack of layers collapses into a single straight-line model." },

 { id: "relu",
   q: "Why is ReLU usually preferred over sigmoid in the hidden layers of deep networks?",
   options: ["Its gradient is 1 for positive inputs, so gradients don’t shrink as they flow back", "It outputs probabilities between 0 and 1", "It is a linear function, so it adds no complexity", "It never outputs zero, so every neuron always learns"],
   answer: 0,
   illus: () => `${TWOACTS()}<p class="ilcap">Two activation functions. Look at how they behave for large inputs.</p>`,
   explain: () =>
     P(1, "Look at the slopes", `<div class="wg" data-w="ls3_slopes"></div>
       ${EQ3(texd`\begin{gathered} \sigma(z) = \frac{1}{1 + e^{-z}} \\[4pt] \sigma'(z) = \sigma(z)\big(1 - \sigma(z)\big) \le \tfrac{1}{4} \\[6pt] \mathrm{ReLU}'(z) = \begin{cases} 1 & z > 0 \\ 0 & z < 0 \end{cases} \end{gathered}`)}
       <p>Sigmoid flattens out at both ends: big changes in z barely change its output, so its slope is tiny there, and never more than 0.25. ReLU’s slope is exactly 1 for every positive input.</p>`) +
     P(2, "Backpropagation multiplies the slopes", `<div class="wg" data-w="ls3_vanish"></div>
       <p>On its way back to the early layers, the gradient is multiplied by every layer’s slope. With sigmoid it shrinks by at least 4× per layer: after 10 layers, 0.25<sup>10</sup> is about one millionth. With ReLU it passes through active neurons unchanged, so deep networks train much faster.</p>`) +
     P(3, "The small print", `<div class="grid3">${card("sage", "Also cheap", "max(0, z) is a single comparison: much faster to compute than e<sup>−z</sup>.")}${card("peach", "The catch: dying ReLU", "For negative inputs the slope is 0. A neuron stuck there gets no gradient and can stop learning. Leaky ReLU and GELU keep some slope for negative inputs.")}${card("blue", "Sigmoid still has a job", "At the output of a yes/no classifier, sigmoid turns a score into a probability between 0 and 1.")}</div>`),
   whynot: { 1: "That describes sigmoid, not ReLU: ReLU outputs any value from 0 upwards. Squashing into 0 to 1 is useful at the output, not in hidden layers.", 2: "ReLU is non-linear: it has a bend at 0. A linear activation would make the layers collapse into one (Question 2).", 3: "ReLU outputs exactly 0 for every negative input. Neurons stuck there can stop learning: the “dying ReLU” problem." },
   take: "ReLU’s slope is 1 for positive inputs, so gradients pass back through many layers without shrinking; sigmoid’s slope is at most 0.25." },

 { id: "count",
   q: "An MLP has 4 inputs, one hidden layer of 5 units and 1 output. How many weights does it have, ignoring biases?",
   options: ["10", "20", "25", "31"],
   answer: 2,
   illus: () => `${NET([4, 5, 1], { labels: ["4 inputs", "5 hidden", "1 output"], aria: "A network with 4 inputs, 5 hidden units and 1 output" }).svg}<p class="ilcap">Every unit connects to every unit in the next layer.</p>`,
   explain: () =>
     P(1, "Count the connections, layer by layer", `<div class="wg" data-w="ls3_count"></div>
       <p>Every input connects to every hidden unit: 4 × 5 = 20 weights. Every hidden unit connects to the output: 5 × 1 = 5 weights. Total: <b>25</b>. With the biases (one per hidden unit and one for the output) there are 31 parameters.</p>`) +
     P(2, "As matrices", `${EQ3(texd`\begin{gathered} W_1 \in \mathbb{R}^{5 \times 4}\ (20) \qquad W_2 \in \mathbb{R}^{1 \times 5}\ (5) \\[4pt] \text{weights} = \sum_{\ell} n_{\ell-1}\, n_{\ell} \end{gathered}`, "n<sub>ℓ</sub> is the number of units in layer ℓ. Add n<sub>ℓ</sub> biases per layer to get all the parameters.")}`) +
     P(3, "Try your own network", `<div class="wg" data-w="ls3_params"></div>
       <p>Parameter counts grow fast: a small digit classifier already has about 100,000. GPT-3 has 175 billion.</p>`),
   whynot: { 0: "10 adds up the units (4 + 5 + 1). Weights are connections between units, so multiply the sizes of neighbouring layers.", 1: "20 is only the input-to-hidden weights (4 × 5). The 5 hidden-to-output weights are missing.", 3: "31 also counts the 6 biases (5 hidden + 1 output). The question says to ignore biases." },
   take: "Weights are connections: multiply the sizes of neighbouring layers and add them up, 4 × 5 + 5 × 1 = 25." },

 { id: "backprop",
   q: "What does backpropagation calculate?",
   options: ["The model’s predictions", "The gradients of the loss with respect to every weight and bias", "The learning rate", "The updated weights"],
   answer: 1,
   illus: () => {
     const id = uid("bq"), B = [[["Input"], "#EEF0F5", "#9AA3B8"], [["Hidden", "layers"], "#E4DCF1", "#8E7CC3"], [["Prediction", "ŷ"], "#CFE2F3", "#3C78D8"], [["Loss", "L"], "#F4CCCC", "#CC4125"]];
     return svg("0 0 360 150", "Forward pass from input to loss, and a backward pass whose output is unknown", `<defs>${mk(id, "#7D7794")}${mk(id + "o", "#E69138")}</defs>
       ${B.map(([t, f, s], i) => box(2 + i * 94, 38, 72, 48, f, s) + t.map((line, k) => T(38 + i * 94, (t.length > 1 ? 58 : 67) + k * 16, line, { fs: 12.5 })).join("")).join("")}
       ${[0, 1, 2].map(i => `<line x1="${75 + i * 94}" y1="62" x2="${93 + i * 94}" y2="62" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>`).join("")}
       ${T(180, 28, "forward pass →", { fs: 12, c: "#3C78D8" })}
       <line x1="340" y1="104" x2="20" y2="104" stroke="#E69138" stroke-width="2.2" stroke-dasharray="6 4" marker-end="url(#${id}o)"/>
       ${T(180, 128, "← backward pass: what does it compute?", { fs: 12.5, c: "#B4651C" })}`) + `<p class="ilcap">Training runs a forward pass, then a backward pass.</p>`;
   },
   explain: () =>
     P(1, "Forward, then backward", `<div class="wg" data-w="ls3_backprop"></div>
       <p>The forward pass turns the inputs into a prediction and a loss. Backpropagation then works backwards, layer by layer, and answers one question for every weight and bias: <b>if I nudged this parameter, how much would the loss change?</b> That number is the gradient ∂L/∂w.</p>`) +
     P(2, "The chain rule, one link at a time", `<p>Take the smallest possible model: ŷ = w·x, with x = 2, w = 0.5 and the true answer y = 3. Then ŷ = 1 and the loss is L = (ŷ − y)² = 4. Chain the local slopes together:</p>
       ${EQ3(texd`\frac{\partial L}{\partial w} = \underbrace{\frac{\partial L}{\partial \hat y}}_{2(\hat y - y)} \cdot \underbrace{\frac{\partial \hat y}{\partial w}}_{x} = 2(1 - 3)\cdot 2 = -8`, "Negative: increasing w would reduce the loss.")}
       <p>In a real network the chain is longer, and backprop reuses each layer’s result for the layer before it, so every gradient costs about as much as one extra forward pass.</p>`) +
     P(3, "What backprop does not do", `<p>It doesn’t change a single weight. It only reports, for every parameter, which way and how strongly it affects the loss. Making the change is the optimiser’s job (next question).</p>`),
   whynot: { 0: "Predictions come from the forward pass, before backpropagation starts.", 2: "The learning rate is a setting you choose (a hyperparameter). Nothing calculates it during backprop.", 3: "The optimiser makes the update, using the gradients backprop provides (Question 6)." },
   take: "Backpropagation uses the chain rule to compute ∂L/∂w for every weight and bias: how the loss would change if that parameter changed." },

 { id: "roles",
   q: "In each training step, how do backpropagation and the optimiser share the work?",
   options: ["Backpropagation updates the weights; the optimiser calculates the gradients", "Backpropagation calculates the gradients; the optimiser uses them to update the weights", "Both update the weights independently, then average the results", "The optimiser calculates the loss; backpropagation makes the predictions"],
   answer: 1,
   illus: () => `${LOOP(["make a prediction", "how wrong is it?", "?", "?"])}<p class="ilcap">One training step, four jobs. What do steps 3 and 4 do?</p>`,
   explain: () =>
     P(1, "Watch one model learn", `<div class="wg" data-w="ls3_loop"></div>
       <p>Every step runs the same loop. The forward pass predicts, the loss measures the error, <b>backpropagation</b> computes the gradient, and the <b>optimiser</b> uses it to move the weight. In six steps w climbs from 0.5 towards 1.5, where 2w = 3 and the loss is 0.</p>`) +
     P(2, "A GPS and a driver", `<div class="cols">${card("peach", "Backpropagation = the GPS", "Works out which way is downhill for every weight: the gradients. It never moves the car.")}${card("sage", "Optimiser = the driver", "Decides how big a step to take and actually moves the weights.")}</div>
       ${EQ3(texd`w \leftarrow w - \eta\,\frac{\partial L}{\partial w}`, "The simplest optimiser (SGD). η is the learning rate. Adam is a different driver using the same GPS (Question 8).")}`),
   whynot: { 0: "That swaps the two roles. Gradients come from backprop; updates come from the optimiser.", 2: "Only the optimiser changes the weights. Backprop computes gradients, so there is nothing to average.", 3: "The loss function computes the loss and the forward pass makes the predictions." },
   take: "Backpropagation calculates the gradients; the optimiser uses them to update the weights. Together they make one training step." },

 { id: "lr",
   q: "What can happen when the learning rate is too large?",
   options: ["Training always becomes faster and more stable", "The model may overshoot good solutions", "The model stops using gradients", "The model automatically reduces its complexity"],
   answer: 1,
   illus: () => `${BOWL()}<p class="ilcap">Each update moves the weight downhill by learning rate × slope. What if the learning rate is too large?</p>`,
   explain: () =>
     P(1, "Roll the ball: try different learning rates", `<div class="wg" data-w="ls3_lr"></div>
       <p>Small steps reach the bottom slowly but surely. Sensible steps get there fast. Steps that are too big jump over the bottom and bounce from side to side, and even bigger ones climb out of the valley: the loss explodes.</p>`) +
     P(2, "Why it happens, in one line", `${EQ3(texd`\begin{gathered} w \leftarrow w - \eta \cdot \frac{dL}{dw} \\[4pt] L = w^2 \;\Rightarrow\; w \leftarrow (1 - 2\eta)\, w \end{gathered}`)}
       <p>For this bowl, every step multiplies w by (1 − 2η). If η is between 0.5 and 1 the factor is negative: w flips sides each step (overshooting) but still shrinks. If η is above 1 the factor is bigger than 1 in size, so each step lands further from the minimum.</p>`) +
     P(3, "In practice", `<div class="grid3">${card("sage", "Good starting points", "Around 0.001 for Adam; 0.01 to 0.1 for SGD. Then tune.")}${card("blue", "Schedules", "Many models warm the learning rate up at the start, then decay it as training settles.")}${card("pink", "Warning signs", "Loss jumping around, rising, or turning into NaN (not a number) often means the learning rate is too large.")}</div>`),
   whynot: { 0: "Bigger steps make training less stable, not more: the weights overshoot and bounce.", 2: "The model still follows the gradient; it just steps too far along it.", 3: "The learning rate only sets the step size. Model complexity comes from the architecture and regularisation." },
   take: "A learning rate that is too large overshoots the minimum, so the loss bounces around or even explodes; one that is too small makes training crawl." },

 { id: "adam",
   q: "What is a key difference between basic SGD and Adam?",
   options: ["Adam adapts the learning rate for each parameter", "SGD cannot train neural networks", "Adam does not use gradients", "SGD always converges faster"],
   answer: 0,
   illus: () => `<div class="cols" style="gap:10px">${card("peach", "SGD", `${EQ3(texd`\theta \leftarrow \theta - \eta\, g`)}<span class="cap">g: the gradient for one parameter θ</span>`)}${card("sage", "Adam", `${EQ3(texd`\begin{aligned} m &\leftarrow \beta_1 m + (1-\beta_1)\, g \\ v &\leftarrow \beta_2 v + (1-\beta_2)\, g^2 \\ \theta &\leftarrow \theta - \eta\, \frac{\hat m}{\sqrt{\hat v} + \epsilon} \end{aligned}`)}`)}</div><p class="ilcap">Compare the two update rules.</p>`,
   explain: () =>
     P(1, "A long, narrow valley", `<div class="wg" data-w="ls3_adam"></div>
       <p>This loss is steep across the valley and almost flat along it. SGD uses <b>one step size for every parameter</b>: big enough to make progress along the flat direction, it bounces across the steep one. Adam divides each parameter’s step by the size of its own recent gradients, so the steep direction takes small steps and the flat one takes bigger ones. (Toy example.)</p>`) +
     P(2, "Adam keeps two running averages per parameter", `<div class="cols">${card("blue", "m: momentum (1st moment)", "A running average of the gradients. It smooths out noise and keeps moving in the consistent downhill direction.")}${card("lav", "v: gradient size (2nd moment)", "A running average of the squared gradients. Large or noisy gradients → smaller steps; small, steady ones → larger steps.")}</div>
       ${EQ3(texd`\begin{gathered} \hat m = \frac{m_t}{1 - \beta_1^t} \qquad \hat v = \frac{v_t}{1 - \beta_2^t} \\[4pt] \theta_t = \theta_{t-1} - \eta\,\frac{\hat m}{\sqrt{\hat v} + \epsilon} \end{gathered}`, "The hats correct the early averages, which start at 0. Typical defaults: β₁ = 0.9, β₂ = 0.999, ε = 10<sup>−8</sup>, η = 0.001.")}`) +
     P(3, "The price: memory", `<p>Adam stores m and v for every parameter: two extra numbers per weight. For a 7-billion-parameter model that is 14 billion extra numbers. Even so, most large language models are trained with <b>AdamW</b>: Adam with weight decay applied separately.</p>`),
   whynot: { 1: "SGD trains neural networks well: it was the standard for years and is still widely used.", 2: "Adam is built entirely from gradients: m and v are running averages of them.", 3: "Not always: in long, narrow valleys plain SGD often converges more slowly. Which one wins depends on the problem." },
   take: "SGD uses one learning rate for every parameter; Adam adapts each parameter’s step using running averages of its gradients (m) and squared gradients (v)." },

 { id: "batch",
   q: "In mini-batch gradient descent, what does the batch size control?",
   options: ["The number of layers in the network", "The size of each weight update step", "How many training examples are used to compute each gradient update", "How many times the model sees the whole dataset"],
   answer: 2,
   illus: () => `<div class="ls3-code"><div class="c">dataset: 1,000 training examples</div>model.fit(x, y,<br>&nbsp;&nbsp;<span class="h b">batch_size=100</span>,<br>&nbsp;&nbsp;<span class="h l">learning_rate=0.01</span>,<br>&nbsp;&nbsp;<span class="h e">epochs=5</span>)</div><p class="ilcap">Three settings that sound alike. What does batch_size control?</p>`,
   explain: () =>
     P(1, "1,000 examples, batch size 100", `<div class="wg" data-w="ls3_batch"></div>
       ${EQ3(texd`g = \frac{1}{B}\sum_{i \in \text{batch}} \nabla_\theta\, \ell(x_i, y_i)`, "B is the batch size: each update uses the average gradient over B examples.")}
       <p>The model computes the gradient on 100 examples, updates the weights, then moves on to the next 100. Ten batches later it has seen every example once: one <b>epoch</b>.</p>`) +
     P(2, "The trade-off", `<div class="scrollx"><table class="cmp"><thead><tr><th></th><th>Small batch (e.g. 1)</th><th>Large batch (all data)</th></tr></thead><tbody>
       <tr><th>Gradient</th><td>Noisy</td><td>Smooth</td></tr><tr><th>Updates per epoch</th><td>Many, cheap</td><td>One, expensive</td></tr><tr><th>Memory</th><td>Little</td><td>A lot</td></tr></tbody></table></div>
       <p>Mini-batches of 32 to 256 are the usual balance: fairly smooth gradients that fit on a GPU.</p>`) +
     P(3, "Three settings, three jobs", `<div class="grid3">${card("lav", "Batch size", "How many examples per update.")}${card("peach", "Learning rate", "How big each update step is.")}${card("blue", "Epochs", "How many passes over the whole dataset.")}</div>
       <p>1,000 examples, batch size 100, 5 epochs: 10 updates per epoch × 5 = <b>50 updates</b>.</p>`),
   whynot: { 0: "That is the architecture (the depth). Batch size is about the data, not the network’s structure.", 1: "The step size is the learning rate. A bigger batch gives a less noisy gradient, but the learning rate sets how far each step goes.", 3: "That is the number of epochs." },
   take: "Batch size is how many examples are averaged to compute each gradient update: 1,000 examples with batch size 100 gives 10 updates per epoch." },

 { id: "deep",
   q: "Why can very deep neural networks sometimes be harder to train?",
   options: ["Each extra layer weakens the network’s ability to model non-linear patterns", "Gradients can become very small or very large", "Deeper networks always need smaller batches", "Backpropagation cannot compute gradients for deep layers"],
   answer: 1,
   illus: () => `${CHAIN()}`,
   explain: () =>
     P(1, "The gradient is a product of many factors", `<div class="wg" data-w="ls3_deep"></div>
       ${EQ3(texd`\frac{\partial L}{\partial h_1} = \frac{\partial L}{\partial h_{10}} \prod_{\ell=1}^{9} \frac{\partial h_{\ell+1}}{\partial h_\ell}`, "Each factor depends on that layer’s weights and activation slope. 0.5<sup>10</sup> ≈ 0.001; 2<sup>10</sup> ≈ 1,000.")}
       <p>Backpropagation starts at the loss and multiplies by one factor per layer on the way back. Factors below 1 make the gradient <b>vanish</b>: the early layers barely learn. Factors above 1 make it <b>explode</b>: updates become huge and training goes unstable.</p>`) +
     P(2, "Keeping gradients healthy", `<div class="grid3">
       ${card("sage", "ReLU activations", "Slope 1 for positive inputs, so active neurons don’t shrink the gradient.")}
       ${card("sage", "Residual connections", "x + f(x): a shortcut path, so the gradient always has a direct route back. Every Transformer uses them.")}
       ${card("sage", "Good initialisation and normalisation", "Start and keep each layer’s factor near 1 (He initialisation, batch or layer norm).")}
       ${card("blue", "Gradient clipping", "Cap the gradient’s size before each step, against explosions.")}
       ${card("blue", "Smaller learning rate", "Keeps each step under control while gradients are large.")}</div>`),
   whynot: { 0: "Each extra non-linear layer adds expressive power, not less. The difficulty is training it.", 2: "Batch size and depth are separate choices; deeper networks don’t need smaller batches.", 3: "Backpropagation computes exact gradients at any depth. The problem is their size: they can be tiny or huge." },
   take: "In a very deep network the gradient is a product of many factors, so it can vanish or explode; ReLU, residual connections, normalisation and clipping keep it healthy." },

 { id: "biasvar",
   q: "Which statement best describes the difference between bias and variance?",
   options: ["Bias: error from a model that is too simple. Variance: error from being too sensitive to the training data", "Bias: error on the training data. Variance: error from using too small a learning rate", "Bias comes from too many parameters. Variance comes from too few", "Bias and variance both mean the model has memorised the training data"],
   answer: 0,
   illus: () => `${DARTS4()}<p class="ilcap">Each dart is one model, trained on a different sample of data. The bullseye is the true answer.</p>`,
   explain: () =>
     P(1, "Reading the dartboards", `<p>Imagine training the same kind of model many times, each time on a different sample of data, and marking where its predictions land. Each dart is one trained model.</p>
       <div class="grid3">${card("peach", "Bias = how far off, on average", "How far the darts land from the bullseye <b>on average</b>: a systematic error, typical of a model that is <b>too simple</b> for the pattern.")}${card("lav", "Variance = how spread out", "How <b>scattered</b> the darts are: how much the model changes with its training data, typical of a model that is <b>too flexible</b>.")}${card("sage", "The goal", "Low bias and low variance: darts tight around the bullseye. The model has learned the pattern, not the noise.")}</div>
       <div class="wg">${TWOFITS()}<p class="cap" style="text-align:center;margin:8px 0 0">Two models trained on the same 12 points. Model A (a straight line) is too simple: high bias. Model B (degree 9) passes through every point: high variance.</p></div>`) +
     P(2, "See it: retrain on new data", `<div class="wg" data-w="ls3_fit" data-mode="deg"></div>
       <p>Press <b>New training sample</b> a few times and watch the faded curves. The straight line hardly moves but is always wrong (bias). The degree-9 curve chases each sample’s noise and changes every time (variance).</p>
       ${EQ3(texd`\begin{aligned} \mathbb{E}\big[(y - \hat f(x))^2\big] &= \mathrm{Bias}\big[\hat f(x)\big]^2 \\ &\quad + \mathrm{Var}\big[\hat f(x)\big] + \sigma^2 \end{aligned}`, "For squared error: σ² is the noise in the data, which no model can remove.")}`) +
     P(3, "Underfitting vs overfitting", `<div class="scrollx"><table class="cmp"><thead><tr><th></th><th>High bias: underfitting</th><th>High variance: overfitting</th></tr></thead><tbody>
       <tr><th>Model</th><td>Too simple for the pattern</td><td>Too flexible: fits the noise</td></tr>
       <tr><th>Training error</th><td>High</td><td>Very low</td></tr><tr><th>Test error</th><td>High</td><td>High</td></tr></tbody></table></div>
       <p><b>Quick check:</b> high training error points to bias; a big gap between training and test error points to variance.</p>`),
   whynot: { 1: "Bias isn’t simply training error, and variance has nothing to do with the learning rate. Both describe how a model’s predictions behave across training sets.", 2: "It’s the other way round: too few parameters → high bias; too many → high variance.", 3: "Memorising the training data is high variance (overfitting). High bias is the opposite: the model hasn’t captured the pattern at all." },
   take: "Bias is error from a model too simple for the pattern (underfitting); variance is error from a model too sensitive to its particular training data (overfitting)." },

 { id: "overfit",
   q: "Training loss keeps falling, but validation loss starts rising. Which is NOT a good way to fix this?",
   options: ["Add dropout", "Add L2 regularisation", "Use early stopping", "Make the model bigger and train for more epochs"],
   answer: 3,
   illus: () => `${CURVESTATIC()}<p class="ilcap">The model keeps getting better on its training data and worse on data it hasn’t seen.</p>`,
   explain: () =>
     P(1, "Spot it, then compare the fixes", `<div class="wg" data-w="ls3_curves"></div>
       <p>Training loss falling while validation loss rises is the warning sign of <b>overfitting</b>: the model is memorising its training set. Every good fix limits memorising. A bigger model trained for longer does the opposite: more capacity and more time to memorise.</p>`) +
     P(2, "Fix 1: dropout", `<div class="wg" data-w="ls3_dropout"></div>
       <p>At every training step, dropout switches off a random set of neurons. Like a team where random players miss each practice, every neuron has to learn something useful on its own, and the network can’t rely on a few memorised paths.</p>`) +
     P(3, "Fix 2: L2 regularisation", `${EQ3(texd`L_{\text{total}} = L_{\text{data}} + \lambda \sum_i w_i^2`, "λ sets how strong the penalty is. Also called weight decay.")}
       <div class="wg" data-w="ls3_fit" data-mode="l2"></div>
       <p>Every weight pays a tax for being large, so the model keeps a weight big only if it really reduces the error. Smaller weights give a smoother function that can’t chase the noise. Too much penalty and it underfits instead.</p>`) +
     P(4, "Fix 3: early stopping", `<p>Check validation loss after every epoch and save the best checkpoint so far. If it hasn’t improved for a few epochs (the <b>patience</b>), stop and keep the best checkpoint. Like a student who stops cramming once practice-test scores start falling.</p>
       <p class="cap">A bigger model does help when the problem is the opposite one: high bias, where even the training error is high.</p>`),
   whynot: { 0: "Dropout is a standard fix: it stops the network relying on any single neuron.", 1: "L2 is a standard fix: it penalises large weights, giving smoother fits.", 2: "Early stopping is a standard fix: it keeps the checkpoint from before validation loss started rising." },
   take: "When validation loss rises while training loss falls, the model is memorising: use dropout, L2 or early stopping, not a bigger model trained for longer." },
];

SESSIONS.push({
  id: "live-session-3",
  order: 3,
  label: "Live Session 3 of 4",
  course: "Course 03",
  title: "Design and Train Neural Networks",
  held: "Held live on Thursday 29 October 2026",
  cover: "/img/live-session-3.jpg",
  courseUrl: "https://www.skills.google/paths/3135",
  explore: "ls3_explorer",
  exploreTitle: "Explore a neural network and its training loop",
  questions: QS,
});
})();
