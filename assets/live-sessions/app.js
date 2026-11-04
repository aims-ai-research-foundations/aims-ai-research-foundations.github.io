/* Views: home (session cards) · self-paced practice · presenter (?host) · live phones (?live).
   Live sessions talk to the Durable Object over a WebSocket; practice mode needs no server at all. */
"use strict";

const app = $("#app");
SESSIONS.sort((a, b) => (a.order || 99) - (b.order || 99));
/* One app, two homes:
   - airf.aims.ac.za/live-sessions/… (LQ_CONFIG.mode = "static"): the cohort cards and the self-paced quizzes, plain pages;
   - the Cloudflare Worker: live quizzes only (phones ?live, presenter ?host&k=…); everything else forwards to the site.
   Each cohort has its own page (/cohort/<slug>), its own live room and presenter link. Cohort settings: cohort.js */
const LQ = Object.assign({ mode: "worker", publicSite: "https://airf.aims.ac.za/live-sessions/", liveOrigin: "https://airf-live-quiz.similoluwa.workers.dev", assets: "/" }, window.LQ_CONFIG || {});
const STATIC = LQ.mode === "static";
const ALL_COHORTS = typeof COHORTS === "object" && COHORTS ? COHORTS : {};
const SLUG = LQ.cohort || (location.pathname.match(/^\/cohort\/([a-z0-9-]+)\/?$/) || [])[1] || null;
const CO = SLUG && ALL_COHORTS[SLUG] ? { slug: SLUG, ...ALL_COHORTS[SLUG] } : null;
const BASE = LQ.base || (CO ? `/cohort/${CO.slug}` : "/");                       // this cohort's quiz page
const HOME = STATIC ? (LQ.home || "/live-sessions/") : LQ.publicSite;            // all cohorts
const PUBLIC_COHORT = CO ? `${LQ.publicSite}cohort/${CO.slug}/` : LQ.publicSite;   // where participants revisit quizzes
const asset = p => !p ? "" : /^https?:\/\//.test(p) ? p : LQ.assets + String(p).replace(/^\//, "");
if (CO && CO.sessions) {   // only this cohort's sessions, with its dates and covers
  for (let i = SESSIONS.length - 1; i >= 0; i--) if (!CO.sessions[SESSIONS[i].id]) SESSIONS.splice(i, 1);
  SESSIONS.forEach(s => Object.assign(s, CO.sessions[s.id]));
}
SESSIONS.forEach(s => { s.cover = asset(s.cover); });
const cohortTag = () => CO && CO.name ? `<span class="pill cohort">${CO.flag ? CO.flag + " " : ""}${esc(CO.name)}</span>` : "";
const params = new URLSearchParams(location.search);
const ROOM = (params.get("room") || (CO ? CO.slug : "main")).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) || "main";
const LIVE_BASE = STATIC ? `${LQ.liveOrigin}/cohort/${SLUG || ""}` : location.origin + BASE;   // the live quiz runs on the Worker
const JOIN_URL = LIVE_BASE + "?live" + (params.get("room") ? "&room=" + ROOM : "");
const API_LIVE = (STATIC ? LQ.liveOrigin : "") + "/api/live?room=" + ROOM;
const sessionById = id => SESSIONS.find(x => x.id === id) || null;
const COLS = ["var(--a)", "var(--b)", "var(--c)", "var(--d)"];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const pkey = sid => "airf-practice-" + sid;
const pstate = sid => { const s = store.get(pkey(sid), null); return s && typeof s === "object" && s.answers ? s : { answers: {}, at: 0 }; };
const scoreMsg = (score, n) => score === n ? "Perfect score!" : score >= n * 0.7 ? "Great work!" : "Good effort. The explanations below will help.";

/* ---------------- shared pieces ---------------- */
function ctaBox(s) {
  return `<div class="ctabox"><div><b>Keep going on Google Skills</b><p>${esc(s.course)}: ${esc(s.title)}</p></div>
    <a class="btn" href="${s.courseUrl}" target="_blank" rel="noopener">Complete ${esc(s.course)} on Google Skills <span class="arr">→</span></a></div>`;
}
function explorerBlock(s, jump) {
  if (!s.explore) return "";
  return `<p class="exhead">${esc(s.exploreTitle || "Explore")}</p><div class="ex" style="padding-top:20px"><div data-w="${s.explore}" data-jump="${jump ? 1 : 0}"></div></div>`;
}
/* review list: answers is a function (q, i) => chosen index or undefined */
function reviewHTML(QS, answerOf, mode) {
  return QS.map((q, i) => ({ q, i, mine: answerOf(q, i) })).map(r => ({ ...r, ok: r.mine === r.q.answer }))
    .filter(r => mode === "all" || !r.ok)
    .map(r => `<details class="acc"><summary><span style="color:${r.ok ? "var(--green)" : "var(--red)"};font-size:19px">${r.ok ? "✓" : "✗"}</span><span>Q${r.i + 1}. ${esc(r.q.q)}</span><span class="chev">▾</span></summary>
      <div class="body"><p style="font-size:15.5px;line-height:1.6;margin:16px 0 0"><b>Your answer:</b> ${r.mine == null ? "No answer" : LET[r.mine] + ". " + esc(r.q.options[r.mine])}<br><b>Correct answer:</b> ${LET[r.q.answer]}. ${esc(r.q.options[r.q.answer])}</p>
      <div class="illus" style="margin-top:14px;max-width:560px">${r.q.illus()}</div>${explainHTML(r.q)}</div></details>`).join("")
    || `<p class="pnote">Nothing to review: every answer was correct!</p>`;
}
function wireReview(root, QS, answerOf) {
  let mode = "wrong";
  const draw = () => {
    const wrong = QS.filter((q, i) => answerOf(q, i) !== q.answer).length;
    $("#seg", root).innerHTML = `<button type="button" data-m="wrong" class="${mode === "wrong" ? "on" : ""}">Review wrong (${wrong})</button><button type="button" data-m="all" class="${mode === "all" ? "on" : ""}">All answers</button>`;
    $("#rev", root).innerHTML = reviewHTML(QS, answerOf, mode);
    $$("#seg button", root).forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    mountAll($("#rev", root));
  };
  draw();
}

/* =====================================================================
   HOME: one card per completed live session
   ===================================================================== */
function home() {
  document.title = `${CO.name ? CO.name + " · " : ""}Live Session Quizzes · AI Research Foundations`;
  const cards = SESSIONS.map(s => {
    const st = pstate(s.id), n = s.questions.length;
    const answered = s.questions.filter(q => st.answers[q.id] != null).length;
    const score = s.questions.filter(q => st.answers[q.id] === q.answer).length;
    const done = answered === n;
    const prog = done ? `Your score: <b>${score}/${n}</b>` : answered ? `${answered} of ${n} answered` : `${n} questions · about 20 minutes`;
    const cta = done ? "See your results" : answered ? "Continue" : "Start the quiz";
    const href = `?practice=${s.id}` + (done ? "&q=results" : "");
    return `<article class="qcard"><a class="cvr" href="${href}" tabindex="-1" aria-hidden="true"><img class="cover" src="${s.cover}" alt=""></a>
      <div class="cb"><div class="kick"><span class="pill done">✓ Completed</span><span>${esc(s.label)} · ${esc(s.course)}</span></div>
      <h3>${esc(s.title)}</h3>
      <p class="meta">${esc(s.held)}. Go through it at your own pace: answer each question, then explore the illustrated explanation.</p>
      <div class="prog" aria-hidden="true"><i style="width:${100 * answered / n}%"></i></div><p class="meta">${prog}</p>
      <div class="acts"><a class="btn" href="${href}">${cta} <span class="arr">→</span></a>${answered ? `<button class="btn ghost" type="button" data-restart="${s.id}">Start again</button>` : ""}</div></div></article>`;
  }).join("");
  app.innerHTML = `<div class="home">
    ${STATIC ? `<a class="crumb" href="${HOME}">← All cohorts</a>` : `<div class="brandline"><span class="mark">AI</span>AI Research Foundations</div>`}
    <h1>Live session quizzes</h1>${cohortTag()}
    <p class="lede">Revisit the quizzes from our live sessions. Answer each question yourself, then dig into the explanation: illustrations, animations and the maths behind every idea.</p>
    <div id="livebar"></div>
    <p class="sect">Completed live sessions</p>
    <div class="cards ${SESSIONS.length === 1 ? "one" : ""}">${cards}</div>
    <p class="foot">No sign-in needed. Your answers are saved on this device only.</p></div>`;
  $$("[data-restart]").forEach(b => b.onclick = () => { if (confirm("Start this quiz again? Your saved answers will be cleared.")) { store.del(pkey(b.dataset.restart)); home(); } });
  fetch(API_LIVE, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.live) return;
    const ls = sessionById(j.sid);
    $("#livebar").innerHTML = `<div class="livebar"><span class="rec"></span><div><b>A live quiz is open right now</b><p>${ls ? `${esc(ls.label)}: ${esc(ls.title)}. ` : ""}Join to answer on this device.</p></div><a class="btn" href="${JOIN_URL}">Join the live quiz →</a></div>`;
  }).catch(() => {});
}

/* =====================================================================
   PRACTICE: self-paced, no host
   ===================================================================== */
function practice(sid) {
  const s = SESSIONS.find(x => x.id === sid);
  if (!s) { location.replace(BASE); return; }
  const QS = s.questions, N = QS.length;
  document.title = `${s.title} · Self-paced quiz`;
  let st = pstate(s.id);
  const carried = params.get("a");
  if (carried && !Object.keys(st.answers).length) {
    [...carried].forEach((ch, i) => { if (/^[0-3]$/.test(ch) && QS[i]) st.answers[QS[i].id] = +ch; });
    store.set(pkey(s.id), st);
  }
  const qp = params.get("q");
  let qi = qp === "results" ? N : Math.min(N, Math.max(0, (parseInt(qp, 10) || (st.at || 0) + 1) - 1));
  const save = () => store.set(pkey(s.id), st);

  function go(i, keepScroll) {
    qi = Math.max(0, Math.min(N, i)); st.at = Math.min(qi, N - 1); save();
    try { history.replaceState(null, "", `?practice=${s.id}&q=${qi === N ? "results" : qi + 1}`); } catch (e) {}
    render();
    if (!keepScroll) window.scrollTo(0, 0);
  }
  app.addEventListener("jumpq", e => go(e.detail));
  document.addEventListener("keydown", e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight" && qi < N) go(qi + 1);
    else if (e.key === "ArrowLeft" && qi > 0) go(qi - 1);
    else if (qi < N && st.answers[QS[qi].id] == null && /^[1-4a-dA-D]$/.test(e.key)) answer("1234".includes(e.key) ? +e.key - 1 : "abcd".indexOf(e.key.toLowerCase()));
  });

  const dots = () => QS.map((q, i) => {
    const a = st.answers[q.id], cls = a == null ? "" : a === q.answer ? "ok" : "no";
    return `<button type="button" class="${cls} ${i === qi ? "cur" : ""}" data-go="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`;
  }).join("") + `<button type="button" class="${qi === N ? "cur" : ""}" data-go="${N}" aria-label="Results" style="width:auto;padding:0 10px;border-radius:99px">Results</button>`;
  const top = () => `<div class="topbar"><a class="back" href="${BASE}">← All quizzes</a><span class="title"><span>${esc(s.label)} · ${esc(s.title)}</span></span><div class="dots">${dots()}</div></div>
    <div class="progress"><i style="width:${100 * QS.filter(q => st.answers[q.id] != null).length / N}%"></i></div>`;

  function answer(i) {
    const q = QS[qi]; if (st.answers[q.id] != null) return;
    st.answers[q.id] = i; save(); render();
    const v = $("#verdict"); if (v) v.scrollIntoView({ behavior: MOTION ? "smooth" : "auto", block: "nearest" });
  }

  function render() {
    if (qi >= N) { results(); return; }
    const q = QS[qi], mine = st.answers[q.id], done = mine != null, last = qi === N - 1;
    const opts = q.options.map((o, i) => {
      const cls = done ? (i === q.answer ? "correct" : i === mine ? "wrong" : "dim") : "";
      const mark = done && (i === q.answer || i === mine) ? `<span class="tick">${i === q.answer ? "✓" : "✗"}</span>` : "";
      return `<button type="button" class="opt c${i} ${cls}" data-i="${i}" ${done ? "disabled" : ""}><span class="L">${LET[i]}</span><span class="txt">${esc(o)}</span>${mark}</button>`;
    }).join("");
    const nextBtn = `<button type="button" class="btn" data-go="${qi + 1}">${last ? "See your results" : "Next question"} <span class="arr">→</span></button>`;
    const verdict = !done ? `<p class="pnote">Choose an answer to see the explanation. <button type="button" class="linkbtn" data-go="${qi + 1}" style="display:inline">Skip for now</button></p>`
      : mine === q.answer ? `<div class="verdict ok" id="verdict">✓ Correct! Read on for the full explanation. ${nextBtn}</div>`
      : `<div class="verdict no" id="verdict">✗ Not quite. The answer is ${LET[q.answer]}. Read on to see why. ${nextBtn}</div>`;
    app.innerHTML = `<div class="pv">${top()}
      <p class="qnum">Question ${qi + 1} of ${N}</p>
      <div class="qgrid"><div class="qa"><h2 class="qtext">${esc(q.q)}</h2></div>
        <div class="ia"><div class="illus">${q.illus()}</div></div>
        <div class="oa"><div class="opts">${opts}</div>${verdict}</div></div>
      ${done ? `<p class="exhead">Explanation</p><div class="ex">${explainHTML(q)}</div>` : ""}
      <div class="controls" style="margin-top:26px">${qi > 0 ? `<button type="button" class="btn ghost" data-go="${qi - 1}">← Previous</button>` : ""}<span class="info"></span>${done ? nextBtn : ""}</div></div>`;
    $$(".opt[data-i]").forEach(b => b.onclick = () => answer(+b.dataset.i));
    $$("[data-go]").forEach(b => b.onclick = () => go(+b.dataset.go));
    mountAll(app);
  }

  function results() {
    const score = QS.filter(q => st.answers[q.id] === q.answer).length;
    const answered = QS.filter(q => st.answers[q.id] != null).length;
    app.innerHTML = `<div class="pv">${top()}
      <div class="result"><p class="eyebrow">Your results</p><div class="score">${score}<span>/${N}</span></div>
        <p class="lede" style="margin-top:8px">${answered < N ? `You have answered ${answered} of ${N} questions. <button type="button" class="linkbtn" style="display:inline" data-go="${QS.findIndex(q => st.answers[q.id] == null)}">Answer the rest</button>` : scoreMsg(score, N)}</p></div>
      ${explorerBlock(s, true)}
      ${ctaBox(s)}
      <p class="exhead">Review your answers</p><div class="seg" id="seg"></div><div id="rev"></div>
      <div class="controls" style="margin-top:28px"><button type="button" class="btn ghost" id="again">Start again</button><a class="btn ghost" href="${BASE}">All quizzes</a></div></div>`;
    $$("[data-go]").forEach(b => b.onclick = () => go(+b.dataset.go));
    $("#again").onclick = () => { if (confirm("Start again? Your saved answers will be cleared.")) { st = { answers: {}, at: 0 }; save(); go(0); } };
    mountAll(app);
    wireReview(app, QS, q => st.answers[q.id]);
  }

  go(qi, true);
}

/* =====================================================================
   LIVE: one WebSocket per screen, reconnecting on its own until the session ends
   ===================================================================== */
function live(role, onOpen, onMsg, onStatus, onEnd) {
  let ws = null, timer = null, ping = null, wait = 800, stopped = false;
  function open() {
    if (stopped) return;
    clearTimeout(timer);
    ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws?role=" + role + "&room=" + ROOM);
    ws.onopen = () => { wait = 800; onStatus(true); onOpen(); clearInterval(ping); ping = setInterval(() => { try { ws.send("ping"); } catch (e) {} }, 20000); };
    ws.onmessage = e => { if (e.data === "pong") return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } onMsg(m); };
    ws.onclose = e => {
      clearInterval(ping);
      if (stopped || e.code === 4000 || e.code === 4001) { stopped = true; if (onEnd) onEnd(e.code); return; }   // ended by the presenter: don't reconnect
      onStatus(false); timer = setTimeout(open, wait); wait = Math.min(wait * 1.6, 5000);
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }
  document.addEventListener("visibilitychange", () => { if (!stopped && !document.hidden && (!ws || ws.readyState > 1)) open(); });
  open();
  return {
    send(obj) { try { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } } catch (e) {} return false; },
    stop() { stopped = true; clearTimeout(timer); clearInterval(ping); try { ws && ws.close(1000); } catch (e) {} },
  };
}

/* ---------------- presenter: hidden, only the link with the key works ---------------- */
function hostPicker(K) {
  document.title = "Presenter · Live session quizzes";
  app.innerHTML = `<div class="home"><div class="brandline"><span class="mark">AI</span>AI Research Foundations · Presenter</div>
    <h1>Run a live session</h1>${cohortTag()}<p class="lede">Pick the quiz to present. Participants join at <b>${esc(JOIN_URL.replace(/^https?:\/\//, ""))}</b> or with the QR code in the lobby. Keep this link to yourself: it controls the live session.</p>
    <p class="sect">Live sessions</p><div class="cards">${SESSIONS.map(s => `<article class="qcard"><img class="cover" src="${s.cover}" alt="">
      <div class="cb"><div class="kick"><span>${esc(s.label)} · ${esc(s.course)}</span></div><h3>${esc(s.title)}</h3><p class="meta">${s.questions.length} questions</p>
      <div class="acts"><a class="btn" href="?host=${s.id}&k=${encodeURIComponent(K)}">Present live <span class="arr">→</span></a><a class="btn ghost" href="${PUBLIC_COHORT}?practice=${s.id}" target="_blank" rel="noopener">Preview</a></div></div></article>`).join("")}</div></div>`;
}

function host() {
  const K = params.get("k") || "";
  if (!K) { home(); return; }                                   // no key: this is just the public page
  const sid = params.get("host");
  const s = sessionById(sid);
  if (!s) { hostPicker(K); return; }
  const QS = s.questions, N = QS.length;
  const pickerURL = `?host&k=${encodeURIComponent(K)}`;
  document.title = `Presenter · ${s.title}`;
  let S = { sid, phase: "closed", qi: 0, joined: 0, connected: 0, tallies: {} };
  let online = false, authed = false, shown = "", opened = false;

  const conn = live("host", () => conn.send({ t: "auth", k: K }), m => {
    if (m.t === "denied") { conn.stop(); message("This presenter link isn’t valid", "Use your saved presenter link, or go to the public page.", `<a class="btn" href="${PUBLIC_COHORT}">Go to the live sessions page</a>`); return; }
    if (m.t !== "host") return;
    authed = true; S = m;
    if (S.phase === "closed" && !opened) { opened = true; conn.send({ t: "open", sid }); return; }   // first visit: open the lobby
    if (S.phase !== "closed" && S.sid === sid) opened = true;
    const key = S.sid + ":" + S.phase + ":" + S.qi;
    if (key !== shown) { shown = key; render(); } else refreshCounts();
  }, ok => { online = ok; const st = $("#status"); if (st) st.innerHTML = statusLine(); });

  const counts = qi => S.tallies[qi] || [0, 0, 0, 0];
  const answered = qi => counts(qi).reduce((a, b) => a + b, 0);
  const mine = () => S.sid === sid && S.phase !== "closed";
  const set = (phase, qi) => { if (mine()) conn.send({ t: "set", phase, qi }); };
  const start = () => set("question", 0);
  const reveal = () => { if (mine() && S.phase === "question") set("reveal", S.qi); };
  const next = () => {
    if (!mine()) return;
    if (S.phase === "question") { reveal(); return; }
    if (S.phase === "reveal") S.qi + 1 < N ? set("question", S.qi + 1) : set("end", S.qi);
  };
  const prev = () => { if (mine() && S.phase !== "lobby" && S.qi > 0) set("reveal", S.qi - 1); };
  const reset = () => { if (confirm("Reset the session? This clears all votes and the joined count, and sends everyone back to the lobby.")) conn.send({ t: "reset" }); };
  const endSession = () => { if (confirm("End the live session? Everyone will be disconnected and see a thank-you screen.")) conn.send({ t: "close" }); };

  document.addEventListener("keydown", e => {
    if (!authed || !mine() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (S.phase === "lobby" && e.key === "Enter") start();
    else if (e.key === "r" || e.key === "R") reveal();
    else if (e.key === "ArrowRight" || e.key === "n" || e.key === "N") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === "e" || e.key === "E") { const d = $("#acc"); if (d) d.open = !d.open; }
  });

  const statusLine = () => online ? `<span class="dot on"></span>Live: phones can join` : `<span class="dot"></span>Reconnecting…`;
  function refreshCounts() {
    const j = $("#joinedCount"); if (j) j.textContent = S.joined;
    const a = $("#answered"); if (a) a.textContent = answered(S.qi);
    const c = $("#connected"); if (c) c.textContent = S.connected;
  }
  function message(title, sub, actions) {
    app.innerHTML = `<div class="center"><div class="endcard"><div class="endicon">✓</div><h2>${title}</h2><p>${sub}</p><div class="acts">${actions || ""}</div></div></div>`;
  }

  function render() {
    if (S.phase === "closed") {
      message("Live session ended", `Everyone has been disconnected. ${esc(s.label)}: ${esc(s.title)} stays available on the live sessions page for self-paced review.`,
        `<button class="btn" id="reopen">Open the lobby again</button><a class="btn ghost" href="${pickerURL}">Presenter home</a>`);
      $("#reopen").onclick = () => conn.send({ t: "open", sid });
      return;
    }
    if (S.sid !== sid) {
      const other = sessionById(S.sid);
      message("Another live session is open", `${other ? `${esc(other.label)}: ${esc(other.title)}` : "A different session"} is live right now (${esc(S.phase)}). Switch to ${esc(s.label)}? Phones move to the new quiz and the current votes are cleared.`,
        `<button class="btn" id="switch">Switch to ${esc(s.label)}</button>${other ? `<a class="btn ghost" href="?host=${other.id}&k=${encodeURIComponent(K)}">Go to ${esc(other.label)}</a>` : ""}`);
      $("#switch").onclick = () => { opened = true; conn.send({ t: "open", sid }); };
      return;
    }
    if (S.phase === "lobby") {
      app.innerHTML = `<div class="lobby"><div>
          <p class="eyebrow">${esc(s.label)} · AI Research Foundations</p><h1>${esc(s.title)}</h1>
          <p class="lede">${N} questions · answer on your phone</p>
          <div class="count"><b id="joinedCount">${S.joined}</b><span>participants joined so far</span></div>
          <button class="btn big" id="start">Start the quiz <span class="kbd">Enter</span></button>
          <div class="status" id="status">${statusLine()}</div>
          <div style="display:flex;gap:18px;margin-top:18px;flex-wrap:wrap"><button class="linkbtn" id="reset">Reset session</button><button class="linkbtn" id="end">End live session</button><a class="linkbtn" href="${pickerURL}">Choose another quiz</a></div></div>
        <div class="joinbox"><p class="eyebrow" style="margin-bottom:14px">Scan to join</p><div class="qr" id="qr"></div>
          <div class="url">${esc(JOIN_URL.replace(/^https?:\/\//, ""))}</div></div></div>`;
      $("#start").onclick = start; $("#reset").onclick = reset; $("#end").onclick = endSession;
      drawQR(JOIN_URL);
      return;
    }
    if (S.phase === "end") {
      const rows = QS.map((q, i) => {
        const c = counts(i), n = answered(i), p = n ? Math.round(100 * c[q.answer] / n) : 0;
        return `<div class="srow"><b>Q${i + 1}</b><div class="bar"><i style="width:${p}%"></i></div><span>${n ? p + "%" : "–"}</span></div>`;
      }).join("");
      app.innerHTML = `<div class="pv"><div class="topbar"><span class="title"><span>${esc(s.title)}</span></span><span class="chip"><span id="joinedCount">${S.joined}</span> joined</span></div>
        <p class="qnum">Quiz complete</p><h2 class="qtext">Thank you! Here is how the room did.</h2>
        <p style="color:var(--muted);margin:0">Percentage of answers that were correct, per question</p><div class="summary">${rows}</div>
        ${explorerBlock(s, false)}${ctaBox(s)}
        <div class="endbar"><div><b>Finished presenting?</b><p>Ending the session disconnects everyone and shows them a thank-you screen with a link to review the quiz.</p></div>
          <button class="btn" id="end">End live session</button></div>
        <div class="controls"><span class="info"></span><button class="linkbtn" id="reset">Reset session</button><button class="btn ghost" id="again">Back to the last question</button></div></div>`;
      $("#again").onclick = () => set("reveal", N - 1);
      $("#reset").onclick = reset; $("#end").onclick = endSession;
      mountAll(app);
      return;
    }
    const q = QS[S.qi], rev = S.phase === "reveal", c = counts(S.qi), total = answered(S.qi);
    const opts = q.options.map((o, i) => {
      const pct = total ? Math.round(100 * c[i] / total) : 0, ok = i === q.answer;
      return `<div class="opt c${i} ${rev ? (ok ? "correct" : "dim") : ""}"><div class="fill" data-w="${rev ? pct : 0}"></div>
        <span class="L">${LET[i]}</span><span class="txt">${esc(o)}</span>
        ${rev ? `${ok ? '<span class="tick">✓</span>' : ""}<span class="pct">${pct}%<small>${c[i]} vote${c[i] === 1 ? "" : "s"}</small></span>` : ""}</div>`;
    }).join("");
    app.innerHTML = `<div class="pv"><div class="topbar"><span class="title"><span>${esc(s.title)}</span></span>
        <span class="chip">Question ${S.qi + 1} of ${N}</span><span class="chip"><span id="connected">${S.connected}</span> connected</span>
        <span class="chip" id="status" style="border:0;background:transparent;padding:0">${statusLine()}</span></div>
      <div class="progress"><i style="width:${100 * (S.qi + (rev ? 1 : 0.5)) / N}%"></i></div>
      <p class="qnum">Question ${S.qi + 1}</p>
      <div class="qgrid"><div class="qa"><h2 class="qtext">${esc(q.q)}</h2></div><div class="ia"><div class="illus">${q.illus()}</div></div>
        <div class="oa"><div class="opts">${opts}</div>
        <div class="controls"><span class="info"><b id="answered">${total}</b> answered</span>
          ${S.qi > 0 ? '<button class="btn ghost" id="prev">Back</button>' : ""}
          ${rev ? `<button class="btn" id="next">${S.qi + 1 < N ? "Next question" : "Finish"} <span class="kbd">→</span></button>` : `<button class="btn" id="reveal">Reveal answer <span class="kbd">R</span></button>`}</div></div></div>
      ${rev ? `<details class="acc" id="acc"><summary>Show explanation <span class="kbd">E</span><span class="chev">▾</span></summary><div class="body">${explainHTML(q)}</div></details>` : ""}</div>`;
    if (rev) {
      requestAnimationFrame(() => $$(".fill").forEach(f => f.style.width = f.dataset.w + "%"));
      $("#next").onclick = next;
      const d = $("#acc"); d.addEventListener("toggle", () => { if (d.open) setTimeout(() => d.scrollIntoView({ behavior: "smooth", block: "start" }), 60); });
    } else $("#reveal").onclick = reveal;
    const p = $("#prev"); if (p) p.onclick = prev;
    mountAll(app);
  }

  function drawQR(text) {
    const box = $("#qr"); if (!box) return;
    if (typeof qrcode !== "function") { box.innerHTML = '<p style="max-width:240px;color:var(--muted)">QR code unavailable. Share the link below.</p>'; return; }
    const qr = qrcode(0, "M"); qr.addData(text); qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
  }
  app.innerHTML = `<div class="center"><div class="wait"><div><div class="pulse"></div><h2>Connecting…</h2></div></div></div>`;
}

/* ---------------- phones in a live session ---------------- */
function liveParticipant() {
  document.title = "Live quiz · AI Research Foundations";
  let pid = store.get("airf-quiz-pid", null);
  if (!pid) { pid = "p" + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set("airf-quiz-pid", pid); }
  const myKey = "airf-live-" + ROOM;                              // { sid, at: { questionIndex: choice } }
  let mine = store.get(myKey, null);
  if (!mine || typeof mine !== "object" || !mine.at) mine = { sid: null, at: {} };
  const saveMine = () => store.set(myKey, mine);
  let S = null, online = false, shown = "", wasLive = false, over = false;
  const sess = () => sessionById(S && S.sid) || sessionById(mine.sid) || SESSIONS[SESSIONS.length - 1];

  const shell = inner => { app.innerHTML = `<div class="phone"><div class="pbar"><span>${esc(sess().title)}</span><span>${online || over ? "" : '<span class="dot"></span>Reconnecting…'}</span></div>${inner}</div>`; mountAll(app); };
  const waitScreen = (title, sub) => shell(`<div class="wait"><div><div class="pulse"></div><h2>${title}</h2><p>${sub}</p></div></div>`);

  function render() {
    if (!S) { waitScreen("Connecting…", "Joining the session"); return; }
    if (S.phase === "lobby") { waitScreen("You’re in!", "Waiting for the host to start the quiz."); return; }
    if (S.phase === "end") { results(); return; }
    const QS = sess().questions, q = QS[S.qi]; if (!q) { waitScreen("Hang on…", "The next question is on its way."); return; }
    const rev = S.phase === "reveal", my = S.mine;
    const opts = q.options.map((o, i) => {
      let cls = "";
      if (rev) cls = i === q.answer ? "correct" : i === my ? "wrong" : "dim";
      else if (i === my) cls = "sel";
      const mark = rev && (i === q.answer || i === my) ? `<span class="tick">${i === q.answer ? "✓" : "✗"}</span>` : "";
      return `<button type="button" class="opt c${i} ${cls}" data-i="${i}" ${rev ? "disabled" : ""}><span class="L">${LET[i]}</span><span class="txt">${esc(o)}</span>${mark}</button>`;
    }).join("");
    const foot = rev
      ? (my == null ? `<div class="verdict none">The answer was ${LET[q.answer]}</div>` : my === q.answer ? `<div class="verdict ok">✓ Correct!</div>` : `<div class="verdict no">✗ Not quite. The answer was ${LET[q.answer]}</div>`)
        + `<details class="acc"><summary>Show explanation<span class="chev">▾</span></summary><div class="body">${explainHTML(q)}</div></details>`
      : `<p class="pnote">${my == null ? "Tap an answer" : "Answer sent. You can change it until the host reveals."}</p>`;
    shell(`<p class="pq">Q${S.qi + 1}. ${esc(q.q)}</p><div class="opts">${opts}</div>${foot}
      <details class="acc"><summary>See the illustration<span class="chev">▾</span></summary><div class="body"><div class="illus" style="margin-top:14px;border:0;padding:0">${q.illus()}</div></div></details>`);
    if (!rev) $$(".opt[data-i]").forEach(b => b.onclick = () => vote(+b.dataset.i));
  }
  function vote(i) {
    if (!S || S.phase !== "question") return;
    S.mine = i; mine.at[S.qi] = i; saveMine();
    $$(".opt[data-i]").forEach(b => b.classList.toggle("sel", +b.dataset.i === i));
    const n = $(".pnote"); if (n) n.textContent = "Answer sent. You can change it until the host reveals.";
    conn.send({ t: "vote", qi: S.qi, choice: i });
  }
  const score = s => s.questions.filter((q, i) => mine.at[i] === q.answer).length;
  function results() {
    const s = sess();
    shell(`<div class="result"><p class="eyebrow">Quiz complete</p><div class="score">${score(s)}<span>/${s.questions.length}</span></div><p class="lede" style="margin-top:8px">${scoreMsg(score(s), s.questions.length)}</p></div>
      ${ctaBox(s)}${explorerBlock(s, false)}
      <p class="exhead">Review your answers</p><div class="seg" id="seg"></div><div id="rev"></div>
      <p class="pnote" style="margin-top:24px"><a href="${PUBLIC_COHORT}">See all live session quizzes</a></p>`);
    wireReview(app, s.questions, (q, i) => mine.at[i]);
  }
  /* the presenter ended the session (or there is none): stop and say thank you */
  function ended() {
    over = true; conn && conn.stop();
    const s = sessionById(mine.sid), answered = s ? Object.keys(mine.at).length : 0;
    // the self-paced quiz lives on airf.aims.ac.za: carry the live answers over in the link
    const carry = s && answered ? "&q=results&a=" + s.questions.map((q, i) => mine.at[i] != null ? mine.at[i] : "x").join("") : "";
    const pq = s ? `${PUBLIC_COHORT}?practice=${s.id}${carry}` : PUBLIC_COHORT;
    app.innerHTML = `<div class="phone"><div class="center" style="min-height:80vh;padding:0"><div class="endcard">
      <div class="endicon">${wasLive ? "✓" : "i"}</div>
      <h2>${wasLive ? "This live session has ended" : "No live session right now"}</h2>
      <p>${wasLive ? `Thank you for joining${s ? ` ${esc(s.label)}: ${esc(s.title)}` : ""}!${s && answered ? ` You scored <b>${score(s)}/${s.questions.length}</b>.` : ""}` : "There isn’t a live quiz running at the moment. You can go through past live sessions at your own pace."}</p>
      <div class="acts" style="flex-direction:column">${s && (wasLive || answered) ? `<a class="btn" href="${pq}">${answered ? "Review your answers" : "Go through it again"} <span class="arr">→</span></a>` : ""}
        <a class="btn ${s && (wasLive || answered) ? "ghost" : ""}" href="${PUBLIC_COHORT}">See all live sessions</a></div></div></div></div>`;
  }

  const conn = live("player", () => conn.send({ t: "join", pid }), m => {
    if (m.t !== "state") return;
    if (m.phase === "closed") { ended(); return; }
    if (mine.sid !== m.sid) { mine = { sid: m.sid, at: {} }; saveMine(); }                   // a new live session
    if (m.phase === "lobby" && S && S.phase !== "lobby" && S.sid === m.sid) { mine.at = {}; saveMine(); }   // the host reset it
    wasLive = true;
    const before = S; S = m;
    if (S.mine != null) { mine.at[S.qi] = S.mine; saveMine(); }
    const key = S.sid + ":" + S.phase + ":" + S.qi;
    // a vote echo for the same screen only updates the selection, so an open explanation or scroll position is kept
    if (key === shown && before && S.phase === "question") { $$(".opt[data-i]").forEach(b => b.classList.toggle("sel", +b.dataset.i === S.mine)); return; }
    shown = key; render();
  }, ok => { if (over) return; const was = online; online = ok; if (S && was !== ok) { const b = $(".pbar span:last-child"); if (b) b.innerHTML = ok ? "" : '<span class="dot"></span>Reconnecting…'; } },
  () => { if (!over) ended(); });

  render();
}

/* =====================================================================
   Route: /?practice=… self-paced · /?live phones · /?host=…&k=… presenter (hidden) · / home
   ===================================================================== */
function cohortIndex() {
  document.title = "Live Sessions · AI Research Foundations";
  const list = Object.entries(ALL_COHORTS);
  const n = c => Object.keys(c.sessions || {}).length;
  app.innerHTML = `<div class="home">
    <h1>Live sessions</h1>
    <p class="lede">${SLUG && !CO ? "We couldn’t find that cohort. " : ""}Before each workshop, cohorts join live online sessions on the Google Skills courses, with a live quiz in every session. Open your cohort to go through the quizzes at your own pace, with illustrated explanations.</p>
    <p class="sect">Cohorts</p><div class="cards">${list.map(([slug, c]) => `<article class="qcard">
      <a class="cvr cohortcover" href="${HOME}cohort/${slug}/" tabindex="-1" aria-hidden="true"><span class="cflag">${c.flag || ""}</span><span class="cname">${esc(c.name)}</span><span class="csub">${n(c)} live sessions</span></a>
      <div class="cb"><div class="kick"><span class="pill done">✓ ${n(c)} completed</span></div><h3>${esc(c.name)}</h3>
      <p class="meta">${esc(c.blurb || `${n(c)} live session quizzes to revisit at your own pace.`)}</p>
      <div class="acts"><a class="btn" href="${HOME}cohort/${slug}/">Open <span class="arr">→</span></a></div></div></article>`).join("")}</div></div>`;
}

const cohortSlugs = Object.keys(ALL_COHORTS);
if (STATIC) {
  // airf.aims.ac.za: plain pages. Live links are forwarded to the Worker, which runs the live quiz.
  if (CO && (params.has("live") || params.has("host"))) location.replace(LIVE_BASE + location.search);
  else if (LQ.view === "cohorts" || !CO) cohortIndex();
  else if (params.get("practice")) practice(params.get("practice"));
  else home();
} else {
  // the Worker: live quizzes only. Old links (/, /?live, /?host…) still work while there is one cohort.
  if (!CO) {
    if (!SLUG && cohortSlugs.length === 1 && (params.has("live") || params.has("host"))) location.replace(`/cohort/${cohortSlugs[0]}` + location.search);
    else location.replace(LQ.publicSite);
  }
  else if (params.has("host")) host();
  else if (params.has("live")) liveParticipant();
  else location.replace(PUBLIC_COHORT + location.search);   // self-paced quizzes live on airf.aims.ac.za
}
