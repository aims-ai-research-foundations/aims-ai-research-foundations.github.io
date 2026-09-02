(function () {
  "use strict";

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
    }
  }

  function initNavigation() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".primary-nav");

    if (toggle && nav) {
      function closeMenu() {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");
      }

      toggle.addEventListener("click", function () {
        var isOpen = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
      });

      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeMenu();
      });
    }

    var sectionNav = document.querySelector(".section-nav");
    if (!sectionNav) return;

    var links = Array.prototype.slice.call(sectionNav.querySelectorAll('a[href^="#"]'));
    var sections = links.map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    }).filter(Boolean);
    var ticking = false;

    function updateActiveSection() {
      var styles = getComputedStyle(document.documentElement);
      var offset = parseFloat(styles.getPropertyValue("--header-height")) +
        parseFloat(styles.getPropertyValue("--section-nav-height")) + 48;
      var current = sections[0];

      sections.forEach(function (section) {
        if (section.getBoundingClientRect().top <= offset) current = section;
      });

      links.forEach(function (link) {
        var active = current && link.getAttribute("href") === "#" + current.id;
        link.classList.toggle("active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(updateActiveSection);
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    updateActiveSection();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNavigation();
    renderIcons();
  });
})();
