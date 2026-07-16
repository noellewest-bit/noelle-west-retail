/* ══════════════════════════════════════════════
   NOELLE WEST COMBINED TRANSACTION CALCULATOR
   Package + Rental + Retail in one widget
══════════════════════════════════════════════ */

const SHEET_ID   = "1-QD9UJ99Rjl1JPlBdKPo7hz5MBOiJKkMyD-qWlD520s";
const API_KEY    = "6b9359da26ff8421a11c7f9dca4553a9";
const CSV_BASE   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;

/* ── Sheet configs ── */
const PKG_SHEETS = [
  "BGS","BGI","PGS","PGI","MOH","BMG","FGG","PGC","FIL",
  "MG","CD","MS","CS","PET-#","PET","BCPO","BOY","BPSC",
  "BPO","BPOL","BPS","COAT BARONG","BCC","BPOC","VST",
  "S-UPPER","POLO","ACC","PEN","PANTS","PACKAGE COLORS",
  "BGI-ADD ON","PGI-ADD ON"
];

const PKG_ADDON_CATS = [
  "BGS","BGI-ADD ON","PGS","PGI-ADD ON","MOH","BMG","FGG","PGC","FIL",
  "MG","CD","MS","CS","PET-#","PET","BCPO","BOY","BPSC",
  "BPO","BPOL","BPS","COAT BARONG","BCC","BPOC","VST",
  "S-UPPER","POLO","ACC","PEN","PANTS"
];

const BG_CATS  = ["BGI","BGS","PGI","PGS","CD"];
const MG_CATS  = ["MG","PGI","PGS","CD","BGI","BGS"];

const RENTAL_TRACKED_CATS = [
  "BGI","BGS","PGI","PGS","PGC","FIL","MG","CD","MS","CS","S-UPPER","PET-#"
];
const RENTAL_QTY_CATS = [
  "BCPO","BOY","BPSC","BPO","BPOL","BPS","COAT BARONG","BCC","BPOC",
  "VST","POLO","ACC","PEN","PANTS","MOH","BMG","FGG","PET"
];

const RETAIL_SHEETS = [
  { label: "BGI",     gid: "189628887"  },
  { label: "BGS",     gid: "1149316761" },
  { label: "PGI",     gid: "1078506480" },
  { label: "PGS",     gid: "1175324516" },
  { label: "PGC",     gid: "1142319531" },
  { label: "FIL",     gid: "1338479475" },
  { label: "MG",      gid: "479297482"  },
  { label: "CD",      gid: "159828861"  },
  { label: "MS",      gid: "810437052"  },
  { label: "CS",      gid: "1877793641" },
  { label: "S-UPPER", gid: "1177779497" },
];

/* ── Package prices ── */
const packageNames = {
  "5200": "PACKAGE 1C (SPANDEX)",
  "6200": "PACKAGE 2C (CHIFFON)",
  "7000": "PACKAGE 3C (SPANDEX)",
  "8200": "PACKAGE 4C (CHIFFON)"
};
const packagePrices = {
  "5200": {
    bridal_gown: ["Bridal Gown",   600.00], groom: ["Groom Barong",  175.00],
    maid:        ["Maid of Honor", 280.50], bridesmaid: ["Bridesmaid", 280.50],
    flower:      ["Flower Girl",   196.35], child: ["BPO Child",       84.15],
    mother:      ["Mother's Gown", 252.45], men:   ["Men's Barong",   100.98]
  },
  "6200": {
    bridal_gown: ["Bridal Gown",   659.04], groom: ["Groom Barong",  192.22],
    maid:        ["Maid of Honor", 384.44], bridesmaid: ["Bridesmaid", 384.44],
    flower:      ["Flower Girl",   302.06], child: ["BPO Child",       82.38],
    mother:      ["Mother's Gown", 247.14], men:   ["Men's Barong",    98.86]
  },
  "7000": {
    bridal_gown: ["Bridal Gown",   615.48], groom: ["Groom Suit",    461.61],
    maid:        ["Maid of Honor", 256.45], bridesmaid: ["Bridesmaid", 256.45],
    flower:      ["Flower Girl",   179.52], child: ["Child Suit",     256.45],
    mother:      ["Mother's Gown", 230.81], men:   ["Men's Set",      282.10]
  },
  "8200": {
    bridal_gown: ["Bridal Gown",   620.88], groom: ["Groom Suit",    465.66],
    maid:        ["Maid of Honor", 362.18], bridesmaid: ["Bridesmaid", 362.18],
    flower:      ["Flower Girl",   284.57], child: ["Child Suit",     258.70],
    mother:      ["Mother's Gown", 232.83], men:   ["Men's Set",      284.57]
  }
};
const pkgKeys = Object.keys(packagePrices["5200"]);

/* ── State ── */
const sheetData    = {};   // package + rental sheets keyed by name
let rentalMaster   = [];   // [{category, name, rentalRate, firstUserPrice, type}]
let retailItems    = [];   // [{category, name, retailPrice}]
let rentalCart     = [];
let retailCart     = [];
let dataReady      = false;
window.latestSubmissionText = "";
window._jfSid      = null;

/* ── Helpers ── */
function money(n) {
  return Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function moneyPlain(n) { return money(n); }
function uid() { return Math.random().toString(36).slice(2, 9); }
function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function cleanPrice(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/₱/g,"").replace(/,/g,"").replace(/\s/g,"").trim();
  if (!s || s.toLowerCase() === "nan") return null;
  const f = parseFloat(s);
  return isNaN(f) ? null : (f >= 0 ? f : null);
}

/* ══════════════════════════════════════════════
   CSV PARSER
══════════════════════════════════════════════ */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i+1];
    if (inQ) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field.trim()); field = ""; }
      else if (c === '\n' || (c === '\r' && n === '\n')) {
        if (c === '\r') i++;
        row.push(field.trim()); rows.push(row); row = []; field = "";
      } else { field += c; }
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ""));
}

/* ══════════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════════ */
async function fetchSheetCSV(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet "${sheetName}" failed: ${res.status}`);
  return parseCSV(await res.text());
}

async function fetchSheetByGid(gid) {
  const res = await fetch(CSV_BASE + gid);
  if (!res.ok) throw new Error(`GID ${gid} failed`);
  return parseCSV(await res.text());
}

async function loadAllData() {
  // Load package + rental sheets (same sheets, same data, different columns used)
  await Promise.allSettled(PKG_SHEETS.map(async name => {
    try {
      const rows = await fetchSheetCSV(name);
      if (!rows.length) return;
      const headers = rows[0].map(h => h.toUpperCase().trim());
      let rentalCol = -1, retailCol = -1, fuCol = -1;
      headers.forEach((h, i) => {
        if (i === 0) return;
        if (rentalCol === -1 && (
          (h.includes("RENTAL") && (h.includes("RATE") || h.includes("FEE") || h.includes("PRICE"))) ||
          h === "RENTAL" || h === "RATE" || h === "PRICE" || h === "AMOUNT"
        )) rentalCol = i;
        if (h.includes("RETAIL") && h.includes("PRICE")) retailCol = i;
        if (h.includes("FIRST") && h.includes("USER")) fuCol = i;
      });
      if (rentalCol === -1 && headers.length >= 2) rentalCol = 1;

      const items = [];
      for (let r = 1; r < rows.length; r++) {
        const row  = rows[r];
        const code = row[0]?.trim();
        if (!code) continue;
        const rentalRate     = rentalCol >= 0 ? cleanPrice(row[rentalCol]) : null;
        const firstUserPrice = fuCol     >= 0 ? cleanPrice(row[fuCol])     : null;
        const retailPrice    = retailCol >= 0 ? cleanPrice(row[retailCol]) : null;
        items.push({ code, rentalRate, firstUserPrice, retailPrice });
      }
      sheetData[name] = items;

      // Build rental master list from rental sheets
      const isQty = RENTAL_QTY_CATS.includes(name);
      const isTrk = RENTAL_TRACKED_CATS.includes(name);
      if (isQty || isTrk) {
        for (const item of items) {
          const effectiveRental = (isQty && item.rentalRate == null) ? 0 : item.rentalRate;
          rentalMaster.push({
            category: name,
            name: item.code,
            rentalRate: effectiveRental,
            firstUserPrice: item.firstUserPrice,
            type: isQty ? "QUANTITY" : "TRACKED"
          });
        }
      }
    } catch(e) {
      sheetData[name] = [];
      console.warn("Sheet failed:", name, e.message);
    }
  }));

  // Load retail sheets (by gid for retail price column)
  await Promise.allSettled(RETAIL_SHEETS.map(async ({ label, gid }) => {
    try {
      const rows = await fetchSheetByGid(gid);
      if (rows.length < 2) return;
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const priceCol = headers.findIndex(h => h.includes("retail"));
      if (priceCol === -1) return;
      for (let r = 1; r < rows.length; r++) {
        const row  = rows[r];
        const name = (row[0] || "").trim();
        if (!name || name.toLowerCase() === "nan") continue;
        const price = cleanPrice(row[priceCol]);
        if (price == null) continue;
        retailItems.push({ category: label, name, retailPrice: price });
      }
    } catch(e) { console.warn("Retail sheet failed:", label, e.message); }
  }));

  // Populate package color dropdown
  const colors = sheetData["PACKAGE COLORS"] || [];
  const colorSel = document.getElementById("packageColor");
  colors.forEach(({ code }) => {
    if (!code) return;
    const opt = document.createElement("option");
    opt.value = code; opt.textContent = code;
    colorSel.appendChild(opt);
  });

  dataReady = true;
  document.getElementById("loadingOverlay").style.display = "none";

  // Build all UIs
  renderPackage();
  buildRentalTrackedPanel();
  buildRentalQtyPanel();
  buildRetailPanel();

  // Restore if we captured data from ready event
  if (window._savedRestoreText) {
    await restoreFromSummary(window._savedRestoreText);
    window._savedRestoreText = null;
  }

  updateGrandTotal();
}

/* ══════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════ */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
  });
});

document.querySelectorAll(".sub-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sub-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const sub = btn.dataset.subtab;
    document.getElementById("rental-panel-tracked").style.display = sub === "tracked" ? "" : "none";
    document.getElementById("rental-panel-quantity").style.display = sub === "quantity" ? "" : "none";
  });
});

/* ══════════════════════════════════════════════
   SEARCHABLE SELECT COMPONENT
══════════════════════════════════════════════ */
function createSearchSelect(inputId, dropId, options, onSelect) {
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropId);
  let allOpts = [...options];
  let selected = "";

  function buildList(filter) {
    drop.innerHTML = "";
    const lower = filter.toLowerCase();
    const filtered = allOpts.filter(o => o.toLowerCase().includes(lower));
    if (!filtered.length) {
      drop.innerHTML = '<div class="dropdown-item no-results">No results</div>';
    } else {
      filtered.slice(0, 200).forEach(o => {
        const d = document.createElement("div");
        d.className = "dropdown-item";
        d.textContent = o;
        d.addEventListener("mousedown", e => {
          e.preventDefault();
          selected = o;
          input.value = o;
          drop.classList.remove("open");
          onSelect(o);
        });
        drop.appendChild(d);
      });
    }
  }

  input.addEventListener("focus", () => { buildList(input.value); drop.classList.add("open"); });
  input.addEventListener("input", () => { selected = ""; buildList(input.value); drop.classList.add("open"); });
  input.addEventListener("blur",  () => {
    setTimeout(() => {
      drop.classList.remove("open");
      if (input.value !== selected) input.value = selected;
    }, 150);
  });

  return {
    getValue: () => selected,
    setValue: (v) => { selected = v; input.value = v; },
    setOptions: (opts) => { allOpts = [...opts]; selected = ""; input.value = ""; },
    reset: () => { selected = ""; input.value = ""; allOpts = []; }
  };
}

/* ══════════════════════════════════════════════
   PACKAGE CALCULATOR
══════════════════════════════════════════════ */
function renderPackage() {
  const pkg  = document.getElementById("packageType").value;
  const wrap = document.getElementById("itemRows");
  wrap.innerHTML = "";

  pkgKeys.forEach(k => {
    const [name, price] = packagePrices[pkg][k];
    const row = document.createElement("div");
    row.className = "pkg-row";
    row.dataset.k = k;

    const labelCol = document.createElement("div");
    const itemLabel = document.createElement("div");
    itemLabel.className = "item-label";
    itemLabel.textContent = name;
    labelCol.appendChild(itemLabel);

    if (k === "bridal_gown") {
      const pc = document.createElement("div");
      pc.id = "bgPickers"; pc.className = "gown-pickers";
      labelCol.appendChild(pc);
    }
    if (k === "mother") {
      const pc = document.createElement("div");
      pc.id = "mgPickers"; pc.className = "gown-pickers";
      labelCol.appendChild(pc);
    }

    const qtyCol = document.createElement("div");
    const qtyInput = document.createElement("input");
    qtyInput.type = "number"; qtyInput.min = "0"; qtyInput.step = "1";
    qtyInput.value = "0"; qtyInput.dataset.k = k;
    qtyInput.className = "package-qty";
    qtyCol.appendChild(qtyInput);

    const priceCol = document.createElement("div");
    priceCol.className = "unit-price";
    priceCol.innerHTML = `₱&nbsp;${money(price)}`;

    const subCol = document.createElement("div");
    subCol.className = "subtotal-val";
    subCol.innerHTML = `₱&nbsp;<span id="sub_${k}">0.00</span>`;

    row.appendChild(labelCol); row.appendChild(qtyCol);
    row.appendChild(priceCol); row.appendChild(subCol);
    wrap.appendChild(row);

    qtyInput.addEventListener("input", () => {
      const q = Math.max(0, parseInt(qtyInput.value) || 0);
      if (k === "bridal_gown") buildGownPickers("bgPickers", q, BG_CATS, "Bridal Gown");
      if (k === "mother")      buildGownPickers("mgPickers", q, MG_CATS, "Mother's Gown");
      updateGrandTotal();
    });
  });

  updateGrandTotal();
}

function buildGownPickers(containerId, qty, allowedCats, labelPrefix) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (qty <= 0) return;

  for (let i = 0; i < qty; i++) {
    const set = document.createElement("div");
    set.className = "gown-picker-set";

    const label = document.createElement("div");
    label.className = "gown-picker-label";
    label.textContent = qty === 1 ? `${labelPrefix} Item Code` : `${labelPrefix} #${i+1} Item Code`;
    set.appendChild(label);

    const row = document.createElement("div");
    row.className = "gown-picker-row";

    const catSel = document.createElement("select");
    catSel.className = "gown-cat-sel";
    const defOpt = document.createElement("option");
    defOpt.value = ""; defOpt.textContent = "— Category —";
    catSel.appendChild(defOpt);
    allowedCats.forEach(cat => {
      const o = document.createElement("option");
      o.value = cat; o.textContent = cat;
      catSel.appendChild(o);
    });

    const itemWrap = document.createElement("div");
    const itemSearch = createSearchSelectInline(allowedCats, catSel, () => updateGrandTotal());
    itemWrap.appendChild(itemSearch.el);

    catSel.addEventListener("change", () => {
      const cat = catSel.value;
      itemSearch.setOptions(cat && sheetData[cat] ? sheetData[cat].map(r => r.code) : []);
      updateGrandTotal();
    });

    row.appendChild(catSel);
    row.appendChild(itemWrap);
    set.appendChild(row);
    container.appendChild(set);
  }
}

function createSearchSelectInline(allowedCats, catSel, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "search-container";
  const input = document.createElement("input");
  input.type = "text"; input.className = "search-input gown-item-sel";
  input.placeholder = "— Item Code —"; input.autocomplete = "off";
  const drop = document.createElement("div");
  drop.className = "search-dropdown";
  wrap.appendChild(input); wrap.appendChild(drop);

  let selected = "", allOpts = [];

  function buildList(filter) {
    drop.innerHTML = "";
    const lower = filter.toLowerCase();
    const filtered = allOpts.filter(o => o.toLowerCase().includes(lower));
    if (!filtered.length) {
      drop.innerHTML = '<div class="dropdown-item no-results">No results</div>';
    } else {
      filtered.slice(0, 200).forEach(o => {
        const d = document.createElement("div");
        d.className = "dropdown-item";
        d.textContent = o;
        d.addEventListener("mousedown", e => {
          e.preventDefault();
          selected = o; input.value = o;
          drop.classList.remove("open");
          onChange();
        });
        drop.appendChild(d);
      });
    }
  }

  input.addEventListener("focus", () => { buildList(input.value); drop.classList.add("open"); });
  input.addEventListener("input", () => { selected = ""; buildList(input.value); drop.classList.add("open"); onChange(); });
  input.addEventListener("blur",  () => {
    setTimeout(() => { drop.classList.remove("open"); if (input.value !== selected) input.value = selected; }, 150);
  });

  return {
    el: wrap,
    getValue: () => selected,
    setValue: (v) => { selected = v; input.value = v; },
    setOptions: (opts) => { allOpts = [...opts]; selected = ""; input.value = ""; }
  };
}

/* Add-on rows */
function addAddonRow() {
  const row = document.createElement("div");
  row.className = "addon-row";

  const catSel = document.createElement("select");
  catSel.className = "addon-cat";
  const defOpt = document.createElement("option");
  defOpt.value = ""; defOpt.textContent = "— Category —";
  catSel.appendChild(defOpt);
  PKG_ADDON_CATS.forEach(cat => {
    const o = document.createElement("option");
    o.value = cat; o.textContent = cat;
    catSel.appendChild(o);
  });

  const regularSpan = document.createElement("div");
  regularSpan.className = "addon-regular-val";
  regularSpan.textContent = "—";

  const priceTypeSel = document.createElement("select");
  priceTypeSel.className = "addon-price-type";
  priceTypeSel.style.display = "none";

  function applySelectedPrice() {
    const found = row._foundItem;
    if (!found) { row._activeRate = 0; regularSpan.textContent = "—"; updateGrandTotal(); return; }
    const type  = priceTypeSel.value;
    const price = (type === "firstuser" && found.firstUserPrice != null)
      ? found.firstUserPrice : (found.rentalRate ?? 0);
    row._activeRate = price;
    regularSpan.textContent = price ? `₱ ${money(price)}` : "—";
    updateGrandTotal();
  }

  function updatePriceType() {
    const found = row._foundItem;
    if (!found) { priceTypeSel.style.display = "none"; return; }
    const hasR = found.rentalRate != null;
    const hasF = found.firstUserPrice != null;
    priceTypeSel.innerHTML = "";
    if (hasR) { const o = document.createElement("option"); o.value = "rental"; o.textContent = "Rental Rate"; priceTypeSel.appendChild(o); }
    if (hasF) { const o = document.createElement("option"); o.value = "firstuser"; o.textContent = "First User"; priceTypeSel.appendChild(o); }
    priceTypeSel.style.display = (hasR && hasF) ? "" : "none";
    applySelectedPrice();
  }

  priceTypeSel.addEventListener("change", applySelectedPrice);

  const itemInput = document.createElement("input");
  itemInput.type = "text"; itemInput.className = "search-input addon-item-input";
  itemInput.placeholder = "— Item Code —"; itemInput.autocomplete = "off";
  const itemDrop = document.createElement("div");
  itemDrop.className = "search-dropdown";
  const itemWrap = document.createElement("div");
  itemWrap.className = "search-container";
  itemWrap.appendChild(itemInput); itemWrap.appendChild(itemDrop);

  let itemSelected = "", itemAllOpts = [];

  function buildItemList(filter) {
    itemDrop.innerHTML = "";
    const lower = filter.toLowerCase();
    const filtered = itemAllOpts.filter(o => o.toLowerCase().includes(lower));
    if (!filtered.length) {
      itemDrop.innerHTML = '<div class="dropdown-item no-results">No results</div>';
    } else {
      filtered.slice(0, 200).forEach(o => {
        const d = document.createElement("div");
        d.className = "dropdown-item"; d.textContent = o;
        d.addEventListener("mousedown", e => {
          e.preventDefault();
          itemSelected = o; itemInput.value = o;
          itemDrop.classList.remove("open");
          const cat  = catSel.value;
          const found = (sheetData[cat] || []).find(i => i.code === o);
          row._foundItem = found || null;
          updatePriceType();
        });
        itemDrop.appendChild(d);
      });
    }
  }

  itemInput.addEventListener("focus", () => { buildItemList(itemInput.value); itemDrop.classList.add("open"); });
  itemInput.addEventListener("input", () => { itemSelected = ""; buildItemList(itemInput.value); itemDrop.classList.add("open"); });
  itemInput.addEventListener("blur",  () => {
    setTimeout(() => { itemDrop.classList.remove("open"); if (itemInput.value !== itemSelected) itemInput.value = itemSelected; }, 150);
  });

  catSel.addEventListener("change", () => {
    const cat = catSel.value;
    itemAllOpts = cat && sheetData[cat] ? sheetData[cat].map(r => r.code) : [];
    itemSelected = ""; itemInput.value = "";
    row._foundItem = null; row._activeRate = 0;
    priceTypeSel.style.display = "none";
    regularSpan.textContent = "—";
    updateGrandTotal();
  });

  const qtyInput = document.createElement("input");
  qtyInput.type = "number"; qtyInput.min = "1"; qtyInput.step = "1"; qtyInput.value = "1";
  qtyInput.className = "addon-qty";
  qtyInput.addEventListener("input", updateGrandTotal);

  const chargedSpan = document.createElement("div");
  chargedSpan.className = "addon-subtotal-val";
  chargedSpan.textContent = "₱ 0.00";

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-remove"; removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => { row.remove(); updateGrandTotal(); });

  row._foundItem    = null;
  row._activeRate   = 0;
  row._chargedSpan  = chargedSpan;
  row._qtyInput     = qtyInput;
  row._priceTypeSel = priceTypeSel;
  row._updatePriceType = updatePriceType;
  row._getItemCode  = () => itemSelected;
  row._getCat       = () => catSel.value;

  row.appendChild(catSel); row.appendChild(itemWrap); row.appendChild(priceTypeSel);
  row.appendChild(qtyInput); row.appendChild(regularSpan);
  row.appendChild(chargedSpan); row.appendChild(removeBtn);
  document.getElementById("addonRows").appendChild(row);
  updateGrandTotal();
}

document.getElementById("addAddonBtn").addEventListener("click", addAddonRow);
document.getElementById("packageType").addEventListener("change", renderPackage);
document.getElementById("packageColor").addEventListener("change", updateGrandTotal);

/* ══════════════════════════════════════════════
   RENTAL CALCULATOR
══════════════════════════════════════════════ */
function buildRentalTrackedPanel() {
  const trackedCats = [...new Set(
    rentalMaster.filter(i => i.type === "TRACKED").map(i => i.category)
  )].sort();

  const catSel = document.getElementById("r-t-category");
  trackedCats.forEach(c => {
    const o = document.createElement("option"); o.value = c; o.textContent = c;
    catSel.appendChild(o);
  });

  let selectedItem = null;
  const searchEl   = document.getElementById("r-t-search");
  const dropEl     = document.getElementById("r-t-dropdown");
  const priceSelEl = document.getElementById("r-t-price-selector");
  const rentalDisp = document.getElementById("r-t-rental-display");
  const fuDisp     = document.getElementById("r-t-fu-display");
  const ratePreview= document.getElementById("r-t-rate-preview");
  const rateEl     = document.getElementById("r-t-rate-val");
  const addBtn     = document.getElementById("r-t-add-btn");
  const errorEl    = document.getElementById("r-t-error");

  function getAvailableItems(cat) {
    const used = new Set(rentalCart.filter(i => i.type === "TRACKED" && i.category === cat).map(i => i.name));
    return rentalMaster.filter(i => i.type === "TRACKED" && i.category === cat && !used.has(i.name));
  }

  function renderDropdown(items) {
    dropEl.innerHTML = items.length
      ? items.slice(0, 150).map(i => `<div class="dropdown-item" data-name="${esc(i.name)}">${esc(i.name)}</div>`).join("")
      : '<div class="dropdown-item no-results">No items found</div>';
    dropEl.classList.add("open");
  }

  function selectItem(item) {
    selectedItem = item;
    searchEl.value = item.name;
    dropEl.classList.remove("open");
    errorEl.classList.remove("visible");
    const hasR = item.rentalRate != null;
    const hasF = item.firstUserPrice != null && item.firstUserPrice > 0;
    if (hasF) {
      ratePreview.style.display = "none"; priceSelEl.style.display = "block";
      rentalDisp.textContent = hasR ? `₱${money(item.rentalRate)}` : "No rate";
      fuDisp.textContent = `₱${money(item.firstUserPrice)}`;
      document.querySelector('input[name="r-t-price-type"][value="rental"]').checked = true;
      addBtn.disabled = !hasR;
    } else {
      ratePreview.style.display = ""; priceSelEl.style.display = "none";
      rateEl.textContent = hasR ? `₱${money(item.rentalRate)}` : "No rate set";
      rateEl.classList.toggle("empty", !hasR);
      addBtn.disabled = !hasR;
    }
  }

  function resetTracked() {
    selectedItem = null; searchEl.value = ""; searchEl.disabled = true;
    catSel.value = ""; ratePreview.style.display = ""; priceSelEl.style.display = "none";
    rateEl.textContent = "Select an item"; rateEl.classList.add("empty");
    addBtn.disabled = true; dropEl.classList.remove("open");
  }

  catSel.addEventListener("change", () => {
    selectedItem = null; searchEl.value = "";
    searchEl.disabled = !catSel.value;
    ratePreview.style.display = ""; priceSelEl.style.display = "none";
    rateEl.textContent = "Select an item"; rateEl.classList.add("empty");
    addBtn.disabled = true; dropEl.classList.remove("open");
  });

  searchEl.addEventListener("input", () => {
    selectedItem = null; addBtn.disabled = true;
    rateEl.textContent = "Select an item"; rateEl.classList.add("empty");
    priceSelEl.style.display = "none"; ratePreview.style.display = "";
    const cat = catSel.value; if (!cat) return;
    const q = searchEl.value.trim().toLowerCase();
    const available = getAvailableItems(cat);
    renderDropdown(q ? available.filter(i => i.name.toLowerCase().includes(q)) : available);
  });

  searchEl.addEventListener("focus", () => {
    const cat = catSel.value; if (!cat) return;
    const q = searchEl.value.trim().toLowerCase();
    renderDropdown(q ? getAvailableItems(cat).filter(i => i.name.toLowerCase().includes(q)) : getAvailableItems(cat));
  });

  dropEl.addEventListener("mousedown", e => {
    const itEl = e.target.closest(".dropdown-item");
    if (!itEl || itEl.classList.contains("no-results")) return;
    const item = rentalMaster.find(i => i.type === "TRACKED" && i.category === catSel.value && i.name === itEl.dataset.name);
    if (item) selectItem(item);
  });

  document.addEventListener("click", e => {
    if (!document.getElementById("r-t-search-wrap")?.contains(e.target)) dropEl.classList.remove("open");
  });

  addBtn.addEventListener("click", () => {
    if (!selectedItem) return;
    if (rentalCart.some(i => i.type === "TRACKED" && i.category === selectedItem.category && i.name === selectedItem.name)) {
      errorEl.textContent = `${selectedItem.name} is already in the list.`;
      errorEl.classList.add("visible"); return;
    }
    const hasF = selectedItem.firstUserPrice != null && selectedItem.firstUserPrice > 0;
    let chosenRate, pricingLabel;
    if (hasF) {
      const sel = document.querySelector('input[name="r-t-price-type"]:checked');
      if (sel?.value === "firstUser") { chosenRate = selectedItem.firstUserPrice; pricingLabel = "First User"; }
      else { chosenRate = selectedItem.rentalRate; pricingLabel = "Rental Rate"; }
    } else { chosenRate = selectedItem.rentalRate; pricingLabel = "Rental Rate"; }
    rentalCart.push({ id: uid(), category: selectedItem.category, name: selectedItem.name, rentalRate: chosenRate, pricingLabel, quantity: 1, amount: chosenRate, type: "TRACKED" });
    resetTracked();
    renderRentalItems();
  });
}

function buildRentalQtyPanel() {
  const qtyCats = [...new Set(rentalMaster.filter(i => i.type === "QUANTITY").map(i => i.category))];
  const catSel  = document.getElementById("r-q-category");
  qtyCats.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; catSel.appendChild(o); });

  const sizeEl = document.getElementById("r-q-size");
  const qtyEl  = document.getElementById("r-q-qty");
  const rateEl = document.getElementById("r-q-rate-val");
  const addBtn = document.getElementById("r-q-add-btn");
  const errEl  = document.getElementById("r-q-error");
  let selectedQtyItem = null;

  catSel.addEventListener("change", () => {
    const cat = catSel.value;
    sizeEl.innerHTML = '<option value="">— Select —</option>';
    sizeEl.disabled = !cat; qtyEl.disabled = true; addBtn.disabled = true;
    selectedQtyItem = null; rateEl.textContent = "Select an item"; rateEl.classList.add("empty");
    if (!cat) return;
    rentalMaster.filter(i => i.type === "QUANTITY" && i.category === cat).forEach(i => {
      const opt = document.createElement("option"); opt.value = i.name; opt.textContent = i.name;
      sizeEl.appendChild(opt);
    });
    sizeEl.disabled = false;
  });

  sizeEl.addEventListener("change", () => {
    const name = sizeEl.value;
    if (!name) { selectedQtyItem = null; rateEl.textContent = "Select an item"; rateEl.classList.add("empty"); qtyEl.disabled = true; addBtn.disabled = true; return; }
    selectedQtyItem = rentalMaster.find(i => i.type === "QUANTITY" && i.category === catSel.value && i.name === name);
    if (selectedQtyItem) {
      const rate = selectedQtyItem.rentalRate;
      rateEl.textContent = rate != null ? `₱${money(rate)}` : "No rate set";
      rateEl.classList.toggle("empty", rate == null);
      qtyEl.disabled = rate == null; addBtn.disabled = rate == null;
      if (rate != null) qtyEl.focus();
    }
  });

  addBtn.addEventListener("click", () => {
    if (!selectedQtyItem) return;
    const qty = parseInt(qtyEl.value) || 1;
    if (qty < 1) { errEl.textContent = "Quantity must be at least 1."; errEl.classList.add("visible"); return; }
    const { category: cat, name, rentalRate: rate } = selectedQtyItem;
    const existing = rentalCart.find(i => i.type === "QUANTITY" && i.category === cat && i.name === name);
    if (existing) { existing.quantity += qty; existing.amount = existing.rentalRate * existing.quantity; }
    else { rentalCart.push({ id: uid(), category: cat, name, rentalRate: rate, pricingLabel: "Rental Rate", quantity: qty, amount: rate * qty, type: "QUANTITY" }); }
    sizeEl.value = ""; qtyEl.value = 1; qtyEl.disabled = true; addBtn.disabled = true;
    selectedQtyItem = null; rateEl.textContent = "Select an item"; rateEl.classList.add("empty");
    errEl.classList.remove("visible");
    renderRentalItems();
  });
}

function renderRentalItems() {
  const list    = document.getElementById("rental-items-list");
  const emptyEl = document.getElementById("rental-items-empty");
  const badge   = document.getElementById("rental-badge");

  if (!rentalCart.length) {
    list.innerHTML = ""; emptyEl.style.display = "block";
    badge.textContent = "0"; updateGrandTotal(); return;
  }

  emptyEl.style.display = "none";
  badge.textContent = rentalCart.length;

  list.innerHTML = rentalCart.map(item => {
    const label = item.type === "QUANTITY" ? `${item.name} ×${item.quantity}` : item.name;
    const meta  = item.type === "QUANTITY"
      ? `₱${money(item.rentalRate)} × ${item.quantity}`
      : (item.pricingLabel || "Rental Rate");
    const fuTag = item.pricingLabel === "First User" ? '<span class="fu-tag">1st User</span>' : "";
    return `<div class="rental-item" data-id="${item.id}">
      <div class="item-info">
        <div class="item-name">${esc(label)} ${fuTag}</div>
        <div class="item-meta">${esc(meta)}</div>
      </div>
      <div class="item-amount">₱${money(item.amount)}</div>
      <button class="btn-remove" data-id="${item.id}">×</button>
    </div>`;
  }).join("");

  list.querySelectorAll(".btn-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      rentalCart = rentalCart.filter(i => i.id !== btn.dataset.id);
      renderRentalItems();
    });
  });

  updateGrandTotal();
}

/* ══════════════════════════════════════════════
   RETAIL CALCULATOR
══════════════════════════════════════════════ */
function buildRetailPanel() {
  const catSel = document.getElementById("ret-category");
  const loadedCats = new Set(retailItems.map(i => i.category));
  RETAIL_SHEETS.forEach(({ label }) => {
    if (!loadedCats.has(label)) return;
    const opt = document.createElement("option"); opt.value = label; opt.textContent = label;
    catSel.appendChild(opt);
  });

  let selectedRetailItem = null;
  const searchEl = document.getElementById("ret-search");
  const dropEl   = document.getElementById("ret-dropdown");
  const priceEl  = document.getElementById("ret-price-val");
  const addBtn   = document.getElementById("ret-add-btn");
  const errorEl  = document.getElementById("ret-error");

  function getAvailableRetail(cat) {
    const inCart = new Set(retailCart.map(c => c.name + "|" + c.category));
    return retailItems.filter(i => i.category === cat && !inCart.has(i.name + "|" + i.category));
  }

  function renderRetailDrop(items) {
    dropEl.innerHTML = items.length
      ? items.slice(0, 200).map(i => `<div class="dropdown-item" data-name="${esc(i.name)}">${esc(i.name)} — ₱${money(i.retailPrice)}</div>`).join("")
      : '<div class="dropdown-item no-results">No items found</div>';
    dropEl.classList.add("open");
  }

  catSel.addEventListener("change", () => {
    selectedRetailItem = null; searchEl.value = "";
    searchEl.disabled = !catSel.value;
    priceEl.textContent = "Select an item"; priceEl.classList.add("empty");
    addBtn.disabled = true; dropEl.classList.remove("open");
  });

  searchEl.addEventListener("input", () => {
    selectedRetailItem = null; addBtn.disabled = true;
    const cat = catSel.value; if (!cat) return;
    const q = searchEl.value.trim().toLowerCase();
    const avail = getAvailableRetail(cat);
    renderRetailDrop(q ? avail.filter(i => i.name.toLowerCase().includes(q)) : avail);
  });

  searchEl.addEventListener("focus", () => {
    const cat = catSel.value; if (!cat) return;
    const q = searchEl.value.trim().toLowerCase();
    const avail = getAvailableRetail(cat);
    renderRetailDrop(q ? avail.filter(i => i.name.toLowerCase().includes(q)) : avail);
  });

  dropEl.addEventListener("mousedown", e => {
    const itEl = e.target.closest(".dropdown-item");
    if (!itEl || itEl.classList.contains("no-results")) return;
    const item = retailItems.find(i => i.name === itEl.dataset.name && i.category === catSel.value);
    if (item) {
      selectedRetailItem = item; searchEl.value = item.name;
      dropEl.classList.remove("open");
      priceEl.textContent = `₱${money(item.retailPrice)}`; priceEl.classList.remove("empty");
      addBtn.disabled = false;
    }
  });

  document.addEventListener("click", e => {
    if (!document.getElementById("ret-search-wrap")?.contains(e.target)) dropEl.classList.remove("open");
  });

  addBtn.addEventListener("click", () => {
    if (!selectedRetailItem) return;
    if (retailCart.find(c => c.name === selectedRetailItem.name && c.category === selectedRetailItem.category)) {
      errorEl.textContent = `"${selectedRetailItem.name}" is already in your list.`;
      errorEl.classList.add("visible"); return;
    }
    retailCart.push({ ...selectedRetailItem });
    selectedRetailItem = null; searchEl.value = ""; searchEl.disabled = true;
    catSel.value = ""; priceEl.textContent = "Select an item"; priceEl.classList.add("empty");
    addBtn.disabled = true; errorEl.classList.remove("visible");
    renderRetailItems();
  });
}

function renderRetailItems() {
  const list    = document.getElementById("retail-items-list");
  const emptyEl = document.getElementById("retail-items-empty");
  const badge   = document.getElementById("retail-badge");

  if (!retailCart.length) {
    list.innerHTML = ""; emptyEl.style.display = "block";
    badge.textContent = "0"; updateGrandTotal(); return;
  }

  emptyEl.style.display = "none";
  badge.textContent = retailCart.length;

  list.innerHTML = retailCart.map(item => `
    <div class="rental-item">
      <div class="item-info">
        <div class="item-name">${esc(item.name)}</div>
        <div class="item-meta">${esc(item.category)}</div>
      </div>
      <div class="item-amount">₱${money(item.retailPrice)}</div>
      <button class="btn-remove" data-name="${esc(item.name)}" data-cat="${esc(item.category)}">×</button>
    </div>`).join("");

  list.querySelectorAll(".btn-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      retailCart = retailCart.filter(c => !(c.name === btn.dataset.name && c.category === btn.dataset.cat));
      renderRetailItems();
    });
  });

  updateGrandTotal();
}

/* ══════════════════════════════════════════════
   GRAND TOTAL & SUMMARY BUILDER
══════════════════════════════════════════════ */
function updateGrandTotal() {
  if (!dataReady) return;

  const pkg   = document.getElementById("packageType").value;
  const color = document.getElementById("packageColor").value;

  /* ── Package calculation ── */
  let packTotal = 0, addonTotal = 0;
  const pkgLines = [], addonLines = [];
  let pkgHasItems = false;

  document.querySelectorAll(".package-qty").forEach(input => {
    const k   = input.dataset.k;
    const qty = Math.max(0, parseInt(input.value) || 0);
    const [name, price] = packagePrices[pkg][k];
    const sub = qty * price;
    packTotal += sub;
    const subEl = document.getElementById("sub_" + k);
    if (subEl) subEl.textContent = money(sub);

    if (qty > 0) {
      pkgHasItems = true;
      const codes = [];
      if (k === "bridal_gown") {
        document.querySelectorAll("#bgPickers .gown-picker-set").forEach(set => {
          const cat  = set.querySelector(".gown-cat-sel")?.value || "";
          const item = set.querySelector(".gown-item-sel")?.value || "";
          codes.push((cat && item) ? `${cat}/${item}` : (item || ""));
        });
      }
      if (k === "mother") {
        document.querySelectorAll("#mgPickers .gown-picker-set").forEach(set => {
          const cat  = set.querySelector(".gown-cat-sel")?.value || "";
          const item = set.querySelector(".gown-item-sel")?.value || "";
          codes.push((cat && item) ? `${cat}/${item}` : (item || ""));
        });
      }
      let line = `  ${name.padEnd(22)}x${qty}   ₱${money(price)}`;
      if (codes.length) line += `\n    Item Code: ${codes.map((c,i) => c ? `#${i+1}: ${c}` : `#${i+1}: (not selected)`).join(", ")}`;
      pkgLines.push(line);
    }
  });

  document.querySelectorAll(".addon-row").forEach(row => {
    const qty      = Math.max(0, parseInt(row._qtyInput?.value) || 0);
    const rate     = row._activeRate || 0;
    const cat      = row._getCat?.() || "";
    const itemCode = row._getItemCode?.() || "";
    const charged  = rate * 0.8;
    const sub      = qty * charged;
    addonTotal += sub;
    if (row._chargedSpan) row._chargedSpan.textContent = "₱ " + money(sub);
    if (qty > 0 && rate > 0 && itemCode) {
      addonLines.push(`  ${(cat ? cat + "/" + itemCode : itemCode).padEnd(22)}x${qty}   ₱${money(charged)} (₱${money(rate)} less 20%)`);
    }
  });

  document.getElementById("packageSubtotal").textContent = money(packTotal);
  document.getElementById("addonSubtotal").textContent   = money(addonTotal);
  document.getElementById("packageTotal").textContent    = money(packTotal + addonTotal);

  /* ── Rental calculation ── */
  let rentalTotal = 0;
  rentalCart.forEach(item => { rentalTotal += item.amount || 0; });
  document.getElementById("rentalTotal").textContent = money(rentalTotal);

  /* ── Retail calculation ── */
  let retailTotal = 0;
  retailCart.forEach(item => { retailTotal += item.retailPrice || 0; });
  document.getElementById("retailTotal").textContent = money(retailTotal);

  /* ── Grand total ── */
  const grandTotal = packTotal + addonTotal + rentalTotal + retailTotal;
  document.getElementById("grandTotalAll").textContent = money(grandTotal);
  document.getElementById("payGrandTotal").textContent = money(grandTotal);

  /* ── Payment summary ── */
  const amountPaid = parseFloat(document.getElementById("amountPaid").value) || 0;
  const discount   = parseFloat(document.getElementById("discountAmount").value) || 0;
  const remaining  = grandTotal - amountPaid - discount;
  document.getElementById("remainingBalance").textContent = money(Math.max(0, remaining));

  /* ── Build summary ── */
  const anySelected = pkgHasItems || rentalCart.length > 0 || retailCart.length > 0;
  if (!anySelected && !color) {
    window.latestSubmissionText = "";
    broadcastToJotform();
    return;
  }

  const lines = [];

  // Package section
  if (pkgHasItems || color) {
    lines.push("WEDDING ENTOURAGE PACKAGE");
    lines.push(`  Package: ${packageNames[pkg]}`);
    if (color) lines.push(`  Color: ${color}`);
    lines.push("");
    lines.push(...pkgLines);
    if (addonLines.length) {
      lines.push("");
      lines.push("  Add-On Items (20% off):");
      lines.push(...addonLines);
    }
    lines.push("");
    lines.push(`  Package Subtotal:      ₱${money(packTotal)}`);
    if (addonLines.length) lines.push(`  Add-On Subtotal:       ₱${money(addonTotal)}`);
    lines.push(`  PACKAGE TOTAL:         ₱${money(packTotal + addonTotal)}`);
  }

  // Rental section
  if (rentalCart.length) {
    if (lines.length) lines.push("", "------------------------------------------", "");
    lines.push("RENTAL ITEMS");
    lines.push("");
    rentalCart.forEach(item => {
      if (item.type === "QUANTITY") {
        lines.push(`  ${item.name.padEnd(22)}x${item.quantity}   ₱${money(item.rentalRate)}`);
      } else {
        const fuTag = item.pricingLabel === "First User" ? " (First User)" : "";
        lines.push(`  ${item.name.padEnd(22)}₱${money(item.amount)}${fuTag}`);
      }
    });
    lines.push("");
    lines.push(`  RENTAL TOTAL:          ₱${money(rentalTotal)}`);
  }

  // Retail section
  if (retailCart.length) {
    if (lines.length) lines.push("", "------------------------------------------", "");
    lines.push("PURCHASED ITEMS");
    lines.push("");
    retailCart.forEach(item => {
      lines.push(`  ${item.name.padEnd(22)}₱${money(item.retailPrice)}`);
    });
    lines.push("");
    lines.push(`  PURCHASE TOTAL:        ₱${money(retailTotal)}`);
  }

  // Grand total
  lines.push("", "------------------------------------------");
  lines.push(`GRAND TOTAL:             ₱${money(grandTotal)}`);

  // Payment summary
  if (amountPaid > 0 || discount > 0) {
    lines.push("");
    lines.push("PAYMENT SUMMARY");
    if (amountPaid > 0) lines.push(`  Amount Paid:           ₱${money(amountPaid)}`);
    if (discount > 0)   lines.push(`  Discount:              ₱${money(discount)}`);
    lines.push(`  Remaining Balance:     ₱${money(remaining)}`);
  }

  window.latestSubmissionText = lines.join("\n");
  broadcastToJotform();
}

/* ══════════════════════════════════════════════
   JOTFORM INTEGRATION
══════════════════════════════════════════════ */
function broadcastToJotform() {
  const value = window.latestSubmissionText || "";
  if (typeof JFCustomWidget !== "undefined") {
    try { JFCustomWidget.sendData({ value }); } catch(e) {}
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(JSON.stringify({ type: "widgetValue", value, valid: true }), "*");
    }
  } catch(e) {}
}

function saveToLocalStorage(sid, text) {
  if (!sid || !text) return;
  try { localStorage.setItem("jf_combined_" + sid, text); } catch(e) {}
}

function loadFromLocalStorage(sid) {
  if (!sid) return null;
  try { return localStorage.getItem("jf_combined_" + sid) || null; } catch(e) { return null; }
}

/* ══════════════════════════════════════════════
   RESTORE FROM SUMMARY
══════════════════════════════════════════════ */
async function restoreFromSummary(text) {
  if (!text || !text.trim()) return;
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);

  let section = null;

  for (const line of lines) {
    if (line === "WEDDING ENTOURAGE PACKAGE") { section = "package"; continue; }
    if (line === "RENTAL ITEMS")   { section = "rental"; continue; }
    if (line === "PURCHASED ITEMS") { section = "retail"; continue; }
    if (line.startsWith("--") || line.startsWith("GRAND TOTAL")) continue;

    if (section === "package") {
      // Package type
      const pkgMatch = line.match(/^Package:\s*(.+)$/);
      if (pkgMatch) {
        const pkgName = pkgMatch[1].trim();
        const pkgSel = document.getElementById("packageType");
        for (const [val, name] of Object.entries(packageNames)) {
          if (name === pkgName) { pkgSel.value = val; break; }
        }
        renderPackage(); continue;
      }
      // Color
      const colorMatch = line.match(/^Color:\s*(.+)$/);
      if (colorMatch) {
        document.getElementById("packageColor").value = colorMatch[1].trim(); continue;
      }
      // Package item: "Bridesmaid              x1   ₱280.50"
      const pkgItemMatch = line.match(/^(.+?)\s+x(\d+)\s+₱[\d,]+\.?\d*$/);
      if (pkgItemMatch) {
        const name = pkgItemMatch[1].trim();
        const qty  = parseInt(pkgItemMatch[2]);
        const pkg  = document.getElementById("packageType").value;
        for (const k of pkgKeys) {
          if (packagePrices[pkg][k][0] === name) {
            const inp = document.querySelector(`.package-qty[data-k="${k}"]`);
            if (inp) { inp.value = qty; inp.dispatchEvent(new Event("input")); }
            break;
          }
        }
        continue;
      }
      // Gown item code: "Item Code: #1: BGI/BGI001"
      // (handled by qty dispatch above triggering picker rebuild — restore picker values separately)
      const codeMatch = line.match(/^Item Code:\s*(.+)$/);
      if (codeMatch) {
        // Parse "#1: BGI/BGI001, #2: BGS/BGS002"
        const pairs = [...codeMatch[1].matchAll(/#(\d+):\s*([^/,]+)\/([^,\s]+)/g)];
        // Try bridal gown first then mother's gown
        const tryPickers = (containerId) => {
          const sets = document.querySelectorAll(`#${containerId} .gown-picker-set`);
          pairs.forEach(m => {
            const idx  = parseInt(m[1]) - 1;
            const cat  = m[2].trim();
            const code = m[3].trim();
            const set  = sets[idx];
            if (!set) return;
            const catSel  = set.querySelector(".gown-cat-sel");
            const itemInp = set.querySelector(".gown-item-sel");
            if (catSel) {
              catSel.value = cat;
              if (sheetData[cat]) {
                // populate options on the inline search
                const opts = sheetData[cat].map(r => r.code);
                // we stored the search component on the element for restore
              }
            }
            if (itemInp) itemInp.value = code;
          });
        };
        tryPickers("bgPickers");
        tryPickers("mgPickers");
        continue;
      }
      // Add-on: "BGI-ADD ON/BGI001   x1   ₱960.00 (₱1,200.00 less 20%)"
      const addonMatch = line.match(/^([^x]+)\s+x(\d+)\s+₱/);
      if (addonMatch && line.includes("less 20%")) {
        // Add a new addon row and try to populate it
        addAddonRow();
        const rows = document.querySelectorAll(".addon-row");
        const aRow = rows[rows.length - 1];
        const fullCode = addonMatch[1].trim();
        const slash = fullCode.indexOf("/");
        if (slash > -1) {
          const cat  = fullCode.substring(0, slash);
          const code = fullCode.substring(slash + 1);
          const catSel = aRow.querySelector(".addon-cat");
          if (catSel) {
            catSel.value = cat;
            catSel.dispatchEvent(new Event("change"));
            await new Promise(r => setTimeout(r, 0));
          }
          // Set item code via the input
          const inp = aRow.querySelector(".addon-item-input");
          if (inp) { inp.value = code; inp.dispatchEvent(new Event("input")); }
          if (aRow._qtyInput) aRow._qtyInput.value = parseInt(addonMatch[2]) || 1;
        }
      }
    }

    if (section === "rental") {
      // Tracked: "BGI-10002              ₱3,500.00"
      // Quantity: "BOY ×2                 ₱700.00"
      const qtyMatch = line.match(/^(.+?)\s+×(\d+)\s+₱[\d,]+\.?\d*$/);
      if (qtyMatch) {
        const name = qtyMatch[1].trim();
        const qty  = parseInt(qtyMatch[2]);
        const master = rentalMaster.find(i => i.type === "QUANTITY" && i.name === name);
        if (master) {
          const existing = rentalCart.find(i => i.type === "QUANTITY" && i.name === name);
          if (existing) { existing.quantity += qty; existing.amount = existing.rentalRate * existing.quantity; }
          else rentalCart.push({ id: uid(), category: master.category, name, rentalRate: master.rentalRate, pricingLabel: "Rental Rate", quantity: qty, amount: master.rentalRate * qty, type: "QUANTITY" });
        }
        continue;
      }
      const trackedMatch = line.match(/^(.+?)\s+₱[\d,]+\.?\d*(\s+\(First User\))?$/);
      if (trackedMatch && !line.startsWith("RENTAL TOTAL")) {
        const name = trackedMatch[1].trim();
        const isFirstUser = !!trackedMatch[2];
        const master = rentalMaster.find(i => i.type === "TRACKED" && i.name === name);
        if (master) {
          const rate  = isFirstUser ? (master.firstUserPrice ?? master.rentalRate) : master.rentalRate;
          const label = isFirstUser ? "First User" : "Rental Rate";
          rentalCart.push({ id: uid(), category: master.category, name, rentalRate: rate, pricingLabel: label, quantity: 1, amount: rate, type: "TRACKED" });
        }
      }
    }

    if (section === "retail") {
      const retailMatch = line.match(/^(.+?)\s+₱[\d,]+\.?\d*$/);
      if (retailMatch && !line.startsWith("PURCHASE TOTAL")) {
        const name = retailMatch[1].trim();
        const master = retailItems.find(i => i.name === name);
        if (master && !retailCart.find(c => c.name === name)) {
          retailCart.push({ ...master });
        }
      }
    }

    // Payment summary restore
    const paidMatch = line.match(/^Amount Paid:\s*₱([\d,]+\.?\d*)$/);
    if (paidMatch) { document.getElementById("amountPaid").value = paidMatch[1].replace(/,/g, ""); }
    const discMatch = line.match(/^Discount:\s*₱([\d,]+\.?\d*)$/);
    if (discMatch) { document.getElementById("discountAmount").value = discMatch[1].replace(/,/g, ""); }
  }

  renderRentalItems();
  renderRetailItems();
  updateGrandTotal();
}

/* ══════════════════════════════════════════════
   JOTFORM SETUP
══════════════════════════════════════════════ */
function setupJotform() {
  if (typeof JFCustomWidget === "undefined") return;

  JFCustomWidget.subscribe("submit", () => {
    updateGrandTotal();
    JFCustomWidget.sendSubmit({ valid: true, value: window.latestSubmissionText || "" });
  });

  JFCustomWidget.subscribe("ready", async function(data) {
    // Extract submission ID
    let sid = data?.sid || data?.submissionID || data?.submissionId || null;
    if (sid) sid = String(sid);
    if (!sid) {
      try { const m = JSON.stringify(data).match(/"sid"\s*:\s*"?(\d+)"?/); if (m) sid = m[1]; } catch(e) {}
    }
    if (!sid) { try { const m = window.parent.location.href.match(/\/edit\/(\d+)/); if (m) sid = m[1]; } catch(e) {} }
    if (sid) window._jfSid = sid;

    // Try restore from ready event value
    let saved = (data?.value && data.value.trim()) ? data.value.trim() : null;

    // Try localStorage
    if (!saved && sid) saved = loadFromLocalStorage(sid);

    // Try JotForm API
    if (!saved && sid) {
      try {
        const res  = await fetch(`https://api.jotform.com/submission/${sid}?apiKey=${API_KEY}&nocache=${Date.now()}`);
        const json = await res.json();
        // Try to find the combined summary field — look for the field with our summary format
        const answers = json?.content?.answers || {};
        for (const ans of Object.values(answers)) {
          const val = ans?.answer || "";
          if (val && (val.includes("WEDDING ENTOURAGE PACKAGE") || val.includes("RENTAL ITEMS") || val.includes("PURCHASED ITEMS") || val.includes("GRAND TOTAL:"))) {
            saved = val; break;
          }
        }
      } catch(e) {}
    }

    if (saved) {
      if (dataReady) { await restoreFromSummary(saved); }
      else { window._savedRestoreText = saved; }
    } else {
      broadcastToJotform();
    }
  });
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  const waitForJotform = () => new Promise(resolve => {
    if (typeof JFCustomWidget !== "undefined") { resolve(); return; }
    const interval = setInterval(() => {
      if (typeof JFCustomWidget !== "undefined") { clearInterval(interval); resolve(); }
    }, 50);
    setTimeout(() => { clearInterval(interval); resolve(); }, 5000);
  });

  await waitForJotform();
  setupJotform();

  document.getElementById("amountPaid").addEventListener("input", updateGrandTotal);
  document.getElementById("discountAmount").addEventListener("input", updateGrandTotal);

  await loadAllData();
});
