// Run against a local HTTP server: BASE_URL=http://127.0.0.1:8765 node tests/mobile-ui.cjs
// Requires the Playwright package and its Chromium browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const files = ['index.html', ...fs.readdirSync('weeks').filter(f => f.endsWith('.html')).map(f => 'weeks/' + f)];
    let mealCount = 0;
    for (const file of files) {
      await page.goto(base + '/' + file);
      const baseline = await page.evaluate(async () => {
        const source = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
        return {
          meals: [...source.querySelectorAll('.day-article')].map(d => ({ id: d.id, meals: [...d.querySelectorAll('.meal-card')].map(m => [...m.querySelectorAll('h4,.meal-time,.pill,.two-col li,.note-inline,figcaption')].map(e=>e.textContent.replace(/\s/g,''))) })),
          notes: [...source.querySelectorAll('#notes li')].map(e => e.textContent.replace(/\s/g, '')),
          nutrition: source.querySelector('#nutrition')?.textContent.replace(/\s/g, '')
        };
      });
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const tabs = await page.locator('.topnav nav [data-tab]').count();
        for (let i = 0; i < Math.max(tabs, 1); i++) {
          if (tabs) {
            const link = page.locator('.topnav nav [data-tab]').nth(i);
            const target = await link.getAttribute('data-tab');
            await link.click();
            await page.waitForFunction(id => document.getElementById(id).classList.contains('is-on'), target).catch(async e=>{throw new Error(file+' width '+width+' tab '+target+' url '+page.url()+' '+e.message)});
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, file + ' overflow at ' + width + ' tab ' + i);
        }
      }
      if (baseline.notes.length) {
        const preserved = await page.locator('.original-notes li').evaluateAll(es => es.map(e => e.textContent.replace(/\s/g, '')));
        assert.deepEqual(preserved, baseline.notes, file + ' notes lost');
      }
      if (baseline.nutrition) {
        const preserved = await page.locator('.original-nutrition').textContent();
        assert(baseline.nutrition.endsWith(preserved.replace('对照完整原文', '').replace(/\s/g, '')), file + ' nutrition lost');
      }
      for (const day of baseline.meals) {
        await page.goto(base + '/' + file + '#' + day.id);
        for (let i = 0; i < day.meals.length; i++) {
          const article = page.locator('#' + day.id);
          await article.locator('.meal-tabs button').nth(i).click();
          assert.equal(await article.locator('.meal-card:visible').count(), 1, file + ' one meal');
          const meal = article.locator('.meal-card').nth(i);
          assert(await meal.isVisible());
          const preservedMeal = await meal.locator('h4,.meal-time,.pill,.two-col li,.note-inline,figcaption').evaluateAll(es=>es.map(e=>e.textContent.replace(/\s/g,'')));
          assert.deepEqual(preservedMeal.sort(), [...day.meals[i]].sort(), file+' meal content lost');
          if (await meal.locator('.process-switch').count()) {
            await meal.locator('.process-switch button').nth(1).click();
            assert(await meal.locator('.recipe-steps').isVisible());
          }
          mealCount++;
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/index.html');
    await page.locator('.search-launch').click(); await page.locator('#meal-query').fill('牛肉');
    await page.waitForFunction(() => document.querySelector('.meal-search').getAttribute('aria-busy')==='false' && document.querySelector('.meal-search .search-status').textContent.includes('找到'));
    const foundNames = await page.locator('.search-results .dish-name').allTextContents();
    assert(foundNames.length > 3);
    assert(foundNames.includes('牛肉小馄饨'));
    assert(!foundNames.some(name => name.includes('+')));
    await page.locator('.search-results .dish-card').filter({hasText:'牛肉小馄饨'}).click();
    const sourceLink = await page.locator('.dish-source-link').getAttribute('href');
    await page.locator('.dish-source-link').click();
    await page.waitForURL(sourceLink);
    const target = new URL(sourceLink);
    assert(await page.locator(target.hash + ' .meal-card').nth(Number(target.searchParams.get('meal'))).isVisible());
    await page.goto(base + '/index.html#shop');
    await page.locator('.shopping-list input').first().check();
    await page.locator('.categories button').nth(1).click(); await page.locator('.categories button').first().click();
    assert(await page.locator('.shopping-list input').first().isChecked());
    await page.goto(base + '/index.html#notes');
    assert.equal(await page.locator('.note-filters button').count(), 3);
    await page.locator('.note-filters button').nth(1).click(); assert(await page.locator('.note-card').count());
    // Use the documented template, then add unknown fields/new text: nothing should disappear.
    const template = fs.readFileSync('templates/content-sections.html','utf8');
    const original = fs.readFileSync('index.html','utf8');
    const fixture = await page.evaluate(({original, template}) => {
        const doc = new DOMParser().parseFromString(original,'text/html');
        const blocks = new DOMParser().parseFromString(template,'text/html');
        ['shop','nutrition','notes'].forEach(id=>doc.getElementById(id).replaceWith(blocks.getElementById(id)));
        doc.querySelector('[data-nutrition-summary]').remove();
        const li=doc.createElement('li');li.dataset.noteGroup='future-group';li.innerHTML='<b>测试新条目</b>：保留未知分组的条件。';doc.querySelector('#notes ul').append(li);
        const item=doc.createElement('li');item.textContent='测试采购（说明；保留完整）';doc.querySelector('[data-shopping-items]').append(item);
        return '<!doctype html>'+doc.documentElement.outerHTML;
      }, {original, template});
    await page.route('**/fixture.html', route => route.fulfill({contentType:'text/html',body:fixture}));
    await page.goto(base+'/fixture.html#notes');
    await page.getByRole('button',{name:'其他提醒',exact:true}).click();
    assert((await page.locator('.note-cards').textContent()).includes('保留未知分组的条件'));
    await page.locator('nav [data-tab=nutrition]').click();
    await page.waitForFunction(()=>document.getElementById('nutrition').classList.contains('is-on'));
    assert.equal(await page.locator('.nutrition-highlights').count(),0);
    await page.locator('nav [data-tab=shop]').click();
    await page.waitForFunction(()=>document.getElementById('shop').classList.contains('is-on'));
    assert.equal(await page.locator('.shopping-list li').filter({hasText:'测试采购'}).count(),1);
    assert((await page.locator('.shopping-list li').filter({hasText:'测试采购'}).textContent()).includes('说明；保留完整'));
    // Network failure is visible, retry recovers without a full page reload.
    await page.goto(base+'/index.html');
    await page.route('**/weeks/2026-09-07.html',r=>r.abort());
    await page.locator('.search-launch').click();await page.locator('#meal-query').fill('牛肉');
    await page.waitForFunction(()=>document.querySelector('.meal-search .search-status').textContent.includes('部分菜单'));
    await page.unroute('**/weeks/2026-09-07.html');await page.locator('.meal-search .search-retry').click();
    await page.waitForFunction(()=>document.querySelector('.meal-search').getAttribute('aria-busy')==='false'&&document.querySelector('.meal-search .search-status').textContent.includes('找到')&&!document.querySelector('.meal-search .search-status').textContent.includes('部分菜单'));
    assert.deepEqual(errors, []);
    console.log('PASS:', files.length, 'pages,', mealCount, 'meals, 4 widths, original nutrition/notes preserved, dish search and source-meal navigation, shopping + reminder controls.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
