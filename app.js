/* ===== Noelle West Retail Calculator - app.js ===== */
/* Live data from Google Sheets via CSV export        */

window.latestSubmissionText = '';

/* ── Config ──────────────────────────────────────────────────────────────── */
const SHEET_ID  = '1-QD9UJ99Rjl1JPlBdKPo7hz5MBOiJKkMyD-qWlD520s';
const CSV_BASE  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=`;

// Retail-eligible tracked sheets in display order.
// label = what shows in the UI, sheet = exact tab name in Google Sheets.
// priceHeader = column header text to look for (case-insensitive partial match).
const RETAIL_SHEETS = [
  { label: 'BGI',     sheet: 'BGI',     priceHeader: 'retail' },
  { label: 'BGS',     sheet: 'BGS',     priceHeader: 'retail' },
  { label: 'PGI',     sheet: 'PGI',     priceHeader: 'retail' },
  { label: 'PGS',     sheet: 'PGS',     priceHeader: 'retail' },
  { label: 'PGC',     sheet: 'PGC',     priceHeader: 'retail' },
  { label: 'FIL',     sheet: 'FIL',     priceHeader: 'retail' },
  { label: 'MG',      sheet: 'MG',      priceHeader: 'retail' },
  { label: 'CD',      sheet: 'CD',      priceHeader: 'retail' },
  { label: 'MS',      sheet: 'MS',      priceHeader: 'retail' },
  { label: 'CS',      sheet: 'CS',      priceHeader: 'retail' },
  { label: 'S-UPPER', sheet: 'S-UPPER', priceHeader: 'retail' },
];

/* ── State ───────────────────────────────────────────────────────────────── */
let allItems       = [];   // [{category, name, retailPrice}]
let cart           = [];   // [{category, name, retailPrice}]
let itemSelectInst = null;

/* ── Utility ─────────────────────────────────────────────────────────────── */
function money(n) {
  if (n == null || isNaN(n)) return '—';
  return '₱' + Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  });
}
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function parsePrice(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/[₱,\s]/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

/* ── CSV parser (RFC-4180) ───────────────────────────────────────────────── */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')             { inQuote = false; }
      else                             { field += ch; }
    } else {
      if      (ch === '"')  { inQuote = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else                  { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ── Fetch one sheet ─────────────────────────────────────────────────────── */
async function fetchSheet({ label, sheet, priceHeader }) {
  const url = CSV_BASE + encodeURIComponent(sheet);
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for "${sheet}"`);
  const rows = parseCSV(await res.text());
  if (rows.length < 2) return [];

  const headers  = rows[0].map(h => h.trim().toLowerCase());
  const nameCol  = 0;
  const priceCol = headers.findIndex(h => h.includes(priceHeader));
  if (priceCol === -1) return [];

  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row   = rows[r];
    const name  = (row[nameCol] || '').trim();
    if (!name || name.toLowerCase() === 'nan') continue;
    const price = parsePrice(row[priceCol]);
    if (price == null) continue;
    items.push({ category: label, name, retailPrice: price });
  }
  return items;
}

/* ── Load all sheets in parallel ─────────────────────────────────────────── */
async function loadAllSheets() {
  showLoading(true, `Loading inventory (0 / ${RETAIL_SHEETS.length})…`);

  let done = 0;
  const results = await Promise.allSettled(
    RETAIL_SHEETS.map(cfg =>
      fetchSheet(cfg).then(items => {
        done++;
        showLoading(true, `Loading inventory (${done} / ${RETAIL_SHEETS.length})…`);
        return items;
      })
    )
  );

  allItems = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      allItems.push(...r.value);
    } else {
      console.warn(`Sheet "${RETAIL_SHEETS[i].sheet}" skipped:`, r.reason);
    }
  });

  showLoading(false);

  if (!allItems.length) {
    showError('No retail items found. Check that the Google Sheet is publicly shared.');
    return;
  }

  init();
}

function showLoading(on, msg) {
  const bar  = document.getElementById('loadingBar');
  const main = document.getElementById('mainContent');
  bar.style.display  = on ? 'flex' : 'none';
  main.style.display = on ? 'none'  : 'block';
  if (msg) {
    const lbl = document.getElementById('loadingLabel');
    if (lbl) lbl.textContent = msg;
  }
}

function showError(msg) {
  const el = document.getElementById('loadError');
  el.textContent = msg;
  el.style.display = 'block';
}

/* ── Init ────────────────────────────────────────────────────────────────── */
function init() {
  populateCategorySelect();
  renderCart();
  updateJotform();

  document.getElementById('categorySelect').addEventListener('change', onCategoryChange);
  document.getElementById('addBtn').addEventListener('click', addItem);
  document.getElementById('itemsList').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove');
    if (btn) removeItem(btn.dataset.name, btn.dataset.cat);
  });

  if (window.JFCustomWidget) {
    JFCustomWidget.subscribe('submit', function () {
      updateJotform();
      JFCustomWidget.sendSubmit({
        valid: true,
        value: window.latestSubmissionText || 'No items selected'
      });
    });
  }
}

/* ── Category select ─────────────────────────────────────────────────────── */
function populateCategorySelect() {
  // Use RETAIL_SHEETS order, only show categories that actually loaded items
  const loadedCats = new Set(allItems.map(i => i.category));
  const sel = document.getElementById('categorySelect');
  sel.innerHTML = '<option value="">— Select category —</option>';
  RETAIL_SHEETS.forEach(({ label }) => {
    if (!loadedCats.has(label)) return;
    const opt = document.createElement('option');
    opt.value = label; opt.textContent = label;
    sel.appendChild(opt);
  });
}

function onCategoryChange() {
  const cat   = document.getElementById('categorySelect').value;
  const valEl = document.getElementById('priceVal');
  document.getElementById('dupWarning').classList.remove('visible');
  valEl.textContent = 'Select an item';
  valEl.classList.add('empty');

  if (!cat) {
    if (itemSelectInst) { itemSelectInst.destroy(); itemSelectInst = null; }
    document.getElementById('addBtn').disabled = true;
    return;
  }
  buildItemSelect(cat);
  document.getElementById('addBtn').disabled = false;
}

/* ── Tom Select ──────────────────────────────────────────────────────────── */
function availableOptions(cat) {
  const inCart = new Set(cart.map(c => c.name + '|' + c.category));
  return allItems
    .filter(i => i.category === cat && !inCart.has(i.name + '|' + i.category))
    .map(i => ({ value: i.name, text: i.name, price: i.retailPrice }));
}

function buildItemSelect(cat) {
  const el = document.getElementById('itemSelect');
  if (itemSelectInst) { itemSelectInst.destroy(); itemSelectInst = null; }
  itemSelectInst = new TomSelect(el, {
    options: availableOptions(cat),
    valueField: 'value',
    labelField:  'text',
    searchField: ['text'],
    placeholder: 'Search item…',
    maxOptions:  200,
    onChange(val) { onItemChange(val); },
    render: {
      option(data, escape) {
        return `<div style="display:flex;justify-content:space-between;gap:8px">
          <span>${escape(data.text)}</span>
          <span style="color:var(--text-muted);font-size:12px;white-space:nowrap">
            ${money(data.price)}
          </span>
        </div>`;
      }
    }
  });
}

function onItemChange(name) {
  const cat   = document.getElementById('categorySelect').value;
  const item  = allItems.find(i => i.name === name && i.category === cat);
  const valEl = document.getElementById('priceVal');
  const warn  = document.getElementById('dupWarning');
  warn.classList.remove('visible');
  if (item) {
    valEl.textContent = money(item.retailPrice);
    valEl.classList.remove('empty');
    if (cart.find(c => c.name === name && c.category === cat)) {
      warn.textContent = `"${name}" is already in your list.`;
      warn.classList.add('visible');
    }
  } else {
    valEl.textContent = 'Select an item';
    valEl.classList.add('empty');
  }
}

/* ── Add item ────────────────────────────────────────────────────────────── */
function addItem() {
  const cat  = document.getElementById('categorySelect').value;
  const name = itemSelectInst ? itemSelectInst.getValue() : '';
  if (!cat || !name) return;
  if (cart.find(c => c.name === name && c.category === cat)) return;
  const item = allItems.find(i => i.name === name && i.category === cat);
  if (!item) return;

  cart.push({ ...item });
  itemSelectInst.setValue('');
  document.getElementById('priceVal').textContent = 'Select an item';
  document.getElementById('priceVal').classList.add('empty');
  document.getElementById('dupWarning').classList.remove('visible');
  buildItemSelect(cat);

  renderCart();
  updateJotform();
}

/* ── Remove item ─────────────────────────────────────────────────────────── */
function removeItem(name, category) {
  cart = cart.filter(c => !(c.name === name && c.category === category));
  const cat = document.getElementById('categorySelect').value;
  if (cat === category && itemSelectInst) buildItemSelect(cat);
  renderCart();
  updateJotform();
}

/* ── Render cart ─────────────────────────────────────────────────────────── */
function renderCart() {
  const list    = document.getElementById('itemsList');
  const emptyEl = document.getElementById('itemsEmpty');
  const badge   = document.getElementById('itemsBadge');
  const countEl = document.getElementById('itemCount');
  const totalEl = document.getElementById('grandTotal');

  badge.textContent   = cart.length;
  countEl.textContent = cart.length === 1 ? '1 item' : `${cart.length} items`;

  if (!cart.length) {
    list.innerHTML = '';
    emptyEl.style.display = 'block';
    totalEl.textContent   = '₱0';
    return;
  }

  emptyEl.style.display = 'none';
  let total = 0;
  list.innerHTML = '';

  cart.forEach(item => {
    total += item.retailPrice;
    const div = document.createElement('div');
    div.className = 'rental-item';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-name">${esc(item.name)}</div>
        <div class="item-meta">${esc(item.category)}</div>
      </div>
      <div class="item-amount">${money(item.retailPrice)}</div>
      <button class="btn-remove"
        data-name="${esc(item.name)}"
        data-cat="${esc(item.category)}"
        title="Remove">✕</button>
    `;
    list.appendChild(div);
  });

  totalEl.textContent = money(total);
}

/* ── Jotform output ──────────────────────────────────────────────────────── */
function updateJotform() {
  const lines = cart.map(i =>
    `Product Name: ${i.name}, Amount: ${Math.round(i.retailPrice)}`
  );
  window.latestSubmissionText = lines.length ? lines.join('\n') : 'No items selected';

  // Primary: Jotform widget API
  if (window.JFCustomWidget && typeof JFCustomWidget.sendData === 'function') {
    JFCustomWidget.sendData({ value: window.latestSubmissionText });
  }

  // Fallback: directly write into #input_116 on the parent Jotform page
  try {
    const target =
      document.getElementById('input_116') ||
      (window.parent && window.parent.document.getElementById('input_116'));
    if (target) {
      target.value = window.latestSubmissionText;
      target.dispatchEvent(new Event('input',  { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (e) { /* cross-origin — silently ignored */ }
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
loadAllSheets();
