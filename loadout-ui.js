const $ = id => document.getElementById(id);
const KEY = 'sexsi-loadout-lab-v1';
const items = [
  {id:'Karambit',type:'knife',desc:'Извит профил с характерен пръстен на дръжката.',tag:'KNIFE',tone:'#ed343d',shape:'karambit'},
  {id:'Butterfly',type:'knife',desc:'Лек силует с две симетрични половини на дръжката.',tag:'KNIFE',tone:'#a9b6d4',shape:'butterfly'},
  {id:'Kunai',type:'knife',desc:'Тесен профил с ясно изразен връх и халка.',tag:'KNIFE',tone:'#4d9cba',shape:'kunai'},
  {id:'Fang',type:'knife',desc:'Агресивна форма с издължено острие.',tag:'KNIFE',tone:'#bd6c45',shape:'fang'},
  {id:'Sting',type:'knife',desc:'Компактен и изчистен дизайн.',tag:'KNIFE',tone:'#8b79d5',shape:'sting'},
  {id:'Retro Wave',type:'gloves',desc:'Контрастна визия с неонови акценти.',tag:'GLOVES',tone:'#e44c9b',shape:'gloves'},
  {id:'Living Flame',type:'gloves',desc:'Топли цветове и огнен характер.',tag:'GLOVES',tone:'#ef762f',shape:'gloves'},
  {id:'Tiger',type:'gloves',desc:'Тъмна основа с ярки златисти детайли.',tag:'GLOVES',tone:'#d5a52d',shape:'gloves'},
  {id:'Champion',type:'gloves',desc:'Изчистен спортен стил със светли акценти.',tag:'GLOVES',tone:'#aeb8c8',shape:'gloves'},
  {id:'Specialist',type:'gloves',desc:'Тактическа визия в зелени нюанси.',tag:'GLOVES',tone:'#54a78a',shape:'gloves'}
];
const state = {knife:'Karambit',gloves:'Retro Wave',category:'all',search:''};
const svg = shape => {
  if(shape==='gloves') return '<svg viewBox="0 0 140 140" fill="none" aria-hidden="true"><path d="M42 112 30 72q-3-10 5-13 7-3 11 7l-2-35q0-9 8-9t9 9l2 27 2-37q1-9 9-8 8 1 7 10l-1 36 5-28q2-9 10-7 8 2 6 11l-5 36 9-17q5-8 12-3 7 5 2 13l-18 38q-7 15-24 15H57q-11 0-15-10Z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="m42 85 20 8 28-2M57 63l1 19m17-25-1 26m20-18-4 18" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
  const blade = shape==='karambit'?'M70 22C35 35 33 72 62 84c-2-17 4-30 16-40-7 19-5 34 8 43 26-28 12-57-16-65Z':shape==='butterfly'?'M70 18 58 57 45 91 62 83 70 123 78 83 95 91 82 57Z':shape==='kunai'?'M70 16 49 68 70 87 91 68Z':shape==='fang'?'M70 17 46 70 61 65 67 113 91 55 78 61Z':'M70 18 49 72 70 112 91 72Z';
  return '<svg viewBox="0 0 140 140" fill="none" aria-hidden="true"><path d="'+blade+'" fill="currentColor" fill-opacity=".28" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M70 91v30" stroke="#c4a477" stroke-width="13" stroke-linecap="round"/><path d="M61 99h18M61 108h18" stroke="#332b29" stroke-width="3"/>'+(shape==='karambit'?'<circle cx="70" cy="126" r="9" stroke="#c4a477" stroke-width="5"/>':shape==='butterfly'?'<path d="M50 88 39 116m51-28 11 28" stroke="#c4a477" stroke-width="8" stroke-linecap="round"/>':shape==='kunai'?'<circle cx="70" cy="126" r="8" stroke="#c4a477" stroke-width="4"/>':'')+'</svg>';
};
function read(){return {knife:state.knife,knifeSkin:$('knifeSkin').value,gloves:state.gloves,gloveColor:$('gloveColor').value};}
function label(v=read()){return v.knife+' · '+v.knifeSkin+' + '+v.gloves+' ('+v.gloveColor+')';}
function update(){
  $('chosenKnife').textContent=state.knife;
  $('chosenSkin').textContent=$('knifeSkin').value+' finish';
  $('chosenGloves').textContent=state.gloves;
  $('chosenColor').textContent=$('gloveColor').value;
  $('comboText').textContent=label();
}
function renderCatalog(){
  const filtered=items.filter(item=>(state.category==='all'||item.type===state.category)&&item.id.toLowerCase().includes(state.search));
  $('catalogCount').textContent=filtered.length+' предмета';
  const root=$('catalogGrid');root.innerHTML='';
  if(!filtered.length){root.innerHTML='<div class="no-results">Няма намерени предмети.</div>';return;}
  filtered.forEach(item=>{
    const card=document.createElement('article');card.className='item-card';
    const art=document.createElement('div');art.className='art';art.style.setProperty('--artglow',item.tone+'55');art.style.color=item.tone;art.innerHTML=svg(item.shape);
    const info=document.createElement('div');info.className='item-info';
    const top=document.createElement('div');top.className='item-top';
    const title=document.createElement('strong');title.textContent=item.id;
    const tag=document.createElement('span');tag.className='tag';tag.textContent=item.tag;
    top.append(title,tag);
    const desc=document.createElement('p');desc.textContent=item.desc;
    const btn=document.createElement('button');btn.className='primary';btn.type='button';btn.textContent=(item.type==='knife'?state.knife===item.id:state.gloves===item.id)?'ИЗБРАНО ✓':'ИЗБЕРИ ПРЕДМЕТ';
    btn.addEventListener('click',()=>{if(item.type==='knife')state.knife=item.id;else state.gloves=item.id;update();renderCatalog();});
    info.append(top,desc,btn);card.append(art,info);root.append(card);
  });
}
function saved(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return []}}
function renderSaved(){
  const root=$('savedLoadouts'),list=saved();$('savedCount').textContent=list.length;root.innerHTML='';
  if(!list.length){root.innerHTML='<p class="empty-saved">Все още нямаш запазени комплекти.</p>';return;}
  list.forEach((item,index)=>{
    const row=document.createElement('div');row.className='saved-item';
    const info=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small');
    title.textContent=item.knife+' + '+item.gloves;sub.textContent=item.knifeSkin+' · '+item.gloveColor;info.append(title,sub);
    const actions=document.createElement('div');
    const load=document.createElement('button');load.className='secondary';load.type='button';load.textContent='ЗАРЕДИ';load.addEventListener('click',()=>{state.knife=item.knife;state.gloves=item.gloves;$('knifeSkin').value=item.knifeSkin;$('gloveColor').value=item.gloveColor;update();renderCatalog();});
    const del=document.createElement('button');del.className='secondary';del.type='button';del.textContent='✕';del.setAttribute('aria-label','Изтрий комплект');del.addEventListener('click',()=>{const next=saved();next.splice(index,1);localStorage.setItem(KEY,JSON.stringify(next));renderSaved();});
    actions.append(load,del);row.append(info,actions);root.append(row);
  });
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{state.category=btn.dataset.category;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===btn));renderCatalog();}));
$('catalogSearch').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();renderCatalog();});
$('knifeSkin').addEventListener('change',update);$('gloveColor').addEventListener('change',update);
$('randomBtn').addEventListener('click',()=>{const knives=items.filter(x=>x.type==='knife'),gloves=items.filter(x=>x.type==='gloves');state.knife=knives[Math.floor(Math.random()*knives.length)].id;state.gloves=gloves[Math.floor(Math.random()*gloves.length)].id;$('knifeSkin').selectedIndex=Math.floor(Math.random()*$('knifeSkin').options.length);$('gloveColor').selectedIndex=Math.floor(Math.random()*$('gloveColor').options.length);update();renderCatalog();});
$('resetBtn').addEventListener('click',()=>{state.knife='Karambit';state.gloves='Retro Wave';$('knifeSkin').selectedIndex=0;$('gloveColor').selectedIndex=0;update();renderCatalog();});
$('saveBtn').addEventListener('click',()=>{const list=saved(),v=read();if(list.some(x=>['knife','knifeSkin','gloves','gloveColor'].every(k=>x[k]===v[k]))){$('saveBtn').textContent='ВЕЧЕ Е ЗАПАЗЕН';return;}list.unshift(v);localStorage.setItem(KEY,JSON.stringify(list.slice(0,20)));renderSaved();$('saveBtn').textContent='ЗАПАЗЕНО ✓';});
$('shareBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('SEXSI LOADOUT LAB: '+label());$('shareBtn').textContent='КОПИРАНО ✓';}catch(e){$('shareBtn').textContent='КОПИРАНЕТО НЕ Е ДОСТЪПНО';}});
update();renderCatalog();renderSaved();
