const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8765';
const settle=p=>p.waitForFunction(()=>document.querySelector('.library-dishes')?.getAttribute('aria-busy')==='false',null,{timeout:90000});
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome'});try{
const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(base+'/index.html#archive');await settle(p);
const catalog=await p.evaluate(async()=>(await window.DishLibraryReady).getCatalog());
const pictured=catalog.flatMap(d=>d.variants.filter(v=>v.images.length).map(v=>({name:d.name,date:v.date,images:v.images})));
assert.equal(pictured.length,12);assert.equal(catalog.find(d=>d.name==='宝宝酸奶').variants[0].images.length,0);
assert(catalog.find(d=>d.name==='苹果洋葱奶酪牛肉饼').variants.some(v=>v.images.length));
// Every existing figure resolves correctly from current and archive pages, once per source.
for(const v of pictured)for(const image of v.images){const response=await p.request.get(image.src);assert(response.ok(),image.src);}
await p.locator('#library-query').fill('南瓜小饼');await p.locator('.dish-thumbnail').waitFor();
await p.locator('.dish-thumbnail').evaluate(im=>im.decode());
assert(await p.locator('.dish-thumbnail').evaluate(im=>im.naturalWidth>0));
for(const width of [320,390,768,1440]){
 await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.locator('.library-results .dish-card').click();assert(await p.locator('.dish-photo').isVisible());assert(await p.locator('.dish-detail').evaluate(e=>e.scrollWidth<=e.clientWidth));
 assert((await p.locator('.dish-photo figcaption').textContent()).includes('图源小红书'));
 await p.locator('.dish-photo-open').click();assert(await p.locator('.recipe-image-dialog').isVisible());await p.keyboard.press('Escape');
 assert(await p.locator('.dish-detail').isVisible());assert(await p.locator('.dish-photo-open').evaluate(e=>document.activeElement===e));await p.keyboard.press('Escape');
}
await p.setViewportSize({width:390,height:844});
await p.locator('#library-query').fill('蓝莓松饼');await p.locator('.library-results .dish-card').click();
assert((await p.locator('.dish-version option:checked').textContent()).includes('2026-10-16'));
const options=await p.locator('.dish-version option').allTextContents();await p.locator('.dish-version').selectOption(String(options.findIndex(x=>x.includes('2026-10-23'))));assert.equal(await p.locator('.dish-photo').count(),0);await p.keyboard.press('Escape');
await p.locator('.search-launch').click();await p.locator('#meal-query').fill('南瓜小饼');assert(await p.locator('.search-results .dish-thumbnail').isVisible());await p.locator('.search-results .dish-card').click();await p.locator('.dish-photo-open').click();await p.keyboard.press('Escape');await p.keyboard.press('Escape');assert(await p.locator('.meal-search').isVisible());assert(await p.locator('body').evaluate(e=>e.classList.contains('search-open')));await p.keyboard.press('Escape');
// Relative paths must not depend on the page where the library is opened.
for(const path of ['weeks/index.html','weeks/2026-10-19.html#archive','weeks/2026-08-31.html']){await p.goto(base+'/'+path);await settle(p);await p.locator('#library-query').fill('南瓜小饼');assert((await p.locator('.dish-thumbnail').getAttribute('src'))===base+'/assets/recipes/mon-pumpkin-pancake.jpg');}
// Unattributed/unsafe figures do not enter the dish library; image edits preserve text curation.
const parsing=await p.evaluate(base=>{
 const html='<article class="day-article" data-date="2026-11-01" id="d1101"><div class="meal-card"><h4 data-dishes="菜|饭">菜 + 饭</h4><figure><img src="unknown.jpg"></figure><figure data-dish="菜"><img src="../assets/a.jpg" alt="菜"><figcaption>自摄</figcaption></figure><figure data-dish="饭"><img src="javascript:alert(1)"></figure></div></article>';
 return DishCore.parse(new DOMParser().parseFromString(html,'text/html'),new URL(base+'/weeks/2026-11-01.html'))[0].images;
},base);assert.equal(parsing.length,1);assert.equal(parsing[0].src,base+'/assets/a.jpg');
// A failed picture never breaks the recipe or leaves a broken thumbnail.
await p.route('**/assets/recipes/mon-pumpkin-pancake.jpg',r=>r.abort());await p.goto(base+'/index.html#archive');await settle(p);await p.locator('#library-query').fill('南瓜小饼');await p.waitForFunction(()=>!document.querySelector('.library-results .dish-thumbnail'));await p.locator('.library-results .dish-card').click();await p.getByText('这张配图暂时无法加载，食材与做法仍可查看。',{exact:true}).waitFor();assert(await p.locator('.dish-ingredients').isVisible());await p.keyboard.press('Escape');await p.unroute('**/assets/recipes/mon-pumpkin-pancake.jpg');
// Original method image interaction remains usable.
await p.goto(base+'/index.html?meal=0#d1019');const meal=p.locator('#d1019 .meal-card').first();await meal.getByRole('button',{name:'看做法',exact:true}).click();await meal.getByRole('button',{name:'放大做法图',exact:true}).click();assert(await p.locator('.recipe-image-dialog').isVisible());await p.keyboard.press('Escape');
await p.goto(base+'/index.html#archive');await settle(p);await p.locator('#library-query').fill('南瓜小饼');await p.locator('.dish-thumbnail').evaluate(im=>im.decode());await p.screenshot({path:'/tmp/dish-image-card.png'});await p.locator('.library-results .dish-card').click();await p.locator('.dish-photo img').evaluate(im=>im.decode());await p.screenshot({path:'/tmp/dish-image-detail.png'});
assert.deepEqual(errors,[]);console.log('PASS: 12 attributed image records, 4 widths, image decoding/zoom/focus, version isolation, nested search, archive paths, missing/unsafe ownership, image failure, original method image.');console.log(JSON.stringify(pictured.map(({name,date})=>({name,date})),null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
