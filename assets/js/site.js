(function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  document.querySelectorAll(".nav-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var nav = document.querySelector(".nav");
      if (!nav) return;
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      /* Collapse any open submenu whenever the mobile menu closes. */
      if (!open) {
        nav.querySelectorAll(".nav-has-sub.is-open").forEach(function (s) {
          s.classList.remove("is-open");
          var t = s.querySelector(".nav-sub-toggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
      }
    });
  });

  /* ---------- Workshops submenu toggle (tap to open/close on mobile) ---------- */
  document.querySelectorAll(".nav-sub-toggle").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var parent = btn.closest(".nav-has-sub");
      if (!parent) return;
      var open = parent.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ---------- Tabs (gallery, testimonials) ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function select(tab) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute("aria-selected", selected ? "true" : "false");
        t.setAttribute("tabindex", selected ? "0" : "-1");
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !selected;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var idx = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") idx = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") idx = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") idx = 0;
        else if (e.key === "End") idx = tabs.length - 1;
        if (idx !== null) {
          e.preventDefault();
          select(tabs[idx]);
          tabs[idx].focus();
        }
      });
    });
  });

  /* ---------- Onboarding checklist (in-memory progress) ---------- */
  document.querySelectorAll("[data-checklist]").forEach(function (root) {
    var boxes = Array.prototype.slice.call(root.querySelectorAll('input[type="checkbox"]'));
    var bar = root.querySelector("[data-progress-bar]");
    var count = root.querySelector("[data-progress-count]");
    var total = root.querySelector("[data-progress-total]");
    if (total) total.textContent = boxes.length;

    function update() {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      if (count) count.textContent = done;
      if (bar) bar.style.width = (boxes.length ? Math.round((done / boxes.length) * 100) : 0) + "%";
      boxes.forEach(function (b) {
        b.closest("li").classList.toggle("is-done", b.checked);
      });
    }
    boxes.forEach(function (b) { b.addEventListener("change", update); });
    update();
  });

  /* ---------- Active section highlight in onboarding sub-nav ---------- */
  var subnav = document.querySelector(".subnav");
  if (subnav && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(subnav.querySelectorAll("a"));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (a) { a.classList.remove("active"); });
          var a = byId[entry.target.id];
          if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll(".ob-section[id]").forEach(function (s) { obs.observe(s); });
  }

  /* ---------- Fade-in on scroll ---------- */
  var faders = document.querySelectorAll(".fade-in, .fade-in-stagger");
  if (faders.length) {
    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      faders.forEach(function (el) { io.observe(el); });
    } else {
      faders.forEach(function (el) { el.classList.add("is-visible"); });
    }
  }
})();

/* ---------- Count-up for hero stats ---------- */
(function () {
  "use strict";
  function animateCount(el) {
    var raw = el.getAttribute("data-count");
    if (!/^\d+$/.test(raw)) return;
    var target = parseInt(raw, 10);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = target; return; }
    var start = null, dur = 1100;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(p * target);
      if (p < 1) requestAnimationFrame(step); else el.textContent = target;
    }
    requestAnimationFrame(step);
  }
  var stats = document.querySelectorAll(".stat-value[data-count]");
  if (!stats.length) return;
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { animateCount(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    stats.forEach(function (s) { io.observe(s); });
  } else {
    stats.forEach(animateCount);
  }
})();

/* ---------- Curriculum objective modals ---------- */
(function () {
  "use strict";
  var supportsDialog = typeof HTMLDialogElement === "function";
  document.querySelectorAll("[data-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var d = document.getElementById(btn.getAttribute("data-dialog"));
      if (!d) return;
      if (supportsDialog && d.showModal) d.showModal(); else d.setAttribute("open", "");
    });
  });
  document.querySelectorAll(".course-modal").forEach(function (d) {
    var close = function () { if (d.close) d.close(); else d.removeAttribute("open"); };
    var btn = d.querySelector("[data-close]");
    if (btn) btn.addEventListener("click", close);
    d.addEventListener("click", function (e) { if (e.target === d) close(); });
  });
})();

/* ---------- Testimonial carousel ---------- */
(function () {
  "use strict";
  document.querySelectorAll("[data-carousel]").forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll("[data-slide]"));
    var dots = Array.prototype.slice.call(root.querySelectorAll("[data-dot]"));
    var cur = root.querySelector("[data-current]");
    var prev = root.querySelector("[data-prev]");
    var next = root.querySelector("[data-next]");
    var n = slides.length, i = 0;
    if (!n) return;
    function show(k) {
      i = (k % n + n) % n;
      slides.forEach(function (s, idx) { s.classList.toggle("is-active", idx === i); });
      dots.forEach(function (d, idx) { d.classList.toggle("is-active", idx === i); d.setAttribute("aria-current", idx === i ? "true" : "false"); });
      if (cur) cur.textContent = ("0" + (i + 1)).slice(-2);
    }
    var delay = parseInt(root.getAttribute("data-autoplay"), 10) || 6000;
    var timer = null;
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() { if (n < 2) return; stop(); timer = setInterval(function () { show(i + 1); }, delay); }
    function go(k) { show(k); start(); }
    if (prev) prev.addEventListener("click", function () { go(i - 1); });
    if (next) next.addEventListener("click", function () { go(i + 1); });
    dots.forEach(function (d) { d.addEventListener("click", function () { go(parseInt(d.getAttribute("data-dot"), 10)); }); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { go(i - 1); } else if (e.key === "ArrowRight") { go(i + 1); }
    });
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);
    show(0);
    start();
  });
})();

/* ---------- Gallery lightbox ---------- */
(function () {
  "use strict";
  var lb = document.querySelector("[data-lightbox]");
  if (!lb) return;
  var imgEl = lb.querySelector("[data-lb-img]");
  var counter = lb.querySelector("[data-lb-counter]");
  var items = [], idx = 0;
  function render() {
    var a = items[idx];
    if (!a) return;
    imgEl.src = a.getAttribute("href");
    var inner = a.querySelector("img");
    imgEl.alt = inner ? inner.alt : "";
    if (counter) counter.textContent = (idx + 1) + " / " + items.length;
  }
  function open(list, i) {
    items = list; idx = i;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    render();
  }
  function close() {
    lb.hidden = true;
    document.body.style.overflow = "";
    imgEl.removeAttribute("src");
  }
  function go(d) { if (items.length) { idx = (idx + d + items.length) % items.length; render(); } }
  document.querySelectorAll(".gallery-item").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var grid = a.closest(".gallery-grid");
      var list = grid ? Array.prototype.slice.call(grid.querySelectorAll(".gallery-item")) : [a];
      open(list, list.indexOf(a));
    });
  });
  lb.querySelector("[data-lb-close]").addEventListener("click", close);
  lb.querySelector("[data-lb-prev]").addEventListener("click", function (e) { e.stopPropagation(); go(-1); });
  lb.querySelector("[data-lb-next]").addEventListener("click", function (e) { e.stopPropagation(); go(1); });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lightbox-stage")) close(); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  });
})();
