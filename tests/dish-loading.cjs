// Regression checks for slow first loads. No server files are changed by browser routing.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8765';
const settle=p=>p.waitForFunction(()=>document.querySelector('.library-dishes')?.getAttribute('aria-busy')==='false',null,{timeout:90000});
const catalogCount=p=>p.evaluate(async()=>(await window.DishLibraryReady).getCatalog().length);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await chromium.launch();
 try{
  // Hold every historical page: current dishes must become usable without waiting for them.
  let release;const gate=new Promise(resolve=>release=resolve);
  const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/\/weeks\/\d{4}-\d{2}-\d{2}\.html$/,async route=>{await gate;await route.continue();});
  await p.goto(base+'/index.html#archive');
  await p.locator('.library-results .dish-card').first().waitFor();
  assert.equal(await p.locator('.library-dishes').getAttribute('aria-busy'),'true');
  assert((await p.locator('.library-dishes .search-status').textContent()).includes('正在补充往期'));
  const partial=await catalogCount(p);assert(partial>0&&partial<147);
  await p.locator('#library-query').fill('牛肉小馄饨');await p.locator('.library-results .dish-card').click();
  assert(await p.locator('.dish-ingredients').isVisible());
  assert((await p.locator('.dish-detail-intro').textContent()).includes('往期仍在读取'));
  await p.keyboard.press('Escape');
  await p.locator('#library-query').fill('番茄牛肉粒面');
  assert((await p.locator('.library-results').textContent()).includes('往期仍在补充'));
  await p.locator('#library-query').fill('牛肉小馄饨');await p.locator('.library-results .dish-card').click();
  release();await settle(p);assert.equal(await catalogCount(p),147);
  assert.equal(await p.locator('#library-query').inputValue(),'牛肉小馄饨');
  assert(await p.locator('.dish-ingredients').isVisible());await p.keyboard.press('Escape');
  await p.waitForFunction(()=>document.activeElement?.classList.contains('dish-card'));
  await p.locator('#library-query').fill('番茄牛肉粒面');
  assert.equal(await p.locator('.library-results .dish-card').count(),1);
  assert.deepEqual(errors,[]);await p.close();
  console.log('PASS: current dishes usable before historical pages; pending search, details and query preserved.');

  // Transient network and HTTP server failures recover automatically, without a button press.
  const retry=await browser.newPage();let jsonAttempts=0,weekAttempts=0;
  await retry.route('**/dish-catalog.json*',route=>++jsonAttempts===1?route.abort():route.continue());
  await retry.route('**/weeks/2026-09-07.html',route=>++weekAttempts===1?route.fulfill({status:503,body:'temporary'}):route.continue());
  await retry.goto(base+'/index.html#archive');await settle(retry);
  assert.equal(jsonAttempts,2);assert.equal(weekAttempts,2);assert.equal(await catalogCount(retry),147);
  assert(await retry.locator('.library-dishes .search-retry').isHidden());
  await retry.close();console.log('PASS: transient network and 503 failures automatically retry once.');

  // A real 13-second response used to hit the 12-second deadline; it must now finish intact.
  const slow=await browser.newPage();let slowAttempts=0;const slowFailures=[];
  slow.on('requestfailed',r=>slowFailures.push(r.url()));
  await slow.route('**/dish-catalog.json*',async route=>{slowAttempts++;await delay(13000);await route.continue();});
  const started=Date.now();await slow.goto(base+'/index.html#archive');await settle(slow);
  assert(Date.now()-started>=13000);assert.equal(slowAttempts,1);assert.equal(await catalogCount(slow),147);assert.deepEqual(slowFailures,[]);
  await slow.close();console.log('PASS: real 13-second response completes without abort or degraded names.');

  // Exercise the real 30-second deadline: a stuck first request is aborted, then retried.
  const timeout=await browser.newPage();let timeoutAttempts=0,releaseStuck;
  const stuck=new Promise(resolve=>releaseStuck=resolve);
  await timeout.route('**/dish-catalog.json*',async route=>{
   if(++timeoutAttempts===1){await stuck;await route.abort().catch(()=>{});}else await route.continue();
  });
  try{
   await timeout.goto(base+'/index.html#archive');await settle(timeout);
   assert.equal(timeoutAttempts,2);assert.equal(await catalogCount(timeout),147);
   assert(await timeout.locator('.library-dishes .search-retry').isHidden());
  }finally{releaseStuck();await timeout.close();}
  console.log('PASS: real request timeout aborts and automatically recovers on the next attempt.');

  // A permanent HTTP error is not retried automatically, and retry reuses successful pages.
  const missing=await browser.newPage();let missingAttempts=0,htmlRequests=0;
  missing.on('request',r=>{if(r.resourceType()==='fetch'&&/\.html$/.test(r.url()))htmlRequests++;});
  await missing.route('**/dish-catalog.json*',route=>{missingAttempts++;return route.fulfill({status:404,body:'missing'});});
  await missing.goto(base+'/index.html#archive');await settle(missing);
  assert.equal(missingAttempts,1);assert((await missing.locator('.library-dishes .search-status').textContent()).includes('整理资料暂未加载'));
  const successfulHTML=htmlRequests;
  await missing.unroute('**/dish-catalog.json*');await missing.locator('.library-dishes .search-retry').click();await settle(missing);
  assert.equal(await catalogCount(missing),147);assert.equal(htmlRequests,successfulHTML);
  await missing.close();console.log('PASS: permanent failure stays explicit; manual retry reuses successful HTML.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
