/* Dish-first browsing; the HTML menus remain the weekly source of truth. */
(function () {
 'use strict';
 const el = (tag, cls, text) => { const node=document.createElement(tag); if(cls)node.className=cls; if(text!==undefined)node.textContent=text; return node; };
 const button = (text, handler, cls) => {const node=el('button',cls,text);node.type='button';node.addEventListener('click',handler);return node;};
 window.DishLibrary = { mount(base, version) {
  const Core=window.DishCore, cache=new Map(), views=[];
  let dishes=[], loading=null, loaded=false, failures=0, reviewMissing=false, weeklyLinks=[];
  const fetchJSON = async url => {
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try {const r=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}
  };
  async function fetchDoc(url) {
   if(cache.has(url.href))return cache.get(url.href);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try {const r=await fetch(url.href,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);const doc=new DOMParser().parseFromString(await r.text(),'text/html');cache.set(url.href,doc);return doc;}finally{clearTimeout(timer);}
  }
  function refresh() {views.forEach(view=>view.render());}
  async function load() {
   if(loading)return loading;
   failures=0;reviewMissing=false;
   loading=(async()=>{
    let current,list,snapshot;
    const currentURL=new URL('index.html',base),listURL=new URL('weeks/index.html',base);
    await Promise.all([
     fetchDoc(currentURL).then(x=>{current=x;}).catch(()=>{failures++;}),
     fetchDoc(listURL).then(x=>{list=x;}).catch(()=>{failures++;}),
     fetchJSON(new URL('assets/dish-catalog.json'+version,base)).then(x=>{if(x.schemaVersion!==1 || !Array.isArray(x.sources))throw new Error('catalog');snapshot=x;}).catch(()=>{reviewMissing=true;})
    ]);
    const urls=new Map();
    function discover(doc,page){if(!doc)return;doc.querySelectorAll('a[href]').forEach(a=>{const u=new URL(a.getAttribute('href'),page);if(u.origin===base.origin&&u.pathname.startsWith(base.pathname+'weeks/')&&/\/\d{4}-\d{2}-\d{2}\.html$/.test(u.pathname)){u.hash='';u.search='';urls.set(u.href,{url:u,label:a.textContent.trim()});}});}
    discover(current,currentURL);discover(list,listURL);
    weeklyLinks=[...urls.values()].sort((a,b)=>b.url.pathname.localeCompare(a.url.pathname));
    const sources=current?Core.parse(current,currentURL):[];
    const pending=[...urls.values()];
    for(let i=0;i<pending.length;i+=4){const batch=await Promise.all(pending.slice(i,i+4).map(async item=>{try{return Core.parse(await fetchDoc(item.url),item.url);}catch(_){failures++;return [];}}));batch.forEach(rows=>sources.push(...rows));}
    dishes=Core.build(sources,snapshot?.sources||[]).dishes;
    loaded=true;
   })().catch(()=>{failures++;loaded=true;}).finally(()=>{loading=null;refresh();renderWeeks();});
   refresh();return loading;
  }
  function sourceURL(variant) {
   const url=new URL(variant.path,base);if(!variant.overviewOnly)url.searchParams.set('meal',variant.mealIndex);url.hash=variant.dayId;return url.href;
  }
  function syncScrollLock(){document.body.classList.toggle('search-open',!!document.querySelector('.meal-search[open],.dish-detail[open]'));}
  function openDish(dish, opener, query) {
   const popup=el('dialog','dish-detail');popup.setAttribute('aria-label',dish.name);
   const head=el('div','dish-detail-head');head.append(el('h2','',dish.name),button('关闭',()=>popup.close(),'search-close'));
   const info=el('p','dish-detail-intro','食材与做法摘自原菜单；未明确归属的内容请看原餐，份量按所选日期保留。');
   const body=el('div','dish-detail-body');
   const matching = v => Core.matches({name:dish.name,tags:v.ingredientTags,variants:[v]},query||'');
   let selected=dish.variants.findIndex(v=>matching(v)&&v.steps.length&&!v.alternative);
   if(selected<0)selected=dish.variants.findIndex(matching);if(selected<0)selected=0;
   const select=el('select','dish-version');select.id='dish-version';
   dish.variants.forEach((v,i)=>{const opt=el('option','',v.date+' · '+v.time+(v.alternative?' · 备选':'')+(v.overviewOnly?' · 仅总览':''));opt.value=i;select.append(opt);});select.value=selected;
   const label=el('label','dish-version-label','选择菜单记录');label.htmlFor=select.id;
   function renderVariant(){
    body.replaceChildren();const v=dish.variants[selected];
    if(v.alternative)body.append(el('p','dish-context-warning','这是当日菜单的备选之一，未据此认定实际吃过。'));
    if(v.label!==dish.name)body.append(el('p','dish-original-label','原菜单名称：'+v.label));
    if(v.ingredients.length){body.append(el('h3','','食材'));const list=el('ul','dish-ingredients');v.ingredients.forEach(text=>list.append(el('li','',text)));body.append(list);}
    else body.append(el('p','dish-empty-note',v.overviewOnly?'这份早期菜单只记录了菜名，没有独立食材用量。':'原餐食材未能明确拆分，暂不把整餐用量归到这道菜。'));
    if(v.steps.length){body.append(el('h3','','做法'));const list=el('ol','dish-steps');v.steps.forEach(text=>list.append(el('li','',text)));body.append(list);}
    else body.append(el('p','dish-empty-note','这份记录未单列本菜步骤，可查看原周菜单。'));
    if(v.note){const notes=el('details','dish-source-note');notes.append(el('summary','','原餐提醒与适用条件'),el('p','',v.note));body.append(notes);}
    const origin=el('details','dish-source-note');origin.append(el('summary','','查看原餐搭配'),el('p','',v.originalTitle));body.append(origin);
    const link=el('a','dish-source-link','查看 '+v.date+' 的原周菜单 →');link.href=sourceURL(v);link.addEventListener('click',()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());});body.append(link);
   }
   select.addEventListener('change',()=>{selected=Number(select.value);renderVariant();});
   popup.append(head,info,label,select,body);renderVariant();document.body.append(popup);
   popup.addEventListener('close',()=>{popup.remove();syncScrollLock();if(opener?.isConnected)opener.focus({preventScroll:true});});
   popup.showModal();syncScrollLock();
  }
  function createView(container, isSearch) {
   const form=el('form','search-form');const input=el('input');input.type='search';input.placeholder='搜一道菜，或一种食材';input.autocomplete='off';input.enterKeyHint='search';input.id=isSearch?'meal-query':'library-query';
   const label=el('label','sr-only','菜名或食材');label.htmlFor=input.id;
   const submit=el('button','','搜索');submit.type='submit';form.append(label,input,submit);
   const status=el('p','search-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   const retry=button('重新读取菜单',load,'search-retry');retry.hidden=true;
   const filters=el('div','dish-filters');filters.setAttribute('aria-label','菜品类别');let category='全部',limit=24;
   const categories=['全部','饭面主食','粥糊饮品','汤羹蒸炖','饼糕蛋点','菜肴与配菜'];
   categories.forEach(name=>{const b=button(name,()=>{category=name;limit=24;render();});b.setAttribute('aria-pressed',String(name===category));filters.append(b);});
   const result=el('div',isSearch?'search-results dish-grid':'library-results dish-grid');
   const more=button('再看 24 道',()=>{limit+=24;render();},'dish-more');more.hidden=true;
   function render(){
    const query=input.value.trim();result.replaceChildren();retry.hidden=!(failures||reviewMissing);
    filters.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.textContent===category);b.setAttribute('aria-pressed',String(b.textContent===category));});
    more.hidden=true;
    if(!loaded){status.textContent='正在整理本周与往期菜谱…';return;}
    const warning=(failures?'部分菜单未加载，结果可能不完整。':'')+(reviewMissing?'已整理资料暂未加载，仅显示能确认的菜名。':'');
    if(isSearch&&!query){status.textContent=warning+'输入菜名或食材，一次找一道菜。';return;}
    const matches=dishes.filter(d=>(category==='全部'||d.category===category)&&Core.matches(d,query));
    status.textContent=warning+(query?'找到 '+matches.length+' 道菜':matches.length+' 道菜 · 同名合并，保留不同日期做法')+(loading?' · 正在重新读取…':'');
    if(!matches.length)result.append(el('p','dish-empty-note','没有找到匹配的菜，试试“牛肉”“南瓜”或其他菜名。'));
    matches.slice(0,limit).forEach(d=>{
     const card=button('',()=>openDish(d,card,query),'dish-card');card.dataset.dishId=d.id;
     card.append(el('small','dish-kind',d.category),el('span','dish-name',d.name));
     const tags=d.tags.slice(0,4);if(tags.length)card.append(el('span','dish-tags',tags.join(' · ')));
     const withSteps=d.variants.some(v=>v.steps.length);card.append(el('small','dish-card-meta',d.variants.length+' 份菜单记录 · '+(withSteps?'查看食材与做法':'菜名记录')));
     result.append(card);
    });
    more.hidden=matches.length<=limit;
   }
   input.addEventListener('input',()=>{limit=24;render();});form.addEventListener('submit',e=>{e.preventDefault();limit=24;render();input.blur();});
   container.append(form,filters,status,retry,result,more);const view={input,render};views.push(view);return view;
  }
  const launcher=button('搜菜名',()=>{dialog.showModal();syncScrollLock();searchView.input.focus();if(!loaded)load();else searchView.render();},'search-launch');launcher.setAttribute('aria-haspopup','dialog');
  (document.querySelector('.brand')||document.querySelector('.wrap')).append(launcher);
  const dialog=el('dialog','meal-search');dialog.setAttribute('aria-labelledby','search-title');
  const head=el('div','search-heading');const title=el('h2','','找一道菜');title.id='search-title';head.append(title,button('关闭',()=>dialog.close(),'search-close'));
  dialog.append(head,el('p','search-hint','按菜名与本菜食材搜索，不再展示整餐搭配。'));const searchView=createView(dialog,true);document.body.append(dialog);
  dialog.addEventListener('close',()=>{syncScrollLock();launcher.focus({preventScroll:true});});

  const archive=document.getElementById('archive') || (/\/weeks\/index\.html$/.test(location.pathname)?document.querySelector('.wrap'):null);
  let weeksBox=null;
  function renderWeeks(){
   if(!weeksBox||!weeklyLinks.length)return;
   weeksBox.replaceChildren(el('p','library-caption','保留原来的每周安排，按月份查看。'));
   const list=el('ul','archive-list');let month='';
   weeklyLinks.forEach(item=>{const date=item.url.pathname.match(/(\d{4}-\d{2})-\d{2}/)[1];if(date!==month){list.append(el('li','archive-month',date.replace('-',' 年 ')+' 月'));month=date;}const li=el('li');const a=el('a','',item.label);a.href=item.url.href;li.append(a);list.append(li);});weeksBox.append(list);
   if(failures)weeksBox.append(el('p','dish-empty-note','部分菜单读取失败，可先按上方链接打开。'));
  }
  if(archive){
   const sourceNodes=[...archive.childNodes];weeksBox=el('div','library-weeks');weeksBox.append(...sourceNodes);weeksBox.hidden=true;
   const library=el('div','library-dishes');const heading=el('h2','','菜谱与往期');
   const subnav=el('div','library-tabs');subnav.setAttribute('aria-label','菜谱库或每周归档');
   const libraryButton=button('菜谱库',()=>showLibrary(true));const weeksButton=button('每周归档',()=>showLibrary(false));subnav.append(libraryButton,weeksButton);
   function showLibrary(on){library.hidden=!on;weeksBox.hidden=on;libraryButton.classList.toggle('active',on);weeksButton.classList.toggle('active',!on);libraryButton.setAttribute('aria-pressed',String(on));weeksButton.setAttribute('aria-pressed',String(!on));if(!loaded)load();}
   archive.append(heading,el('p','library-caption','一道菜一张便签，原来的周菜单也都在。'),subnav,library,weeksBox);
   createView(library,false);libraryButton.classList.add('active');libraryButton.setAttribute('aria-pressed','true');weeksButton.setAttribute('aria-pressed','false');
   function onArchive(){if(location.hash==='#archive'||!document.querySelector('.tab-panel')){if(!loaded)load();}}
   window.addEventListener('hashchange',onArchive);onArchive();
  }
  return {load,getCatalog:()=>dishes};
 }};
})();
