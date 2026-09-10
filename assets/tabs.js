(function () {
  var panels = document.querySelectorAll(".tab-panel");
  if (!panels.length) return;
  var links = document.querySelectorAll(".topnav nav a[data-tab]");
  var articles = document.querySelectorAll(".day-article");
  var dayLinks = document.querySelectorAll(".day-nav a");

  function parseHash() {
    var hash = (location.hash || "#overview").replace(/^#/, "");
    var day = document.getElementById(hash);
    if (day && day.classList.contains("day-article")) {
      return { tab: "daily", focus: hash };
    }
    if (document.querySelector('.tab-panel[data-tab="' + hash + '"]')) {
      return { tab: hash, focus: null };
    }
    return { tab: "overview", focus: null };
  }

  function todayDayId() {
    var el = document.querySelector(".day-article.is-today");
    if (el) return el.id;
    return articles.length ? articles[0].id : null;
  }

  function showDay(id) {
    if (!articles.length) return;
    if (!id || !document.getElementById(id)) id = todayDayId();
    articles.forEach(function (a) {
      a.classList.toggle("is-on", a.id === id);
    });
    dayLinks.forEach(function (a) {
      var href = (a.getAttribute("href") || "").replace(/^#/, "");
      a.classList.toggle("is-on", href === id);
    });
  }

  function show(tab, focusId) {
    panels.forEach(function (p) {
      p.classList.toggle("is-on", p.getAttribute("data-tab") === tab);
    });
    links.forEach(function (a) {
      a.classList.toggle("is-on", a.getAttribute("data-tab") === tab);
    });
    if (tab === "daily") showDay(focusId);
    syncTopnavH();
    requestAnimationFrame(function () {
      window.scrollTo(0, 0);
    });
  }

  function apply() {
    var state = parseHash();
    show(state.tab, state.focus);
  }

  function syncTopnavH() {
    var nav = document.querySelector(".topnav");
    var day = document.querySelector(".day-nav");
    if (nav) {
      document.documentElement.style.setProperty(
        "--topnav-h",
        Math.ceil(nav.getBoundingClientRect().height) + "px"
      );
    }
    if (day) {
      document.documentElement.style.setProperty(
        "--daynav-h",
        Math.ceil(day.getBoundingClientRect().height) + "px"
      );
    }
  }

  window.addEventListener("hashchange", apply);
  window.addEventListener("resize", syncTopnavH);
  syncTopnavH();
  apply();
})();
