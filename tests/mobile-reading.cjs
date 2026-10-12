const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/index.html#d1016');
    await page.locator('.day-article.is-on .meal-tabs button').nth(1).click();
    await page.locator('.meal-card:visible .process-switch button').nth(1).click();
    await page.evaluate(() => scrollTo(0, 400));
    await page.waitForTimeout(100);
    const y = await page.evaluate(() => scrollY);
    await page.locator('.meal-card:visible .ingredient-peek').click();
    await page.locator('.ingredient-sheet input').first().check();
    await page.getByRole('button', { name: '返回做法' }).click();
    assert.equal(await page.evaluate(() => scrollY), y);
    assert(await page.locator('.meal-card:visible .recipe-ingredients input').first().isChecked());
    await page.locator('nav a[data-tab=shop]').click();
    await page.locator('nav a[data-tab=daily]').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.day-article.is-on').getAttribute('id'), 'd1016');
    assert(await page.locator('#d1016 .meal-card').nth(1).isVisible());
    assert.equal(await page.evaluate(() => scrollY), y);
    await page.locator('nav a[data-tab=overview]').click();
    await page.locator('.week-context > summary').click();
    assert.equal(await page.locator('.context-highlights li').count(), 3);
    assert.equal(await page.locator('.context-detail[open]').count(), 0);
    assert(await page.evaluate(async () => {
      const source = new DOMParser().parseFromString(await (await fetch('index.html')).text(), 'text/html');
      return ['.focus', '.badge'].every(selector => [...source.querySelectorAll(selector)].every((e,i) => e.textContent.replace(/\s/g,'') === document.querySelectorAll(selector)[i].textContent.replace(/\s/g,'')));
    }));
    await page.locator('.context-detail > summary').nth(1).click();
    assert(await page.locator('.context-detail .focus').first().isVisible());
    await page.locator('.context-shop-link').click();
    await page.waitForFunction(() => document.getElementById('shop').classList.contains('is-on'));
    console.log('PASS: ingredient sheet, checkbox sync, scroll/date/meal restoration, overview source preservation and shopping shortcut.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
