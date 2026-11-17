const DATA_URL = './loadout-data.json';
const STORAGE_KEY = 'sexsi-loadout-lab-v2';
const state = { items: [], category: 'all', search: '', model: 'all', collection: 'all', rarity: 'all' };
const $ = id => document.getElementById(id);
const keyOf = item => item.type + ':' + (item.id ?? item.name);
const knifeItems = () => state.items.filter(x => x.type === 'knife');
const gloveItems = () => state.items.filter(x => x.type === 'gloves');
let selectedKnifeKey = '';
let selectedGloveKey = '';

function option(label, value) {
  const el = document.createElement('option'); el.value = value; el.textContent = label; return el;
}
function fillSelect(id, items, selectedKey) {
  const select = $(id); select.innerHTML = '';
  items.forEach(item => select.append(option(item.name, keyOf(item))));
  if (selectedKey && items.some(x => keyOf(x) === selectedKey)) select.value = selectedKey;
}
function getByKey(key) { return state.items.find(x => keyOf(x) === key); }
function selected() { return { knife: getByKey(selectedKnifeKey), gloves: getByKey(selectedGloveKey) }; }

function imageOrPlaceholder(item, className = '') {
  const wrap = document.createElement('div'); wrap.className = 'item-image ' + className;
  if (item.image) {
    const img = document.createElement('img'); img.src = item.image; img.alt = item.name; img.loading = 'lazy'; img.decoding = 'async';
    img.onerror = () => { img.remove(); const fallback = document.createElement('span'); fallback.className = 'image-fallback'; fallback.textContent = item.model; wrap.append(fallback); };
    wrap.append(img);
  } else {
    const fallback = document.createElement('span'); fallback.className = 'image-fallback'; fallback.textContent = item.model; wrap.append(fallback);
  }
  return wrap;
}
function updateBuilder() {
  const chosen = selected(); if (!chosen.knife || !chosen.gloves) return;
  $('knifePreview').replaceChildren(imageOrPlaceholder(chosen.knife, 'preview-image'));
  $('glovePreview').replaceChildren(imageOrPlaceholder(chosen.gloves, 'preview-image'));
  $('chosenKnife').textContent = chosen.knife.name;
  $('chosenKnifeMeta').textContent = chosen.knife.model + ' · ' + chosen.knife.collection + ' · ' + chosen.knife.rarity;
  $('chosenGloves').textContent = chosen.gloves.name;
  $('chosenGlovesMeta').textContent = chosen.gloves.collection + ' · ' + chosen.gloves.rarity;
  $('comboText').textContent = chosen.knife.name + '  +  ' + chosen.gloves.name;
}
function updateFilters() {
  const visible = state.items.filter(x => state.category === 'all' || x.type === state.category);
  const models = [...new Set(visible.map(x => x.model))].sort();
  const collections = [...new Set(visible.map(x => x.collection))].sort();
  const modelSelect = $('modelFilter'), collectionSelect = $('collectionFilter');
  const oldModel = state.model, oldCollection = state.collection;
  modelSelect.innerHTML = ''; modelSelect.append(option('Всички модели', 'all'));
  models.forEach(x => modelSelect.append(option(x, x)));
  collectionSelect.innerHTML = ''; collectionSelect.append(option('Всички колекции', 'all'));
  collections.forEach(x => collectionSelect.append(option(x, x)));
  modelSelect.value = models.includes(oldModel) ? oldModel : 'all';
  collectionSelect.value = collections.includes(oldCollection) ? oldCollection : 'all';
  state.model = modelSelect.value; state.collection = collectionSelect.value;
}
function renderCatalog() {
  const filtered = state.items.filter(item => {
    const haystack = (item.name + ' ' + item.model + ' ' + item.collection + ' ' + item.rarity).toLowerCase();
    return (state.category === 'all' || item.type === state.category) &&
      (state.model === 'all' || item.model === state.model) &&
      (state.collection === 'all' || item.collection === state.collection) &&
      (state.rarity === 'all' || item.rarity === state.rarity) && haystack.includes(state.search);
  });
  $('catalogCount').textContent = filtered.length + ' предмета';
  $('catalogGrid').replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'no-results';
    empty.textContent = 'Няма намерени предмети за тези филтри.'; $('catalogGrid').append(empty); return;
  }
  const fragment = document.createDocumentFragment();
  filtered.forEach(item => {
    const card = document.createElement('article'); card.className = 'item-card'; card.append(imageOrPlaceholder(item));
    const info = document.createElement('div'); info.className = 'item-info';
    const top = document.createElement('div'); top.className = 'item-top';
    const name = document.createElement('strong'); name.textContent = item.name;
    const rarity = document.createElement('span'); rarity.className = 'tag'; rarity.textContent = item.rarity;
    top.append(name, rarity);
    const meta = document.createElement('p'); meta.textContent = item.model + ' · ' + item.collection;
    const btn = document.createElement('button'); btn.className = 'primary'; btn.type = 'button';
    const isSelected = item.type === 'knife' ? selectedKnifeKey === keyOf(item) : selectedGloveKey === keyOf(item);
    btn.textContent = isSelected ? 'ИЗБРАНО ✓' : item.type === 'knife' ? 'ИЗБЕРИ НОЖ' : 'ИЗБЕРИ РЪКАВИЦИ';
    btn.addEventListener('click', () => {
      if (item.type === 'knife') { selectedKnifeKey = keyOf(item); $('knifeSelect').value = selectedKnifeKey; }
      else { selectedGloveKey = keyOf(item); $('gloveSelect').value = selectedGloveKey; }
      updateBuilder(); renderCatalog();
    });
    info.append(top, meta, btn); card.append(info); fragment.append(card);
  });
  $('catalogGrid').append(fragment);
}
function readSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function renderSaved() {
  const list = readSaved(); $('savedCount').textContent = list.length;
  const root = $('savedLoadouts'); root.replaceChildren();
  if (!list.length) { const p = document.createElement('p'); p.className = 'empty-saved'; p.textContent = 'Все още нямаш запазени комплекти.'; root.append(p); return; }
  list.forEach((entry, index) => {
    const row = document.createElement('div'); row.className = 'saved-item';
    const info = document.createElement('div'), strong = document.createElement('strong'), small = document.createElement('small');
    strong.textContent = entry.knifeName; small.textContent = entry.gloveName; info.append(strong, small);
    const actions = document.createElement('div');
    const load = document.createElement('button'); load.className = 'secondary'; load.textContent = 'ЗАРЕДИ';
    load.addEventListener('click', () => {
      selectedKnifeKey = entry.knifeKey; selectedGloveKey = entry.gloveKey;
      $('knifeSelect').value = selectedKnifeKey; $('gloveSelect').value = selectedGloveKey;
      updateBuilder(); renderCatalog();
    });
    const remove = document.createElement('button'); remove.className = 'secondary'; remove.textContent = '✕'; remove.setAttribute('aria-label', 'Изтрий комплект');
    remove.addEventListener('click', () => { const next = readSaved(); next.splice(index, 1); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); renderSaved(); });
    actions.append(load, remove); row.append(info, actions); root.append(row);
  });
}
function setCategory(category) {
  state.category = category;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.category === category));
  state.model = 'all'; state.collection = 'all'; updateFilters(); renderCatalog();
}
function randomLoadout() {
  const knives = knifeItems(), gloves = gloveItems();
  const knife = knives[Math.floor(Math.random() * knives.length)], glove = gloves[Math.floor(Math.random() * gloves.length)];
  selectedKnifeKey = keyOf(knife); selectedGloveKey = keyOf(glove);
  $('knifeSelect').value = selectedKnifeKey; $('gloveSelect').value = selectedGloveKey;
  updateBuilder(); renderCatalog();
}
async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('catalog data unavailable');
    const payload = await response.json(); state.items = payload.items || [];
    const knives = knifeItems(), gloves = gloveItems();
    if (!knives.length || !gloves.length) throw new Error('catalog is empty');
    selectedKnifeKey = keyOf(knives[0]); selectedGloveKey = keyOf(gloves[0]);
    $('catalogSummary').textContent = knives.length + ' скина на ножове · ' + gloves.length + ' скина на ръкавици';
    fillSelect('knifeSelect', knives, selectedKnifeKey); fillSelect('gloveSelect', gloves, selectedGloveKey);
    $('knifeSelect').addEventListener('change', e => { selectedKnifeKey = e.target.value; updateBuilder(); renderCatalog(); });
    $('gloveSelect').addEventListener('change', e => { selectedGloveKey = e.target.value; updateBuilder(); renderCatalog(); });
    $('catalogSearch').addEventListener('input', e => { state.search = e.target.value.trim().toLowerCase(); renderCatalog(); });
    $('modelFilter').addEventListener('change', e => { state.model = e.target.value; renderCatalog(); });
    $('collectionFilter').addEventListener('change', e => { state.collection = e.target.value; renderCatalog(); });
    $('rarityFilter').addEventListener('change', e => { state.rarity = e.target.value; renderCatalog(); });
    document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setCategory(btn.dataset.category)));
    $('randomBtn').addEventListener('click', randomLoadout);
    $('resetBtn').addEventListener('click', () => {
      selectedKnifeKey = keyOf(knives[0]); selectedGloveKey = keyOf(gloves[0]);
      $('knifeSelect').value = selectedKnifeKey; $('gloveSelect').value = selectedGloveKey;
      updateBuilder(); renderCatalog();
    });
    $('saveBtn').addEventListener('click', () => {
      const chosen = selected(), list = readSaved();
      const entry = { knifeKey: selectedKnifeKey, gloveKey: selectedGloveKey, knifeName: chosen.knife.name, gloveName: chosen.gloves.name };
      if (!list.some(x => x.knifeKey === entry.knifeKey && x.gloveKey === entry.gloveKey)) list.unshift(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
      renderSaved(); $('saveBtn').textContent = 'ЗАПАЗЕНО ✓';
    });
    $('shareBtn').addEventListener('click', async () => {
      const chosen = selected(), text = 'SEXSI LOADOUT LAB\n' + chosen.knife.name + '\n' + chosen.gloves.name;
      try { await navigator.clipboard.writeText(text); $('shareBtn').textContent = 'КОПИРАНО ✓'; }
      catch { $('shareBtn').textContent = 'НЕУСПЕШНО КОПИРАНЕ'; }
    });
    updateFilters(); updateBuilder(); renderCatalog(); renderSaved();
  } catch (error) {
    $('catalogGrid').textContent = 'Каталогът не можа да се зареди. Презареди страницата след малко.';
    $('catalogSummary').textContent = 'Грешка при зареждане';
  }
}
init();