/* Live Session 1 quiz: Build Your Own Small Language Model (Course 01).
   Running example from the deck: "Ben was hungry so he went looking for ___", plus the jollof counts.
   Numbers are illustrative unless stated. Everything is wrapped so nothing leaks into the other sessions. */
"use strict";
(() => {

const Z = ["Ben", "was", "hungry", "so", "he", "went", "looking", "for"];
const DIST = [["food", 0.34], ["snacks", 0.27], ["cookies", 0.22], ["water", 0.10]];          // + 0.07 for every other token
const DCOL = ["#6AA84F", "#8E7CC3", "#3C78D8", "#E69138", "#C9C3D6"];
const zchips = (cls = () => "") => Z.map((t, i) => chip(t, cls(i))).join("");
const ln = Math.log;

/* ======================================================================
   Widgets
   ====================================================================== */

/* Q1: a probability for every possible next token, and they add up to 1 */
W.ls1_dist = el => {
  const rows = DIST.concat([["every other token", 0.07]]);
  el.innerHTML = `<p class="cap" style="margin:0 0 10px">Context: <b>“Ben was hungry so he went looking for”</b></p>
    <div class="ls1-b" style="--lw:136px"></div>
    <div class="ls1-stack" aria-hidden="true">${rows.map((r, i) => `<i style="background:${DCOL[i]}" title="${r[0]}"></i>`).join("")}</div>
    <div class="ls1-stacklab"><span>0</span><span class="ls1-sum">add them all up…</span><span>1</span></div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const b = $(".ls1-b", el), segs = $$(".ls1-stack i", el), sum = $(".ls1-sum", el), cap = $(".wg-foot .cap", el);
  let run = 0;
  const draw = start => { b.innerHTML = bars(rows.map(([t, p], i) => [t, f2(p), p * 100 / 0.4, i === 0 ? "pick" : ""]), { start }); $$(".bar i", b).forEach((x, i) => x.style.background = DCOL[i]); if (start) grow(b); };
  replayable(el, async still => {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (still) { draw(false); segs.forEach((s, i) => s.style.width = rows[i][1] * 100 + "%"); sum.textContent = "all together: 1.00"; cap.innerHTML = "Every token gets a probability between 0 and 1, and together they add up to 1."; return; }
    segs.forEach(s => s.style.width = "0"); sum.textContent = "add them all up…";
    cap.innerHTML = "<b>1.</b> The model gives every possible next token a probability"; draw(true);
    await sleep(1800); if (!ok()) return;
    cap.innerHTML = "<b>2.</b> Stack them end to end…";
    let tot = 0;
    for (let i = 0; i < rows.length; i++) { segs[i].style.width = rows[i][1] * 100 + "%"; tot += rows[i][1]; sum.textContent = "running total: " + f2(tot); await sleep(650); if (!ok()) return; }
    sum.textContent = "all together: 1.00";
    cap.innerHTML = "<b>3.</b> …and they fill exactly 1. That is a probability distribution.";
  });
};

/* Q2: order matters, P(· | jollof) vs P(· | rice) */
W.ls1_given = el => {
  const sets = [
    { k: "jollof", rows: [["rice", 0.60], ["chicken", 0.30], ["stew", 0.10]], hi: "rice", c: "After <b>“jollof”</b>, “rice” is very likely: <b>P(rice | jollof) = 0.60</b>." },
    { k: "rice", rows: [["and", 0.32], ["is", 0.18], ["with", 0.12], ["jollof", 0.01]], hi: "jollof", c: "After <b>“rice”</b>, “jollof” is rare: <b>P(jollof | rice) = 0.01</b>. A different question, a different answer." },
  ];
  el.innerHTML = `<div class="tabs">${sets.map((s, i) => `<button type="button" data-i="${i}">P( next | ${s.k} )</button>`).join("")}</div>
    <div class="ls1-b" style="--lw:84px"></div><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const b = $(".ls1-b", el), cap = $(".wg-foot .cap", el);
  const show = (k, start) => {
    const s = sets[k];
    $$(".tabs button", el).forEach((x, i) => x.classList.toggle("on", i === k));
    b.innerHTML = `<p class="cap" style="margin:0 0 6px">The word before is <b>“${s.k}”</b>. What comes next?</p>` + bars(s.rows.map(([t, p]) => [t, f2(p), p * 100 / 0.7, t === s.hi ? "pick" : ""]), { start: true });
    grow(b); cap.innerHTML = s.c;
  };
  let run = 0;
  $$(".tabs button", el).forEach(x => x.onclick = () => { run++; show(+x.dataset.i); });
  replayable(el, async still => {
    const my = ++run; if (still) { show(0); return; }
    show(0); await sleep(3200); if (my !== run || !el.isConnected) return; show(1);
  });
};

/* Q3: every time "jollof" appears is one cell; colour it by the word that follows */
W.ls1_waffle = el => {
  const kinds = [["rice", 60, "#6AA84F"], ["chicken", 30, "#3C78D8"], ["stew", 10, "#E69138"]];
  let cells = "", i = 0;
  kinds.forEach(([w, n, c], k) => { for (let j = 0; j < n; j++, i++) cells += `<span data-k="${k}" style="background:${c};--d:${i * 14}ms"></span>`; });
  el.innerHTML = `<p class="cap" style="margin:0 0 10px;text-align:center">Each square is one time <b>“jollof”</b> appears in the dataset, coloured by the word that follows it.</p>
    <div class="ls1-waffle">${cells}</div>
    <div class="tabs ls1-wtabs" style="margin-top:14px">${kinds.map(([w, n], k) => `<button type="button" data-k="${k}">jollof ${w} · ${n}</button>`).join("")}</div>
    <div class="ls1-frac"></div>
    <div class="wg-foot"><span class="cap">Tap a word to work out its probability.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const g = $(".ls1-waffle", el), frac = $(".ls1-frac", el);
  const sel = k => {
    const [w, n] = kinds[k];
    g.classList.add("sel"); $$("span", g).forEach(s => s.classList.toggle("on", +s.dataset.k === k));
    $$(".ls1-wtabs button", el).forEach(b => b.classList.toggle("on", +b.dataset.k === k));
    frac.innerHTML = EQ(K(String.raw`P(\text{${w}} \mid \text{jollof}) = \frac{\mathrm{Count}(\text{jollof ${w}})}{\mathrm{Count}(\text{jollof})} = \frac{${n}}{100} = ${(n / 100).toFixed(2)}`, true));
  };
  $$(".ls1-wtabs button", el).forEach(b => b.onclick = () => sel(+b.dataset.k));
  replayable(el, still => {
    g.classList.remove("play", "sel"); frac.innerHTML = "";
    $$(".ls1-wtabs button", el).forEach(b => b.classList.remove("on"));
    if (still) { sel(0); return; }
    void g.offsetWidth; g.classList.add("play");
    setTimeout(() => { if (el.isConnected && !g.classList.contains("sel")) sel(0); }, 100 * 14 + 600);
  });
};

/* Q4: greedy versus sampling, with a spinning wheel */
W.ls1_spinner = el => {
  const rows = DIST.concat([["other", 0.07]]);
  const R = 92, C = 110;
  let a = 0, paths = "", labels = "";
  rows.forEach(([t, p], i) => {
    const a0 = a, a1 = a + p * 360; a = a1;
    const pt = d => { const r = (d - 90) * Math.PI / 180; return [C + R * Math.cos(r), C + R * Math.sin(r)]; };
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1), mid = (a0 + a1) / 2, mr = (mid - 90) * Math.PI / 180;
    paths += `<path d="M${C} ${C} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${p > 0.5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${DCOL[i]}" stroke="#fff" stroke-width="2"/>`;
    if (p >= 0.09) labels += `<text x="${(C + R * 0.62 * Math.cos(mr)).toFixed(1)}" y="${(C + R * 0.62 * Math.sin(mr) + 4).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff">${t}</text>`;
  });
  const centres = []; a = 0; rows.forEach(([, p]) => { centres.push(a + p * 180); a += p * 360; });
  el.innerHTML = `<div class="ls1-spin">
    <div class="ls1-wheelbox"><svg viewBox="0 0 220 230" role="img" aria-label="A wheel with one slice per token, sized by its probability" ${FONT}>
      <g class="ls1-wheel" style="transform-origin:${C}px ${C}px;transform-box:view-box">${paths}${labels}</g>
      <circle cx="${C}" cy="${C}" r="9" fill="#fff" stroke="#1B1530" stroke-width="2"/>
      <path d="M${C} 26 L${C - 9} 6 L${C + 9} 6 Z" fill="#1B1530"/></svg>
      <button class="btn small" type="button" data-a="go">Generate another run ↻</button></div>
    <div class="ls1-runs"><div><b class="ls1-rh">Always the top token</b><div class="ls1-col" data-c="g"></div></div>
      <div><b class="ls1-rh">Sample from the probabilities</b><div class="ls1-col" data-c="s"></div></div></div></div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const wheel = $(".ls1-wheel", el), colG = $('[data-c="g"]', el), colS = $('[data-c="s"]', el), cap = $(".wg-foot .cap", el);
  let rot = 0, n = 0, run = 0, busy = false;
  const draw = () => { const r = Math.random(); let c = 0; for (let i = 0; i < rows.length; i++) { c += rows[i][1]; if (r < c) return i; } return 0; };
  const line = (t, same) => `<div class="ls1-run ${same ? "" : "diff"}">Run ${n}: …looking for <b>${esc(t)}</b>.</div>`;
  const spinTo = i => { rot += 360 * 3 + ((360 - centres[i] - (rot % 360)) % 360 + 360) % 360; wheel.style.transition = "transform 1.6s cubic-bezier(.15,.75,.2,1)"; wheel.style.transform = `rotate(${rot}deg)`; };
  async function one(forced) {
    if (busy) return; busy = true; n++;
    colG.insertAdjacentHTML("beforeend", line("food", true));
    const i = forced != null ? forced : draw();
    spinTo(i); cap.innerHTML = "Spinning: bigger slices are more likely to land under the pointer…";
    await sleep(1700);
    if (el.isConnected) { colS.insertAdjacentHTML("beforeend", line(rows[i][0] === "other" ? "a friend" : rows[i][0], rows[i][0] === "food")); cap.innerHTML = "Greedy gives the same text every time. Sampling varies, but follows the probabilities."; }
    busy = false;
  }
  $('[data-a="go"]', el).onclick = () => { if (n >= 6) { colG.innerHTML = colS.innerHTML = ""; n = 0; } one(); };
  replayable(el, async still => {
    const my = ++run; colG.innerHTML = colS.innerHTML = ""; n = 0;
    if (still) { ["food", "snacks", "water"].forEach((t, k) => { n = k + 1; colG.insertAdjacentHTML("beforeend", line("food", true)); colS.insertAdjacentHTML("beforeend", line(t, t === "food")); }); cap.innerHTML = "Greedy gives the same text every time. Sampling varies, but follows the probabilities."; return; }
    for (const f of [0, 1, 3]) { if (my !== run || !el.isConnected) return; await one(f); await sleep(600); }
  });
};

/* Q4: temperature reshapes the probabilities before sampling */
W.ls1_temp = el => {
  const base = DIST.map(r => r[1]), z = base.map(p => ln(p));
  el.innerHTML = `<label class="slider"><span>Temperature T</span><input type="range" min="0.2" max="2.5" step="0.05" value="1"><output>T = 1.00</output></label><div class="ls1-b" style="--lw:84px"></div><p class="cap ls1-tc" style="margin:8px 0 0"></p>`;
  const inp = $("input", el), out = $("output", el), b = $(".ls1-b", el), cap = $(".ls1-tc", el);
  const draw = () => {
    const T = +inp.value, p = softmax(z, T);
    out.textContent = "T = " + T.toFixed(2);
    b.innerHTML = bars(p.map((v, i) => [DIST[i][0], f2(v), v * 100, i === 0 ? "pick" : ""]));
    cap.innerHTML = T < 0.85 ? "<b>Low T:</b> sharper. Almost always “food”: safe but repetitive." : T > 1.25 ? "<b>High T:</b> flatter. Rarer words get a real chance: creative, but riskier." : "<b>T = 1:</b> the model’s own probabilities (the top four tokens, rescaled to add up to 1).";
  };
  inp.oninput = draw; draw();
};

/* Q5: slide a window of n words and collect every n-gram */
W.ls1_ngrams = el => {
  const names = ["Unigrams (n = 1)", "Bigrams (n = 2)", "Trigrams (n = 3)"];
  el.innerHTML = `<div class="tabs">${names.map((t, i) => `<button type="button" data-n="${i + 1}">${t}</button>`).join("")}</div>
    <div class="toks ls1-s">${zchips()}</div><div class="ls1-list"></div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const cs = $$(".ls1-s .tk", el), list = $(".ls1-list", el), cap = $(".wg-foot .cap", el);
  let run = 0, cur = 2;
  async function play(n, still) {
    const my = ++run; cur = n;
    $$(".tabs button", el).forEach(b => b.classList.toggle("on", +b.dataset.n === n));
    list.innerHTML = ""; const total = Z.length - n + 1;
    for (let s = 0; s < total; s++) {
      if (!still) { cs.forEach((c, i) => c.className = "tk" + (i >= s && i < s + n ? " win" : "")); }
      const g = Z.slice(s, s + n).join(" ");
      list.insertAdjacentHTML("beforeend", `<span class="tk ${g === "hungry so" ? "new" : ""} ${still ? "" : "ls1-pop"}">${g}</span>`);
      cap.innerHTML = `${names[n - 1]}: <b>${s + 1}</b> of ${total}`;
      if (!still) { await sleep(520); if (my !== run || !el.isConnected) return; }
    }
    cs.forEach(c => c.className = "tk");
    cap.innerHTML = `<b>${total} ${names[n - 1].split(" ")[0].toLowerCase()}</b> from 8 words.` + (n === 2 ? " “hungry so” is one of them." : "");
  }
  $$(".tabs button", el).forEach(b => b.onclick = () => play(+b.dataset.n, !MOTION));
  replayable(el, still => play(cur, still));
};

/* Q6: how far back can an n-gram model see? */
W.ls1_window = el => {
  const toks = Z.concat("?");
  el.innerHTML = `<div class="tabs">${[2, 3, 4, 5].map(n => `<button type="button" data-n="${n}">${["", "", "Bigram", "Trigram", "4-gram", "5-gram"][n]} (n = ${n})</button>`).join("")}</div>
    <div class="toks ls1-s">${toks.map(t => chip(t, t === "?" ? "blank" : "")).join("")}</div>
    <div class="ls1-wineq"></div><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const cs = $$(".ls1-s .tk", el), eq = $(".ls1-wineq", el), cap = $(".wg-foot .cap", el);
  const show = n => {
    $$(".tabs button", el).forEach(b => b.classList.toggle("on", +b.dataset.n === n));
    const k = n - 1, start = 8 - k;
    cs.forEach((c, i) => c.className = "tk" + (i === 8 ? " blank tgt" : i >= start ? " win" : " fade"));
    const ctx = Z.slice(start).join(" ");
    eq.innerHTML = EQ(K(String.raw`P(\,?\, \mid \text{${ctx}})`, true));
    cap.innerHTML = `n = ${n}: the model sees the last <b>${k} word${k > 1 ? "s" : ""}</b>. ${n} words in all: ${k} of context + 1 to predict.`;
  };
  let run = 0;
  $$(".tabs button", el).forEach(b => b.onclick = () => { run++; show(+b.dataset.n); });
  replayable(el, async still => {
    const my = ++run; if (still) { show(3); return; }
    for (const n of [2, 3, 4, 5, 3]) { show(n); await sleep(1500); if (my !== run || !el.isConnected) return; }
  });
};

/* Q7: the trigram window slides along the sentence */
W.ls1_slide = el => {
  const toks = Z.concat("?");
  el.innerHTML = `<div class="toks ls1-s">${toks.map(t => chip(t, t === "?" ? "blank" : "")).join("")}</div><div class="ls1-wineq"></div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const cs = $$(".ls1-s .tk", el), eq = $(".ls1-wineq", el), cap = $(".wg-foot .cap", el);
  const mark = (t, fin) => {
    cs.forEach((c, i) => { c.className = "tk" + (toks[i] === "?" ? " blank" : ""); if (i === t - 2 || i === t - 1) c.classList.add("win"); else if (i === t) c.classList.add("tgt"); else if (i < t - 2) c.classList.add(fin && i === 2 ? "clue" : "fade"); else c.classList.add("ghost"); });
    eq.innerHTML = EQ(K(String.raw`P(\text{${toks[t] === "?" ? "?" : toks[t]}} \mid \text{${toks[t - 2]} ${toks[t - 1]}})`, true));
  };
  let run = 0;
  replayable(el, async still => {
    const my = ++run;
    if (!still) for (let t = 2; t < 8; t++) { mark(t); cap.innerHTML = `Predicting “${toks[t]}” from only “${toks[t - 2]} ${toks[t - 1]}”`; await sleep(950); if (my !== run || !el.isConnected) return; }
    mark(8, true); cap.innerHTML = `At the blank, the window holds <b>“looking for”</b>. Everything before it, including <b style="color:#B3261E">“hungry”</b>, is ignored.`;
  });
};

/* Q8: what the trigram sees versus what the full context says */
W.ls1_compare = el => {
  const tri = [["keys", 0.24], ["work", 0.22], ["food", 0.20]], full = [["food", 0.64], ["snacks", 0.20], ["keys", 0.02]];
  el.innerHTML = `<div class="toks ls1-s" style="justify-content:center">${zchips(i => i === 2 ? "clue" : i >= 6 ? "win" : "fade")}${chip("?", "blank")}</div>
    <div class="cols" style="margin-top:14px">
      <div class="pc peach"><b class="h">Trigram: sees “looking for”</b><div class="ls1-b ls1-b1" style="--lw:56px"></div><p class="cap" style="margin:6px 0 0">Keys, work, food: all look plausible.</p></div>
      <div class="pc sage"><b class="h">With the full context</b><div class="ls1-b ls1-b2" style="--lw:56px"></div><p class="cap" style="margin:6px 0 0">“hungry” makes food the clear favourite.</p></div></div>
    <div class="wg-foot"><span class="cap">Probabilities are illustrative.</span><button class="replay" type="button">↻ Replay</button></div>`;
  const b1 = $(".ls1-b1", el), b2 = $(".ls1-b2", el);
  let run = 0;
  replayable(el, async still => {
    const my = ++run;
    b1.innerHTML = bars(tri.map(([t, p]) => [t, f2(p), p * 100 / 0.7, t === "food" ? "pick" : ""]), { start: !still }); if (!still) grow(b1);
    b2.innerHTML = still ? bars(full.map(([t, p]) => [t, f2(p), p * 100 / 0.7, t === "food" ? "pick" : ""])) : "";
    if (still) return;
    await sleep(1600); if (my !== run || !el.isConnected) return;
    b2.innerHTML = bars(full.map(([t, p]) => [t, f2(p), p * 100 / 0.7, t === "food" ? "pick" : ""]), { start: true }); grow(b2);
  });
};

/* Q9: look the context up in the count table; an unseen context has nothing to find */
W.ls1_lookup = el => {
  const table = [["Ben went", "looking (1)"], ["Sam went", "looking (1)"], ["Alex went", "looking (1)"], ["went looking", "for (3)"], ["looking for", "food (1) · water (1) · work (1)"]];
  el.innerHTML = `<div class="ls1-tab" role="table"><div class="ls1-tr ls1-th"><span>Context (2 words)</span><span>Words seen next (count)</span></div>
      ${table.map(([c, n]) => `<div class="ls1-tr"><span><b>${c}</b></span><span>${n}</span></div>`).join("")}</div>
    <div class="ls1-q"></div><div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const rowsEl = $$(".ls1-tr:not(.ls1-th)", el), q = $(".ls1-q", el), cap = $(".wg-foot .cap", el);
  let run = 0;
  const clear = () => rowsEl.forEach(r => r.className = "ls1-tr");
  const found = () => { clear(); rowsEl[4].classList.add("hit"); q.innerHTML = `<div class="pc sage"><b class="h">“Ben went looking for ___”: context found</b>${K(String.raw`\begin{gathered} P(\text{food} \mid \text{looking for}) \\ = \frac{\mathrm{Count}(\text{looking for food})}{\mathrm{Count}(\text{looking for})} = \frac{1}{3} \end{gathered}`, true)}</div>`; };
  const missing = () => { rowsEl.forEach(r => r.className = "ls1-tr miss"); q.innerHTML = `<div class="pc pink"><b class="h">“Ben went searching for ___”: no such context</b>${K(String.raw`\begin{gathered} P(\text{food} \mid \text{searching for}) \\ = \frac{\mathrm{Count}(\text{searching for food})}{\mathrm{Count}(\text{searching for})} = \frac{0}{0} \end{gathered}`, true)}<span class="cap">0 ÷ 0 is undefined: no prediction, so generation stops.</span></div>`; };
  replayable(el, async still => {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (still) { missing(); cap.innerHTML = "The model has never seen “searching for”, so it has no counts to divide."; return; }
    clear(); q.innerHTML = ""; cap.innerHTML = "Looking up <b>“looking for”</b>…";
    for (let i = 0; i < 5; i++) { clear(); rowsEl[i].classList.add("scan"); await sleep(380); if (!ok()) return; }
    found(); cap.innerHTML = "Found it: divide the counts.";
    await sleep(2600); if (!ok()) return;
    q.innerHTML = ""; cap.innerHTML = "Now looking up <b>“searching for”</b>…";
    for (let i = 0; i < 5; i++) { clear(); rowsEl[i].classList.add("scan"); await sleep(380); if (!ok()) return; }
    missing(); cap.innerHTML = "Not in the table. The model has never seen “searching for”, so it has no counts to divide.";
  });
};

/* Q10: parameters on a log scale */
W.ls1_scale = el => {
  const rows = [["GPT-2 small", 124e6, "124 million"], ["Gemma 3 1B", 1e9, "1 billion"], ["GPT-3", 175e9, "175 billion"]];
  const lo = 7, hi = 12, w = v => (Math.log10(v) - lo) / (hi - lo) * 100;
  el.innerHTML = `<div class="ls1-scale">${rows.map(([t, v, s], i) => `<div class="ls1-sr"><span class="t">${t}</span><span class="bar"><i data-w="${w(v).toFixed(1)}" style="width:0;background:${["#6AA84F", "#8E7CC3", "#3C78D8"][i]}"></i></span><span class="n">${s}</span></div>`).join("")}
    <div class="ls1-sr ls1-tk"><span></span><span class="ax">${["10M", "100M", "1B", "10B", "100B", "1T"].map((t, k) => `<span style="left:${k * 20}%">${t}</span>`).join("")}</span><span></span></div></div>
    <div class="wg-foot"><span class="cap">Parameters on a log scale: each tick is 10× more. GPT-3 has about 1,400× the parameters of GPT-2 small.</span><button class="replay" type="button">↻ Replay</button></div>`;
  replayable(el, still => { const is = $$(".ls1-scale i", el); is.forEach(i => i.style.width = still ? i.dataset.w + "%" : "0"); if (!still) grow(el); });
};

/* Q11: from raw text to a trained model, one stage at a time */
const IDS = [412, 37, 905, 58, 21, 266, 731, 14, 388, 3];
const ZF = Z.concat("food", ".");
W.ls1_pipeline = el => {
  const steps = [
    { t: "Collect and prepare data",
      stage: () => `<div class="anim-in ls1-stage"><div class="pc plain ls1-raw">“&nbsp;&nbsp;Ben was hungry so he went looking for food.&nbsp;&nbsp;Ben was hungry so he went looking for food.&nbsp;&nbsp;&lt;br&gt;”</div><div class="ls1-ar">↓ clean: remove duplicates, stray markup and extra spaces</div><div class="pc sage">“Ben was hungry so he went looking for food.”</div></div>`,
      text: "<p>Gather the text the model will learn from (in the course, the Africa Galore dataset) and clean it. The model can only learn what is in this data, so its quality matters more than anything else.</p>" },
    { t: "Tokenise",
      stage: () => `<div class="anim-in ls1-stage"><div class="toks" style="justify-content:center">${ZF.map(t => chip(t)).join("")}</div><div class="ls1-ar">↓ look each token up in the vocabulary</div><div class="toks" style="justify-content:center">${IDS.map(n => `<span class="tk k">${n}</span>`).join("")}</div></div>`,
      text: "<p>Split the text into tokens (here, one per word and punctuation mark) and swap each for its ID number in the vocabulary. From now on the model only ever sees numbers. (IDs are illustrative.)</p>" },
    { t: "Create training examples",
      stage: () => `<div class="anim-in ls1-stage"><div class="trainpairs"><span class="h">Input</span><span></span><span class="h">Target</span>
        ${[["Ben", "was"], ["Ben was", "hungry"], ["Ben was hungry", "so"], ["Ben … looking for", "food"]].map(([a, b]) => `${chip(a)}<span class="ar">→</span>${chip(b, "tgt")}`).join("")}</div></div>`,
      text: "<p>Turn the token sequence into (input, target) pairs: every prefix is an input, and the token that follows it is the target. One sentence gives many examples.</p>" },
    { t: "Train",
      stage: () => `<div class="anim-in ls1-stage"><div class="ls1-loop">${["Predict", "Compare: loss", "Adjust parameters", "Repeat"].map((s, i) => `<span class="ls1-lp" style="--i:${i}">${s}</span>`).join('<span class="ls1-ar2">→</span>')}</div>
        <p class="cap" style="margin:12px 0 0">P(food | Ben was hungry so he went looking for)</p>
        <div style="--lw:130px;width:100%;max-width:520px;margin:4px auto 0">${bars([["before training", "0.20", 20 / 0.7], ["after training", "0.64", 64 / 0.7, "pick"]])}</div></div>`,
      text: "<p>Show the model each input, compare its prediction with the target using the loss, and nudge its parameters to do better. Repeat for millions of examples (Question 12).</p>" },
    { t: "Evaluate",
      stage: () => `<div class="anim-in ls1-stage grid3" style="margin:0">${[["Fluency", "Does it read like natural language?"], ["Coherence", "Does it stay on topic and make sense?"], ["Context sensitivity", "Does “hungry” lead to “food”?"], ["Bias", "Does it treat people and places fairly?"]].map(([h, b]) => card("lav", h, b)).join("")}</div>`,
      text: "<p>Generate text from fresh prompts and judge it. Numbers like the loss help, but you also read the outputs: are they fluent, coherent, sensitive to context, and fair?</p>" },
  ];
  el.innerHTML = `<div class="st"><div class="st-nav"><div class="st-dots">${steps.map((_, i) => `<button type="button" data-i="${i}" aria-label="Stage ${i + 1}">${i + 1}</button>`).join("")}</div>
      <button class="btn ghost small" data-a="prev" type="button">← Back</button><button class="btn small" data-a="next" type="button">Next stage →</button><button class="btn ghost small" data-a="play" type="button">▶ Play all</button></div>
    <div class="st-title"></div><div class="st-stage" style="min-height:210px"></div><div class="st-text"></div></div>`;
  const stage = $(".st-stage", el), title = $(".st-title", el), text = $(".st-text", el);
  let cur = 0, timer = null; const seen = new Set();
  const show = i => {
    cur = Math.max(0, Math.min(steps.length - 1, i)); seen.add(cur);
    title.innerHTML = `Stage ${cur + 1} of ${steps.length} · ${steps[cur].t}`;
    stage.innerHTML = steps[cur].stage(); text.innerHTML = steps[cur].text; grow(stage);
    $$(".st-dots button", el).forEach((b, k) => { b.classList.toggle("on", k === cur); b.classList.toggle("seen", seen.has(k)); });
    $('[data-a="prev"]', el).disabled = cur === 0; $('[data-a="next"]', el).disabled = cur === steps.length - 1;
  };
  const stop = () => { clearInterval(timer); timer = null; $('[data-a="play"]', el).innerHTML = "▶ Play all"; };
  $$(".st-dots button", el).forEach(b => b.onclick = () => { stop(); show(+b.dataset.i); });
  $('[data-a="prev"]', el).onclick = () => { stop(); show(cur - 1); };
  $('[data-a="next"]', el).onclick = () => { stop(); show(cur + 1); };
  $('[data-a="play"]', el).onclick = () => {
    if (timer) { stop(); return; }
    if (cur === steps.length - 1) show(0);
    $('[data-a="play"]', el).innerHTML = "❚❚ Pause";
    timer = setInterval(() => { if (!el.isConnected || cur === steps.length - 1) { stop(); return; } show(cur + 1); }, 5500);
  };
  show(0);
};

/* Q12: training lowers the loss; watch the target's probability climb */
W.ls1_train = el => {
  const toks = ["hungry", "tired", "bottle", "there"];
  const start = [0.03, 0.05, 0.41, 0.22], end = [0.58, 0.17, 0.01, 0.04], S = 5;
  el.innerHTML = `<div class="ls1-loop">${["Predict", "Compare: loss", "Adjust parameters", "Repeat"].map(s => `<span class="ls1-lp">${s}</span>`).join('<span class="ls1-ar2">→</span>')}</div>
    <p class="cap" style="text-align:center;margin:12px 0 6px">Input <b>“Ben was”</b> · target <b style="color:var(--green)">“hungry”</b></p>
    <div class="ls1-b" style="--lw:70px;max-width:560px;margin:0 auto"></div>
    <div class="ls1-lossbox"><span>training step <b class="ls1-step">0</b></span><span>loss = −log P(hungry) = <b class="ls1-loss">3.51</b></span></div>
    <div class="wg-foot"><span class="cap"></span><button class="replay" type="button">↻ Replay</button></div>`;
  const b = $(".ls1-b", el), lp = $$(".ls1-lp", el), stepEl = $(".ls1-step", el), lossEl = $(".ls1-loss", el), cap = $(".wg-foot .cap", el);
  b.innerHTML = bars(toks.map((t, i) => [t, f2(start[i]), start[i] * 100 / 0.7, i === 0 ? "pick" : ""]));
  const at = k => {
    const f = k / S, p = start.map((s, i) => s + (end[i] - s) * f);
    $$(".brow", b).forEach((r, i) => { $(".n", r).textContent = f2(p[i]); $("i", r).style.width = (p[i] * 100 / 0.7) + "%"; });
    stepEl.textContent = k === S ? "many steps later" : k; lossEl.textContent = (-ln(p[0])).toFixed(2);
    lossEl.parentElement.parentElement.classList.toggle("low", k === S);
  };
  let run = 0;
  replayable(el, async still => {
    const my = ++run, ok = () => my === run && el.isConnected;
    if (still) { at(S); cap.innerHTML = "After training: “hungry” gets 0.58 and the loss falls from 3.51 to 0.54."; return; }
    at(0); cap.innerHTML = "Early in training the model bets on “bottle”: the loss is high.";
    await sleep(1800); if (!ok()) return;
    for (let k = 1; k <= S; k++) {
      for (let j = 0; j < 4; j++) { lp.forEach((x, q) => x.classList.toggle("on", q === j)); await sleep(260); if (!ok()) return; }
      at(k); cap.innerHTML = k < S ? `Training step ${k}: each adjustment moves probability towards the target.` : "After training: “hungry” gets 0.58 and the loss falls from 3.51 to 0.54.";
    }
    lp.forEach(x => x.classList.remove("on"));
  });
};

/* Q12: the loss curve, −log p */
W.ls1_logloss = el => {
  const X0 = 40, X1 = 330, Y0 = 18, Y1 = 178, ymax = 4.7;
  const px = p => X0 + p * (X1 - X0), py = L => Y0 + (1 - Math.min(L, ymax) / ymax) * (Y1 - Y0);
  let d = ""; for (let k = 0; k <= 120; k++) { const p = 0.01 + k * 0.99 / 120; d += (k ? "L" : "M") + px(p).toFixed(1) + " " + py(-ln(p)).toFixed(1); }
  el.innerHTML = `<label class="slider"><span>Probability given to the target</span><input type="range" min="0.01" max="1" step="0.01" value="0.03"><output></output></label>
    <svg viewBox="0 0 350 214" role="img" aria-label="Loss is minus log of the probability given to the target" ${FONT}>
      <line x1="${X0}" y1="${Y1}" x2="${X1}" y2="${Y1}" stroke="#8A84A0"/><line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y1}" stroke="#8A84A0"/>
      <path d="${d}" fill="none" stroke="#8E7CC3" stroke-width="2.6"/>
      ${[0, 0.25, 0.5, 0.75, 1].map(p => `<text x="${px(p)}" y="${Y1 + 16}" text-anchor="middle" font-size="11" fill="#655F78">${p}</text>`).join("")}
      ${[0, 1, 2, 3, 4].map(L => `<text x="${X0 - 8}" y="${py(L) + 4}" text-anchor="end" font-size="11" fill="#655F78">${L}</text>`).join("")}
      <text x="${(X0 + X1) / 2}" y="208" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1B1530">probability of the correct token</text>
      <text x="12" y="${(Y0 + Y1) / 2}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1B1530" transform="rotate(-90 12 ${(Y0 + Y1) / 2})">loss</text>
      <line class="ls1-gx" stroke="#361A54" stroke-dasharray="4 4"/><circle class="ls1-pt" r="7" fill="#FDD633" stroke="#361A54" stroke-width="2"/></svg>
    <p class="cap ls1-lc" style="margin:6px 0 0"></p>`;
  const inp = $("input", el), out = $("output", el), pt = $(".ls1-pt", el), gx = $(".ls1-gx", el), cap = $(".ls1-lc", el);
  const draw = () => {
    const p = +inp.value, L = -ln(p);
    pt.setAttribute("cx", px(p)); pt.setAttribute("cy", py(L));
    gx.setAttribute("x1", px(p)); gx.setAttribute("x2", px(p)); gx.setAttribute("y1", py(L)); gx.setAttribute("y2", Y1);
    out.textContent = `p = ${p.toFixed(2)} → loss ${L.toFixed(2)}`;
    cap.innerHTML = p < 0.1 ? "<b>Confidently wrong:</b> a tiny probability for the right answer costs a lot." : p > 0.9 ? "<b>Confidently right:</b> the loss is close to 0." : "The more probability on the right token, the lower the loss.";
  };
  inp.oninput = draw; draw();
};

/* ======================================================================
   Results screen: explore the two models you met in the course
   ====================================================================== */
const XINFO = {
  ng_data: { name: "Text data", c: "#9AA3B8", q: 2, what: "A dataset of example text. An n-gram model only knows the word sequences that appear here.", eg: "“Ben went looking for food.” “Sam went looking for water.”", eq: String.raw`\text{corpus} = \text{every sentence you have}` },
  ng_count: { name: "Count n-grams", c: "#E69138", q: 4, what: "Slide a window of n words along the text and count how often every n-gram appears.", eg: "jollof rice: 60 · jollof chicken: 30 · jollof stew: 10", eq: String.raw`\mathrm{Count}(\text{jollof rice}) = 60` },
  ng_prob: { name: "Counts → probabilities", c: "#C9A227", q: 2, what: "Divide each pair’s count by how often its first word appears. The results for one context add up to 1.", eg: "P(rice | jollof) = 60 ÷ 100 = 0.6", eq: String.raw`P(B \mid A) = \frac{\mathrm{Count}(A\,B)}{\mathrm{Count}(A)}` },
  ng_window: { name: "Look at the last n − 1 words", c: "#8E7CC3", q: 5, what: "To predict, a trigram model looks only at the last 2 words. It misses clues further back, and has no counts for contexts it never saw.", eg: "“…went looking for ___” → it sees only “looking for”.", eq: String.raw`P(x_t \mid x_{t-2},\, x_{t-1})` },
  sample: { name: "Sample the next token", c: "#3C78D8", q: 3, what: "Draw the next token in proportion to its probability. Always taking the top one gives the same text every time.", eg: "food 0.34 · snacks 0.27 · cookies 0.22 · water 0.10", eq: String.raw`x_t \sim P(\,\cdot \mid \text{context})` },
  out: { name: "Generated text", c: "#6AA84F", q: 0, what: "Append the sampled token to the context and predict again, one token at a time, until the model predicts an end-of-text token.", eg: "Ben was hungry so he went looking for food.", eq: String.raw`P(x_t \mid x_1, \dots, x_{t-1})` },
  data: { name: "Collect and prepare data", c: "#9AA3B8", q: 10, what: "Gather and clean the text the model learns from. The course used the Africa Galore dataset.", eg: "Remove duplicates, stray markup and extra spaces.", eq: String.raw`\text{raw text} \rightarrow \text{clean text}` },
  tok: { name: "Tokenise", c: "#3C78D8", q: 10, what: "Split the text into tokens and map each one to an ID from the vocabulary. The model only ever sees these numbers.", eg: "Ben was hungry → [412, 37, 905] (illustrative IDs)", eq: String.raw`\text{text} \rightarrow [x_1, x_2, \dots, x_N]` },
  ex: { name: "Training examples", c: "#C9A227", q: 10, what: "Every prefix of the token sequence becomes an input, and the token after it becomes the target.", eg: "“Ben was” → “hungry”", eq: String.raw`(x_1, \dots, x_{t-1}) \rightarrow x_t` },
  model: { name: "Small language model", c: "#4C2BD6", q: 0, what: "A neural network (a small Transformer) that turns the context into a probability for every token in the vocabulary. “Small” means fewer parameters and less data than an LLM.", eg: "“Ben was hungry so he went looking for” → food 0.34, snacks 0.27…", eq: String.raw`P_\theta(x_t \mid x_1, \dots, x_{t-1})` },
  loss: { name: "Loss", c: "#CC4125", q: 11, what: "Measures how far the prediction is from the target: minus the log of the probability the model gave the right token.", eg: "P(hungry) = 0.03 → loss 3.51 · P(hungry) = 0.58 → loss 0.54", eq: String.raw`\mathcal{L} = -\log P_\theta(\text{target} \mid \text{input})` },
  update: { name: "Adjust parameters", c: "#6AA84F", q: 11, what: "Gradient descent nudges every parameter a little in the direction that lowers the loss. Repeat over millions of examples.", eg: "Step by step, probability moves from “bottle” to “hungry”.", eq: String.raw`\theta \leftarrow \theta - \eta\, \nabla_\theta \mathcal{L}` },
};
function flowSVG(kind) {
  const X = 80, Wd = 220, H = 40, cx = X + Wd / 2, id = uid("lf");
  const box = (part, y, label, fill, stroke, ink = "#1B1530") => `<g class="ab" data-part="${part}" tabindex="0" role="button" aria-label="${esc(label)}"><rect class="ring" x="${X - 5}" y="${y - 5}" width="${Wd + 10}" height="${H + 10}" rx="14" fill="none" stroke="#FDD633" stroke-width="5"/><rect class="bx" x="${X}" y="${y}" width="${Wd}" height="${H}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><text x="${cx}" y="${y + 25.5}" text-anchor="middle" font-size="15" font-weight="700" fill="${ink}">${esc(label)}</text></g>`;
  const down = (y1, y2) => `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 - 3}" stroke="#7D7794" stroke-width="2" marker-end="url(#${id})"/>`;
  const defs = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7D7794"/></marker><marker id="${id}p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7A5FC4"/></marker></defs>`;
  if (kind === "ngram") return `<svg viewBox="0 0 380 460" role="img" aria-label="n-gram language model, from text data to generated text" ${FONT}>${defs}
    ${down(54, 92)}${down(132, 170)}${down(210, 248)}${down(288, 326)}${down(366, 404)}
    <path d="M${X + Wd} 424 H336 V268 H${X + Wd + 4}" fill="none" stroke="#7A5FC4" stroke-width="2.2" marker-end="url(#${id}p)"/><text x="314" y="311" text-anchor="middle" font-size="11.5" font-weight="700" fill="#5B4596">repeat</text>
    ${box("ng_data", 14, "Text data", "#EEF0F5", "#9AA3B8")}${box("ng_count", 92, "Count n-grams", "#FCE5CD", "#E69138")}${box("ng_prob", 170, "Counts → probabilities", "#FFF2CC", "#C9A227")}
    ${box("ng_window", 248, "Look at the last n − 1 words", "#E4DCF1", "#8E7CC3")}${box("sample", 326, "Sample the next token", "#CFE2F3", "#3C78D8")}${box("out", 404, "Generated text", "#D9EAD3", "#6AA84F")}</svg>`;
  return `<svg viewBox="0 0 380 620" role="img" aria-label="Small language model, from data to training to generated text" ${FONT}>${defs}
    <rect x="40" y="214" width="320" height="250" rx="16" fill="#F3EFFB" stroke="#B9A9E3" stroke-width="1.6" stroke-dasharray="6 5"/>
    <text x="60" y="339" text-anchor="middle" font-size="13" font-weight="800" fill="#5B4596" transform="rotate(-90 60 339)">Training loop</text>
    ${down(54, 84)}${down(124, 154)}${down(194, 238)}${down(278, 318)}${down(358, 398)}${down(438, 494)}${down(534, 564)}
    <path d="M${X + Wd} 418 H340 V258 H${X + Wd + 4}" fill="none" stroke="#7A5FC4" stroke-width="2.2" marker-end="url(#${id}p)"/><text x="315" y="384" text-anchor="middle" font-size="11.5" font-weight="700" fill="#5B4596">repeat</text>
    <text x="${cx + 10}" y="478" font-size="11.5" font-weight="600" fill="#655F78">after training</text>
    ${box("data", 14, "Collect and prepare data", "#EEF0F5", "#9AA3B8")}${box("tok", 84, "Tokenise", "#CFE2F3", "#3C78D8")}${box("ex", 154, "Training examples", "#FFF2CC", "#C9A227")}
    ${box("model", 238, "Small language model", "#4C2BD6", "#4C2BD6", "#FFFFFF")}${box("loss", 318, "Loss", "#F4CCCC", "#CC4125")}${box("update", 398, "Adjust parameters", "#D9EAD3", "#6AA84F")}
    ${box("sample", 494, "Sample the next token", "#CFE2F3", "#3C78D8")}${box("out", 564, "Generated text", "#D9EAD3", "#6AA84F")}</svg>`;
}
W.ls1_explorer = el => {
  const canJump = el.dataset.jump === "1";
  let kind = "slm", part = "model";
  el.innerHTML = `<div class="tabs"><button type="button" data-k="ngram">n-gram model</button><button type="button" data-k="slm">Small language model</button></div>
    <div class="explore"><div><div class="arch interactive ls1-x"></div><p class="xhint">Read from the top down. Tap any step.</p></div><div class="xinfo" aria-live="polite"></div></div>`;
  const box = $(".ls1-x", el), info = $(".xinfo", el);
  const choose = p => {
    const d = XINFO[p]; if (!d) return; part = p;
    $$(".ab", box).forEach(g => g.classList.toggle("on", g.dataset.part === p));
    info.innerHTML = `<div class="kick">${kind === "slm" ? "Small language model" : "n-gram language model"}</div><h3><i style="border-color:${d.c}"></i>${esc(d.name)}</h3>
      <p>${esc(d.what)}</p>${EQ(K(d.eq, true))}<div class="eg"><b>Example:</b> ${esc(d.eg)}</div>
      ${canJump ? `<div class="acts"><button class="btn ghost small" type="button" data-q="${d.q}">Revisit Question ${d.q + 1} →</button></div>` : ""}`;
    const b = $("[data-q]", info); if (b) b.onclick = () => el.dispatchEvent(new CustomEvent("jumpq", { bubbles: true, detail: +b.dataset.q }));
  };
  const draw = k => {
    kind = k; $$(".tabs button", el).forEach(b => b.classList.toggle("on", b.dataset.k === k));
    box.innerHTML = flowSVG(k);
    $$(".ab", box).forEach(g => {
      g.addEventListener("click", e => { e.stopPropagation(); choose(g.dataset.part); });
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(g.dataset.part); } });
    });
    choose(k === "slm" ? "model" : "ng_prob");
  };
  $$(".tabs button", el).forEach(b => b.onclick = () => draw(b.dataset.k));
  draw("slm");
};

/* ======================================================================
   Question-page illustrations
   ====================================================================== */
const ilModel = () => `<div class="ls1-flow">
    <div class="toks" style="justify-content:center">${zchips()}</div><div class="ls1-ar">↓</div>
    <div class="modelbox">Language model</div><div class="ls1-ar">↓</div>
    <div class="toks" style="justify-content:center"><span class="tk blank" style="font-size:20px;padding:8px 18px">?</span></div></div>
  <p class="ilcap">The model reads the context. What is it fundamentally trying to produce?</p>`;
const ilGiven = () => `<div class="ls1-big">${texd`P(\text{rice} \mid \text{jollof})`}</div>
  <div class="toks" style="justify-content:center;margin-top:6px">${chip("I")}${chip("ate")}${chip("jollof", "k")}${chip("?", "blank")}</div>
  <p class="ilcap">One word is already known, one is being predicted. Which is which?</p>`;
const ilCounts = () => `<p class="cap" style="text-align:center;margin:0 0 8px"><b>Counts in the dataset</b></p>
  <div style="--lw:118px;max-width:460px;margin:0 auto">${bars([["jollof rice", "60", 60 / 0.7], ["jollof chicken", "30", 30 / 0.7], ["jollof stew", "10", 10 / 0.7]])}</div>
  <p class="ilcap">“jollof” is followed by one of these three words every time it appears.</p>`;
const ilSample = () => `<div style="--lw:84px;max-width:460px;margin:0 auto">${bars(DIST.map(([t, p]) => [t, f2(p), p * 100 / 0.4]))}</div>
  <div class="cols" style="margin-top:12px;gap:10px">${card("peach", "Strategy 1: always the top token", `<span class="cap">Run 1: …looking for ? <br>Run 2: …looking for ?</span>`)}${card("blue", "Strategy 2: sample from the probabilities", `<span class="cap">Run 1: …looking for ? <br>Run 2: …looking for ?</span>`)}</div>
  <p class="ilcap">The model’s probabilities for the word after “Ben was hungry so he went looking for”.</p>`;
const ilSentence = cap => `<div class="toks" style="justify-content:center">${zchips()}</div><p class="ilcap">${cap}</p>`;
const ilTrigram = () => `<div class="toks" style="justify-content:center">${zchips()}${chip("?", "blank")}</div>
  <div class="ls1-tag">Trigram model · n = 3</div><p class="ilcap">A trigram model must predict the blank. How far back can it look?</p>`;
const ilPairs = () => {
  const opt = [[0, 1, "A"], [2, 3, "B"], [4, 5, "C"], [6, 7, "D"]], cols = ["var(--a)", "var(--b)", "var(--c)", "var(--d)"];
  return `<div class="ls1-pairs">${opt.map(([i, j, L], k) => `<span class="ls1-pair" style="--pc:${cols[k]}">${chip(Z[i])}${chip(Z[j])}<b>${L}</b></span>`).join("")}${chip("?", "blank")}</div>
  <p class="ilcap">The four options are four neighbouring pairs. Which pair does a trigram model use for the blank?</p>`;
};
const ilTriBars = () => `<div class="toks" style="justify-content:center">${zchips()}${chip("?", "blank")}</div>
  <p class="cap" style="text-align:center;margin:14px 0 6px">A trigram model’s top guesses for the blank:</p>
  <div style="--lw:70px;max-width:420px;margin:0 auto">${bars([["keys", "0.24", 24 / 0.4], ["work", "0.22", 22 / 0.4], ["food", "0.20", 20 / 0.4]])}</div>
  <p class="ilcap">Ben is hungry, yet “food” is only third. Why?</p>`;
const ilCorpus = () => `<div class="pc plain"><b class="h">Training text</b><span class="ls1-corpus">Ben went looking for food.<br>Sam went looking for water.<br>Alex went looking for work.</span></div>
  <div class="ls1-ar" style="text-align:center">↓ a trigram model is trained on this, then asked:</div>
  <div class="toks" style="justify-content:center">${["Ben", "went", "searching", "for"].map(t => chip(t)).join("")}${chip("?", "blank")}</div>
  <p class="ilcap">Notice which words the model has and hasn’t seen together.</p>`;
const net = (layers, x0, w, h, col) => {
  const xs = layers.map((_, i) => x0 + (layers.length === 1 ? w / 2 : i * w / (layers.length - 1)));
  let s = "";
  layers.forEach((n, i) => { if (i < layers.length - 1) for (let a = 0; a < n; a++) for (let b = 0; b < layers[i + 1]; b++) s += `<line x1="${xs[i]}" y1="${20 + (a + 0.5) * h / n}" x2="${xs[i + 1]}" y2="${20 + (b + 0.5) * h / layers[i + 1]}" stroke="${col}" stroke-opacity=".28" stroke-width="1"/>`; });
  layers.forEach((n, i) => { for (let a = 0; a < n; a++) s += `<circle cx="${xs[i]}" cy="${20 + (a + 0.5) * h / n}" r="${n > 8 ? 3.6 : 6}" fill="#fff" stroke="${col}" stroke-width="1.6"/>`; });
  return s;
};
const ilSizes = () => `<svg viewBox="0 0 360 222" role="img" aria-label="A small network next to a much larger one" ${FONT}>
  ${net([3, 4, 3], 22, 80, 120, "#6AA84F")}${net([8, 14, 14, 14, 8], 170, 170, 150, "#3C78D8")}
  <text x="62" y="186" text-anchor="middle" font-size="13" font-weight="800" fill="#1B1530">Small</text><text x="62" y="202" text-anchor="middle" font-size="12" fill="#655F78">language model</text>
  <text x="255" y="196" text-anchor="middle" font-size="13" font-weight="800" fill="#1B1530">Large</text><text x="255" y="210" text-anchor="middle" font-size="12" fill="#655F78">language model</text></svg>
  <p class="ilcap">Both predict the next token. So what does “small” actually measure?</p>`;
const ilSteps = () => `<div class="ls1-shuffle">${[["Train", "lav"], ["Evaluate", "pink"], ["Collect and prepare data", "plain"], ["Create training examples", "peach"], ["Tokenise", "blue"]].map(([t, c]) => `<div class="pc ${c}"><b>?</b>${t}</div>`).join("")}</div>
  <p class="ilcap">The five stages of building your SLM, shuffled. What is the right order?</p>`;
const ilLoss = () => `<div class="ls1-flow"><div class="toks">${chip("Ben")}${chip("was")}</div><div class="ls1-ar">↓</div><div class="modelbox">Model (early in training)</div><div class="ls1-ar">↓</div></div>
  <div style="--lw:70px;max-width:420px;margin:0 auto">${bars([["bottle", "0.41", 41 / 0.5], ["there", "0.22", 22 / 0.5], ["hungry", "0.03", 3 / 0.5, "pick"]])}</div>
  <p class="ilcap">The correct next word, the target, is <b>“hungry”</b>, but the model gave it only 0.03. How do we score this guess?</p>`;

/* ======================================================================
   QUESTIONS
   ====================================================================== */
const QS = [
 { id: "goal",
   q: "What is the fundamental goal of a language model?",
   options: ["Generate the longest possible sentence", "Predict the probability distribution of the next token, given the context", "Memorise its training dataset", "Translate text into another language"],
   answer: 1,
   illus: ilModel,
   explain: () =>
     P(1, "A probability for every possible next token", `<div class="wg" data-w="ls1_dist"></div>
       <p>A language model reads the context and gives <b>every token in its vocabulary</b> a probability of coming next. “food” scores highest because Ben is hungry, while a word like “photosynthesis” gets almost nothing. (Probabilities are illustrative.)</p>`) +
     P(2, "Read the equation", `${EQ(texd`P(\htmlClass{ls1-xt}{x_t} \mid \htmlClass{ls1-ctx}{x_{t-1}, x_{t-2}, \dots, x_1})`)}
       <div class="grid3">${card("plain", "P( … )", "a probability: a number between 0 and 1")}${card("peach", `${tex`x_t`}`, "the next token, the one being predicted")}${card("lav", "|", "read as “given”")}${card("blue", `${tex`x_{t-1}, \dots, x_1`}`, "the context so far")}</div>`) +
     P(3, "All the options add up to 1", `<p>Because the model must pick <b>something</b> next, the probabilities over the whole vocabulary V always sum to 1. That is what makes it a probability <b>distribution</b>:</p>
       ${EQ(texd`\sum_{w \in V} P(w \mid \text{Ben was hungry so he went looking for}) = 1`)}
       <p>To write text, the model picks a token from this distribution, appends it, and predicts again: one token at a time.</p>`),
   whynot: { 0: "Length isn’t the goal. The model stops when it predicts an end-of-text token.", 2: "A model that only memorised would fail on any new prompt. The point is to learn patterns that generalise.", 3: "Translation is one task you can build on top of a language model. It isn’t the core goal." },
   take: "A language model predicts a probability distribution over the next token, given the context so far." },

 { id: "given",
   q: "What does P(rice | jollof) mean?",
   options: ["The probability of “jollof”, given “rice”", "The probability that “jollof” is the most common word", "The probability of “rice”, given “jollof”", "The probability of “rice” and “jollof” appearing anywhere in the dataset"],
   answer: 2,
   illus: ilGiven,
   explain: () =>
     P(1, "Read the bar as “given”", `<div class="ls1-read"><div class="pc peach"><b class="h">rice</b>what we predict</div><div class="pc lav"><b class="h">|</b>“given”</div><div class="pc blue"><b class="h">jollof</b>what we already know</div></div>
       <p>Everything after the bar is the <b>condition</b>: the word we already know. The word before the bar is the <b>prediction</b>. So P(rice | jollof) asks: <i>given that the word before is “jollof”, how likely is the next word to be “rice”?</i></p>`) +
     P(2, "Order matters", `<div class="wg" data-w="ls1_given"></div>
       <p>Swap the two words and you ask a completely different question. “jollof rice” is common, so P(rice | jollof) is high. “rice jollof” is rare, so P(jollof | rice) is low. (Probabilities are illustrative.)</p>`) +
     P(3, "In maths", `${EQ(texd`P(\text{rice} \mid \text{jollof}) = \frac{P(\text{jollof rice})}{P(\text{jollof})}`, "The chance of the pair, out of all the times the condition happens. With real text, that is a ratio of counts: the next question.")}`),
   whynot: { 0: "That is P(jollof | rice): the two words are the wrong way round.", 1: "Nothing here is about the most common word. The bar means “given”.", 3: "That ignores the order of the words. P(rice | jollof) is about the very next word after “jollof”." },
   take: "P(rice | jollof) is the probability that the next word is “rice”, given that the word before it is “jollof”." },

 { id: "count",
   q: "A dataset contains “jollof rice” 60 times, “jollof chicken” 30 times and “jollof stew” 10 times. What is P(rice | jollof)?",
   options: ["0.06", "0.10", "0.60", "0.90"],
   answer: 2,
   illus: ilCounts,
   explain: () =>
     P(1, "Count, then divide", `<div class="wg" data-w="ls1_waffle"></div>
       <p>“jollof” appears 60 + 30 + 10 = <b>100</b> times, and “rice” follows it in <b>60</b> of them. So the probability is 60 out of 100: <b>0.6</b>.</p>`) +
     P(2, "The general rule", `${EQ(texd`P(B \mid A) = \frac{\mathrm{Count}(A\,B)}{\mathrm{Count}(A)}`, "Count the pair, divide by how often the first word appears.")}
       <p>Do this for every word that follows “jollof” and you get the whole distribution: 0.6 + 0.3 + 0.1 = 1. This is exactly how a bigram language model is built: from nothing but counts.</p>`),
   whynot: { 0: "0.06 divides by the wrong total. Divide by how often “jollof” appears: 100.", 1: "0.10 is the share for “jollof stew” (10 out of 100).", 3: "0.90 adds rice and chicken together (60 + 30)." },
   take: "P(rice | jollof) = Count(jollof rice) ÷ Count(jollof) = 60 ÷ 100 = 0.6." },

 { id: "sampling",
   q: "Why do language models usually sample the next token from the probability distribution, instead of always choosing the most likely one?",
   options: ["To generate diverse outputs instead of the same response every time", "Because they cannot compute the most likely token", "Because sampling lowers the training loss", "Because sampling makes the model learn faster"],
   answer: 0,
   illus: ilSample,
   explain: () =>
     P(1, "Spin the wheel", `<div class="wg" data-w="ls1_spinner"></div>
       <p>Sampling is like spinning a wheel where each token’s slice is as big as its probability. “food” wins most often, but “snacks” and “water” get their turn too. Always taking the top token gives the same story every time.</p>`) +
     P(2, "Greedy versus sampling", `<div class="cols">${card("peach", "Greedy: always the top token", `${EQ(tex`x_t = \arg\max_{w}\, P(w \mid \text{context})`)}Same output every time, and it can get stuck repeating itself.`)}${card("sage", "Sampling: draw from the distribution", `${EQ(tex`x_t \sim P(\,\cdot \mid \text{context})`)}Different, still sensible outputs. If one answer is poor, generate again.`)}</div>`) +
     P(3, "Going further: temperature", `<div class="wg" data-w="ls1_temp"></div>
       <p>Many tools add a <b>temperature</b> T that reshapes the probabilities before sampling: lower T plays it safe, higher T takes more risks.</p>`),
   whynot: { 1: "Finding the most likely token is easy: it is the biggest number in the list.", 2: "Sampling happens when you generate text, after training. It doesn’t touch the loss.", 3: "Learning happens during training. Sampling only changes how you use the trained model." },
   take: "Sampling picks each token in proportion to its probability, so the same prompt can give different, still sensible outputs." },

 { id: "bigram",
   q: "In “Ben was hungry so he went looking for”, which of these is a bigram?",
   options: ["Ben", "hungry so", "Ben was hungry", "went looking for"],
   answer: 1,
   illus: () => ilSentence("The options are all slices of this sentence. Which one is a bigram?"),
   explain: () =>
     P(1, "Slice the text into n-grams", `<div class="wg" data-w="ls1_ngrams"></div>
       <p>An <b>n-gram</b> is a run of n neighbouring words. Slide a window of n words along the sentence, one word at a time, and every stop is an n-gram. A <b>bigram</b> (bi = 2) is two words in a row, like <b>“hungry so”</b>.</p>`) +
     P(2, "How many are there?", `${EQ(texd`\#\,n\text{-grams} = N - n + 1`, "N is the number of words. Our sentence has 8 words: 8 unigrams, 7 bigrams, 6 trigrams.")}`) +
     P(3, "Why slice at all?", `<p>Count how often each n-gram appears in a dataset and you can estimate the probability of the next word from the words before it (Question 3). That is an <b>n-gram language model</b>.</p>`),
   whynot: { 0: "“Ben” is a single word: a unigram (n = 1).", 2: "“Ben was hungry” is three words: a trigram (n = 3).", 3: "“went looking for” is three words: also a trigram." },
   take: "An n-gram is n neighbouring words: “hungry so” is a bigram (n = 2)." },

 { id: "window",
   q: "How much context does a trigram language model use to predict the next word?",
   options: ["The entire prompt", "The last 1 word", "The last 2 words", "The first 3 words"],
   answer: 2,
   illus: ilTrigram,
   explain: () =>
     P(1, "It sees the last n − 1 words", `<div class="wg" data-w="ls1_window"></div>
       <p>A trigram is 3 words: the <b>last one is the word being predicted</b>, so only the other 2 are context. In general, an n-gram model looks back n − 1 words, nothing more.</p>`) +
     P(2, "In maths", `${EQ(texd`P(x_t \mid x_{t-n+1}, \dots, x_{t-1}) \qquad \text{trigram: } P(x_t \mid x_{t-2},\, x_{t-1})`)}
       <p>This shortcut is called the <b>Markov assumption</b>: pretend the next word depends only on the last few words. It keeps counting simple, but throws away everything earlier.</p>`),
   whynot: { 0: "Using the whole prompt is what Transformers do with attention. An n-gram window is fixed.", 1: "The last 1 word is a bigram model (n = 2).", 3: "It uses the most recent words, right before the blank, not the first ones." },
   take: "A trigram model (n = 3) uses the last 2 words as context: an n-gram model uses the last n − 1." },

 { id: "whichwords",
   q: "For “Ben was hungry so he went looking for”, which words does a trigram model use to predict the next word?",
   options: ["Ben was", "hungry so", "he went", "looking for"],
   answer: 3,
   illus: ilPairs,
   explain: () =>
     P(1, "The window slides along", `<div class="wg" data-w="ls1_slide"></div>
       <p>At every position, the trigram window holds the two words right before the word being predicted. By the time we reach the blank, the window holds <b>“looking for”</b> and nothing else.</p>`) +
     P(2, "What it actually computes", `${EQ(texd`P(\,?\mid \text{looking for}) \quad \text{instead of} \quad P(\,?\mid \text{Ben was hungry so he went looking for})`)}
       <p>In counts: how often each word followed “looking for” in the training text, divided by how often “looking for” appeared.</p>`),
   whynot: { 0: "“Ben was” opens the sentence, far from the blank.", 1: "“hungry so” holds the clue we wish it could use, but it is outside the window.", 2: "“he went” is two words too early." },
   take: "At the blank, a trigram model looks only at “looking for”: the two words right before it." },

 { id: "longrange",
   q: "A trigram model only sees “looking for” when predicting the next word. Why is this a limitation?",
   options: ["It ignores longer-range context, like “hungry”", "It cannot calculate probabilities", "It requires too many parameters", "It cannot process words"],
   answer: 0,
   illus: ilTriBars,
   explain: () =>
     P(1, "The clue is too far back", `<div class="wg" data-w="ls1_compare"></div>
       <p>With only “looking for”, the model can’t tell what Ben wants: keys, work and food all look plausible. The word that settles it, <b>“hungry”</b>, is six words back, outside the window.</p>`) +
     P(2, "Language is full of long-range clues", `${card("plain", "“The books that Ben borrowed from the library ___ overdue.”", `The right word is <b>“are”</b>, to agree with “books”, seven words back. A trigram sees only “the library”, which points to <b>“is”</b>: the wrong answer.`)}`) +
     P(3, "How Transformers fix it", `<p>Attention lets each token look at <b>every</b> earlier token, however far back, and learn which ones matter (Course 04).</p>
       ${EQ(texd`\text{trigram: } P(x_t \mid x_{t-2},\, x_{t-1}) \qquad \text{Transformer: } P(x_t \mid x_1, \dots, x_{t-1})`)}`),
   whynot: { 1: "It calculates probabilities fine: counts divided by counts.", 2: "Size isn’t the issue here: even a huge table of counts would still only see “looking for”.", 3: "Words are exactly what it counts." },
   take: "An n-gram model can’t use clues outside its window, so “hungry”, six words back, can’t help it predict “food”." },

 { id: "sparsity",
   q: "Which is another important limitation of n-gram models?",
   options: ["They cannot learn any patterns from text", "They require a Transformer architecture", "They struggle when they meet a context or word combination they never saw", "They always produce random outputs"],
   answer: 2,
   illus: ilCorpus,
   explain: () =>
     P(1, "Never seen it? No counts to use", `<div class="wg" data-w="ls1_lookup"></div>
       <p>n-gram probabilities are counts divided by counts. If “searching for” never appears in the training text, both counts are 0 and the probability can’t be estimated, even though “searching” means almost the same as “looking”.</p>`) +
     P(2, "This happens all the time", `<p>Language has endless valid combinations, so most possible contexts never appear in any dataset. This is the <b>data sparsity</b> problem:</p>
       ${EQ(texd`|V|^{\,n-1} \text{ possible contexts} \qquad 10{,}000^{2} = 100 \text{ million for a trigram}`, "With a 10,000-word vocabulary, a trigram model has 100 million possible two-word contexts to fill with counts.")}`) +
     P(3, "Two ways out", `<div class="cols">${card("blue", "Patch it: smoothing", `Pretend every pair was seen once more than it was (add-one smoothing), so nothing is exactly 0:${EQ(texd`P(B \mid A) = \frac{\mathrm{Count}(A\,B) + 1}{\mathrm{Count}(A) + |V|}`)}`)}${card("sage", "Fix it: neural models", "Learn a vector for every word, with similar words close together. “searching” sits near “looking”, so what was learned about one transfers to the other.")}</div>`),
   whynot: { 0: "They do learn patterns: every count is a pattern taken from the data.", 1: "n-gram models are much older than Transformers and need no neural network at all.", 3: "Their outputs follow the counts. With greedy decoding they give the same answer every time." },
   take: "An n-gram model has no counts for contexts it never saw, so it can’t predict there: the data sparsity problem." },

 { id: "small",
   q: "Why is a Small Language Model (SLM) called “small”?",
   options: ["It only predicts short sentences", "It only understands small words", "It has a smaller vocabulary by definition", "It has fewer parameters and learns from less data than an LLM"],
   answer: 3,
   illus: ilSizes,
   explain: () =>
     P(1, "Small means fewer parameters", `<div class="wg" data-w="ls1_scale"></div>
       <p><b>Parameters</b> are the numbers a model adjusts during training: its weights. More parameters means more capacity to store patterns, but also more data, compute and money to train and run.</p>`) +
     P(2, "Same recipe, different scale", `<div class="scrollx"><table class="cmp"><thead><tr><th></th><th>Small language model</th><th>Large language model</th></tr></thead><tbody>
       <tr><th>Parameters</th><td>Millions to a few billion</td><td>Tens to hundreds of billions</td></tr>
       <tr><th>Training data</th><td>Less, often focused</td><td>Vast: trillions of tokens</td></tr>
       <tr><th>Compute and cost</th><td>Low: can run on a laptop or phone</td><td>High: data centres of chips</td></tr>
       <tr><th>Core ideas</th><td colspan="2" style="text-align:center">The same: tokens, next-token prediction, Transformers, loss</td></tr></tbody></table></div>
       <p>Your SLM in this course is a small Transformer trained on the Africa Galore dataset. LLMs like Gemini use the same ideas at a vastly larger scale.</p>`),
   whynot: { 0: "An SLM can write sentences of any length.", 1: "It handles the same words. “Small” describes the model, not the words.", 2: "Vocabulary size is set by the tokeniser. Small and large models can share the same vocabulary." },
   take: "“Small” means fewer parameters and less training data: an SLM uses the same ideas as an LLM at a smaller scale." },

 { id: "pipeline",
   q: "Which sequence best represents how you built your small language model?",
   options: ["Collect and prepare data → tokenise → create training examples → train → evaluate", "Train → tokenise → collect data → evaluate", "Evaluate → generate → tokenise → train", "Tokenise → evaluate → collect data → generate"],
   answer: 0,
   illus: ilSteps,
   explain: () =>
     P(1, "From raw text to a trained model", `<div class="wg" data-w="ls1_pipeline"></div>`) +
     P(2, "Every prefix is a training example", `<div class="trainpairs">${[1, 2, 3, 8].map(k => `${chip(Z.slice(0, k).join(" "))}<span class="ar">→</span>${chip(k === 8 ? "food" : Z[k], "tgt")}`).join("")}</div>
       ${EQ(texd`N \text{ tokens} \;\rightarrow\; N - 1 \text{ (input, target) pairs}`, "The full sentence “Ben was hungry so he went looking for food” (9 words) gives 8 examples.")}`),
   whynot: { 1: "You can’t train before you have data and tokens.", 2: "Evaluation comes last: before training there is nothing to evaluate.", 3: "Tokenising needs data first, and evaluating needs a trained model." },
   take: "Collect and prepare data → tokenise → create training examples → train → evaluate." },

 { id: "loss",
   q: "During training, what is the purpose of the loss?",
   options: ["To measure how much data the model has seen", "To measure the mismatch between the model’s prediction and the target", "To set the model’s vocabulary size", "To select the next token during inference"],
   answer: 1,
   illus: ilLoss,
   explain: () =>
     P(1, "Loss: how wrong was the guess?", `<div class="wg" data-w="ls1_train"></div>
       <p>The loss scores each prediction against the target. Early on the model bets on “bottle”, so the loss is high. Training repeats <b>predict, compare, adjust</b> millions of times, and probability moves towards “hungry”. (Probabilities are illustrative.)</p>`) +
     P(2, "The maths: cross-entropy loss", `${EQ(texd`\mathcal{L} = -\log P(\text{target} \mid \text{input})`, "log is the natural logarithm. Only the probability given to the correct token matters.")}
       ${EQ(texd`-\log 0.03 = 3.51 \;\;(\text{early}) \qquad -\log 0.58 = 0.54 \;\;(\text{after training})`)}
       <div class="wg" data-w="ls1_logloss"></div>`) +
     P(3, "How training lowers it", `${EQ(texd`\theta \leftarrow \theta - \eta\, \nabla_\theta \mathcal{L}`, "θ are the parameters, η the learning rate, ∇L the gradient: the direction that increases the loss.")}
       <p><b>Gradient descent</b> nudges every parameter a small step in the direction that lowers the loss. One example at a time the steps are tiny; over millions of examples, the model learns language.</p>`),
   whynot: { 0: "How much data the model has seen is counted in training steps or epochs, not by the loss.", 2: "The vocabulary is fixed by the tokeniser before training starts.", 3: "Choosing the next token happens when generating text (sampling, Question 4), not during training." },
   take: "The loss measures how far the prediction is from the target; training adjusts the parameters to make it smaller." },
];

SESSIONS.push({
  id: "live-session-1",
  order: 1,
  label: "Live Session 1 of 4",
  course: "Course 01",
  title: "Build Your Own Small Language Model",
  held: "Held live on Thursday 8 October 2026",
  cover: "/img/live-session-1.jpg",
  courseUrl: "https://www.skills.google/paths/3135",
  explore: "ls1_explorer",
  exploreTitle: "Explore the two models you met",
  questions: QS,
});
})();
