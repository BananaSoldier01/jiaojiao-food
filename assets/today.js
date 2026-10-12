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

  // Search is derived from existing HTML. No weekly JSON/build step is needed.
  var script = document.currentScript;
  var base = new URL('../', script.src);
  var button = document.createElement('button');
  button.className = 'search-launch';
  button.type = 'button';
  button.textContent = '搜菜名';
  button.setAttribute('aria-haspopup', 'dialog');
  var host = document.querySelector('.brand') || document.querySelector('.wrap');
  if (!host) return;
  host.appendChild(button);
  var dialog = document.createElement('dialog');
  dialog.className = 'meal-search';
  dialog.setAttribute('aria-labelledby', 'search-title');
  dialog.innerHTML = '<div class="search-heading"><h2 id="search-title">找一道吃过的菜</h2><button type="button" class="search-close">关闭</button></div><p class="search-hint">搜菜名或食材，找本周与往期菜单</p><form method="dialog" class="search-form"><label for="meal-query" class="sr-only">菜名关键词</label><input id="meal-query" type="search" placeholder="比如：牛肉、南瓜、鸡蛋" autocomplete="off" enterkeyhint="search"><button type="submit">搜索</button></form><p class="search-status" role="status" aria-live="polite"></p><button type="button" class="search-retry" hidden>重试未加载的菜单</button><div class="search-results"></div>';
  document.body.appendChild(dialog);
  var input = dialog.querySelector('input');
  var status = dialog.querySelector('.search-status');
  var results = dialog.querySelector('.search-results');
  var retry = dialog.querySelector('.search-retry');
  var cache = new Map();
  var entries = [];
  var busy = false;
  var loaded = false;
  var failures = 0;
  var previousFocus;
  function parse(doc, url) {
    legacyDates(doc, url);
    var records = [];
    doc.querySelectorAll('.day-article[data-date]').forEach(function (day) {
      day.querySelectorAll('.meal-card').forEach(function (meal, mealIndex) {
        var title = meal.querySelector('h4');
        var time = meal.querySelector('.meal-time');
        if (title && time) {
          var destination = new URL(url.href);
          destination.searchParams.set('meal', mealIndex);
          destination.hash = day.id;
          records.push({ date: day.dataset.date, time: time.textContent.trim(), name: title.textContent.trim(), href: destination.href });
        }
      });
    });
    doc.querySelectorAll('.week-card[data-date]').forEach(function (card) {
      if (records.some(function (r) { return r.date === card.dataset.date; })) return;
      card.querySelectorAll('p').forEach(function (row) {
        var time = row.querySelector('em');
        var title = row.querySelector('span');
        if (time && title) records.push({ date: card.dataset.date, time: time.textContent.trim(), name: title.textContent.trim(), href: url.href + (card.getAttribute('href') || '#' + card.id) });
      });
    });
    return records;
  }
  async function fetchDoc(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(url.href, { signal: controller.signal, cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      cache.set(url.href, doc);
      return doc;
    } finally { clearTimeout(timer); }
  }
  function render() {
    var query = input.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    if (!loaded) { status.textContent = '正在读取本周与往期菜单…'; return; }
    var matches = entries.filter(function (r) { return r.name.toLocaleLowerCase().includes(query); });
    var warning = failures ? '部分菜单未加载，结果可能不完整。' : '';
    if (!query) { status.textContent = warning + '输入菜名或食材开始搜索。'; return; }
    status.textContent = warning + (matches.length ? '找到 ' + matches.length + ' 个餐次' : '没有找到，试试其他菜名或食材。');
    matches.forEach(function (r) {
      var link = document.createElement('a');
      link.href = r.href;
      var meta = document.createElement('small');
      meta.textContent = r.date + ' · ' + r.time;
      var name = document.createElement('span');
      name.textContent = r.name;
      link.append(meta, name);
      link.addEventListener('click', function () { dialog.close(); });
      results.appendChild(link);
    });
  }
  async function load() {
    if (busy) return;
    busy = true;
    failures = 0;
    retry.hidden = true;
    status.textContent = '正在读取本周与往期菜单…';
    var currentURL = new URL('index.html', base);
    var listURL = new URL('weeks/index.html', base);
    var current;
    var list;
    await Promise.all([
      fetchDoc(currentURL).then(function (d) { current = d; }).catch(function () { failures++; }),
      fetchDoc(listURL).then(function (d) { list = d; }).catch(function () { failures++; })
    ]);
    var urls = new Map();
    function discover(doc, page) {
      if (!doc) return;
      doc.querySelectorAll('a[href]').forEach(function (a) {
        var url = new URL(a.getAttribute('href'), page);
        if (url.origin === base.origin && url.pathname.startsWith(base.pathname + 'weeks/') && /\/\d{4}-\d{2}-\d{2}\.html$/.test(url.pathname)) {
          url.hash = ''; url.search = ''; urls.set(url.href, url);
        }
      });
    }
    discover(list, listURL);
    discover(current, currentURL);
    var all = current ? parse(current, currentURL) : [];
    var pending = Array.from(urls.values());
    for (var i = 0; i < pending.length; i += 4) {
      var batch = await Promise.all(pending.slice(i, i + 4).map(async function (url) {
        try { return parse(await fetchDoc(url), url); } catch (_) { failures++; return []; }
      }));
      batch.forEach(function (rows) { all.push.apply(all, rows); });
    }
    var seen = new Set();
    entries = all.filter(function (r) {
      var key = r.date + '|' + r.time;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    loaded = true; busy = false;
    retry.hidden = !failures;
    render();
  }
  button.addEventListener('click', function () {
    previousFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add('search-open');
    input.focus();
    if (!loaded) load(); else render();
  });
  dialog.querySelector('.search-close').onclick = function () { dialog.close(); };
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); dialog.close(); }
  });
  dialog.addEventListener('close', function () {
    document.body.classList.remove('search-open');
    if (previousFocus) previousFocus.focus({ preventScroll: true });
  });
  dialog.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); render(); input.blur(); });
  input.addEventListener('input', render);
  retry.onclick = load;
})();
