// Developer-only: rebuild the reviewed snapshot from local HTML; no server or network needed.
const fs=require('node:fs'),{chromium}=require('playwright');
const Core=require('../assets/dish-core.js'),curate=require('./dish-curation.cjs');
(async()=>{const browser=await chromium.launch();try{const page=await browser.newPage();await page.addScriptTag({content:fs.readFileSync('assets/dish-core.js','utf8')});
 const files=['index.html',...fs.readdirSync('weeks').filter(x=>/^\d{4}-\d{2}-\d{2}\.html$/.test(x)).sort().reverse().map(x=>'weeks/'+x)];
 const previous=fs.existsSync('assets/dish-catalog.json')?JSON.parse(fs.readFileSync('assets/dish-catalog.json','utf8')):null;
 const priorSources=new Map((previous?.sources||[]).map(s=>[s.key,s]));
 const sources=[];const seen=new Set();
 for(const file of files){const rows=await page.evaluate(({html,file})=>DishCore.parse(new DOMParser().parseFromString(html,'text/html'),new URL(file,'https://menu.local/')),{html:fs.readFileSync(file,'utf8'),file});for(const row of rows)if(!seen.has(row.key)){seen.add(row.key);const prior=priorSources.get(row.key);if(prior&&Core.signature(prior)!==Core.signature(row)&&!process.argv.includes('--accept-reviewed-changes'))throw new Error('Source changed; review assignments before accepting: '+row.key);sources.push(curate(row))}}
 const catalog=Core.build(sources,sources);catalog.sources=sources;
 fs.writeFileSync('assets/dish-catalog.json',JSON.stringify({schemaVersion:1,sources})+'\n');
 console.log(JSON.stringify({sources:sources.length,dishes:catalog.dishes.length,variants:catalog.dishes.reduce((n,d)=>n+d.variants.length,0),withSteps:catalog.dishes.filter(d=>d.variants.some(v=>v.steps.length)).length}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
