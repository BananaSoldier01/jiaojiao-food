const assert=require('node:assert/strict');
const Core=require('../assets/dish-core.js'),snapshot=require('../assets/dish-catalog.json');
const dishes=Core.build(snapshot.sources,snapshot.sources).dishes;
assert.equal(dishes.length,snapshot.dishes.length);
assert.equal(new Set(dishes.map(d=>d.name)).size,dishes.length);
const beef=dishes.filter(d=>Core.matches(d,'牛肉')).map(d=>d.name);
assert(beef.includes('牛肉小馄饨')&&beef.includes('苹果洋葱奶酪牛肉饼')&&beef.includes('白萝卜炖牛腩'));
assert(!beef.some(name=>/\+|蛏子|小油菜|软饭/.test(name)));
assert.equal(dishes.filter(d=>d.name==='苹果洋葱奶酪牛肉饼').length,1);
const pastry=dishes.find(d=>d.name==='苹果洋葱奶酪牛肉饼');assert.equal(pastry.variants.length,2);
assert(pastry.variants.every(v=>v.ingredients.every(x=>!x.includes('西兰花')&&!x.includes('生菜')&&!x.includes('软米'))));
assert.equal(Core.splitTitle('鲜虾豆腐羹（+蛋花） + 米饭').length,2);
assert.equal(Core.splitTitle('菜（未闭合 + 米饭').length,1);
const porkOnly={name:'猪肉小馄饨',tags:['猪肉'],variants:[{ingredients:['猪肉馅小馄饨（自包或现成猪肉馅，非虾馅）']}]};assert(!Core.matches(porkOnly,'虾'));
const noodles=dishes.find(d=>d.name==='番茄口蘑西兰花鸡蛋蝴蝶面');assert.equal(noodles.variants[0].steps.length,4);
const dumplings=dishes.find(d=>d.name==='牛肉小馄饨');assert(dumplings.variants.some(v=>v.date==='2026-10-11'&&v.alternative));assert(!dumplings.variants[0].ingredients.some(x=>x.includes('小油菜')));
const legacy=dishes.find(d=>d.name==='番茄牛肉粒面');assert(legacy.variants.every(v=>v.overviewOnly&&!v.steps.length&&!v.ingredients.length));
// A revised menu must not inherit stale amounts, even if its title is unchanged.
const revised=structuredClone(snapshot.sources.find(s=>s.key==='2026-10-13/1'));revised.ingredients[0]='牛肉馅约 99g';
const fallback=Core.build([revised],snapshot.sources).dishes;assert(fallback.every(d=>d.variants.every(v=>!v.ingredients.length&&!v.steps.length)));
// Optional explicit per-dish attribution supports new weekly content without rebuilding.
const future={key:'2026-10-26/0',date:'2026-10-26',dayId:'d1026',mealIndex:0,time:'早餐',title:'南瓜饼 + 小米粥',path:'index.html',ingredients:['南瓜 20g','小米 10g'],steps:['南瓜做饼。','小米煮粥。'],note:'',overviewOnly:false,assignments:{names:'',ingredients:['南瓜饼','小米粥'],steps:['南瓜饼','小米粥']}};
const newDishes=Core.build([future]).dishes;assert.equal(newDishes.find(d=>d.name==='南瓜饼').variants[0].steps[0],'南瓜做饼。');assert(!Core.matches(newDishes.find(d=>d.name==='小米粥'),'南瓜'));
// Every saved excerpt is an exact source substring, not a newly invented amount or instruction.
for(const source of snapshot.sources)for(const part of source.parts){Core.excerpt(source.ingredients,part.ingredientRefs);Core.excerpt(source.steps,part.stepRefs);}


assert(Core.splitTitle('牛肉馄饨或蛋糕').every(p=>p.alternative));
assert(Core.splitTitle('牛肉馄饨（自包 或 现成） + 青菜').every(p=>!p.alternative));
assert.equal(Core.cleanName('苹果奶酪牛肉饼'),'苹果奶酪牛肉饼');

console.log('PASS: dish dedupe, ingredient isolation, alternatives, combined pasta, legacy, stale-review invalidation, new tagged menu, exact source excerpts.');
