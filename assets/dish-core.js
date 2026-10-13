/* Pure catalog rules shared by the browser, snapshot builder and tests. */
(function (root) {
  'use strict';
  const normalize = value => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const aliases = { '玉米小馒头': '玉米馒头' };
  const ingredientWords = {
    牛肉: ['牛肉', '牛腩', '牛里脊', '牛腱', '牛尾'], 猪肉: ['猪肉', '猪绞肉', '猪小排', '排骨'], 鸡肉: ['鸡腿', '鸡肉'], 猪肝: ['猪肝'],
    虾: ['鲜虾','虾仁','虾丸','虾米'], 三文鱼: ['三文鱼'], 鳕鱼: ['鳕鱼'], 比目鱼: ['比目鱼'], 蛏子: ['蛏子'], 鸡蛋: ['鸡蛋','蛋黄','蛋白','蛋液','蒸蛋','蛋羹','炒蛋','烘蛋'],
    奶酪: ['奶酪'], 配方奶: ['配方奶'], 牛奶: ['牛奶'], 酸奶: ['酸奶'], 豆腐: ['豆腐'], 南瓜: ['南瓜'], 山药: ['山药'], 土豆: ['土豆'], 番茄: ['番茄'], 胡萝卜: ['胡萝卜'], 白萝卜: ['白萝卜'],
    苹果: ['苹果'], 香蕉: ['香蕉'], 蓝莓: ['蓝莓'], 雪梨: ['雪梨','秋梨','百合梨'], 香橙: ['香橙','橙汁','橙子'], 猕猴桃: ['猕猴桃'], 牛油果: ['牛油果'],
    西兰花: ['西兰花'], 花菜: ['花菜'], 生菜: ['生菜'], 小油菜: ['小油菜'], 菠菜: ['菠菜'], 青菜: ['青菜'], 娃娃菜: ['娃娃菜'], 白菜: ['白菜'], 包菜: ['包菜'], 秋葵: ['秋葵'],
    玉米: ['玉米粒','脱皮玉米','玉米馒头','玉米小馒头','玉米粥','玉米饼','玉米蒸蛋'], 口蘑: ['口蘑'], 香菇: ['香菇'], 海鲜菇: ['海鲜菇'], 平菇: ['平菇'], 莲藕: ['莲藕','藕块'], 芋头: ['芋头','芋艿'],
    丝瓜: ['丝瓜'], 冬瓜: ['冬瓜'], 西葫芦: ['西葫芦'], 茄子: ['茄子'], 洋葱: ['洋葱'], 小米: ['小米','小黄米'], 燕麦: ['燕麦'], 黑米: ['黑米'], 胚芽米: ['胚芽米'],
    面粉: ['面粉','低筋粉','燕麦粉'], 芝麻: ['芝麻'], 花生: ['花生'], 核桃: ['核桃粉','核桃碾','核桃少','核桃，','核桃、','核桃糊','核桃米','核桃红'], 红枣: ['红枣'], 银耳: ['银耳'], 百合: ['百合'], 豆浆: ['豆浆','黄豆'], 绿豆: ['绿豆'], 红豆: ['红豆']
  };
  function splitTitle(title) {
    // A plus inside parentheses belongs to the dish; alternatives remain marked.
    const value = title.split(/\s*·\s*(?:手指食物|抓握)[：:]/)[0];
    let depth = 0, part = '', parts = [], alternative = /二选一/.test(value);
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if ('（('.includes(c)) depth++;
      if ('）)'.includes(c)) depth--;
      if (depth < 0) return [{ label: title, alternative: false, uncertain: true }];
      if (!depth && ('+＋'.includes(c) || c === '或' || (c === '/' && /\s/.test(value[i - 1] || '') && /\s/.test(value[i + 1] || '')))) {
        if (c === '或' || c === '/') alternative = true;
        if (part.trim()) parts.push(part.trim()); part = '';
      } else part += c;
    }
    if (depth) return [{ label: title, alternative: false, uncertain: true }];
    if (part.trim()) parts.push(part.trim());
    return parts.map(label => ({ label, alternative }));
  }
  function cleanName(label) {
    let value = label.replace(/（[^（）]*）|\([^()]*\)/g, '').trim();
    value = value.replace(/^少量/, '').replace(/约\s*[\d./–—~～:]+\s*(?:g|ml|克|个|片|两)?\s*$/i, '').replace(/×\s*\d+单独$/, '').replace(/(?:一小份|小半杯|两瓣)$/, '').trim();
    return aliases[value] || value;
  }
  function positiveIngredients(text) {
    return text.replace(/(?:不加|不放|不含|非)[^，,。；;（）()]*/g, '').replace(/无(?:盐|糖|酱油|生抽)/g, '');
  }
  function idFor(name) { return 'dish-' + [...name].map(c => c.codePointAt(0).toString(16)).join('-'); }
  function category(name) {
    if (/饭|面|馄饨|馒头|吐司|米粉/.test(name)) return '饭面主食';
    if (/粥|糊|豆浆|牛奶/.test(name)) return '粥糊饮品';
    if (/汤|羹|炖|蒸蛋/.test(name)) return '汤羹蒸炖';
    if (/饼|糕|布丁|玉子烧|烘蛋/.test(name)) return '饼糕蛋点';
    return '菜肴与配菜';
  }
  function parse(doc, url) {
    const records = [];
    const txt = e => e?.textContent.trim() || '';
    doc.querySelectorAll('.day-article[data-date]').forEach(day => {
      day.querySelectorAll('.meal-card').forEach((meal, i) => {
        const title = meal.querySelector('h4'); if (!title) return;
        const ingredientNodes = [...meal.querySelectorAll('.two-col > :first-child li')];
        const stepNodes = [...meal.querySelectorAll('.two-col > :nth-child(2) li')];
        records.push({ key: day.dataset.date + '/' + i, date: day.dataset.date, dayId: day.id, mealIndex: i, time: txt(meal.querySelector('.meal-time')), title: txt(title),
          path: /\/weeks\//.test(url.pathname) ? 'weeks/' + url.pathname.split('/').pop() : 'index.html', ingredients: ingredientNodes.map(txt), steps: stepNodes.map(txt), note: txt(meal.querySelector('.note-inline')),
          assignments: { names: title.dataset.dishes || '', ingredients: ingredientNodes.map(e => e.dataset.dish || ''), steps: stepNodes.map(e => e.dataset.dish || '') }, overviewOnly: false });
      });
    });
    const monday = url.pathname.match(/(\d{4}-\d{2}-\d{2})\.html$/)?.[1];
    doc.querySelectorAll('.week-card').forEach((card, dayIndex) => {
      let date = card.dataset.date;
      if (!date && monday) { const d = new Date(monday + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dayIndex); date = d.toISOString().slice(0, 10); }
      if (!date || records.some(r => r.date === date)) return;
      card.querySelectorAll('p').forEach((row, i) => {
        const name = row.querySelector('span'), time = row.querySelector('em'); if (!name || !time) return;
        records.push({ key: date + '/' + i, date, dayId: 'menu-' + date, mealIndex: i, time: txt(time), title: txt(name), path: /\/weeks\//.test(url.pathname) ? 'weeks/' + url.pathname.split('/').pop() : 'index.html', ingredients: [], steps: [], note: '', overviewOnly: true, assignments: { names: '', ingredients: [], steps: [] } });
      });
    });
    return records;
  }
  function signature(source) { return JSON.stringify([source.title, source.ingredients, source.steps, source.note, source.assignments]); }
  function excerpt(rows, selections) {
    return (selections || []).map(ref => {
      if (typeof ref === 'number') { if (rows[ref] === undefined) throw new Error('Missing source row ' + ref); return rows[ref]; }
      if (!rows[ref.row]?.includes(ref.text)) throw new Error('Excerpt not in source: ' + ref.text);
      return ref.text;
    });
  }
  function fallbackParts(source) {
    const titles = source.assignments.names ? source.assignments.names.split('|').map(label => ({ label, alternative: splitTitle(source.title).some(part => part.alternative) })) : splitTitle(source.title);
    return titles.map(part => {
      const name = cleanName(part.label);
      const explicitI = source.assignments.ingredients.flatMap((label, i) => cleanName(label) === name ? [i] : []);
      const explicitS = source.assignments.steps.flatMap((label, i) => cleanName(label) === name ? [i] : []);
      // Unreviewed titles are searchable, but never inherit all of a mixed meal's ingredients.
      return { name, label: part.label, alternative: !!part.alternative, ingredientRefs: explicitI, stepRefs: explicitS, reviewed: false };
    });
  }
  function build(sources, reviewedSources = []) {
    const reviewed = new Map(reviewedSources.map(source => [source.key, source]));
    const seen = new Set(), unique = sources.filter(source => { if (seen.has(source.key)) return false; seen.add(source.key); return true; });
    const dishes = new Map();
    unique.forEach(source => {
      const saved = reviewed.get(source.key);
      const valid = saved && signature(saved) === signature(source);
      const parts = valid ? saved.parts : fallbackParts(source);
      parts.forEach(part => {
        const name = aliases[part.name] || part.name;
        if (!name) return;
        const ingredients = excerpt(source.ingredients, part.ingredientRefs), steps = excerpt(source.steps, part.stepRefs);
        const ingredientText = name + ' ' + ingredients.map(positiveIngredients).join(' ');
        const tags = Object.entries(ingredientWords).filter(([, terms]) => terms.some(term => ingredientText.includes(term))).map(([tag]) => tag);
        if (!dishes.has(name)) dishes.set(name, { id: idFor(name), name, category: category(name), tags: [], variants: [] });
        const dish = dishes.get(name);
        dish.tags = [...new Set([...dish.tags, ...tags])];
        dish.variants.push({ sourceKey: source.key, date: source.date, time: source.time, path: source.path, dayId: source.dayId, mealIndex: source.mealIndex, overviewOnly: source.overviewOnly,
          originalTitle: source.title, label: part.label || name, alternative: !!part.alternative, ingredients, steps, note: source.note,
          verified: !!valid || (!!ingredients.length && !!steps.length), ingredientTags: tags });
      });
    });
    const entries = [...dishes.values()];
    entries.forEach(dish => dish.variants.sort((a,b) => b.date.localeCompare(a.date)));
    entries.sort((a,b) => b.variants[0].date.localeCompare(a.variants[0].date) || a.name.localeCompare(b.name,'zh-CN'));
    return { schemaVersion: 1, sources: unique, dishes: entries };
  }
  function matches(dish, query) {
    const words = normalize(query).split(/[,，]+/).filter(Boolean);
    const haystack = normalize([dish.name, ...dish.tags, ...dish.variants.flatMap(v => v.ingredients.map(positiveIngredients))].join(' '));
    return words.every(word => haystack.includes(word));
  }
  const api = { normalize, splitTitle, cleanName, idFor, category, parse, signature, excerpt, fallbackParts, build, matches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DishCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
