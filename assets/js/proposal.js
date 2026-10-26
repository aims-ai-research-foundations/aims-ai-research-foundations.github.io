/* Capstone proposal form: steps, checks, autosave, review, saving to Google Sheets
   (via an Apps Script web app), Word download and the closing animation. */
(function () {
  "use strict";
  var app = document.querySelector("[data-proposal]");
  if (!app) return;

  var KEY = "airf-capstone-proposal-v1";
  var endpoint = (app.getAttribute("data-endpoint") || "").trim();
  var strict = app.getAttribute("data-require") !== "false"; // false: every question can be skipped
  var editBase = (app.getAttribute("data-edit-base") || "").trim() || location.origin + location.pathname;
  var form = app.querySelector(".pp-form");
  var steps = [].slice.call(form.querySelectorAll(".pp-step"));
  var rail = [].slice.call(form.querySelectorAll(".pp-rail-btn"));
  var last = steps.length - 1;
  var screens = {};
  [].forEach.call(app.querySelectorAll("[data-screen]"), function (el) { screens[el.dataset.screen] = el; });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || app).querySelector(sel); };
  var state = { step: 0, max: 0, id: "", token: "", submittedAt: "", emailed: false };

  /* ---------- Reading and writing answers ---------- */
  function q(name) { return form.querySelectorAll('[name="' + name.replace(/"/g, '\\"') + '"]'); }

  function collect() {
    var data = {};
    [].forEach.call(form.querySelectorAll("[name]"), function (el) {
      var n = el.name;
      if (el.type === "checkbox") {
        if (q(n).length > 1) { data[n] = data[n] || []; if (el.checked) data[n].push(el.value); }
        else data[n] = el.checked ? el.value : "";
      } else if (el.type === "radio") {
        if (!(n in data)) data[n] = "";
        if (el.checked) data[n] = el.value;
      } else {
        data[n] = el.value.trim();
      }
    });
    return data;
  }

  /* ---------- Add / remove cards (team members, stakeholders) ---------- */
  var repeaters = [].map.call(form.querySelectorAll("[data-repeat]"), function (box) {
    var id = box.dataset.repeat;
    var r = { id: id, box: box, item: box.dataset.item, min: +box.dataset.min || 0, max: +box.dataset.max || 3,
      tpl: form.querySelector('[data-repeat-tpl="' + id + '"]'), add: form.querySelector('[data-repeat-add="' + id + '"]') };
    r.add.addEventListener("click", function () { addItem(r, true); refresh(); store(); });
    box.addEventListener("click", function (e) {
      var x = e.target.closest("[data-remove]");
      if (!x) return;
      var item = x.closest("[data-item]"), prev = item.previousElementSibling;
      item.remove();
      renumber(r); refresh(); store();
      if (!r.add.hidden) r.add.focus(); else if (prev) prev.querySelector("input").focus();
    });
    return r;
  });
  function renumber(r) {
    var items = r.box.querySelectorAll("[data-item]");
    [].forEach.call(items, function (b, i) {
      var label = r.item + " " + (i + 1);
      b.querySelector("[data-item-title]").textContent = label;
      [].forEach.call(b.querySelectorAll("[data-key]"), function (el) {
        el.name = r.id + "." + i + "." + el.dataset.key;
        if (el.type !== "radio") el.setAttribute("aria-label", label + ": " + (el.dataset.label || el.dataset.key));
      });
      [].forEach.call(b.querySelectorAll("[data-key-group]"), function (g) { g.setAttribute("aria-label", label + ": " + g.dataset.keyGroup); });
      var x = b.querySelector("[data-remove]");
      x.setAttribute("aria-label", "Remove " + label.toLowerCase());
      x.hidden = items.length <= r.min;
    });
    r.add.hidden = items.length >= r.max;
  }
  function addItem(r, focus) {
    if (r.box.querySelectorAll("[data-item]").length >= r.max) return;
    var node = r.tpl.content.firstElementChild.cloneNode(true);
    r.box.appendChild(node);
    renumber(r);
    if (!reduce && focus) node.classList.add("is-new");
    if (focus) node.querySelector("input").focus();
  }
  function setItems(r, n) {
    r.box.innerHTML = "";
    for (var i = 0; i < Math.min(Math.max(n, r.min), r.max); i++) addItem(r, false);
    renumber(r);
  }
  repeaters.forEach(function (r) { setItems(r, 0); });
  function rows(d, id, keys) {
    var out = [];
    for (var i = 0; i < 20; i++) {
      var o = {}, any = false;
      keys.forEach(function (k) { o[k] = d[id + "." + i + "." + k] || ""; if (o[k]) any = true; });
      if (any) out.push(o);
    }
    return out;
  }
  function members(d) { return rows(d, "members", ["name", "email", "university", "role"]); }
  function stakeholders(d) { return rows(d, "stakeholders", ["group", "matters", "risks", "power", "engage"]); }

  function fill(data) {
    repeaters.forEach(function (r) {
      var count = 0, re = new RegExp("^" + r.id + "\\.(\\d+)\\.");
      Object.keys(data || {}).forEach(function (k) { var m = re.exec(k); if (m && data[k]) count = Math.max(count, +m[1] + 1); });
      setItems(r, count);
    });
    Object.keys(data || {}).forEach(function (n) {
      var v = data[n];
      var group = q(n);
      if (group.length > 1 && group[0].type === "checkbox" && typeof v === "string") v = v ? v.split(" | ") : [];
      [].forEach.call(group, function (el) {
        if (el.type === "checkbox") el.checked = Array.isArray(v) ? v.indexOf(el.value) > -1 : v === el.value;
        else if (el.type === "radio") el.checked = el.value === v;
        else el.value = v == null ? "" : v;
      });
    });
    refresh();
  }

  function store() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ data: collect(), step: state.step, max: state.max, id: state.id,
        token: state.token, submittedAt: state.submittedAt, emailed: state.emailed, savedAt: Date.now() }));
      var s = $("[data-saved]");
      if (s) s.textContent = "Saved on this device";
    } catch (e) { /* storage blocked: the form still works, it just won't remember */ }
  }
  function restore() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }

  /* ---------- Helpers ---------- */
  function words(s) { s = (s || "").trim(); return s ? s.split(/\s+/).length : 0; }
  function labelOf(fd) {
    var l = fd.querySelector(".pp-label");
    if (!l) return fd.dataset.type === "check" ? "Licence and consent" : "";
    var c = l.cloneNode(true);
    [].forEach.call(c.querySelectorAll(".pp-opt"), function (o) { o.remove(); });
    return c.textContent.trim();
  }
  function optionLabel(name, value) {
    var el = [].filter.call(q(name), function (e) { return e.value === value; })[0];
    if (!el) return value;
    var lab = el.closest("label");
    var t = lab && (lab.querySelector(".pp-card-t") || lab.querySelector("span"));
    return t ? t.textContent.trim() : value;
  }
  function cohortInfo() {
    var sel = form.querySelector('select[name="cohort"]');
    var o = sel && sel.selectedOptions[0];
    if (!o || !o.value) return null;
    return { id: o.value, name: o.textContent.trim(), flag: o.dataset.flag, country: o.dataset.country,
      deadline: o.dataset.deadline, deadlineLabel: o.dataset.deadlineLabel };
  }
  function deadlinePassed() {
    var c = cohortInfo();
    if (!c || !c.deadline) return false;
    return Date.now() > new Date(c.deadline + "T23:59:59").getTime();
  }
  function notice(html, kind) {
    var n = $("[data-notice]");
    if (!html) { n.hidden = true; n.innerHTML = ""; return; }
    n.className = "pp-notice" + (kind ? " is-" + kind : "");
    n.innerHTML = html;
    n.hidden = false;
  }

  /* ---------- Live updates: conditional questions, "Other" boxes, selected styles, word counts ---------- */
  function refresh() {
    var d = collect();
    [].forEach.call(form.querySelectorAll("[data-show-field]"), function (fd) {
      var v = d[fd.dataset.showField];
      var want = fd.dataset.showValues.split(",");
      var vals = Array.isArray(v) ? v : [v];
      fd.hidden = !vals.some(function (x) { return want.indexOf(x) > -1; });
    });
    [].forEach.call(form.querySelectorAll("[data-other]"), function (cb) {
      var box = form.querySelector('[name="' + cb.name + 'Other"]');
      if (box) box.hidden = !cb.checked;
    });
    [].forEach.call(form.querySelectorAll(".pp-card, .pp-chip, .pp-check"), function (l) {
      var i = l.querySelector("input");
      l.classList.toggle("is-on", !!(i && i.checked));
    });
    [].forEach.call(form.querySelectorAll("[data-words]"), function (fd) {
      var max = +fd.dataset.words, el = fd.querySelector("[data-count]");
      var input = fd.querySelector("input.pp-input, textarea");
      if (!el || !input) return;
      var n = words(input.value);
      el.textContent = n + " / " + max + " words";
      el.classList.toggle("is-over", n > max);
    });
  }

  /* ---------- Checks ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function check(fd, d) {
    var t = fd.dataset.type, name = fd.dataset.field, req = strict && fd.hasAttribute("data-required");
    var v = d[name], max = strict ? +fd.dataset.words || 0 : 0;
    if (t === "members") {
      var ms = members(d);
      for (var mi = 0; mi < ms.length; mi++) {
        if (strict && !ms[mi].name) return "Please add a name for team member " + (mi + 1) + ", or remove them.";
        if (ms[mi].email && !EMAIL.test(ms[mi].email)) return "Please check team member " + (mi + 1) + "'s email address.";
      }
      return "";
    }
    if (t === "email") {
      if (req && !v) return "Please enter your email address.";
      return v && !EMAIL.test(v) ? "Please check your email address." : "";
    }
    if (t === "stakeholders") {
      if (!strict) return "";
      var sh = stakeholders(d);
      for (var si = 0; si < sh.length; si++) {
        if (!sh[si].group || !sh[si].matters || !sh[si].power) return "Please complete stakeholder " + (si + 1) + ": who they are, what matters to them, and their power.";
      }
      return req && sh.length < 2 ? "Please add at least 2 stakeholder groups." : "";
    }
    if (t === "example") return req && (!d.exampleIn || !d.exampleOut) ? "Please add one example input and the output you expect." : "";
    if (t === "pitch") return req && (!d.pitchWhat || !d.pitchWho || !d.pitchWhy) ? "Please fill in all three blanks." : "";
    if (t === "chips") {
      v = v || [];
      if (req && !v.length) return "Please choose at least one option.";
      if (v.indexOf("other") > -1 && !d[name + "Other"]) return "Please tell us what “Other” is.";
      return "";
    }
    if (t === "cards" || t === "choice") return req && !v ? "Please choose one option." : "";
    if (t === "check") return req && !v ? "Please confirm this to continue." : "";
    if (t === "number") {
      if (req && !v) return "Please enter a number.";
      return v && !(+v > 0) ? "Please enter a number above 0." : "";
    }
    if (req && !v) return t === "cohort" ? "Please choose your cohort." : "Please answer this question.";
    if (max && words(v) > max) return "Please keep this to " + max + " words or fewer.";
    return "";
  }
  function validate(i, focus) {
    var d = collect(), first = null;
    [].forEach.call(steps[i].querySelectorAll(".pp-field"), function (fd) {
      var msg = fd.hidden ? "" : check(fd, d);
      fd.classList.toggle("has-error", !!msg);
      fd.querySelector(".pp-error").textContent = msg;
      if (msg && !first) first = fd;
    });
    if (first && focus) {
      first.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      var t = first.querySelector("input:not([type=radio]):not([type=checkbox]), textarea, select") || first.querySelector("input");
      if (t) t.focus({ preventScroll: true });
    }
    return !first;
  }

  /* ---------- Steps ---------- */
  function show(i) {
    state.step = i;
    if (i > state.max) state.max = i;
    steps.forEach(function (s, k) {
      s.hidden = k !== i;
      if (k === i && !reduce) { s.classList.remove("is-in"); void s.offsetWidth; s.classList.add("is-in"); }
    });
    rail.forEach(function (b, k) {
      b.disabled = k > state.max;
      b.classList.toggle("is-current", k === i);
      b.classList.toggle("is-done", k < i || (k <= state.max && k !== i));
      if (k === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    $("[data-bar]").style.width = Math.round((i / steps.length) * 100) + "%";
    $("[data-left]").textContent = "Step " + (i + 1) + " of " + steps.length + " · " + steps[i].dataset.title;
    $("[data-next]").hidden = i === last;
    $("[data-submit]").hidden = i !== last;
    if (i === last) review();
    store();
    var top = app.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.4) app.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  function screen(name) {
    Object.keys(screens).forEach(function (k) { screens[k].hidden = k !== name; });
  }

  /* ---------- Review: every answer, grouped by step, with Edit buttons ---------- */
  function answerText(fd, d) {
    var t = fd.dataset.type, n = fd.dataset.field, v = d[n];
    if (t === "cohort") { var c = cohortInfo(); return c ? c.name : ""; }
    if (t === "cards" || t === "choice") return v ? optionLabel(n, v) : "";
    if (t === "chips") {
      return (v || []).map(function (x) { return x === "other" ? (d[n + "Other"] || "Other") : optionLabel(n, x); }).join(", ");
    }
    if (t === "members") return members(d).map(function (m) { return [m.name, m.role && "(" + m.role + ")", m.university, m.email].filter(Boolean).join(", ").replace(", (", " ("); }).join("\n");
    if (t === "example") return d.exampleIn || d.exampleOut ? "Input: " + d.exampleIn + "\nOutput: " + d.exampleOut : "";
    if (t === "stakeholders") {
      return stakeholders(d).map(function (s) {
        return [s.group + (s.power ? " (" + s.power + " power)" : ""), s.matters && "Matters to them: " + s.matters,
          s.risks && "Risks: " + s.risks, s.engage && "How we'll involve them: " + s.engage].filter(Boolean).join(". ");
      }).join("\n");
    }
    if (t === "pitch") return pitch(d);
    return v || "";
  }
  function pitch(d) {
    return d.pitchWhat || d.pitchWho || d.pitchWhy ? "We are building " + d.pitchWhat + " for " + d.pitchWho + " so that " + d.pitchWhy + "." : "";
  }
  function review() {
    var box = $("[data-review]"), d = collect();
    box.innerHTML = "";
    var h = document.createElement("p");
    h.className = "pp-label";
    h.textContent = "Your answers";
    box.appendChild(h);
    steps.slice(0, last).forEach(function (s, i) {
      var sec = document.createElement("section");
      sec.className = "pp-rv";
      var head = document.createElement("div");
      head.className = "pp-rv-head";
      var t = document.createElement("h3");
      t.textContent = (i + 1) + ". " + s.dataset.title;
      var b = document.createElement("button");
      b.type = "button"; b.className = "pp-rv-edit"; b.textContent = "Edit";
      b.setAttribute("aria-label", "Edit " + s.dataset.title);
      b.addEventListener("click", function () { show(i); });
      head.appendChild(t); head.appendChild(b); sec.appendChild(head);
      var dl = document.createElement("dl");
      [].forEach.call(s.querySelectorAll(".pp-field"), function (fd) {
        if (fd.hidden) return;
        var dt = document.createElement("dt"), dd = document.createElement("dd"), a = answerText(fd, d);
        dt.textContent = labelOf(fd);
        var req = strict && fd.hasAttribute("data-required");
        dd.textContent = a || (req ? "Not answered yet" : "Not answered");
        if (!a) dd.className = req ? "is-empty" : "is-skipped";
        dl.appendChild(dt); dl.appendChild(dd);
      });
      sec.appendChild(dl);
      box.appendChild(sec);
    });
    var dl2 = document.createElement("button");
    dl2.type = "button"; dl2.className = "pp-rv-draft";
    dl2.textContent = "Download a draft (.docx)";
    dl2.addEventListener("click", function () { download(dl2); });
    box.appendChild(dl2);
  }

  /* ---------- Submit ---------- */
  function submitAll() {
    for (var i = 0; i < steps.length; i++) {
      if (!validate(i, false)) { show(i); validate(i, true); return; }
    }
    var c = cohortInfo();
    if (deadlinePassed()) {
      notice("The proposal deadline for your cohort (" + (c.deadlineLabel || c.deadline) + ") has passed, so it can no longer be submitted. You can still download it as a Word document from the review below.", "warn");
      return;
    }
    var btn = $("[data-submit]");
    var d = collect();
    if (!endpoint) { state.submittedAt = new Date().toISOString(); store(); finish(false); return; }
    btn.disabled = true; btn.classList.add("is-busy");
    fetch(endpoint, { method: "POST", body: JSON.stringify({ action: "save", id: state.id, token: state.token, data: d,
      sheet: sheetRows(d), editBase: editBase }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "Save failed");
        state.id = res.id; state.token = res.token; state.emailed = !!res.emailed;
        state.submittedAt = new Date().toISOString();
        store(); finish(true);
      })
      .catch(function () {
        notice("We couldn't reach the server, so your proposal wasn't submitted yet. Your answers are safe on this device. Please check your connection and try again.", "error");
      })
      .then(function () { btn.disabled = false; btn.classList.remove("is-busy"); });
  }
  /* One readable column per question for the Google Sheet: heading = the question, value = the answer as shown in the review. */
  var WIDE = ["textarea", "members", "stakeholders", "example", "pitch"];
  function sheetRows(d) {
    return [].map.call(form.querySelectorAll(".pp-field"), function (fd) {
      var key = fd.dataset.field, t = fd.dataset.type;
      if (t === "pitch") return { key: "pitch", label: "Elevator pitch", value: pitch(d), wide: true };
      var v = fd.hidden ? "" : answerText(fd, d);
      if (t === "cohort") { var c = cohortInfo(); v = c ? c.name.replace(c.flag || "", "").trim() : ""; }
      return { key: key, label: labelOf(fd), value: v, wide: WIDE.indexOf(t) > -1 };
    });
  }
  function editLink() { return state.id ? editBase + "?edit=" + state.id + "." + state.token : ""; }

  function finish(saved) {
    notice("");
    screen("done");
    var c = cohortInfo() || {}, d = collect();
    var place = $("[data-build]");
    place.innerHTML = "";
    var flag = document.createElement("span"); flag.className = "pp-build-flag"; flag.textContent = c.flag || "🌍";
    var name = document.createElement("span"); name.className = "pp-build-name"; name.textContent = c.country || "Africa";
    place.appendChild(flag); place.appendChild(name);
    $("[data-done-project]").textContent = (d.title ? "“" + d.title + "”" : "") + (d.teamName ? " by " + d.teamName : "");
    var note = $("[data-done-note]"), copy = $("[data-copy]"), out = $("[data-link-out]");
    if (saved) {
      note.textContent = "Your proposal is saved. Use your private edit link to make changes until " + (c.deadlineLabel || "your deadline") + "." + (state.emailed ? " We've also emailed it to you." : "");
      copy.hidden = false;
      out.textContent = editLink();
    } else {
      note.textContent = "Preview mode: saving to Google Sheets isn't switched on yet, so your answers are kept on this device only.";
      copy.hidden = true;
      out.textContent = "";
    }
    screens.done.classList.remove("is-play"); void screens.done.offsetWidth; screens.done.classList.add("is-play");
    app.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    $("[data-done-title]").focus({ preventScroll: true });
    if (!reduce) confetti($("[data-confetti]"));
  }

  /* ---------- Confetti (brand colours, plays once) ---------- */
  function confetti(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var w = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    var h = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    var cols = ["#FDD633", "#361A54", "#7A3FB0", "#F28C6A", "#3BB3A8", "#E9B90F"];
    var bits = [];
    for (var i = 0; i < 140; i++) {
      bits.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.32, vx: (Math.random() - 0.5) * w * 0.022, vy: -Math.random() * h * 0.03 - h * 0.006,
        r: (Math.random() * 6 + 4) * (window.devicePixelRatio || 1), a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: cols[i % cols.length] });
    }
    var start = performance.now();
    (function frame(t) {
      var el = t - start;
      ctx.clearRect(0, 0, w, h);
      bits.forEach(function (b) {
        b.vy += h * 0.0009; b.x += b.vx; b.y += b.vy; b.a += b.va; b.vx *= 0.99;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
        ctx.globalAlpha = Math.max(0, 1 - el / 3200);
        ctx.fillStyle = b.c; ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2);
        ctx.restore();
      });
      if (el < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    })(start);
  }

  /* ---------- Word document ---------- */
  var docxLoading = null;
  function loadDocx() {
    if (window.docx) return Promise.resolve(window.docx);
    if (!docxLoading) {
      docxLoading = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = app.dataset.docx; s.async = true;
        s.onload = function () { window.docx ? ok(window.docx) : fail(new Error("docx not available")); };
        s.onerror = function () { docxLoading = null; fail(new Error("Could not load the Word library")); };
        document.head.appendChild(s);
      });
    }
    return docxLoading;
  }
  function download(btn) {
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = "Preparing your document…";
    loadDocx().then(function (D) { return D.Packer.toBlob(buildDoc(D, collect())); })
      .then(function (blob) {
        var d = collect();
        var slug = (d.teamName || d.name || d.title || "proposal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "capstone-proposal-" + slug + ".docx";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        btn.textContent = "Downloaded ✓";
        setTimeout(function () { btn.textContent = label; }, 2500);
      })
      .catch(function () { btn.textContent = "Couldn't create the document. Try again"; setTimeout(function () { btn.textContent = label; }, 3000); })
      .then(function () { btn.disabled = false; });
  }

  function buildDoc(D, d) {
    var P = "361A54", P2 = "4D2670", GD = "B4870F", GREY = "5C5168", LINE = "D9CFE8";
    var fields = {};
    [].forEach.call(form.querySelectorAll(".pp-field"), function (fd) { fields[fd.dataset.field] = fd; });
    var txt = function (name) { var fd = fields[name]; return fd && !fd.hidden ? answerText(fd, d) : ""; };
    var lab = function (name) { return fields[name] ? labelOf(fields[name]) : name; };
    var run = function (text, o) { return new D.TextRun(Object.assign({ text: text }, o || {})); };
    var para = function (children, o) { return new D.Paragraph(Object.assign({ children: children }, o || {})); };
    var lines = function (s, o) {
      return String(s).split("\n").map(function (line, i) { return run(line, Object.assign({ break: i ? 1 : 0 }, o || {})); });
    };
    var qa = function (name, label) {
      var a = txt(name);
      if (fields[name] && fields[name].hidden) return [];
      if (!a && fields[name] && !fields[name].hasAttribute("data-required")) return [];
      return [
        para([run(label || lab(name), { bold: true, color: P2, size: 20 })], { spacing: { before: 160, after: 40 }, keepNext: true }),
        para(a ? lines(a) : [run("Not answered", { italics: true, color: GREY })], { spacing: { after: 80 } })
      ];
    };
    var border = { style: D.BorderStyle.SINGLE, size: 4, color: LINE };
    var cell = function (text, head, width) {
      return new D.TableCell({
        width: width ? { size: width, type: D.WidthType.PERCENTAGE } : undefined,
        shading: head ? { type: D.ShadingType.CLEAR, color: "auto", fill: P } : undefined,
        margins: { top: 90, bottom: 90, left: 130, right: 130 },
        children: [para(lines(text || "", { bold: head, color: head ? "FFFFFF" : "1A1A1A", size: head ? 19 : 21 }))]
      });
    };
    var table = function (head, rows, widths) {
      return new D.Table({
        width: { size: 100, type: D.WidthType.PERCENTAGE },
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: [new D.TableRow({ tableHeader: true, children: head.map(function (h, i) { return cell(h, true, widths[i]); }) })]
          .concat(rows.map(function (r) { return new D.TableRow({ children: r.map(function (c, i) { return cell(c, false, widths[i]); }) }); }))
      });
    };
    var h1 = function (text) { return para([run(text)], { heading: D.HeadingLevel.HEADING_1 }); };
    var c = cohortInfo() || {};
    var today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    var meta = [["Cohort", (c.name || "").replace(c.flag || "", "").trim()], ["Submitted by", [d.name, d.role, d.university].filter(Boolean).join(", ")], ["Team", d.teamName || ""], ["Team members", members(d).map(function (m) { return [m.name, m.role, m.university].filter(Boolean).join(", "); }).join("\n")], ["Pathway", txt("path") + (d.combined && !fields.combined.hidden ? ": " + d.combined : "")], ["Date", today]];
    var metaTable = new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      borders: { top: border, bottom: border, left: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: border, insideVertical: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" } },
      rows: meta.filter(function (m) { return m[1]; }).map(function (m) {
        return new D.TableRow({ children: [
          new D.TableCell({ width: { size: 22, type: D.WidthType.PERCENTAGE }, margins: { top: 70, bottom: 70, left: 0, right: 100 }, children: [para([run(m[0], { bold: true, color: P2, size: 20 })])] }),
          new D.TableCell({ width: { size: 78, type: D.WidthType.PERCENTAGE }, margins: { top: 70, bottom: 70, left: 100, right: 0 }, children: [para(lines(m[1] || "", { size: 21 }))] })
        ] });
      })
    });

    var children = [
      para([run("CAPSTONE TECHNICAL PROPOSAL", { bold: true, color: GD, size: 20, characterSpacing: 40 })], { spacing: { after: 80 } }),
      para([run(d.title || "Untitled project", { bold: true, color: P, size: 48 })], { spacing: { after: 80 } }),
      para([run("AI Research Foundations for Higher Education · Capstone Project Hackathon", { color: GREY, size: 21 })], {
        spacing: { after: 280 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 18, color: "FDD633", space: 10 } } }),
      metaTable,
      para([], { spacing: { after: 200 } }),
      para([run("Elevator pitch", { bold: true, color: P2, size: 20 })], { spacing: { after: 60 } }),
      para([run(pitch(d) || "Not answered", { size: 26, color: P, bold: !!pitch(d), italics: !pitch(d) })], {
        shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "FFF8E6" },
        border: { left: { style: D.BorderStyle.SINGLE, size: 36, color: "FDD633", space: 10 } },
        spacing: { after: 200 }, indent: { left: 200 } }),

      h1("1. The problem")].concat(qa("problem"), qa("why"), qa("scope"),
      [h1("2. Pathway")], qa("path"), qa("combined"), qa("ownPath"),
      [para([run("One example", { bold: true, color: P2, size: 20 })], { spacing: { before: 160, after: 80 }, keepNext: true }),
        table(["Input", "Output"], [[d.exampleIn || "", d.exampleOut || ""]], [50, 50])],
      [h1("3. Data plan")], qa("dataType"), qa("source"), qa("sourceLink"), qa("languages"), qa("size"), qa("missing"), qa("consent"),
      [h1("4. Model")], qa("model"),
      [h1("5. Evaluation")], qa("measure"), qa("success"),
      [h1("6. Impact & stakeholders")], qa("benefit"), qa("risk"),
      [para([run("Stakeholders", { bold: true, color: P2, size: 20 })], { spacing: { before: 160, after: 80 }, keepNext: true }),
        table(["Group", "What matters to them", "Risks they face", "Power", "How we'll involve them"], stakeholders(d).map(function (s) { return [s.group, s.matters, s.risks, s.power, s.engage]; }), [18, 24, 22, 12, 24])],
      [h1("7. Governance & sustainability")], qa("mitigation"), qa("governance"), qa("governancePlan"), qa("accountability"), qa("environment"));

    return new D.Document({
      creator: "AI Research Foundations",
      title: "Capstone proposal: " + (d.title || ""),
      styles: {
        default: { document: { run: { font: "Arial", size: 22, color: "1A1A1A" }, paragraph: { spacing: { line: 300 } } } },
        paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Arial", size: 30, bold: true, color: P },
          paragraph: { spacing: { before: 420, after: 120 }, keepNext: true } }]
      },
      sections: [{
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
        footers: { default: new D.Footer({ children: [para([run("AI Research Foundations · Capstone proposal · " + (d.teamName || "") + " · Page ", { color: GREY, size: 16 }), new D.TextRun({ children: [D.PageNumber.CURRENT], color: GREY, size: 16 })], { alignment: D.AlignmentType.CENTER })] }) },
        children: children
      }]
    });
  }

  /* ---------- Wiring ---------- */
  var t;
  form.addEventListener("input", function (e) {
    refresh();
    var fd = e.target.closest(".pp-field");
    if (fd && fd.classList.contains("has-error")) { var msg = check(fd, collect()); fd.classList.toggle("has-error", !!msg); fd.querySelector(".pp-error").textContent = msg; }
    clearTimeout(t); t = setTimeout(store, 400);
  });
  form.addEventListener("change", function () { refresh(); store(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.step === last) submitAll(); else if (validate(state.step, true)) show(state.step + 1);
  });
  $("[data-next]").addEventListener("click", function () { if (validate(state.step, true)) show(state.step + 1); });
  $("[data-back]").addEventListener("click", function () { if (state.step === 0) screen("welcome"); else show(state.step - 1); });
  rail.forEach(function (b, k) { b.addEventListener("click", function () { if (k <= state.max) show(k); }); });
  $("[data-start]").addEventListener("click", function () { screen("form"); show(state.step || 0); });
  $("[data-resume]").addEventListener("click", function () { screen("form"); show(state.step); });
  $("[data-edit]").addEventListener("click", function () { screen("form"); show(last); });
  $("[data-download]").addEventListener("click", function () { download(this); });
  $("[data-copy]").addEventListener("click", function () {
    var b = this, link = editLink();
    var ok = function () { b.textContent = "Copied ✓"; setTimeout(function () { b.textContent = "Copy your edit link"; }, 2200); };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(ok, function () { prompt("Copy your edit link:", link); });
    else prompt("Copy your edit link:", link);
  });

  /* ---------- Start: an edit link, a saved draft, or a fresh form ---------- */
  var saved = restore();
  if (saved && saved.data) {
    fill(saved.data);
    state.step = Math.min(saved.step || 0, last); state.max = Math.min(saved.max || 0, last);
    state.id = saved.id || ""; state.token = saved.token || ""; state.submittedAt = saved.submittedAt || ""; state.emailed = !!saved.emailed;
    var hasAnswers = Object.keys(saved.data).some(function (k) { var v = saved.data[k]; return Array.isArray(v) ? v.length : !!v; });
    if (hasAnswers) {
      $("[data-resume]").hidden = false;
      var note = $("[data-resume-note]");
      note.hidden = false;
      note.textContent = state.submittedAt
        ? "You submitted a proposal from this device on " + new Date(state.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) + ". Continue to edit it or download it again."
        : "Your answers are saved on this device" + (saved.savedAt ? ", last saved " + new Date(saved.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "") + ".";
    }
  }
  refresh();

  var edit = new URLSearchParams(location.search).get("edit");
  if (edit) {
    var parts = edit.split(".");
    screen("form");
    if (!endpoint) { show(state.step); notice("This edit link can't be opened yet, because saving isn't switched on for this form.", "warn"); return; }
    notice("Loading your proposal…");
    show(0);
    fetch(endpoint + "?action=load&id=" + encodeURIComponent(parts[0]) + "&token=" + encodeURIComponent(parts[1] || ""))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "Not found");
        state.id = parts[0]; state.token = parts[1]; state.submittedAt = res.updated || state.submittedAt;
        fill(res.data);
        state.max = last; show(last);
        notice(deadlinePassed()
          ? "The proposal deadline for your cohort has passed, so it can no longer be changed. You can still download it as a Word document below."
          : "You're editing your submitted proposal. Make your changes, then submit again to save them.", deadlinePassed() ? "warn" : "info");
      })
      .catch(function () { notice("We couldn't open that edit link. Please check you copied all of it, or contact the team.", "error"); });
  }
})();
