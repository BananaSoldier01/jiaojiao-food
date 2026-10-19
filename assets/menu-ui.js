/* Progressive presentation: source menus remain readable and searchable HTML. */
(function () {
  'use strict';
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const details = (title, nodes, className = 'reading-block') => {
    const box = make('details', className);
    box.append(make('summary', '', title), ...nodes);
    return box;
  };
  const button = (label, action) => {
    const b = make('button', '', label);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  };
  function selectButtons(buttons, selected) {
    buttons.forEach((b, i) => {
      b.classList.toggle('active', i === selected);
      b.setAttribute('aria-pressed', String(i === selected));
    });
  }
  // Split only outside brackets; malformed parentheses fall back to the full string.
  function splitText(value, separators) {
    let depth = 0, part = '', rows = [];
    for (const c of value) {
      if ('（('.includes(c)) depth++;
      if ('）)'.includes(c)) depth--;
      if (depth < 0) return [value];
      if (!depth && separators.includes(c)) {
        if (part.trim()) rows.push(part.trim());
        part = '';
      } else part += c;
    }
    if (depth) return [value];
    if (part.trim()) rows.push(part.trim());
    return rows;
  }
  function itemParts(value) {
    const index = value.indexOf('（');
    if (index < 0) return [value, ''];
    let depth = 0;
    for (let i = index; i < value.length; i++) {
      if (value[i] === '（') depth++;
      if (value[i] === '）') {
        depth--;
        if (!depth) return i === value.length - 1 ? [value.slice(0, index), value.slice(index + 1, -1)] : [value, ''];
      }
    }
    return [value, ''];
  }
  // The oldest archive has only an overview: add navigation without inventing meals.
  if (!document.querySelector('.topnav')) {
    const root = new URL('../', document.currentScript.src);
    const header = make('header', 'topnav archive-navigation');
    const inner = make('div', 'topnav-inner');
    const brand = make('div', 'brand', '蕉蕉辅食');
    brand.append(make('small', '', '归档菜单'));
    const search = document.querySelector('.search-launch');
    if (search) brand.append(search);
    const nav = make('nav');
    [['index.html', '回本周'], ['weeks/index.html', '全部往期']].forEach(([path, title]) => {
      const link = make('a', '', title); link.href = new URL(path, root).href; nav.append(link);
    });
    inner.append(brand, nav); header.append(inner); document.body.prepend(header);
    const hero = document.querySelector('.hero');
    if (hero) {
      const nodes = [...hero.querySelectorAll(':scope > .badges, :scope > .focus-grid')];
      if (nodes.length) hero.append(details('当周情况与提醒', nodes, 'week-context'));
    }
    const target = document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 12));
  }
  if (!document.querySelector('.topnav [data-tab]')) document.querySelector('.topnav')?.classList.add('archive-navigation');
  const brand = document.querySelector('.topnav .brand');
  if (brand) {
    const mark = make('span', 'banana-mark');
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = '<svg viewBox="0 0 96 80" focusable="false"><path d="M74 23l4-14 8 3-6 15" fill="#99805a" stroke="#856b41" stroke-width="3" stroke-linejoin="round"/><path d="M16 37c14 13 43 7 58-14l7 4C77 54 56 69 35 62 22 58 15 48 13 41Z" fill="#ead18a" stroke="#a58a4d" stroke-width="2.5" stroke-linejoin="round"/><path d="M21 44c19 16 43 4 54-13" fill="none" stroke="#b19853" stroke-width="2" stroke-linecap="round"/><path d="M13 41l-3-5 6-2 3 5" fill="#99805a" stroke="#856b41" stroke-width="2" stroke-linejoin="round"/></svg>';
    const title = make('span', 'brand-title');
    const name = make('span');
    [...brand.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => name.append(node));
    title.append(name, mark);
    brand.prepend(title);
  }
  document.querySelectorAll('.week-context .focus p').forEach(p => {
    if (p.querySelector('a')) return;
    const parts = []; let part = '', depth = 0;
    const flush = () => { if (part.trim()) parts.push(part.trim()); part = ''; };
    for (const char of p.textContent) {
      if ('（('.includes(char)) depth++;
      if ('）)'.includes(char)) depth--;
      if (!depth && '①②③④⑤'.includes(char)) flush();
      part += char;
      if (!depth && '。；'.includes(char)) flush();
    }
    flush();
    if (parts.length > 1) p.replaceWith(...parts.map(text => make('p', '', text)));
  });
  // Show a few source-backed highlights first; keep every original detail available.
  document.querySelectorAll('.week-context').forEach(context => {
    const badges = context.querySelector(':scope > .badges');
    const grid = context.querySelector(':scope > .focus-grid');
    if (!badges || !grid) return;
    const rows = [...badges.querySelectorAll('.badge')];
    const selected = [rows[0], rows.find(row => /新引入|新食物/.test(row.textContent)), rows.find(row => /不加盐|无盐/.test(row.textContent))].filter((row, i, all) => row && all.indexOf(row) === i);
    const highlights = make('ul', 'context-highlights');
    selected.forEach(row => highlights.append(make('li', '', row.textContent.trim())));
    badges.before(highlights);
    const background = details('喂养数据与完整摘要', [], 'context-detail');
    badges.before(background); background.append(badges);
    [...grid.children].forEach(card => {
      const title = card.querySelector(':scope > b, :scope > strong, :scope > h3');
      const box = details(title?.textContent || '本周详细说明', [], 'context-detail');
      if (title) title.hidden = true;
      card.before(box); box.append(card);
      if (/要买|常备|采购/.test(title?.textContent || '') && document.getElementById('shop')) {
        const link = make('a', 'context-shop-link', '打开采购清单 →'); link.href = '#shop';
        box.before(link);
      }
    });
    context.classList.add('context-condensed');
  });
  const dayStates = new Map();
  document.querySelectorAll('.day-article').forEach(day => {
    const meals = [...day.querySelectorAll('.meal-card')];
    if (!meals.length) return;
    const chooser = make('div', 'meal-tabs');
    chooser.setAttribute('aria-label', '选择餐次');
    let selected = 0;
    const choose = index => {
      selected = index;
      meals.forEach((meal, i) => { meal.hidden = i !== index; });
      selectButtons([...chooser.children], index);
    };
    meals.forEach((meal, index) => {
      chooser.append(button(meal.querySelector('.meal-time')?.textContent || '餐次 ' + (index + 1), () => choose(index)));
      const columns = meal.querySelector('.two-col');
      const ingredient = columns?.children[0];
      const method = columns?.children[1];
      const figure = meal.querySelector('figure');
      if (ingredient && method) {
        const tools = make('div', 'process-switch');
        tools.setAttribute('aria-label', '备食材或看做法');
        const peek = button('查食材', () => {
          const popup = make('dialog', 'ingredient-sheet');
          popup.setAttribute('aria-label', '本餐食材');
          const close = button('返回做法', () => popup.close());
          const heading = make('div', 'sheet-heading');
          heading.append(make('h2', '', '本餐食材'), close);
          const list = ingredient.querySelector('ul,table')?.cloneNode(true);
          if (!list) return;
          list.querySelectorAll('input').forEach((input, i) => {
            const original = ingredient.querySelectorAll('input')[i];
            input.checked = original.checked;
            input.addEventListener('change', () => { original.checked = input.checked; });
          });
          const body = make('div', 'recipe-ingredients'); body.append(list);
          popup.append(heading, make('p', 'sheet-title', meal.querySelector('h4')?.textContent || ''), body);
          document.body.append(popup);
          const y = window.scrollY;
          document.body.classList.add('ingredient-open');
          popup.addEventListener('close', () => {
            document.body.classList.remove('ingredient-open'); popup.remove();
            peek.focus({ preventScroll: true }); window.scrollTo({ top: y, behavior: 'instant' });
          });
          popup.showModal();
        });
        peek.className = 'ingredient-peek';
        const setMode = mode => {
          peek.hidden = mode !== 'steps';
          ingredient.hidden = mode !== 'ingredients';
          method.hidden = mode !== 'steps';
          if (figure) figure.hidden = mode !== 'steps';
          selectButtons([...tools.children], mode === 'ingredients' ? 0 : 1);
        };
        tools.append(button('备食材', () => setMode('ingredients')), button('看做法', () => setMode('steps')));
        columns.before(tools);
        meal.append(peek);
        columns.classList.add('recipe-columns');
        ingredient.classList.add('recipe-ingredients');
        method.classList.add('recipe-steps');
        ingredient.querySelectorAll('li').forEach(li => {
          const label = make('label');
          const check = make('input'); check.type = 'checkbox';
          const span = make('span'); span.append(...li.childNodes);
          label.append(check, span); li.append(label);
        });
        const next = button('食材备好了，看做法 →', () => {
          setMode('steps');
          tools.children[1].focus({ preventScroll: true });
          window.scrollTo({ top: tools.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 800 ? 120 : 190), behavior: 'instant' });
        });
        next.className = 'next-action'; ingredient.append(next);
        setMode('ingredients');
      }
      const pillars = meal.querySelector('.pillars');
      if (pillars) { const group = details('看看这餐的营养组成', [], 'composition'); pillars.before(group); group.append(pillars); meal.append(group); }
      const img = figure?.querySelector('img');
      if (img) {
        const opener = button('放大做法图', () => {
          const popup = make('dialog', 'recipe-image-dialog');
          const close = button('关闭图片', () => popup.close());
          const caption = make('p', '', figure.querySelector('figcaption')?.textContent || '做法参考图，以文字菜单为准。');
          popup.append(close, caption, img.cloneNode());
          document.body.append(popup);
          popup.addEventListener('close', () => { popup.remove(); opener.focus({ preventScroll: true }); });
          popup.showModal();
        });
        opener.className = 'image-open photo-zoom-icon';
        opener.setAttribute('aria-label', '放大做法图'); opener.title = '放大图片'; opener.textContent = '⤢';
        const frame = make('div', 'recipe-photo-frame'); img.before(frame); frame.append(img, opener);
      }
    });
    meals[0].before(chooser);
    dayStates.set(day.id, { choose, size: meals.length, selected: () => selected });
    choose(0);
  });
  function selectLinkedMeal() {
    const state = dayStates.get(location.hash.slice(1));
    const raw = new URL(location.href).searchParams.get('meal');
    if (state && raw !== null && /^\d+$/.test(raw) && Number(raw) < state.size) state.choose(Number(raw));
  }
  selectLinkedMeal();
  window.addEventListener('hashchange', selectLinkedMeal);

  const shop = document.getElementById('shop');
  if (shop) {
    const table = shop.querySelector('table');
    if (table) {
      const categories = [], warnings = [];
      [...table.querySelectorAll('tbody tr')].forEach(row => {
        const cells = [...row.cells];
        if (cells.length < 2) return;
        const name = cells[0].textContent.trim();
        if (row.dataset.shopKind === 'notice' || /禁区|调味.*备注/.test(name)) { warnings.push(row); return; }
        const explicit = cells[1].querySelector('[data-shopping-items]');
        const items = explicit ? [...explicit.children].map(li => li.textContent.trim()).filter(Boolean) : splitText(cells[1].textContent.trim(), '；、');
        categories.push({ name, items, notes: cells.slice(2).map(c => c.textContent.trim()).join('；') });
      });
      if (categories.length) {
        const ui = make('div', 'shopping-ui');
        const progress = make('p', 'shopping-progress'); progress.setAttribute('role', 'status');
        const filters = make('div', 'categories'); filters.setAttribute('aria-label', '采购分类');
        const content = make('div'); const checked = new Set();
        const total = categories.reduce((n, c) => n + c.items.length, 0);
        const update = () => { progress.textContent = '已买 ' + checked.size + ' / ' + total + ' 项 · 本次页面内保留勾选'; };
        function render(index) {
          selectButtons([...filters.children], index);
          const category = categories[index]; content.replaceChildren(make('h3', '', category.name));
          const list = make('ul', 'shopping-list');
          category.items.forEach((item, i) => {
            const key = index + '-' + i, li = make('li'), label = make('label'), check = make('input'), span = make('span');
            const [name, explanation] = itemParts(item);
            check.type = 'checkbox'; check.checked = checked.has(key);
            li.classList.toggle('checked', check.checked);
            check.addEventListener('change', () => { check.checked ? checked.add(key) : checked.delete(key); li.classList.toggle('checked', check.checked); update(); });
            span.append(make('strong', '', name)); if (explanation) span.append(make('small', '', explanation));
            label.append(check, span); li.append(label); list.append(li);
          });
          content.append(list);
          if (category.notes) content.append(details('已有食材与本类备注', [make('p', '', category.notes)]));
          warnings.forEach(row => { const box = make('aside', 'restriction'); box.append(make('h3', '', row.cells[0].textContent)); [...row.cells].slice(1).forEach(c => box.append(make('p', '', c.textContent))); content.append(box); });
        }
        categories.forEach((category, i) => filters.append(button(category.name, () => render(i))));
        ui.append(progress, filters, content); table.closest('.table-wrap')?.before(ui);
        if (!ui.isConnected) table.before(ui);
        const original = details('对照原始采购表', [], 'source');
        const container = table.closest('.table-wrap') || table;
        container.before(original); original.append(container);
        render(0); update();
      }
    }
  }

  const nutrition = document.getElementById('nutrition');
  if (nutrition) {
    const title = nutrition.querySelector(':scope > h2');
    const originalNodes = [...nutrition.children].filter(node => node !== title);
    const presentation = make('div', 'nutrition-ui');
    presentation.append(make('p', 'muted', '以下保留当周家庭安排，按类别展开查看。'));
    originalNodes.forEach(node => {
      if (node.matches('[data-nutrition-summary]')) { const copy = node.cloneNode(true); copy.className = 'nutrition-highlights'; presentation.append(copy); }
      else if (node.matches('.pillars')) {
        const first = node.querySelector('.pill'); presentation.append(details(first?.textContent || '食物搭配', [node.cloneNode(true)], 'food-group'));
      } else if (node.matches('.grid') && node.querySelector('.g-card')) {
        node.querySelectorAll('.g-card').forEach(card => presentation.append(details(card.querySelector('b')?.textContent || '食物搭配', [card.cloneNode(true)], 'food-group')));
      } else if (node.querySelector('table') || node.matches('table')) {
        const table = node.matches('table') ? node : node.querySelector('table');
        const header = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        const records = [...table.querySelectorAll('tbody tr')].map(row => {
          const article = make('article', 'record-row');
          [...row.cells].forEach((cell, i) => article.append(make(i ? 'p' : 'h3', '', (i && header[i] ? header[i] + '：' : '') + cell.textContent.trim())));
          return article;
        });
        presentation.append(details(header[0] === '营养素' ? '补充剂与营养素 · 原菜单记录' : '本周食物搭配 · 原文说明', records));
      } else if (node.matches('h2,h3')) { presentation.append(node.cloneNode(true)); }
      else { presentation.append(details(node.dataset.sectionTitle || '背景与详细说明', [node.cloneNode(true)])); }
    });
    // Retain the original DOM, including unknown future content, for verification.
    const original = details('对照完整原文', originalNodes, 'source original-nutrition');
    nutrition.append(presentation, original);
  }

  const notes = document.getElementById('notes');
  if (notes) {
    const list = notes.querySelector('ul');
    if (list) {
      const rows = [...list.children];
      const names = { focus: '本周重点', handling: '处理食物', plans: '安排与新做法', other: '其他提醒' };
      const groups = new Map();
      rows.forEach(row => {
        const raw = row.dataset.noteGroup;
        const group = Object.hasOwn(names, raw) ? raw : 'other';
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(row);
      });
      const ui = make('div', 'notes-ui'), filters = make('div', 'note-filters'), content = make('div', 'note-cards');
      const keys = Object.keys(names).filter(key => groups.has(key));
      if (keys.length === 1 && keys[0] === 'other') names.other = '当周提醒';
      function render(index) {
        selectButtons([...filters.children], index); content.replaceChildren();
        groups.get(keys[index]).forEach(row => {
          const article = make('article', 'note-card');
          const copy = row.cloneNode(true), heading = copy.querySelector('b,strong');
          if (heading && copy.textContent.trim().startsWith(heading.textContent.trim())) { article.append(make('h3', '', heading.textContent)); heading.remove(); }
          else article.append(make('h3', '', '提醒'));
          if (copy.firstChild?.nodeType === Node.TEXT_NODE) copy.firstChild.textContent = copy.firstChild.textContent.replace(/^\s*[：:]\s*/, '');
          const p = make('div', 'note-body');
          if (copy.querySelector('a')) p.append(...copy.childNodes);
          else {
            let depth = 0, part = '';
            const flush = () => { if (part.trim()) p.append(make('p', '', part.trim())); part = ''; };
            for (const char of copy.textContent) {
              if ('（('.includes(char)) depth++;
              if ('）)'.includes(char)) depth--;
              if (depth === 0 && '①②③④⑤'.includes(char)) flush();
              part += char;
              if (depth === 0 && '。；'.includes(char)) flush();
            }
            flush();
          }
          article.append(p); content.append(article);
        });
      }
      keys.forEach((key, i) => filters.append(button(names[key], () => render(i))));
      ui.append(filters, content); list.before(ui);
      const original = details('对照完整原文', [], 'source original-notes'); list.before(original); original.append(list);
      if (keys.length) render(0);
    }
  }
  // Archive links remain original links; month headings are presentation only.
  document.querySelectorAll('.archive-list').forEach(list => {
    let month = '';
    [...list.children].forEach(li => {
      const a = li.querySelector('a');
      const match = a?.getAttribute('href')?.match(/(\d{4})-(\d{2})-\d{2}\.html/);
      if (!match) return;
      const next = match[1] + ' 年 ' + Number(match[2]) + ' 月';
      if (next !== month) { const heading = make('li', 'archive-month', next); li.before(heading); month = next; }
    });
  });
})();
