(function () {
  'use strict';
  var now = new Date();
  var iso = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  document.querySelectorAll('[data-date]').forEach(function (el) {
    if (el.dataset.date === iso) el.classList.add('is-today');
  });
  // Give the oldest overview-only archive stable, date-based destinations.
  function legacyDates(doc, url) {
    var match = url.pathname.match(/(\d{4}-\d{2}-\d{2})\.html$/);
    if (!match) return;
    doc.querySelectorAll('.week-card:not([data-date])').forEach(function (card, i) {
      var date = new Date(match[1] + 'T12:00:00Z');
      date.setUTCDate(date.getUTCDate() + i);
      card.dataset.date = date.toISOString().slice(0, 10);
      card.id = 'menu-' + card.dataset.date;
    });
  }
  legacyDates(document, new URL(location.href));
  if (location.hash.indexOf('#menu-') === 0) {
    requestAnimationFrame(function () {
      var target = document.getElementById(location.hash.slice(1));
      if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 20);
    });
  }
  var overview = document.querySelector('#overview');
  if (overview) {
    var hero = overview.querySelector('.hero');
    if (hero) {
      var detail = document.createElement('details');
      detail.className = 'week-context';
      var summary = document.createElement('summary');
      summary.textContent = '本周情况与喂养提醒';
      detail.appendChild(summary);
      hero.querySelectorAll('.badges, .focus-grid').forEach(function (el) { detail.appendChild(el); });
      if (detail.children.length > 1) hero.appendChild(detail);
    }
    var today = overview.querySelector('.week-card[data-date="' + iso + '"]');
    if (today) {
      var section = document.createElement('section');
      section.className = 'today-menu';
      var heading = document.createElement('h2');
      heading.textContent = '今天吃什么';
      section.appendChild(heading);
      var caption = document.createElement('p');
      caption.className = 'today-caption';
      caption.textContent = today.querySelector('h3').textContent + ' · 点开查看做法';
      section.appendChild(caption);
      today.querySelectorAll('p').forEach(function (row, mealIndex) {
        var link = document.createElement('a');
        var destination = new URL(location.href);
        destination.searchParams.set('meal', mealIndex);
        destination.hash = today.getAttribute('href');
        link.href = destination.href;
        link.className = 'today-meal';
        Array.from(row.children).forEach(function (el) { link.appendChild(el.cloneNode(true)); });
        section.appendChild(link);
      });
      if (hero) hero.after(section); else overview.prepend(section);
    }
  }

  // Load the dish library from the shared entry point; weekly HTML needs no new script tag.
  var scriptURL = new URL(document.currentScript.src);
  var base = new URL('../', scriptURL);
  function loadScript(name) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = new URL(name, scriptURL).href + scriptURL.search;
      script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
    });
  }
  window.DishLibraryReady = Promise.all([loadScript('dish-core.js'), loadScript('dish-library.js')]).then(function () { return window.DishLibrary.mount(base, scriptURL.search); }).catch(function () {
    var link = document.createElement('a');
    link.href = new URL('weeks/index.html', base).href;
    link.className = 'library-fallback';
    link.textContent = '菜谱库暂未加载，查看每周归档';
    (document.querySelector('.wrap') || document.body).prepend(link);
  });
})();
