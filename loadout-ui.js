const ids = ['knife','knifeSkin','gloves','gloveColor'];
const $ = id => document.getElementById(id);
const combo = $('comboText');
function readLoadout(){ return Object.fromEntries(ids.map(id => [id,$(id).value])); }
function label(v=readLoadout()){ return v.knife+' · '+v.knifeSkin+' + '+v.gloves+' ('+v.gloveColor+')'; }
function update(){ combo.textContent=label(); }
function randomize(){ ids.forEach(id=>{const e=$(id);e.selectedIndex=Math.floor(Math.random()*e.options.length);});update(); }
function reset(){ids.forEach(id=>$(id).selectedIndex=0);update();}
ids.forEach(id=>$(id).addEventListener('change',update));
$('randomBtn').addEventListener('click',randomize);
$('resetBtn').addEventListener('click',reset);
const KEY='sexsi-loadout-lab-v1';
function saved(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return []}}
function render(){const root=$('savedLoadouts'),items=saved();$('savedCount').textContent=items.length;root.innerHTML='';
if(!items.length){root.innerHTML='<p class="empty-saved">Все още нямаш запазени комплекти.</p>';return;}
items.forEach((item,index)=>{const row=document.createElement('div');row.className='saved-item';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=item.knife+' + '+item.gloves;const sub=document.createElement('small');sub.textContent=item.knifeSkin+' · '+item.gloveColor;info.append(title,sub);const actions=document.createElement('div');
const load=document.createElement('button');load.type='button';load.textContent='ЗАРЕДИ';load.addEventListener('click',()=>{ids.forEach(id=>$(id).value=item[id]);update();});
const del=document.createElement('button');del.type='button';del.textContent='✕';del.setAttribute('aria-label','Изтрий комплект');del.addEventListener('click',()=>{const next=saved();next.splice(index,1);localStorage.setItem(KEY,JSON.stringify(next));render();});
actions.append(load,del);row.append(info,actions);root.append(row);});}
$('saveBtn').addEventListener('click',()=>{const list=saved(),v=readLoadout();if(list.some(x=>ids.every(id=>x[id]===v[id]))){$('saveBtn').textContent='ВЕЧЕ Е ЗАПАЗЕН';return;}list.unshift(v);localStorage.setItem(KEY,JSON.stringify(list.slice(0,20)));render();$('saveBtn').textContent='ЗАПАЗЕНО ✓';});
$('shareBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('SEXSI LOADOUT LAB: '+label());$('shareBtn').textContent='КОПИРАНО ✓';}catch(e){$('shareBtn').textContent='КОПИРАНЕТО НЕ Е ДОСТЪПНО';}});
render();update();