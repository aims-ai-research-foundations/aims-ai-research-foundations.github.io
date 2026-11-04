/* Live Session 2 quiz: Represent Your Language Data (Course 02).
   The pipeline from raw text to vectors that carry meaning: clean → tokenise → token IDs → embeddings.
   Running examples from the deck: "Ben was hungry", jollof and ugali, Habari za asubuhi. IDs and numbers are illustrative. */
"use strict";
(() => {

/* ---------------- shared data ---------------- */
// A toy vocabulary (IDs illustrative). Keys are matched case-insensitively.
const VOCAB = [["[PAD]", 0], ["[UNK]", 1], ["!", 5], [",", 11], [".", 13], ["?", 30], ["I", 40], ["a", 257], ["the", 262],
  ["to", 284], ["in", 287], ["and", 290], ["for", 329], ["he", 339], ["you", 345], ["was", 377], ["are", 389], ["some", 617],
  ["she", 673], ["how", 703], ["good", 922], ["went", 1625], ["looking", 2045], ["food", 2057], ["morning", 3329], ["market", 4720],
  ["hungry", 5120], ["dress", 6576], ["ate", 7525], ["Ben", 8412], ["rice", 11464], ["orange", 11942], ["juice", 13135],
  ["wore", 13368], ["drank", 24070], ["jollof", 24871], ["ugali", 31999], ["cat", 312], ["car", 313], ["dog", 8921]];
const VMAP = new Map(VOCAB.map(([t, id]) => [t.toLowerCase(), [t, id]]));
const tokenise = s => (s.match(/[\p{L}\p{M}]+|\d+|[^\s\p{L}\p{M}\d]/gu) || []).slice(0, 24);
const lookup = t => VMAP.get(t.toLowerCase()) || ["[UNK]", 1];
const fmtId = n => String(n);   // IDs are written plainly, like the ID list the model receives

// 2D embedding map (Q8, Q10): four clusters at different directions from the origin
// hand-placed on a 360 × 300 map with the origin at (180, 150), so labels never collide
const CLUSTERS = [
  { name: "Places", col: "#3C78D8", fill: "#CFE2F3", words: [["Lagos", 42, 58], ["Nairobi", 100, 44], ["Accra", 52, 100], ["Kigali", 108, 86]] },
  { name: "Animals", col: "#6AA84F", fill: "#D9EAD3", words: [["lion", 232, 48], ["zebra", 290, 40], ["giraffe", 226, 100], ["elephant", 276, 86]] },
  { name: "Food", col: "#E69138", fill: "#FCE5CD", words: [["jollof", 44, 206], ["ugali", 100, 196], ["injera", 50, 248], ["lunch", 106, 240]] },
  { name: "Sports", col: "#8E7CC3", fill: "#E4DCF1", words: [["football", 222, 200], ["rugby", 300, 196], ["athletics", 230, 246], ["netball", 296, 240]] },
];
const MAP_PTS = CLUSTERS.flatMap((c, ci) => c.words.map(([w, x, y]) => ({ w, ci, x, y, v: [x - 180, 150 - y] })));
const sgn = x => (x < -0.005 ? "−" : "") + Math.abs(x).toFixed(2);
const cosv = (a, b) => (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));

const arrowDefs = (id, col, size = 13) => `<marker id="${id}" viewBox="0 0 10 10" refX="7" refY="5" markerUnits="userSpaceOnUse" markerWidth="${size}" markerHeight="${size}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker>`;

/* ---------------- static illustration pieces ---------------- */
const flowBox = (cls, head, body = "") => `<div class="ls2-box ${cls}">${head ? `<b>${head}</b>` : ""}${body}</div>`;
const downAr = `<div class="ls2-down" aria-hidden="true">↓</div>`;

/* IDs on a number line, or the same tokens in embedding space (phase "a" or "b") */
function IDSVG(phase, id, crop) {
  const pts = [
    { t: "cat", n: 312, a: [39, 150], b: [118, 84], col: "#6AA84F" },
    { t: "car", n: 313, a: [39, 150], b: [290, 158], col: "#3C78D8" },
    { t: "dog", n: 8921, a: [298, 150], b: [152, 104], col: "#6AA84F" },
  ];
  const g = pts.map(p => `<g class="ls2-pt" style="transform:translate(${p[phase][0]}px,${p[phase][1]}px)" data-a="${p.a}" data-b="${p.b}">
      <circle r="7" fill="${p.col}" stroke="#FFFFFF" stroke-width="2"/>
      <text class="la" x="0" y="${p.t === "car" ? 26 : -14}" text-anchor="middle" font-size="14" font-weight="800" fill="#1B1530">${p.t} <tspan font-weight="600" fill="#655F78">${p.n}</tspan></text>
      <text class="lb" x="0" y="-14" text-anchor="middle" font-size="14" font-weight="800" fill="#1B1530">${p.t}</text></g>`).join("");
  return `<svg class="ls2-ids ${phase}" ${id ? `id="${id}"` : ""} viewBox="${crop ? "0 112 340 112" : "0 0 340 230"}" role="img" aria-label="Token IDs on a number line versus embeddings in a 2D space" ${FONT}>
    <g class="axA"><line x1="30" y1="150" x2="318" y2="150" stroke="#8A84A0" stroke-width="1.6"/>
      ${[0, 5000, 10000].map(v => `<line x1="${30 + v * 0.0288}" x2="${30 + v * 0.0288}" y1="145" y2="155" stroke="#8A84A0" stroke-width="1.6"/><text x="${30 + v * 0.0288}" y="196" text-anchor="middle" font-size="12" fill="#655F78">${v.toLocaleString("en-GB")}</text>`).join("")}
      <text x="174" y="216" text-anchor="middle" font-size="12.5" font-weight="700" fill="#655F78">token ID</text></g>
    <g class="axB"><ellipse cx="135" cy="92" rx="62" ry="40" fill="#D9EAD3" opacity=".7"/><text x="135" y="146" text-anchor="middle" font-size="12" font-weight="700" fill="#4E7A2A">animals</text>
      <ellipse cx="290" cy="160" rx="40" ry="28" fill="#CFE2F3" opacity=".7"/><text x="290" y="202" text-anchor="middle" font-size="12" font-weight="700" fill="#2A5DB0">vehicles</text>
      <line x1="22" y1="210" x2="330" y2="210" stroke="#C9C3D6"/><line x1="22" y1="210" x2="22" y2="12" stroke="#C9C3D6"/>
      <text x="330" y="226" text-anchor="end" font-size="11" fill="#8A84A0">dimension 1</text><text x="28" y="22" font-size="11" fill="#8A84A0">dimension 2</text></g>
    ${g}</svg>`;
}

/* two vectors from the origin (Q10 question) */
function COSQ() {
  const id = uid("lc"), o = [60, 190], a = [70, -38];
  return `<svg viewBox="0 0 340 220" role="img" aria-label="Vector a and vector 2a, pointing the same way" ${FONT}>
    <defs>${arrowDefs(id + "a", "#E69138", 15)}${arrowDefs(id + "b", "#3C78D8", 22)}</defs>
    <line x1="20" y1="190" x2="330" y2="190" stroke="#E3E0EC"/><line x1="60" y1="210" x2="60" y2="10" stroke="#E3E0EC"/>
    <line x1="${o[0]}" y1="${o[1]}" x2="${o[0] + 2 * a[0]}" y2="${o[1] + 2 * a[1]}" stroke="#3C78D8" stroke-width="9" stroke-linecap="round" stroke-opacity=".55" marker-end="url(#${id}b)"/>
    <line x1="${o[0]}" y1="${o[1]}" x2="${o[0] + a[0]}" y2="${o[1] + a[1]}" stroke="#E69138" stroke-width="4" stroke-linecap="round" marker-end="url(#${id}a)"/>
    <text x="${o[0] + a[0] - 14}" y="${o[1] + a[1] - 16}" font-size="17" font-weight="800" fill="#B4651C" font-style="italic">a</text>
    <text x="${o[0] + 2 * a[0] + 10}" y="${o[1] + 2 * a[1] + 4}" font-size="17" font-weight="800" fill="#2A5DB0" font-style="italic">2a</text>
    <circle cx="60" cy="190" r="4" fill="#1B1530"/></svg>`;
}

/* ======================================================================
   Widgets
   ====================================================================== */

/* Q1: the whole pipeline, one stage at a time */
W.ls2_pipeline = el => {
  const stages = [
    ["plain", "Raw text", `<code>${esc("<p>Ben was hungry!!</p>")}</code>`, "Raw text, straight from the web: tags, extra punctuation and all."],
    ["sage", "Clean", `<code>Ben was hungry!</code>`, "<b>Clean:</b> strip the HTML tags and noise, keep the language."],
    ["blue", "Tokenise", `<span class="toks">${["Ben", "was", "hungry", "!"].map(t => chip(t)).join("")}</span>`, "<b>Tokenise:</b> split the text into tokens, the units the model works with."],
    ["lav", "Token IDs", `<code>[8412, 377, 5120, 5]</code>`, "<b>Token IDs:</b> swap each token for its number in the vocabulary."],
    ["peach", "Embeddings", `<span class="ls2-vecs">${[[0.2, -0.4, 0.9, 0.1], [0.6, 0.1, -0.2, 0.3], [-0.3, 0.8, 0.5, -0.6], [0.1, -0.1, 0.2, 0.9]].map(v => vec(v, "q", { mini: true })).join("")}</span>`, "<b>Embeddings:</b> each ID picks out a learned vector of numbers."],
    ["dark", "Model", `<span class="ls2-bb">numbers in, numbers out</span>`, "<b>The model</b> finally gets what it can use: vectors."],
  ];
  el.innerHTML = `<div class="ls2-pipe">${stages.map(([c, h, b], i) => `${i ? `<span class="ls2-ar" aria-hidden="true"></span>` : ""}<div class="ls2-st ${c}" data-i="${i}"><b>${h}</b><div>${b}</div></div>`).join("")}</div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const st = $$(".ls2-st", el), cap = $(".cap", el); let run = 0;
  replayable(el, async still => {
    const my = ++run;
    if (still) { st.forEach(s => s.classList.add("on")); cap.innerHTML = "Course 02 is everything before the model: text in, vectors out."; return; }
    st.forEach(s => s.classList.remove("on", "cur"));
    for (let i = 0; i < st.length; i++) {
      st.forEach(s => s.classList.remove("cur")); st[i].classList.add("on", "cur"); cap.innerHTML = stages[i][3];
      await sleep(1500); if (my !== run || !el.isConnected) return;
    }
    st.forEach(s => s.classList.remove("cur"));
    cap.innerHTML = "Course 02 is everything before the model: text in, vectors out.";
  });
};

/* Q2: clean a scraped sample: remove the noise, fix the encoding, keep the language */
const SCRAPED = [
  { t: `<div class="nav">Home | Subscribe</div>`, tag: "HTML, boilerplate", act: "remove" },
  { t: "Ben was hungry so he went looking for food.", tag: "", act: "keep" },
  { t: "Ben was hungry so he went looking for food.", tag: "Duplicate", act: "remove" },
  { t: "CafÃ© on Moi Avenue serves chapati.", fix: "Café on Moi Avenue serves chapati.", tag: "Encoding error", act: "fix" },
  { t: "Call 07XX XXX XXX now!!! Best price!!!", tag: "Spam, personal info", act: "remove" },
  { t: "Sawa, let’s go to the market.", tag: "Code-switching", act: "keep" },
  { t: "Ọmọ náà ń jẹun.", tag: "Yoruba, with diacritics", act: "keep" },
];
const scrapedHTML = (tags) => `<div class="ls2-doc">${SCRAPED.map((r, i) => `<div class="ls2-line" data-i="${i}"><span class="txt">${esc(r.t)}</span>${tags && r.tag ? `<span class="ls2-tag">${esc(r.tag)}</span>` : ""}</div>`).join("")}</div>`;
W.ls2_clean = el => {
  el.innerHTML = scrapedHTML(true) + `<div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Run cleaning again</button></div>`;
  const lines = $$(".ls2-line", el), cap = $(".wg-foot .cap", el); let run = 0;
  const reset = () => lines.forEach((l, i) => { l.className = "ls2-line"; $(".txt", l).textContent = SCRAPED[i].t; const b = $(".ls2-badge", l); if (b) b.remove(); });
  const apply = (i) => {
    const r = SCRAPED[i], l = lines[i];
    if (r.act === "remove") l.classList.add("gone");
    else if (r.act === "fix") { l.classList.add("fixed"); $(".txt", l).textContent = r.fix; }
    else { l.classList.add("kept"); l.insertAdjacentHTML("beforeend", `<span class="ls2-badge">✓ keep</span>`); }
  };
  replayable(el, async still => {
    const my = ++run; reset();
    if (still) { SCRAPED.forEach((_, i) => apply(i)); cap.innerHTML = "<b>Clean text:</b> 4 real lines kept, 3 noisy lines removed, 1 encoding error fixed."; return; }
    cap.innerHTML = "Scraped text is messy. Let’s clean it line by line…";
    await sleep(1100);
    for (let i = 0; i < SCRAPED.length; i++) {
      if (my !== run || !el.isConnected) return;
      lines.forEach(l => l.classList.remove("cur")); lines[i].classList.add("cur"); apply(i);
      const r = SCRAPED[i];
      cap.innerHTML = r.act === "remove" ? `<b>Remove:</b> ${esc(r.tag.toLowerCase())}.` : r.act === "fix" ? "<b>Fix:</b> “CafÃ©” is “Café” read with the wrong encoding." : r.tag ? `<b>Keep:</b> ${esc(r.tag.toLowerCase())} is real language.` : "<b>Keep:</b> real text.";
      await sleep(1250);
    }
    lines.forEach(l => l.classList.remove("cur"));
    cap.innerHTML = "<b>Clean text:</b> 4 real lines kept, 3 noisy lines removed, 1 encoding error fixed.";
  });
};

/* Q3: a live toy tokeniser: type, see tokens and IDs */
W.ls2_tokenise = el => {
  const samples = ["Ben was hungry.", "I ate some jollof rice!", "Ben ate chapati."];
  el.innerHTML = `<label class="ls2-inp"><span>Type a sentence</span><input type="text" value="${esc(samples[0])}" maxlength="80" autocomplete="off" spellcheck="false"></label>
    <div class="ls2-samples">${samples.map(s => `<button type="button" class="btn ghost small">${esc(s)}</button>`).join("")}</div>
    <div class="ls2-steps"><div><span class="ls2-k">1 · Tokens</span><div class="ls2-tokrow"></div></div>
    <div><span class="ls2-k">2 · Token IDs: what the model receives</span><code class="ls2-idlist"></code></div></div>
    <p class="cap ls2-tcap" style="margin:10px 0 0"></p>`;
  const inp = $("input", el), row = $(".ls2-tokrow", el), ids = $(".ls2-idlist", el), cap = $(".ls2-tcap", el);
  const draw = () => {
    const toks = tokenise(inp.value), out = toks.map(lookup);
    row.innerHTML = toks.length ? toks.map((t, i) => `<span class="ls2-tok ${out[i][1] === 1 ? "unk" : ""}" style="animation-delay:${i * 60}ms"><span class="tk">${esc(t)}</span><span class="ls2-id">${fmtId(out[i][1])}</span></span>`).join("") : `<span class="cap">Type something above.</span>`;
    ids.textContent = "[" + out.map(o => o[1]).join(", ") + "]";
    const unk = toks.filter((t, i) => out[i][1] === 1);
    cap.innerHTML = unk.length ? `<b>${unk.map(t => `“${esc(t)}”`).join(", ")}</b> ${unk.length > 1 ? "are" : "is"} not in this toy word-level vocabulary, so ${unk.length > 1 ? "they become" : "it becomes"} <b>[UNK]</b> (ID 1). Subword tokenizers avoid this (Questions 5 and 6).`
      : "Every token was found in the vocabulary. Try a word it doesn’t know, like “chapati”.";
  };
  inp.addEventListener("input", draw);
  $$(".ls2-samples button", el).forEach((b, i) => b.onclick = () => { inp.value = samples[i]; draw(); });
  draw();
};

/* Q4: the vocabulary as a lookup table: encode and decode */
W.ls2_vocab = el => {
  const rows = [[0, "[PAD]"], [1, "[UNK]"], [13, "."], [377, "was"], [5120, "hungry"], [8412, "Ben"], ["…", "…"], [31999, "ugali"]];
  el.innerHTML = `<div class="ls2-vgrid"><div class="ls2-vt" role="table" aria-label="Vocabulary table"><div class="h"><span>ID</span><span>Token</span></div>
      ${rows.map(([id, t]) => `<div class="r" data-id="${id}"><span>${fmtId(id)}</span><span>${esc(t)}</span></div>`).join("")}
      <div class="ls2-vfoot">32,000 rows: the vocabulary size</div></div>
    <div class="ls2-lanes"><div class="ls2-lane enc"><span class="ls2-k">Encode: token → ID</span><div><span class="tk slot-in">Ben</span><span class="ls2-arr">→ look up →</span><span class="tk slot-out"> </span></div></div>
      <div class="ls2-lane dec"><span class="ls2-k">Decode: ID → token</span><div><span class="tk slot-in">8412</span><span class="ls2-arr">→ look up →</span><span class="tk slot-out"> </span></div></div></div></div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const R = $$(".r", el), cap = $(".wg-foot .cap", el), enc = $(".enc", el), dec = $(".dec", el); let run = 0;
  const hi = id => R.forEach(r => r.classList.toggle("on", r.dataset.id === String(id)));
  const set = (lane, a, b, on) => { $(".slot-in", lane).textContent = a; const o = $(".slot-out", lane); o.textContent = b; o.classList.toggle("new", !!on); lane.classList.toggle("on", !!on); };
  replayable(el, async still => {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (still) { hi(8412); set(enc, "Ben", "8412", true); set(dec, "8412", "Ben", true); cap.innerHTML = "Every token has one ID, and every ID maps back to one token."; return; }
    for (const [t, id] of [["Ben", 8412], ["hungry", 5120]]) {
      set(enc, t, " ", false); set(dec, String(id), " ", false); hi(null);
      cap.innerHTML = `<b>Encode</b> “${t}”: find its row in the table…`; await sleep(1100); if (!ok()) return;
      hi(id); await sleep(700); if (!ok()) return;
      set(enc, t, fmtId(id), true); cap.innerHTML = `“${t}” → <b>${fmtId(id)}</b>`; await sleep(1300); if (!ok()) return;
      hi(null); cap.innerHTML = `<b>Decode</b> ${fmtId(id)}: find the row with that ID…`; await sleep(900); if (!ok()) return;
      hi(id); await sleep(700); if (!ok()) return;
      set(dec, String(id), t, true); cap.innerHTML = `${fmtId(id)} → <b>“${t}”</b>. Encoding and decoding are the same table, read both ways.`; await sleep(1900); if (!ok()) return;
    }
  });
};

/* Q5: one text, three tokenisers */
const SPLITS = {
  "unbelievable": { word: [["unbelievable"]], sub: [["un", "believ", "able"]] },
  "Ben was hungry": { word: [["Ben"], ["was"], ["hungry"]], sub: [["Ben"], ["was"], ["hungry"]] },
  "Habari za asubuhi": { word: [["Habari"], ["za"], ["asubuhi"]], sub: [["Hab", "ari"], ["za"], ["as", "ub", "uhi"]] },
};
const charSplit = s => [...s].map(c => c === " " ? "␣" : c);
W.ls2_split3 = el => {
  const SCH = [["word", "Word-level", "100,000+"], ["sub", "Subword (BPE)", "about 32,000"], ["char", "Character-level", "about 100"]];
  let ex = "unbelievable", sch = 0, run = 0;
  el.innerHTML = `<div class="ls2-exs">${Object.keys(SPLITS).map(k => `<button type="button" data-ex="${esc(k)}">${esc(k)}</button>`).join("")}</div>
    <div class="tabs">${SCH.map((s, i) => `<button type="button" data-s="${i}">${s[1]}</button>`).join("")}</div>
    <div class="ls2-split"></div><div class="ls2-cmp3"></div><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const out = $(".ls2-split", el), cmp = $(".ls2-cmp3", el), cap = $(".wg-foot .cap", el);
  const toks = (k, s) => s === "char" ? [charSplit(k)] : SPLITS[k][s];
  const count = (k, s) => toks(k, s).reduce((a, w) => a + w.length, 0);
  const draw = () => {
    $$(".ls2-exs button", el).forEach(b => b.classList.toggle("on", b.dataset.ex === ex));
    $$(".tabs button", el).forEach((b, i) => b.classList.toggle("on", i === sch));
    const s = SCH[sch][0], n = count(ex, s);
    out.innerHTML = `<div class="ls2-words">${toks(ex, s).map(w => `<span class="ls2-word">${w.map((t, i) => `<span class="tk ${s === "sub" ? "q" : s === "char" ? "k" : "v"}" style="animation-delay:${i * 45}ms">${esc(t)}</span>`).join("")}</span>`).join("")}</div>
      <div class="ls2-stats"><div><b>${n}</b>token${n === 1 ? "" : "s"}</div><div><b>${SCH[sch][2]}</b>vocabulary size</div></div>`;
    const mx = count(ex, "char");
    cmp.innerHTML = bars(SCH.map(([k, name]) => [name, String(count(ex, k)), count(ex, k) / mx * 100, k === s ? "pick" : ""]));
    cap.innerHTML = s === "word" ? "Short sequences and meaningful tokens, but a huge vocabulary, and any word it hasn’t seen becomes [UNK]."
      : s === "char" ? "A tiny vocabulary that can spell anything, but the sequence gets long and each token carries little meaning."
      : "The balance: common words stay whole, rarer ones are built from a few pieces. (Splits are illustrative.)";
  };
  $$(".ls2-exs button", el).forEach(b => b.onclick = () => { run++; ex = b.dataset.ex; draw(); });
  $$(".tabs button", el).forEach(b => b.onclick = () => { run++; sch = +b.dataset.s; draw(); });
  replayable(el, async still => {
    const my = ++run;
    if (still) { sch = 2; draw(); return; }
    for (let i = 0; i < 3; i++) { sch = i; draw(); await sleep(2400); if (my !== run || !el.isConnected) return; }
  });
};

/* Q6: BPE, computed for real on the deck's tiny corpus */
const BPE_CORPUS = [["low", 5], ["lower", 2], ["lowest", 4]];
function bpeStates(maxMerges) {
  let words = BPE_CORPUS.map(([w, n]) => ({ sym: [...w, "</w>"], n }));
  const states = [];
  const pairs = ws => {
    const m = new Map();
    ws.forEach(({ sym, n }) => { for (let i = 0; i < sym.length - 1; i++) { const k = sym[i] + "\u0000" + sym[i + 1]; m.set(k, (m.get(k) || 0) + n); } });
    return [...m.entries()].map(([k, c], order) => ({ a: k.split("\u0000")[0], b: k.split("\u0000")[1], c, order }));
  };
  for (let s = 0; s <= maxMerges; s++) {
    const ps = pairs(words), best = ps.reduce((m, p) => (!m || p.c > m.c) ? p : m, null);   // ties: first seen wins
    states.push({ words: words.map(w => ({ sym: w.sym.slice(), n: w.n })), pairs: ps, best });
    if (!best || s === maxMerges) break;
    words = words.map(({ sym, n }) => { const o = []; for (let i = 0; i < sym.length; i++) { if (i < sym.length - 1 && sym[i] === best.a && sym[i + 1] === best.b) { o.push(best.a + best.b); i++; } else o.push(sym[i]); } return { sym: o, n }; });
  }
  return states;
}
W.ls2_bpe = el => {
  const S = bpeStates(6);
  let k = 0, timer = null;
  el.innerHTML = `<div class="ls2-bpe"><div><span class="ls2-k">Training words</span><div class="ls2-bwords"></div></div>
      <div><span class="ls2-k">Adjacent pairs, counted across the data</span><div class="ls2-bpairs"></div></div></div>
    <div class="ls2-merges"><span class="ls2-k">Merges learned so far</span><ol></ol></div>
    <div class="st-nav"><span class="cap ls2-bstep" style="margin-right:auto"></span><button class="btn ghost small" data-a="reset" type="button">Start over</button><button class="btn small" data-a="next" type="button">Merge the top pair →</button><button class="btn ghost small" data-a="play" type="button">▶ Play</button></div>`;
  const W_ = $(".ls2-bwords", el), Pp = $(".ls2-bpairs", el), M = $(".ls2-merges ol", el), stepCap = $(".ls2-bstep", el);
  const sym = t => t === "</w>" ? `<span class="tk ls2-eow">&lt;/w&gt;</span>` : esc(t.replace("</w>", "")) + (t.endsWith("</w>") && t !== "</w>" ? `<span class="ls2-eow-in">&lt;/w&gt;</span>` : "");
  const draw = (fresh) => {
    const s = S[k];
    W_.innerHTML = s.words.map(w => `<div class="ls2-brow"><span class="toks">${w.sym.map((t, i) => {
      const inBest = s.best && ((t === s.best.a && w.sym[i + 1] === s.best.b) || (t === s.best.b && w.sym[i - 1] === s.best.a));
      const isNew = fresh && k > 0 && t === S[k - 1].best.a + S[k - 1].best.b;
      return t === "</w>" ? `<span class="tk ls2-eow ${inBest ? "win" : ""}">&lt;/w&gt;</span>` : `<span class="tk ${inBest ? "win" : ""} ${isNew ? "new" : ""}">${sym(t)}</span>`;
    }).join("")}</span><span class="ls2-times">× ${w.n}</span></div>`).join("");
    const top = s.pairs.slice().sort((a, b) => b.c - a.c || a.order - b.order).slice(0, 6), mx = top.length ? top[0].c : 1;
    Pp.innerHTML = top.map(p => `<div class="brow ${p === s.best ? "pick" : ""}" style="--lw:96px"><span class="t">${esc((p.a + " " + p.b).replace(/<\/w>/g, "</w>"))}</span><span class="bar"><i style="width:${p.c / mx * 100}%"></i></span><span class="n">${p.c}</span></div>`).join("");
    M.innerHTML = S.slice(0, k).map(st => `<li><b>${esc(st.best.a)} + ${esc(st.best.b)}</b> → ${esc(st.best.a + st.best.b)} <span class="cap">(${st.best.c} times)</span></li>`).join("") || `<li class="cap" style="list-style:none;margin-left:-18px">None yet: we start from single letters.</li>`;
    stepCap.innerHTML = s.best ? `Top pair: <code class="ls2-mono">${esc(s.best.a)} ${esc(s.best.b)}</code>, ${s.best.c} times${k === 0 ? " (tied with <code class=\"ls2-mono\">o w</code>: the first one found wins)" : ""}` : "No pairs left.";
    $('[data-a="next"]', el).disabled = k >= S.length - 1;
  };
  const stop = () => { clearInterval(timer); timer = null; $('[data-a="play"]', el).innerHTML = "▶ Play"; };
  $('[data-a="next"]', el).onclick = () => { stop(); if (k < S.length - 1) { k++; draw(true); } };
  $('[data-a="reset"]', el).onclick = () => { stop(); k = 0; draw(); };
  $('[data-a="play"]', el).onclick = () => {
    if (timer) { stop(); return; }
    if (k >= S.length - 1) { k = 0; draw(); }
    $('[data-a="play"]', el).innerHTML = "❚❚ Pause";
    timer = setInterval(() => { if (!el.isConnected || k >= S.length - 1) { stop(); return; } k++; draw(true); }, 2200);
  };
  draw();
};

/* Q7: the tokenizer tax, before and after extending the tokenizer */
const TAX = [
  { name: "English", toks: [["Good"], ["morning"], [","], ["how"], ["are"], ["you"], ["?"]], cls: "v" },
  { name: "Kiswahili, English-trained tokenizer", toks: [["Hab", "ari"], ["za"], ["as", "ub", "uhi"], [","], ["hu", "jam", "bo"], ["?"]], cls: "q" },
  { name: "Kiswahili, extended tokenizer", toks: [["Habari"], ["za"], ["asubuhi"], [","], ["hujambo"], ["?"]], cls: "k" },
];
const taxCount = t => t.toks.reduce((a, w) => a + w.length, 0);
const taxRow = (t, anim) => `<div class="ls2-words">${t.toks.map(w => `<span class="ls2-word">${w.map((x, i) => `<span class="tk ${t.cls}" ${anim ? `style="animation-delay:${i * 70}ms"` : ""}>${esc(x)}</span>`).join("")}</span>`).join("")}</div>`;
W.ls2_tax = el => {
  let cur = 0, run = 0;
  el.innerHTML = `<div class="tabs">${TAX.map((t, i) => `<button type="button" data-i="${i}">${t.name}</button>`).join("")}</div>
    <div class="ls2-taxout"></div><div class="ls2-taxbars"></div><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const out = $(".ls2-taxout", el), bb = $(".ls2-taxbars", el), cap = $(".wg-foot .cap", el);
  const caps = ["7 tokens. English text was plentiful in the tokenizer’s training data, so common words are single tokens.",
    "11 tokens for the same greeting. Kiswahili words were rare in the training data, so they are chopped into small pieces.",
    "6 tokens. Trained or extended on Kiswahili text, the tokenizer learns merges for “habari”, “asubuhi” and “hujambo”."];
  const draw = () => {
    $$(".tabs button", el).forEach((b, i) => b.classList.toggle("on", i === cur));
    out.innerHTML = taxRow(TAX[cur], true);
    bb.innerHTML = bars(TAX.map((t, i) => [["English", "Kiswahili (before)", "Kiswahili (after)"][i], String(taxCount(t)), taxCount(t) / 11 * 100, i === cur ? "pick" : ""]), {});
    cap.innerHTML = caps[cur] + " (Token splits are illustrative.)";
  };
  $$(".tabs button", el).forEach(b => b.onclick = () => { run++; cur = +b.dataset.i; draw(); });
  replayable(el, async still => {
    const my = ++run; if (still) { cur = 1; draw(); return; }
    for (let i = 0; i < 3; i++) { cur = i; draw(); await sleep(3000); if (my !== run || !el.isConnected) return; }
  });
};

/* Q8: IDs on a number line morph into embedding space */
W.ls2_ids = el => {
  const sid = uid("lsid");
  el.innerHTML = IDSVG("a", sid) + `<div class="wg-foot ls2-wrapfoot"><span class="cap"></span><span class="ls2-btns"><button class="btn ghost small" type="button" data-p="a">Token IDs</button><button class="btn ghost small" type="button" data-p="b">Embeddings</button><button class="replay" type="button">↻ Replay</button></span></div>`;
  const svg = $("svg", el), cap = $(".wg-foot .cap", el); let run = 0;
  const show = p => {
    svg.classList.remove("a", "b"); svg.classList.add(p);
    $$(".ls2-pt", svg).forEach(g => { const [x, y] = g.dataset[p].split(","); g.style.transform = `translate(${x}px,${y}px)`; });
    $$("[data-p]", el).forEach(b => b.classList.toggle("on", b.dataset.p === p));
    cap.innerHTML = p === "a" ? "<b>As IDs:</b> “cat” (312) and “car” (313) sit on top of each other, and “dog” (8921) is miles away. The numbers are just labels."
      : "<b>As embeddings:</b> each ID looks up a learned vector. Now “cat” sits next to “dog”, and “car” is far away. (2D picture, simplified.)";
  };
  $$("[data-p]", el).forEach(b => b.onclick = () => { run++; show(b.dataset.p); });
  replayable(el, async still => {
    const my = ++run; if (still) { show("b"); return; }
    show("a"); await sleep(2600); if (my !== run || !el.isConnected) return; show("b");
  });
};

/* Q8: embedding space you can explore: tap a word, see its nearest neighbours */
W.ls2_space = el => {
  const cx = 180, cy = 150, id = uid("lsp");
  const P = MAP_PTS;
  const blobs = CLUSTERS.map((c, ci) => { const ps = P.filter(p => p.ci === ci), mx = ps.reduce((a, p) => a + p.x, 0) / ps.length, my = ps.reduce((a, p) => a + p.y, 0) / ps.length;
    return `<ellipse cx="${mx + 12}" cy="${my}" rx="66" ry="42" fill="${c.fill}" opacity=".75"/><text x="${mx + 12}" y="${ci < 2 ? my - 46 : my + 56}" text-anchor="middle" font-size="12.5" font-weight="800" fill="${c.col}">${c.name}</text>`; }).join("");
  el.innerHTML = `<svg viewBox="0 0 360 300" role="img" aria-label="Embedding space: places, animals, food and sports form clusters" ${FONT}>
      <defs>${arrowDefs(id + "s", "#1B1530")}${arrowDefs(id + "n", "#8A84A0")}</defs>
      <line x1="10" y1="${cy}" x2="350" y2="${cy}" stroke="#ECE9F2"/><line x1="${cx}" y1="8" x2="${cx}" y2="292" stroke="#ECE9F2"/>
      ${blobs}<line class="vs" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy}" stroke="#1B1530" stroke-width="2.4" marker-end="url(#${id}s)"/><line class="vn" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy}" stroke="#8A84A0" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#${id}n)"/>
      ${P.map((p, i) => `<g class="ls2-w" data-i="${i}" tabindex="0" role="button" aria-label="${p.w}"><circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${CLUSTERS[p.ci].col}"/><text x="${p.x + 8}" y="${p.y + 4}" font-size="12.5" font-weight="700" fill="#1B1530">${p.w}</text></g>`).join("")}
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="#1B1530"/></svg>
    <div class="ls2-nn"></div>`;
  const nn = $(".ls2-nn", el), gs = $$(".ls2-w", el), vs = $(".vs", el), vn = $(".vn", el);
  const pick = i => {
    const p = P[i], others = P.map((q, j) => ({ j, q, c: cosv(p.v, q.v) })).filter(o => o.j !== i).sort((a, b) => b.c - a.c);
    gs.forEach((g, j) => g.classList.toggle("on", j === i));
    const n = others[0].q;
    vs.setAttribute("x2", p.x); vs.setAttribute("y2", p.y); vn.setAttribute("x2", n.x); vn.setAttribute("y2", n.y);
    nn.innerHTML = `<p class="cap" style="margin:8px 0 6px">Cosine similarity with <b>${p.w}</b> (vectors from the centre):</p>` +
      bars(others.slice(0, 3).map(o => [o.q.w, sgn(o.c), Math.max(0, o.c) * 100, "pick"]).concat([[others[others.length - 1].q.w, sgn(others[others.length - 1].c), 0]]), {}) +
      `<p class="cap" style="margin:6px 0 0">Tap any word. Its nearest neighbours are always from the same group; the opposite group scores close to −1.</p>`;
  };
  gs.forEach(g => { g.onclick = () => pick(+g.dataset.i); g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(+g.dataset.i); } }; });
  pick(1);
};

/* Q9: "orange": one static vector, then context moves it */
W.ls2_orange = el => {
  const cols = [["red", 70, 58], ["blue", 112, 40], ["green", 58, 100], ["purple", 112, 86]], fr = [["mango", 252, 182], ["banana", 300, 168], ["pineapple", 262, 226], ["apple", 306, 210]];
  const S0 = [184, 136], ctx = { juice: [262, 166], dress: [120, 104] }, id = uid("lor");
  el.innerHTML = `<div class="tabs"><button type="button" data-c="static">Embedding table (static)</button><button type="button" data-c="juice">She drank orange juice</button><button type="button" data-c="dress">She wore an orange dress</button></div>
    <svg viewBox="0 0 360 260" role="img" aria-label="Static and contextual vectors for orange" ${FONT}>
      <defs>${arrowDefs(id, "#E69138")}</defs>
      <ellipse cx="88" cy="72" rx="70" ry="52" fill="#E4DCF1" opacity=".8"/><text x="88" y="14" text-anchor="middle" font-size="12.5" font-weight="800" fill="#5B4596">Colours</text>
      <ellipse cx="280" cy="198" rx="72" ry="50" fill="#D9EAD3" opacity=".8"/><text x="280" y="258" text-anchor="middle" font-size="12.5" font-weight="800" fill="#4E7A2A">Fruits</text>
      ${cols.concat(fr).map(([w, x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${x < 180 ? "#8E7CC3" : "#6AA84F"}"/><text x="${x + 8}" y="${y + 4}" font-size="12.5" font-weight="700" fill="#1B1530">${w}</text>`).join("")}
      <circle cx="${S0[0]}" cy="${S0[1]}" r="7" fill="#E69138"/><text x="${S0[0] - 12}" y="${S0[1] + 2}" text-anchor="end" font-size="13" font-weight="800" fill="#B4651C">orange</text><text x="${S0[0] - 12}" y="${S0[1] + 16}" text-anchor="end" font-size="11" fill="#655F78">static vector</text>
      <line class="ls2-oar" x1="${S0[0]}" y1="${S0[1]}" x2="${S0[0]}" y2="${S0[1]}" stroke="#E69138" stroke-width="2.4" stroke-dasharray="5 4" marker-end="url(#${id})"/>
      <g class="ls2-octx" style="transform:translate(${S0[0]}px,${S0[1]}px)"><circle r="8" fill="#FFFFFF" stroke="#E69138" stroke-width="3"/></g>
    </svg><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const ar = $(".ls2-oar", el), g = $(".ls2-octx", el), cap = $(".wg-foot .cap", el); let run = 0;
  const show = c => {
    $$(".tabs button", el).forEach(b => b.classList.toggle("on", b.dataset.c === c));
    const t = c === "static" ? S0 : ctx[c];
    g.style.transform = `translate(${t[0]}px,${t[1]}px)`; g.style.opacity = c === "static" ? 0 : 1;
    setTimeout(() => { ar.setAttribute("x2", t[0] + (c === "static" ? 0 : (S0[0] - t[0]) * 0.12)); ar.setAttribute("y2", t[1] + (c === "static" ? 0 : (S0[1] - t[1]) * 0.12)); }, c === "static" ? 0 : 450);
    cap.innerHTML = c === "static" ? "<b>The embedding table</b> has one row for “orange”: the same vector in every sentence, stuck between colours and fruits."
      : c === "juice" ? "<b>In context</b>, attention mixes in “drank” and “juice”: the contextual vector moves towards the fruits."
      : "<b>In context</b>, attention mixes in “wore” and “dress”: the contextual vector moves towards the colours.";
  };
  $$(".tabs button", el).forEach(b => b.onclick = () => { run++; show(b.dataset.c); });
  replayable(el, async still => {
    const my = ++run; if (still) { show("juice"); return; }
    for (const c of ["static", "juice", "dress", "juice"]) { show(c); await sleep(2600); if (my !== run || !el.isConnected) return; }
  });
};

/* Q10: drag two vectors and watch the cosine */
W.ls2_cosine = el => {
  const C = 150, U = 40, id = uid("lcs");
  let a = { x: 1.6, y: 0.8 }, b = { x: 3.0, y: 1.5 }, anim = 0;
  el.innerHTML = `<div class="ls2-cos"><svg viewBox="0 0 300 300" class="ls2-cossvg" role="img" aria-label="Two vectors a and b. Drag their tips to change the angle." ${FONT}>
      <defs>${arrowDefs(id + "a", "#E69138")}${arrowDefs(id + "b", "#3C78D8")}</defs>
      ${[-3, -2, -1, 1, 2, 3].map(k => `<line x1="${C + k * U}" x2="${C + k * U}" y1="6" y2="294" stroke="#F1EFF5"/><line y1="${C + k * U}" y2="${C + k * U}" x1="6" x2="294" stroke="#F1EFF5"/>`).join("")}
      <line x1="6" x2="294" y1="${C}" y2="${C}" stroke="#DAD6E0"/><line y1="6" y2="294" x1="${C}" x2="${C}" stroke="#DAD6E0"/>
      <path class="arc" fill="rgba(253,214,51,.35)" stroke="#C9A227" stroke-width="1.4"/>
      <line class="vb" x1="${C}" y1="${C}" stroke="#3C78D8" stroke-width="4.5" stroke-linecap="round" marker-end="url(#${id}b)"/>
      <line class="va" x1="${C}" y1="${C}" stroke="#E69138" stroke-width="4.5" stroke-linecap="round" marker-end="url(#${id}a)"/>
      <text class="ta" font-size="17" font-weight="800" font-style="italic" fill="#B4651C">a</text><text class="tb" font-size="17" font-weight="800" font-style="italic" fill="#2A5DB0">b</text>
      <circle class="hb ls2-handle" r="14" fill="rgba(60,120,216,.15)" stroke="#3C78D8" stroke-width="2"/><circle class="ha ls2-handle" r="14" fill="rgba(230,145,56,.15)" stroke="#E69138" stroke-width="2"/>
      <circle cx="${C}" cy="${C}" r="4" fill="#1B1530"/></svg>
    <div><div class="rope-read"><div>length of a<b class="la">0</b></div><div>length of b<b class="lb">0</b></div><div>angle θ<b class="th">0</b></div></div>
      <div class="rope-read" style="grid-template-columns:1fr 1fr"><div>a · b<b class="dp">0</b></div><div>cos θ<b class="cs">0</b></div></div>
      <p class="cap ls2-ccap" style="margin:10px 0 0"></p></div></div>
    <div class="tabs ls2-pre" style="margin-top:10px"><button type="button" data-p="same">b = 2a</button><button type="button" data-p="similar">Similar</button><button type="button" data-p="right">Right angle</button><button type="button" data-p="opp">Opposite</button></div>
    <p class="cap" style="margin:4px 0 0">Drag the tips of <b style="color:#B4651C">a</b> and <b style="color:#2A5DB0">b</b>, or pick a preset.</p>`;
  const svg = $("svg", el), F = c => $(c, el);
  const sx = v => C + v.x * U, sy = v => C - v.y * U;
  const draw = () => {
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y), dot = a.x * b.x + a.y * b.y, cs = dot / (la * lb);
    F(".va").setAttribute("x2", sx(a)); F(".va").setAttribute("y2", sy(a)); F(".vb").setAttribute("x2", sx(b)); F(".vb").setAttribute("y2", sy(b));
    F(".ha").setAttribute("cx", sx(a)); F(".ha").setAttribute("cy", sy(a)); F(".hb").setAttribute("cx", sx(b)); F(".hb").setAttribute("cy", sy(b));
    // labels sit just past the tip, nudged to opposite sides so a and b never cover each other
    const lab = (v, t, side) => { const l = Math.hypot(v.x, v.y), ux = v.x / l, uy = v.y / l; t.setAttribute("x", sx(v) + ux * 16 - side * uy * 16 - 5); t.setAttribute("y", sy(v) - uy * 16 - side * ux * 16 + 6); };
    lab(a, F(".ta"), 1); lab(b, F(".tb"), -1);
    const A = Math.atan2(a.y, a.x); let d = Math.atan2(b.y, b.x) - A; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
    const r = 30, p0 = [C + r * Math.cos(A), C - r * Math.sin(A)], p1 = [C + r * Math.cos(A + d), C - r * Math.sin(A + d)];
    F(".arc").setAttribute("d", Math.abs(d) < 0.02 ? "" : `M${C} ${C} L${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 0 ${d > 0 ? 0 : 1} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Z`);
    F(".la").textContent = la.toFixed(2); F(".lb").textContent = lb.toFixed(2);
    F(".th").textContent = Math.round(Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI) + "°";
    F(".dp").textContent = (Math.abs(dot) < 0.005 ? 0 : dot).toFixed(2); F(".cs").textContent = (Math.abs(cs) < 0.005 ? 0 : cs).toFixed(2);
    F(".ls2-ccap").innerHTML = cs > 0.995 ? "<b>Same direction: cos θ = 1</b>, however long either vector is." : cs < -0.995 ? "<b>Opposite directions: cos θ = −1.</b>" : Math.abs(cs) < 0.03 ? "<b>At right angles: cos θ = 0.</b> No similarity." : cs > 0 ? "Pointing roughly the same way: cos θ between 0 and 1." : "Pointing roughly opposite ways: cos θ between −1 and 0.";
  };
  const PRE = { same: [{ x: 1.6, y: 0.8 }, { x: 3.2, y: 1.6 }], similar: [{ x: 1.6, y: 0.8 }, { x: 1.4, y: 2.2 }], right: [{ x: 1.6, y: 0.8 }, { x: -1.1, y: 2.2 }], opp: [{ x: 1.6, y: 0.8 }, { x: -2.6, y: -1.3 }] };
  const go = (key, instant) => {
    $$(".ls2-pre button", el).forEach(x => x.classList.toggle("on", x.dataset.p === key));
    const [ta, tb] = PRE[key], fa = { ...a }, fb = { ...b }, my = ++anim, t0 = performance.now();
    if (instant || !MOTION) { a = { ...ta }; b = { ...tb }; draw(); return; }
    const step = t => { if (my !== anim || !el.isConnected) return; const k = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - k, 3);
      a = { x: fa.x + (ta.x - fa.x) * e, y: fa.y + (ta.y - fa.y) * e }; b = { x: fb.x + (tb.x - fb.x) * e, y: fb.y + (tb.y - fb.y) * e }; draw(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  $$(".ls2-pre button", el).forEach(x => x.onclick = () => go(x.dataset.p));
  let drag = null;
  const toV = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    let v = { x: (p.x - C) / U, y: (C - p.y) / U }; const l = Math.hypot(v.x, v.y);
    if (l > 3.2) v = { x: v.x / l * 3.2, y: v.y / l * 3.2 }; if (l < 0.35) v = { x: v.x / (l || 1) * 0.35, y: v.y / (l || 1) * 0.35 }; return v; };
  $$(".ls2-handle", el).forEach(h => {
    h.addEventListener("pointerdown", e => { e.preventDefault(); anim++; drag = h.classList.contains("ha") ? "a" : "b"; h.setPointerCapture(e.pointerId); $$(".ls2-pre button", el).forEach(x => x.classList.remove("on")); });
    h.addEventListener("pointermove", e => { if (!drag) return; const v = toV(e); if (drag === "a") a = v; else b = v; draw(); });
    h.addEventListener("pointerup", () => { drag = null; }); h.addEventListener("pointercancel", () => { drag = null; });
  });
  go("same", true);
};

/* Q11: training turns random vectors into clusters */
// a scattered, "random-looking" start where no two labels collide (also used by the question picture)
const START_WORDS = ["Lagos", "Nairobi", "Accra", "lion", "zebra", "giraffe", "jollof", "ugali", "lunch"];
const START_POS = [[210, 190], [40, 130], [260, 40], [140, 200], [50, 40], [180, 110], [270, 140], [110, 80], [40, 200]];
W.ls2_train = el => {
  const words = [["Lagos", 0, 62, 48], ["Nairobi", 0, 104, 66], ["Accra", 0, 66, 90], ["lion", 1, 250, 44], ["zebra", 1, 286, 66], ["giraffe", 1, 252, 92], ["jollof", 2, 146, 184], ["ugali", 2, 192, 204], ["lunch", 2, 222, 176]];
  const col = ["#3C78D8", "#6AA84F", "#E69138"], steps = [0, 100, 1000, 10000, 100000], f = [0, 0.22, 0.55, 0.85, 1], loss = [10.37, 7.9, 5.6, 4.2, 3.4];
  const start = START_POS;
  const pos = (i, k) => { const s = start[i], t = [words[i][2], words[i][3]], j = (1 - f[k]) * 16; return [s[0] + (t[0] - s[0]) * f[k] + (hash(i, k + 5) - 0.5) * j, s[1] + (t[1] - s[1]) * f[k] + (hash(i, k + 9) - 0.5) * j]; };
  el.innerHTML = `<div class="ls2-train"><svg viewBox="0 0 340 236" role="img" aria-label="Embeddings move from random positions into clusters during training" ${FONT}>
      <g class="ls2-cl" style="opacity:0"><ellipse cx="78" cy="68" rx="58" ry="40" fill="#CFE2F3"/><ellipse cx="270" cy="68" rx="56" ry="40" fill="#D9EAD3"/><ellipse cx="186" cy="192" rx="66" ry="36" fill="#FCE5CD"/>
        <text x="78" y="22" text-anchor="middle" font-size="12" font-weight="800" fill="#2A5DB0">places</text><text x="270" y="22" text-anchor="middle" font-size="12" font-weight="800" fill="#4E7A2A">animals</text><text x="186" y="152" text-anchor="middle" font-size="12" font-weight="800" fill="#B4651C">food</text></g>
      ${words.map(([w, c], i) => `<g class="ls2-tp" style="transform:translate(${start[i][0]}px,${start[i][1]}px)"><circle r="5.5" fill="${col[c]}"/><text x="8" y="4" font-size="12.5" font-weight="700" fill="#1B1530">${w}</text></g>`).join("")}</svg>
    <div class="ls2-trr"><div class="rope-read" style="grid-template-columns:1fr 1fr"><div>training step<b class="ts">0</b></div><div>loss<b class="tl">10.37</b></div></div>
      <svg class="ls2-loss" viewBox="0 0 200 90" ${FONT}><line x1="10" y1="78" x2="194" y2="78" stroke="#DAD6E0"/><line x1="10" y1="6" x2="10" y2="78" stroke="#DAD6E0"/><path class="lp" fill="none" stroke="#CC4125" stroke-width="2.4"/><text x="194" y="88" text-anchor="end" font-size="10" fill="#8A84A0">steps →</text><text x="194" y="12" text-anchor="end" font-size="10" fill="#8A84A0">loss</text></svg>
      <p class="cap ls2-tcap2" style="margin:6px 0 0"></p></div></div>
    <div class="wg-foot"><span class="cap">Numbers are illustrative.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const gs = $$(".ls2-tp", el), F = c => $(c, el);
  const lpt = k => [10 + k * 46, 78 - (loss[k] - 3) / 7.6 * 70];
  const show = k => {
    gs.forEach((g, i) => { const p = pos(i, k); g.style.transform = `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`; });
    F(".ls2-cl").style.opacity = k >= 3 ? 1 : 0;
    F(".ts").textContent = steps[k].toLocaleString("en-GB"); F(".tl").textContent = loss[k].toFixed(2);
    F(".lp").setAttribute("d", Array.from({ length: k + 1 }, (_, j) => (j ? "L" : "M") + lpt(j).map(v => v.toFixed(1)).join(" ")).join(" "));
    F(".ls2-tcap2").innerHTML = k === 0 ? "<b>Step 0:</b> random vectors. Every next token is equally likely, so the loss is ln(32,000) ≈ 10.4." : k < 3 ? "Each step predicts the next token, measures the loss, and nudges every parameter, embeddings included." : "Tokens used in similar contexts have been pushed together: clusters form, and the loss is low.";
  };
  let run = 0;
  replayable(el, async still => {
    const my = ++run; if (still) { show(4); return; }
    for (let k = 0; k < steps.length; k++) { show(k); await sleep(k ? 1700 : 1400); if (my !== run || !el.isConnected) return; }
  });
};

/* Results screen: the whole pipeline, tap any stage */
const STAGES = [
  { key: "raw", name: "Raw text", cls: "plain", smp: "<p>Ben was hungry!!</p>", q: 0,
    what: "Text as it arrives: scraped web pages, books, chats. It is full of HTML, duplicates, broken characters and spam.",
    eq: String.raw`\text{text} = c_1 c_2 \dots c_m`, eg: "<p>Ben was hungry!!</p>" },
  { key: "clean", name: "Cleaning", cls: "sage", smp: "Ben was hungry!", q: 1,
    what: "Remove the noise (HTML, boilerplate, duplicates, spam, personal information) and fix encoding errors, but keep the real language: dialects, code-switching, diacritics and African languages.",
    eq: String.raw`\mathrm{clean}(\text{text}) \rightarrow \text{text}'`, eg: "“CafÃ©” → “Café”; the duplicate line is dropped; “Sawa, let’s go” stays." },
  { key: "tok", name: "Tokenisation", cls: "blue", smp: "Ben | was | hungry | !", q: 5,
    what: "Split the text into tokens: words, characters or (usually) subwords learned with BPE, which merges the most frequent adjacent pair again and again.",
    eq: String.raw`\text{text}' \rightarrow [t_1, t_2, \dots, t_n]`, eg: "“unbelievable” → un | believ | able" },
  { key: "ids", name: "Token IDs", cls: "lav", smp: "[8412, 377, 5120, 5]", q: 3,
    what: "Look each token up in the vocabulary: a fixed table where every token has one ID. Decoding reads the same table backwards.",
    eq: String.raw`\mathrm{id}(t_i) \in \{0, 1, \dots, |V| - 1\}`, eg: "Ben → 8412, and 8412 → Ben. |V| = 32,000 rows." },
  { key: "emb", name: "Embedding lookup", cls: "peach", smp: "8412 → [0.21, −0.43, 0.88, …]", q: 7,
    what: "Each ID picks out its row of the embedding table: a learned vector of d numbers. IDs are arbitrary labels; embeddings carry meaning.",
    eq: String.raw`\begin{gathered}x_i = E[\mathrm{id}_i] = \mathrm{onehot}(\mathrm{id}_i)^{\top} E \\ E \in \mathbb{R}^{|V| \times d}\end{gathered}`, eg: "A 32,000 × 768 table: 768 numbers per token." },
  { key: "space", name: "Embedding space", cls: "pink", smp: "Nairobi ≈ Kigali", q: 9,
    what: "In the embedding space, tokens used in similar ways point in similar directions. Cosine similarity measures that, ignoring length.",
    eq: String.raw`\cos(a, b) = \frac{a \cdot b}{\lVert a \rVert\, \lVert b \rVert}`, eg: "Nairobi ↔ Kigali 0.86 · Nairobi ↔ zebra 0.08 (illustrative)" },
  { key: "model", name: "The model", cls: "dark", smp: "vectors in → next-token probabilities", q: 10,
    what: "The vectors flow into the model, which predicts the next token. Training adjusts every parameter, the embeddings included, so the vectors learn their meaning.",
    eq: String.raw`E \leftarrow E - \eta\, \frac{\partial \mathcal{L}}{\partial E}`, eg: "Inside the Transformer, attention turns each static vector into a contextual one (Course 04)." },
];
W.ls2_explorer = el => {
  const canJump = el.dataset.jump === "1";
  el.innerHTML = `<div class="explore"><div><div class="ls2-xp">${STAGES.map((s, i) => `${i ? `<span class="ls2-xar" aria-hidden="true">↓</span>` : ""}<button type="button" class="ls2-xs ${s.cls}" data-k="${s.key}"><b>${s.name}</b><span>${esc(s.smp)}</span></button>`).join("")}</div>
    <p class="xhint">From raw text (top) to the model (bottom). Tap any stage.</p></div><div class="xinfo" aria-live="polite"></div></div>`;
  const info = $(".xinfo", el);
  const pick = key => {
    const s = STAGES.find(x => x.key === key);
    $$(".ls2-xs", el).forEach(b => b.classList.toggle("on", b.dataset.k === key));
    info.innerHTML = `<div class="kick">From text to numbers</div><h3>${esc(s.name)}</h3><p>${esc(s.what)}</p>${EQ(K(s.eq, true))}<div class="eg"><b>In our example:</b> ${esc(s.eg)}</div>
      ${canJump ? `<div class="acts"><button class="btn ghost small" type="button" data-q="${s.q}">Revisit Question ${s.q + 1} →</button></div>` : ""}`;
    const b = $("[data-q]", info); if (b) b.onclick = () => el.dispatchEvent(new CustomEvent("jumpq", { bubbles: true, detail: +b.dataset.q }));
  };
  $$(".ls2-xs", el).forEach(b => b.onclick = () => pick(b.dataset.k));
  pick("tok");
};

/* ======================================================================
   QUESTIONS
   ====================================================================== */
const QUESTIONS = [
 { id: "why",
   q: "Why do we need to clean, tokenise and represent text before a language model can learn from it?",
   options: ["To make the text shorter for people to read", "Models only process numbers, so text must become tokens, IDs and vectors", "To translate all text into English", "To remove all the rare words"],
   answer: 1,
   illus: () => `<div class="ls2-flow">${flowBox("plain", "Raw text", `<code>${esc("<p>Ben was hungry!!</p>")}</code>`)}${downAr}${flowBox("qm", "", "?")}${downAr}
       ${flowBox("dark", "Language model", "<span>a mathematical function</span>")}${downAr}${flowBox("plain", "Next-token probabilities")}</div>
     <p class="ilcap">What has to happen to the text before the model can use it?</p>`,
   explain: () =>
     P(1, "Models only see numbers", `<div class="wg" data-w="ls2_pipeline"></div>
       <p>A language model is a mathematical function: numbers in, numbers out. It cannot read letters. So raw text goes through a pipeline first: <b>clean</b> it, split it into <b>tokens</b>, swap each token for its <b>ID</b>, and look up each ID’s <b>vector</b> (its embedding).</p>`) +
     P(2, "Why each step exists", `<div class="grid3">
       ${card("sage", "Clean", "Remove noise the model shouldn’t learn from: HTML, duplicates, broken characters.")}
       ${card("blue", "Tokenise", "Choose the units the model works with: words, pieces of words or characters.")}
       ${card("lav", "Token IDs", "Give every token a number from a fixed vocabulary.")}
       ${card("peach", "Embeddings", "Turn arbitrary IDs into learned vectors that carry meaning.")}</div>`) +
     P(3, "In maths", `${EQ(texd`\begin{gathered}\text{text} \;\rightarrow\; [t_1, \dots, t_n] \;\rightarrow\; [\mathrm{id}_1, \dots, \mathrm{id}_n] \\ \rightarrow\; [x_1, \dots, x_n], \quad x_i \in \mathbb{R}^{d}\end{gathered}`, "Text becomes n tokens, n IDs, then n vectors of d numbers each: the only thing the model ever sees.")}`),
   whynot: { 0: "The pipeline is for the model, not for people. Cleaning may shorten text, but the goal is numbers.", 2: "Models can learn any language. Translating everything would throw that language away.", 3: "Rare words are kept. Subword tokenizers build them from smaller pieces." },
   take: "Models only process numbers, so text must become tokens, then IDs, then vectors (embeddings) before a model can learn from it." },

 { id: "clean",
   q: "You are cleaning this scraped text dataset. Which of these should you NOT do?",
   options: ["Remove HTML tags and website boilerplate", "Remove duplicate documents", "Fix encoding errors, like “CafÃ©” instead of “Café”", "Delete the lines written in African languages or with diacritics"],
   answer: 3,
   illus: () => `${scrapedHTML(false)}<p class="ilcap">A sample of text scraped from the web.</p>`,
   explain: () =>
     P(1, "Remove the noise, keep the language", `<div class="wg" data-w="ls2_clean"></div>
       <p>A model learns whatever is in its data. Cleaning removes what isn’t real language: page menus, copies of the same text, characters broken by the wrong encoding, spam and personal details.</p>`) +
     P(2, "Why each step matters", `<div class="grid3">
       ${card("pink", "HTML and boilerplate", "Left in, the model learns to write menus and “Subscribe” buttons.")}
       ${card("pink", "Duplicates", "Text seen many times gets over-learnt, even memorised, and wastes training time.")}
       ${card("pink", "Encoding errors", "“CafÃ©” would be learnt as if it were a real word.")}
       ${card("pink", "Spam and personal info", "Low-quality text, and a privacy risk if the model repeats phone numbers.")}</div>`) +
     P(3, "What must stay", `<p>Dialects, code-switching (“Sawa, let’s go”), diacritics (é, ọ, ń) and text in African languages are <b>real language</b>. Strip the diacritics and Yoruba words that differ only in their marks collapse into one; delete the African-language lines and the model can’t serve the people who speak them.</p>
       <div class="cols">${card("sage", "Keep", "“Sawa, let’s go to the market.” · “Ọmọ náà ń jẹun.”")}${card("pink", "Remove", "&lt;div class=\"nav\"&gt; · the duplicate line · “Call 07XX… now!!!”")}</div>`),
   whynot: { 0: "This is a real cleaning step: tags and menus are noise, not language.", 1: "This is a real cleaning step: duplicates make the model over-learn some text.", 2: "This is a real cleaning step: fix the encoding so “Café” is learnt correctly." },
   take: "Cleaning removes noise (HTML, duplicates, broken encoding, spam) but keeps real language, including African languages, dialects and diacritics." },

 { id: "tokenizer",
   q: "What does a tokenizer do?",
   options: ["Translates text into English", "Counts how often each word appears", "Splits text into tokens and maps each token to an integer ID", "Predicts the next word in a sentence"],
   answer: 2,
   illus: () => `<div class="ls2-flow">${flowBox("plain", "Text", "<code>Ben was hungry.</code>")}${downAr}${flowBox("blue", "Tokenizer")}${downAr}${flowBox("qm", "What comes out?", "")}${downAr}${flowBox("dark", "Language model")}</div>`,
   explain: () =>
     P(1, "Two steps: split, then look up", `<div class="wg" data-w="ls2_tokenise"></div>
       <p>First the text is <b>split into tokens</b>: words, pieces of words or characters, depending on the tokenizer. Then each token is <b>replaced by its ID</b> from the vocabulary. This toy tokenizer works on whole words; real ones use subwords (Questions 5 and 6).</p>`) +
     P(2, "Encode and decode", `${EQ(texd`\begin{gathered}\mathrm{encode}(\text{“Ben was hungry.”}) \\ = [8412,\ 377,\ 5120,\ 13]\end{gathered}`)}${EQ(texd`\begin{gathered}\mathrm{decode}([8412,\ 377,\ 5120,\ 13]) \\ = \text{“Ben was hungry.”}\end{gathered}`, "Encoding turns text into IDs; decoding turns the model’s output IDs back into text. (IDs are illustrative.)")}`) +
     P(3, "The model never sees the words", `<p>Only the list of IDs reaches the model. Each ID then picks out that token’s embedding (Question 8).</p>`),
   whynot: { 0: "Translation is a separate task. A tokenizer works on any language and keeps it as it is.", 1: "Counting is used when a tokenizer is trained (BPE counts pairs), but tokenising text means splitting it and mapping tokens to IDs.", 3: "Predicting the next token is the model’s job. The tokenizer runs before the model." },
   take: "A tokenizer splits text into tokens, then maps each token to an integer ID from its vocabulary." },

 { id: "vocab",
   q: "What is a tokenizer’s vocabulary?",
   options: ["Every word that appears in the training data", "The number of words in a sentence", "The dictionary definitions of each word", "The fixed list of tokens the tokenizer knows, each with its own ID"],
   answer: 3,
   illus: () => `<div class="ls2-pairs">${[["Ben", "8412"], ["was", "377"], ["hungry", "5120"], ["ugali", "31999"]].map(([t, n]) => `${chip(t)}<span class="ls2-eqv">⇄</span><span class="tk k">${n}</span>`).join("")}</div>
     <p class="ilcap">The tokenizer turns each token into an ID and back again. Where do these IDs come from?</p>`,
   explain: () =>
     P(1, "A lookup table", `<div class="wg" data-w="ls2_vocab"></div>
       <p>The vocabulary is a table with <b>one row per token</b>. Encoding finds a token’s row to get its ID; decoding finds an ID’s row to get the token back.</p>`) +
     P(2, "Fixed, with special tokens", `<p>The vocabulary is built once, when the tokenizer is trained, and then <b>fixed</b>. Its size |V| is the number of rows: 32,000 in this example, about 256,000 in Gemma. Special tokens get IDs too: <b>[PAD]</b> fills out short sequences, <b>[UNK]</b> stands for anything the tokenizer doesn’t know, and others mark the start or end of a text.</p>
       ${EQ(texd`\begin{gathered}V = \{\, 0\!:\texttt{[PAD]},\ 1\!:\texttt{[UNK]},\ \dots,\ 8412\!:\text{Ben},\ \dots \,\} \\ |V| = 32{,}000\end{gathered}`)}`) +
     P(3, "Not every word gets a row", `<p>Appearing in the training data doesn’t earn a word its own row. A word-level vocabulary leaves rare words out (they become [UNK]); a subword vocabulary builds them from smaller pieces that do have rows.</p>`),
   whynot: { 0: "Not every word: the vocabulary is a limited list chosen when the tokenizer is trained, and it can contain pieces of words.", 1: "That’s the length of a sentence in tokens, not the vocabulary.", 2: "A vocabulary has no definitions. Meaning comes later, from the embeddings." },
   take: "The vocabulary is a fixed lookup table: every token has one ID, and every ID maps back to one token." },

 { id: "charword",
   q: "Compared with word-level tokenisation, character-level tokenisation…",
   options: ["has a tiny vocabulary, but produces much longer sequences", "has a huge vocabulary, but produces shorter sequences", "cannot handle words it has never seen", "removes the need for embeddings"],
   answer: 0,
   illus: () => `<div class="ls2-two"><div><span class="ls2-k">Word-level</span><div class="toks">${chip("unbelievable", "v")}</div></div>
       <div><span class="ls2-k">Character-level</span><div class="toks">${[..."unbelievable"].map(c => chip(c, "k")).join("")}</div></div></div>
     <p class="ilcap">The same word, split two ways.</p>`,
   explain: () =>
     P(1, "Same text, three ways to split", `<div class="wg" data-w="ls2_split3"></div>
       <p>Pick an example and a tokenizer. Characters can spell anything, so nothing is ever unknown, but every word turns into many tokens.</p>`) +
     P(2, "The trade-off", `<div class="scrollx"><table class="cmp ls2-cmp"><thead><tr><th></th><th>Word-level</th><th>Character-level</th><th>Subword (BPE)</th></tr></thead><tbody>
       <tr><th>Vocabulary</th><td>Huge (100,000+)</td><td><b>Tiny</b> (about 100)</td><td>Medium (30,000 to 250,000)</td></tr>
       <tr><th>Sequence length</th><td>Short</td><td><b>Very long</b></td><td>In between</td></tr>
       <tr><th>Unseen words</th><td>Become [UNK]</td><td>Never a problem</td><td>Built from known pieces</td></tr>
       <tr><th>Meaning per token</th><td>High</td><td>Low</td><td>Medium</td></tr></tbody></table></div>`) +
     P(3, "Why long sequences hurt", `<p>The model does work for every token, and attention compares every token with every other one (Course 04). One word as 12 tokens instead of 1 means far more computation for the same text:</p>
       ${EQ(texd`\begin{gathered}\text{word: } n = 1 \;\Rightarrow\; n^2 = 1 \\ \text{character: } n = 12 \;\Rightarrow\; n^2 = 144\end{gathered}`, "Attention scores for “unbelievable”: word-level versus character-level.")}`),
   whynot: { 1: "That describes word-level tokenisation.", 2: "The opposite: with every character in its vocabulary, it can spell any word.", 3: "Every token, a character too, still needs an embedding." },
   take: "Character-level: tiny vocabulary, very long sequences. Word-level: huge vocabulary, short sequences. Subword tokenizers sit in between." },

 { id: "bpe",
   q: "How does Byte-Pair Encoding (BPE) build its subword vocabulary?",
   options: ["By keeping only the most frequent whole words", "By repeatedly merging the most frequent pair of adjacent symbols", "By splitting every word into single characters", "By grouping words with similar meanings"],
   answer: 1,
   illus: () => `<div class="ls2-bwords ls2-static">${BPE_CORPUS.map(([w, n]) => `<div class="ls2-brow"><span class="toks">${[...w].map(c => chip(c)).join("")}<span class="tk ls2-eow">&lt;/w&gt;</span></span><span class="ls2-times">× ${n}</span></div>`).join("")}</div>
     <p class="ilcap">BPE’s training data, split into letters (&lt;/w&gt; marks the end of a word). How does it get from here to a vocabulary of subwords?</p>`,
   explain: () =>
     P(1, "Count pairs, merge the top one, repeat", `<div class="wg" data-w="ls2_bpe"></div>
       <p>BPE starts from single letters. It counts every side-by-side pair across the data, weighted by how often each word appears: <code class="ls2-mono">l o</code> and <code class="ls2-mono">o w</code> both appear 5 + 2 + 4 = 11 times. The top pair is <b>merged into a new token</b>, the counts are redone, and it repeats. Step through it.</p>`) +
     P(2, "In maths", `${EQ(texd`\begin{gathered}(a^{*}, b^{*}) = \arg\max_{(a,\,b)} \ \mathrm{count}(a\,b) \\ \text{then replace every } a^{*}\,b^{*} \text{ with } a^{*}b^{*}\end{gathered}`, "Repeat until the vocabulary reaches its target size, for example 32,000 tokens. The list of merges is the tokenizer.")}`) +
     P(3, "Why it works", `<div class="grid3">
       ${card("pink", "Whole words only", "Rare or new words become [UNK].")}
       ${card("pink", "Single letters only", "Sequences get long and each token means little.")}
       ${card("sage", "BPE: the balance", "Common words stay whole (“low”); rarer ones are built from pieces (“low” + “est”).")}</div>
       <p>Variants of BPE power the tokenizers of the GPT and Llama model families.</p>`),
   whynot: { 0: "Keeping whole words only is a word-level vocabulary, which fails on rare and new words.", 2: "Splitting into characters is only where BPE starts, before any merges.", 3: "BPE only counts symbol pairs. It knows nothing about meaning." },
   take: "BPE starts from characters and repeatedly merges the most frequent adjacent pair, so common words become single tokens and rare words are built from pieces." },

 { id: "tax",
   q: "With the same tokenizer, “Habari za asubuhi, hujambo?” needs 11 tokens, but its English translation “Good morning, how are you?” needs only 7. What is the best way to reduce this “tokenizer tax”?",
   options: ["Use a bigger model", "Translate everything into English first", "Train or extend the tokenizer with more text in that language", "Increase the sampling temperature"],
   answer: 2,
   illus: () => `<div class="ls2-two"><div><span class="ls2-k">English · ${taxCount(TAX[0])} tokens</span>${taxRow(TAX[0])}</div><div><span class="ls2-k">Kiswahili · ${taxCount(TAX[1])} tokens</span>${taxRow(TAX[1])}</div></div>
     <p class="ilcap">Same tokenizer, same greeting. (Token splits are illustrative.)</p>`,
   explain: () =>
     P(1, "Where the tax comes from", `<div class="wg" data-w="ls2_tax"></div>
       <p>A tokenizer learns its merges from its training data. If that data was mostly English, English words get their own tokens while Kiswahili words are chopped into small pieces.</p>`) +
     P(2, "What it costs", `<div class="grid3">
       ${card("peach", "Costs more", "APIs charge per token.")}
       ${card("peach", "Less fits", "Context windows are counted in tokens.")}
       ${card("peach", "Slower", "The model generates one token per step.")}
       ${card("peach", "Often worse", "Small pieces carry less meaning.")}</div>
       ${EQ(texd`\begin{gathered}\frac{11}{7} \approx 1.6\times \ \text{the tokens} \\ \Rightarrow\ \approx 1.6\times \ \text{the cost, and only} \approx 60\% \ \text{as much text per context window}\end{gathered}`)}`) +
     P(3, "The fix", `<p>Train the tokenizer on enough text in the language, or <b>extend</b> it with new merges for it. Common Kiswahili words like “habari”, “asubuhi” and “hujambo” then become single tokens. New tokens also need new rows in the embedding table, which the model learns during further training.</p>`),
   whynot: { 0: "A bigger model still receives the same 11 pieces. The split happens before the model.", 1: "Translating loses the language, adds errors, and users write in Kiswahili anyway.", 3: "Temperature changes how the next token is sampled, not how text is split into tokens." },
   take: "The tokenizer tax comes from the tokenizer’s training data: train or extend it with enough text in a language so its words get their own tokens." },

 { id: "embeddings",
   q: "Why do language models use embeddings instead of feeding in raw token IDs?",
   options: ["Token IDs take up too much memory", "Embeddings compress text into fewer tokens", "Embeddings tell the model the position of each token", "Token IDs are arbitrary numbers, while embeddings are learned vectors that capture meaning"],
   answer: 3,
   illus: () => `${IDSVG("a", null, true)}<p class="ilcap">If the model used these numbers directly, which two words would look most alike?</p>`,
   explain: () =>
     P(1, "IDs are just labels", `<div class="wg" data-w="ls2_ids"></div>
       <p>IDs are given out in no meaningful order: “cat” might be 312, “car” 313 and “dog” 8921. Fed in as numbers, they would tell the model that cat and car are nearly the same thing. An embedding replaces each ID with a <b>learned vector</b>, so similar tokens can get similar vectors.</p>`) +
     P(2, "The embedding table", `${EQ(texd`\begin{gathered}E \in \mathbb{R}^{|V| \times d} \\ x_i = E[\mathrm{id}_i] = \mathrm{onehot}(\mathrm{id}_i)^{\top} E\end{gathered}`, "One row per token: ID 312 → row 312 → cat’s vector. For example 32,000 × 768: 768 numbers per token.")}
       <div class="cols">${card("plain", "One-hot vector", `<span class="vec">${[0, 0, 1, 0, 0, 0].map(v => `<span style="background:rgba(142,124,195,${v ? 0.8 : 0.1})">${v}</span>`).join("")}</span><br>|V| numbers, all 0 except one 1. Every pair of words is equally different: their cosine similarity is always 0.`)}
         ${card("peach", "Embedding", `${vec([0.81, 0.12, -0.4, 0.33], "q")}<br>d numbers (say 768), dense and learned. Similar tokens get similar vectors.`)}</div>`) +
     P(3, "Similar meanings sit close together", `<div class="wg" data-w="ls2_space"></div>
       <p>Places cluster with places, food with food. The model uses these positions: a token near “ugali” and “lunch” is probably a food. Real embeddings have hundreds of dimensions; this 2D map is a simplified picture.</p>`),
   whynot: { 0: "One integer per token is tiny. Embeddings use more memory, not less.", 1: "Embeddings don’t change the number of tokens: one vector per token.", 2: "Position comes from positional encodings, added separately (Course 04)." },
   take: "Token IDs are arbitrary labels; embeddings are learned vectors in which tokens with similar meanings sit close together." },

 { id: "orange",
   q: "“She drank orange juice.” “She wore an orange dress.” Which vector does a basic embedding table give “orange” in these two sentences?",
   options: ["The same vector in both, because the table has one row per token", "A fruit vector in the first and a colour vector in the second", "No vector, because “orange” has two meanings", "A new random vector each time"],
   answer: 0,
   illus: () => `<div class="ls2-sents"><div>She drank <span class="tk q">orange</span> juice.</div><div>She wore an <span class="tk q">orange</span> dress.</div></div>
     <div class="ls2-flow" style="margin-top:12px">${downAr}${flowBox("peach", "Embedding table", `<span>look up the row for “orange”</span>`)}${downAr}${flowBox("qm", "", "?")}</div>`,
   explain: () =>
     P(1, "One row per token: a static vector", `<div class="wg" data-w="ls2_orange"></div>
       <p>The embedding table has exactly one row for “orange”. The lookup can’t see the sentence, so it returns the <b>same vector</b> every time: a <b>static</b> embedding that sits between colours and fruits, mixing both meanings.</p>`) +
     P(2, "Context fixes it later", `<p>Inside the Transformer, attention mixes in the surrounding words, giving each token a <b>contextual</b> vector. With “drank” and “juice” nearby, “orange” moves towards the fruits; with “wore” and “dress”, towards the colours. You will see how in Course 04.</p>
       ${EQ(texd`\begin{gathered}\text{static: } x_{\text{orange}} = E[\mathrm{id}_{\text{orange}}] \\ \text{contextual: } h_{\text{orange}} = f\big(x_{\text{orange}},\ \text{the other tokens}\big)\end{gathered}`)}`),
   whynot: { 1: "That’s what contextual vectors do, later, inside the Transformer. The table lookup can’t see the sentence.", 2: "Every token in the vocabulary has a vector. Ambiguity is resolved later, by context.", 3: "After training the table is fixed: the same ID always returns the same row." },
   take: "An embedding table gives each token one static vector; attention in the Transformer later turns it into a contextual vector that fits the sentence." },

 { id: "cosine",
   q: "Two embeddings point in exactly the same direction, but one is twice as long. What is their cosine similarity?",
   options: ["0", "1", "−1", "It depends on their lengths"],
   answer: 1,
   illus: () => `${COSQ()}<p class="ilcap">Vector <b>a</b> and vector <b>2a</b>: same direction, twice the length.</p>`,
   explain: () =>
     P(1, "Cosine similarity measures the angle", `<div class="wg" data-w="ls2_cosine"></div>
       <p>Drag the vectors. Cosine similarity only cares about the <b>angle</b> between them: same direction gives 1, right angles 0, opposite directions −1. Stretch either vector and it doesn’t change.</p>`) +
     P(2, "The formula", `${EQ(texd`\cos\theta = \frac{a \cdot b}{\lVert a \rVert\, \lVert b \rVert}`, "The dot product, divided by both lengths: the lengths cancel out and only the direction is left.")}
       ${EQ(texd`\begin{gathered}b = 2a: \\ \cos\theta = \frac{a \cdot 2a}{\lVert a \rVert \cdot 2\lVert a \rVert} = \frac{2\lVert a \rVert^{2}}{2\lVert a \rVert^{2}} = 1\end{gathered}`)}`) +
     P(3, "Comparing embeddings", `<div style="max-width:560px;--lw:150px">${bars([["Nairobi ↔ Kigali", "0.86", 86, "pick"], ["jollof ↔ ugali", "0.79", 79, "pick"], ["Nairobi ↔ zebra", "0.08", 8]])}</div>
       <p class="cap" style="margin-top:6px">Close to 1 means similar meaning. (Values are illustrative.)</p>
       <p>That’s why cosine similarity is the standard way to compare embeddings: a common word and a rare word can have very different lengths but still mean similar things.</p>`),
   whynot: { 0: "0 means the vectors are at right angles.", 2: "−1 means they point in opposite directions.", 3: "Cosine divides by both lengths, so length cancels out." },
   take: "Cosine similarity depends only on direction: 1 for the same direction, 0 at right angles, −1 for opposite, whatever the lengths." },

 { id: "learned",
   q: "How do embedding values get their meaning?",
   options: ["They start random and are adjusted during training to help predict the next token", "Linguists set them by hand", "They are copied from a dictionary", "They follow the order of the token IDs"],
   answer: 0,
   illus: () => `<svg viewBox="0 18 340 200" role="img" aria-label="Embeddings scattered at random" ${FONT}>${START_WORDS.map((w, i) => `<circle cx="${START_POS[i][0]}" cy="${START_POS[i][1]}" r="5.5" fill="#8A84A0"/><text x="${START_POS[i][0] + 8}" y="${START_POS[i][1] + 4}" font-size="12.5" font-weight="700" fill="#1B1530">${w}</text>`).join("")}</svg>
     <p class="ilcap">The embedding table on day one of training. How do these vectors end up meaning something?</p>`,
   explain: () =>
     P(1, "From random to meaningful", `<div class="wg" data-w="ls2_train"></div>
       <p>The embedding table is part of the model’s parameters. At the start every vector is random, so positions mean nothing. Training moves them until similar tokens end up close together.</p>`) +
     P(2, "Each training step", `<div class="grid3">${card("blue", "1 · Predict", "Predict the next token for a batch of text.")}${card("peach", "2 · Measure", "Measure the loss: how wrong was it?")}${card("sage", "3 · Adjust", "Nudge every parameter, embeddings included, to reduce the loss. Repeat.")}</div>
       ${EQ(texd`E \leftarrow E - \eta\, \frac{\partial \mathcal{L}}{\partial E}`, "Gradient descent: η is the learning rate. The embedding rows are updated like any other weights.")}`) +
     P(3, "Why similar words end up close", `<p>“jollof”, “ugali” and “injera” all appear after words like “I ate some…”. Giving them similar vectors helps the model predict similar next tokens, so training pushes them together. As the linguist J. R. Firth put it: <i>you shall know a word by the company it keeps</i>.</p>`),
   whynot: { 1: "Nobody could set 768 numbers for each of 32,000 tokens by hand. They are learned.", 2: "Dictionaries hold definitions, not vectors.", 3: "IDs are arbitrary labels: their order means nothing." },
   take: "Embeddings start random and are learned: training nudges them to predict the next token better, so tokens used in similar contexts end up close together." },
];

SESSIONS.push({
  id: "live-session-2",
  order: 2,
  label: "Live Session 2 of 4",
  course: "Course 02",
  title: "Represent Your Language Data",
  held: "Held live on Wednesday 28 October 2026",
  cover: "/img/live-session-2.jpg",
  courseUrl: "https://www.skills.google/paths/3135",
  explore: "ls2_explorer",
  exploreTitle: "Explore the pipeline: from text to numbers",
  questions: QUESTIONS,
});
})();
